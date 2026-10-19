// Question variety. The same fact asked in different ways, so a level never feels like the
// same question ten times:
//   - plain sums ("7 × 6 = ?") also come as the swapped order, a missing number
//     ("7 × ? = 42", "? ÷ 6 = 7") and short word problems;
//   - squares, cubes and roots also come in words ("What is 9 squared?", "Which number
//     squared makes 81?");
//   - doubles and halves also come as sums, missing numbers and sharing stories.
// And a counting-sequence maker with different starts, gaps in the middle, counting back
// and "what comes before".

import type { Rng } from './rng.ts';
import { nearNumbers, num, spoken, type Made } from './question.ts';
import type { Lesson } from './teach/types.ts';
import { reshow, lead } from './teach/build.ts';
import * as A from './teach/addsub.ts';
import * as M from './teach/muldiv.ts';
import * as C from './teach/count.ts';
import * as W from './teach/powers.ts';
import { sequenceLesson } from './teach/place.ts';

const NAMES = ['Aarav', 'Meera', 'Kabir', 'Zoya', 'Ishaan', 'Anaya', 'Vihaan', 'Diya', 'Arjun', 'Sara', 'Rohan', 'Tara', 'Dev', 'Kiara'];
const THINGS = ['marbles', 'stickers', 'mangoes', 'pencils', 'balloons', 'sweets', 'cards', 'shells', 'beads', 'stamps', 'buttons', 'crayons'];
const BOXES = ['bags', 'boxes', 'packets', 'jars', 'baskets', 'rows', 'teams', 'plates'];

type Form = () => Made;

const sum = (prompt: string, answer: number, r: Rng, extras: number[], hint: string | undefined, teach: () => Lesson, speak?: string): Made => ({
  prompt,
  speak: speak ?? spoken(prompt),
  answer: num(answer),
  distractors: nearNumbers(r, answer, extras.filter((x) => x !== answer && x >= 0)),
  hint,
  teach,
});

