// Print one round's prompts for a few skills: node scripts/sample-round.ts s2.skip5 s3.share
import { allSkills, AREAS } from '../src/core/areas/index.ts';
import { makeRound, freshProgress, buildPath, type Level } from '../src/core/path.ts';
import { createRng } from '../src/core/rng.ts';
const path = buildPath(AREAS[0]);
const want = process.argv.slice(2);
for (const skill of allSkills().filter((s) => !want.length || want.some((w) => s.id.includes(w)))) {
  const level = path.filter((l): l is Extract<Level, { kind: 'skill' }> => l.kind === 'skill' && l.skillId === skill.id).at(-2);
  if (!level) continue;
  const round = makeRound(level, (id) => (id === skill.id ? skill : undefined), freshProgress(), createRng(`sample:${skill.id}`));
  console.log(`\n${skill.id} — ${skill.name}`);
  for (const q of round.questions.slice(0, 6)) console.log('  ', q.prompt.replace(/\n/g, ' '));
}
