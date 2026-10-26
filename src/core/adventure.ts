// Adventure mode (a parent switches it on per child): daily quests, a weekly challenge, streak
// flames, badges, and XP with player levels and ranks, on top of the same levels. Quest
// progress and XP are worked out from what is already saved (the play log, stars, answers),
// so undoing play undoes them too. Finishing all three daily quests, or the weekly challenge,
// opens a chest of bonus coins for the real reward jar.

import { addDays, dayDiff } from './economy.ts';
import { isMastered, isDone, type Level, type Progress } from './path.ts';
import { streaks, pathProgress, type PlayEntry, type Tally } from './stats.ts';

export interface AdventureState {
  on: boolean;
  /** Chests opened → when (ms): "d:2026-10-25" (daily) and "w:2026-10-19" (weekly, by its Monday). */
  claimed: Record<string, number>;
  /** Badge id → when it was earned (ms). */
  badges: Record<string, number>;
  /** Quest ids already celebrated today (so each is cheered once). */
  cheered: Record<string, string[]>;
  /** The player level last celebrated, and the XP last shown (for "+120 XP" after a level). */
  seenLevel?: number;
  xpSeen?: number;
}

export const freshAdventure = (): AdventureState => ({ on: true, claimed: {}, badges: {}, cheered: {} });

/** What the quests and badges look at. */
export interface AdvChild {
  id: string;
  age: number;
  progress: Progress;
  stats: { answered: number; correct: number; secondsByDay: Record<string, number> };
  wallet: { lifetime: number; earned: unknown[] };
  bossesBeaten: string[];
  log?: PlayEntry[];
  tally?: Tally;
  adventure?: AdventureState;
}

// ── quests ─────────────────────────────────────────────────────────────────
export interface Quest {
  id: string;
  icon: string;
  text: string;
  target: number;
  /** Progress so far today (or this week). */
  value: (c: AdvChild, days: string[]) => number;
}

const inDays = (c: AdvChild, days: string[]) => (c.log ?? []).filter((e) => days.includes(e.d));
const rightIn = (es: PlayEntry[]) => es.reduce((a, e) => a + Object.values(e.a).reduce((x, r) => x + r[1], 0), 0);
const minutesIn = (c: AdvChild, days: string[]) => Math.floor(days.reduce((a, d) => a + (c.stats.secondsByDay[d] ?? 0), 0) / 60);

function questPool(young: boolean, limit: number): Quest[] {
  const n = (big: number, small: number) => (young ? small : big);
  return [
    { id: 'levels', icon: '🗺️', text: `Finish ${n(3, 2)} levels`, target: n(3, 2), value: (c, d) => inDays(c, d).length },
    { id: 'perfect', icon: '💯', text: `Get ${n(2, 1)} perfect score${n(2, 1) > 1 ? 's' : ''}`, target: n(2, 1), value: (c, d) => inDays(c, d).filter((e) => e.of > 0 && e.sc >= e.of).length },
    { id: 'right', icon: '✅', text: `Get ${n(30, 15)} answers right`, target: n(30, 15), value: (c, d) => rightIn(inDays(c, d)) },
    { id: 'minutes', icon: '⏱️', text: `Play for ${Math.min(n(15, 10), Math.max(5, limit - 5))} minutes`, target: Math.min(n(15, 10), Math.max(5, limit - 5)), value: (c, d) => minutesIn(c, d) },
    { id: 'stars', icon: '⭐', text: `Win 3 stars in ${n(2, 1)} level${n(2, 1) > 1 ? 's' : ''}`, target: n(2, 1), value: (c, d) => inDays(c, d).filter((e) => e.s >= 3).length },
    { id: 'good', icon: '🎯', text: `Score 8 or more in ${n(3, 2)} levels`, target: n(3, 2), value: (c, d) => inDays(c, d).filter((e) => e.of > 0 && e.sc / e.of >= 0.8).length },
  ];
}

/** A small number from text, the same every time (to pick the day's quests). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Today's three quests: the same all day, different tomorrow. */
export function dailyQuests(c: AdvChild, day: string, limitMinutes: number): Quest[] {
  const pool = questPool(c.age <= 6, limitMinutes);
  const out: Quest[] = [];
  let h = hash(`${c.id}|${day}`);
  while (out.length < 3) {
    const q = pool[h % pool.length];
    if (!out.includes(q)) out.push(q);
    h = hash(String(h));
  }
  return out;
}

/** Monday of the week that `day` is in. */
export function weekStart(day: string): string {
  const dow = (new Date(`${day}T12:00:00`).getDay() + 6) % 7;
  return addDays(day, -dow);
}
export const weekDays = (day: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i));

