// Game and match engine. All scoring happens here, on the server.
import { ITEMS, ITEM_BY_ID, publicItem, revealItem, type ItemType } from './content.ts';
import { all, one, run, tx, type Row } from './db.ts';
import { newId } from './auth.ts';
import { type Ctx, bad, forbidden, notFound, notify, getUser, publicUser } from './ctx.ts';
import {
  DAILY_SECONDS,
  MARATHON_STRIKES,
  PLACEMENT_MATCHES,
  RANKED_SECONDS,
  eloDelta,
  scoreAnswer,
  shuffle,
  type Call,
} from './scoring.ts';

export const SOLO_MODES = ['mail', 'sms', 'call', 'marathon', 'daily'] as const;
export type SoloMode = (typeof SOLO_MODES)[number];
export type DuelMode = 'ranked' | 'casual';
export const isDuel = (mode: string): mode is DuelMode => mode === 'ranked' || mode === 'casual';

const ofType = (t: ItemType) => ITEMS.filter((i) => i.type === t).map((i) => i.id);
const pick = (t: ItemType, n: number) => shuffle(ofType(t)).slice(0, n);

export function itemsForMode(mode: string): string[] {
  switch (mode) {
    case 'mail':
    case 'sms':
    case 'call':
      return shuffle(ofType(mode)).slice(0, 10);
    case 'daily':
      return shuffle(ofType('sms')).slice(0, 10);
    case 'ranked':
      return shuffle([...pick('mail', 5), ...pick('sms', 5), ...pick('call', 5)]);
    case 'casual':
      return shuffle([...pick('mail', 4), ...pick('sms', 3), ...pick('call', 3)]);
    case 'marathon':
      return shuffle(ITEMS.map((i) => i.id)).slice(0, 1);
    default:
      throw bad('Unknown mode');
  }
}

const parseIds = (g: Row): string[] => JSON.parse(g.item_ids);

export function createGame(ctx: Ctx, userId: string, mode: string, opts: { itemIds?: string[]; matchId?: string; deadline?: number } = {}): Row {
  const id = newId('g_');
  const itemIds = opts.itemIds ?? itemsForMode(mode);
  const deadline = opts.deadline ?? (mode === 'daily' ? ctx.now() + DAILY_SECONDS * 1000 : null);
  run(
    ctx.db,
    'INSERT INTO games (id, user_id, mode, item_ids, match_id, started_at, deadline) VALUES (?,?,?,?,?,?,?)',
    id,
    userId,
    mode,
    JSON.stringify(itemIds),
    opts.matchId ?? null,
    ctx.now(),
    deadline,
  );
  return one(ctx.db, 'SELECT * FROM games WHERE id = ?', id)!;
}

export function getGame(ctx: Ctx, id: string, userId: string): Row {
  const g = one(ctx.db, 'SELECT * FROM games WHERE id = ?', id);
  if (!g) throw notFound('Game not found');
  if (g.user_id !== userId) throw forbidden('This is not your game');
  return g;
}

function answersOf(ctx: Ctx, gameId: string): Row[] {
  return all(ctx.db, 'SELECT * FROM answers WHERE game_id = ? ORDER BY idx', gameId);
}

/** Close games whose clock ran out. Returns the fresh row. */
function expireIfNeeded(ctx: Ctx, g: Row): Row {
  if (!g.finished_at && g.deadline && ctx.now() >= g.deadline) {
    run(ctx.db, 'UPDATE games SET finished_at = ? WHERE id = ? AND finished_at IS NULL', g.deadline, g.id);
    if (g.match_id) finalizeMatchIfReady(ctx, g.match_id);
    return one(ctx.db, 'SELECT * FROM games WHERE id = ?', g.id)!;
  }
  return g;
}

function hidesResults(ctx: Ctx, g: Row): boolean {
  if (!isDuel(g.mode)) return false;
  const m = one(ctx.db, 'SELECT status FROM matches WHERE id = ?', g.match_id);
  return m?.status !== 'done';
}

