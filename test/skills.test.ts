import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allSkills, AREAS } from '../src/core/areas/index.ts';
import { createRng } from '../src/core/rng.ts';
import { isCorrect, valueOf, buildChoices } from '../src/core/question.ts';

const SEEDS = Number(process.env.SKILL_SEEDS ?? 300);
const EXPECTED = [30, 45, 56, 55, 50, 45, 40];

/** Independent checker: evaluates simple written sums like "27 + 36 = ?" or "8 + ? = 15". */
function check(prompt: string): number | null {
  // Written fractions are single numbers: "4 ÷ 1/6" means 4 ÷ (1/6).
  const p = prompt.replace(/(\d+)\/(\d+)/g, '($1/$2)').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  const m = /^(-?[\d.()/]+(?:\s*[-+*/]\s*-?[\d.()/]+)*)\s*=\s*\?$/.exec(p.trim());
  if (m) return Function(`return (${m[1]})`)() as number;
  const miss = /^(-?[\d.]+)\s*([-+*/])\s*\?\s*=\s*(-?[\d.]+)$/.exec(p.trim());
  if (miss) {
    const [a, op, c] = [Number(miss[1]), miss[2], Number(miss[3])];
    return op === '+' ? c - a : op === '-' ? a - c : op === '*' ? c / a : a / c;
  }
  return null;
}

test('stage skill counts match the spec as stages are built', () => {
  const stages = AREAS[0].skills;
  stages.forEach((s, i) => assert.equal(s.length, EXPECTED[i], `stage ${i + 1} has ${s.length} skills`));
});

for (const skill of allSkills()) {
  test(`${skill.id} — ${skill.name}`, () => {
    let checked = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
      for (const d of [0, 0.5, 1]) {
        const rng = createRng(`${skill.id}:${seed}:${d}`);
        const q = skill.make(rng, d);
        const ctx = `${skill.id} seed ${seed} d ${d}: "${q.prompt}" → ${q.answer}`;
        assert.ok(q.prompt.length > 0, ctx);
        assert.ok(q.answer.length > 0, ctx);
        assert.ok(!/NaN|undefined|Infinity/.test(q.prompt + q.answer + q.distractors.join()), `bad value in ${ctx}`);
        assert.ok(q.distractors.length >= 1, `no distractors: ${ctx}`);
        for (const w of q.distractors) assert.ok(!isCorrect(q, w), `distractor ${w} is also correct: ${ctx}`);
        const choices = buildChoices(rng, q.answer, q.distractors, skill.format === 'picture' ? 3 : 4);
        assert.equal(new Set(choices).size, choices.length, `duplicate choices ${choices}: ${ctx}`);
        assert.ok(choices.includes(q.answer), ctx);
        if (skill.format === 'picture' || skill.stage <= 2) assert.ok(q.speak && q.speak.length > 0, `no speech: ${ctx}`);
        const expect = check(q.prompt);
        if (expect !== null) {
          checked++;
          assert.ok(Math.abs(expect - valueOf(q.answer)) < 1e-9, `checker says ${expect}: ${ctx}`);
        }
        if (/^-?\d+$/.test(q.answer) && skill.stage <= 3) assert.ok(Number(q.answer) >= 0, `negative answer before Stage 4: ${ctx}`);
      }
    }
    void checked;
  });
}
