export type ItemType = 'mail' | 'sms' | 'call';
export type Mode = 'mail' | 'sms' | 'call' | 'marathon' | 'daily' | 'ranked' | 'casual';
export type Call = 'scam' | 'legit';

export type PublicUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  elo: number | null;
  tier: string;
  online: boolean;
  isBot: boolean;
};

export type Prefs = {
  timer: boolean;
  hints: boolean;
  reduceMotion: boolean;
  sound: boolean;
  music: number;
  sfx: number;
  notifyFriends: boolean;
  notifyDaily: boolean;
  notifyRanked: boolean;
  online: boolean;
  theme: 'system' | 'light' | 'dark';
};

export type Badge = { id: string; name: string; icon: string; goal: string; progress: number; target: number; earned: boolean };

export type Stats = {
  elo: number | null;
  tier: string;
  placements: number;
  placementsNeeded: number;
  nextTier: { name: string; pointsAway: number } | null;
  streak: number;
  bestStreak: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  accuracy: number | null;
  badges: Badge[];
  playedToday: boolean;
};

export type Me = PublicUser & {
  email: string | null;
  emailVerified: boolean;
  usernameLocked: boolean;
  hasPassword: boolean;
  linked: { google: boolean; apple: boolean };
  prefs: Prefs;
  createdAt: number;
  stats?: Stats;
};

export type Round = {
  id: string;
  type: ItemType;
  from: string;
  time: string;
  addr?: string;
  subject?: string;
  body?: string;
  linkLabel?: string;
  url?: string;
  number?: string;
  lines?: Array<{ who: 'caller' | 'you'; text: string }>;
  reasons: string[];
  answer: null | { call: Call | null; reason: string | null; points?: number; scam?: boolean; why?: string[]; explain?: string };
};

export type Game = {
  id: string;
  mode: Mode;
  matchId: string | null;
  total: number | null;
  answered: number;
  current: number | null;
  items: Round[];
  score: number | null;
  strikes: number;
  deadline: number | null;
  startedAt: number;
  finished: boolean;
  resultsHidden: boolean;
};

export type AnswerResult = {
  locked: true;
  finished: boolean;
  next: Omit<Round, 'answer'> | null;
  points?: number;
  correctCall?: boolean;
  correctReason?: boolean;
  scam?: boolean;
  why?: string[];
  explain?: string;
  strikes?: number;
  score?: number;
};

export type MatchPlayer = {
  user: PublicUser;
  isMe: boolean;
  gameId?: string;
  answered: number;
  finished: boolean;
  wantsRematch: boolean;
  eloBefore: number;
  score?: number;
  outcome?: 'win' | 'loss' | 'draw';
  eloDelta?: number;
  eloAfter?: number | null;
};

export type Match = {
  id: string;
  mode: 'ranked' | 'casual';
  status: 'active' | 'done';
  deadline: number;
  total: number;
  serverNow: number;
  rematchMatchId: string | null;
  players: MatchPlayer[];
  timeUp: boolean;
};

export type Results = {
  game: Game;
  stats: null | {
    score: number;
    max: number | null;
    rightCalls: number;
    rightReasons: number;
    answered: number;
    avgSeconds: number;
    bestRun: number;
    rounds: number;
    timedOut: boolean;
  };
  match: Match | null;
};

export type RecentGame = {
  gameId: string;
  matchId: string | null;
  mode: Mode;
  score: number;
  finishedAt: number;
  opponent: PublicUser | null;
  outcome: 'win' | 'loss' | 'draw' | null;
  eloDelta: number | null;
};

export type Home = {
  me: Me;
  stats: Stats;
  daily: { title: string; bestScore: number | null; done: boolean; answered: number; resetsAt: number };
  recent: RecentGame[];
  friendsOnline: PublicUser[];
  friendCount: number;
  unread: number;
  season: { name: string; endsAt: number };
};

export type Relation = 'none' | 'friends' | 'incoming' | 'outgoing';
export type Notification = { id: number; kind: string; text: string; data: Record<string, any>; read: boolean; createdAt: number };
export type Challenge = { id: string; type: 'ranked' | 'casual'; status: string; matchId: string | null; incoming: boolean; from: PublicUser; to: PublicUser; createdAt: number };
export type LeaderRow = { rank: number | null; user: PublicUser; points: number; wins: number; tier: string; isMe: boolean };
