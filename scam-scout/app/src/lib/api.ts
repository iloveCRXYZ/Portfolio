import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Where the backend lives. Set EXPO_PUBLIC_API_URL in app/.env, for example
 * EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 when testing on a real phone.
 * The Android emulator reaches your computer at 10.0.2.2.
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000')
).replace(/\/$/, '');

const TOKEN_KEY = 'scamscout.token';
let memToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') return (memToken = globalThis.localStorage?.getItem(TOKEN_KEY) ?? null);
  return (memToken = await SecureStore.getItemAsync(TOKEN_KEY));
}
export async function saveToken(token: string | null) {
  memToken = token;
  if (Platform.OS === 'web') {
    if (token) globalThis.localStorage?.setItem(TOKEN_KEY, token);
    else globalThis.localStorage?.removeItem(TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string | null) {
    super(message);
  }
  get offline() {
    return this.status === 0;
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.auth !== false && memToken) headers.authorization = `Bearer ${memToken}`;
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'), headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError(0, 'offline', "Can't reach Scam Scout. Check your connection and try again.");
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && opts.auth !== false && memToken) onUnauthorized?.();
    throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'Something went wrong. Try again.', data?.field);
  }
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
