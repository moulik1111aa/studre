// Phone reminders and home-screen widgets, planned by the web app from the save. The native
// side (Reminders.java, ReminderReceiver.java, Widgets.java) stores the plan, shows each note
// at its time, and draws the widgets. The plan is made again whenever the save changes, so a
// level played at 5 pm turns that evening's "last call" into a "well done".
//
// - Learning time: one note a day at the time the parent picks, naming who hasn't played.
// - Reward ready: when a jar is full and the reward waits to be handed over.
// - Backup: for parents, a note to save a backup file when there is unsaved progress.
// - Widgets: treat jars (with melting worked out on the phone each hour), a fun fact, and the
//   Adventure level card.

import { quietAt, type QuietSettings } from './quiet.ts';
import { addDays, dayDiff, MELT, type Wallet } from './economy.ts';
import { baseCostOf, costOf, rewardById } from './rewards.ts';

export interface ReminderSettings {
  /** A daily "time for maths" note at a time the parent picks (HH:MM, local). */
  daily: boolean;
  dailyAt: string;
  /** A note when a child's jar is full and the reward is waiting to be given. */
  ready: boolean;
  /** The parents' backup reminder. */
  backup: boolean;
  /** Old jar notes (2 or 3 a day): no longer sent, kept so old saves read. */
  melt?: boolean;
  perDay?: 2 | 3;
}
export const DEFAULT_REMINDERS: ReminderSettings = { daily: true, dailyAt: '17:00', ready: true, backup: true };
/** Settings from a save (older saves had only the jar notes and backup). */
export const remindersOf = (r?: Partial<ReminderSettings>): ReminderSettings => ({ ...DEFAULT_REMINDERS, ...r, melt: false });

export interface ReminderItem {
  /** Stable small number per slot (the native alarm and notification id). */
  id: number;
  /** When to show it (ms since epoch). */
  at: number;
  kind: 'daily' | 'ready' | 'backup';
  title: string;
  /** One line for the collapsed notification, and the full text. */
  short: string;
  text: string;
}

/** What a reminder needs to know about a child. */
export interface RemindChild {
  id: string;
  name: string;
  avatar: string;
  wallet: Wallet;
  stats: { secondsByDay: Record<string, number> };
  backupAt?: number;
  backupDays?: number;
}

export interface PlanInput {
  children: RemindChild[];
  settings: ReminderSettings;
  holiday: boolean;
  /** Backup reminders are quiet until then (ms). */
  backupSnoozeUntil: number;
  facts: readonly string[];
  /** "Now" as local time, and today's local day (YYYY-MM-DD). */
  now: Date;
  today: string;
  /** Bedtime: no melt-watch note at bedtime. */
  quiet?: Partial<QuietSettings>;
}

const DAY_MS = 86_400_000;
/** Days of notes planned ahead (the plan is renewed every time the app is used). */
export const DAYS_AHEAD = 5;

/** A small number from text, the same every time. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pick = <T>(list: readonly T[], key: string): T => list[hash(key) % list.length];

/** Local time on a given local day. */
function at(day: string, hh: number, mm: number): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

const playDays = (c: RemindChild) => Object.values(c.stats.secondsByDay).filter((s) => s > 0).length;

// ── the treat jar, as it will be on a given day ──────────────────────────────
export interface JarLook {
  icon: string;
  reward: string;
  /** Full % now (after any melting by that day), and how much one night of melting takes. */
  pct: number;
  drop: number;
  /** Nights missed up to that day, and whether the child played that day. */
  missed: number;
  played: boolean;
  waiting: boolean;
}

/**
 * The treat jar on `day`, if nothing more is played before then (only today can count as
 * played, from the save). Melting follows applyMelt: 5% of the reward's base price per
 * full day without play since the last play.
 */
export function jarOn(c: RemindChild, day: string, today: string): JarLook | null {
  const jar = c.wallet.treat;
  const r = jar.rewardId ? rewardById(jar.rewardId) : undefined;
  if (!r) return null;
  const cost = costOf(r);
  const last = c.wallet.lastPlayDay;
  const played = day === today && last === today;
  const missed = last ? Math.max(0, dayDiff(last, day) - 1) : 0;
  const coins = jar.waiting ? jar.coins : Math.max(0, jar.coins - missed * MELT.treat * baseCostOf(r));
  return {
    icon: r.icon,
    reward: r.name,
    pct: Math.min(100, Math.floor((100 * coins) / cost)),
    drop: Math.max(1, Math.round((100 * MELT.treat * baseCostOf(r)) / cost)),
    missed,
    played,
    waiting: jar.waiting,
  };
}

// ── the words ──────────────────────────────────────────────────────────────
/** The fun fact for a slot: different for every slot over the days ahead. */
export function factFor(facts: readonly string[], day: string, slot: number): string {
  const short = facts.filter((f) => f.length <= 160);
  const list = short.length ? short : facts;
  if (!list.length) return '';
  const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS) * 3 + slot;
  return list[(((n * 7919) % list.length) + list.length) % list.length];
}

// ── backup ─────────────────────────────────────────────────────────────────
/** Unsaved progress worth a backup: 2+ new play days, and a week since the last backup. */
export function backupDue(c: RemindChild, now: number): boolean {
  const days = playDays(c);
  const fresh = days - (c.backupDays ?? 0);
  if (fresh < 2) return false;
  return now - (c.backupAt ?? 0) >= 7 * DAY_MS;
}

/** When the backup reminder becomes due (ms), or null if it won't without more play. */
function backupWhen(c: RemindChild, now: number): number | null {
  if (playDays(c) - (c.backupDays ?? 0) < 2) return null;
  return Math.max(now, (c.backupAt ?? 0) + 7 * DAY_MS);
}

export const BACKUP_TEXT = (names: string) =>
  `${names}’s stars, coins, jars and rewards are saved only on this phone. If it’s lost, reset or swapped, they’d start again from zero. Save a progress file to Google Drive or email it to yourself: it takes 20 seconds, and it restores everything on any phone with MN.`;

const listNames = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

// ── daily learning time ────────────────────────────────────────────────────
const DAILY_TITLES = ['🧮 Time for today’s maths', '⭐ MN time!', '🚀 Ready for today’s mission?', '🎯 A few minutes of maths'];
const DAILY: ((names: string) => string)[] = [
  (n) => `${n}: a few minutes of maths today keeps the streak going.`,
  (n) => `${n}, Plus has a new level waiting on the map.`,
  (n) => `Five minutes of MN for ${n} fills the treat jar a little more.`,
  (n) => `${n}: one level today, and the jar keeps growing.`,
];

// ── the plan ───────────────────────────────────────────────────────────────
export function planReminders(p: PlanInput): ReminderItem[] {
  const items: ReminderItem[] = [];
  const nowMs = p.now.getTime();
  const kids = p.children;
  const st = remindersOf(p.settings);
  const asleep = (when: number) => !!p.quiet?.bed && quietAt({ bed: p.quiet.bed }, new Date(when));
  // Daily learning time: one note for the family at the chosen time, naming who hasn't
  // played yet that day. Not on pause-rewards days, not at bedtime.
  if (st.daily && kids.length && !p.holiday) {
    const [hh, mm] = st.dailyAt.split(':').map(Number);
    for (let d = 0; d < DAYS_AHEAD; d++) {
      const day = addDays(p.today, d);
      const when = at(day, hh || 17, mm || 0);
      if (when < nowMs + 2 * 60_000 || asleep(when)) continue;
      const toPlay = kids.filter((c) => !(c.stats.secondsByDay[day] > 0));
      if (!toPlay.length) continue;
      const names = listNames(toPlay.map((c) => c.name));
      const short = pick(DAILY, `${day}|d`)(names);
      const fact = factFor(p.facts, day, 0);
      items.push({ id: 100 + d, at: when, kind: 'daily', title: pick(DAILY_TITLES, `${day}|t`), short, text: `${short}${fact ? `\n\n🤓 Did you know? ${fact}` : ''}` });
    }
  }
  // Reward ready: a full jar waits for a parent to hand the reward over and tap Given.
  if (st.ready) {
    const ready = kids.flatMap((c) => (['treat', 'goal'] as const).filter((k) => c.wallet[k].waiting && c.wallet[k].rewardId).map((k) => ({ c, j: jarOn({ ...c, wallet: { ...c.wallet, treat: c.wallet[k] } }, p.today, p.today) })));
    if (ready.length) {
      // At a parent hour: 6 pm today if it's still ahead, else 10 am, for three days.
      const first = nowMs < at(p.today, 17, 30) ? at(p.today, 18, 0) : at(addDays(p.today, 1), 10, 0);
      const lines = ready.map(({ c, j }) => `🎁 ${c.name}’s ${j ? `${j.icon} ${j.reward}` : 'reward'} is ready!`);
      for (let d = 0; d < 3; d++) {
        const when = first + d * DAY_MS;
        if (asleep(when)) continue;
        items.push({ id: 80 + d, at: when, kind: 'ready', title: ready.length === 1 ? '🎁 A reward is ready to give' : '🎁 Rewards are ready to give', short: lines[0], text: `${lines.join('\n')}\nHand it over, then tap “Given” in MN so a new jar can start.` });
      }
    }
  }
  if (p.settings.backup) {
    const due = kids.map((c) => ({ c, when: backupWhen(c, nowMs) })).filter((x): x is { c: RemindChild; when: number } => x.when !== null);
    if (due.length) {
      let when = Math.max(Math.min(...due.map((x) => x.when)), p.backupSnoozeUntil, nowMs + 30 * 60_000);
      // Shown at a parent hour: 10 am, or 7 pm if 10 am has passed that day.
      const d = new Date(when);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const ten = at(day, 10, 0);
      const seven = at(day, 19, 0);
      when = when <= ten ? ten : when <= seven ? seven : at(addDays(day, 1), 10, 0);
      const names = listNames(due.map((x) => x.c.name));
      items.push({
        id: 90,
        at: when,
        kind: 'backup',
        title: '🔒 For parents: back up MN progress',
        short: `Save ${names}’s progress file so progress is never lost.`,
        text: BACKUP_TEXT(names),
      });
    }
  }
  return items;
}

// ── widgets ────────────────────────────────────────────────────────────────
export interface WidgetKid {
  name: string;
  avatar: string;
  icon: string;
  reward: string;
  coins: number;
  cost: number;
  base: number;
  rate: number;
  waiting: boolean;
  lastPlay: string | null;
}
export interface WidgetAdventure {
  name: string;
  avatar: string;
  level: number;
  rank: string;
  rankIcon: string;
  into: number;
  need: number;
  quests: number;
  questDay: string;
  streak: number;
  /** The last day played (the streak is still alive today or the day after). */
  streakDay: string;
}
export interface WidgetData {
  kids: WidgetKid[];
  holiday: boolean;
  facts: string[];
  adventure: WidgetAdventure | null;
}

export function widgetKid(c: RemindChild): WidgetKid | null {
  const jar = c.wallet.treat;
  const r = jar.rewardId ? rewardById(jar.rewardId) : undefined;
  if (!r) return null;
  return { name: c.name, avatar: c.avatar, icon: r.icon, reward: r.name, coins: jar.coins, cost: costOf(r), base: baseCostOf(r), rate: MELT.treat, waiting: jar.waiting, lastPlay: c.wallet.lastPlayDay };
}

/** Facts for the widget: a fresh handful each week. */
export function widgetFacts(facts: readonly string[], today: string, n = 40): string[] {
  const short = facts.filter((f) => f.length <= 150);
  if (!short.length) return [];
  const week = Math.floor(Date.parse(`${today}T00:00:00Z`) / (7 * DAY_MS));
  const start = hash(String(week)) % short.length;
  return Array.from({ length: Math.min(n, short.length) }, (_, i) => short[(start + i * 37) % short.length]);
}

/** Days until the next local day starts, for tests and the widget's own melting maths. */
export const nextDay = (day: string): string => addDays(day, 1);