/** This week's challenge (Monday to Sunday). */
export function weeklyChallenge(c: AdvChild, day: string): Quest {
  const young = c.age <= 6;
  const list: Quest[] = [
    { id: 'w-days', icon: '📅', text: `Play on ${young ? 4 : 5} different days`, target: young ? 4 : 5, value: (k, d) => d.filter((x) => (k.stats.secondsByDay[x] ?? 0) > 0).length },
    { id: 'w-levels', icon: '🗺️', text: `Finish ${young ? 10 : 15} levels`, target: young ? 10 : 15, value: (k, d) => inDays(k, d).length },
    { id: 'w-right', icon: '✅', text: `Get ${young ? 100 : 200} answers right`, target: young ? 100 : 200, value: (k, d) => rightIn(inDays(k, d)) },
    { id: 'w-perfect', icon: '💯', text: `Get ${young ? 5 : 8} perfect scores`, target: young ? 5 : 8, value: (k, d) => inDays(k, d).filter((e) => e.of > 0 && e.sc >= e.of).length },
  ];
  return list[hash(`${c.id}|${weekStart(day)}`) % list.length];
}

export interface QuestStatus {
  quest: Quest;
  value: number;
  done: boolean;
}
export const status = (c: AdvChild, q: Quest, days: string[]): QuestStatus => {
  const value = Math.min(q.target, q.value(c, days));
  return { quest: q, value, done: value >= q.target };
};

/** Coins in a chest: one perfect level's worth for the daily chest, three for the weekly. */
export const chestCoins = (perfectLevelCoins: number, kind: 'daily' | 'weekly'): number => Math.max(5, Math.round(perfectLevelCoins * (kind === 'daily' ? 1 : 3)));

// ── XP, player levels and ranks ───────────────────────────────────────────
/** XP for each thing (shown to children on the ranks sheet). */
export const XP = { right: 10, star: 20, boss: 150, daily: 100, weekly: 300, badge: [0, 25, 50, 100] } as const;
export const MAX_LEVEL = 99;

/** All XP earned, worked out from saved progress (so undo and combining phones just work). */
export function xpOf(c: AdvChild): number {
  const stars = Object.values(c.progress.levels).reduce((n, l) => n + l.stars, 0);
  const a = c.adventure;
  let chests = 0;
  for (const k of Object.keys(a?.claimed ?? {})) chests += k.startsWith('w:') ? XP.weekly : k.startsWith('d:') ? XP.daily : 0;
  // Level badges give no XP (they come from XP).
  const badges = BADGES.reduce((n, b) => n + (a?.badges[b.id] && !b.id.startsWith('plevel-') ? XP.badge[b.tier] : 0), 0);
  return c.stats.correct * XP.right + stars * XP.star + c.bossesBeaten.length * XP.boss + chests + badges;
}

/** Total XP needed to reach level L: each level needs 50 more than the one before (200, 250, 300…). */
export const xpToReach = (L: number): number => 150 * (L - 1) + 25 * (L - 1) * L;

export interface LevelInfo {
  level: number;
  /** XP into this level, and XP this level needs in all (0 at the top level). */
  into: number;
  need: number;
  xp: number;
}
export function levelOf(xp: number): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpToReach(level + 1)) level++;
  const into = xp - xpToReach(level);
  const need = level >= MAX_LEVEL ? 0 : xpToReach(level + 1) - xpToReach(level);
  return { level, into, need, xp };
}

export interface Rank {
  from: number;
  name: string;
  short: string;
  icon: string;
}
export const RANKS: Rank[] = [
  { from: 1, name: 'Rookie', short: 'Rookie', icon: '🐣' },
  { from: 5, name: 'Number Scout', short: 'Scout', icon: '🧭' },
  { from: 10, name: 'Sum Ranger', short: 'Ranger', icon: '🏹' },
  { from: 15, name: 'Times Knight', short: 'Knight', icon: '🛡️' },
  { from: 20, name: 'Fraction Pilot', short: 'Pilot', icon: '✈️' },
  { from: 25, name: 'Puzzle Captain', short: 'Captain', icon: '⚓' },
  { from: 30, name: 'Equation Hero', short: 'Hero', icon: '🦸' },
  { from: 35, name: 'Number Ninja', short: 'Ninja', icon: '🥷' },
  { from: 40, name: 'Maths Wizard', short: 'Wizard', icon: '🧙' },
  { from: 45, name: 'Star Sage', short: 'Sage', icon: '🌟' },
  { from: 50, name: 'Galaxy Genius', short: 'Genius', icon: '🪐' },
  { from: 60, name: 'Maths Legend', short: 'Legend', icon: '🏆' },
  { from: 75, name: 'Mythic Mind', short: 'Mythic', icon: '🐉' },
  { from: 90, name: 'Infinity Master', short: 'Master', icon: '💫' },
];
export const rankOf = (level: number): Rank => [...RANKS].reverse().find((r) => level >= r.from)!;
export const nextRank = (level: number): Rank | undefined => RANKS.find((r) => r.from > level);

