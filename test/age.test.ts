// Levels follow age: placement never starts below the child's stage, older children get the
// hard end of younger skills, skills sit at the right age, and generators keep their promise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, skillById } from '../src/core/areas/index.ts';
import { MOVES } from '../src/core/areas/arithmetic/index.ts';
import { buildPath, forAge, frontier, freshProgress } from '../src/core/path.ts';
import { Placement, stageForAge, belowAge } from '../src/core/placement.ts';
import { createRng } from '../src/core/rng.ts';

const skills = AREAS[0].skills.flat();

test('placement: even all "Not yet", a child starts at their own age', () => {
  for (const age of [5, 7, 9, 12, 14, 16]) {
    const stage = stageForAge(age);
    for (const answer of ['not', 'effort', 'yes'] as const) {
      const pl = new Placement(age, skills);
      for (let q = pl.next(), n = 0; q && n < 40; q = pl.next(), n++) {
        assert.ok(q.skill.stage >= stage, `age ${age} asked about ${q.skill.id}`);
        pl.answer(answer);
      }
      const plan = pl.result();
      const p = freshProgress();
      for (const id of plan.skipped) p.skipped[id] = true;
      const path = buildPath(AREAS[0]);
      const first = path[frontier(path, p)];
      assert.ok(first.stage >= stage, `age ${age} (${answer}) starts in stage ${first.stage}`);
      for (const s of skills) if (s.stage < stage) assert.ok(p.skipped[s.id], `${s.id} skipped at ${age}`);
    }
  }
  assert.deepEqual(belowAge(4, skills), []);
});

test('difficulty: older children get the harder end of younger skills', () => {
  assert.equal(forAge(0.2, 9, 4), 0.2); // a 9-year-old on a 9–10 skill: as it is
  assert.equal(forAge(0.2, undefined, 4), 0.2);
  assert.ok(Math.abs(forAge(0, 12, 4) - 0.5) < 1e-9); // two years older: from halfway up
  assert.ok(forAge(0, 16, 4) > 0.85);
  assert.equal(forAge(1, 14, 2), 1);
});

test('moved skills keep their ids and play at their new age', () => {
  for (const m of MOVES) {
    const s = skillById(m.id)!;
    assert.ok(s, m.id);
    const at = AREAS[0].skills.findIndex((st) => st.some((x) => x.id === m.id));
    assert.equal(s.stage, at + 1, m.id);
    assert.ok(s.stage < Number(m.id[1]), `${m.id} moved to a younger stage`);
  }
  assert.equal(skillById('s6.eq1')!.stage, 5);
  assert.equal(skillById('s7.sqplus')!.stage, 6);
  assert.equal(skillById('s5.missingop')!.stage, 4);
  assert.equal(new Set(skills.map((s) => s.id)).size, skills.length);
});

test('temperatures always go below zero; integers always use a negative', () => {
  const r = createRng('age-test');
  for (let i = 0; i < 400; i++) {
    const d = (i % 5) / 4;
    const m = skillById('s4.temp')!.make(r, d);
    const nums = (m.prompt.match(/-?\d+/g) ?? []).map(Number);
    assert.ok(nums.some((n) => n < 0) || Number(m.answer) < 0, m.prompt);
    for (const id of ['s5.intadd', 's5.intsub', 's5.intmul', 's5.intdiv']) {
      const q = skillById(id)!.make(r, d);
      assert.match(q.prompt, /−/, `${id}: ${q.prompt}`);
    }
    const pt = skillById('s5.pcttotal')!.make(r, d);
    assert.doesNotMatch(pt.prompt, /\d\.\d/, pt.prompt);
  }
});
