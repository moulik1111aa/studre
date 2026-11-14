// Backup files shared to MN (WhatsApp, Files, Gmail… → Share or Open with → MN): the phone hands
// the file to the app, which checks it is an MN backup, asks for a parent, and restores it
// the same way as "Restore from a backup file" in the Parent area.

import type { App } from './app.ts';
import { quietly } from '../platform/native.ts';
import { readAnyBackup } from '../core/familyfile.ts';
import { restoreFromText } from './restore.ts';
import { whosPlayingScreen } from './whos.ts';
import { lockSetupScreen } from './grownup.ts';

let busy = false;

/** A shared file's text arrived: restore it once the app is open and unlocked. */
export async function receiveShared(app: App, text: string, ready: () => boolean): Promise<void> {
  // Wait for the app to be usable (not locked, the opening video finished): up to 3 minutes.
  for (let i = 0; i < 90 && !ready(); i++) await new Promise((r) => setTimeout(r, 2000));
  if (!ready() || busy) return;
  busy = true;
  try {
    const r = await readAnyBackup(text);
    if (!r.ok) return void app.toast('That file is not an MN backup. Share the backup file saved from MN’s Parent area.', 5000);
    const names = r.backups.map((b) => b.child.name).join(', ');
    app.toast(`Backup file received: ${names}.`, 3000);
    if (!(await app.grownUp('Restoring from a backup file'))) return;
    await restoreFromText(app, text, () => void app.show(app.save.data.settings.parentPin ? whosPlayingScreen : lockSetupScreen(whosPlayingScreen, true)));
  } finally {
    busy = false;
  }
}

/** Why the phone didn't read a shared file (StudyHardPlugin / SharedInbox.java), in words. */
const REFUSED: Record<string, string> = {
  'too-big': 'That file is too big to be an MN backup. Share the backup file saved from MN’s Parent area.',
  unsupported: 'MN can’t open that file from there. Share the backup file from Files, Drive, Gmail or WhatsApp.',
  unreadable: 'MN couldn’t read that file. Try sharing it again.',
};

/** A file the phone handed over: restore it, or say why it couldn't be read. */
export async function handleShared(app: App, f: { text?: string; error?: string } | null | undefined, ready: () => boolean): Promise<void> {
  if (f?.text) return receiveShared(app, f.text, ready);
  if (f?.error) app.toast(REFUSED[f.error] ?? REFUSED.unreadable, 6000);
}

/** Listen for files shared to MN (Android), and take one that opened the app. */
export function startInbox(app: App, ready: () => boolean): void {
  const native = app.native;
  const take = async () => {
    try {
      await handleShared(app, await native?.sharedFile?.(), ready);
    } catch {
      /* older app: no sharing */
    }
  };
  try {
    quietly(native?.addListener?.('shared', () => void take()));
  } catch {
    /* older app */
  }
  setTimeout(() => void take(), 800);
  // Browser test runs: hand in a file's text directly (not in the Play build).
  // #unless play
  if (app.debug) Object.assign(window, { __share: (text: string) => receiveShared(app, text, ready), __shared: (f: { text?: string; error?: string }) => handleShared(app, f, ready) });
  // #end
}