export function gameView(ctx: Ctx, gIn: Row) {
  const g = expireIfNeeded(ctx, gIn);
  const ids = parseIds(g);
  const ans = answersOf(ctx, g.id);
  const hide = hidesResults(ctx, g);
  return {
    id: g.id,
    mode: g.mode,
    matchId: g.match_id,
    total: g.mode === 'marathon' ? null : ids.length,
    answered: ans.length,
    current: g.finished_at ? null : ans.length,
    items: ids.map((id, i) => {
      const item = ITEM_BY_ID.get(id)!;
      const a = ans[i];
      return {
        ...publicItem(item),
        answer: a ? { call: a.call, reason: a.reason, ...(hide ? {} : { points: a.points, ...revealItem(item) }) } : null,
      };
    }),
    score: hide ? null : g.score,
    strikes: g.strikes,
    deadline: g.deadline,
    startedAt: g.started_at,
    finished: !!g.finished_at,
    resultsHidden: hide,
  };
}

export function answerRound(ctx: Ctx, userId: string, gameId: string, body: { index: number; call: Call; reason: string }) {
  return tx(ctx.db, () => {
    let g = getGame(ctx, gameId, userId);
    g = expireIfNeeded(ctx, g);
    if (g.finished_at) throw bad(g.deadline && ctx.now() >= g.deadline ? 'Time is up for this game.' : 'This game is already finished.', 'game_over');
    const ids = parseIds(g);
    const done = (one(ctx.db, 'SELECT COUNT(*) AS n FROM answers WHERE game_id = ?', g.id)!.n as number) ?? 0;
    if (body.index !== done) throw bad('That round was already answered.', 'out_of_order');
    const item = ITEM_BY_ID.get(ids[done]);
    if (!item) throw bad('No round to answer.');
    const points = scoreAnswer(item, body.call, body.reason);
    const prev = one(ctx.db, 'SELECT MAX(created_at) AS t FROM answers WHERE game_id = ?', g.id)?.t ?? g.started_at;
    run(ctx.db, 'INSERT INTO answers (game_id, idx, item_id, call, reason, points, ms, created_at) VALUES (?,?,?,?,?,?,?,?)', g.id, done, item.id, body.call, body.reason, points, ctx.now() - prev, ctx.now());

    const callOk = points > 0;
    let strikes = g.strikes;
    let runLen = g.run;
    let finished = false;
    if (g.mode === 'marathon') {
      strikes = callOk ? 0 : strikes + 1;
      runLen = callOk ? runLen + 1 : 0;
      if (strikes >= MARATHON_STRIKES) finished = true;
      else {
        // Endless: add another round, never repeating the last few.
        const recent = new Set(ids.slice(-12));
        const pool = ITEMS.filter((i) => !recent.has(i.id));
        ids.push(shuffle(pool)[0].id);
      }
    } else if (done + 1 >= ids.length) finished = true;

    run(
      ctx.db,
      'UPDATE games SET score = score + ?, strikes = ?, run = ?, best_run = MAX(best_run, ?), item_ids = ?, finished_at = ? WHERE id = ?',
      points,
      strikes,
      runLen,
      runLen,
      JSON.stringify(ids),
      finished ? ctx.now() : null,
      g.id,
    );
    if (finished && g.match_id) finalizeMatchIfReady(ctx, g.match_id);

    if (isDuel(g.mode)) return { locked: true, finished, next: finished ? null : publicItem(ITEM_BY_ID.get(ids[done + 1])!) };
    return {
      locked: true,
      finished,
      points,
      correctCall: callOk,
      correctReason: points === 100,
      ...revealItem(item),
      strikes,
      score: g.score + points,
      next: finished ? null : publicItem(ITEM_BY_ID.get(ids[done + 1])!),
    };
  });
}

export function finishGame(ctx: Ctx, userId: string, gameId: string, forfeit = false) {
  return tx(ctx.db, () => {
    const g = getGame(ctx, gameId, userId);
    if (!g.finished_at) run(ctx.db, 'UPDATE games SET finished_at = ?, forfeit = ? WHERE id = ?', ctx.now(), forfeit ? 1 : 0, g.id);
    if (g.match_id) finalizeMatchIfReady(ctx, g.match_id, forfeit ? userId : undefined);
    return gameResults(ctx, userId, gameId);
  });
}

