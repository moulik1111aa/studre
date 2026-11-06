// Backing up, for grown-ups: which children have a week of unsaved progress (shown in the
// Parent area, and as a phone note), and saving one report card per child.

import type { App } from './app.ts';
import type { Child } from '../storage/save.ts';
import { backupDue, DEFAULT_REMINDERS } from '../core/reminders.ts';
import { makeBackup } from '../core/backup.ts';
import { reportCardHtml, reportFileName } from './reportfile.ts';
import { saveTextFile } from '../platform/files.ts';

const DAY = 86_400_000;
const playDaysOf = (c: Child) => Object.values(c.stats.secondsByDay).filter((s) => s > 0).length;

/** Children with a week of unsaved progress (none while snoozed or switched off). */
export function dueKids(app: App, now = Date.now()): Child[] {
  const st = app.save.data.settings;
  if (!(st.reminders ?? DEFAULT_REMINDERS).backup || (st.backupSnoozeUntil ?? 0) > now) return [];
  return app.save.data.children.filter((c) => backupDue(c as never, now));
}


export function markBackedUp(app: App, c: Child): void {
  app.save.update(() => {
    c.backupAt = Date.now();
    c.backupDays = playDaysOf(c);
  });
}

/** Save a report card for each child in turn. Returns how many were saved. */
export async function backUpNow(app: App, kids: Child[]): Promise<number> {
  let saved = 0;
  for (const c of kids) {
    const ok = await saveTextFile(app, reportFileName(c, app.today), 'text/html', reportCardHtml(app, c, await makeBackup(c)));
    if (!ok) break;
    markBackedUp(app, c);
    saved++;
  }
  return saved;
}

export function lastBackupText(c: Child): string {
  if (!c.backupAt) return 'Never backed up';
  const days = Math.floor((Date.now() - c.backupAt) / DAY);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return `Last backup ${when}`;
}
