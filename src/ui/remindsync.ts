// Keeps the phone's reminders and home-screen widgets in step with the save: after every
// change (a level, a reward, a setting) a fresh plan goes to the native side, which sets the
// alarms and redraws the widgets. Also handles the app being opened from a reminder.

import type { App } from './app.ts';
import type { Child } from '../storage/save.ts';
import { FACTS } from '../core/facts/index.ts';
import { recentDays, remindersOf, planReminders, widgetFacts, widgetKid, type RemindChild, type WidgetAdventure, type WidgetData, type WidgetDay, type WidgetFocus, type WidgetKid } from '../core/reminders.ts';
import { skillById } from '../core/areas/index.ts';
import { FOCUS_GOAL } from '../core/focus.ts';
import { focusFor, startFocus } from './focus.ts';
import { hasPlus } from './membership.ts';
import { streaks } from '../core/stats.ts';
import { AVATARS } from './icons.ts';
import { levelInfo, questBadge } from './adventure.ts';
import { rankOf } from '../core/adventure.ts';
import { openParentOn, parentScreen } from './parent.ts';
import { quietly } from '../platform/native.ts';

const remindChild = (c: Child): RemindChild => ({ id: c.id, name: c.name, avatar: AVATARS[c.avatar % AVATARS.length], wallet: c.wallet, stats: c.stats, backupAt: c.backupAt, backupDays: c.backupDays });

function adventureCard(app: App): WidgetAdventure | null {
  const kids = app.save.data.children.filter((c) => c.adventure?.on);
  const c = kids.find((k) => k.id === app.save.data.activeChildId) ?? kids[0];
  if (!c) return null;
  const L = levelInfo(c);
  const r = rankOf(L.level);
  return {
    name: c.name,
    avatar: AVATARS[c.avatar % AVATARS.length],
    level: L.level,
    rank: r.name,
    rankIcon: r.icon,
    into: L.into,
    need: L.need,
    quests: questBadge(app, c).done,
    questDay: app.today,
    streak: streaks(c.stats.secondsByDay, app.today).current,
    streakDay: c.wallet.lastPlayDay ?? '',
  };
}

const activeChild = (app: App): Child | undefined => app.save.data.children.find((k) => k.id === app.save.data.activeChildId) ?? app.save.data.children[0];

function dayCard(app: App): WidgetDay | null {
  const c = activeChild(app);
  if (!c) return null;
  return {
    name: c.name,
    avatar: AVATARS[c.avatar % AVATARS.length],
    days: recentDays(c.stats.secondsByDay, app.today),
    streak: streaks(c.stats.secondsByDay, app.today).current,
    streakDay: c.wallet.lastPlayDay ?? '',
  };
}

/** Sample skills the locked Focus widget shows, so a parent can see what it would do. */
const FOCUS_SAMPLE = [
  { name: 'Times tables: 7s', before: 55, now: 70 },
  { name: 'Fractions of a number', before: 48, now: null },
  { name: 'Telling the time', before: 62, now: 68 },
];

function focusCard(app: App): WidgetFocus | null {
  const c = activeChild(app);
  if (!c) return null;
  if (!hasPlus(app)) return { name: c.name, locked: true, week: '', rounds: 0, goal: FOCUS_GOAL, skills: FOCUS_SAMPLE };
  const p = focusFor(app, c);
  return {
    name: c.name,
    locked: false,
    week: p.week,
    rounds: p.rounds,
    goal: FOCUS_GOAL,
    skills: p.skills.map((s) => ({ name: skillById(s.id)?.name ?? s.id, before: s.before, now: s.now })),
  };
}

/** Everything the phone needs: the notes to show, and what the widgets draw. */
export function buildPlan(app: App, now = new Date()): { items: ReturnType<typeof planReminders>; widget: WidgetData } {
  const d = app.save.data;
  const kids = d.children.map(remindChild);
  const items = planReminders({
    children: kids,
    settings: remindersOf(d.settings.reminders),
    holiday: d.settings.holiday,
    backupSnoozeUntil: d.settings.backupSnoozeUntil ?? 0,
    facts: FACTS,
    now,
    today: app.today,
    quiet: d.settings.quiet,
  });
  const widget: WidgetData = {
    kids: kids.map(widgetKid).filter((k): k is WidgetKid => !!k),
    holiday: d.settings.holiday,
    facts: widgetFacts(FACTS, app.today),
    adventure: adventureCard(app),
    day: dayCard(app),
    focus: focusCard(app),
  };
  return { items, widget };
}