export function gameResults(ctx: Ctx, userId: string, gameId: string) {
  const g = expireIfNeeded(ctx, getGame(ctx, gameId, userId));
  const view = gameView(ctx, g);
  const ans = answersOf(ctx, g.id);
  const timed = ans.filter((a) => a.call);
  return {
    game: view,
    stats: view.resultsHidden
      ? null
      : {
          score: g.score,
          max: g.mode === 'marathon' ? null : parseIds(g).length * 100,
          rightCalls: ans.filter((a) => a.points >= 60).length,
          rightReasons: ans.filter((a) => a.points === 100).length,
          answered: timed.length,
          avgSeconds: timed.length ? Math.round(timed.reduce((s, a) => s + a.ms, 0) / timed.length / 100) / 10 : 0,
          bestRun: g.best_run,
          rounds: ans.length,
          timedOut: !!(g.deadline && g.finished_at && g.finished_at >= g.deadline && ans.length < parseIds(g).length),
        },
    match: g.match_id ? matchView(ctx, g.match_id, userId) : null,
  };
}

/* ---------------- matches ---------------- */

export function createMatch(ctx: Ctx, mode: DuelMode, userIds: string[], rematchOf: string | null = null): string {
  const id = newId('m_');
  const itemIds = itemsForMode(mode);
  const deadline = ctx.now() + RANKED_SECONDS * 1000;
  run(ctx.db, 'INSERT INTO matches (id, mode, item_ids, deadline, rematch_of, created_at) VALUES (?,?,?,?,?,?)', id, mode, JSON.stringify(itemIds), deadline, rematchOf, ctx.now());
  for (const uid of userIds) {
    const u = getUser(ctx, uid);
    const g = createGame(ctx, uid, mode, { itemIds, matchId: id, deadline });
    run(ctx.db, 'INSERT INTO match_players (match_id, user_id, game_id, elo_before) VALUES (?,?,?,?)', id, uid, g.id, u.elo);
  }
  return id;
}

/** Bots answer when the match closes, with roughly 70% accuracy. */
function playBot(ctx: Ctx, gameId: string, itemIds: string[], until: number) {
  const have = one(ctx.db, 'SELECT COUNT(*) AS n FROM answers WHERE game_id = ?', gameId)!.n as number;
  let score = 0;
  for (let i = have; i < itemIds.length; i++) {
    const item = ITEM_BY_ID.get(itemIds[i])!;
    const right = Math.random() < 0.72;
    const call: Call = right === item.scam ? 'scam' : 'legit';
    const reason = right && Math.random() < 0.7 ? item.why[0] : 'Nothing suspicious';
    const pts = scoreAnswer(item, call, reason);
    score += pts;
    run(ctx.db, 'INSERT INTO answers (game_id, idx, item_id, call, reason, points, ms, created_at) VALUES (?,?,?,?,?,?,?,?)', gameId, i, item.id, call, reason, pts, 9000, until);
  }
  run(ctx.db, 'UPDATE games SET score = score + ?, finished_at = ? WHERE id = ?', score, until, gameId);
}

