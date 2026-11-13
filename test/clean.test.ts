// Backup files, the online backup and the saved copy are untrusted: anyone can make a file whose
// check value matches. These tests import hostile files and check nothing unsafe gets through,
// and that files and saves made by build 76 still read back unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBackup, readBackup } from '../src/core/backup.ts';
import { readAnyBackup } from '../src/core/familyfile.ts';
import { cleanChild, cleanRules, cleanFamilyDoc, cleanSavedSettings, AVATAR_COUNT } from '../src/core/clean.ts';
import { FAMILY_KEYS } from '../src/core/cloud.ts';
import { newChild, parseSave, type Child } from '../src/storage/save.ts';
import { historyId } from '../src/core/path.ts';
import { costOf, jarOf, aboutOf, setOwnRewards, ownRewards, type Reward } from '../src/core/rewards.ts';
import { AVATARS, avatarHtml } from '../src/ui/icons.ts';

const MARKUP = '<img src=x onerror="window.__pwn=1">';
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
/** A file with a valid check value around any child at all (the phrase is in the bundle, so anyone can). */
const forged = async (change: (c: Record<string, unknown>) => void): Promise<string> => {
  const c = newChild('Riya', 8, 2, '2026-10-01') as unknown as Record<string, unknown>;
  change(c);
  return JSON.stringify(await makeBackup(c as unknown as Child, new Date('2026-11-12T10:00:00Z')));
};
const noMarkup = (v: unknown) => assert.ok(!/[<>]/.test(JSON.stringify(v)), `markup survived: ${JSON.stringify(v).slice(0, 200)}`);

test('attack file 1: an age that is markup becomes a number', async () => {
  const r = await readBackup(await forged((c) => (c.age = MARKUP)));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.backup.child.age, 6);
  noMarkup(r.backup.child);
});

test('attack file 2: an id that breaks out of an attribute is refused with a plain message', async () => {
  const r = await readBackup(await forged((c) => (c.id = `c"><img src=x onerror=alert(1)>`)));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'This progress file is missing some of its data.');
  // A name that isn't text is refused too.
  assert.equal((await readBackup(await forged((c) => (c.name = { toString: 1 })))).ok, false);
});

test('attack file 3: an avatar that is not a number becomes the first avatar, and drawing never throws', async () => {
  const r = await readBackup(await forged((c) => (c.avatar = 'none')));
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.backup.child.avatar, 0);
  assert.equal(AVATAR_COUNT, AVATARS.length);
  for (const bad of ['none', -1, 1e9, NaN, null, undefined, {}, 2.5]) assert.match(avatarHtml(bad as number, 'x' as unknown as number), /^<span class="avatar"/);
});

