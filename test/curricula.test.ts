// School paths: every preset names real skills, each class has a sensible bundle, and the
// bundle path keeps skill level ids (shared progress) but has its own reviews and bosses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, skillById } from '../src/core/areas/index.ts';
import { BOARDS, gradeForAge, boardById } from '../src/core/curricula.ts';
import { buildBundlePath, buildPath } from '../src/core/path.ts';

test('every preset skill exists, and each class has at least 8', () => {
  for (const b of BOARDS)
    for (const g of b.grades) {
      for (const id of g.skills) assert.ok(skillById(id), `${b.id} ${g.label}: no skill ${id}`);
      assert.ok(g.skills.length >= 8, `${b.id} ${g.label} has only ${g.skills.length}`);
    }
});

test('a class bundle path: same skill levels, its own bosses, stages in order', () => {
  const grade = boardById('cbse')!.grades[3];
  const path = buildBundlePath(AREAS[0], grade.skills, 'cbse-4');
  const main = new Set(buildPath(AREAS[0]).map((l) => l.id));
  const skills = path.filter((l) => l.kind === 'skill');
  assert.equal(skills.length, grade.skills.length * 5);
  for (const l of skills) assert.ok(main.has(l.id));
  for (const l of path.filter((l) => l.kind !== 'skill')) assert.ok(!main.has(l.id), l.id);
  const stages = path.map((l) => l.stage);
  assert.deepEqual(stages, [...stages].sort((a, b) => a - b));
  assert.ok(path.some((l) => l.kind === 'boss'));
});

test('a child is matched to the usual class for their age', () => {
  assert.equal(gradeForAge(boardById('cbse')!, 9).label, 'Class 4');
  assert.equal(gradeForAge(boardById('ccss')!, 5).label, 'Kindergarten');
  assert.equal(gradeForAge(boardById('icse')!, 4).label, 'Class 1');
});

import { FACTS } from '../src/core/facts/index.ts';
test('fun facts: plenty, short, no duplicates or stray characters', () => {
  assert.ok(FACTS.length >= 1800, `${FACTS.length} facts`);
  for (const f of FACTS) {
    assert.ok(f.length <= 160, `too long: ${f}`);
    assert.ok(!/[`$]/.test(f), f);
    assert.match(f, /[.!?]$/, f);
  }
});
