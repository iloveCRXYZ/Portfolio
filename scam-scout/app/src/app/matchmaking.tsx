import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, T, Gap, Button, Avatar, EmptyState, mmss, fmt } from '@/components/ui';
import { api, ApiError, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';
import type { Match } from '@/lib/types';

type MM = { status: 'searching' | 'matched' | 'idle'; matchId: string | null };

/** Ranked matchmaking. Also used to show "opponent found" for friend duels (pass matchId). */
export default function Matchmaking() {
  const c = useColors();
  const { me } = useAuth();
  const params = useLocalSearchParams<{ matchId?: string }>();
  const [matchId, setMatchId] = useState<string | null>(params.matchId ?? null);
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [count, setCount] = useState(3);
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1800, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [ring]);

  // Search loop
  useEffect(() => {
    if (matchId) return;
    let stop = false;
    const t0 = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    (async () => {
      try {
        let r = await api<MM>('/matchmaking', { method: 'POST' });
        while (!stop && r.status === 'searching') {
          await new Promise((res) => setTimeout(res, 2000));
          if (stop) return;
          r = await api<MM>('/matchmaking');
        }
        if (!stop && r.matchId) setMatchId(r.matchId);
      } catch (e) {
        if (!stop) setError(e instanceof ApiError ? e : new ApiError(0, 'error', errMsg(e)));
      }
    })();
    return () => {
      stop = true;
      clearInterval(tick);
    };
  }, [matchId, error]);

  // Found: load opponent and count down
  useEffect(() => {
    if (!matchId) return;
    api<Match>(`/matches/${matchId}`).then(setMatch).catch((e) => setError(e));
  }, [matchId]);
  useEffect(() => {
    if (!match) return;
    if (count <= 0) {
      const mine = match.players.find((p) => p.isMe);
      if (mine?.gameId) router.replace(`/game/${mine.gameId}`);
      return;
    }
    const t = setTimeout(() => setCount((n) => n - 1), 800);
    return () => clearTimeout(t);
  }, [match, count]);

  const cancel = async () => {
    if (!matchId) await api('/matchmaking', { method: 'DELETE' }).catch(() => null);
    router.replace('/');
  };

  if (error)
    return (
      <Screen>
        <Gap h={80} />
        <EmptyState
          icon={error.offline ? 'wifi-off' : 'error-outline'}
          title={error.offline ? 'Connection lost' : "Couldn't find a match"}
          body={error.message}
          actions={
            <>
              <Button title="Try again" icon="refresh" onPress={() => setError(null)} />
              <Button title="Back to home" kind="outline" onPress={() => router.replace('/')} />
            </>
          }
        />
      </Screen>
    );

  const opp = match?.players.find((p) => !p.isMe);
  const scale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const opacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });

  return (
    <Screen scroll={false} edges={['top', 'bottom']} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
      {opp ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 28 }}>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Avatar user={me} size={64} />
              <T style={{ fontWeight: '600' }}>You</T>
            </View>
            <T c="text3">vs</T>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Avatar user={opp.user} size={64} />
              <T style={{ fontWeight: '600' }}>{opp.user.username}</T>
              <T v="mono" c="text3">
                {opp.user.elo ? fmt(opp.user.elo) : opp.user.tier}
              </T>
            </View>
          </View>
          <T v="h1">Opponent found</T>
          <T c="text2" style={{ marginTop: 6 }}>
            {match?.mode === 'casual' ? 'Casual duel · no ELO' : '15 rounds · 20:00 clock'} · starting in {Math.max(count, 0)}…
          </T>
        </>
      ) : (
        <>
          <View style={{ width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
            <Animated.View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 2, borderColor: c.line, transform: [{ scale }], opacity }} />
            <Avatar user={me} size={64} />
          </View>
          <T v="h1">Finding an opponent</T>
          <T c="text2" style={{ marginTop: 6 }}>
            Players near your level · 15 rounds · 20:00 clock
          </T>
          <T v="mono" c="text3" style={{ marginTop: 6 }}>
            {mmss(elapsed)}
          </T>
          <Gap h={24} />
          <Button title="Cancel" kind="outline" onPress={cancel} />
        </>
      )}
    </Screen>
  );
}
