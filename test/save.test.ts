// Saving must never fail silently (review fix 2). The WebView gives MN about 5.2 million
// characters of storage; these tests use a store with that limit, a phone copy like the one
// StudyHardPlugin.java keeps, and saves as large as a busy family's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveStore, newChild, parseSave, revOf, browserStorage, PRIMARY, BACKUP, UNREADABLE, type Child, type StorageAdapter } from '../src/storage/save.ts';
import { nativeStorage, type StudyHardPlugin } from '../src/platform/native.ts';
import { allSkills } from '../src/core/areas/index.ts';
import { makeQuestion, noteAsked, historyId } from '../src/core/path.ts';
import { createRng } from '../src/core/rng.ts';
import { LOG_MAX, type PlayEntry } from '../src/core/stats.ts';

/** localStorage as Chromium's WebView behaves: a fixed number of characters across all keys. */
class QuotaStorage implements Storage {
  private readonly m = new Map<string, string>();
  private readonly quota: number;
  constructor(quota = 5_200_000) {
    this.quota = quota;
  }
  get length(): number {
    return this.m.size;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    let used = 0;
    for (const [key, val] of this.m) if (key !== k) used += key.length + val.length;
    if (used + k.length + v.length > this.quota) throw new Error('QuotaExceededError');
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
}

/** A fresh WebView (new page) over the same stored data: browserStorage with its own memory. */
function webview(ls: Storage): StorageAdapter {
  (globalThis as { localStorage?: Storage }).localStorage = ls;
  return browserStorage();
}

/** The phone's own copy (SharedPreferences), with a bridge that can be slow. */
function phone(values: Record<string, string> = {}, readDelay = 0) {
  const writes: string[] = [];
  const plugin = {
    readSave: () => new Promise<{ values: Record<string, string> }>((res) => setTimeout(() => res({ values: { ...values } }), readDelay)),
    writeSave: async ({ key, value }: { key: string; value: string }) => {
      writes.push(key);
      values[key] = value;
      return { ok: true };
    },
  } as unknown as StudyHardPlugin;
  return { plugin, values, writes };
}

// Real question keys, as build 76 kept them in the history (up to 35 KB for picture questions).
const SKILLS = allSkills().slice(0, 200);
const OLD_HISTORY: Record<string, string[]> = {};
for (const s of SKILLS) {
  const rng = createRng(s.id);
  const keys: string[] = [];
  for (let i = 0; i < 50; i++) keys.push(makeQuestion(s, rng, (i % 10) / 10, new Set(keys)).key);
  OLD_HISTORY[s.id] = keys;
}

function busyChild(n: number): Child {
  const c = newChild(`Child ${n}`, 6 + n, n, '2026-01-01');
  for (const s of SKILLS) {
    c.progress.levels[`${s.id}#1`] = { stars: 3, passes: 2 };
    c.progress.lastSeen[s.id] = '2026-11-01';
    c.progress.history[s.id] = [...OLD_HISTORY[s.id]];
  }
  c.log = Array.from({ length: LOG_MAX }, (_, i): PlayEntry => ({ t: 1.7e12 + i * 6e4, d: '2026-11-01', id: `${SKILLS[i % 200].id}#1`, k: 'skill', st: 1, tier: 1, sc: 9, of: 10, s: 3, sec: 95, c: 12 }));
  return c;
}

/** A build-76 save as it would be on the phone: full question keys in the history. With
 *  `upTo`, older history is dropped until the save is that long. */
function oldSave(upTo = Infinity): string {
  const save = { version: 1, setupDone: true, children: [busyChild(1), busyChild(2), busyChild(3)], activeChildId: null, settings: {}, faceoff: {} };
  let extra = JSON.stringify(save).length - upTo;
  for (let i = 0; extra > 0; i++) {
    const h = save.children[i % 3].progress.history[SKILLS[Math.floor(i / 3) % 200].id];
    if (h.length) extra -= h.shift()!.length + 3;
  }
  return JSON.stringify(save);
}

test('history keeps short fingerprints, and an old full-key history is converted on load', () => {
  const s = SKILLS.find((x) => x.format === 'picture') ?? SKILLS[0];
  const c = newChild('A', 7, 0, '2026-01-01');
  const q = makeQuestion(s, createRng('x'), 0.5, new Set());
  noteAsked(c.progress, [q], '2026-11-01');
  const h = c.progress.history[s.id];
  assert.equal(h.length, 1);
  assert.ok(h[0].length <= 12 && h[0].startsWith('~'), h[0]);
  assert.equal(h[0], historyId(q.key));
  assert.equal(historyId(h[0]), h[0], 'a fingerprint stays as it is');
  // A question in the history is avoided by its fingerprint.
  const rng = createRng('same');
  const first = makeQuestion(s, rng, 0.5, new Set());
  let repeats = 0;
  for (let i = 0; i < 30; i++) {
    const again = makeQuestion(s, createRng('same'), 0.5, new Set([historyId(first.key)]));
    if (again.key === first.key) repeats++;
  }
  assert.equal(repeats, 0);
  // An old save's history (full keys) reads back as fingerprints, newest last, at most 50.
  const raw = JSON.parse(oldSave());
  const loaded = parseSave(JSON.stringify(raw))!;
  for (const ch of loaded.children) {
    for (const sk of SKILLS) {
      const hist = ch.progress.history[sk.id];
      assert.equal(hist.length, 50);
      assert.deepEqual(hist, OLD_HISTORY[sk.id].map(historyId));
    }
  }
});

test('3 children, 200 skills each and 2,000 log entries each: saves, reloads, shows the last change', () => {
  const ls = new QuotaStorage();
  assert.ok(oldSave().length > 2_600_000, 'with full question keys, two copies of a save this busy don\'t fit');
  // Build 76 on a phone: the save and its spare copy, together just under the limit. The next
  // save is a little bigger, and in build 76 it silently didn't fit.
  const big = oldSave(2_595_000);
  ls.setItem(PRIMARY, big);
  ls.setItem(BACKUP, big);
  const store = new SaveStore(webview(ls));
  assert.equal(store.data.children.length, 3);
  let trouble: unknown = 'not called';
  store.onTrouble((t) => (trouble = t));
  store.update((d) => {
    d.children[2].wallet.lifetime = 4321;
    d.children[2].progress.levels['last.change#1'] = { stars: 2, passes: 1 };
    for (let i = 0; i < 300; i++) d.children[2].progress.levels[`more.levels${i}#1`] = { stars: 1, passes: 1 };
  });
  assert.equal(store.trouble, null);
  assert.equal(trouble, 'not called', 'no trouble message');
  const again = new SaveStore(webview(ls));
  assert.equal(again.loadedFrom, 'primary');
  assert.equal(again.data.children[2].wallet.lifetime, 4321);
  assert.deepEqual(again.data.children[2].progress.levels['last.change#1'], { stars: 2, passes: 1 });
  assert.equal(again.data.children[0].log!.length, LOG_MAX);
  // And it keeps saving: ten more saves, each one there after a restart.
  for (let i = 0; i < 10; i++) again.update((d) => (d.children[0].wallet.lifetime = i));
  assert.equal(new SaveStore(webview(ls)).data.children[0].wallet.lifetime, 9);
});

test('when the WebView cannot store the save: the parent is told, and after a restart the newer phone copy loads', async () => {
  const ls = new QuotaStorage();
  const ph = phone();
  // A normal start: the phone's copy is read first, then both copies are written.
  let store = new SaveStore(await nativeStorage(ph.plugin, webview(ls)));
  store.update((d) => d.children.push(newChild('Asha', 7, 1, '2026-11-01')));
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(ph.writes.includes(PRIMARY));
  const before = store.data.rev!;
  // Now the WebView's storage refuses every write.
  ls.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  const told: unknown[] = [];
  store.onTrouble((t) => told.push(t));
  store.update((d) => (d.children[0].wallet.lifetime = 777));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.trouble, 'full');
  assert.deepEqual(told, ['full'], 'the parent is told once');
  assert.equal(revOf(ph.values[PRIMARY]), before + 1, 'the phone copy has the newer save');
  assert.notEqual(ls.getItem(PRIMARY), ph.values[PRIMARY], 'the WebView still holds the older save');
  // Restart: a new page over the same WebView storage and the same phone copy.
  store = new SaveStore(await nativeStorage(ph.plugin, webview(ls)));
  assert.equal(store.data.children[0].wallet.lifetime, 777);
  assert.equal(store.data.rev, before + 1);
});

