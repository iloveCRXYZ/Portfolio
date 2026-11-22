import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, T, Gap, Button, Segmented, Avatar, Icon, ListRow, EmptyState, ErrorState, Skeleton, fmt } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { useColors } from '@/lib/theme';
import type { LeaderRow } from '@/lib/types';

type Board = { rows: LeaderRow[]; me: LeaderRow; friendCount: number };
const MEDAL = ['#C9A227', '#9EA2A8', '#B8733B'];

export default function LeaderboardScreen() {
  const c = useColors();
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'lifetime'>('daily');
  const { data, error, loading, refreshing, reload } = useApi<Board>(`/leaderboard?scope=${scope}&period=${period}`);

  const body = () => {
    if (loading) return <Skeleton header={false} rows={6} />;
    if (error || !data) return <ErrorState error={error} onRetry={reload} />;
    if (scope === 'friends' && data.friendCount === 0)
      return (
        <EmptyState
          dashed
          icon="leaderboard"
          title="No friends on the board yet"
          body="Add friends to compare scores. Until then, see how you stack up globally."
          actions={
            <>
              <Button title="Add friends" icon="person-add" onPress={() => router.push('/add-friend')} />
              <Button title="See global" kind="outline" onPress={() => setScope('global')} />
            </>
          }
        />
      );
    if (!data.rows.length)
      return <EmptyState icon="emoji-events" title="Nobody has scored yet" body={period === 'daily' ? 'Be the first on today\'s board. Finish any game to post a score.' : 'Finish any game to post a score.'} actions={<Button title="Play now" icon="play-arrow" onPress={() => router.push('/modes')} />} />;
    return data.rows.map((r) => (
      <ListRow key={r.user.id} style={r.isMe ? { backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 8, borderBottomWidth: 0 } : undefined}>
        <View style={{ width: 28, alignItems: 'center' }}>{r.rank && r.rank <= 3 ? <Icon name="workspace-premium" color={MEDAL[r.rank - 1]} size={22} /> : <T v="mono" c="text3">{r.rank}</T>}</View>
        <Avatar user={r.user} size={34} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '600' }} numberOfLines={1}>
            {r.user.username}
            {r.isMe ? ' (you)' : ''}
          </T>
          <T v="small" c="text3">
            {r.tier}
          </T>
        </View>
        <T v="mono" style={{ fontWeight: '600' }}>
          {fmt(r.points)}
        </T>
      </ListRow>
    ));
  };

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <T v="h1">Leaderboard</T>
      <T v="mono" c="text3" style={{ marginTop: 4 }}>
        {period === 'daily' ? 'Resets at midnight UTC' : period === 'monthly' ? 'This month' : 'All time'}
      </T>
      <Gap h={16} />
      <Segmented options={[{ key: 'global', label: 'Global' }, { key: 'friends', label: 'Friends' }]} value={scope} onChange={setScope} />
      <Gap h={10} />
      <Segmented options={[{ key: 'daily', label: 'Daily' }, { key: 'monthly', label: 'Monthly' }, { key: 'lifetime', label: 'Lifetime' }]} value={period} onChange={setPeriod} />
      <Gap h={8} />
      {body()}
      {data && !data.rows.some((r) => r.isMe) && !loading ? (
        <View style={{ marginTop: 16, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 12 }}>
          <ListRow style={{ borderBottomWidth: 0 }}>
            <T v="mono" c="text2" style={{ width: 40 }}>
              {data.me.rank ? `#${data.me.rank}` : '—'}
            </T>
            <Avatar user={data.me.user} size={34} />
            <T style={{ flex: 1, fontWeight: '600' }}>{data.me.user.username} (you)</T>
            <T v="mono">{fmt(data.me.points)}</T>
          </ListRow>
        </View>
      ) : null}
    </Screen>
  );
}
