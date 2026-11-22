import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, loadToken, saveToken, setUnauthorizedHandler } from './api';
import type { Me } from './types';

type Session = { token: string; isNew: boolean; user: Me; devToken?: string };

type AuthState = {
  ready: boolean;
  me: Me | null;
  /** Store a session returned by any /auth endpoint. */
  setSession: (s: Session) => Promise<void>;
  refresh: () => Promise<Me | null>;
  setMe: (m: Me) => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState>({
  ready: false,
  me: null,
  setSession: async () => {},
  refresh: async () => null,
  setMe: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const signOut = useCallback(async () => {
    await saveToken(null);
    setMe(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const m = await api<Me>('/me');
      setMe(m);
      return m;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    (async () => {
      const t = await loadToken();
      if (t) await refresh();
      setReady(true);
    })();
  }, [refresh, signOut]);

  const setSession = useCallback(async (s: Session) => {
    await saveToken(s.token);
    setMe(s.user);
  }, []);

  const value = useMemo(() => ({ ready, me, setSession, refresh, setMe, signOut }), [ready, me, setSession, refresh, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
