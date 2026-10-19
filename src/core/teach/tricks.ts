// Mental tricks (Stages 3–4): +9 / +11 via +10, doubling and halving by parts, × 11,
// × 25 (four 25s make 100), and double-and-halve.

import { LessonBuilder, Line, f } from './build.ts';
import type { Lesson } from './types.ts';

/** a + 9 / 11 / 19 / 21: add the round number, then adjust by 1. */
export function plusNearTen(a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const round = Math.round(b / 10) * 10;
  const adj = b - round;
  const line = new Line('even');
  L.board = line.b;
  line.pt(a, 0, { tone: 'start' });
  L.say(`${b} is ${round} ${adj < 0 ? 'take away' : 'and'} 1. Add ${round} first: it is easy.`);
  line.hop(a, a + round, L.i).pt(a + round, L.i);
  L.say(`Add ${round}.`, `${a} + ${round} = ${a + round}`);
  line.hop(a + round, a + b, L.i).pt(a + b, L.i, { tone: 'end', hl: L.i + 1 });
  L.say(adj < 0 ? 'We added 1 too many, so take 1 away.' : 'Then add the extra 1.', `${a + round} ${adj < 0 ? '−' : '+'} 1 = ${a + b}`);
  L.slip(a + round, `Remember to ${adj < 0 ? 'take 1 away' : 'add 1 more'}: ${b} is ${round} ${adj < 0 ? '−' : '+'} 1.`);
  return L.end(a + b, undefined, `${a} + ${b} = ${a + b}`);
}

/** Double a 2-digit number: double the tens, double the ones, add. */
export function doubleSplit(a: number): Lesson {
  const L = new LessonBuilder();
  const t = Math.floor(a / 10) * 10;
  const o = a % 10;
  if (!t || !o) {
    L.say('Double means two lots: add the number to itself.', `${a} + ${a} = ${2 * a}`);
    return L.end(2 * a, undefined, `Double ${a} = ${2 * a}`);
  }
  L.say(`Split ${a} into ${t} and ${o}.`);
  L.say('Double each part.', `double ${t} = ${2 * t}`, `double ${o} = ${2 * o}`);
  L.say('Add them.', `${2 * t} + ${2 * o} = ${2 * a}`);
  L.slip(a + 2, 'Double means two lots of the number, not + 2.');
  return L.end(2 * a, undefined, `Double ${a} = ${2 * a}`);
}

/** Halve an even 2-digit number: halve the tens, halve the ones, add. */
export function halveSplit(a: number): Lesson {
  const L = new LessonBuilder();
  const t = Math.floor(a / 10) * 10;
  const o = a % 10;
  L.say(`Split ${a} into ${t} and ${o}.`);
  L.say('Halve each part.', `half of ${t} = ${t / 2}`, ...(o ? [`half of ${o} = ${o / 2}`] : []));
  if (o) L.say('Add them.', `${t / 2} + ${o / 2} = ${a / 2}`);
  L.slip(a * 2, 'That is double. Half is smaller.');
  return L.end(a / 2, undefined, `Half of ${a} = ${a / 2}`);
}

/** A 2-digit number × 11: split the digits, put their sum in the middle (carry if 10 or more). */
export function x11(a: number): Lesson {
  const L = new LessonBuilder();
  const t = Math.floor(a / 10);
  const o = a % 10;
  const s = t + o;
  L.say(`Split the digits of ${a}: ${t} _ ${o}.`);
  if (s < 10) L.say(`Add them and put the sum in the middle.`, `${t} + ${o} = ${s}`, `${t} ${s} ${o}`);
  else {
    L.say('Add them. The sum has two digits.', `${t} + ${o} = ${s}`);
    L.say(`Put ${s % 10} in the middle and carry 1 to the ${t}.`, `${t + 1} ${s % 10} ${o}`);
  }
  L.say('Check: × 11 is × 10 and one more.', `${a} × 10 + ${a} = ${a * 11}`);
  if (s >= 10) L.slip(t * 100 + (s % 10) * 10 + o, `The middle sum was ${s}: carry the 1 to the front digit.`);
  return L.end(a * 11, undefined, `${a} × 11 = ${a * 11}`);
}

/** a × 25 when a is a multiple of 4: every four 25s make 100. */
export function x25(a: number): Lesson {
  const L = new LessonBuilder();
  const k = a / 4;
  L.say('Four 25s make 100.', '4 × 25 = 100');
  L.say(`${a} is ${k} fours, so ${a} × 25 is ${k} hundreds.`, `${a} = ${k} × 4`, `${k} × 100 = ${k * 100}`);
  L.slip(a * 20, '× 25 is not × 20. Four 25s make 100.');
  return L.end(a * 25, undefined, `${a} × 25 = ${a * 25}`);
}

/** Double one number and halve the other: the answer stays the same. */
export function doubleHalve(a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const h = a / 2;
  const d = 2 * b;
  L.say(`Halve ${a} and double ${b}: the answer stays the same, and it gets easier.`, `${a} × ${b} = ${h} × ${d}`);
  const tens = d / 10;
  L.say(`${d} is ${tens} tens.`, `${h} × ${tens} = ${h * tens}`, `${h * tens} × 10 = ${h * d}`);
  return L.end(a * b, undefined, `${a} × ${b} = ${a * b}`);
}

export { f };
