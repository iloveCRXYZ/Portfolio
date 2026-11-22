import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';
import { ITEM_BY_ID } from '../src/content.ts';

let clock = Date.UTC(2026, 10, 22, 12, 0, 0);
const now = () => clock;

async function setup(extra: Record<string, unknown> = {}) {
  const { app } = await buildApp({ config: { dbPath: ':memory:', matchBots: false, devEmailLinks: true, ...extra }, now });
  const call = async (method: string, url: string, token?: string, body?: unknown) => {
    const res = await app.inject({ method: method as any, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body as any });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
  };
  const signup = async (email: string, username: string) => {
    const r = await call('POST', '/auth/signup', undefined, { email, password: 'correct horse' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const u = await call('POST', '/auth/username', r.body.token, { username });
    assert.equal(u.status, 200, JSON.stringify(u.body));
    return { token: r.body.token as string, id: r.body.user.id as string };
  };
  return { app, call, signup };
}

const rightAnswer = (itemId: string) => {
  const it = ITEM_BY_ID.get(itemId)!;
  return { call: it.scam ? 'scam' : 'legit', reason: it.why[0] };
};
const wrongAnswer = (itemId: string) => {
  const it = ITEM_BY_ID.get(itemId)!;
  return { call: it.scam ? 'legit' : 'scam', reason: 'Nothing suspicious' };
};

test('sign up, log in, username rules, email links', async () => {
  const { call, signup } = await setup();
  const a = await signup('ana@example.com', 'NightOwl');
  assert.equal((await call('POST', '/auth/signup', undefined, { email: 'ana@example.com', password: 'whatever1' })).body.error, 'email_taken');
  assert.equal((await call('POST', '/auth/login', undefined, { email: 'ana@example.com', password: 'nope-nope' })).status, 401);
  const ok = await call('POST', '/auth/login', undefined, { email: 'ANA@example.com', password: 'correct horse' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.username, 'NightOwl');
  assert.equal((await call('POST', '/auth/username', a.token, { username: 'Another' })).body.error, 'username_locked');
  assert.equal((await call('GET', '/auth/username-available?username=nightowl')).body.available, false);
  const short = await call('POST', '/auth/signup', undefined, { email: 'x@y.co', password: 'short' });
  assert.equal(short.status, 400);
  assert.equal(short.body.message, 'Use at least 8 characters.');
  // reset password with the dev link
  const f = await call('POST', '/auth/forgot-password', undefined, { email: 'ana@example.com' });
  const r = await call('POST', '/auth/reset-password', undefined, { token: f.body.devToken, password: 'brand new pass' });
  assert.equal(r.status, 200);
  assert.equal((await call('POST', '/auth/login', undefined, { email: 'ana@example.com', password: 'brand new pass' })).status, 200);
  assert.equal((await call('GET', '/me')).status, 401);
  assert.equal((await call('POST', '/auth/google', undefined, { idToken: 'x'.repeat(20) })).status, 501);
});

test('practice game: scoring, reveal, order, results, leaderboard, badge', async () => {
  const { call, signup } = await setup();
  const a = await signup('p@example.com', 'Player1');
  const g = (await call('POST', '/games', a.token, { mode: 'mail' })).body;
  assert.equal(g.total, 10);
  assert.equal(g.items[0].scam, undefined, 'answers must not leak');
  assert.equal(g.items[0].why, undefined);
  const out = await call('POST', `/games/${g.id}/answers`, a.token, { index: 3, call: 'scam', reason: 'x' });
  assert.equal(out.body.error, 'out_of_order');
  for (let i = 0; i < 10; i++) {
    const r = await call('POST', `/games/${g.id}/answers`, a.token, { index: i, ...rightAnswer(g.items[i].id) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.points, 100);
    assert.ok(r.body.explain);
  }
  const res = (await call('GET', `/games/${g.id}/results`, a.token)).body;
  assert.equal(res.stats.score, 1000);
  assert.equal(res.game.finished, true);
  const lb = (await call('GET', '/leaderboard?period=daily', a.token)).body;
  assert.equal(lb.rows[0].user.username, 'Player1');
  assert.equal(lb.rows[0].points, 1000);
  const me = (await call('GET', '/me', a.token)).body;
  assert.equal(me.stats.badges.find((b: any) => b.id === 'perfect_10').earned, true);
  assert.equal(me.stats.streak, 1);
  // half points: right call, wrong reason
  const g2 = (await call('POST', '/games', a.token, { mode: 'sms' })).body;
  const it = ITEM_BY_ID.get(g2.items[0].id)!;
  const half = await call('POST', `/games/${g2.id}/answers`, a.token, { index: 0, call: it.scam ? 'scam' : 'legit', reason: it.scam ? 'Nothing suspicious' : 'Unknown number' });
  assert.equal(half.body.points, 60);
});

test('marathon ends after 3 wrong in a row and a right answer resets strikes', async () => {
  const { call, signup } = await setup();
  const a = await signup('m@example.com', 'Runner');
  let g = (await call('POST', '/games', a.token, { mode: 'marathon' })).body;
  const ans = async (i: number, right: boolean) => {
    const view = (await call('GET', `/games/${g.id}`, a.token)).body;
    const id = view.items[i].id;
    return (await call('POST', `/games/${g.id}/answers`, a.token, { index: i, ...(right ? rightAnswer(id) : wrongAnswer(id)) })).body;
  };
  assert.equal((await ans(0, false)).strikes, 1);
  assert.equal((await ans(1, false)).strikes, 2);
  assert.equal((await ans(2, true)).strikes, 0);
  await ans(3, false);
  await ans(4, false);
  const last = await ans(5, false);
  assert.equal(last.finished, true);
  g = (await call('GET', `/games/${g.id}`, a.token)).body;
  assert.equal(g.finished, true);
});

test('ranked: matchmaking, hidden results, ELO, draw and rematch', async () => {
  const { call, signup } = await setup();
  const a = await signup('a@example.com', 'Alpha');
  const b = await signup('b@example.com', 'Bravo');
  assert.equal((await call('POST', '/matchmaking', a.token)).body.status, 'searching');
  const mb = (await call('POST', '/matchmaking', b.token)).body;
  assert.equal(mb.status, 'matched');
  const ma = (await call('GET', '/matchmaking', a.token)).body;
  assert.equal(ma.matchId, mb.matchId);
  const match = (await call('GET', `/matches/${ma.matchId}`, a.token)).body;
  assert.equal(match.total, 15);
  const gA = match.players.find((p: any) => p.isMe).gameId;
  const gB = (await call('GET', `/matches/${ma.matchId}`, b.token)).body.players.find((p: any) => p.isMe).gameId;
  const viewA = (await call('GET', `/games/${gA}`, a.token)).body;
  for (let i = 0; i < 15; i++) {
    const r = await call('POST', `/games/${gA}/answers`, a.token, { index: i, ...rightAnswer(viewA.items[i].id) });
    assert.equal(r.body.points, undefined, 'ranked must not reveal correctness');
    assert.equal(r.body.scam, undefined);
  }
  const mid = (await call('GET', `/matches/${ma.matchId}`, b.token)).body;
  assert.equal(mid.status, 'active');
  assert.equal(mid.players.find((p: any) => !p.isMe).answered, 15, 'opponent progress is visible');
  assert.equal(mid.players.find((p: any) => !p.isMe).score, undefined, 'opponent score is hidden');
  const viewB = (await call('GET', `/games/${gB}`, b.token)).body;
  for (let i = 0; i < 15; i++) await call('POST', `/games/${gB}/answers`, b.token, { index: i, ...(i < 10 ? rightAnswer(viewB.items[i].id) : wrongAnswer(viewB.items[i].id)) });
  const done = (await call('GET', `/matches/${ma.matchId}`, a.token)).body;
  assert.equal(done.status, 'done');
  const meA = done.players.find((p: any) => p.isMe);
  assert.equal(meA.outcome, 'win');
  assert.equal(meA.score, 1500);
  assert.ok(meA.eloDelta > 0);
  const resB = (await call('GET', `/games/${gB}/results`, b.token)).body;
  assert.equal(resB.stats.score, 1000);
  assert.ok(resB.game.items[0].answer.explain, 'revealed after the match');
  const hist = (await call('GET', '/me/elo-history', a.token)).body;
  assert.equal(hist.points.length, 1);
  assert.equal(hist.current, null, 'still in placements');

  // A draw: both score the same. Then a rematch.
  await call('POST', '/matchmaking', a.token);
  const m2 = (await call('POST', '/matchmaking', b.token)).body.matchId;
  for (const [tok] of [[a.token], [b.token]]) {
    const gid = (await call('GET', `/matches/${m2}`, tok)).body.players.find((p: any) => p.isMe).gameId;
    const v = (await call('GET', `/games/${gid}`, tok)).body;
    for (let i = 0; i < 15; i++) await call('POST', `/games/${gid}/answers`, tok, { index: i, ...rightAnswer(v.items[i].id) });
  }
  const drawn = (await call('GET', `/matches/${m2}`, a.token)).body;
  assert.equal(drawn.players[0].outcome, 'draw');
  assert.equal(drawn.players[0].eloDelta, 0);
  assert.equal((await call('POST', `/matches/${m2}/rematch`, a.token)).body.status, 'waiting');
  const re = (await call('POST', `/matches/${m2}/rematch`, b.token)).body;
  assert.equal(re.status, 'matched');
  assert.equal((await call('GET', `/matches/${m2}`, a.token)).body.rematchMatchId, re.matchId);
});

test('ranked 20-minute clock: late answers are refused and the match closes', async () => {
  const { call, signup } = await setup();
  const a = await signup('c@example.com', 'Clock1');
  const b = await signup('d@example.com', 'Clock2');
  await call('POST', '/matchmaking', a.token);
  const mid = (await call('POST', '/matchmaking', b.token)).body.matchId;
  const gA = (await call('GET', `/matches/${mid}`, a.token)).body.players.find((p: any) => p.isMe).gameId;
  const v = (await call('GET', `/games/${gA}`, a.token)).body;
  await call('POST', `/games/${gA}/answers`, a.token, { index: 0, ...rightAnswer(v.items[0].id) });
  clock += 20 * 60 * 1000 + 1;
  const late = await call('POST', `/games/${gA}/answers`, a.token, { index: 1, ...rightAnswer(v.items[1].id) });
  assert.equal(late.body.error, 'game_over');
  const m = (await call('GET', `/matches/${mid}`, b.token)).body;
  assert.equal(m.status, 'done');
  assert.equal(m.timeUp, true);
  assert.equal(m.players.find((p: any) => !p.isMe).outcome, 'win');
});

test('friends, challenges, notifications, search, bots, avatar', async () => {
  const { call, signup, app } = await setup({ matchBots: true });
  const a = await signup('e@example.com', 'Echo');
  const b = await signup('f@example.com', 'Foxtrot');
  const found = (await call('GET', '/users/search?q=fox', a.token)).body;
  assert.equal(found[0].username, 'Foxtrot');
  assert.equal((await call('GET', '/users/search?q=zzz', a.token)).body.length, 0);
  assert.equal((await call('POST', '/challenges', a.token, { userId: b.id, type: 'casual' })).status, 403);
  await call('POST', '/friends/requests', a.token, { userId: b.id });
  const notifs = (await call('GET', '/notifications', b.token)).body;
  assert.equal(notifs[0].kind, 'friend_request');
  assert.equal((await call('GET', '/friends', b.token)).body.incoming.length, 1);
  await call('POST', `/friends/requests/${a.id}/accept`, b.token);
  assert.equal((await call('GET', '/friends', a.token)).body.friends[0].username, 'Foxtrot');
  const ch = (await call('POST', '/challenges', a.token, { userId: b.id, type: 'casual' })).body;
  const acc = (await call('POST', `/challenges/${ch.id}/accept`, b.token)).body;
  assert.equal(acc.status, 'accepted');
  const casual = (await call('GET', `/matches/${acc.matchId}`, a.token)).body;
  assert.equal(casual.mode, 'casual');
  assert.equal(casual.total, 10);
  const lb = (await call('GET', '/leaderboard?scope=friends&period=lifetime', a.token)).body;
  assert.equal(lb.friendCount, 1);

  // Bot fallback after 15 seconds alone in the queue
  const c = await signup('g@example.com', 'Golf');
  assert.equal((await call('POST', '/matchmaking', c.token)).body.status, 'searching');
  clock += 16_000;
  const bm = (await call('GET', '/matchmaking', c.token)).body;
  assert.equal(bm.status, 'matched');
  const gid = (await call('GET', `/matches/${bm.matchId}`, c.token)).body.players.find((p: any) => p.isMe).gameId;
  const fin = (await call('POST', `/games/${gid}/finish`, c.token)).body;
  assert.equal(fin.match.status, 'done');
  assert.ok(fin.match.players.find((p: any) => !p.isMe).user.isBot);

  // Avatar
  const png = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64');
  const me = (await call('PUT', '/me/avatar', a.token, { image: png })).body;
  assert.ok(me.avatarUrl);
  const img = await app.inject({ method: 'GET', url: new URL(me.avatarUrl).pathname });
  assert.equal(img.statusCode, 200);
  assert.equal(img.headers['content-type'], 'image/png');
  assert.equal((await call('PUT', '/me/avatar', a.token, { image: 'data:text/html;base64,AAAA' })).status, 400);
  assert.equal((await call('DELETE', '/me', a.token, { confirm: 'nope' })).status, 400);
  assert.equal((await call('DELETE', '/me', a.token, { confirm: 'DELETE' })).status, 200);
  assert.equal((await call('GET', '/me', a.token)).status, 401);
});
