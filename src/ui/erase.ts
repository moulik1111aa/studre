// "Delete account and data" (Parent area → App): the online backup and the MN sign-in
// account are deleted, then everything MN keeps on this phone (the save, reward photos,
// reminders and notes, widget data and files made for sharing), and MN starts fresh.
// The same steps are described for people without the app at site/delete.html.

import type { App } from './app.ts';
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
  if (signedIn && !(await deleteCloudAccount(app))) {
    app.toast('Couldn’t reach the online backup to delete it. Connect to the internet and try again; nothing was deleted.', 6000);
    return;
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
