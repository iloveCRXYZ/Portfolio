import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, T, Gap, Button, Icon, RowV, Avatar, Card, Chip, StatStrip, ListRow, Skeleton, ErrorState, ProgressBar, useToast, fmt, mmss, MODE_NAME, TYPE_ICON } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/lib/theme';
import type { Results, Round } from '@/lib/types';

export default function ResultsScreen() {
  const { id, timeUp } = useLocalSearchParams<{ id: string; timeUp?: string }>();
  const c = useColors();
  const toast = useToast();
  const { me } = useAuth();
  const [review, setReview] = useState(false);
  const [showTimeUp, setShowTimeUp] = useState(timeUp === '1');
  const [rematch, setRematch] = useState<'idle' | 'waiting'>('idle');
  const { data, error, loading, reload, reloadSilently } = useApi<Results>(`/games/${id}/results`);

  const waiting = !!data?.match && data.match.status !== 'done';
  // Keep checking while the opponent finishes, or while a rematch request is pending.
  useEffect(() => {
    if (!waiting && rematch !== 'waiting') return;
    const t = setInterval(() => void reloadSilently(), 3000);
    return () => clearInterval(t);
  }, [waiting, rematch, reloadSilently]);
  useEffect(() => {
    const rid = data?.match?.rematchMatchId;
    if (rid) router.replace({ pathname: '/matchmaking', params: { matchId: rid } });
  }, [data?.match?.rematchMatchId]);

  if (loading) return <Screen><Skeleton /></Screen>;
  if (error || !data) return <Screen><ErrorState error={error} onRetry={reload} /></Screen>;
  const { game, stats, match } = data;
  const mine = match?.players.find((p) => p.isMe);
  const opp = match?.players.find((p) => !p.isMe);
  const home = () => router.replace('/');
  const playAgain = async () => {
    if (game.mode === 'ranked') return router.replace('/matchmaking');
    if (game.mode === 'casual') return router.replace('/friends');
    try {
      const g = await api<{ id: string }>('/games', { body: { mode: game.mode } });
      router.replace(`/game/${g.id}`);
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    }
  };
  const askRematch = async () => {
    if (!match) return;
    try {
      const r = await api<{ status: string; matchId: string | null }>(`/matches/${match.id}/rematch`, { method: 'POST' });
      if (r.matchId) router.replace({ pathname: '/matchmaking', params: { matchId: r.matchId } });
      else {
        setRematch('waiting');
        toast(`Rematch request sent to ${opp?.user.username}`, 'send');
      }
    } catch (e) {
      toast(errMsg(e), 'error-outline');
    }
  };

  // Ranked clock ran out
  if (showTimeUp && match) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Gap h={40} />
        <View style={{ alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: c.streakSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="timer-off" size={36} color={c.streak} />
        </View>
        <T v="display" center style={{ marginTop: 16 }}>
          Time's up
        </T>
        <T c="text2" center style={{ marginTop: 6 }}>
          The 20:00 match clock ran out. Unanswered rounds count as misses.
        </T>
        <Gap h={24} />
        {match.players.map((p) => (
          <Card key={p.user.id} style={{ marginBottom: 12 }}>
            <RowV gap={12}>
              <Avatar user={p.user} size={40} />
              <T style={{ flex: 1, fontWeight: '600' }}>{p.isMe ? 'You' : p.user.username}</T>
              <T v="h2">
                {p.answered} of {match.total}
              </T>
            </RowV>
            <Gap h={10} />
            <ProgressBar value={p.answered / match.total} color={p.answered < match.total ? c.streak : c.ink} />
          </Card>
        ))}
        <RowV gap={6} style={{ justifyContent: 'center', marginVertical: 16 }}>
          <Icon name="visibility-off" size={16} color={c.text3} />
          <T v="small" c="text3">
            Right or wrong is revealed on the next screen.
          </T>
        </RowV>
        <Button title={waiting ? 'Waiting for the match to close…' : 'See results'} icon="arrow-forward" size="lg" full disabled={waiting} onPress={() => setShowTimeUp(false)} />
      </Screen>
    );
  }

  // Duel still running on the other side
  if (waiting && match) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Gap h={60} />
        <T v="h1" center>
          You're done
        </T>
        <T c="text2" center style={{ marginTop: 6 }}>
          Waiting for {opp?.user.username} to finish. Results stay hidden until the match closes.
        </T>
        <Gap h={24} />
        {opp ? (
          <Card>
            <RowV gap={12}>
              <Avatar user={opp.user} size={40} />
              <T style={{ flex: 1, fontWeight: '600' }}>{opp.user.username}</T>
              <T v="mono">
                {opp.answered}/{match.total}
              </T>
            </RowV>
            <Gap h={10} />
            <ProgressBar value={opp.answered / match.total} />
          </Card>
        ) : null}
        <T v="mono" c="text3" center style={{ marginTop: 16 }}>
          Match closes in {mmss(Math.max(0, Math.round((match.deadline - Date.now()) / 1000)))} at the latest
        </T>
        <Gap h={24} />
        <Button title="Back to home" kind="outline" full onPress={home} />
      </Screen>
    );
  }

  const answers = game.items.filter((i) => i.answer || game.mode !== 'marathon');
  const cell = (r: Round) => (!r.answer?.call ? 'none' : r.answer.points === 100 ? 'full' : r.answer.points === 60 ? 'half' : 'miss');
  const acc = stats && stats.rounds ? Math.round((stats.rightCalls / stats.rounds) * 100) : 0;

  return (
    <Screen edges={['top', 'bottom']}>
      <RowV style={{ justifyContent: 'space-between' }}>
        <Button title="Home" icon="arrow-back" kind="ghost" size="sm" style={{ marginLeft: -10 }} onPress={home} />
        <T v="small" c="text2">
          {MODE_NAME[game.mode]}
        </T>
      </RowV>
      <Gap h={8} />
      {game.mode === 'marathon' && stats ? (
        <>
          <RowV gap={8}>
            {[0, 1, 2].map((k) => (
              <View key={k} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: c.scamSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={26} color={c.scam} />
              </View>
            ))}
          </RowV>
          <T v="display" style={{ marginTop: 14 }}>
            Run over
          </T>
          <T c="text2">Three wrong in a row. You lasted {stats.rounds} rounds.</T>
        </>
      ) : match && mine ? (
        <>
          <RowV gap={6}>
            <Icon name={mine.outcome === 'win' ? 'emoji-events' : mine.outcome === 'loss' ? 'sentiment-dissatisfied' : 'balance'} color={mine.outcome === 'win' ? c.legit : mine.outcome === 'loss' ? c.scam : c.streak} />
            <T c={mine.outcome === 'win' ? 'legit' : mine.outcome === 'loss' ? 'scam' : 'streak'} style={{ fontWeight: '600' }}>
              {mine.outcome === 'win' ? 'Victory' : mine.outcome === 'loss' ? 'Defeat' : 'Draw'}
            </T>
          </RowV>
          <T v="display" style={{ marginTop: 6 }}>
            {mine.outcome === 'draw' ? `It's a tie at ${fmt(mine.score ?? 0)}` : mine.outcome === 'win' ? `You won ${fmt(mine.score ?? 0)} to ${fmt(opp?.score ?? 0)}` : `You lost ${fmt(mine.score ?? 0)} to ${fmt(opp?.score ?? 0)}`}
          </T>
          {match.mode === 'ranked' ? (
            <T v="mono" c={(mine.eloDelta ?? 0) > 0 ? 'legit' : (mine.eloDelta ?? 0) < 0 ? 'scam' : 'text2'} style={{ marginTop: 6 }}>
              {(mine.eloDelta ?? 0) > 0 ? '+' : ''}
              {mine.eloDelta ?? 0} ELO{me?.elo ? ` · now ${fmt(mine.eloAfter ?? mine.eloBefore)}` : ' · placement match'}
              {match.timeUp ? ' · time ran out' : ''}
            </T>
          ) : (
            <T c="text2" style={{ marginTop: 6 }}>
              Casual duel · no ELO change
            </T>
          )}
          <Card style={{ marginTop: 18 }}>
            <RowV style={{ justifyContent: 'space-between' }}>
              <RowV gap={10}>
                <Avatar user={mine.user} size={44} />
                <View>
                  <T v="small" c="text2">
                    You
                  </T>
                  <T v="h2">{fmt(mine.score ?? 0)}</T>
                </View>
              </RowV>
              <T c="text3">vs</T>
              <RowV gap={10}>
                <View style={{ alignItems: 'flex-end' }}>
                  <T v="small" c="text2">
                    {opp?.user.username}
                  </T>
                  <T v="h2" c="text2">
                    {fmt(opp?.score ?? 0)}
                  </T>
                </View>
                <Avatar user={opp?.user} size={44} />
              </RowV>
            </RowV>
          </Card>
          {mine.outcome === 'draw' ? (
            <Card style={{ marginTop: 12 }}>
              <T style={{ fontWeight: '600' }}>No ELO changes hands</T>
              <T c="text2" style={{ marginVertical: 6 }}>
                Play a fresh set against {opp?.user.username} to settle it.
              </T>
              <Button title={rematch === 'waiting' ? `Waiting for ${opp?.user.username}…` : 'Rematch'} icon="sports-kabaddi" disabled={rematch === 'waiting'} onPress={askRematch} />
            </Card>
          ) : null}
        </>
      ) : stats ? (
        <>
          <T v="display">{stats.max && stats.score === stats.max ? 'Perfect run!' : `${fmt(stats.score)} of ${fmt(stats.max ?? 0)} points`}</T>
          <T c="text2" style={{ marginTop: 6 }}>
            {stats.timedOut ? 'Time ran out. ' : ''}
            {acc >= 70 ? 'Nice work. Check the rounds you missed below.' : 'Keep practicing. The review shows what gave each one away.'}
          </T>
        </>
      ) : null}

      <T v="h3" style={{ marginTop: 24, marginBottom: 10 }}>
        Round by round
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
        {answers.map((r, i) => {
          const s = cell(r);
          const bg = { full: c.legitSoft, half: c.streakSoft, miss: c.scamSoft, none: c.surface }[s];
          const fg = { full: c.legit, half: c.streak, miss: c.scam, none: c.text3 }[s];
          return (
            <View key={i} accessibilityLabel={`Round ${i + 1}: ${s}`} style={{ width: 40, height: 40, borderRadius: 9, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s === 'miss' ? 'close' : s === 'none' ? 'remove' : 'check'} size={20} color={fg} />
            </View>
          );
        })}
      </View>
      {stats ? (
        <StatStrip
          items={[
            { label: 'Accuracy', value: `${acc}%` },
            { label: 'Right reasons', value: `${stats.rightReasons}/${stats.rounds}` },
            { label: game.mode === 'marathon' ? 'Best streak' : 'Avg. decision', value: game.mode === 'marathon' ? `${stats.bestRun}` : `${stats.avgSeconds}s` },
          ]}
        />
      ) : null}
      <View style={{ gap: 10 }}>
        <Button title="Play again" icon="replay" size="lg" full onPress={playAgain} />
        <Button title={review ? 'Hide answers' : 'Review answers'} icon={review ? 'expand-less' : 'list'} kind="outline" size="lg" full onPress={() => setReview(!review)} />
      </View>
      {review
        ? answers.map((r, i) => (
            <ListRow key={i} style={{ alignItems: 'flex-start' }}>
              <Icon name={TYPE_ICON[r.type]} color={c.text2} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '600' }}>
                  {i + 1}. {r.from}
                </T>
                <T v="small" c="text2" style={{ marginTop: 2 }}>
                  {r.answer?.call ? `You said ${r.answer.call === 'scam' ? 'Scam' : 'Legit'} · ${r.answer.reason}. ` : 'Not answered. '}
                  It was {r.answer?.scam ? 'a scam' : 'legit'}
                  {r.answer?.why ? ` (${r.answer.why[0]})` : ''}. {r.answer?.explain ?? ''}
                </T>
              </View>
              <Chip label={r.answer?.call ? `+${r.answer.points ?? 0}` : '—'} tone={r.answer?.points === 100 ? 'legit' : r.answer?.points === 60 ? 'streak' : r.answer?.call ? 'scam' : 'neutral'} />
            </ListRow>
          ))
        : null}
    </Screen>
  );
}