test('every field of an imported child is typed: wrong kinds become safe defaults, unknown fields go', async () => {
  const r = await readBackup(
    await forged((c) => {
      c.wallet = { treat: { rewardId: MARKUP, coins: MARKUP, waiting: 'yes', photo: '../../x' }, goal: null, lifetime: '1e9', lastPlayDay: MARKUP, earned: [{ rewardId: 'sweets.kitkat', day: '2026-13-99' }, { rewardId: MARKUP, day: '2026-11-01' }, { rewardId: 'sweets.kitkat', day: '2026-11-01' }] };
      c.progress = { levels: { 's1.count5#1': { stars: 99, passes: MARKUP }, [MARKUP]: { stars: 3, passes: 1 }, __proto__x: 5 }, skipped: { 's1.a': 'yes', 's1.b': true }, lastSeen: { 's1.a': MARKUP, 's1.b': '2026-11-01' }, history: { 's1.a': [1, 'k1', 'k2'] } };
      c.stats = { answered: Infinity, correct: -5, secondsByDay: { '2026-11-01': 600, [MARKUP]: 5, '2026-11-02': MARKUP } };
      c.bossesBeaten = ['b1', MARKUP, 7];
      c.challenge = 9;
      c.tester = true;
      c.parentPin = 'x:y';
      c.evil = MARKUP;
      c.voiceName = MARKUP.repeat(20);
      c.adventure = { on: 'yes', claimed: { 'd:2026-11-01': 5, bad: MARKUP }, badges: MARKUP, cheered: { '2026-11-01': ['q.a', MARKUP] }, equipped: { hat: MARKUP }, pet: { species: 'fox', name: MARKUP, hatchedAt: MARKUP } };
      c.log = [{ t: 1, d: '2026-11-01', id: 's1.a#1', k: 'skill', st: 1, sc: 8, of: 10, s: 2, sec: 30, c: 5, a: { 's1.a': [10, 8, 300] } }, { t: MARKUP }, MARKUP];
      c.lastPlay = { day: '2026-11-01', levelId: 's1.a#1', name: MARKUP, score: MARKUP, total: 10, stars: 2 };
      c.school = MARKUP;
      c.fixit = { 's1.a': { d: 0.4, n: 2, h: [[1, 0, '2026-11-03'], [1, 0, MARKUP]] }, 's1.b': MARKUP };
      c.exams = [{ t: 1, d: '2026-11-01', n: 10, ok: 8, sec: 60, limit: 0, skills: { 's1.a': [5, 4] } }, MARKUP];
    }),
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  const c = r.backup.child as Child & Record<string, unknown>;
  assert.deepEqual(c.wallet.treat, { rewardId: null, coins: 0, waiting: false });
  assert.deepEqual(c.wallet.goal, { rewardId: null, coins: 0, waiting: false });
  assert.equal(c.wallet.lifetime, 0);
  assert.equal(c.wallet.lastPlayDay, null);
  assert.deepEqual(c.wallet.earned, [{ rewardId: 'sweets.kitkat', day: '2026-11-01' }]);
  assert.deepEqual(c.progress.levels, { 's1.count5#1': { stars: 3, passes: 0 } });
  assert.deepEqual(c.progress.skipped, { 's1.b': true });
  assert.deepEqual(c.progress.lastSeen, { 's1.b': '2026-11-01' });
  assert.deepEqual(c.progress.history, { 's1.a': ['k1', 'k2'].map(historyId) });
  assert.deepEqual(c.stats, { answered: 0, correct: 0, secondsByDay: { '2026-11-01': 600 } });
  assert.deepEqual(c.bossesBeaten, ['b1']);
  assert.equal(c.challenge, 2);
  assert.equal(c.tester, undefined);
  assert.equal(c.parentPin, undefined);
  assert.equal(c.evil, undefined);
  assert.equal(c.voiceName!.length, 120);
  assert.equal(c.adventure!.on, true);
  assert.deepEqual(c.adventure!.claimed, { 'd:2026-11-01': 5 });
  assert.deepEqual(c.adventure!.badges, {});
  assert.deepEqual(c.adventure!.cheered, { '2026-11-01': ['q.a'] });
  assert.deepEqual(c.adventure!.equipped, {});
  assert.equal(c.adventure!.pet!.name, 'img src=x o');
  assert.equal(c.log!.length, 1);
  assert.equal(c.lastPlay!.score, 0);
  assert.equal(c.school, undefined);
  assert.deepEqual(Object.keys(c.fixit!), ['s1.a']);
  assert.equal(c.fixit!['s1.a'].h.length, 1);
  assert.equal(c.exams!.length, 1);
  // The only free text left is the child's own name-like strings, which every screen escapes.
  noMarkup({ ...c, voiceName: '', lastPlay: { ...c.lastPlay, name: '' } });
});

test('family rules from a file: only the shared rules, each in range; never a PIN, an unknown key or a bad tier', async () => {
  const rules = cleanRules({
    parentPin: 'salt:hash',
    theme: 'glass',
    swipeOn: true,
    evil: MARKUP,
    limitMinutes: MARKUP,
    timerSeconds: -4,
    timeUpMode: 'explode',
    treatPace: 2,
    goalPace: 1e9,
    holiday: 'yes',
    hiddenCategories: ['sweets', MARKUP, 'nope'],
    confirmAnswers: true,
    ownRewards: [
      { id: 'own.abc', name: 'Pani puri', icon: '🍕', tier: 'small' },
      { id: 'own.bad1', name: 'Bad tier', icon: '🍕', tier: 'huge' },
      { id: 'own.bad2', name: MARKUP, icon: MARKUP, tier: 'small' },
      { id: MARKUP, name: 'Bad id', icon: '🍕', tier: 'small' },
      { id: 'own.abc', name: 'Twice', icon: '🍕', tier: 'small' },
      MARKUP,
    ],
    quiet: { bed: { on: true, from: MARKUP, to: '07:00' }, school: { on: 'x', from: '08:00', to: '25:99', days: [1, 9, MARKUP, 1] } },
  });
  // Exactly the keys the app shares, and nothing else.
  for (const k of Object.keys(rules)) assert.ok((FAMILY_KEYS as readonly string[]).includes(k), k);
  assert.deepEqual(rules, {
    treatPace: 2,
    hiddenCategories: ['sweets'],
    confirmAnswers: true,
    ownRewards: [
      { id: 'own.abc', name: 'Pani puri', icon: '🍕', tier: 'small' },
      { id: 'own.bad2', name: MARKUP.slice(0, 40), icon: '🎁', tier: 'small' },
    ],
    quiet: { bed: { on: true, from: '21:00', to: '07:00' }, school: { on: false, from: '08:00', to: '14:00', days: [1] } },
  });
  // In a family file, the rules block (which has no check value) goes through the same cleaning.
  const fam = JSON.parse(fixture('family-build76.json'));
  fam.rules = { ...fam.rules, parentPin: 'salt:hash', limitMinutes: MARKUP, evil: 1, ownRewards: [{ id: 'own.x', name: 'X', icon: '🍕', tier: 'huge' }] };
  const r = await readAnyBackup(JSON.stringify(fam));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal((r.rules as Record<string, unknown>).parentPin, undefined);
  assert.equal((r.rules as Record<string, unknown>).evil, undefined);
  assert.equal(r.rules!.limitMinutes, undefined);
  assert.deepEqual(r.rules!.ownRewards, []);
});

test('the saved copy is cleaned on load: a hostile save still opens, with its PIN and children intact', () => {
  const save = JSON.parse(fixture('save-build76.json'));
  save.settings.parentPin = 'salt:hash';
  save.settings.limitMinutes = MARKUP;
  save.settings.timerSeconds = MARKUP;
  save.settings.volume = MARKUP;
  save.settings.ownRewards = [{ id: 'own.x', name: 'X', icon: MARKUP, tier: 'huge' }, { id: 'own.y', name: 'Y', icon: MARKUP, tier: 'small' }];
  save.children[0].avatar = 'none';
  save.children[0].age = MARKUP;
  save.children.push({ id: `c"><img src=x onerror=alert(1)>`, name: 5, age: 7 }, MARKUP, null);
  save.activeChildId = MARKUP;
  save.faceoff = { [MARKUP]: [1, 2], 'a|b': [MARKUP, 2] };
  const d = parseSave(JSON.stringify(save))!;
  assert.ok(d);
  assert.equal(d.settings.parentPin, 'salt:hash');
  assert.equal(d.settings.limitMinutes, 30);
  assert.equal(d.settings.timerSeconds, 20);
  assert.equal(d.settings.volume, 0.8);
  assert.deepEqual(d.settings.ownRewards, [{ id: 'own.y', name: 'Y', icon: '🎁', tier: 'small' }]);
  assert.equal(d.children[0].avatar, 0);
  assert.equal(d.children[0].age, 6);
  // A damaged child is repaired rather than losing the save: the id keeps only safe characters.
  assert.equal(d.children.length, 2);
  for (const c of d.children) assert.match(c.id, /^[A-Za-z0-9_-]{1,40}$/);
  assert.equal(d.children[1].name, 'Champ');
  assert.equal(d.activeChildId, null);
  assert.deepEqual(d.faceoff, { 'a|b': [0, 2] });
});

test('prices and jars never throw on a reward with an unknown size', () => {
  const odd = { id: 'own.z', name: 'Z', icon: '🎁', tier: 'huge', category: 'own' } as unknown as Reward;
  assert.equal(jarOf(odd), 'treat');
  assert.equal(costOf(odd), 480);
  assert.match(aboutOf(odd), /^about /);
  setOwnRewards([{ id: 'own.a', name: 'A', icon: '🍕', tier: 'small' }, { id: 'own.b', name: 'B', icon: '🍕', tier: 'huge' as 'small' }, null as never]);
  assert.deepEqual(ownRewards().map((r) => r.id), ['own.a']);
  setOwnRewards('nope' as never);
  assert.equal(ownRewards().length, 0);
});

test('the family document from the cloud: only well-formed child ids, times and rules', () => {
  const f = cleanFamilyDoc({ consentAt: MARKUP, policy: 5, kids: { c1abc: 10, [`c"><img>`]: 5, c2: MARKUP }, removed: MARKUP, resets: { c1abc: Infinity }, devices: { d1: { label: 'Pixel', at: 5 }, [MARKUP]: { label: 'x', at: 1 }, d2: MARKUP }, rules: '{"limitMinutes":45,"parentPin":"a:b"}', rulesAt: 7, primary: MARKUP, deletedAt: MARKUP });
  assert.deepEqual(f, { v: 1, consentAt: 0, policy: '', kids: { c1abc: 10 }, removed: {}, resets: {}, devices: { d1: { label: 'Pixel', at: 5 } }, rules: { limitMinutes: 45 }, rulesAt: 7 });
  assert.deepEqual(cleanFamilyDoc({ rules: '{not json' }).rules, {});
});

test('files and saves made by build 76 read back unchanged', async () => {
  // Two changes from fix 2, and nothing else: the question history becomes short fingerprints,
  // and the save gets a counter (0 for a save made before counting began).
  const now = <T extends { progress: { history: Record<string, string[]> } }>(c: T): T => ({ ...c, progress: { ...c.progress, history: Object.fromEntries(Object.entries(c.progress.history).map(([k, v]) => [k, v.map(historyId)])) } });
  const raw = fixture('save-build76.json');
  const was = JSON.parse(raw);
  assert.deepEqual(JSON.parse(JSON.stringify(parseSave(raw))), { ...was, rev: 0, children: was.children.map(now) });
  const child = now(was.children[0]);
  const single = await readBackup(fixture('backup-build76.json'));
  assert.ok(single.ok);
  const fam = await readAnyBackup(fixture('family-build76.json'));
  assert.ok(fam.ok);
  if (!single.ok || !fam.ok) return;
  // The backup leaves out the undo notes; a family file also leaves out the question history.
  const { undo: _u, ...noUndo } = child;
  assert.deepEqual(JSON.parse(JSON.stringify(single.backup.child)), noUndo);
  assert.deepEqual(JSON.parse(JSON.stringify(fam.backups[0].child)), { ...noUndo, progress: { ...noUndo.progress, history: {} } });
  assert.deepEqual(fam.rules, JSON.parse(fixture('family-build76.json')).rules);
  // cleanChild on an already clean child changes nothing.
  const again = cleanChild(single.backup.child);
  assert.ok(again.ok);
  if (again.ok) assert.deepEqual(again.child, single.backup.child);
});

test('a saved bedtime without school time keeps the usual school week', () => {
  const s = cleanSavedSettings({ quiet: { bed: { on: true, from: '00:00', to: '23:59' } } } as never);
  assert.deepEqual(s.quiet?.school.days, [1, 2, 3, 4, 5]);
  const r = cleanRules({ quiet: { bed: { on: false, from: '21:00', to: '07:00' }, school: { on: true, from: '08:00', to: '14:00', days: [] } } });
  assert.deepEqual(r.quiet?.school.days, []);
});
