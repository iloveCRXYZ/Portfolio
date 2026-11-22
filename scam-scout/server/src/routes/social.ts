import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { type Ctx, bad, conflict, friendIds, getUser, notFound, notify, pairKey, publicUser, requireAuth } from '../ctx.ts';
import { all, one, run, tx } from '../db.ts';
import { dayKey, tierFor } from '../scoring.ts';

export default async function socialRoutes(app: FastifyInstance, ctx: Ctx) {
  app.addHook('preHandler', requireAuth(ctx));

  app.get('/friends', async (req) => {
    const me = req.userId;
    const rows = all(ctx.db, 'SELECT * FROM friendships WHERE user_a = ? OR user_b = ?', me, me);
    const out = { friends: [] as any[], incoming: [] as any[], outgoing: [] as any[] };
    for (const r of rows) {
      const other = r.user_a === me ? r.user_b : r.user_a;
      const u = publicUser(ctx, getUser(ctx, other));
      if (r.status === 'accepted') out.friends.push(u);
      else if (r.requested_by === me) out.outgoing.push(u);
      else out.incoming.push(u);
    }
    out.friends.sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username));
    return out;
  });

  app.get('/users/search', async (req) => {
    const { q } = z.object({ q: z.string().trim().min(1).max(30) }).parse(req.query);
    const rows = all(ctx.db, "SELECT * FROM users WHERE username LIKE ? ESCAPE '\\' AND id != ? AND is_bot = 0 ORDER BY LENGTH(username) LIMIT 20", q.replace(/[\\%_]/g, (c) => '\\' + c) + '%', req.userId);
    return rows.map((u) => ({ ...publicUser(ctx, u), relation: relation(ctx, req.userId, u.id) }));
  });

  /** Players near your level you aren't connected to yet. */
  app.get('/users/suggested', async (req) => {
    const me = getUser(ctx, req.userId);
    const played = (one(ctx.db, 'SELECT COUNT(*) AS n FROM games WHERE user_id = ? AND finished_at IS NOT NULL', me.id)!.n as number) ?? 0;
    if (played < 3) return [];
    const rows = all(ctx.db, 'SELECT * FROM users WHERE id != ? AND is_bot = 0 ORDER BY ABS(elo - ?) LIMIT 30', me.id, me.elo);
    return rows
      .filter((u) => relation(ctx, me.id, u.id) === 'none')
      .slice(0, 8)
      .map((u) => ({ ...publicUser(ctx, u), relation: 'none' }));
  });

  app.post('/friends/requests', async (req) => {
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    if (userId === req.userId) throw bad("You can't add yourself.");
    getUser(ctx, userId);
    return tx(ctx.db, () => {
      const [a, b] = pairKey(req.userId, userId);
      const ex = one(ctx.db, 'SELECT * FROM friendships WHERE user_a = ? AND user_b = ?', a, b);
      if (ex?.status === 'accepted') throw conflict('You are already friends.', 'already_friends');
      if (ex && ex.requested_by === req.userId) throw conflict('Request already sent.', 'already_requested');
      if (ex) {
        // They already asked us: adding back accepts.
        run(ctx.db, "UPDATE friendships SET status = 'accepted' WHERE user_a = ? AND user_b = ?", a, b);
        notify(ctx, userId, 'friend_accepted', `${getUser(ctx, req.userId).username} accepted your friend request.`, { userId: req.userId });
        return { relation: 'friends' };
      }
      run(ctx.db, "INSERT INTO friendships (user_a, user_b, status, requested_by, created_at) VALUES (?,?,'pending',?,?)", a, b, req.userId, ctx.now());
      notify(ctx, userId, 'friend_request', `${getUser(ctx, req.userId).username} sent you a friend request.`, { userId: req.userId });
      return { relation: 'outgoing' };
    });
  });

  app.post('/friends/requests/:userId/:action', async (req) => {
    const { userId, action } = req.params as { userId: string; action: string };
    const [a, b] = pairKey(req.userId, userId);
    const ex = one(ctx.db, "SELECT * FROM friendships WHERE user_a = ? AND user_b = ? AND status = 'pending'", a, b);
    if (!ex) throw notFound('No pending request');
    if (action === 'accept') {
      if (ex.requested_by === req.userId) throw bad('Wait for them to accept.');
      run(ctx.db, "UPDATE friendships SET status = 'accepted' WHERE user_a = ? AND user_b = ?", a, b);
      notify(ctx, userId, 'friend_accepted', `${getUser(ctx, req.userId).username} accepted your friend request.`, { userId: req.userId });
      run(ctx.db, "UPDATE notifications SET read = 1 WHERE user_id = ? AND kind = 'friend_request' AND json_extract(data, '$.userId') = ?", req.userId, userId);
      return { relation: 'friends' };
    }
    if (action === 'decline' || action === 'cancel') {
      run(ctx.db, 'DELETE FROM friendships WHERE user_a = ? AND user_b = ?', a, b);
      return { relation: 'none' };
    }
    throw notFound();
  });

  app.delete('/friends/:userId', async (req) => {
    const [a, b] = pairKey(req.userId, (req.params as { userId: string }).userId);
    run(ctx.db, 'DELETE FROM friendships WHERE user_a = ? AND user_b = ?', a, b);
    return { relation: 'none' };
  });

  /**
   * Points scored in finished games during the period.
   * scope=friends limits the board to you and your friends.
   */
  app.get('/leaderboard', async (req) => {
    const q = z.object({ scope: z.enum(['global', 'friends']).default('global'), period: z.enum(['daily', 'monthly', 'lifetime']).default('daily') }).parse(req.query);
    const now = new Date(ctx.now());
    const since =
      q.period === 'daily' ? Date.parse(dayKey(ctx.now()) + 'T00:00:00Z') : q.period === 'monthly' ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) : 0;
    const ids = q.scope === 'friends' ? [req.userId, ...friendIds(ctx, req.userId)] : null;
    const filter = ids ? `AND u.id IN (${ids.map(() => '?').join(',')})` : '';
    const rows = all(
      ctx.db,
      `SELECT u.*, COALESCE(SUM(g.score),0) AS pts, COUNT(DISTINCT CASE WHEN json_extract(m.result, '$.players.' || u.id || '.outcome') = 'win' THEN m.id END) AS wins
       FROM users u
       JOIN games g ON g.user_id = u.id AND g.finished_at IS NOT NULL AND g.finished_at >= ?
       LEFT JOIN matches m ON m.id = g.match_id AND m.status = 'done'
       WHERE u.is_bot = 0 ${filter}
       GROUP BY u.id ORDER BY pts DESC, u.username LIMIT 100`,
      since,
      ...(ids ?? []),
    );
    const list = rows.map((u, i) => ({ rank: i + 1, user: publicUser(ctx, u), points: u.pts, wins: u.wins, tier: tierFor(u.elo, u.placements), isMe: u.id === req.userId }));
    let me = list.find((r) => r.isMe) ?? null;
    if (!me) {
      const mine = one(ctx.db, 'SELECT COALESCE(SUM(score),0) AS pts FROM games WHERE user_id = ? AND finished_at >= ?', req.userId, since)!;
      const ahead = one(
        ctx.db,
        `SELECT COUNT(*) AS n FROM (SELECT user_id, SUM(score) AS pts FROM games WHERE finished_at >= ? GROUP BY user_id HAVING pts > ?)`,
        since,
        mine.pts,
      )!;
      const u = getUser(ctx, req.userId);
      me = { rank: mine.pts > 0 ? (ahead.n as number) + 1 : (null as any), user: publicUser(ctx, u), points: mine.pts, wins: 0, tier: tierFor(u.elo, u.placements), isMe: true };
    }
    return { scope: q.scope, period: q.period, since, rows: list.slice(0, 50), me, friendCount: friendIds(ctx, req.userId).length };
  });
}

function relation(ctx: Ctx, me: string, other: string): 'none' | 'friends' | 'incoming' | 'outgoing' {
  const [a, b] = pairKey(me, other);
  const r = one(ctx.db, 'SELECT * FROM friendships WHERE user_a = ? AND user_b = ?', a, b);
  if (!r) return 'none';
  if (r.status === 'accepted') return 'friends';
  return r.requested_by === me ? 'outgoing' : 'incoming';
}
