// Question variety audit: for every skill, play its five levels the way a child would
// (with the repeat filter and history) and report how varied the questions are.
//   node scripts/audit-questions.ts [--all]
import { allSkills } from '../src/core/areas/index.ts';
import { makeRound, freshProgress, noteAsked, buildPath, questionKey, tooSimilar, type Level } from '../src/core/path.ts';
import { AREAS } from '../src/core/areas/index.ts';
import { createRng } from '../src/core/rng.ts';

const showAll = process.argv.includes('--all');
const shape = (p: string) => p.replace(/\d+(\.\d+)?/g, '#');
const path = buildPath(AREAS[0]);
const rows: { id: string; name: string; asked: number; distinct: number; shapes: number; worstRepeat: number; space: number; dupInRound: number; simInRound: number }[] = [];
for (const skill of allSkills()) {
  const levels = path.filter((l): l is Extract<Level, { kind: 'skill' }> => l.kind === 'skill' && l.skillId === skill.id);
  const p = freshProgress();
  const rng = createRng(`audit:${skill.id}`);
  const seen = new Map<string, number>();
  const shapes = new Set<string>();
  let asked = 0;
  let dupInRound = 0;
  let simInRound = 0;
  // Two play-throughs of all five levels (a child usually replays some).
  for (let pass = 0; pass < 2; pass++) {
    for (const level of levels) {
      const round = makeRound(level, (id) => (id === skill.id ? skill : undefined), p, rng);
      const keys = new Set<string>();
      round.questions.forEach((q, i) => {
        const k = questionKey(skill.id, q);
        if (keys.has(k)) dupInRound++;
        else if (round.questions.slice(0, i).some((o) => tooSimilar(q, o))) simInRound++;
        keys.add(k);
      });
      for (const q of round.questions) {
        const k = questionKey(skill.id, q);
        seen.set(k, (seen.get(k) ?? 0) + 1);
        shapes.add(shape(q.prompt));
        asked++;
      }
      noteAsked(p, round.questions, '2026-10-18');
    }
  }
  // Rough size of the question space.
  const space = new Set<string>();
  const r2 = createRng(`space:${skill.id}`);
  for (let i = 0; i < 400; i++) {
    const m = skill.make(r2, r2.next());
    space.add(`${m.prompt}|${m.answer}|${m.visual ? JSON.stringify(m.visual) : ''}`);
  }
  rows.push({ id: skill.id, name: skill.name, asked, distinct: seen.size, shapes: shapes.size, worstRepeat: Math.max(...seen.values()), space: space.size, dupInRound, simInRound });
}
const weak = rows.filter((r) => showAll || r.dupInRound > 0 || r.simInRound > 4);
const tot = rows.reduce((a, r) => [a[0] + r.dupInRound, a[1] + r.simInRound], [0, 0]);
console.log(`repeats inside a level: ${tot[0]}, near-repeats: ${tot[1]}`);
console.log(`skills ${rows.length}, weak ${weak.length}`);
for (const r of weak.sort((a, b) => b.dupInRound - a.dupInRound || b.simInRound - a.simInRound)) {
  console.log(`${r.id.padEnd(22)} dup ${String(r.dupInRound).padStart(2)} sim ${String(r.simInRound).padStart(2)}  distinct ${String(r.distinct).padStart(3)}/${r.asked}  repeat×${r.worstRepeat}  shapes ${String(r.shapes).padStart(2)}  space ${String(r.space).padStart(3)}  ${r.name}`);
}
