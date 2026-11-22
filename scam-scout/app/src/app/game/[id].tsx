import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { T, Gap, Button, Icon, IconButton, RowV, Sheet, Skeleton, ErrorState, useToast, mmss, fmt, MODE_NAME, TYPE_ICON, type IconName } from '@/components/ui';
import { RoundView } from '@/components/round-view';
import { ChapterView } from '@/components/guide-view';
import { api, ApiError, errMsg } from '@/lib/api';
import { GUIDE } from '@/lib/guide';
import { useColors } from '@/lib/theme';
import type { AnswerResult, Call, Game, Match, Round } from '@/lib/types';

const isDuel = (m: string) => m === 'ranked' || m === 'casual';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const toast = useToast();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [sheet, setSheet] = useState<null | 'answer' | 'feedback' | 'todo' | 'guide' | 'quit'>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [now, setNow] = useState(Date.now());
  const [opp, setOpp] = useState<{ name: string; answered: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const g = await api<Game>(`/games/${id}`);
      if (g.finished) return router.replace({ pathname: '/results/[id]', params: { id: g.id } });
      setGame(g);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'error', errMsg(e)));
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  // Clock tick
  useEffect(() => {
    if (!game?.deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [game?.deadline]);
  const left = game?.deadline ? Math.max(0, Math.ceil((game.deadline - now) / 1000)) : null;
  useEffect(() => {
    if (left === 0 && game) {
      setSheet(null);
      router.replace({ pathname: '/results/[id]', params: { id: game.id, timeUp: '1' } });
    }
  }, [left, game]);

  // Opponent progress in duels (answered count only, never their score)
  useEffect(() => {
    if (!game?.matchId) return;
    const poll = () =>
      api<Match>(`/matches/${game.matchId}`)
        .then((m) => {
          const o = m.players.find((p) => !p.isMe);
          if (o) setOpp({ name: o.user.username, answered: o.answered });
        })
        .catch(() => {});
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [game?.matchId]);

  const round: Round | null = game && game.current != null ? (game.items[game.current] ?? null) : null;
  const duel = !!game && isDuel(game.mode);
  const guideLocked = game?.mode === 'ranked';

  const lockIn = async () => {
    if (!game || !round || !call || !reason || game.current == null) return;
    setBusy(true);
    try {
      const r = await api<AnswerResult>(`/games/${game.id}/answers`, { body: { index: game.current, call, reason } });
      void Haptics.notificationAsync(duel ? Haptics.NotificationFeedbackType.Success : r.points ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
      const items = game.items.slice();
      items[game.current] = { ...round, answer: { call, reason, points: r.points, scam: r.scam, why: r.why, explain: r.explain } };
      if (r.next && !items[game.current + 1]) items.push({ ...r.next, answer: null });
      const nextGame: Game = { ...game, items, answered: game.answered + 1, score: r.score ?? game.score, strikes: r.strikes ?? game.strikes };
      setCall(null);
      setReason(null);
      if (duel) {
        toast('Answer locked', 'lock');
        setSheet(null);
        if (r.finished) router.replace({ pathname: '/results/[id]', params: { id: game.id } });
        else setGame({ ...nextGame, current: game.current + 1 });
      } else {
        setGame(nextGame);
        setFeedback(r);
        setSheet('feedback');
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'game_over') router.replace({ pathname: '/results/[id]', params: { id: game.id, timeUp: '1' } });
      else toast(errMsg(e), 'error-outline');
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!game || !feedback) return;
    setSheet(null);
    if (feedback.finished) return router.replace({ pathname: '/results/[id]', params: { id: game.id } });
    setGame({ ...game, current: (game.current ?? 0) + 1 });
    setFeedback(null);
  };

  const quit = async () => {
    if (!game) return;
    setSheet(null);
    if (duel) {
      await api(`/games/${game.id}/forfeit`, { method: 'POST' }).catch(() => null);
      toast(game.mode === 'ranked' ? 'Match forfeited' : 'Duel forfeited', 'flag');
    }
    router.replace('/');
  };

  const todo = useMemo(() => {
    if (!game) return [];
    const start = game.mode === 'marathon' ? Math.max(0, (game.current ?? 0) - 6) : 0;
    return game.items.slice(start).map((it, k) => {
      const i = k + start;
      let state: [IconName, string] = ['radio-button-unchecked', c.text3];
      if (i === game.current) state = ['radio-button-checked', c.accent];
      else if (it.answer) state = duel ? ['task-alt', c.text2] : it.answer.points === 100 ? ['check-circle', c.legit] : it.answer.points === 60 ? ['check-circle', c.streak] : ['cancel', c.scam];
      return { it, i, state };
    });
  }, [game, c, duel]);

  if (error) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}><ErrorState error={error} onRetry={load} /></SafeAreaView>;
  if (!game || !round) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}><Skeleton /></SafeAreaView>;

  const total = game.total;
  const roundNo = (game.current ?? 0) + 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      {/* Top bar */}
      <View style={{ paddingHorizontal: 12, paddingTop: 4, gap: 8 }}>
        <RowV gap={8}>
          <IconButton name="close" label="Leave game" onPress={() => setSheet('quit')} color={c.text2} />
          <Pressable accessibilityRole="button" accessibilityLabel="Open to-do list" onPress={() => setSheet('todo')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: c.surface }}>
            <Icon name="checklist" size={18} />
            <T v="small" style={{ fontWeight: '700' }}>
              {game.mode === 'marathon' ? `${game.answered} done` : `${game.answered}/${total}`}
            </T>
            <Icon name="expand-more" size={18} color={c.text3} />
          </Pressable>
          <View style={{ flex: 1 }} />
          {left != null ? (
            <RowV gap={4} style={{ height: 32, paddingHorizontal: 10, borderRadius: 9, backgroundColor: left <= 60 ? c.scamSoft : c.streakSoft }}>
              <Icon name="timer" size={16} color={left <= 60 ? c.scam : c.streak} />
              <T v="mono" c={left <= 60 ? 'scam' : 'streak'} style={{ fontWeight: '600' }}>
                {mmss(left)}
              </T>
            </RowV>
          ) : null}
          {game.mode === 'marathon' ? (
            <RowV gap={4} accessibilityLabel={`${game.strikes} of 3 wrong in a row`}>
              {[0, 1, 2].map((k) => (
                <View key={k} style={{ width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: k < game.strikes ? c.scamSoft : 'transparent', borderWidth: k < game.strikes ? 0 : 1, borderColor: c.line }}>
                  <Icon name="close" size={14} color={k < game.strikes ? c.scam : c.text3} />
                </View>
              ))}
            </RowV>
          ) : null}
          {!duel && game.mode !== 'marathon' ? (
            <T v="mono" style={{ fontWeight: '600' }}>
              {fmt(game.score ?? 0)} pts
            </T>
          ) : null}
        </RowV>
        <RowV style={{ justifyContent: 'space-between' }}>
          <T v="small" c="text2" style={{ fontWeight: '500' }}>
            {MODE_NAME[game.mode]} · {total ? `Round ${roundNo} of ${total}` : `Round ${roundNo}`}
          </T>
          {opp ? (
            <T v="small" c="text3">
              {opp.name} · {opp.answered}/{total}
            </T>
          ) : game.mode === 'marathon' ? (
            <T v="small" c="text3">
              3 wrong in a row ends it
            </T>
          ) : null}
        </RowV>
        {total ? (
          <RowV gap={3}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < game.answered ? (duel ? c.text2 : c.ink) : i === game.current ? c.accent : c.line }} />
            ))}
          </RowV>
        ) : null}
      </View>

      {/* The round, shown like the phone's own app */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <RoundView key={round.id + game.current} round={round} />
      </ScrollView>

      {/* Guide (left) and Answer (right) */}
      <RowV gap={12} style={{ position: 'absolute', left: 16, right: 16, bottom: 0, paddingBottom: 24, paddingTop: 12, backgroundColor: c.bg }}>
        <Button title={guideLocked ? 'Locked' : 'Guide'} icon={guideLocked ? 'lock' : 'menu-book'} kind="soft" size="lg" style={{ flex: 0.8 }} onPress={() => (guideLocked ? toast('The Guide Book is locked in Ranked', 'lock') : setSheet('guide'))} />
        <Button title="Answer" icon="fact-check" size="lg" style={{ flex: 1.2 }} onPress={() => setSheet('answer')} />
      </RowV>

      {/* Answer sheet */}
      <Sheet visible={sheet === 'answer'} onClose={() => setSheet(null)} title="Your answer" subtitle={`${round.from} · ${round.type === 'mail' ? 'email' : round.type === 'sms' ? 'text' : 'call'}`}>
        <T v="small" c="text2" style={{ fontWeight: '500' }}>
          Is this a scam?
        </T>
        <RowV gap={12} style={{ marginTop: 8, marginBottom: 20 }}>
          {(
            [
              ['legit', 'Legit', 'verified', c.legit],
              ['scam', 'Scam', 'gpp-maybe', c.scam],
            ] as const
          ).map(([v, label, icon, col]) => {
            const on = call === v;
            return (
              <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setCall(v)} style={{ flex: 1, height: 56, borderRadius: 14, borderWidth: on ? 0 : 1, borderColor: c.line, backgroundColor: on ? col : 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon name={icon} color={on ? '#fff' : col} />
                <T style={{ fontWeight: '600', color: on ? '#fff' : c.text }}>{label}</T>
              </Pressable>
            );
          })}
        </RowV>
        <T v="small" c="text2" style={{ fontWeight: '500' }}>
          What gave it away?
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 18 }}>
          {round.reasons.map((r) => {
            const on = reason === r;
            return (
              <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setReason(r)} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, justifyContent: 'center', backgroundColor: on ? c.ink : 'transparent', borderWidth: on ? 0 : 1, borderColor: c.line }}>
                <T v="small" c={on ? 'onInk' : 'text'} style={{ fontWeight: '500' }}>
                  {r}
                </T>
              </Pressable>
            );
          })}
        </View>
        <RowV gap={6} style={{ marginBottom: 14 }}>
          <Icon name={duel ? 'visibility-off' : 'info-outline'} size={16} color={c.text3} />
          <T v="small" c="text3">
            {duel ? 'Right or wrong stays hidden until the match ends.' : 'Right call +60 · Right reason +40'}
          </T>
        </RowV>
        <Button title={call && reason ? 'Lock in' : 'Pick an answer and a reason'} icon="lock" size="lg" full loading={busy} disabled={!call || !reason} onPress={lockIn} />
      </Sheet>

      {/* Feedback (practice and marathon only) */}
      <Sheet visible={sheet === 'feedback'} onClose={next}>
        {feedback ? (
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: feedback.points === 100 ? c.legitSoft : feedback.points === 60 ? c.streakSoft : c.scamSoft }}>
              <Icon name={feedback.points ? 'check' : 'close'} size={34} color={feedback.points === 100 ? c.legit : feedback.points === 60 ? c.streak : c.scam} />
            </View>
            <T v="h2" style={{ marginTop: 12 }}>
              {feedback.points === 100 ? 'Right call, right reason' : feedback.points === 60 ? 'Right call, wrong reason' : 'Not quite'}
            </T>
            <T v="mono" c={feedback.points === 100 ? 'legit' : feedback.points === 60 ? 'streak' : 'scam'} style={{ marginVertical: 6 }}>
              +{feedback.points} points
            </T>
            <View style={{ alignSelf: 'stretch', backgroundColor: c.surface, borderRadius: 14, padding: 14, marginVertical: 12 }}>
              <T style={{ fontWeight: '600' }}>
                {feedback.scam ? 'It was a scam' : 'It was legit'} · {feedback.why?.join(', ')}
              </T>
              <T c="text2" style={{ marginTop: 4 }}>
                {feedback.explain}
              </T>
            </View>
            {game.mode === 'marathon' && !feedback.correctCall ? (
              <T c="scam" style={{ marginBottom: 12, fontWeight: '500' }}>
                {feedback.strikes} wrong in a row{(feedback.strikes ?? 0) < 3 ? ` · ${3 - (feedback.strikes ?? 0)} more ends the run` : ''}
              </T>
            ) : null}
            <Button title={feedback.finished ? (game.mode === 'marathon' ? 'See run summary' : 'See results') : 'Next round'} icon="arrow-forward" size="lg" full onPress={next} />
          </View>
        ) : null}
      </Sheet>

      {/* To-do list */}
      <Sheet visible={sheet === 'todo'} onClose={() => setSheet(null)} title="To do" subtitle={`${MODE_NAME[game.mode]} · ${game.mode === 'marathon' ? `round ${roundNo}` : `${game.answered} of ${total}`}`}>
        {todo.map(({ it, i, state }) => (
          <RowV key={i} gap={10} style={{ paddingVertical: 8, opacity: !it.answer && i !== game.current ? 0.55 : 1 }}>
            <Icon name={state[0]} size={20} color={state[1]} />
            <Icon name={TYPE_ICON[it.type]} size={18} color={c.text2} />
            <T style={{ flex: 1, fontWeight: i === game.current ? '600' : '400' }} numberOfLines={1}>
              {it.from}
            </T>
          </RowV>
        ))}
        {game.mode === 'marathon' ? (
          <RowV gap={10} style={{ paddingVertical: 8, opacity: 0.55 }}>
            <Icon name="more-horiz" color={c.text3} />
            <T>More keep coming</T>
          </RowV>
        ) : null}
        {duel ? (
          <T v="small" c="text3" style={{ marginTop: 10 }}>
            Right or wrong stays hidden until the match ends.
          </T>
        ) : null}
      </Sheet>

      {/* Guide */}
      <Sheet visible={sheet === 'guide'} onClose={() => setSheet(null)} title="Guide Book">
        <ChapterView chapter={GUIDE.find((g) => g.id === round.type) ?? GUIDE[0]} />
        <Button title="Back to the round" size="lg" full onPress={() => setSheet(null)} />
      </Sheet>

      {/* Quit */}
      <Sheet visible={sheet === 'quit'} onClose={() => setSheet(null)} title={game.mode === 'ranked' ? 'Leave this match?' : 'Quit this game?'} subtitle={game.mode === 'ranked' ? 'Leaving a ranked match counts as a loss and costs ELO.' : duel ? 'Leaving counts as a loss.' : 'Your progress in this game will be lost.'}>
        <RowV gap={10} style={{ justifyContent: 'flex-end' }}>
          <Button title="Keep playing" kind="outline" onPress={() => setSheet(null)} />
          <Button title={duel ? 'Leave match' : 'Quit'} kind="dangerFill" onPress={quit} />
        </RowV>
        <Gap h={8} />
      </Sheet>
    </SafeAreaView>
  );
}
