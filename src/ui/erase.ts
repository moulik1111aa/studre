// "Delete account and data" (Parent area → App): the online backup and the MN sign-in
// account are deleted, then everything MN keeps on this phone (the save, reward photos,
// reminders and notes, widget data and files made for sharing), and MN starts fresh.
// The same steps are described for people without the app at site/delete.html.

import { esc, type App } from './app.ts';
import { freshSave } from '../storage/save.ts';
import { account, deleteCloudAccount } from './cloud.ts';

/** Everything MN keeps on this phone outside the save: reward photos, reminders and notes,
 * the widget data and the files made for sharing. */
export async function wipeLocal(app: App): Promise<void> {
  try {
    if (app.native?.wipeLocal) {
      await app.native.wipeLocal();
      return;
    }
    await app.photos.clear();
    await app.native?.setReminders?.({ plan: JSON.stringify({ items: [] }) });
  } catch (e) {
    console.error('wipe', e);
  }
}

export async function eraseEverything(app: App): Promise<void> {
  const signedIn = !!account(app);
  const { result } = app.sheet(
    `<h2>Delete account and data?</h2>
    <p>This deletes, for good:</p>
    <ul class="er-list"><li>every child’s progress, rewards, reward photos and settings on this phone, and MN’s reminders</li>${signedIn ? '<li>your family’s online backup</li><li>your MN sign-in (your Google account itself is not touched)</li>' : ''}</ul>
    <p class="fine">Backup files you saved yourself (in Google Drive or email) stay where you put them. An MN × subscription is not cancelled by this: cancel it in Google Play → Payments &amp; subscriptions.</p>`,
    [
      { label: 'Delete everything', value: true, kind: 'danger' },
      { label: 'Cancel', value: false, kind: 'ghost', back: true },
    ],
    'Delete account and data',
  );
  if (!(await result)) return;
  // Online first (Google may ask the parent to confirm). Each message says exactly what is deleted.
  while (signedIn) {
    const r = await deleteCloudAccount(app);
    if (r.result === 'done') break;
    if (r.result === 'cancelled') return void app.toast('Nothing was deleted.', 4000);
    if (r.result === 'nothing') return void app.toast(`Nothing was deleted. ${r.why} Please try again.`, 6000);
    const what = r.result === 'some' ? 'Some of your family’s online backup is deleted, but not all of it, and your MN sign-in isn’t.' : 'Your family’s online backup is deleted, but your MN sign-in isn’t.';
    const again = app.sheet(
      `<h2>Not finished yet</h2><p>${esc(what)} Nothing on this phone is deleted yet.</p><p class="fine">${esc(r.why)}</p>`,
      [
        { label: 'Try again', value: true, kind: 'mint' },
        { label: 'Stop here', value: false, kind: 'ghost', back: true },
      ],
      'Delete account and data',
    );
    if (!(await again.result)) return;
  }
  await wipeLocal(app);
  app.save.data = freshSave();
  app.save.save();
  app.save.save();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('studyhard.') && k !== 'studyhard.device') localStorage.removeItem(k);
  } catch {
    /* fine */
  }
  app.toast('Everything is deleted.', 3000);
  setTimeout(() => location.reload(), 1200);
}
