// Review fix 7: the Google Play build (MN_STORE=play) has no access keys, owner code, owner
// tools, approvals or test hooks in it; the shared APK still has them (its keys keep working).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error plain JavaScript modules used by the build
import { stripForPlay } from '../scripts/build.mjs';
// @ts-expect-error plain JavaScript modules used by the build
import { playBundle, scan, typecheckPlay } from '../scripts/check-play.mjs';
import { parseSave, freshSave } from '../src/storage/save.ts';

test('#unless play blocks are blanked line for line, and a broken or misspelt marker fails the build', () => {
  const src = ['a', '// #unless play', 'secret()', '  // #unless play', 'more()', '  // #end', '// #end', 'b'].join('\n');
  const out: string = stripForPlay(src);
  assert.equal(out.split('\n').length, 8, 'line numbers stay the same');
  assert.ok(out.includes('a') && out.includes('b'));
  assert.ok(!out.includes('secret') && !out.includes('more'));
  assert.throws(() => stripForPlay('// #unless play\nx()'), /without #end/);
  assert.throws(() => stripForPlay('x()\n// #end'), /without #unless/);
  assert.throws(() => stripForPlay('// #unless  play\nx()\n// #end'), /unknown marker/);
  assert.throws(() => stripForPlay('// #if play\nx()\n// #end'), /unknown marker/);
});

test('the Play build’s sources type-check once the blocks are gone', async () => {
  assert.equal(await typecheckPlay(), '');
});

test('the Play bundle has no keys, owner code, owner tools, approvals or test hooks', async () => {
  const html: string = await playBundle();
  assert.ok(html.includes('"store":"play"'), 'it is the Play build');
  assert.deepEqual(scan(html), []);
});

test('the shared APK keeps its keys, owner area and approvals', async () => {
  const before = process.env.MN_STORE;
  delete process.env.MN_STORE;
  const out = mkdtempSync(join(tmpdir(), 'mn-shared-'));
  try {
    // @ts-expect-error plain JavaScript module
    const { build } = await import('../scripts/build.mjs');
    build({ outDir: out });
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    const words = scan(html).map((f: { word: string }) => f.word);
    for (const w of ['isOwnerCode', 'accessState', 'myAccess', 'requestAccess', 'ownerHook', "the owner's email"]) assert.ok(words.includes(w), `shared build still has ${w}`);
  } finally {
    if (before !== undefined) process.env.MN_STORE = before;
    rmSync(out, { recursive: true, force: true });
  }
});

test('the Play build drops saved access keys; the shared build keeps them', () => {
  const raw = JSON.stringify({ ...freshSave(), access: { key: 'SHMK-TEST', maxDay: '2026-11-01', google: { email: 'a@b.c' } } });
  const g = globalThis as { __BUILD__?: { store?: string } };
  const before = g.__BUILD__;
  try {
    g.__BUILD__ = { store: '' };
    assert.equal(parseSave(raw)?.access?.key, 'SHMK-TEST');
    g.__BUILD__ = { store: 'play' };
    const d = parseSave(raw);
    assert.ok(d, 'the rest of the save still loads');
    assert.equal(d.access, undefined);
  } finally {
    g.__BUILD__ = before;
  }
});
