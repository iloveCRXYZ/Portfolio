import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { type Ctx, bad, conflict, forbidden, getUser, notFound, notify, pairKey, publicUser, requireAuth } from '../ctx.ts';
import { all, one, run, tx } from '../db.ts';
import { newId } from '../auth.ts';
import { REASONS } from '../content.ts';
import {
  SOLO_MODES,
  answerRound,
  createGame,
  createMatch,
  finishGame,
  gameResults,
  gameView,
  getGame,
  leaveQueue,
  matchView,
  matchmake,
  requestRematch,
} from '../game.ts';

export default async function playRoutes(app: FastifyInstance, ctx: Ctx) {
  const auth = requireAuth(ctx);
  app.addHook('preHandler', auth);

  app.get('/content/reasons', async () => REASONS);

  app.post('/games', async (req) => {
    const { mode } = z.object({ mode: z.enum(SOLO_MODES) }).parse(req.body);
    return gameView(ctx, createGame(ctx, req.userId, mode));
  });

  app.get('/games/:id', async (req) => {
    const { id } = req.params as { id: string };
    return gameView(ctx, getGame(ctx, id, req.userId));
  });

  app.post('/games/:id/answers', async (req) => {
    const { id } = req.params as { id: string };
    const body = z.object({ index: z.number().int().min(0), call: z.enum(['scam', 'legit']), reason: z.string().min(1).max(60) }).parse(req.body);
    return answerRound(ctx, req.userId, id, body);
  });

  app.post('/games/:id/finish', async (req) => {
    const { id } = req.params as { id: string };
    return finishGame(ctx, req.userId, id);
  });

  /** Leaving early. In a duel this counts as a loss. */
  app.post('/games/:id/forfeit', async (req) => {
    const { id } = req.params as { id: string };
    return finishGame(ctx, req.userId, id, true);
  });

  app.get('/games/:id/results', async (req) => {
    const { id } = req.params as { id: string };
    return gameResults(ctx, req.userId, id);
  });

  /* ranked matchmaking */
  app.post('/matchmaking', async (req) => matchmake(ctx, req.userId, true));
  app.get('/matchmaking', async (req) => matchmake(ctx, req.userId, false));
  app.delete('/matchmaking', async (req) => {
    leaveQueue(ctx, req.userId);
    return { ok: true };
  });

  app.get('/matches/:id', async (req) => matchView(ctx, (req.params as { id: string }).id, req.userId));
  app.post('/matches/:id/rematch', async (req) => requestRematch(ctx, (req.params as { id: string }).id, req.userId));

  /* friend challenges (ranked or casual duels) */
  app.post('/challenges', async (req) => {
    const body = z.object({ userId: z.string(), type: z.enum(['ranked', 'casual']) }).parse(req.body);
    if (body.userId === req.userId) throw bad("You can't challenge yourself.");
    const [a, b] = pairKey(req.userId, body.userId);
    const f = one(ctx.db, "SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ? AND status = 'accepted'", a, b);
    if (!f) throw forbidden('You can only challenge friends.');
    const dup = one(ctx.db, "SELECT id FROM challenges WHERE from_id = ? AND to_id = ? AND status = 'pending'", req.userId, body.userId);
    if (dup) throw conflict('You already sent this player a challenge.', 'already_challenged');
    const id = newId('c_');
    run(ctx.db, 'INSERT INTO challenges (id, from_id, to_id, type, created_at) VALUES (?,?,?,?,?)', id, req.userId, body.userId, body.type, ctx.now());
    const me = getUser(ctx, req.userId);
    notify(ctx, body.userId, 'challenge', `${me.username} challenged you to a ${body.type} duel.`, { challengeId: id });
    return challengeView(ctx, id, req.userId);
  });

  app.get('/challenges', async (req) => {
    const rows = all(ctx.db, "SELECT id FROM challenges WHERE (from_id = ? OR to_id = ?) AND status = 'pending' AND created_at > ? ORDER BY created_at DESC", req.userId, req.userId, ctx.now() - 86400_000);
    return rows.map((r) => challengeView(ctx, r.id, req.userId));
  });

  app.get('/challenges/:id', async (req) => challengeView(ctx, (req.params as { id: string }).id, req.userId));

  app.post('/challenges/:id/:action', async (req) => {
    const { id, action } = req.params as { id: string; action: string };
    return tx(ctx.db, () => {
      const c = one(ctx.db, 'SELECT * FROM challenges WHERE id = ?', id);
      if (!c) throw notFound('Challenge not found');
      if (c.status !== 'pending') throw bad('This challenge is no longer open.');
      if (action === 'accept' || action === 'decline') {
        if (c.to_id !== req.userId) throw forbidden();
        if (action === 'decline') {
          run(ctx.db, "UPDATE challenges SET status = 'declined' WHERE id = ?", id);
          notify(ctx, c.from_id, 'challenge_declined', `${getUser(ctx, c.to_id).username} declined your challenge.`);
        } else {
          const matchId = createMatch(ctx, c.type, [c.from_id, c.to_id]);
          run(ctx.db, "UPDATE challenges SET status = 'accepted', match_id = ? WHERE id = ?", matchId, id);
        }
      } else if (action === 'cancel') {
        if (c.from_id !== req.userId) throw forbidden();
        run(ctx.db, "UPDATE challenges SET status = 'cancelled' WHERE id = ?", id);
      } else throw notFound();
      return challengeView(ctx, id, req.userId);
    });
  });
}

function challengeView(ctx: Ctx, id: string, viewer: string) {
  const c = one(ctx.db, 'SELECT * FROM challenges WHERE id = ?', id);
  if (!c || (c.from_id !== viewer && c.to_id !== viewer)) throw notFound('Challenge not found');
  return {
    id: c.id,
    type: c.type,
    status: c.status,
    matchId: c.match_id,
    incoming: c.to_id === viewer,
    from: publicUser(ctx, getUser(ctx, c.from_id)),
    to: publicUser(ctx, getUser(ctx, c.to_id)),
    createdAt: c.created_at,
  };
}
