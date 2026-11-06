// Parent area → Restore from a report card: read an exported report card, check it, then add
// the child to this phone, or combine with the same child if they are already here.

import { esc, type App } from './app.ts';
import { newChild, type Child } from '../storage/save.ts';
import { mergeChild, type Backup } from '../core/backup.ts';
import { readAnyBackup } from '../core/familyfile.ts';
import { familyRules, sameRules } from '../core/cloud.ts';
import { account, syncNow } from './cloud.ts';
import { pickTextFile } from '../platform/files.ts';

/** The latest moment we know this child played (ms). */
function lastActive(c: Child): number {
  const fromLog = c.log?.length ? c.log[c.log.length - 1].t : 0;
  const days = Object.keys(c.stats?.secondsByDay ?? {}).filter((d) => (c.stats.secondsByDay[d] ?? 0) > 0).sort();
  const fromDays = days.length ? new Date(`${days[days.length - 1]}T23:59:00`).getTime() : 0;
  return Math.max(fromLog, fromDays);
}

/** Fill in anything an older backup didn't have, the same way a saved file is read. */
function complete(c: Child): Child {
  const base = newChild(c.name, c.age ?? 6, c.avatar ?? 0, c.createdDay ?? '');
  return { ...base, ...c, progress: { ...base.progress, ...c.progress }, wallet: { ...base.wallet, ...c.wallet }, stats: { ...base.stats, ...c.stats }, undo: [] };
}

export async function restoreFromFile(app: App, done: () => void): Promise<void> {
  const file = await pickTextFile('.html,.htm,.json,text/html,application/json');
  if (!file) return;
  await restoreFromText(app, file.text, done);
}

/** Restore from a backup file's text (picked, or shared to MN from WhatsApp, Files…). */
export async function restoreFromText(app: App, text: string, done: () => void): Promise<void> {
  const r = await readAnyBackup(text);
  if (!r.ok) return void app.toast(r.reason);
  let changed = false;
  for (const b of r.backups) changed = (await restoreChild(app, b, r.family)) || changed;
  // A family file also carries the family's rules (time limits, quiet hours…).
  if (r.rules && !sameRules(r.rules, familyRules(app.save.data.settings))) {
    const { result } = app.sheet('<h2>Use the rules from the file?</h2><p>The file also has your family’s daily time limit, quiet hours and reward pace. Use those on this phone, or keep this phone’s?</p>', [
      { label: 'Use the file’s rules', value: true, kind: 'mint' },
      { label: 'Keep this phone’s', value: false, kind: 'ghost', back: true },
    ], 'Rules from the file');
    if (await result) {
      app.save.update((d) => Object.assign(d.settings, r.rules));
      changed = true;
    }
  }
  if (!changed) return;
  // Signed in with Google: the cloud copy takes the restored progress straight away.
  if (account(app)) void syncNow(app);
  done();
}

/** Add one child from a backup, or combine with the same child already on this phone. */
async function restoreChild(app: App, b: Backup, inFamily: boolean): Promise<boolean> {
  const incoming = complete(b.child);
  const saved = new Date(b.exportedAt);
  const when = `${saved.getDate()} ${saved.toLocaleString('en', { month: 'short' })} ${saved.getFullYear()}`;
  const passed = Object.values(incoming.progress.levels).filter((l) => l.stars >= 1).length;
  const here = app.save.data.children.find((c) => c.id === incoming.id);
  const title = inFamily ? 'Restore from a backup file' : 'Restore from a report card';
  const summary = `<p>Saved on <b>${esc(when)}</b>: age ${incoming.age}, ${passed} levels passed, ${Math.round(incoming.wallet.lifetime)} coins earned.</p>`;
  if (here) {
    const { result } = app.sheet(
      `<h2>${esc(incoming.name)} is already on this phone</h2>${summary}<p>Combine keeps the best of both: every level passed, all play days and statistics, and the jars from whichever side earned more coins.</p>`,
      [
        { label: 'Combine progress', value: 'merge', kind: 'mint' },
        { label: 'Add as a separate child', value: 'new', kind: 'ghost' },
        { label: inFamily ? 'Skip this child' : 'Cancel', value: 'cancel', kind: 'ghost', back: true },
      ],
      title,
    );
    const v = await result;
    if (v === 'merge') {
      app.save.update((d) => {
        const i = d.children.findIndex((c) => c.id === here.id);
        d.children[i] = mergeChild(here, incoming, lastActive(incoming) > lastActive(here));
      });
      app.toast(`${incoming.name}’s progress is combined.`);
      return true;
    }
    if (v === 'new') {
      app.save.update((d) => d.children.push({ ...incoming, id: newChild(incoming.name, incoming.age, incoming.avatar, app.today).id }));
      app.toast(`${incoming.name} was added as a separate child.`);
      return true;
    }
    return false;
  }
  const { result } = app.sheet(`<h2>Add ${esc(incoming.name)} to this phone?</h2>${summary}<p>Stars, coins, jars, rewards and statistics all come across.</p>`, [
    { label: `Add ${incoming.name}`, value: true, kind: 'mint' },
    { label: inFamily ? 'Skip' : 'Cancel', value: false, kind: 'ghost', back: true },
  ], title);
  if (!(await result)) return false;
  app.save.update((d) => {
    d.children.push(incoming);
    d.setupDone = true;
  });
  app.toast(`${incoming.name} is on this phone now.`);
  return true;
}
