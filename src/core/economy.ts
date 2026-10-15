// Coins, the two jars, melting on missed days and the daily time limit (spec §4).
// Pure functions over a child's wallet; the app saves the result.

import { costOf, jarOf, rewardById } from './rewards.ts';

export const COINS = {
  level: 10,
  /** Bonus by stars: 1★ +1, 2★ +3, 3★ +5. */
  starBonus: [0, 1, 3, 5] as const,
  review: 15,
  boss: 50,
  faceoffWin: 5,
};
export const TREAT_SHARE = 0.8;
export const MELT = { treat: 0.05, goal: 0.02 };

export type JarStatus = 'empty' | 'filling' | 'waiting';

export interface JarState {
  rewardId: string | null;
  /** Coins in the jar (fractional; displayed rounded down). */
  coins: number;
  /** Reward reached its cost and is waiting for a parent to mark it given. */
  waiting: boolean;
  /** Optional photo id of what was agreed. */
  photo?: string;
}

export interface Wallet {
  treat: JarState;
  goal: JarState;
  /** Total coins ever earned (for stats). */
  lifetime: number;
  /** Local day of the last counted play (YYYY-MM-DD) and the day melting was last applied. */
  lastPlayDay: string | null;
  meltCheckedDay: string | null;
  /** Seconds of counted play today, and which day that is. */
  todaySeconds: number;
  todayDay: string | null;
  /** Rewards given so far. */
  earned: { rewardId: string; day: string; photo?: string }[];
}

export const freshWallet = (): Wallet => ({
  treat: { rewardId: null, coins: 0, waiting: false },
  goal: { rewardId: null, coins: 0, waiting: false },
  lifetime: 0,
  lastPlayDay: null,
  meltCheckedDay: null,
  todaySeconds: 0,
  todayDay: null,
  earned: [],
});

export function coinsForLevel(kind: 'skill' | 'review' | 'boss', stars: 0 | 1 | 2 | 3, replay: boolean): number {
  if (stars === 0) return 0;
  const base = kind === 'boss' ? COINS.boss : kind === 'review' ? COINS.review : COINS.level + COINS.starBonus[stars];
  return replay ? Math.floor(base / 2) : base;
}

/** Days from a to b (YYYY-MM-DD), b − a. */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

export function dayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Roll the daily clock over if the day changed. */
export function rollDay(w: Wallet, today: string): void {
  if (w.todayDay !== today) {
    w.todayDay = today;
    w.todaySeconds = 0;
  }
}

/** Seconds left within today's limit. */
export function secondsLeft(w: Wallet, today: string, limitMinutes: number): number {
  rollDay(w, today);
  return Math.max(0, limitMinutes * 60 - w.todaySeconds);
}

/** Count active play time; returns whether that time was still inside the limit. */
export function addPlayTime(w: Wallet, today: string, seconds: number, limitMinutes: number): boolean {
  rollDay(w, today);
  const inside = w.todaySeconds < limitMinutes * 60;
  w.todaySeconds += seconds;
  if (inside) w.lastPlayDay = today;
  return inside;
}

/** Add coins to the jars (80% treat, 20% goal). A jar that reaches its cost starts waiting. */
export function addCoins(w: Wallet, coins: number): { unlocked: ('treat' | 'goal')[] } {
  const unlocked: ('treat' | 'goal')[] = [];
  if (coins <= 0) return { unlocked };
  w.lifetime += coins;
  const share: [JarState, number, 'treat' | 'goal'][] = [
    [w.treat, coins * TREAT_SHARE, 'treat'],
    [w.goal, coins * (1 - TREAT_SHARE), 'goal'],
  ];
  for (const [jar, amount, name] of share) {
    jar.coins = Math.round((jar.coins + amount) * 100) / 100;
    const r = jar.rewardId ? rewardById(jar.rewardId) : undefined;
    if (r && !jar.waiting && jar.coins >= costOf(r)) {
      jar.waiting = true;
      unlocked.push(name);
    }
  }
  return { unlocked };
}

/** Choose (lock in) a reward for its jar. Refused while that jar already has a reward. */
export function chooseReward(w: Wallet, rewardId: string, photo?: string): boolean {
  const r = rewardById(rewardId);
  if (!r) return false;
  const jar = jarOf(r) === 'treat' ? w.treat : w.goal;
  if (jar.rewardId) return false;
  jar.rewardId = rewardId;
  jar.photo = photo;
  if (jar.coins >= costOf(r)) jar.waiting = true;
  return true;
}

/** A parent marks a waiting reward as given: it is recorded and the jar keeps any surplus. */
export function markGiven(w: Wallet, jarName: 'treat' | 'goal', today: string): boolean {
  const jar = w[jarName];
  const r = jar.rewardId ? rewardById(jar.rewardId) : undefined;
  if (!r || !jar.waiting) return false;
  w.earned.push({ rewardId: r.id, day: today, photo: jar.photo });
  jar.coins = Math.max(0, Math.round((jar.coins - costOf(r)) * 100) / 100);
  jar.rewardId = null;
  jar.photo = undefined;
  jar.waiting = false;
  return true;
}

/**
 * Melting: for each full day without counted play (since the last play), the treat jar
 * loses 5% of its reward's cost and the goal jar 2% — never below zero, never while a
 * reward is waiting, never during holiday mode. Returns how much each jar lost.
 */
export function applyMelt(w: Wallet, today: string, holiday: boolean): { treat: number; goal: number; days: number } {
  const lost = { treat: 0, goal: 0, days: 0 };
  // meltCheckedDay = the last day already accounted for (always "yesterday" after a check).
  const anchors = [w.meltCheckedDay, w.lastPlayDay].filter((d): d is string => !!d).sort();
  const anchor = anchors[anchors.length - 1];
  w.meltCheckedDay = addDays(today, -1);
  if (!anchor || holiday) return lost;
  const missed = Math.max(0, dayDiff(anchor, today) - 1);
  if (missed === 0) return lost;
  lost.days = missed;
  for (const [name, rate] of [['treat', MELT.treat], ['goal', MELT.goal]] as const) {
    const jar = w[name];
    const r = jar.rewardId ? rewardById(jar.rewardId) : undefined;
    if (!r || jar.waiting) continue;
    const before = jar.coins;
    jar.coins = Math.max(0, Math.round((jar.coins - missed * rate * costOf(r)) * 100) / 100);
    lost[name] = Math.round((before - jar.coins) * 100) / 100;
  }
  return lost;
}

export function addDays(day: string, n: number): string {
  const d = new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000);
  return d.toISOString().slice(0, 10);
}

/** Progress 0..1 of a jar toward its reward. */
export function jarProgress(jar: JarState): number {
  const r = jar.rewardId ? rewardById(jar.rewardId) : undefined;
  if (!r) return 0;
  return Math.min(1, jar.coins / costOf(r));
}