/** Other ways of asking a made question, when its prompt is one we understand. */
function formsFor(m: Made, r: Rng, stage: number, d: number): Form[] {
  const p = m.prompt.trim();
  const words = stage >= 2 && stage <= 6;
  const name = () => r.pick(NAMES);
  const thing = () => r.pick(THINGS);
  let x: RegExpExecArray | null;
  // The swapped order keeps the skill's own method; only the working line is in the new order.
  const swapped = (prompt: string, show: string, other: () => Lesson): Made => ({ ...m, prompt, speak: spoken(prompt), teach: m.teach ? () => reshow(m.teach!(), show) : other });

  if ((x = /^(\d+) ([+−×÷]) (\d+) = \?$/.exec(p))) {
    const a = +x[1];
    const op = x[2];
    const b = +x[3];
    const c = +m.answer;
    if (!Number.isInteger(c)) return [];
    const forms: Form[] = [];
    // Stories only with real amounts (no "gives away 0" or "gives away all 10").
    const small = a <= 200 && b <= 200 && c <= 1000 && a > 0 && b > 0 && c > 0;
    if (op === '+') {
      if (a !== b) forms.push(() => swapped(`${b} + ${a} = ?`, `${b} + ${a} = ${c}`, () => A.addLesson(b, a)));
      if (d >= 0.2) forms.push(() => sum(`${a} + ? = ${c}`, b, r, [c, a, b + 1, b - 1], `Count on from ${a} to ${c}. How many did you count?`, () => A.missingAddend(a, c, `${a} + ${b} = ${c}`)));
      if (d >= 0.3) forms.push(() => sum(`? + ${b} = ${c}`, a, r, [c, b, a + 1, a - 1], `Take ${b} away from ${c}.`, () => A.missingFirst(b, c, `${a} + ${b} = ${c}`)));
      if (words && small)
        forms.push(() => {
          const t = thing();
          const who = name();
          return sum(`${who} has ${a} ${t} and gets ${b} more. How many ${t} now?`, c, r, [c + 1, c - 1, a, b], m.hint, () => lead(`“Gets more” means add: ${a} + ${b}.`, m.teach ? m.teach() : A.addLesson(a, b)));
        });
    } else if (op === '−') {
      if (d >= 0.2) forms.push(() => sum(`${a} − ? = ${c}`, b, r, [c, a, b + 1, b - 1], `How many do you take from ${a} to leave ${c}?`, () => A.missingSubtrahend(a, c, `${a} − ${b} = ${c}`)));
      if (d >= 0.3) forms.push(() => sum(`? − ${b} = ${c}`, a, r, [c, b, a + 1, a - 1], `Add them back: ${c} + ${b}.`, () => A.missingMinuend(b, c, `${a} − ${b} = ${c}`)));
      forms.push(() => sum(`${c} + ? = ${a}`, b, r, [c, a, b + 1, b - 1], `Count on from ${c} to ${a}.`, () => A.missingAddend(c, a, `${c} + ${b} = ${a}`)));
      if (words && small)
        forms.push(() => {
          const t = thing();
          return sum(`${name()} has ${a} ${t} and gives away ${b}. How many are left?`, c, r, [c + 1, c - 1, a, a + b], m.hint, () => lead(`“Gives away” means take away: ${a} − ${b}.`, m.teach ? m.teach() : A.subLesson(a, b)));
        });
    } else if (op === '×') {
      if (a !== b) forms.push(() => swapped(`${b} × ${a} = ?`, `${b} × ${a} = ${c}`, () => M.mulLesson(b, a)));
      if (c > 0 && a > 0 && b > 0) {
        forms.push(() => sum(`${a} × ? = ${c}`, b, r, [b + 1, b - 1, c - a, a], `Count in ${a}s until you reach ${c}.`, () => M.missingFactor(a, c, `${a} × ${b} = ${c}`)));
        if (d >= 0.3) forms.push(() => sum(`? × ${b} = ${c}`, a, r, [a + 1, a - 1, c - b, b], `How many ${b}s make ${c}?`, () => M.missingFactor(b, c, `${a} × ${b} = ${c}`, { intro: `What times ${b} makes ${c}? That is: how many ${b}s make ${c}?` })));
        forms.push(() => sum(`${c} ÷ ${b} = ?`, a, r, [a + 1, a - 1, b], `${a} × ${b} = ${c}, so…`, () => M.divLesson(c, b)));
      }
      if (words && small && a >= 2 && b >= 2)
        forms.push(() => {
          const t = thing();
          const box = r.pick(BOXES);
          return sum(`${a} ${box} with ${b} ${t} in each. How many ${t}?`, c, r, [c + a, c - b, a + b], m.hint, () => lead(`${a} ${box} with ${b} in each is ${a} lots of ${b}: ${a} × ${b}.`, m.teach ? m.teach() : M.mulLesson(a, b)));
        });
    } else if (op === '÷' && b > 0) {
      forms.push(() => sum(`${b} × ? = ${a}`, c, r, [c + 1, c - 1, b], `Count in ${b}s up to ${a}.`, () => M.missingFactor(b, a, `${b} × ${c} = ${a}`)));
      if (d >= 0.3) forms.push(() => sum(`? ÷ ${b} = ${c}`, a, r, [a + b, a - b, c * (b + 1), b + c], `Multiply back: ${c} × ${b}.`, () => lead(`Dividing by ${b} gave ${c}. Undo it: multiply ${c} by ${b}.`, M.mulLesson(c, b), { answer: a, show: `${a} ÷ ${b} = ${c}` })));
      if (d >= 0.3 && c > 0) forms.push(() => sum(`${a} ÷ ? = ${c}`, b, r, [b + 1, b - 1, c], `${c} × what = ${a}?`, () => lead(`${a} split into groups of ${c}: how many groups? That is ${a} ÷ ${c}.`, M.divLesson(a, c), { answer: b, show: `${a} ÷ ${b} = ${c}` })));
      if (words && small) forms.push(() => sum(`${a} ${thing()} shared equally by ${b} friends. How many each?`, c, r, [c + 1, c - 1, b], m.hint, () => lead(`Sharing equally between ${b} means ${a} ÷ ${b}.`, m.teach ? m.teach() : M.divLesson(a, b))));
    }
    return forms;
  }
  if ((x = /^(\d+)² = \?$/.exec(p))) {
    const n = +x[1];
    const c = n * n;
    return [
      () => sum(`What is ${n} squared?`, c, r, [n * 2, c + n, c - n], m.hint, () => W.squareLesson(n)),
      () => sum(`${n} × ${n} = ?`, c, r, [n * 2, c + n, c - n], m.hint, () => (n <= 12 ? M.timesFact(n, n) : M.gridMult(n, n))),
      () => sum(`Which number squared makes ${c}?`, n, r, [n + 1, n - 1, Math.round(c / 2)], `Which number times itself is ${c}?`, () => W.sqrtLesson(c, `${n}² = ${c}`)),
    ];
  }
  if ((x = /^(\d+)³ = \?$/.exec(p))) {
    const n = +x[1];
    const c = n ** 3;
    return [
      () => sum(`${n} × ${n} × ${n} = ?`, c, r, [n * n, n * 3, c + n * n], m.hint, () => W.cubeLesson(n, `${n} × ${n} × ${n} = ${c}`)),
      () => sum(`What is ${n} cubed?`, c, r, [n * n, n * 3, c - n * n], m.hint, () => W.cubeLesson(n)),
      () => sum(`Which number cubed makes ${c}?`, n, r, [n + 1, n - 1, n * n], `Which number times itself, three times, is ${c}?`, () => W.cbrtLesson(c, `${n}³ = ${c}`)),
    ];
  }
  if ((x = /^√(\d+) = \?$/.exec(p))) {
    const c = +x[1];
    const n = +m.answer;
    return [
      () => sum(`Which number squared makes ${c}?`, n, r, [n + 1, n - 1, Math.round(c / 2)], m.hint, () => W.sqrtLesson(c, `${n}² = ${c}`)),
      () => sum(`? × ? = ${c} (the same number twice)`, n, r, [n + 1, n - 1, Math.round(c / 2)], m.hint, () => W.sqrtLesson(c, `${n} × ${n} = ${c}`)),
      () => sum(`What is the square root of ${c}?`, n, r, [n + 1, n - 1, Math.round(c / 2)], m.hint, () => W.sqrtLesson(c)),
    ];
  }
  if ((x = /^∛(\d+) = \?$/.exec(p))) {
    const c = +x[1];
    const n = +m.answer;
    return [
      () => sum(`Which number cubed makes ${c}?`, n, r, [n + 1, n - 1, Math.round(c / 3)], m.hint, () => W.cbrtLesson(c, `${n}³ = ${c}`)),
      () => sum(`? × ? × ? = ${c} (the same number three times)`, n, r, [n + 1, n - 1, Math.round(c / 3)], m.hint, () => W.cbrtLesson(c, `${n} × ${n} × ${n} = ${c}`)),
    ];
  }
  if ((x = /^Double (\d+) = \?$/.exec(p))) {
    const n = +x[1];
    return [
      () => sum(`${n} + ${n} = ?`, 2 * n, r, [2 * n + 1, 2 * n - 1, n + 1], m.hint, () => (m.teach ? reshow(m.teach(), `${n} + ${n} = ${2 * n}`) : C.doubleLesson(n))),
      () => sum(`Double ? = ${2 * n}`, n, r, [n + 1, n - 1, 2 * n], 'Which number, added to itself, makes it?', () => lead(`Which number doubled makes ${2 * n}? That is half of ${2 * n}.`, C.halveLesson(2 * n), { answer: n, show: `Double ${n} = ${2 * n}` })),
      () => {
        const t = thing();
        return sum(`Twins have ${n} ${t} each. How many ${t} altogether?`, 2 * n, r, [2 * n + 1, n + 1, 2 * n - 2], m.hint, () => lead(`Two lots of ${n} is double ${n}.`, m.teach ? m.teach() : C.doubleLesson(n)));
      },
    ];
  }
  if ((x = /^Half of (\d+) = \?$/.exec(p))) {
    const c = +x[1];
    const h = +m.answer;
    return [
      () => sum(`${c} ÷ 2 = ?`, h, r, [h + 1, h - 1, c - 2], m.hint, () => lead('÷ 2 means half.', m.teach ? m.teach() : C.halveLesson(c), { answer: h, show: `${c} ÷ 2 = ${h}` })),
      () => sum(`Half of ? = ${h}`, c, r, [c + 2, c - 2, h + 1], 'Double it to find the whole.', () => lead(`Half of the number is ${h}, so the number is double ${h}.`, C.doubleLesson(h), { answer: c, show: `Half of ${c} = ${h}` })),
      () => {
        const t = thing();
        return sum(`Share ${c} ${t} equally between 2 friends. How many each?`, h, r, [h + 1, h - 1, c], m.hint, () => lead('Sharing between 2 means half.', m.teach ? m.teach() : C.halveLesson(c)));
      },
    ];
  }
  return [];
}

