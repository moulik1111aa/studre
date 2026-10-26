// Backing up, for grown-ups: the "Grown-ups first" screen that opens the app when there is a
// week of unsaved progress (before the phone is handed to a child), and saving one report
// card per child. Every action here sits behind the grown-up check, so a child can only
// carry on to play; the screen comes back next time until a grown-up deals with it.

import { html, esc, type App, type Screen, type ScreenMaker } from './app.ts';
import type { Child } from '../storage/save.ts';
import { backupDue, DEFAULT_REMINDERS } from '../core/reminders.ts';
import { makeBackup } from '../core/backup.ts';
import { reportCardHtml, reportFileName } from './reportfile.ts';
import { saveTextFile } from '../platform/files.ts';
import { avatarHtml } from './icons.ts';
import { stagger } from '../render/motion.ts';

const DAY = 86_400_000;
const playDaysOf = (c: Child) => Object.values(c.stats.secondsByDay).filter((s) => s > 0).length;

/** Children with a week of unsaved progress (none while snoozed or switched off). */
export function dueKids(app: App, now = Date.now()): Child[] {
  const st = app.save.data.settings;
  if (!(st.reminders ?? DEFAULT_REMINDERS).backup || (st.backupSnoozeUntil ?? 0) > now) return [];
  return app.save.data.children.filter((c) => backupDue(c as never, now));
}

/** "Not today" for this run of the app: a child tapped "let me play". */
let passedThisRun = false;
export const gateNeeded = (app: App): boolean => !passedThisRun && dueKids(app).length > 0;

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

/** The grown-ups' backup screen. `kids` defaults to the children that need it. */
export function backupScreen(next: ScreenMaker, kids?: Child[]) {
  return (app: App): Screen => {
    const list = kids ?? dueKids(app);
    const all = list.length ? list : app.save.data.children;
    const names = all.map((c) => c.name);
    const who = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    const el = html(`<section class="screen bkgate" aria-label="Back up progress">
      <div class="scroll bk-body">
        <div class="bk-lock" aria-hidden="true">🔒</div>
        <h1 class="bk-title">Grown-ups first</h1>
        <p class="bk-lead">Before you hand over the phone, please back up ${esc(who)}’s progress.</p>
        <div class="card bk-why">
          <p><span aria-hidden="true">📱</span>Stars, coins, jars, rewards and the report are saved only on this phone.</p>
          <p><span aria-hidden="true">💥</span>If the phone is lost, broken, reset or swapped, they would start again from zero.</p>
          <p><span aria-hidden="true">📄</span>A report card file keeps it all safe. Save it to Google Drive or email it to yourself. It restores everything on any phone with MN (Parent area → Restore).</p>
        </div>
        <div class="bk-kids">${all
          .map((c) => {
            const fresh = playDaysOf(c) - (c.backupDays ?? 0);
            return `<div class="card bk-kid">${avatarHtml(c.avatar, 40)}<span><b>${esc(c.name)}</b><small>${lastBackupText(c)}${fresh > 0 ? ` · ${fresh} new day${fresh === 1 ? '' : 's'} of play` : ''}</small></span></div>`;
          })
          .join('')}</div>
        <p class="bk-note">It takes about 20 seconds. It needs the grown-up check, so children can’t do it by accident.</p>
      </div>
      <div class="bk-actions">
        <button class="btn bk-now">🔒 Back up now</button>
        <button class="btn ghost small bk-later">🔒 Remind me in 3 days</button>
        <button class="bk-kid-go">I’m a kid: let me play ›</button>
      </div>
    </section>`);
    const go = () => void app.show(next, 'fade');
    el.querySelector('.bk-now')!.addEventListener('click', async () => {
      if (!(await app.grownUp('Back up progress'))) return;
      const n = await backUpNow(app, all);
      if (n === all.length) {
        app.toast(n === 1 ? 'Backed up! Keep the file somewhere safe, like Google Drive.' : `Backed up ${n} report cards! Keep them somewhere safe.`);
        go();
      } else app.toast(n ? `Saved ${n} of ${all.length}. Tap Back up now to save the rest.` : 'Nothing was saved. Try again, or back up later from the Parent area.');
    });
    el.querySelector('.bk-later')!.addEventListener('click', async () => {
      if (!(await app.grownUp('Remind me later'))) return;
      app.save.update((d) => (d.settings.backupSnoozeUntil = Date.now() + 3 * DAY));
      app.toast('OK, we’ll remind you in 3 days.');
      go();
    });
    el.querySelector('.bk-kid-go')!.addEventListener('click', () => {
      passedThisRun = true;
      go();
    });
    return { el, mounted: () => stagger(el.querySelectorAll('.bk-body > *, .bk-actions > *'), { gap: 50 }) };
  };
}
