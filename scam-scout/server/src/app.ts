import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { openDb } from './db.ts';
import { makeTokens } from './auth.ts';
import { type Config, type Ctx, HttpError } from './ctx.ts';
import authRoutes from './routes/auth.ts';
import playRoutes from './routes/play.ts';
import profileRoutes from './routes/profile.ts';
import socialRoutes from './routes/social.ts';

export function configFromEnv(env = process.env): Config & { dbPath: string } {
  const jwtSecret = env.JWT_SECRET ?? '';
  if (env.NODE_ENV === 'production' && (!jwtSecret || jwtSecret === 'change-me')) throw new Error('Set JWT_SECRET to a long random value.');
  return {
    jwtSecret: jwtSecret || 'dev-only-secret-do-not-use-in-production',
    googleClientIds: (env.GOOGLE_CLIENT_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    appleBundleId: env.APPLE_BUNDLE_ID ?? '',
    matchBots: env.MATCH_BOTS === '1',
    devEmailLinks: env.DEV_EMAIL_LINKS === '1',
    publicUrl: (env.PUBLIC_URL ?? `http://localhost:${env.PORT ?? 4000}`).replace(/\/$/, ''),
    dbPath: env.DATABASE_PATH ?? './data/scam-scout.db',
  };
}

export async function buildApp(opts: { config?: Partial<Config> & { dbPath?: string }; now?: () => number; logger?: boolean } = {}) {
  const base = configFromEnv();
  const cfg = { ...base, ...opts.config };
  const ctx: Ctx = { db: openDb(cfg.dbPath), cfg, tokens: makeTokens(cfg.jwtSecret), now: opts.now ?? Date.now };

  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 2_000_000, trustProxy: true });
  await app.register(cors, { origin: true });

  app.setErrorHandler((err, _req, rep) => {
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      return rep.status(400).send({ error: 'invalid_input', field: issue?.path.join('.') || null, message: issue?.message ?? 'Check your input.' });
    }
    if (err instanceof HttpError) return rep.status(err.status).send({ error: err.code, message: err.message });
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode && e.statusCode < 500) return rep.status(e.statusCode).send({ error: 'bad_request', message: e.message });
    app.log.error(err);
    return rep.status(500).send({ error: 'server_error', message: 'Something went wrong on our side. Try again in a moment.' });
  });

  app.get('/health', async () => ({ ok: true, time: ctx.now() }));
  await app.register(async (r) => authRoutes(r, ctx));
  await app.register(async (r) => profileRoutes(r, ctx));
  await app.register(async (r) => socialRoutes(r, ctx));
  await app.register(async (r) => playRoutes(r, ctx));

  app.addHook('onClose', async () => ctx.db.close());
  return { app, ctx };
}
