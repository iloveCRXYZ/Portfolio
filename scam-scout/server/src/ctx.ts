import type { FastifyReply, FastifyRequest } from 'fastify';
import { type DB, one, run, all, type Row } from './db.ts';
import { tierFor, PLACEMENT_MATCHES } from './scoring.ts';

export type Config = {
  jwtSecret: string;
  googleClientIds: string[];
  appleBundleId: string;
  matchBots: boolean;
  devEmailLinks: boolean;
  publicUrl: string;
};

export type Ctx = {
  db: DB;
  cfg: Config;
  tokens: { sign: (id: string) => Promise<string>; verify: (t: string) => Promise<string | null> };
  now: () => number;
};

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
export const bad = (msg: string, code = 'bad_request') => new HttpError(400, code, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, 'not_found', msg);
export const forbidden = (msg = 'Not allowed') => new HttpError(403, 'forbidden', msg);
export const conflict = (msg: string, code = 'conflict') => new HttpError(409, code, msg);

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export function requireAuth(ctx: Ctx) {
  return async (req: FastifyRequest, _rep: FastifyReply) => {
    const h = req.headers.authorization ?? '';
    const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
    const uid = tok ? await ctx.tokens.verify(tok) : null;
    if (!uid) throw new HttpError(401, 'unauthorized', 'Log in to continue.');
    const u = one(ctx.db, 'SELECT id FROM users WHERE id = ?', uid);
    if (!u) throw new HttpError(401, 'unauthorized', 'This account no longer exists.');
    run(ctx.db, 'UPDATE users SET last_seen = ? WHERE id = ?', ctx.now(), uid);
    req.userId = uid;
  };
}

export const ONLINE_MS = 2 * 60 * 1000;

export function prefsOf(u: Row): Record<string, any> {
  try {
    return JSON.parse(u.prefs || '{}');
  } catch {
    return {};
  }
}

/** A user as other people see them. */
export function publicUser(ctx: Ctx, u: Row) {
  const showOnline = prefsOf(u).online !== false;
  return {
    id: u.id,
    username: u.username,
    avatarUrl: u.avatar_version ? `${ctx.cfg.publicUrl}/avatars/${u.id}?v=${u.avatar_version}` : null,
    avatarColor: u.avatar_color ?? null,
    elo: u.placements >= PLACEMENT_MATCHES ? u.elo : null,
    tier: tierFor(u.elo, u.placements),
    online: !!u.is_bot || (showOnline && ctx.now() - u.last_seen < ONLINE_MS),
    isBot: !!u.is_bot,
  };
}

export function getUser(ctx: Ctx, id: string): Row {
  const u = one(ctx.db, 'SELECT * FROM users WHERE id = ?', id);
  if (!u) throw notFound('Player not found');
  return u;
}

export function notify(ctx: Ctx, userId: string, kind: string, text: string, data: Record<string, unknown> = {}) {
  run(ctx.db, 'INSERT INTO notifications (user_id, kind, text, data, created_at) VALUES (?,?,?,?,?)', userId, kind, text, JSON.stringify(data), ctx.now());
}

export const pairKey = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export function friendIds(ctx: Ctx, userId: string): string[] {
  return all(ctx.db, "SELECT user_a, user_b FROM friendships WHERE status='accepted' AND (user_a = ? OR user_b = ?)", userId, userId).map((r) =>
    r.user_a === userId ? r.user_b : r.user_a,
  );
}
