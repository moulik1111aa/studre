// Keeps the phone's reminders and home-screen widgets in step with the save: after every
// change (a level, a reward, a setting) a fresh plan goes to the native side, which sets the
// alarms and redraws the widgets. Also handles the app being opened from a reminder.

import type { App } from './app.ts';
import type { Child } from '../storage/save.ts';
import { FACTS } from '../core/facts/index.ts';
import { DEFAULT_REMINDERS, planReminders, widgetFacts, widgetKid, type RemindChild, type WidgetAdventure, type WidgetData, type WidgetKid } from '../core/reminders.ts';
import { streaks } from '../core/stats.ts';
import { AVATARS } from './icons.ts';
import { levelInfo, questBadge } from './adventure.ts';
import { rankOf } from '../core/adventure.ts';
import { backupScreen } from './backup.ts';
import { whosPlayingScreen } from './whos.ts';
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

/** Everything the phone needs: the notes to show, and what the widgets draw. */
export function buildPlan(app: App, now = new Date()): { items: ReturnType<typeof planReminders>; widget: WidgetData } {
  const d = app.save.data;
  const kids = d.children.map(remindChild);
  const items = planReminders({
    children: kids,
    settings: d.settings.reminders ?? DEFAULT_REMINDERS,
    holiday: d.settings.holiday,
    backupSnoozeUntil: d.settings.backupSnoozeUntil ?? 0,
    facts: FACTS,
    now,
    today: app.today,
  });
  const widget: WidgetData = {
    kids: kids.map(widgetKid).filter((k): k is WidgetKid => !!k),
    holiday: d.settings.holiday,
    facts: widgetFacts(FACTS, app.today),
    adventure: adventureCard(app),
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

/** What to do when a reminder was tapped: the backup note opens the grown-ups' backup screen. */
function opened(app: App, open: string | undefined): void {
  if (open !== 'backup' || !app.save.data.children.length) return;
  // Not over the lock screen or setup: those come first.
  if (app.screen?.el.matches('.lock, .welcome, .reel')) return;
  void app.show(backupScreen(whosPlayingScreen, app.save.data.children), 'fade');
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
