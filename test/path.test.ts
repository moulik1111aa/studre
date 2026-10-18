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