export function finalizeMatchIfReady(ctx: Ctx, matchId: string, forfeiter?: string) {
  const m = one(ctx.db, 'SELECT * FROM matches WHERE id = ?', matchId);
  if (!m || m.status === 'done') return;
  const players = all(
    ctx.db,
    'SELECT mp.*, g.finished_at, g.score, u.is_bot, u.placements, u.username FROM match_players mp JOIN games g ON g.id = mp.game_id JOIN users u ON u.id = mp.user_id WHERE mp.match_id = ?',
    matchId,
  );
  const timeUp = ctx.now() >= m.deadline;
  const humansDone = players.filter((p) => !p.is_bot).every((p) => p.finished_at);
  if (!timeUp && !humansDone && !forfeiter) return;

  const closeAt = Math.min(ctx.now(), m.deadline);
  const itemIds = JSON.parse(m.item_ids);
  for (const p of players) {
    if (p.is_bot && !p.finished_at) playBot(ctx, p.game_id, itemIds, closeAt);
    else if (!p.finished_at) run(ctx.db, 'UPDATE games SET finished_at = ? WHERE id = ?', closeAt, p.game_id);
  }
  const fresh = all(ctx.db, 'SELECT mp.*, g.score, u.placements, u.is_bot FROM match_players mp JOIN games g ON g.id = mp.game_id JOIN users u ON u.id = mp.user_id WHERE mp.match_id = ?', matchId);
  const [a, b] = fresh;
  const outcome = (me: Row, opp: Row): 'win' | 'loss' | 'draw' => {
    if (forfeiter) return me.user_id === forfeiter ? 'loss' : 'win';
    return me.score > opp.score ? 'win' : me.score < opp.score ? 'loss' : 'draw';
  };
  const result: Record<string, { score: number; outcome: string; eloDelta: number; eloAfter: number | null }> = {};
  for (const [me, opp] of [
    [a, b],
    [b, a],
  ] as Row[][]) {
    const o = outcome(me, opp);
    let delta = 0;
    let after: number | null = null;
    if (m.mode === 'ranked' && !me.is_bot) {
      delta = eloDelta(me.elo_before, opp.elo_before, o, me.placements < PLACEMENT_MATCHES);
      after = me.elo_before + delta;
      run(ctx.db, 'UPDATE users SET elo = ?, placements = placements + 1 WHERE id = ?', after, me.user_id);
      run(ctx.db, 'UPDATE match_players SET elo_after = ? WHERE match_id = ? AND user_id = ?', after, matchId, me.user_id);
    }
    result[me.user_id] = { score: me.score, outcome: o, eloDelta: delta, eloAfter: after };
  }
  run(ctx.db, "UPDATE matches SET status = 'done', result = ? WHERE id = ?", JSON.stringify({ players: result, forfeit: forfeiter ?? null, timeUp }), matchId);
  for (const p of fresh) {
    if (p.is_bot) continue;
    const r = result[p.user_id];
    const word = r.outcome === 'win' ? 'You won' : r.outcome === 'loss' ? 'You lost' : 'Draw';
    notify(ctx, p.user_id, 'match_done', `${word} your ${m.mode} match. Tap to see the results.`, { matchId });
  }
}

export function matchView(ctx: Ctx, matchId: string, viewerId: string) {
  const m = one(ctx.db, 'SELECT * FROM matches WHERE id = ?', matchId);
  if (!m) throw notFound('Match not found');
  if (m.status !== 'done') finalizeMatchIfReady(ctx, matchId);
  const mm = one(ctx.db, 'SELECT * FROM matches WHERE id = ?', matchId)!;
  const players = all(ctx.db, 'SELECT mp.*, g.finished_at FROM match_players mp JOIN games g ON g.id = mp.game_id WHERE mp.match_id = ?', matchId);
  if (!players.some((p) => p.user_id === viewerId)) throw forbidden('You are not in this match');
  const total = JSON.parse(mm.item_ids).length;
  const result = mm.result ? JSON.parse(mm.result) : null;
  const rematch = one(ctx.db, 'SELECT id FROM matches WHERE rematch_of = ?', matchId);
  return {
    id: mm.id,
    mode: mm.mode,
    status: mm.status,
    deadline: mm.deadline,
    total,
    serverNow: ctx.now(),
    rematchMatchId: rematch?.id ?? null,
    players: players.map((p) => {
      const u = getUser(ctx, p.user_id);
      const n = one(ctx.db, 'SELECT COUNT(*) AS n FROM answers WHERE game_id = ?', p.game_id)!.n as number;
      // Bots look busy while the match runs.
      const shown = u.is_bot && mm.status !== 'done' ? Math.min(total, Math.floor((ctx.now() - mm.created_at) / 45000)) : n;
      return {
        user: publicUser(ctx, u),
        isMe: p.user_id === viewerId,
        gameId: p.user_id === viewerId ? p.game_id : undefined,
        answered: shown,
        finished: !!p.finished_at && !(u.is_bot && mm.status !== 'done'),
        wantsRematch: !!p.wants_rematch,
        eloBefore: p.elo_before,
        ...(result ? result.players[p.user_id] : {}),
      };
    }),
    timeUp: result?.timeUp ?? false,
  };
}

