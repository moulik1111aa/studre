// The progress moment after a level: how far this level moved the treat, what a perfect
// score would have added, and how many perfect levels reach the next milestone.

import { TREAT_SHARE, scoreMult, type Wallet } from './economy.ts';
import { rewardById, costOf } from './rewards.ts';

export const MILESTONES = [0.25, 0.5, 0.75, 1];

export interface Moment {
  rewardId: string;
  /** Treat progress before and after this level (0–1). */
  before: number;
  after: number;
  /** What a perfect score would have added to the treat (0–1), and what this one added. */
  perfectGain: number;
  gain: number;
  /** The next milestone above `after`, and perfect levels needed to pass it. */
  next: number;
  perfectLevels: number;
}

/**
 * Work out the moment for a level that just paid `coins` (already in the wallet), where a
 * perfect score would have paid `perfectCoins`. Null when there is no treat being filled.
 */
export function progressMoment(w: Wallet, coins: number, perfectCoins: number): Moment | null {
  const jar = w.treat;
  const r = jar.rewardId ? rewardById(jar.rewardId) : undefined;
  if (!r || coins <= 0) return null;
  const cost = costOf(r);
  const added = coins * TREAT_SHARE;
  const after = Math.min(1, jar.coins / cost);
  const before = Math.max(0, Math.min(after, (jar.coins - added) / cost));
  const perTreat = Math.max(added, perfectCoins * TREAT_SHARE);
  const next = MILESTONES.find((m) => m > after + 1e-9) ?? 1;
  const perfectLevels = after >= 1 ? 0 : Math.max(1, Math.ceil((next * cost - jar.coins) / perTreat));
  return { rewardId: r.id, before, after, gain: after - before, perfectGain: perTreat / cost, next, perfectLevels };
}

/** Coins a given score would have paid, from what a perfect score pays (same level). */
export function coinsAt(perfectCoins: number, fraction: number): number {
  return Math.max(1, Math.round((perfectCoins * scoreMult(fraction)) / scoreMult(1)));
}
