import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, T, Gap, Button, Avatar, Icon, IconButton, RowV, Skeleton, ErrorState, EmptyState, useToast } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';
import type { Challenge, PublicUser } from '@/lib/types';

export default function ChallengeScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const c = useColors();
  const toast = useToast();
  const { me } = useAuth();
  const { data, error, loading, reload } = useApi<{ user: PublicUser }>(`/users/${userId}`);
  const [type, setType] = useState<'ranked' | 'casual'>('ranked');
  const [sent, setSent] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);

  // Wait for them to accept.
  useEffect(() => {
    if (!sent || sent.status !== 'pending') return;
    const t = setInterval(async () => {
      try {
        const ch = await api<Challenge>(`/challenges/${sent.id}`);
        setSent(ch);
        if (ch.status === 'accepted' && ch.matchId) router.replace({ pathname: '/matchmaking', params: { matchId: ch.matchId } });
      } catch {}
    }, 2500);
    return () => clearInterval(t);
  }, [sent]);

  const send = async () => {
    setBusy(true);
    try {
      setSent(await api<Challenge>('/challenges', { body: { userId, type } }));
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (sent) await api(`/challenges/${sent.id}/cancel`, { method: 'POST' }).catch(() => null);
    router.back();
  };

  if (loading) return <Screen><Skeleton rows={2} /></Screen>;
  if (error || !data) return <Screen><ErrorState error={error} onRetry={reload} /></Screen>;
  const u = data.user;

  if (sent)
    return (
      <Screen edges={['top', 'bottom']}>
        <Gap h={60} />
        {sent.status === 'declined' || sent.status === 'cancelled' ? (
          <EmptyState icon="do-not-disturb-on" title={`${u.username} declined`} body="Try again later, or challenge someone else." actions={<Button title="Close" onPress={() => router.back()} />} />
        ) : (
          <EmptyState
            icon="hourglass-top"
            title={`Waiting for ${u.username}`}
            body={`We sent them your ${type} challenge. The match starts as soon as they accept.${u.online ? '' : ' They are offline right now.'}`}
            actions={<Button title="Cancel challenge" kind="outline" onPress={cancel} />}
          />
        )}
      </Screen>
    );

  return (
    <Screen edges={['top', 'bottom']}>
      <RowV style={{ justifyContent: 'space-between' }}>
        <T v="h1">Challenge {u.username}</T>
        <IconButton name="close" label="Close" onPress={() => router.back()} />
      </RowV>
      <Gap h={16} />
      <RowV style={{ justifyContent: 'center', gap: 20, backgroundColor: c.surface, borderRadius: 16, padding: 18 }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Avatar user={me} size={56} />
          <T style={{ fontWeight: '600' }}>You</T>
        </View>
        <T c="text3">vs</T>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Avatar user={u} size={56} online={u.online} />
          <T style={{ fontWeight: '600' }}>{u.username}</T>
        </View>
      </RowV>
      <T v="small" c="text2" style={{ fontWeight: '500', marginTop: 20, marginBottom: 8 }}>
        Play for
      </T>
      {(
        [
          ['ranked', 'Ranked', 'Winner gains ELO, loser drops ELO. 15 mixed rounds, 20:00 clock.', 'military-tech'],
          ['casual', 'Casual', 'Just for fun. No ELO change. 10 mixed rounds.', 'sports-esports'],
        ] as const
      ).map(([k, t, d, icon]) => {
        const on = type === k;
        return (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setType(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, borderWidth: on ? 1.5 : 1, borderColor: on ? c.ink : c.line, marginBottom: 8 }}>
            <Icon name={icon} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '600' }}>{t}</T>
              <T v="small" c="text2">
                {d}
              </T>
            </View>
            <Icon name={on ? 'radio-button-checked' : 'radio-button-unchecked'} color={on ? c.text : c.text3} />
          </Pressable>
        );
      })}
      <Gap h={12} />
      <Button title="Send challenge" icon="send" size="lg" full loading={busy} onPress={send} />
    </Screen>
  );
}
