// Focus plan on screen: the map's 🎯 button (MN Premium). Parents see the plan in the Premium tab.

import type { App } from './app.ts';
import type { Child } from '../storage/save.ts';
import { skillById } from '../core/areas/index.ts';
import { FOCUS_GOAL, focusId, focusPlan, type FocusPlan } from '../core/focus.ts';
import { fixKnown } from './fixit.ts';
import { playLevel } from './flow.ts';
import { hasPlus } from './membership.ts';

export const focusFor = (app: App, child: Child): FocusPlan => focusPlan(child, app.today, fixKnown);

/** The map button: only with MN Premium, once there is a plan. */
export function focusButton(app: App, child: Child): string {
  if (!hasPlus(app)) return '';
  const p = focusFor(app, child);
  if (!p.skills.length) return '';
  const left = Math.max(0, FOCUS_GOAL - p.rounds);
  return `<button class="icon-btn focus-btn${left ? '' : ' done'}" aria-label="Focus round: ${left ? `${left} left this week` : 'this week’s rounds done'}"><span aria-hidden="true">🎯</span><i aria-hidden="true">${left ? `${p.rounds}/${FOCUS_GOAL}` : '✓'}</i></button>`;
}

export function startFocus(app: App, child: Child): void {
  const p = focusFor(app, child);
  if (!p.skills.length) return;
  const first = skillById(p.skills[0].id)!;
  playLevel(app, child, { kind: 'review', id: focusId(p.week), index: 9999, stage: first.stage, skillIds: p.skills.map((s) => s.id), n: 1 });
}
