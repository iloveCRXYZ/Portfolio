import { existsSync, readFileSync } from 'node:fs';
import { buildApp } from './app.ts';

// Minimal .env loader so the server runs without extra packages.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { app } = await buildApp({ logger: true });
const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });
