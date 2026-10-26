// Phone reminders and home-screen widgets, planned by the web app from the save. The native
// side (Reminders.java, ReminderReceiver.java, Widgets.java) stores the plan, shows each note
// at its time, and draws the widgets. The plan is made again whenever the save changes, so a
// level played at 5 pm turns that evening's "last call" into a "well done".
//
// - Melt watch: 2 or 3 friendly notes a day about the treat jars, each with a fun fact.
// - Backup: for grown-ups, a note to save a report card when there is unsaved progress.
// - Widgets: treat jars (with melting worked out on the phone each hour), a fun fact, and the
//   Adventure level card.

import { addDays, dayDiff, MELT, type Wallet } from './economy.ts';
import { baseCostOf, costOf, rewardById } from './rewards.ts';

export interface ReminderSettings {
  /** Melt-watch notes (2 or 3 a day). */
  melt: boolean;
  perDay: 2 | 3;
  /** The grown-ups' backup reminder. */
  backup: boolean;
}
export const DEFAULT_REMINDERS: ReminderSettings = { melt: true, perDay: 3, backup: true };

export interface ReminderItem {
  /** Stable small number per slot (the native alarm and notification id). */
  id: number;
  /** When to show it (ms since epoch). */
  at: number;
  kind: 'melt' | 'backup';
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
}

const DAY_MS = 86_400_000;
/** Times of the melt-watch notes: morning, after school, evening (hour, minute). */
export const SLOTS: Record<2 | 3, [number, number][]> = {
  2: [
    [8, 0],
    [18, 30],
  ],
  3: [
    [8, 0],
    [16, 30],
    [19, 30],
  ],
};
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
type Fill = (n: string, j: JarLook) => string;
/** "the treat jar 🍫" and the reward itself ("15 extra minutes of cartoons"). */
const tj = (j: JarLook) => `treat jar ${j.icon}`;
const prize = (j: JarLook) => j.reward.charAt(0).toLowerCase() + j.reward.slice(1);

const MORNING_MELTED: Fill[] = [
  (n, j) => `🫠 Drip, drip! ${n}’s ${tj(j)} melted ${j.drop}% overnight and is ${j.pct}% full now. One level puts it back in the freezer!`,
  (n, j) => `☀️ Rise and shine! ${n}’s ${tj(j)} got a little gooey last night (−${j.drop}%). A quick level freezes it again.`,
  (n, j) => `🧊 Freezer alert! While everyone slept, ${n}’s ${tj(j)} slid down to ${j.pct}%. Plus has the ice ready!`,
  (n, j) => `🌡️ A warm night! ${n}’s ${tj(j)} lost ${j.drop}% on the way to ${prize(j)}. Time for a cool maths level?`,
];
const MORNING_MANY: Fill[] = [
  (n, j) => `🫠 Melt-down! ${n} hasn’t played for ${j.missed} days, so the ${tj(j)} is down to ${j.pct}%. Let’s rescue it today!`,
  (n, j) => `🆘 S.O.S. from ${n}’s ${tj(j)}! It has been melting for ${j.missed} days (${j.pct}% left). One level stops the drip.`,
];
const MORNING_SAFE: Fill[] = [
  (n, j) => `❄️ Good morning! ${n}’s ${tj(j)} is frozen solid at ${j.pct}%. Keep it cool with a level today!`,
  (n, j) => `🌞 New day, new maths! ${n}’s ${tj(j)} is ${j.pct}% of the way to ${prize(j)}.`,
  (n, j) => `🐧 Brrr, nice and frosty! ${n}’s ${tj(j)} stayed frozen overnight. Today’s level keeps it that way.`,
];
const AFTERNOON: Fill[] = [
  (n, j) => `🌡️ It’s warming up! If ${n} doesn’t play today, the ${tj(j)} melts ${j.drop}% at midnight.`,
  (n, j) => `⏰ Tick-tock! A 5-minute level keeps ${n}’s ${tj(j)} from melting tonight.`,
  (n, j) => `🍦 The melt-o-meter is rising! ${n}’s ${tj(j)} needs one level today to stay frozen.`,
  (n, j) => `🚒 Plus is on freezer duty! One quick level keeps ${n} on the way to ${prize(j)}.`,
];
const EVENING: Fill[] = [
  (n, j) => `🌙 Last call before the midnight melt! ${n}’s ${tj(j)} is at ${j.pct}%. One level saves it.`,
  (n, j) => `🦉 The night owl says: one level now and ${n}’s ${tj(j)} stays frozen till morning!`,
  (n, j) => `⭐ Before bedtime: one quick level keeps ${n}’s ${tj(j)} safe from the midnight melt.`,
];
const PLAYED: Fill[] = [
  (n, j) => `🎉 Freeze-tastic! ${n} played today, so the ${tj(j)} stays frozen at ${j.pct}%. See you tomorrow!`,
  (n, j) => `⭐ Superstar! ${n} kept the ${tj(j)} nice and cold today. Nothing melts tonight.`,
  (n, j) => `🧊 Cool as ice! ${n}’s ${tj(j)} is safe and sound at ${j.pct}%.`,
];
const EMPTY: Fill[] = [
  (n, j) => `🫗 ${n}’s ${tj(j)} has melted right down. Good news: every level fills it up again!`,
  (n, j) => `🌱 Fresh start! ${n}’s ${tj(j)} is empty, and one level gets it going again.`,
];
const WAITING: Fill[] = [(n, j) => `🎁 ${n}’s ${prize(j)} is ready! A grown-up can hand it over and tap “Given”.`];
const HOLIDAY = ['🏖️ Holiday mode is on, so nothing melts. Here’s a fun fact for the road!', '🌴 No melting on holiday! Just a fun fact to share.'];
const TITLES = ['Melt watch', 'Plus here!', 'Freezer report', 'Treat jar news'];

