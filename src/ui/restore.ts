// Parent area → Restore from a report card: read an exported report card, check it, then add
// the child to this phone, or combine with the same child if they are already here.

import { esc, type App } from './app.ts';
import { newChild, type Child } from '../storage/save.ts';
import { readBackup, mergeChild } from '../core/backup.ts';
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
  const file = await pickTextFile('.html,.htm,text/html');
  if (!file) return;
  const r = await readBackup(file.text);
  if (!r.ok) return void app.toast(r.reason);
  const incoming = complete(r.backup.child);
  const saved = new Date(r.backup.exportedAt);
  const when = `${saved.getDate()} ${saved.toLocaleString('en', { month: 'short' })} ${saved.getFullYear()}`;
  const passed = Object.values(incoming.progress.levels).filter((l) => l.stars >= 1).length;
  const here = app.save.data.children.find((c) => c.id === incoming.id);
  const summary = `<p>Saved on <b>${esc(when)}</b>: age ${incoming.age}, ${passed} levels passed, ${Math.round(incoming.wallet.lifetime)} coins earned.</p>`;
  if (here) {
    const { result } = app.sheet(
      `<h2>${esc(incoming.name)} is already on this phone</h2>${summary}<p>Combine keeps the best of both phones: every level passed, all play days and statistics, and the jars from whichever phone earned more coins.</p>`,
      [
        { label: 'Combine progress', value: 'merge', kind: 'mint' },
        { label: 'Add as a separate child', value: 'new', kind: 'ghost' },
        { label: 'Cancel', value: 'cancel', kind: 'ghost', back: true },
      ],
      'Restore from a report card',
    );
    const v = await result;
    if (v === 'merge') {
      app.save.update((d) => {
        const i = d.children.findIndex((c) => c.id === here.id);
        d.children[i] = mergeChild(here, incoming, lastActive(incoming) > lastActive(here));
      });
      app.toast(`${incoming.name}’s progress from both phones is combined.`);
      done();
    } else if (v === 'new') {
      app.save.update((d) => d.children.push({ ...incoming, id: newChild(incoming.name, incoming.age, incoming.avatar, app.today).id }));
      app.toast(`${incoming.name} was added as a separate child.`);
      done();
    }
    return;
  }
  const { result } = app.sheet(`<h2>Add ${esc(incoming.name)} to this phone?</h2>${summary}<p>Stars, coins, jars, rewards and statistics all come across.</p>`, [
    { label: `Add ${incoming.name}`, value: true, kind: 'mint' },
    { label: 'Cancel', value: false, kind: 'ghost', back: true },
  ], 'Restore from a report card');
  if (!(await result)) return;
  app.save.update((d) => {
    d.children.push(incoming);
    d.setupDone = true;
  });
  app.toast(`${incoming.name} is on this phone now.`);
  done();
}
