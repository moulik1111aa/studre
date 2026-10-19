// Decimal × and ÷ (Stage 5): work with whole numbers, then put the point back; make the
// divisor whole before dividing.

import { clean, num } from '../question.ts';
import { LessonBuilder, f } from './build.ts';
import type { Lesson } from './types.ts';

const places = (x: number): number => (num(x).split('.')[1] ?? '').length;
const whole = (x: number): number => Math.round(x * 10 ** places(x));

/** a × w where a has decimals. */
export function decTimesWhole(a: number, w: number): Lesson {
  const L = new LessonBuilder();
  const dp = places(a);
  const A = whole(a);
  const P = A * w;
  const ans = clean(a * w);
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
  L.sayThen(`Share ${A} ${unit} between ${w}.`, `${A} ÷ ${w} = ${f(Q)}`, `Check: ${f(Q)} × ${w} = ${A}.`);
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
  L.say(`Dividing by a decimal is awkward, so make it whole. Multiply both numbers by ${k}: the answer doesn't change.`, `${num(a)} × ${k} = ${num(A)}`, `${num(d)} × ${k} = ${num(D)}`);
  L.say('Now divide by a whole number.', `${num(A)} ÷ ${num(D)} = ${num(ans)}`);
  L.say('Check it.', `${num(ans)} × ${num(d)} = ${num(a)} ✓`);
  if (d < 1) L.slip(clean(a * d), `Dividing by a number less than 1 makes the answer bigger, not smaller.`);
  return L.end(num(ans), undefined, `${num(a)} ÷ ${num(d)} = ${num(ans)}`);
}
