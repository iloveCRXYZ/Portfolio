import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { type Ctx, bad, conflict, HttpError, requireAuth, getUser } from '../ctx.ts';
import { one, run, tx } from '../db.ts';
import { checkPassword, hashPassword, newId, newSecret, verifyApple, verifyGoogle, type OAuthIdentity } from '../auth.ts';
import { meView } from './profile.ts';

const USERNAME = z
  .string()
  .trim()
  .min(3, 'Use at least 3 characters.')
  .max(20, 'Use 20 characters or fewer.')
  .regex(/^[A-Za-z0-9_.]+$/, 'Use letters, numbers, dots and underscores only.');
const RESERVED = new Set(['admin', 'scamscout', 'support', 'moderator', 'scoutbot']);

function freeUsername(ctx: Ctx, base: string): string {
  const clean = base.replace(/[^A-Za-z0-9_.]/g, '').slice(0, 14) || 'scout';
  for (let i = 0; i < 50; i++) {
    const name = i ? `${clean}${Math.floor(1000 + Math.random() * 9000)}` : clean;
    if (name.length >= 3 && !RESERVED.has(name.toLowerCase()) && !one(ctx.db, 'SELECT 1 FROM users WHERE username = ?', name)) return name;
  }
  return `scout${Date.now().toString(36)}`;
}

function issueLink(ctx: Ctx, userId: string, kind: 'verify' | 'reset', hours: number) {
  const token = newSecret();
  run(ctx.db, 'INSERT INTO tokens (token, user_id, kind, expires_at) VALUES (?,?,?,?)', token, userId, kind, ctx.now() + hours * 3600_000);
  const link = `scamscout://${kind === 'verify' ? 'verify-email' : 'reset-password'}?token=${token}`;
  if (ctx.cfg.devEmailLinks) console.log(`[email] ${kind} link for ${userId}: ${link}`);
  // Hook a real email provider in here for production.
  return ctx.cfg.devEmailLinks ? { devToken: token } : {};
}

function takeToken(ctx: Ctx, token: string, kind: string): string {
  const row = one(ctx.db, 'SELECT * FROM tokens WHERE token = ? AND kind = ?', token, kind);
  if (!row || row.expires_at < ctx.now()) throw bad('This link has expired. Request a new one.', 'link_expired');
  run(ctx.db, 'DELETE FROM tokens WHERE token = ?', token);
  return row.user_id;
}

