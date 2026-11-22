import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { type Ctx, bad, getUser, notFound, prefsOf, publicUser, requireAuth, friendIds } from '../ctx.ts';
import { all, one, run } from '../db.ts';
import { ITEM_BY_ID } from '../content.ts';
import { PLACEMENT_MATCHES, dayKey, nextTier, streaks, tierFor } from '../scoring.ts';

const DEFAULT_PREFS = { timer: true, hints: false, reduceMotion: false, sound: true, music: 60, sfx: 80, notifyFriends: true, notifyDaily: true, notifyRanked: true, online: true, theme: 'system' };

export function statsFor(ctx: Ctx, userId: string) {
  const u = getUser(ctx, userId);
  const games = all(ctx.db, 'SELECT id, mode, score, finished_at, match_id, item_ids, best_run FROM games WHERE user_id = ? AND finished_at IS NOT NULL', userId);
  const { current, best } = streaks(games.map((g) => dayKey(g.finished_at)), new Date(ctx.now()));
  const since = ctx.now() - 30 * 86400_000;
  const recentAns = all(ctx.db, 'SELECT a.points, a.call FROM answers a JOIN games g ON g.id = a.game_id WHERE g.user_id = ? AND a.created_at > ? AND a.call IS NOT NULL', userId, since);
  const accuracy = recentAns.length ? Math.round((recentAns.filter((a) => a.points >= 60).length / recentAns.length) * 100) : null;
  const duels = all(ctx.db, "SELECT m.result, m.mode, mp.user_id FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.user_id = ? AND m.status = 'done'", userId);
  let wins = 0,
    losses = 0,
    draws = 0;
  for (const d of duels) {
    const o = JSON.parse(d.result).players[userId]?.outcome;
    if (o === 'win') wins++;
    else if (o === 'loss') losses++;
    else draws++;
  }
  // Badge progress
  const scamRight = (type: string) =>
    (one(
      ctx.db,
      "SELECT COUNT(*) AS n FROM answers a JOIN games g ON g.id = a.game_id WHERE g.user_id = ? AND a.call = 'scam' AND a.points >= 60 AND a.item_id LIKE ?",
      userId,
      `${type}-%`,
    )!.n as number) ?? 0;
  const perfect = games.some((g) => ['mail', 'sms', 'call', 'daily'].includes(g.mode) && g.score >= JSON.parse(g.item_ids).length * 100);
  const marathonBest = Math.max(0, ...games.filter((g) => g.mode === 'marathon').map((g) => JSON.parse(g.item_ids).length - 1));
  const rankedWins = duels.filter((d) => d.mode === 'ranked' && JSON.parse(d.result).players[userId]?.outcome === 'win').length;
  const fr = new Set(friendIds(ctx, userId));
  const beatenFriends = new Set(
    all(ctx.db, "SELECT m.id, m.result FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.user_id = ? AND m.status = 'done'", userId)
      .flatMap((m) => {
        const r = JSON.parse(m.result).players;
        if (r[userId]?.outcome !== 'win') return [];
        return Object.keys(r).filter((k) => k !== userId && fr.has(k));
      }),
  ).size;
  const badges = [
    { id: 'phish_slayer', name: 'Phish Slayer', icon: 'phishing', goal: 'Catch 100 scam emails', progress: scamRight('mail'), target: 100 },
    { id: 'perfect_10', name: 'Perfect 10', icon: 'workspace-premium', goal: 'Full marks in a mode', progress: perfect ? 1 : 0, target: 1 },
    { id: 'call_blocker', name: 'Call Blocker', icon: 'phone-disabled', goal: 'Hang up on 50 scam calls', progress: scamRight('call'), target: 50 },
    { id: 'text_detective', name: 'Text Detective', icon: 'sms-failed', goal: 'Flag 50 scam texts', progress: scamRight('sms'), target: 50 },
    { id: 'ranked_rookie', name: 'Ranked Rookie', icon: 'military-tech', goal: 'Win a ranked match', progress: Math.min(1, rankedWins), target: 1 },
    { id: 'on_fire', name: 'On Fire', icon: 'local-fire-department', goal: '7-day streak', progress: Math.min(7, best), target: 7 },
    { id: 'marathoner', name: 'Marathoner', icon: 'directions-run', goal: 'Last 40 Marathon rounds', progress: Math.min(40, marathonBest), target: 40 },
    { id: 'duelist', name: 'Duelist', icon: 'sports-kabaddi', goal: 'Beat 10 different friends', progress: Math.min(10, beatenFriends), target: 10 },
  ].map((b) => ({ ...b, progress: Math.min(b.progress, b.target), earned: b.progress >= b.target }));
  const nt = nextTier(u.elo);
  return {
    elo: u.placements >= PLACEMENT_MATCHES ? u.elo : null,
    tier: tierFor(u.elo, u.placements),
    placements: Math.min(u.placements, PLACEMENT_MATCHES),
    placementsNeeded: PLACEMENT_MATCHES,
    nextTier: u.placements >= PLACEMENT_MATCHES && nt ? { name: nt.name, pointsAway: nt.at - u.elo } : null,
    streak: current,
    bestStreak: best,
    gamesPlayed: games.length,
    wins,
    losses,
    draws,
    accuracy,
    badges,
    playedToday: games.some((g) => dayKey(g.finished_at) === dayKey(ctx.now())),
  };
}

