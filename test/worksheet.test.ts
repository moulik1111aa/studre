// Worksheets follow the child: the skill in progress, the few just before it, Fix-it skills
// and some older ones; 12 questions for little ones, 20 otherwise; every one can be made.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChild } from '../src/storage/save.ts';
import { AREAS, skillById } from '../src/core/areas/index.ts';
import { buildPath, makeQuestion, recordResult } from '../src/core/path.ts';
import { createRng } from '../src/core/rng.ts';
import { noteMiss } from '../src/core/fixit.ts';
import { sheetSize, worksheetPlan } from '../src/core/worksheet.ts';

const path = buildPath(AREAS[0]);
const stageOf = (id: string) => skillById(id)?.stage;
const skillLevels = path.filter((l) => l.kind === 'skill') as Extract<(typeof path)[number], { kind: 'skill' }>[];

/** A child who has passed every level before the `upTo`th skill level. */
function kidAt(age: number, upTo: number) {
  const c = newChild('Riya', age, 0, '2026-10-01');
  for (const l of path.slice(0, skillLevels[upTo].index)) recordResult(c.progress, l.id, 3);
  c.placed = true;
  return c;
}

test('a sheet: mostly the skill in progress, the few before it, Fix-it and older ones', () => {
  const c = kidAt(9, 120);
  const nowSkill = skillLevels[120].skillId;
  noteMiss(c, skillLevels[40].skillId, 0.7, 1, '2026-11-01');
  const plan = worksheetPlan(c, path, '2026-11-05', createRng('x'), stageOf);
  assert.equal(plan.length, 20);
  assert.equal(sheetSize(9), 20);
  const by = (w: string) => plan.filter((p) => p.why === w);
  assert.ok(by('now').length >= 6 && by('now').every((p) => p.skillId === nowSkill));
  assert.equal(by('recent').length, 6);
  assert.equal(by('fixit').length, 1);
  assert.equal(by('fixit')[0].d, 0.7);
  assert.equal(by('review').length, 4);
  assert.ok(by('recent').every((p) => p.skillId !== nowSkill));
  // Easier first: the skill in progress, then the rest.
  assert.equal(plan[0].why, 'now');
  assert.equal(plan.at(-1)!.why, 'fixit');
  assert.ok(plan.every((p) => p.d >= 0 && p.d <= 1));
  // Every one can be made into a question.
  const rng = createRng('q');
  for (const p of plan) assert.ok(makeQuestion(skillById(p.skillId)!, rng, p.d, new Set()).prompt);
});

test('little ones get 12; a brand-new child gets the first skill only', () => {
  const c = newChild('Ana', 4, 0, '2026-10-01');
  const plan = worksheetPlan(c, path, '2026-11-05', createRng('y'), stageOf);
  assert.equal(plan.length, 12);
  assert.ok(plan.every((p) => p.why === 'now' && p.skillId === skillLevels[0].skillId));
  assert.ok(plan[0].d <= plan.at(-1)!.d);
});

test('before their first play, an older child gets a sheet at the stage for their age, not the start of the map', () => {
  const c = newChild('Kabir', 8, 0, '2026-10-01');
  const plan = worksheetPlan(c, path, '2026-11-05', createRng('z'), stageOf);
  assert.equal(plan.length, 20);
  // Stage 3 is for ages 7 and 8.
  assert.ok(plan.every((p) => (stageOf(p.skillId) ?? 0) >= 2), plan.map((p) => p.skillId).join());
  assert.ok(plan.filter((p) => p.why === 'now').every((p) => stageOf(p.skillId) === 3));
  assert.ok(!plan.some((p) => p.skillId === skillLevels[0].skillId));
  // Once placement has run, the map decides (here: still at the start).
  c.placed = true;
  assert.ok(worksheetPlan(c, path, '2026-11-05', createRng('z'), stageOf).every((p) => p.skillId === skillLevels[0].skillId));
});
