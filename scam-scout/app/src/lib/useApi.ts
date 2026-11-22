import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from './api';

/** Load JSON from the API with loading, error and refresh states. Reloads when the screen regains focus. */
export function useApi<T>(path: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (!path) return;
      if (mode === 'refresh') setRefreshing(true);
      try {
        const d = await api<T>(path);
        if (!alive.current) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e : new ApiError(0, 'error', 'Something went wrong. Try again.'));
      } finally {
        if (alive.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path],
  );

  useEffect(() => {
    alive.current = true;
    setLoading(!!path);
    void load();
    return () => {
      alive.current = false;
    };
  }, [load, path]);

  useFocusEffect(
    useCallback(() => {
      void load('silent');
    }, [load]),
  );

  useEffect(() => {
    if (!opts.pollMs || !path) return;
    const t = setInterval(() => void load('silent'), opts.pollMs);
    return () => clearInterval(t);
  }, [opts.pollMs, path, load]);

  return { data, setData, error, loading, refreshing, reload: () => load('refresh'), reloadSilently: () => load('silent') };
}