export default async function authRoutes(app: FastifyInstance, ctx: Ctx) {
  const auth = requireAuth(ctx);
  // Small in-memory limiter for login-type endpoints (one per server instance).
  const hits = new Map<string, number[]>();
  const limit = (key: string, max = 10, windowMs = 60_000) => {
    const t = ctx.now();
    const arr = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    arr.push(t);
    hits.set(key, arr);
    if (arr.length > max) throw new HttpError(429, 'rate_limited', 'Too many attempts. Wait a minute and try again.');
  };
  const session = async (userId: string, isNew: boolean, extra: Record<string, unknown> = {}) => ({
    token: await ctx.tokens.sign(userId),
    isNew,
    user: meView(ctx, userId),
    ...extra,
  });

  app.post('/auth/signup', async (req) => {
    limit(`signup:${req.ip}`);
    const body = z.object({ email: z.string().trim().email('Enter a valid email address.'), password: z.string().min(8, 'Use at least 8 characters.') }).parse(req.body);
    if (one(ctx.db, 'SELECT 1 FROM users WHERE email = ?', body.email)) throw conflict('An account with that email already exists. Log in instead.', 'email_taken');
    const id = newId('u_');
    const username = freeUsername(ctx, body.email.split('@')[0]);
    run(ctx.db, 'INSERT INTO users (id, email, username, password_hash, created_at, last_seen) VALUES (?,?,?,?,?,?)', id, body.email, username, await hashPassword(body.password), ctx.now(), ctx.now());
    return session(id, true, issueLink(ctx, id, 'verify', 48));
  });

  app.post('/auth/login', async (req) => {
    const body = z.object({ email: z.string().trim(), password: z.string() }).parse(req.body);
    limit(`login:${req.ip}:${body.email.toLowerCase()}`, 8);
    const u = one(ctx.db, 'SELECT id, password_hash FROM users WHERE email = ?', body.email);
    if (!u || !(await checkPassword(body.password, u.password_hash)))
      throw new HttpError(401, 'bad_credentials', "That email and password don't match. Try again or reset your password.");
    return session(u.id, false);
  });

  const oauth = async (provider: 'google' | 'apple', id: OAuthIdentity) => {
    const col = provider === 'google' ? 'google_sub' : 'apple_sub';
    const existing = one(ctx.db, `SELECT id FROM users WHERE ${col} = ?`, id.sub);
    if (existing) return session(existing.id, false);
    return tx(ctx.db, () => {
      const byEmail = id.email && id.emailVerified ? one(ctx.db, 'SELECT id FROM users WHERE email = ?', id.email) : undefined;
      if (byEmail) {
        run(ctx.db, `UPDATE users SET ${col} = ?, email_verified = 1 WHERE id = ?`, id.sub, byEmail.id);
        return { id: byEmail.id, isNew: false };
      }
      const uid = newId('u_');
      run(
        ctx.db,
        `INSERT INTO users (id, email, username, ${col}, email_verified, created_at, last_seen) VALUES (?,?,?,?,?,?,?)`,
        uid,
        id.email ?? null,
        freeUsername(ctx, (id.email ?? 'scout').split('@')[0]),
        id.sub,
        id.emailVerified ? 1 : 0,
        ctx.now(),
        ctx.now(),
      );
      return { id: uid, isNew: true };
    });
  };

  app.post('/auth/google', async (req) => {
    limit(`oauth:${req.ip}`, 20);
    const { idToken } = z.object({ idToken: z.string().min(10) }).parse(req.body);
    if (!ctx.cfg.googleClientIds.length) throw new HttpError(501, 'not_configured', 'Google sign-in is not set up on this server yet.');
    let ident: OAuthIdentity;
    try {
      ident = await verifyGoogle(idToken, ctx.cfg.googleClientIds);
    } catch {
      throw new HttpError(401, 'bad_token', "Google sign-in didn't go through. Try again.");
    }
    const r = await oauth('google', ident);
    return 'token' in r ? r : session(r.id, r.isNew);
  });

  app.post('/auth/apple', async (req) => {
    limit(`oauth:${req.ip}`, 20);
    const { idToken } = z.object({ idToken: z.string().min(10) }).parse(req.body);
    if (!ctx.cfg.appleBundleId) throw new HttpError(501, 'not_configured', 'Sign in with Apple is not set up on this server yet.');
    let ident: OAuthIdentity;
    try {
      ident = await verifyApple(idToken, ctx.cfg.appleBundleId);
    } catch {
      throw new HttpError(401, 'bad_token', "Apple sign-in didn't go through. Try again.");
    }
    const r = await oauth('apple', ident);
    return 'token' in r ? r : session(r.id, r.isNew);
  });

  app.post('/auth/verify-email', async (req) => {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    const uid = takeToken(ctx, token, 'verify');
    run(ctx.db, 'UPDATE users SET email_verified = 1 WHERE id = ?', uid);
    return { ok: true };
  });

  app.post('/auth/resend-verification', { preHandler: auth }, async (req) => {
    limit(`resend:${req.userId}`, 3, 60_000);
    const u = getUser(ctx, req.userId);
    if (u.email_verified) return { ok: true, alreadyVerified: true };
    return { ok: true, ...issueLink(ctx, u.id, 'verify', 48) };
  });

  app.post('/auth/forgot-password', async (req) => {
    limit(`forgot:${req.ip}`, 5);
    const { email } = z.object({ email: z.string().trim().email('Enter a valid email address.') }).parse(req.body);
    const u = one(ctx.db, 'SELECT id FROM users WHERE email = ?', email);
    // Same answer whether or not the account exists.
    return { ok: true, ...(u ? issueLink(ctx, u.id, 'reset', 1) : {}) };
  });

  app.post('/auth/reset-password', async (req) => {
    const body = z.object({ token: z.string(), password: z.string().min(8, 'Use at least 8 characters.') }).parse(req.body);
    const uid = takeToken(ctx, body.token, 'reset');
    run(ctx.db, 'UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(body.password), uid);
    return session(uid, false);
  });

  /** Usernames are picked once, during onboarding. */
  app.post('/auth/username', { preHandler: auth }, async (req) => {
    const u = getUser(ctx, req.userId);
    if (u.username_locked) throw bad('Your username is already set.', 'username_locked');
    const { username } = z.object({ username: USERNAME }).parse(req.body);
    if (RESERVED.has(username.toLowerCase())) throw conflict('That username is taken. Try another.', 'username_taken');
    const clash = one(ctx.db, 'SELECT id FROM users WHERE username = ? AND id != ?', username, u.id);
    if (clash) throw conflict('That username is taken. Try another.', 'username_taken');
    run(ctx.db, 'UPDATE users SET username = ?, username_locked = 1 WHERE id = ?', username, u.id);
    return meView(ctx, u.id);
  });

  app.get('/auth/username-available', async (req) => {
    const q = z.object({ username: z.string() }).parse(req.query);
    const parsed = USERNAME.safeParse(q.username);
    if (!parsed.success) return { available: false, reason: parsed.error.issues[0].message };
    const taken = RESERVED.has(parsed.data.toLowerCase()) || !!one(ctx.db, 'SELECT 1 FROM users WHERE username = ?', parsed.data);
    return { available: !taken, reason: taken ? 'That username is taken. Try another.' : null };
  });
}
