import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, T, Gap, Button, Card, RowV, Avatar, Icon, IconButton, EmptyState, ErrorState, Skeleton, Section, StatStrip, ProgressBar, ListRow, fmt, MODE_NAME, TYPE_ICON } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { useColors } from '@/lib/theme';
import type { Home } from '@/lib/types';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function HomeScreen() {
  const c = useColors();
  const { data, error, loading, refreshing, reload } = useApi<Home>('/home');

  if (loading) return <Screen><Skeleton /></Screen>;
  if (error || !data) return <Screen><ErrorState error={error} onRetry={reload} /></Screen>;

  const { me, stats: s, daily, recent, friendsOnline, friendCount, unread } = data;
  const fresh = s.gamesPlayed === 0;
  const resetIn = Math.max(0, Math.round((daily.resetsAt - Date.now()) / 3600000));

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <RowV style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <T v="mono" c="text3">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}
          </T>
          <T v="h1" style={{ marginTop: 2 }}>
            {fresh ? `Welcome, ${me.username}.` : `${greeting()}, ${me.username}.`}
          </T>
        </View>
        <IconButton name="notifications-none" label="Notifications" badge={unread} onPress={() => router.push('/notifications')} />
      </RowV>
      <T c="text2" style={{ marginTop: 4 }}>
        {fresh ? 'Start with a practice mode. Ten rounds, no pressure.' : 'Ten rounds. Find the fakes, say why, keep the streak alive.'}
      </T>
      <Gap h={18} />
      <Button title="Start game" icon="play-arrow" size="lg" full onPress={() => router.push('/modes')} />

      <StatStrip
        items={[
          { label: 'Rank', value: s.tier, sub: s.elo ? `${fmt(s.elo)} ELO` : `${s.placements} of ${s.placementsNeeded} placements` },
          { label: 'Streak', value: `${s.streak} days`, icon: s.streak ? 'local-fire-department' : undefined, iconColor: c.streak, sub: s.streak ? `Best ${s.bestStreak}` : 'Play today' },
          { label: 'Accuracy', value: s.accuracy != null ? `${s.accuracy}%` : '—', muted: s.accuracy == null, sub: s.accuracy != null ? 'Last 30 days' : 'No games yet' },
        ]}
      />

      <Card>
        <RowV gap={6}>
          <Icon name="today" size={18} color={c.text2} />
          <T v="small" c="text2" style={{ fontWeight: '500' }}>
            Daily challenge
          </T>
        </RowV>
        <T v="h2" style={{ marginVertical: 8 }}>
          {daily.title}
        </T>
        <ProgressBar value={daily.answered / 10} />
        <RowV style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <T v="mono" c="text3">
            {daily.done ? `Done · best ${daily.bestScore}` : daily.answered ? `${daily.answered} of 10` : 'Not started'} · resets in {resetIn}h
          </T>
          <Button title={daily.done ? 'Play again' : daily.answered ? 'Continue' : 'Start'} size="sm" onPress={() => router.push({ pathname: '/modes', params: { start: 'daily' } })} />
        </RowV>
      </Card>

      <Card style={{ marginTop: 16 }} onPress={() => router.push('/elo')}>
        <RowV gap={14}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: s.elo ? c.accentSoft : c.raised, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="military-tech" size={24} color={s.elo ? c.accent : c.text3} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h3">{s.tier}</T>
            <T v="mono" c="text2">
              {s.elo ? `${fmt(s.elo)} ELO${s.nextTier ? ` · ${s.nextTier.pointsAway} to ${s.nextTier.name}` : ''}` : `Finish ${s.placementsNeeded - s.placements} more ranked matches to get a rank`}
            </T>
          </View>
          <Icon name="chevron-right" color={c.text3} />
        </RowV>
      </Card>

      <Section title="Recent matches" action={recent.length ? 'See all' : undefined} onAction={() => router.push('/profile')} />
      {recent.length ? (
        recent.map((r) => (
          <ListRow key={r.gameId} onPress={() => router.push(`/results/${r.gameId}`)}>
            <Icon name={TYPE_ICON[r.mode]} color={c.text2} />
            <T style={{ flex: 1 }} numberOfLines={1}>
              {r.opponent ? `${MODE_NAME[r.mode]} vs ${r.opponent.username}` : MODE_NAME[r.mode]}
            </T>
            {r.outcome ? (
              <T c={r.outcome === 'win' ? 'legit' : r.outcome === 'loss' ? 'scam' : 'streak'} style={{ fontWeight: '500' }}>
                {r.outcome === 'win' ? 'Won' : r.outcome === 'loss' ? 'Lost' : 'Draw'}
                {r.eloDelta ? ` ${r.eloDelta > 0 ? '+' : ''}${r.eloDelta}` : ''}
              </T>
            ) : (
              <T v="mono" c="text2">
                {fmt(r.score)} pts
              </T>
            )}
          </ListRow>
        ))
      ) : (
        <EmptyState dashed icon="sports-esports" title="No matches yet" body="Finish a game and it shows up here with your score." actions={<Button title="Play your first game" icon="play-arrow" onPress={() => router.push('/modes')} />} />
      )}

      <Section title="Friends online" action={friendCount ? 'See all' : undefined} onAction={() => router.push('/friends')} />
      {friendsOnline.length ? (
        friendsOnline.map((f) => (
          <ListRow key={f.id}>
            <Avatar user={f} online size={40} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '500' }}>{f.username}</T>
              <T v="small" c="text3">
                {f.tier}
              </T>
            </View>
            <Button title="Duel" kind="outline" size="sm" onPress={() => router.push(`/challenge/${f.id}`)} />
          </ListRow>
        ))
      ) : (
        <EmptyState
          icon="group-add"
          title={friendCount ? 'No friends online' : 'No friends yet'}
          body={friendCount ? "We'll show friends here when they come online." : 'Add friends to duel them for ELO or just for fun.'}
          actions={friendCount ? undefined : <Button title="Add friends" icon="person-add" kind="outline" size="sm" onPress={() => router.push('/add-friend')} />}
        />
      )}
    </Screen>
  );
}