/** Best run of first-try right answers in any one level (Adventure combo meter). */
const bestCombo = (c: AdvChild) => Math.max(0, ...(c.log ?? []).map((e) => e.cb ?? 0));

// ── badges ─────────────────────────────────────────────────────────────────
export interface BadgeContext {
  c: AdvChild;
  today: string;
  path: Level[];
  /** Skill id → strand, for the strand badges. */
  strandOf: (skillId: string) => string | undefined;
  skillIds: string[];
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  desc: string;
  /** 1 bronze, 2 silver, 3 gold. */
  tier: 1 | 2 | 3;
  target: number;
  value: (x: BadgeContext) => number;
}

const tierOf = (i: number, n: number): 1 | 2 | 3 => (i < n / 3 ? 1 : i < (2 * n) / 3 ? 2 : 3);
function ladder(id: string, icon: string, names: string[], targets: number[], desc: (t: number) => string, value: Badge['value']): Badge[] {
  return targets.map((t, i) => ({ id: `${id}-${t}`, icon, name: names[i], desc: desc(t), tier: tierOf(i, targets.length), target: t, value }));
}

const passedCount = (x: BadgeContext) => Object.values(x.c.progress.levels).filter((l) => l.stars >= 1).length;
const threeStars = (x: BadgeContext) => Object.values(x.c.progress.levels).filter((l) => l.stars >= 3).length;
const daysPlayed = (x: BadgeContext) => Object.values(x.c.stats.secondsByDay).filter((s) => s > 0).length;
const minutes = (x: BadgeContext) => Math.floor(Object.values(x.c.stats.secondsByDay).reduce((a, b) => a + b, 0) / 60);
const mastered = (x: BadgeContext) => x.skillIds.filter((id) => isMastered(x.c.progress, id)).length;
const claims = (x: BadgeContext, prefix: string) => Object.keys(x.c.adventure?.claimed ?? {}).filter((k) => k.startsWith(prefix)).length;
const logOf = (x: BadgeContext) => x.c.log ?? [];
const tierPassed = (x: BadgeContext, tier: number) => x.path.filter((l) => l.kind === 'skill' && l.tier === tier && (x.c.progress.levels[l.id]?.stars ?? 0) >= 1).length;
const STRAND_NAMES: [string, string, string][] = [
  ['number', '🔢', 'Number'],
  ['addsub', '➕', 'Adding'],
  ['muldiv', '✖️', 'Times'],
  ['fdp', '🍕', 'Fraction'],
  ['algebra', '🔣', 'Algebra'],
  ['mental', '🧠', 'Mental maths'],
  ['word', '📖', 'Word problem'],
];