export function meView(ctx: Ctx, userId: string) {
  const u = getUser(ctx, userId);
  return {
    ...publicUser(ctx, u),
    email: u.email,
    emailVerified: !!u.email_verified,
    usernameLocked: !!u.username_locked,
    hasPassword: !!u.password_hash,
    linked: { google: !!u.google_sub, apple: !!u.apple_sub },
    prefs: { ...DEFAULT_PREFS, ...prefsOf(u) },
    createdAt: u.created_at,
  };
}

function recentGames(ctx: Ctx, userId: string, limit = 10) {
  return all(ctx.db, 'SELECT * FROM games WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT ?', userId, limit).map((g) => {
    let opponent = null,
      outcome = null,
      eloDelta = null;
    if (g.match_id) {
      const m = one(ctx.db, 'SELECT result FROM matches WHERE id = ?', g.match_id);
      const opp = one(ctx.db, 'SELECT user_id FROM match_players WHERE match_id = ? AND user_id != ?', g.match_id, userId);
      if (opp) opponent = publicUser(ctx, getUser(ctx, opp.user_id));
      if (m?.result) {
        const r = JSON.parse(m.result).players[userId];
        outcome = r?.outcome ?? null;
        eloDelta = r?.eloDelta ?? null;
      }
    }
    return { gameId: g.id, matchId: g.match_id, mode: g.mode, score: g.score, finishedAt: g.finished_at, opponent, outcome, eloDelta };
  });
}

