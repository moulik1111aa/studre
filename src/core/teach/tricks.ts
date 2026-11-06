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
    L.board = a <= 12
      ? { kind: 'dots', layout: 'groups', joiner: '+', groups: [{ n: a, label: f(a) }, { n: a, label: f(a) }], caption: 'two lots' }
      : { kind: 'pic', frames: [{ step: 0, v: { kind: 'bar', rows: [{ parts: [{ v: a, t: f(a), tone: 0 }, { v: a, t: f(a), tone: 0, new: true }], total: f(2 * a) }] } }] };
    L.say('Double means two lots: add the number to itself.', `${a} + ${a} = ${2 * a}`);
    return L.end(2 * a, undefined, `Double ${a} = ${2 * a}`);
  }
  // Box method: the tens and the ones, each × 2.
  const box = (cells: string[], total?: string) => ({ kind: 'area' as const, cols: [f(t), f(o)], rows: ['× 2'], cells: [cells], cw: [t, Math.max(o, t / 3)], ...(total ? { total } : {}) });
  L.board = { kind: 'pic', frames: [{ step: 0, v: box(['', '']) }, { step: 1, v: box([f(2 * t), f(2 * o)]) }, { step: 2, v: box([f(2 * t), f(2 * o)], `${2 * t} + ${2 * o} = ${2 * a}`) }] };
  L.say(`Split ${a} into ${t} and ${o}.`);
  L.say('Double each part.', `double ${t} = ${2 * t}`, `double ${o} = ${2 * o}`);
  L.you(`double ${o} = ?`, 2 * o, [o + 2, 2 * o + 1, o * o === 2 * o ? 2 * o + 2 : o * o]);
  L.say('Add them.', `${2 * t} + ${2 * o} = ${2 * a}`);
  L.slip(a + 2, 'Double means two lots of the number, not + 2.');
  return L.end(2 * a, undefined, `Double ${a} = ${2 * a}`);
}

/** Halve an even 2-digit number: halve the tens, halve the ones, add. */
export function halveSplit(a: number): Lesson {
  const L = new LessonBuilder();
  const t = Math.floor(a / 10) * 10;
  const o = a % 10;
  // A bar of tens and ones, cut into two equal halves.
  const whole = (total?: string) => ({ kind: 'bar' as const, rows: [{ name: f(a), parts: [{ v: t, t: f(t), tone: 0 as const }, { v: o, t: f(o), tone: 1 as const }], ...(total ? { total } : {}) }] });
  const half = (n: boolean) => ({ name: 'half', parts: [{ v: t / 2, t: f(t / 2), tone: 3 as const, new: n }, { v: o / 2, t: f(o / 2), tone: 2 as const, new: n }] });
  L.board = { kind: 'pic', frames: [{ step: 0, v: whole(f(a)) }, { step: 1, v: { kind: 'bar', rows: [whole().rows[0], half(true), half(true)] } }, ...(o ? [{ step: 2, v: { kind: 'bar' as const, rows: [whole().rows[0], { ...half(false), total: `${t / 2} + ${o / 2} = ${a / 2}` }, half(false)] } }] : [])] };
  L.say(`Split ${a} into ${t} and ${o}.`);
  L.say('Halve each part: each half gets the same.', `half of ${t} = ${t / 2}`, ...(o ? [`half of ${o} = ${o / 2}`] : []));
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
  // The digits move apart; their sum drops into the gap.
  const row = (mid: string, hl: boolean, note?: string) => ({ kind: 'chain' as const, groups: [{ items: [String(t)], tone: 0 as const }, { items: [mid], tone: 2 as const, ...(hl ? { hl: [0] } : {}) }, { items: [String(o)], tone: 0 as const }], ops: ['', ''], ...(note ? { note } : {}) });
  L.board = { kind: 'pic', frames: [{ step: 0, v: row('_', false) }, { step: 1, v: row(`${t} + ${o} = ${s}`, true, s >= 10 ? `${s} is 10 or more: carry 1 to the ${t}` : `${t}${s}${o}`) }] };
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
  // Tiles of 25 grouped in fours: each four is 100.
  const four = (label: string) => ({ items: ['25', '25', '25', '25'], label, tone: 1 as const });
  const shown = Math.min(k, 3);
  L.board = { kind: 'pic', frames: [
    { step: 0, v: { kind: 'chain', groups: [four('= 100')], note: '4 × 25 = 100' } },
    { step: 1, v: { kind: 'chain', groups: [...Array.from({ length: shown }, () => four('100')), ...(k > 3 ? [{ items: ['…'], tone: 0 as const }] : [])], ops: Array(4).fill('+'), note: `${k} fours of 25 = ${k} hundreds = ${k * 100}` } },
  ] };
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
  const tens = d / 10;
  // The same rectangle: half as tall, twice as wide.
  const rect = (r: number, c: number, cell: string) => ({ kind: 'area' as const, cols: [f(c)], rows: [f(r)], cells: [[cell]], tone: [[1]] });
  L.board = { kind: 'pic', frames: [
    { step: 0, v: { kind: 'pair', a: rect(a, b, `${a} × ${b}`), b: rect(h, d, `${h} × ${d}`), op: '=', la: 'halve one side', lb: 'double the other' } },
    { step: 1, v: { kind: 'area', cols: Array(Math.min(tens, 5)).fill('10').concat(tens > 5 ? ['…'] : []), rows: [f(h)], cells: [Array(Math.min(tens, 5)).fill(f(h * 10)).concat(tens > 5 ? ['…'] : [])], total: `${tens} lots of ${h * 10} = ${h * d}` } },
  ] };
  L.say(`Halve ${a} and double ${b}: the answer stays the same, and it gets easier.`, `${a} × ${b} = ${h} × ${d}`);
  L.you(`${a} × ${b} = ${h} × ?`, d, [b, b / 2, d + 10].filter((x) => Number.isInteger(x)));
  L.say(`${d} is ${tens} tens.`, `${h} × ${tens} = ${h * tens}`, `${h * tens} × 10 = ${h * d}`);
  return L.end(a * b, undefined, `${a} × ${b} = ${a * b}`);
}

export { f };
