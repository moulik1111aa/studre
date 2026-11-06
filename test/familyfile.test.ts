import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChild } from '../src/storage/save.ts';
import { makeBackup } from '../src/core/backup.ts';
import { decodeChild, encodeChild } from '../src/core/cloud.ts';
import { familyFileOf, familyJson, makeFamilyFile, readAnyBackup } from '../src/core/familyfile.ts';

const kid = (name: string) => {
  const c = newChild(name, 8, 1, '2026-11-01');
  c.progress.levels['s1.count3#1'] = { stars: 3, passes: 1 };
  c.progress.history = { 's1.count3': ['a', 'b'] };
  c.wallet.lifetime = 120;
  c.backupAt = 123;
  return c;
};
const page = (json: string) => `<html><body><script type="application/json" id="mn-family-backup">${json}</script></body></html>`;

test('a family file restores every child, and holds exactly what the cloud keeps', async () => {
  const a = kid('Asha'), b = kid('Ben');
  const f = await makeFamilyFile([a, b], { limitMinutes: 25 }, 'phone');
  const r = await readAnyBackup(page(familyJson(f)));
  assert.ok(r.ok && r.family);
  if (!r.ok) return;
  assert.deepEqual(r.backups.map((x) => x.child.name), ['Asha', 'Ben']);
  assert.equal(r.rules?.limitMinutes, 25);
  // The same child as the cloud stores it: no question history, no phone-only backup time.
  const cloud = await decodeChild(await encodeChild(a, 'phone-1', Date.now()));
  assert.ok(cloud.ok);
  if (!cloud.ok) return;
  assert.deepEqual(r.backups[0].child, cloud.backup.child);
  assert.deepEqual(r.backups[0].child.progress.history, {});
  assert.equal(r.backups[0].child.backupAt, undefined);
});

test('a file downloaded from the cloud reads the same way', async () => {
  const docs = await Promise.all([kid('Asha'), kid('Ben')].map((c) => encodeChild(c, 'p', Date.now())));
  const backups = [];
  for (const d of docs) {
    const x = await decodeChild(d);
    assert.ok(x.ok);
    if (x.ok) backups.push(x.backup);
  }
  const r = await readAnyBackup(page(familyJson(familyFileOf(backups, {}, 'cloud'))));
  assert.ok(r.ok && r.source === 'cloud' && r.backups.length === 2);
});

test('a single report card still restores, and an edited family file is refused', async () => {
  const one = await makeBackup(kid('Asha'));
  const r1 = await readAnyBackup(`<script type="application/json" id="mn-backup">${JSON.stringify(one)}</script>`);
  assert.ok(r1.ok && !r1.family && r1.backups.length === 1);
  const f = await makeFamilyFile([kid('Asha')], {}, 'phone');
  f.children[0].child.wallet.lifetime = 99999;
  const r2 = await readAnyBackup(page(familyJson(f)));
  assert.equal(r2.ok, false);
});
