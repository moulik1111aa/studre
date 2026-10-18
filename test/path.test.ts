import { test } from 'node:test';
import assert from 'node:assert/strict';
test('a round does not ask three questions laid out the same way in a row when the skill can vary', async () => {
  const { allSkills } = await import('../src/core/areas/index.ts');
  const { makeRound, freshProgress, buildPath, promptShape } = await import('../src/core/path.ts');
  const { AREAS } = await import('../src/core/areas/index.ts');
  const { createRng } = await import('../src/core/rng.ts');
  const skill = allSkills().find((s) => s.id === 's2.make10')!;
  const level = buildPath(AREAS[0]).find((l) => l.kind === 'skill' && l.skillId === skill.id)!;
  for (let seed = 0; seed < 20; seed++) {
    const qs = makeRound(level, () => skill, freshProgress(), createRng(`row:${seed}`)).questions.map((q) => promptShape(q.prompt));
    for (let i = 2; i < qs.length; i++) assert.ok(!(qs[i] === qs[i - 1] && qs[i] === qs[i - 2]), qs.join(' | '));
  }
});

test('a paused question is replaced by a like one with a different answer', async () => {
  const { allSkills } = await import('../src/core/areas/index.ts');
  const { makeQuestion, replaceQuestion } = await import('../src/core/path.ts');
  const { createRng } = await import('../src/core/rng.ts');
  const rng = createRng('pause');
  for (const skill of allSkills().filter((s) => s.stage >= 2)) {
    const q = makeQuestion(skill, rng, 0.6, new Set());
    const r = replaceQuestion(q, skill, rng, new Set());
    assert.equal(r.skillId, q.skillId);
    assert.equal(r.choices.length, q.choices.length);
    assert.equal(r.d, q.d);
    assert.notEqual(r.key, q.key, `${skill.id}: ${q.prompt}`);
  }
});

test('start a child over keeps who they are; delete removes them and their face-offs', async () => {
  const { freshSave, newChild, resetChild, removeChild } = await import('../src/storage/save.ts');
  const d = freshSave();
  const a = newChild('Asha', 7, 2, '2026-10-01');
  const b = newChild('Ben', 9, 3, '2026-10-01');
  d.children.push(a, b);
  d.activeChildId = a.id;
  a.placed = true;
  a.wallet.treat.coins = 120;
  a.wallet.earned.push({ rewardId: 'x', day: '2026-10-02' });
  a.progress.levels['l1'] = { stars: 3, passes: 1 } as never;
  a.bossesBeaten.push('b1');
  d.faceoff[[a.id, b.id].sort().join('|')] = [2, 1];
  resetChild(a, '2026-10-18');
  assert.equal(a.name, 'Asha');
  assert.equal(a.age, 7);
  assert.equal(a.avatar, 2);
  assert.equal(a.placed, false);
  assert.equal(a.wallet.treat.coins, 0);
  assert.equal(a.wallet.earned.length, 0);
  assert.deepEqual(a.progress.levels, {});
  assert.deepEqual(a.bossesBeaten, []);
  assert.equal(d.children[0], a);
  removeChild(d, a.id);
  assert.deepEqual(d.children.map((c) => c.name), ['Ben']);
  assert.equal(d.activeChildId, b.id);
  assert.deepEqual(d.faceoff, {});
});
