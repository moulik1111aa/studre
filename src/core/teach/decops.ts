// Decimal × and ÷ (Stage 5): work with whole numbers, then put the point back; make the
// divisor whole before dividing.

import { clean, num } from '../question.ts';
import { LessonBuilder, f } from './build.ts';
import type { Lesson } from './types.ts';
import { pvShift } from './pics.ts';
import { busStop } from './muldiv.ts';
import { shiftBoard } from './build.ts';

const places = (x: number): number => (num(x).split('.')[1] ?? '').length;
const whole = (x: number): number => Math.round(x * 10 ** places(x));

/** a × w where a has decimals. */
export function decTimesWhole(a: number, w: number): Lesson {
  const L = new LessonBuilder();
  const dp = places(a);
  const A = whole(a);
  const P = A * w;
  const ans = clean(a * w);
  L.board = { kind: 'pic', frames: [
    { step: 0, v: { kind: 'area', cols: [String(w)], rows: [`${num(a)} → ${A}`], cells: [[`${A} × ${w} = ${P}`]], tone: [[1]] } },
    { step: 1, v: pvShift(P, -dp, `${dp} place${dp > 1 ? 's' : ''} back: ${num(ans)}`) },
  ] };
  L.say(`Take the point out: ${num(a)} becomes ${A}. Multiply as whole numbers.`, `${A} × ${w} = ${P}`);
  const raw = (P / 10 ** dp).toFixed(dp);
  L.say(`${num(a)} has ${dp} decimal place${dp > 1 ? 's' : ''}, so the answer has ${dp} too.`, raw === num(ans) ? `${P} → ${raw}` : `${P} → ${raw} = ${num(ans)}`);
  L.say(`Check it is sensible: ${num(a)} is about ${Math.round(a)}, and ${Math.round(a)} × ${w} = ${Math.round(a) * w}.`);
  L.slip(P, `Put the decimal point back: ${dp} decimal place${dp > 1 ? 's' : ''}.`);
  return L.end(num(ans), undefined, `${num(a)} × ${w} = ${num(ans)}`);
}

/** a × b with both decimals. */
export function decTimesDec(a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const da = places(a);
  const db = places(b);
  const P = whole(a) * whole(b);
  const ans = clean(a * b);
  const raw = (P / 10 ** (da + db)).toFixed(da + db);
  L.board = { kind: 'pic', frames: [
    { step: 0, v: { kind: 'pair', a: pvShift(num(a), da), b: pvShift(num(b), db), op: '×', la: `${num(a)} → ${whole(a)}`, lb: `${num(b)} → ${whole(b)}` } },
    { step: 1, v: pvShift(P, -(da + db), `${da} + ${db} = ${da + db} places back: ${raw}`) },
  ] };
  L.say('Take the points out and multiply as whole numbers.', `${whole(a)} × ${whole(b)} = ${P}`);
  L.say(`Count the decimal places in both: ${da} + ${db} = ${da + db}. The answer has ${da + db}.`, `${P} → ${raw}`);
  if (raw !== num(ans)) L.say(`A 0 at the end after the point changes nothing: ${raw} = ${num(ans)}.`);
  L.slip(clean(ans * 10), `Count the decimal places in both numbers: ${da + db} altogether.`);
  L.slip(clean(ans / 10), `Count the decimal places in both numbers: ${da + db} altogether.`);
  return L.end(num(ans), undefined, `${num(a)} × ${num(b)} = ${num(ans)}`);
}

/** a ÷ w where a has 1 or 2 decimals. */
export function decDivWhole(a: number, w: number): Lesson {
  const L = new LessonBuilder();
  const dp = Math.max(1, places(a));
  const A = Math.round(a * 10 ** dp);
  const Q = A / w;
  const ans = clean(a / w);
  const unit = dp === 1 ? 'tenths' : 'hundredths';
  L.say(`Think of ${num(a)} as ${A} ${unit}.`);
  // Short division of the tenths (or hundredths), then the point hops back.
  const bus = Number.isInteger(Q) && w <= 12 ? busStop(A, w) : null;
  if (bus) {
    L.take(bus);
    L.board = { kind: 'stack', boards: [{ kind: 'pic', frames: [{ step: 0, v: pvShift(num(a), dp, `${num(a)} = ${A} ${unit}`) }, { step: L.i, v: pvShift(f(Q), -dp, `${f(Q)} ${unit} = ${num(ans)}`) }] }, shiftBoard(bus.board!, 1)] };
  } else {
    L.board = { kind: 'pic', frames: [{ step: 0, v: pvShift(num(a), dp, `${num(a)} = ${A} ${unit}`) }, { step: 2, v: pvShift(f(Q), -dp, `${f(Q)} ${unit} = ${num(ans)}`) }] };
    L.sayThen(`Share ${A} ${unit} between ${w}.`, `${A} ÷ ${w} = ${f(Q)}`, `Check: ${f(Q)} × ${w} = ${A}.`);
  }
  L.say(`${f(Q)} ${unit} is ${num(ans)}.`, `${f(Q)} ÷ ${10 ** dp} = ${num(ans)}`);
  L.slip(Q, `That is ${f(Q)} ${unit}. Put the point back.`);
  return L.end(num(ans), undefined, `${num(a)} ÷ ${w} = ${num(ans)}`);
}

/** a ÷ d where d is a decimal: make d whole first. */
export function divByDecimal(a: number, d: number): Lesson {
  const L = new LessonBuilder();
  const k = 10 ** places(d);
  const A = clean(a * k);
  const D = clean(d * k);
  const ans = clean(a / d);
  const kk = Math.round(Math.log10(k));
  const both = { kind: 'pair' as const, a: pvShift(num(a), kk), b: pvShift(num(d), kk), op: '÷', la: `${num(a)} → ${num(A)}`, lb: `${num(d)} → ${num(D)}` };
  L.board = { kind: 'pic', frames: [{ step: 0, v: both }, { step: 1, v: { kind: 'chain', groups: [{ items: [num(A)], tone: 1 }, { items: [num(D)], tone: 2 }], ops: ['÷'], note: `= ${num(ans)}` } }] };
  L.say(`Dividing by a decimal is awkward, so make it whole. Multiply both numbers by ${k}: the answer doesn't change.`, `${num(a)} × ${k} = ${num(A)}`, `${num(d)} × ${k} = ${num(D)}`);
  L.say('Now divide by a whole number.', `${num(A)} ÷ ${num(D)} = ${num(ans)}`);
  L.say('Check it.', `${num(ans)} × ${num(d)} = ${num(a)} ✓`);
  if (d < 1) L.slip(clean(a * d), `Dividing by a number less than 1 makes the answer bigger, not smaller.`);
  return L.end(num(ans), undefined, `${num(a)} ÷ ${num(d)} = ${num(ans)}`);
}
