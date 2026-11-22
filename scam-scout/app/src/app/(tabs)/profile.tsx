import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, T, Gap, Button, Avatar, Icon, IconButton, RowV, StatStrip, Section, ListRow, EmptyState, ErrorState, Skeleton, Sheet, useToast, fmt, MODE_NAME } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/api';
import { AVATAR_COLORS, pickAndUploadAvatar, removeAvatar, setAvatarColor } from '@/lib/avatar';
import { useColors } from '@/lib/theme';
import type { Badge, Me, RecentGame } from '@/lib/types';

const TINTS = ['accent', 'legit', 'scam', 'streak'] as const;

export default function ProfileScreen() {
  const c = useColors();
  const toast = useToast();
  const { setMe } = useAuth();
  const { data: me, error, loading, refreshing, reload, setData } = useApi<Me>('/me');
  const history = useApi<RecentGame[]>('/me/history');
  const [photoOpen, setPhotoOpen] = useState(false);
  const [badge, setBadge] = useState<Badge | null>(null);

  if (loading) return <Screen><Skeleton /></Screen>;
  if (error || !me || !me.stats) return <Screen><ErrorState error={error} onRetry={reload} /></Screen>;
  const s = me.stats;
  const update = (m: Me) => {
    setMe(m);
    setData({ ...m, stats: me.stats });
  };
  const run = async (fn: () => Promise<Me | null>, ok: string) => {
    try {
      const m = await fn();
      if (m) {
        update(m);
        toast(ok, 'check-circle');
      }
    } catch (e) {
      toast(e instanceof Error && !('status' in e) ? e.message : errMsg(e), 'error-outline');
    }
  };
  const winRate = s.wins + s.losses ? Math.round((s.wins / (s.wins + s.losses)) * 100) : null;

  return (
    <Screen refreshing={refreshing} onRefresh={() => (reload(), history.reload())}>
      <RowV style={{ justifyContent: 'flex-end' }}>
        <IconButton name="show-chart" label="ELO history" onPress={() => router.push('/elo')} />
        <IconButton name="settings" label="Settings" onPress={() => router.push('/settings')} />
      </RowV>
      <View style={{ alignItems: 'center' }}>
        <Pressable onPress={() => setPhotoOpen(true)} accessibilityLabel="Change profile photo">
          <Avatar user={me} size={96} />
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
            <Icon name="photo-camera" size={16} color={c.onInk} />
          </View>
        </Pressable>
        <T v="h1" style={{ marginTop: 12 }}>
          {me.username}
        </T>
        <T c="text2">
          {s.tier}
          {s.elo ? ` · ${fmt(s.elo)} ELO` : ''} · Joined {new Date(me.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </T>
        <Button title="Change photo" kind="ghost" size="sm" onPress={() => setPhotoOpen(true)} />
      </View>

      <StatStrip
        items={[
          { label: 'Streak', value: `${s.streak} days`, icon: s.streak ? 'local-fire-department' : undefined, iconColor: c.streak, sub: `Best ${s.bestStreak}` },
          { label: 'Win rate', value: winRate != null ? `${winRate}%` : '—', muted: winRate == null, sub: `${s.wins}W · ${s.losses}L` },
          { label: 'Accuracy', value: s.accuracy != null ? `${s.accuracy}%` : '—', muted: s.accuracy == null, sub: `${s.gamesPlayed} games` },
        ]}
      />

      <Section title="Badges" action={`${s.badges.filter((b) => b.earned).length} of ${s.badges.length}`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {s.badges.map((b, i) => {
          const tint = TINTS[i % 4];
          return (
            <Pressable key={b.id} onPress={() => setBadge(b)} accessibilityLabel={`${b.name}, ${b.earned ? 'earned' : 'locked'}`} style={{ width: '23%', alignItems: 'center', paddingVertical: 10, opacity: b.earned ? 1 : 0.5 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: b.earned ? (c as any)[`${tint}Soft`] : c.surface }}>
                <Icon name={(b.earned ? b.icon : 'lock') as any} size={24} color={b.earned ? (c as any)[tint] : c.text3} />
              </View>
              <T v="small" center numberOfLines={2} style={{ marginTop: 6, fontSize: 11 }}>
                {b.name}
              </T>
            </Pressable>
          );
        })}
      </View>
      {s.gamesPlayed === 0 ? (
        <T c="text2" style={{ marginTop: 8 }}>
          Finish any game to start earning badges.
        </T>
      ) : null}

      <Section title="This week" />
      <RowV gap={6}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
          const today = (new Date().getDay() + 6) % 7;
          const done = s.streak > 0 && i <= today && i > today - s.streak - (s.playedToday ? 0 : 1) && (i < today || s.playedToday);
          return (
            <View key={i} style={{ flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? c.ink : 'transparent', borderWidth: done ? 0 : i === today ? 1.5 : 1, borderColor: i === today ? c.ink : c.line }}>
              {done ? <Icon name="check" size={18} color={c.onInk} /> : <T v="mono" c="text3">{d}</T>}
            </View>
          );
        })}
      </RowV>

      <Section title="Recent matches" />
      {history.loading ? (
        <Skeleton header={false} rows={3} />
      ) : history.data?.length ? (
        history.data.slice(0, 10).map((g) => (
          <ListRow key={g.gameId} onPress={() => router.push(`/results/${g.gameId}`)}>
            <T style={{ flex: 1 }} numberOfLines={1}>
              {g.opponent ? `${MODE_NAME[g.mode]} vs ${g.opponent.username}` : MODE_NAME[g.mode]}
            </T>
            <T v="mono" c={g.outcome === 'win' ? 'legit' : g.outcome === 'loss' ? 'scam' : 'text2'}>
              {g.outcome ? `${g.outcome === 'win' ? 'Won' : g.outcome === 'loss' ? 'Lost' : 'Draw'}${g.eloDelta ? ` · ${g.eloDelta > 0 ? '+' : ''}${g.eloDelta}` : ''}` : `${fmt(g.score)} pts`}
            </T>
          </ListRow>
        ))
      ) : (
        <EmptyState icon="history" title="No matches yet" body="Your last games will show up here." />
      )}

      <Sheet visible={photoOpen} onClose={() => setPhotoOpen(false)} title="Profile photo" subtitle="This is the only part of your profile you can change.">
        <RowV gap={16}>
          <Avatar user={me} size={80} />
          <View style={{ gap: 8 }}>
            <Button title="Upload photo" icon="upload" size="sm" onPress={() => run(pickAndUploadAvatar, 'Photo updated')} />
            {me.avatarUrl ? <Button title="Remove photo" icon="delete-outline" kind="danger" size="sm" onPress={() => run(removeAvatar, 'Photo removed')} /> : null}
          </View>
        </RowV>
        <T v="small" c="text2" style={{ marginTop: 18, fontWeight: '500' }}>
          Or use a color
        </T>
        <RowV gap={10} style={{ marginVertical: 12 }}>
          {AVATAR_COLORS.map((col) => (
            <Pressable key={col} accessibilityLabel="Use this color" onPress={() => run(() => setAvatarColor(col), 'Color updated')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: col, borderWidth: 3, borderColor: !me.avatarUrl && me.avatarColor === col ? c.ink : 'transparent' }} />
          ))}
        </RowV>
        <Button title="Done" size="lg" full onPress={() => setPhotoOpen(false)} />
      </Sheet>

      <Sheet visible={!!badge} onClose={() => setBadge(null)} title={badge?.name} subtitle={badge?.goal}>
        {badge ? (
          <>
            <T c="text2">{badge.earned ? 'Earned. Nice work.' : `${badge.progress} of ${badge.target} so far.`}</T>
            <Gap h={16} />
            <Button title={badge.earned ? 'Close' : 'Keep playing'} size="lg" full onPress={() => (setBadge(null), !badge.earned && router.push('/modes'))} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
