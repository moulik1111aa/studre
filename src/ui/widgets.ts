// Home-screen widgets from the app's side: a drawn preview of each (the same layout as the
// Android widget), the one-time tip after a few Parent area visits, and the "Add" buttons in
// Parent area → App. Android 8+ launchers can add a widget straight from the app.

import { esc, type App } from './app.ts';
import type { Child } from '../storage/save.ts';
import { AVATARS } from './icons.ts';
import { addDays } from '../core/economy.ts';
import { streaks } from '../core/stats.ts';
import { hasPlus, plusTag } from './membership.ts';

export type WidgetKind = 'today' | 'focus' | 'jar' | 'fact';

/** Parent area visits before the widget tip shows. */
export const WIDGET_TIP_AFTER = 4;

const WEEKDAY = 'SMTWTFS';

/** The "MN today" widget, drawn with this child's real week. */
export function todayPreview(app: App, c: Child | undefined, sample = false): string {
  const days = Array.from({ length: 7 }, (_, i) => addDays(app.today, i - 6));
  // A sample week (for the MN × preview): played 5 of the last 7 days, 12 minutes today.
  const byDay: Record<string, number> = sample ? Object.fromEntries(days.map((d, i) => [d, [1, 2].includes(i) ? 0 : i === 6 ? 720 : 900])) : (c?.stats.secondsByDay ?? {});
  const played = (d: string) => (byDay[d] ?? 0) > 0;
  const secs = byDay[app.today] ?? 0;
  const streak = sample ? 4 : c ? streaks(byDay, app.today).current : 0;
  const dots = days
    .map((d, i) => {
      const on = played(d);
      return `<span><small>${WEEKDAY[new Date(`${d}T12:00:00`).getDay()]}</small><i class="${on ? 'on' : ''}${i === 6 ? ' today' : ''}">${on ? '✓' : ''}</i></span>`;
    })
    .join('');
  const line = secs > 0 ? `${secs < 60 ? 'Under a minute' : `${Math.floor(secs / 60)} min`} today` : 'Tap to play today';
  return `<div class="wg wg-today" aria-hidden="true">
    <div class="wg-top"><span class="wg-av">${c ? AVATARS[c.avatar % AVATARS.length] : '🚀'}</span><b>${c ? `${esc(c.name)}’s week` : 'This week'}</b><em>🔥 ${streak}</em></div>
    <div class="wg-days">${dots}</div>
    <p class="wg-line">${line}</p>
  </div>`;
}

/** The MN × Focus plan widget (sample skills). */
export function focusPreview(c: Child | undefined): string {
  const rows: [string, string, 'up' | 'same' | ''][] = [['Times tables: 7s', '55% → 70%', 'up'], ['Fractions of a number', '48%', ''], ['Telling the time', '62% → 68%', 'up']];
  return `<div class="wg wg-focus" aria-hidden="true">
    <div class="wg-top"><b>${c ? `${esc(c.name)}’s focus` : 'Focus plan'}</b><em>MN ×</em></div>
    ${rows.map(([n, v, t]) => `<div class="wg-row"><span>${n}</span><b class="${t}">${v}</b></div>`).join('')}
    <p class="wg-foot">Focus rounds: 1 of 3 this week</p>
  </div>`;
}

async function widgetState(app: App): Promise<{ placed: number; canPin: boolean } | null> {
  if (!app.native?.widgetState) return null;
  try {
    return await app.native.widgetState();
  } catch {
    return null;
  }
}

/** Ask the launcher to add a widget; false when it can't (then the steps are shown instead). */
export async function pinWidget(app: App, kind: WidgetKind): Promise<boolean> {
  if (!app.native?.pinWidget) return false;
  try {
    return !!(await app.native.pinWidget({ kind })).ok;
  } catch {
    return false;
  }
}

const HOW = 'Touch and hold an empty spot on your home screen, tap Widgets, then find MN.';

/**
 * From the fourth Parent area visit, if no MN widget is on the home screen yet, offers
 * the "MN today" widget once (with a one-tap add where the launcher allows it).
 */
export async function offerWidget(app: App): Promise<void> {
  const st = app.save.data.settings;
  if (st.widgetAsked || !app.native?.widgetState || (st.parentVisits ?? 0) < WIDGET_TIP_AFTER) return;
  const w = await widgetState(app);
  if (!w) return;
  app.save.update((d) => (d.settings.widgetAsked = true));
  if (w.placed > 0) return;
  const c = app.save.data.children.find((k) => k.id === app.save.data.activeChildId) ?? app.save.data.children[0];
  const { result } = app.sheet(
    `<h2>See their week from your home screen</h2>
     <div class="wg-sheet">${todayPreview(app, c)}</div>
     <p>Days played, today’s minutes and the streak, without opening MN. Tap it and MN opens, ready to play.</p>
     ${w.canPin ? '' : `<p class="fine">${HOW}</p>`}`,
    w.canPin
      ? [
          { label: 'Add to home screen', value: true, kind: 'mint' },
          { label: 'Not now', value: false, kind: 'ghost', back: true },
        ]
      : [{ label: 'Got it', value: false, kind: 'mint', back: true }],
    'Home-screen widget',
  );
  if ((await result) && !(await pinWidget(app, 'today'))) app.toast(HOW, 6000);
}

/** Parent area → App: each widget with an Add button (or the steps, where the launcher can't add one). */
export function widgetsSectionHtml(app: App): string {
  const list: [WidgetKind, string, string][] = [
    ['today', 'MN today', 'Days played this week, today’s minutes and the streak'],
    ['focus', `MN × Focus plan ${plusTag(app)}`, hasPlus(app) ? 'This week’s three Focus skills and how each is going' : 'Shows a sample until MN × is on'],
    ['jar', 'Treat jars', 'How full each jar is, and when it starts to melt'],
    ['fact', 'Fun fact', 'A new fact each day, with a Next button'],
  ];
  return `<div class="card pa-widgets">
    ${list.map(([k, t, n]) => `<div class="wg-item"><span><b>${t}</b><small>${n}</small></span><button class="btn ghost small wg-add" data-w="${k}" hidden>Add</button></div>`).join('')}
    <p class="fine wg-how">${HOW}</p>
  </div>`;
}

/** After the App tab is drawn: show the Add buttons where the launcher can add widgets. */
export async function bindWidgetsSection(app: App, root: HTMLElement): Promise<void> {
  const host = root.querySelector<HTMLElement>('.pa-widgets');
  if (!host) return;
  const w = await widgetState(app);
  if (!w?.canPin) return;
  host.querySelectorAll<HTMLButtonElement>('.wg-add').forEach((b) => {
    b.hidden = false;
    b.addEventListener('click', async () => {
      if (!(await pinWidget(app, b.dataset.w as WidgetKind))) app.toast(HOW, 6000);
    });
  });
  host.querySelector<HTMLElement>('.wg-how')!.textContent = 'Tap Add, then choose where it goes. Or touch and hold your home screen and tap Widgets.';
}