test('a full WebView first drops the spare copy, then saves', () => {
  const ls = new QuotaStorage(5_200_000);
  const store = new SaveStore(webview(ls));
  store.update((d) => d.children.push(newChild('Big', 9, 2, '2026-11-01')));
  // Room for the save and most of a second copy, but not both.
  ls.removeItem(BACKUP);
  const size = ls.getItem(PRIMARY)!.length;
  ls.setItem('filler', 'x'.repeat(5_200_000 - Math.floor(1.6 * size) - 40));
  store.update((d) => (d.children[0].wallet.lifetime = 66));
  assert.equal(store.trouble, null);
  assert.equal(ls.getItem(BACKUP), null, 'the spare copy made room');
  assert.equal(new SaveStore(webview(ls)).data.children[0].wallet.lifetime, 66);
});

test('the phone copy is never written before it has been read', async () => {
  const ls = new QuotaStorage();
  const newer = JSON.stringify({ version: 1, rev: 50, setupDone: true, children: [newChild('Phone', 8, 0, '2026-01-01')], activeChildId: null, settings: {}, faceoff: {} });
  const ph = phone({ [PRIMARY]: newer }, 200);
  // The read is slow: the session starts from the WebView copy (here, nothing).
  const store = new SaveStore(await nativeStorage(ph.plugin, webview(ls), 20));
  store.update((d) => d.children.push(newChild('Here', 5, 0, '2026-11-01')));
  await new Promise((r) => setTimeout(r, 300));
  store.update((d) => (d.children[0].wallet.lifetime = 1));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(ph.writes, [], 'the newer phone copy is left alone');
  assert.equal(revOf(ph.values[PRIMARY]), 50);
  // Next start reads it in time, and it wins.
  const next = new SaveStore(await nativeStorage(phone(ph.values).plugin, webview(ls)));
  assert.equal(next.data.children[0].name, 'Phone');
});

