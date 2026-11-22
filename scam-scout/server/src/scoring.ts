import type { Item } from './content.ts';

export const POINTS_CALL = 60;
export const POINTS_REASON = 40;
export const RANKED_SECONDS = 20 * 60;
export const DAILY_SECONDS = 3 * 60;
export const PLACEMENT_MATCHES = 5;
export const MARATHON_STRIKES = 3;

export type Call = 'scam' | 'legit';

/** Right call +60. Right reason +40, only when the call is right. */
export function scoreAnswer(item: Item, call: Call | null, reason: string | null): number {
  if (!call) return 0;
  const callOk = (call === 'scam') === item.scam;
  if (!callOk) return 0;
  return POINTS_CALL + (reason && item.why.includes(reason) ? POINTS_REASON : 0);
}

/** Elo with a bigger K during placements. Draws move nobody: a rematch settles them. */
export function eloDelta(me: number, opp: number, result: 'win' | 'loss' | 'draw', placement: boolean): number {
  if (result === 'draw') return 0;
  const k = placement ? 48 : 32;
  const expected = 1 / (1 + 10 ** ((opp - me) / 400));
  const score = result === 'win' ? 1 : 0;
  return Math.round(k * (score - expected));
}

// [lower bound, name, width]. Each tier splits into III (lowest), II and I.
const TIERS: Array<[number, string, number]> = [
  [1900, 'Diamond', 0],
  [1600, 'Platinum', 300],
  [1400, 'Gold', 200],
  [1200, 'Silver', 200],
  [1000, 'Bronze', 200],
];

/** Tier name like "Gold II", or "Unranked" until placements are done. */
export function tierFor(elo: number, placements: number): string {
  if (placements < PLACEMENT_MATCHES) return 'Unranked';
  const t = TIERS.find(([lo]) => elo >= lo) ?? TIERS[TIERS.length - 1];
  if (!t[2]) return t[1];
  const div = Math.max(0, Math.min(2, Math.floor(((elo - t[0]) / t[2]) * 3)));
  return `${t[1]} ${['III', 'II', 'I'][div]}`;
}

/** Points needed to reach the next tier, or null at the top. */
export function nextTier(elo: number): { name: string; at: number } | null {
  const above = [...TIERS].reverse().find(([lo]) => lo > elo);
  return above ? { name: `${above[1]}${above[2] ? ' III' : ''}`, at: above[0] } : null;
}

/** Consecutive UTC days with at least one finished game, ending today or yesterday. */
export function streaks(dayKeys: string[], today = new Date()): { current: number; best: number } {
  const days = [...new Set(dayKeys)].sort();
  if (!days.length) return { current: 0, best: 0 };
  const toN = (k: string) => Math.floor(Date.parse(k + 'T00:00:00Z') / 86400000);
  const nums = days.map(toN);
  let best = 1;
  let runLen = 1;
  for (let i = 1; i < nums.length; i++) {
    runLen = nums[i] === nums[i - 1] + 1 ? runLen + 1 : 1;
    best = Math.max(best, runLen);
  }
  const t = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 86400000);
  const last = nums[nums.length - 1];
  let current = 0;
  if (last === t || last === t - 1) {
    current = 1;
    for (let i = nums.length - 1; i > 0 && nums[i] === nums[i - 1] + 1; i--) current++;
  }
  return { current, best };
}

export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
