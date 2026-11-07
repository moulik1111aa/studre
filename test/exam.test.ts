// Exam practice and certificates: what's asked, how it's scored, and which certificates exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { examPlan, examVerdict, learnedSkills, scoreExam } from '../src/core/exam.ts';
import { certificatesFor } from '../src/core/certs.ts';
import { createRng } from '../src/core/rng.ts';
import { buildPath, freshProgress } from '../src/core/path.ts';
import { AREAS } from '../src/core/areas/index.ts';

test('an exam shares its questions fairly between the chosen topics', () => {
  const plan = examPlan(['a', 'b', 'c'], 20, createRng('x'));
  assert.equal(plan.length, 20);
  const per = (id: string) => plan.filter((q) => q.skillId === id).length;
  for (const id of ['a', 'b', 'c']) assert.ok(per(id) >= 6 && per(id) <= 7);
  assert.ok(plan.every((q) => q.d >= 0.55 && q.d <= 1));
  assert.deepEqual(examPlan([], 10, createRng('x')), []);
});

test('scoring: right answers per topic, skipped ones count as not right', () => {
  const r = scoreExam([{ skillId: 'a' }, { skillId: 'a' }, { skillId: 'b' }], [true, false, false]);
  assert.equal(r.ok, 1);
  assert.deepEqual(r.skills, { a: [2, 1], b: [1, 0] });
  assert.equal(examVerdict(19, 20), 'Excellent work!');
  assert.match(examVerdict(4, 20), /more practice/);
});

test('learned skills and certificates come from the map', () => {
  const path = buildPath(AREAS[0]);
  const p = freshProgress();
  assert.deepEqual(learnedSkills(path, p), []);
  assert.deepEqual(certificatesFor(path, p), []);
  const firstSkill = path.find((l) => l.kind === 'skill')!;
  const mid = path.find((l) => l.kind === 'boss' && l.boss === 'mid')!;
  const fin = path.find((l) => l.kind === 'boss' && l.boss === 'final')!;
  p.levels[firstSkill.id] = { stars: 2, passes: 1 };
  p.levels[mid.id] = { stars: 1, passes: 1 };
  p.levels[fin.id] = { stars: 3, passes: 1 };
  assert.equal(learnedSkills(path, p).length, 1);
  const log = [{ t: 0, d: '2026-11-02', id: mid.id, k: 'boss' as const, st: 1, sc: 0, of: 0, s: 1, sec: 60, c: 0 }, { t: 0, d: '2026-10-30', id: mid.id, k: 'boss' as const, st: 1, sc: 0, of: 0, s: 0, sec: 60, c: 0 }];
  const certs = certificatesFor(path, p, log);
  assert.deepEqual(certs.map((c) => c.kind), ['challenge', 'stage']);
  assert.equal(certs[0].boss, 'Big Muddle');
  assert.equal(certs[0].day, '2026-11-02');
  assert.equal(certs[1].day, undefined);
});
