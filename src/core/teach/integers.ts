// Negative numbers (Stage 4): temperatures on a number line through zero.

import { LessonBuilder, Line, f } from './build.ts';
import type { Lesson } from './types.ts';

/** t°C gets ch degrees colder / warmer. */
export function tempLesson(t: number, ch: number, colder: boolean): Lesson {
  const L = new LessonBuilder();
  const ans = colder ? t - ch : t + ch;
  const lo = Math.min(t, ans, 0) - 1;
  const hi = Math.max(t, ans, 0) + 1;
  const line = new Line('linear', { min: lo, max: hi, tick: 1, labelEvery: hi - lo <= 22 ? 1 : 5 });
  L.board = line.b;
  line.pt(0, 0, { tone: 'zero' }).pt(t, 0, { tone: 'start' });
  L.say(`Start at ${f(t)}°C. ${colder ? 'Colder means go down: to the left.' : 'Warmer means go up: to the right.'}`);
  const crosses = (t > 0 && ans < 0) || (t < 0 && ans > 0);
  if (crosses) {
    line.hop(t, 0, L.i).pt(0, L.i, { tone: 'zero' });
    L.say(`First ${colder ? 'down' : 'up'} ${f(Math.abs(t))} to 0.`, `${f(t)} ${colder ? '−' : '+'} ${f(Math.abs(t))} = 0`);
    const rest = ch - Math.abs(t);
    line.hop(0, ans, L.i).pt(ans, L.i, { tone: 'end', hl: L.i + 1 });
    L.say(`Then ${f(rest)} more ${colder ? 'below' : 'above'} zero.`, `0 ${colder ? '−' : '+'} ${f(rest)} = ${f(ans)}`);
  } else {
    line.hop(t, ans, L.i).pt(ans, L.i, { tone: 'end', hl: L.i + 1 });
    L.say(`${colder ? 'Down' : 'Up'} ${f(ch)}.`, `${f(t)} ${colder ? '−' : '+'} ${f(ch)} = ${f(ans)}`);
  }
  L.slip(colder ? t + ch : t - ch, colder ? 'Colder goes down, not up.' : 'Warmer goes up, not down.');
  if (ans !== 0) L.slip(-ans, 'Check which side of zero you end on.');
  return L.end(ans, `So it is ${f(ans)}°C.`);
}

/** The gap between a temperature below zero (lo) and one above it (hi): count through 0. */
export function tempGapLesson(lo: number, hi: number, warmer: boolean): Lesson {
  const L = new LessonBuilder();
  const gap = hi - lo;
  const line = new Line('linear', { min: lo - 1, max: hi + 1, tick: 1, labelEvery: hi - lo <= 22 ? 1 : 5 });
  L.board = line.b;
  line.pt(0, 0, { tone: 'zero' }).pt(lo, 0, { tone: 'start' }).pt(hi, 0, { tone: 'end' });
  L.say(`${warmer ? 'Warmer' : 'Colder'} by how much? Find the distance between ${f(lo)}°C and ${f(hi)}°C on the thermometer.`);
  line.hop(lo, 0, L.i);
  L.say(`From ${f(lo)} up to 0 is ${f(-lo)} degrees.`, `${f(-lo)}`);
  line.hop(0, hi, L.i);
  L.say(`From 0 up to ${f(hi)} is ${f(hi)} more.`, `${f(-lo)} + ${f(hi)} = ${f(gap)}`);
  L.slip(hi + lo, 'Across zero, add the two distances: don’t take one from the other.');
  return L.end(gap, `So it is ${f(gap)} degrees ${warmer ? 'warmer' : 'colder'}.`);
}