export const BADGES: Badge[] = [
  ...ladder('levels', '🗺️', ['First Steps', 'Explorer', 'Pathfinder', 'Trailblazer', 'Voyager', 'Adventurer', 'Legend of the Map'], [1, 10, 25, 50, 100, 200, 400], (t) => `Pass ${t} level${t > 1 ? 's' : ''}`, passedCount),
  ...ladder('perfect', '💯', ['Bullseye', 'Sharp Shooter', 'Perfectionist', 'Flawless', 'Untouchable'], [1, 5, 25, 50, 100], (t) => `Win 3 stars in ${t} level${t > 1 ? 's' : ''}`, threeStars),
  ...ladder('answers', '✏️', ['Warm Up', 'Busy Brain', 'Question Crusher', 'Answer Machine', 'Maths Marathon', 'Ten Thousand Club'], [100, 500, 1000, 2500, 5000, 10000], (t) => `Answer ${t.toLocaleString('en-IN')} questions`, (x) => x.c.stats.answered),
  ...ladder('streak', '🔥', ['Spark', 'On Fire', 'Blazing', 'Unstoppable', 'Eternal Flame', 'Hundred Days'], [3, 7, 14, 30, 60, 100], (t) => `Play ${t} days in a row`, (x) => streaks(x.c.stats.secondsByDay, x.today).best),
  ...ladder('days', '📅', ['Regular', 'Dedicated', 'Committed', 'Devoted', 'Lifelong Learner'], [5, 20, 50, 100, 200], (t) => `Play on ${t} different days`, daysPlayed),
  ...ladder('time', '⏳', ['First Hour', 'Five Hours', 'Ten Hours', 'Twenty-five Hours', 'Fifty Hours'], [60, 300, 600, 1500, 3000], (t) => `Learn for ${t / 60} hour${t > 60 ? 's' : ''} in all`, minutes),
  ...ladder('bosses', '👑', ['Boss Buster', 'Boss Breaker', 'Boss Hunter', 'Boss Legend', 'Every Boss Beaten'], [1, 3, 6, 10, 14], (t) => `Beat ${t} boss${t > 1 ? 'es' : ''}`, (x) => x.c.bossesBeaten.length),
  ...ladder('mastered', '🎓', ['Skill Master', 'Ten Skills', 'Quarter Century', 'Fifty Skills', 'Century of Skills', 'Grand Master'], [1, 10, 25, 50, 100, 200], (t) => `Master ${t} skill${t > 1 ? 's' : ''} (pass its Master level)`, mastered),
  ...[1, 2, 3, 4, 5, 6, 7].map(
    (s): Badge => ({
      id: `stage-${s}`,
      icon: ['🌼', '🐠', '🌋', '🤖', '🍰', '⚡', '⛰️'][s - 1],
      name: ['Meadow Hero', 'Sea Hero', 'Volcano Hero', 'City Hero', 'Kitchen Hero', 'Storm Hero', 'Mountain Hero'][s - 1],
      desc: `Finish every level of stage ${s}`,
      tier: s <= 2 ? 1 : s <= 5 ? 2 : 3,
      target: 100,
      value: (x) => {
        const st = pathProgress(x.path, x.c.progress).stages.find((r) => r.stage === s);
        if (!st || !st.total) return 0;
        const done = x.path.filter((l) => l.stage === s && isDone(x.c.progress, l)).length;
        return Math.floor((100 * done) / st.total);
      },
    }),
  ),
  ...ladder('rewards', '🎁', ['First Treat', 'Treat Collector', 'Reward Royalty'], [1, 3, 10], (t) => `Earn ${t} real reward${t > 1 ? 's' : ''}`, (x) => x.c.wallet.earned.length),
  ...ladder('coins', '🪙', ['Piggy Bank', 'Coin Keeper', 'Treasure Hoard', 'Dragon’s Gold'], [500, 2000, 5000, 10000], (t) => `Earn ${t.toLocaleString('en-IN')} coins in all`, (x) => Math.floor(x.c.wallet.lifetime)),
  ...ladder('quests', '📜', ['Quest Starter', 'Quest Regular', 'Quest Champion'], [1, 7, 30], (t) => `Finish all daily quests on ${t} day${t > 1 ? 's' : ''}`, (x) => claims(x, 'd:')),
  ...ladder('weekly', '🏆', ['Weekly Winner', 'Month of Wins'], [1, 4], (t) => `Win ${t} weekly challenge${t > 1 ? 's' : ''}`, (x) => claims(x, 'w:')),
  ...STRAND_NAMES.map(
    ([strand, icon, name]): Badge => ({
      id: `strand-${strand}`,
      icon,
      name: `${name} Pro`,
      desc: `Master 5 ${name.toLowerCase()} skills`,
      tier: 2,
      target: 5,
      value: (x) => x.skillIds.filter((id) => x.strandOf(id) === strand && isMastered(x.c.progress, id)).length,
    }),
  ),
  { id: 'early-bird', icon: '🌅', name: 'Early Bird', desc: 'Finish a level before 8 in the morning', tier: 1, target: 1, value: (x) => logOf(x).filter((e) => new Date(e.t).getHours() < 8).length },
  { id: 'weekend', icon: '🎈', name: 'Weekend Warrior', desc: 'Play on a Saturday and the Sunday after it', tier: 1, target: 1, value: (x) => Object.keys(x.c.stats.secondsByDay).filter((d) => new Date(`${d}T12:00:00`).getDay() === 6 && (x.c.stats.secondsByDay[d] ?? 0) > 0 && (x.c.stats.secondsByDay[addDays(d, 1)] ?? 0) > 0).length },
  { id: 'speedy', icon: '⚡', name: 'Lightning Fast', desc: 'Get every answer right in a level at under 3 seconds each', tier: 3, target: 1, value: (x) => logOf(x).filter((e) => { const [n, ok, ms] = Object.values(e.a).reduce((a, r) => [a[0] + r[0], a[1] + r[1], a[2] + r[2]], [0, 0, 0]); return n >= 8 && ok === n && ms / n < 3000; }).length },
  { id: 'comeback', icon: '💪', name: 'Comeback Kid', desc: 'Pass a level you didn’t pass the first time', tier: 1, target: 1, value: (x) => { const failed = new Set<string>(); let n = 0; for (const e of logOf(x)) { if (e.s === 0) failed.add(e.id); else if (failed.has(e.id)) n++; } return n; } },
  { id: 'quest', icon: '🧭', name: 'Side Quester', desc: 'Win stars in a side quest', tier: 1, target: 1, value: (x) => Object.values(x.c.progress.questBest ?? {}).filter((n) => n >= 40).length },
  ...ladder('speedlv', '🏎️', ['Speedster', 'Turbo'], [10, 50], (t) => `Pass ${t} Speed levels`, (x) => tierPassed(x, 4)),
  ...ladder('masterlv', '🥋', ['Black Belt', 'Sensei'], [10, 50], (t) => `Pass ${t} Master levels`, (x) => tierPassed(x, 5)),
  { id: 'explorer', icon: '🧩', name: 'All-rounder', desc: 'Answer questions from all 7 kinds of maths', tier: 2, target: 7, value: (x) => new Set(Object.keys(x.c.tally ?? {}).map((id) => x.strandOf(id)).filter(Boolean)).size },
  { id: 'big-day', icon: '🌟', name: 'Big Day', desc: 'Finish 10 levels in one day', tier: 2, target: 10, value: (x) => Math.max(0, ...Object.values(logOf(x).reduce<Record<string, number>>((m, e) => ((m[e.d] = (m[e.d] ?? 0) + 1), m), {}))) },
  ...ladder('plevel', '⭐', ['Rising Star', 'Double Digits', 'High Flyer', 'Sky High', 'Half Century', 'Mythic'], [5, 10, 20, 30, 50, 75], (t) => `Reach player level ${t}`, (x) => levelOf(xpOf(x.c)).level),
  ...ladder('combo', '🔥', ['Combo Starter', 'Combo Champ', 'Combo Legend'], [5, 10, 20], (t) => `Get ${t} right in a row in one level`, (x) => bestCombo(x.c)),
];