export default async function profileRoutes(app: FastifyInstance, ctx: Ctx) {
  const auth = requireAuth(ctx);

  // Avatars are public images; no auth so <Image> can load them.
  app.get('/avatars/:id', async (req, rep) => {
    const u = one(ctx.db, 'SELECT avatar, avatar_type FROM users WHERE id = ?', (req.params as { id: string }).id);
    if (!u?.avatar) throw notFound('No photo');
    rep.header('cache-control', 'public, max-age=31536000, immutable').type(u.avatar_type);
    return Buffer.from(u.avatar as Uint8Array);
  });

  app.register(async (r) => {
    r.addHook('preHandler', auth);

    r.get('/me', async (req) => ({ ...meView(ctx, req.userId), stats: statsFor(ctx, req.userId) }));

    r.patch('/me/prefs', async (req) => {
      const body = z
        .object({
          timer: z.boolean(),
          hints: z.boolean(),
          reduceMotion: z.boolean(),
          sound: z.boolean(),
          music: z.number().int().min(0).max(100),
          sfx: z.number().int().min(0).max(100),
          notifyFriends: z.boolean(),
          notifyDaily: z.boolean(),
          notifyRanked: z.boolean(),
          online: z.boolean(),
          theme: z.enum(['system', 'light', 'dark']),
        })
        .partial()
        .parse(req.body);
      const u = getUser(ctx, req.userId);
      run(ctx.db, 'UPDATE users SET prefs = ? WHERE id = ?', JSON.stringify({ ...prefsOf(u), ...body }), u.id);
      return meView(ctx, u.id);
    });

    /** The profile photo is the only part of a profile a player can change. */
    r.put('/me/avatar', { bodyLimit: 2_000_000 }, async (req) => {
      const body = z.union([z.object({ image: z.string() }), z.object({ color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })]).parse(req.body);
      if ('color' in body) {
        run(ctx.db, 'UPDATE users SET avatar = NULL, avatar_type = NULL, avatar_version = 0, avatar_color = ? WHERE id = ?', body.color, req.userId);
      } else {
        const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image);
        if (!m) throw bad('Upload a PNG, JPEG or WebP image.', 'bad_image');
        const bytes = Buffer.from(m[2], 'base64');
        if (bytes.length > 600_000) throw bad('Pick a photo under 600 KB.', 'image_too_big');
        run(ctx.db, 'UPDATE users SET avatar = ?, avatar_type = ?, avatar_version = ?, avatar_color = NULL WHERE id = ?', bytes, m[1], ctx.now(), req.userId);
      }
      return meView(ctx, req.userId);
    });

    r.delete('/me/avatar', async (req) => {
      run(ctx.db, 'UPDATE users SET avatar = NULL, avatar_type = NULL, avatar_version = 0 WHERE id = ?', req.userId);
      return meView(ctx, req.userId);
    });

    r.delete('/me', async (req) => {
      const { confirm } = z.object({ confirm: z.literal('DELETE', { errorMap: () => ({ message: 'Type DELETE to confirm.' }) }) }).parse(req.body);
      void confirm;
      run(ctx.db, 'DELETE FROM users WHERE id = ?', req.userId);
      return { ok: true };
    });

    r.get('/home', async (req) => {
      const fids = friendIds(ctx, req.userId);
      const friends = fids.map((id) => publicUser(ctx, getUser(ctx, id)));
      const today = Date.parse(dayKey(ctx.now()) + 'T00:00:00Z');
      const daily = one(ctx.db, "SELECT id, score, finished_at, (SELECT COUNT(*) FROM answers WHERE game_id = games.id) AS n FROM games WHERE user_id = ? AND mode = 'daily' AND started_at >= ? ORDER BY score DESC LIMIT 1", req.userId, today);
      return {
        me: meView(ctx, req.userId),
        stats: statsFor(ctx, req.userId),
        daily: { title: 'Spot 10 scam texts in under 3 minutes', bestScore: daily?.score ?? null, done: !!daily?.finished_at, answered: daily?.n ?? 0, resetsAt: today + 86400_000 },
        recent: recentGames(ctx, req.userId, 4),
        friendsOnline: friends.filter((f) => f.online).slice(0, 5),
        friendCount: friends.length,
        unread: (one(ctx.db, 'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0', req.userId)!.n as number) ?? 0,
        season: { name: 'Season 3', endsAt: Date.UTC(2026, 11, 31) },
      };
    });

    r.get('/me/history', async (req) => recentGames(ctx, req.userId, 30));

    r.get('/me/elo-history', async (req) => {
      const u = getUser(ctx, req.userId);
      const rows = all(
        ctx.db,
        "SELECT m.id, m.created_at, mp.elo_before, mp.elo_after, m.result FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.user_id = ? AND m.mode = 'ranked' AND m.status = 'done' ORDER BY m.created_at",
        req.userId,
      );
      return {
        placements: Math.min(u.placements, PLACEMENT_MATCHES),
        placementsNeeded: PLACEMENT_MATCHES,
        current: u.placements >= PLACEMENT_MATCHES ? u.elo : null,
        points: rows.map((r) => {
          const res = JSON.parse(r.result).players;
          const oppId = Object.keys(res).find((k) => k !== req.userId);
          const opp = oppId ? one(ctx.db, 'SELECT username FROM users WHERE id = ?', oppId) : undefined;
          return { matchId: r.id, at: r.created_at, elo: r.elo_after ?? r.elo_before, delta: res[req.userId]?.eloDelta ?? 0, outcome: res[req.userId]?.outcome, opponent: opp?.username ?? 'Unknown' };
        }),
      };
    });

    r.get('/users/:id', async (req) => {
      const id = (req.params as { id: string }).id;
      const s = statsFor(ctx, id);
      return { user: publicUser(ctx, getUser(ctx, id)), stats: { tier: s.tier, elo: s.elo, wins: s.wins, losses: s.losses, gamesPlayed: s.gamesPlayed, badges: s.badges.filter((b) => b.earned) } };
    });

    r.get('/notifications', async (req) => {
      const rows = all(ctx.db, 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', req.userId);
      return rows.map((n) => ({ id: n.id, kind: n.kind, text: n.text, data: JSON.parse(n.data), read: !!n.read, createdAt: n.created_at }));
    });
    r.post('/notifications/read-all', async (req) => {
      run(ctx.db, 'UPDATE notifications SET read = 1 WHERE user_id = ?', req.userId);
      return { ok: true };
    });
    r.post('/notifications/:id/read', async (req) => {
      run(ctx.db, 'UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?', req.userId, Number((req.params as { id: string }).id));
      return { ok: true };
    });
    r.delete('/notifications', async (req) => {
      run(ctx.db, 'DELETE FROM notifications WHERE user_id = ?', req.userId);
      return { ok: true };
    });
  });
  void ITEM_BY_ID;
}
