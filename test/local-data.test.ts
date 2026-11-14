// Review fix 8: data kept on the phone. Reward photos go once no reward uses them; Android's own
// backup copies only MN's save; the wording says what is true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { photosInUse, unusedPhotos } from '../src/storage/photos.ts';
import { freshSave, type SaveData } from '../src/storage/save.ts';
import { addCoins, chooseReward, markGiven, freshWallet } from '../src/core/economy.ts';
import { REWARDS } from '../src/core/rewards.ts';
import { BACKUP_TEXT } from '../src/core/reminders.ts';
// @ts-expect-error plain JavaScript module used by the Android build script
import { BACKUP_RULES_XML, DATA_EXTRACTION_RULES_XML, SAVE_PREFS, backupAttributes } from '../scripts/android-backup.mjs';

const kid = (id: string, treat?: string, goal?: string) => {
  const wallet = freshWallet();
  wallet.treat.photo = treat;
  wallet.goal.photo = goal;
  return { id, wallet } as unknown as SaveData['children'][number];
};

test('photos in use: each child’s two jars, nothing else', () => {
  const d = { ...freshSave(), children: [kid('a', 'p1', 'p2'), kid('b', undefined, 'p3')] };
  d.children[0].wallet.earned.push({ rewardId: 'x', day: '2026-11-01', photo: 'pold' });
  assert.deepEqual([...photosInUse(d)].sort(), ['p1', 'p2', 'p3']);
});

test('the photos to delete: the ones not in use and not in an open picker', () => {
  assert.deepEqual(unusedPhotos(['p1', 'pold', 'pnew', 'p2'], new Set(['p1', 'p2']), new Set(['pnew'])), ['pold']);
  assert.deepEqual(unusedPhotos([], new Set(['p1'])), []);
});

test('a reward given keeps no photo, so its photo can be deleted', () => {
  const w = freshWallet();
  const choc = REWARDS.find((r) => r.name === 'Milk chocolate bar')!;
  assert.ok(chooseReward(w, choc.id, 'pagreed'));
  assert.equal(w.treat.photo, 'pagreed');
  addCoins(w, 1000);
  assert.ok(w.treat.waiting);
  assert.ok(markGiven(w, 'treat', '2026-11-15'));
  assert.equal(w.treat.photo, undefined);
  assert.equal(w.earned.at(-1)?.photo, undefined, 'the given reward doesn’t keep the photo');
  const d = { ...freshSave(), children: [{ id: 'a', wallet: w } as unknown as SaveData['children'][number]] };
  assert.deepEqual(unusedPhotos(['pagreed'], photosInUse(d)), ['pagreed']);
});

test('Android’s backup copies MN’s save only (not the sign-in, photos, reminders or caches)', () => {
  const javaPrefs = /PREFS = "([^"]+)"/.exec(readFileSync('native/android/java/com/studyhard/app/StudyHardPlugin.java', 'utf8'))?.[1];
  assert.equal(SAVE_PREFS, `${javaPrefs}.xml`, 'the rules name the file the save is written to');
  for (const xml of [BACKUP_RULES_XML, DATA_EXTRACTION_RULES_XML]) {
    const included = [...xml.matchAll(/<include domain="([^"]+)" path="([^"]+)"/g)].map((m) => `${m[1]}/${m[2]}`);
    assert.ok(included.length > 0 && included.every((p) => p === `sharedpref/${SAVE_PREFS}`), `only the save: ${included}`);
    assert.ok(!/domain="(root|file|database|external)"/.test(xml));
  }
  assert.ok(DATA_EXTRACTION_RULES_XML.includes('<cloud-backup>') && DATA_EXTRACTION_RULES_XML.includes('<device-transfer>'));
  const m = backupAttributes('<application\n        android:allowBackup="true"\n        android:icon="@mipmap/ic_launcher">');
  assert.ok(m.includes('android:fullBackupContent="@xml/backup_rules"'));
  assert.ok(m.includes('android:dataExtractionRules="@xml/data_extraction_rules"'));
  assert.throws(() => backupAttributes('<application android:icon="x">'), /anchor/);
});

test('the manifest is given the backup rules when the Android project is made', () => {
  const src = readFileSync('scripts/android.mjs', 'utf8');
  assert.ok(src.includes('backupAttributes(manifest)'));
  assert.ok(src.includes("'backup_rules.xml'") && src.includes("'data_extraction_rules.xml'"));
});

test('the wording no longer says progress is kept only on this phone', () => {
  assert.ok(!/only on this phone/.test(BACKUP_TEXT('Riya')));
  assert.ok(!/saved only on this phone/.test(readFileSync('src/ui/parent.ts', 'utf8')));
  assert.ok(/a label for each phone/.test(readFileSync('src/ui/cloud.ts', 'utf8')), 'the consent list names the phone label');
});

test('"Delete account and data" wipes what MN keeps on the phone outside the save', () => {
  const erase = readFileSync('src/ui/erase.ts', 'utf8');
  assert.ok(/await wipeLocal\(app\);\s*app\.save\.data = freshSave\(\);/.test(erase));
  const java = readFileSync('native/android/java/com/studyhard/app/StudyHardPlugin.java', 'utf8');
  const wipe = java.slice(java.indexOf('public void wipeLocal('), java.indexOf('}\n\n', java.indexOf('public void wipeLocal(')));
  for (const part of ['LocalData.deleteTree(photoDir())', 'Reminders.apply(ctx', 'Reminders.prefs(ctx).edit().clear()', 'cancelAll()', 'Widgets.updateAll(ctx)', '"share"']) {
    assert.ok(wipe.includes(part), `wipeLocal: ${part}`);
  }
});