/** Badges earned now that weren't before. */
export function newBadges(x: BadgeContext): Badge[] {
  const have = x.c.adventure?.badges ?? {};
  return BADGES.filter((b) => !have[b.id] && b.value(x) >= b.target);
}

/** Note newly earned badges (Adventure on only) and return them. */
export function awardBadges(x: BadgeContext, now: number): Badge[] {
  const a = x.c.adventure;
  if (!a?.on) return [];
  const got = newBadges(x);
  for (const b of got) a.badges[b.id] = now;
  return got;
}

/** Open a chest if its quest is done and it isn't open yet. Returns false when it can't. */
export function claimChest(a: AdventureState, key: string, done: boolean, now: number): boolean {
  if (!a.on || !done || a.claimed[key]) return false;
  a.claimed[key] = now;
  return true;
}

/** Undo (parent area): chests opened and badges earned at or after `since` go back. */
export function rollbackAdventure(a: AdventureState | undefined, since: number): void {
  if (!a) return;
  for (const m of [a.claimed, a.badges]) for (const [k, t] of Object.entries(m)) if (t >= since) delete m[k];
}

/** Two phones' Adventure records together: every chest and badge, the earlier time of each. */
export function mergeAdventure(x: AdventureState | undefined, y: AdventureState | undefined): AdventureState | undefined {
  if (!x || !y) return x ?? y;
  const both = (p: Record<string, number>, q: Record<string, number>) => {
    const out = { ...p };
    for (const [k, t] of Object.entries(q)) out[k] = out[k] ? Math.min(out[k], t) : t;
    return out;
  };
  return { on: x.on, claimed: both(x.claimed, y.claimed), badges: both(x.badges, y.badges), cheered: { ...x.cheered }, seenLevel: x.seenLevel, xpSeen: x.xpSeen };
}

/** Days in a row on which every daily quest was finished, up to today. */
export function questStreak(c: AdvChild, today: string): number {
  let n = 0;
  for (let d = c.adventure?.claimed[`d:${today}`] ? today : addDays(today, -1); c.adventure?.claimed[`d:${d}`]; d = addDays(d, -1)) n++;
  return n;
}

/** Forget old "already cheered" notes. */
export function tidy(a: AdventureState, today: string): void {
  for (const d of Object.keys(a.cheered)) if (dayDiff(d, today) > 2) delete a.cheered[d];
}