let sent = '';
let timer = 0;

async function push(app: App): Promise<void> {
  const native = app.native;
  if (!native?.setReminders) return;
  const json = JSON.stringify(buildPlan(app));
  if (json === sent) return;
  sent = json;
  try {
    const r = await native.setReminders({ plan: json });
    // "In 3 days" tapped on a backup note: remember it here too.
    const snooze = r?.snoozeUntil ?? 0;
    if (snooze > (app.save.data.settings.backupSnoozeUntil ?? 0)) app.save.update((d) => (d.settings.backupSnoozeUntil = snooze));
  } catch {
    sent = '';
  }
}

/**
 * What to do when a reminder or widget was tapped: the backup note opens the Parent area (after
 * the parent check), the Focus widget starts a Focus round from the map, and the locked Focus
 * widget shows the MN × tab (after the parent check).
 */
async function opened(app: App, open: string | undefined): Promise<void> {
  if (!open || !app.save.data.children.length) return;
  // Not over the lock screen or setup: those come first.
  if (app.screen?.el.matches('.lock, .welcome, .reel')) return;
  if (open === 'focus') {
    const c = activeChild(app);
    if (c && hasPlus(app) && app.screen?.el.matches('.map') && focusFor(app, c).skills.length) startFocus(app, c);
    return;
  }
  if (open !== 'backup' && open !== 'mnx') return;
  if (!(await app.grownUp(open === 'mnx' ? 'MN ×' : 'Back up'))) return;
  openParentOn(open === 'mnx' ? 'premium' : 'app');
  void app.show(parentScreen, 'fade');
}

export function startReminders(app: App): void {
  const native = app.native;
  if (!native?.setReminders) return;
  const later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void push(app), 1200);
  };
  app.save.onSaved(later);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void push(app);
  });
  void push(app);
  // Reminders must never stop the app from opening.
  try {
    quietly(native.addListener?.('launch', (d: { open?: string }) => opened(app, d.open)));
    quietly(native.launchAction?.().then((r) => opened(app, r?.open)));
  } catch {
    /* no launch info: the app opens as usual */
  }
}

/** Notes allowed on this phone? (and can Android still ask?) */
export async function notificationState(app: App): Promise<{ enabled: boolean; canAsk: boolean } | null> {
  const n = app.native;
  if (!n?.notificationState) return null;
  try {
    const r = await n.notificationState();
    return { enabled: !!r.enabled, canAsk: !!r.canAsk };
  } catch {
    return null;
  }
}

export async function askNotifications(app: App): Promise<boolean> {
  const n = app.native;
  if (!n?.askNotifications) return false;
  try {
    const r = await n.askNotifications();
    sent = '';
    void push(app);
    return !!r.enabled;
  } catch {
    return false;
  }
}

/**
 * Ask once whether MN may send notifications (after setup, or on the first Parent area
 * visit): a learning-time note each day and one when a reward is ready.
 */
export async function offerNotifications(app: App): Promise<void> {
  if (!app.native?.askNotifications || app.save.data.settings.notifAsked) return;
  const n = await notificationState(app);
  app.save.update((d) => (d.settings.notifAsked = true));
  if (!n || n.enabled || !n.canAsk) return;
  const { result } = app.sheet(
    `<h2>🔔 Turn on reminders?</h2><p>MN sends one note a day at learning time (5 pm, or a time you pick) and one when a reward is ready to hand over. Nothing at bedtime.</p>`,
    [
      { label: 'Turn on', value: true, kind: 'mint' },
      { label: 'Not now', value: false, kind: 'ghost', back: true },
    ],
    'Reminders',
  );
  if (await result) {
    const ok = await askNotifications(app);
    app.toast(ok ? 'Reminders are on. Change the time in Parent area → App.' : 'No reminders for now. Turn them on any time in Parent area → App.', 5000);
  }
}