export function requestRematch(ctx: Ctx, matchId: string, userId: string) {
  return tx(ctx.db, () => {
    const m = one(ctx.db, 'SELECT * FROM matches WHERE id = ?', matchId);
    if (!m) throw notFound('Match not found');
    if (m.status !== 'done') throw bad('Finish this match first.');
    const existing = one(ctx.db, 'SELECT id FROM matches WHERE rematch_of = ?', matchId);
    if (existing) return { status: 'matched', matchId: existing.id };
    const players = all(ctx.db, 'SELECT mp.user_id, mp.wants_rematch, u.is_bot, u.username FROM match_players mp JOIN users u ON u.id = mp.user_id WHERE mp.match_id = ?', matchId);
    if (!players.some((p) => p.user_id === userId)) throw forbidden('You are not in this match');
    run(ctx.db, 'UPDATE match_players SET wants_rematch = 1 WHERE match_id = ? AND user_id = ?', matchId, userId);
    const others = players.filter((p) => p.user_id !== userId);
    if (others.every((p) => p.wants_rematch || p.is_bot)) {
      const id = createMatch(ctx, m.mode, players.map((p) => p.user_id), matchId);
      return { status: 'matched', matchId: id };
    }
    const me = getUser(ctx, userId);
    for (const o of others) notify(ctx, o.user_id, 'rematch', `${me.username} wants a rematch.`, { matchId });
    return { status: 'waiting', matchId: null };
  });
}

/* ---------------- matchmaking ---------------- */

const BOT_ID = 'u_scoutbot';
function ensureBot(ctx: Ctx, elo: number) {
  if (!one(ctx.db, 'SELECT 1 FROM users WHERE id = ?', BOT_ID))
    run(ctx.db, "INSERT INTO users (id, username, username_locked, is_bot, elo, placements, created_at) VALUES (?, 'ScoutBot', 1, 1, ?, 5, ?)", BOT_ID, elo, ctx.now());
  else run(ctx.db, 'UPDATE users SET elo = ? WHERE id = ?', elo, BOT_ID);
  return BOT_ID;
}

export function matchmake(ctx: Ctx, userId: string, join: boolean) {
  return tx(ctx.db, () => {
    const me = getUser(ctx, userId);
    let q = one(ctx.db, 'SELECT * FROM queue WHERE user_id = ?', userId);
    if (q?.match_id) {
      run(ctx.db, 'DELETE FROM queue WHERE user_id = ?', userId);
      return { status: 'matched' as const, matchId: q.match_id as string };
    }
    if (!q) {
      if (!join) return { status: 'idle' as const, matchId: null };
      const active = one(ctx.db, "SELECT m.id FROM matches m JOIN match_players mp ON mp.match_id = m.id WHERE mp.user_id = ? AND m.status = 'active' AND m.mode = 'ranked' AND m.deadline > ?", userId, ctx.now());
      if (active) return { status: 'matched' as const, matchId: active.id as string };
      run(ctx.db, 'INSERT INTO queue (user_id, elo, joined_at) VALUES (?,?,?)', userId, me.elo, ctx.now());
      q = one(ctx.db, 'SELECT * FROM queue WHERE user_id = ?', userId)!;
    }
    const waited = (ctx.now() - q.joined_at) / 1000;
    const others = all(ctx.db, 'SELECT * FROM queue WHERE user_id != ? AND match_id IS NULL ORDER BY ABS(elo - ?) LIMIT 5', userId, me.elo);
    for (const o of others) {
      const window = 100 + 10 * Math.max(waited, (ctx.now() - o.joined_at) / 1000);
      if (Math.abs(o.elo - me.elo) <= window) {
        const matchId = createMatch(ctx, 'ranked', [userId, o.user_id]);
        run(ctx.db, 'UPDATE queue SET match_id = ? WHERE user_id = ?', matchId, o.user_id);
        run(ctx.db, 'DELETE FROM queue WHERE user_id = ?', userId);
        return { status: 'matched' as const, matchId };
      }
    }
    if (ctx.cfg.matchBots && waited >= 15) {
      const bot = ensureBot(ctx, me.elo + Math.round(Math.random() * 80 - 40));
      const matchId = createMatch(ctx, 'ranked', [userId, bot]);
      run(ctx.db, 'DELETE FROM queue WHERE user_id = ?', userId);
      return { status: 'matched' as const, matchId };
    }
    return { status: 'searching' as const, matchId: null, waitedSeconds: Math.floor(waited) };
  });
}

export function leaveQueue(ctx: Ctx, userId: string) {
  run(ctx.db, 'DELETE FROM queue WHERE user_id = ? AND match_id IS NULL', userId);
}