test('the newer of the two copies wins on start; a tie keeps the WebView copy', async () => {
  const mk = (rev: number, name: string) => JSON.stringify({ version: 1, rev, setupDone: true, children: [newChild(name, 8, 0, '2026-01-01')], activeChildId: null, settings: {}, faceoff: {} });
  for (const [web, nat, want] of [[3, 7, 'N'], [7, 3, 'W'], [5, 5, 'W'], [-1, 2, 'N']] as const) {
    const ls = new QuotaStorage();
    if (web >= 0) ls.setItem(PRIMARY, mk(web, 'W'));
    const store = new SaveStore(await nativeStorage(phone({ [PRIMARY]: mk(nat, 'N') }).plugin, webview(ls)));
    assert.equal(store.data.children[0].name, want, `web ${web}, phone ${nat}`);
  }
  // Old saves (no counter) count as 0; a damaged one can't win.
  assert.equal(revOf(JSON.stringify({ version: 1, children: [] })), 0);
  assert.equal(revOf('{"version":1,"rev":12,"setupDone":true}'), 12);
  assert.equal(revOf('not a save'), -1);
});

test('when no copy can be read, the text is kept aside before anything new is saved', () => {
  const ls = new QuotaStorage();
  ls.setItem(PRIMARY, '{"version":1,"children":[{"id":"c1","name":"Zo');
  ls.setItem(BACKUP, 'also broken');
  const store = new SaveStore(webview(ls));
  assert.equal(store.loadedFrom, 'reset');
  assert.equal(store.unreadableCopy(), '{"version":1,"children":[{"id":"c1","name":"Zo');
  store.update((d) => d.children.push(newChild('New', 5, 0, '2026-11-01')));
  // A second fresh start doesn't replace the kept text.
  ls.setItem(PRIMARY, 'broken again');
  ls.setItem(BACKUP, 'broken again');
  new SaveStore(webview(ls)).save();
  assert.equal(ls.getItem(UNREADABLE), '{"version":1,"children":[{"id":"c1","name":"Zo');
});

test('saving does not read and check the previous save again', () => {
  const ls = new QuotaStorage();
  ls.setItem(PRIMARY, oldSave());
  const store = new SaveStore(webview(ls));
  store.save();
  const parse = JSON.parse;
  let calls = 0;
  JSON.parse = ((...a: Parameters<typeof JSON.parse>) => (calls++, parse(...a))) as typeof JSON.parse;
  try {
    for (let i = 0; i < 5; i++) store.update((d) => (d.children[0].wallet.lifetime = i));
  } finally {
    JSON.parse = parse;
  }
  assert.equal(calls, 0);
  // The spare copy is the save before the last one.
  assert.equal(parseSave(ls.getItem(BACKUP)!)!.children[0].wallet.lifetime, 3);
});