/** Several children: one headline, then a short line each. */
const MULTI = {
  melted: ['🫠 Drip, drip! Some treat jars melted overnight.', '🧊 Freezer alert! A treat jar got gooey in the night.'],
  safe: ['❄️ Good morning! The treat jars are frozen solid.', '🐧 Brrr, nice and frosty! The treat jars stayed cold overnight.'],
  afternoon: ['🌡️ It’s warming up! Treat jars melt at midnight without a level today.', '⏰ Tick-tock! A 5-minute level each keeps the treat jars frozen tonight.'],
  evening: ['🌙 Last call before the midnight melt!', '🦉 The night owl says: one level each keeps the jars frozen till morning!'],
  played: ['🎉 Freeze-tastic! Everyone kept their treat jar frozen today.', '⭐ Superstars! Nothing melts tonight.'],
};

interface KidSlot {
  c: RemindChild;
  j: JarLook;
}

/** What to say about one child in a slot ('' = nothing worth saying). */
function single(k: KidSlot, day: string, slot: number, slots: number): string {
  const { c, j } = k;
  const key = `${c.id}|${day}|${slot}`;
  if (j.waiting) return slot === 0 ? pick(WAITING, key)(c.name, j) : '';
  if (j.pct === 0) return slot === 0 ? pick(EMPTY, key)(c.name, j) : '';
  const evening = slot === slots - 1;
  if (j.played) return evening ? pick(PLAYED, key)(c.name, j) : '';
  if (slot === 0) {
    if (j.missed >= 2) return pick(MORNING_MANY, key)(c.name, j);
    return pick(j.missed === 1 ? MORNING_MELTED : MORNING_SAFE, key)(c.name, j);
  }
  return pick(evening ? EVENING : AFTERNOON, key)(c.name, j);
}

/** A child's short line under a shared headline. */
function status(k: KidSlot, slot: number): string {
  const { c, j } = k;
  const s = j.waiting ? 'ready to be given 🎁' : j.pct === 0 ? 'empty: a level fills it again' : j.played ? 'frozen today ✓' : slot === 0 && j.missed >= 1 ? `melted ${j.missed === 1 ? `${j.drop}% overnight` : `for ${j.missed} days`}` : slot === 0 ? 'frozen solid' : 'melts tonight without a level';
  return `${c.avatar} ${c.name}: ${j.icon} ${j.pct}% · ${s}`;
}

/** The note's lines for one slot (empty: no note). */
export function slotLines(kids: KidSlot[], day: string, slot: number, slots: number): string[] {
  if (kids.length === 1) {
    const line = single(kids[0], day, slot, slots);
    return line ? [line] : [];
  }
  const evening = slot === slots - 1;
  const key = `${day}|${slot}`;
  const live = kids.filter((k) => !k.j.waiting && k.j.pct > 0);
  // Mornings report on everyone; later notes only matter while someone still has to play.
  if (slot > 0) {
    const toPlay = live.filter((k) => !k.j.played);
    if (!toPlay.length) return evening && live.length ? [pick(MULTI.played, key), ...kids.map((k) => status(k, slot))] : [];
    return [pick(evening ? MULTI.evening : MULTI.afternoon, key), ...kids.map((k) => status(k, slot))];
  }
  const melted = live.some((k) => k.j.missed >= 1);
  return [pick(melted ? MULTI.melted : MULTI.safe, key), ...kids.map((k) => status(k, slot))];
}

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
  `${names}’s stars, coins, jars and rewards are saved only on this phone. If it’s lost, reset or swapped, they’d start again from zero. Save a report card to Google Drive or email it to yourself: it takes 20 seconds, and it restores everything on any phone with MN.`;

const listNames = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

// ── the plan ───────────────────────────────────────────────────────────────
export function planReminders(p: PlanInput): ReminderItem[] {
  const items: ReminderItem[] = [];
  const nowMs = p.now.getTime();
  const kids = p.children;
  if (p.settings.melt && kids.length) {
    const slots = SLOTS[p.settings.perDay];
    for (let d = 0; d < DAYS_AHEAD; d++) {
      const day = addDays(p.today, d);
      slots.forEach(([hh, mm], s) => {
        const when = at(day, hh, mm);
        if (when < nowMs + 5 * 60_000) return;
        const id = 100 + d * 10 + s;
        const fact = factFor(p.facts, day, s);
        let lines: string[];
        if (p.holiday) {
          // On holiday: just one cheerful fact a day.
          if (s !== 0) return;
          lines = [pick(HOLIDAY, day)];
        } else {
          const looks = kids.map((c) => ({ c, j: jarOn(c, day, p.today) })).filter((k): k is KidSlot => !!k.j);
          if (!looks.length) return;
          lines = slotLines(looks, day, s, slots.length);
          if (!lines.length) return;
        }
        const text = `${lines.join('\n')}${fact ? `\n\n🤓 Did you know? ${fact}` : ''}`;
        items.push({ id, at: when, kind: 'melt', title: pick(TITLES, `${day}|${s}|t`), short: lines[0], text });
      });
    }
  }
  if (p.settings.backup) {
    const due = kids.map((c) => ({ c, when: backupWhen(c, nowMs) })).filter((x): x is { c: RemindChild; when: number } => x.when !== null);
    if (due.length) {
      let when = Math.max(Math.min(...due.map((x) => x.when)), p.backupSnoozeUntil, nowMs + 30 * 60_000);
      // Shown at a grown-up hour: 10 am, or 7 pm if 10 am has passed that day.
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
        title: '🔒 For grown-ups: back up MN progress',
        short: `Save ${names}’s report card so progress is never lost.`,
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
