import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function checkPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [algo, s, k] = stored.split('$');
  if (algo !== 'scrypt' || !s || !k) return false;
  const want = Buffer.from(k, 'base64');
  const got = await scrypt(pw, Buffer.from(s, 'base64'), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

export function makeTokens(secret: string) {
  const key = new TextEncoder().encode(secret);
  return {
    sign: (userId: string) =>
      new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('30d').sign(key),
    verify: async (token: string): Promise<string | null> => {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        return typeof payload.sub === 'string' ? payload.sub : null;
      } catch {
        return null;
      }
    },
  };
}

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export type OAuthIdentity = { sub: string; email?: string; emailVerified: boolean };

export async function verifyGoogle(idToken: string, clientIds: string[]): Promise<OAuthIdentity> {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientIds,
  });
  return { sub: String(payload.sub), email: payload.email as string | undefined, emailVerified: payload.email_verified === true };
}

export async function verifyApple(idToken: string, bundleId: string): Promise<OAuthIdentity> {
  const { payload } = await jwtVerify(idToken, appleJwks, { issuer: 'https://appleid.apple.com', audience: bundleId });
  const ev = payload.email_verified;
  return { sub: String(payload.sub), email: payload.email as string | undefined, emailVerified: ev === true || ev === 'true' };
}

export const newId = (prefix = '') => prefix + randomBytes(9).toString('base64url');
export const newSecret = () => randomBytes(24).toString('base64url');