/**
 * Sometimes (about half the time) ask a made question another way. Questions with a
 * picture, an exact form, or a prompt we do not recognise are left as they are.
 */
export function vary(m: Made, r: Rng, stage: number, d: number, chance = 0.5): Made {
  if (m.visual || m.exactForm || m.optionObject || !r.chance(chance)) return m;
  const forms = formsFor(m, r, stage, d);
  if (!forms.length) return m;
  const out = r.pick(forms)();
  return out.distractors.length >= 3 ? out : m;
}

/** A counting sequence with some variety (see the module comment). */
export function sequenceQ(r: Rng, d: number, o: { steps: number[]; max: number; offStart?: boolean; offFrom?: number; back?: boolean; min?: number }): Made {
  const step = r.pick(o.steps);
  const min = o.min ?? 0;
  const len = 5;
  // Start on a multiple of the step, or (harder) anywhere.
  const off = o.offStart && d >= (o.offFrom ?? 0.5) && r.chance(0.55) ? r.int(1, step - 1 || 1) : 0;
  const top = Math.max(min, Math.floor((o.max - (len - 1) * step - off) / step));
  let start = step * r.int(Math.ceil(min / step), Math.max(Math.ceil(min / step), top)) + off;
  const back = !!o.back && d >= 0.4 && r.chance(0.4);
  let seq = Array.from({ length: len }, (_, i) => start + i * step);
  if (back) seq = seq.reverse();
  start = seq[0];
  // Which term is missing: usually the next one; sometimes in the middle or the first.
  const roll = r.next();
  const gap = d < 0.25 || roll < 0.5 ? len - 1 : roll < 0.85 ? r.int(1, len - 2) : 0;
  const shown = gap === len - 1 ? seq.slice(0, len - 1) : seq;
  const prompt = shown.map((n, i) => (i === gap ? '?' : String(n))).join(', ') + (gap === len - 1 ? ', ?' : '');
  const say = shown.map((n, i) => (i === gap ? 'something' : String(n))).join(', ');
  const ans = seq[gap];
  const how = back ? `Count back in ${step}s` : `Count in ${step}s`;
  return {
    prompt,
    speak: `${how}: ${say}${gap === len - 1 ? ', something' : ''}. Which number is missing?`,
    answer: num(ans),
    distractors: nearNumbers(r, ans, [ans + 1, ans - 1, ans + step, ans - step].filter((x) => x >= 0 && x !== ans)),
    hint: `${back ? 'Take away' : 'Add'} ${step} each time.`,
    teach: () => sequenceLesson(seq, gap),
  };
}
