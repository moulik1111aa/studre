// Add and subtract: counting on and back, making ten, counting up in jumps (the "frog"),
// keeping the tens, and the column methods with carrying and exchanging.
//
// Every method takes the numbers and an optional `show` (the working line for the answer step,
// in the question's own order).

import { clean, num } from '../question.ts';
import { LessonBuilder, Line, f, rs, list, digits, PLACES, PLACE_ONE, DEC_PLACES } from './build.ts';
import type { BlocksBoard, ColsBoard, ColsCell, Lesson, TableBoard } from './types.ts';

const isInt = (n: number): boolean => Number.isInteger(clean(n));
const uniq = (xs: string[]): string[] => [...new Set(xs)];
const between0 = (v: number): boolean => !Number.isFinite(v) || v <= 0;
const decimals = (n: number): number => (num(n).split('.')[1] ?? '').length;
export const ceilTo = (x: number, u: number): number => Math.ceil(clean(x / u)) * u;
export const floorTo = (x: number, u: number): number => Math.floor(clean(x / u)) * u;

/** Range for a short counting line around the numbers used. */
function countingRange(lo: number, hi: number): { min: number; max: number; tick: number; labelEvery: number } {
  let min = Math.max(0, lo);
  let max = hi;
  if (max - min < 10) {
    min = Math.max(0, Math.min(min, max - 10));
    max = Math.max(max, min + 10);
  }
  const span = max - min;
  return { min, max, tick: 1, labelEvery: span <= 20 ? 1 : span <= 50 ? 5 : 10 };
}
/** Base-ten blocks for a whole number below 1000. */
function blocksOf(n: number, at = 0, label?: string): BlocksBoard['groups'][number] {
  return { h: Math.floor(n / 100), t: Math.floor(n / 10) % 10, o: n % 10, at, label: label ?? f(n) };
}

// ── Small numbers ──────────────────────────────────────────────────────────

/** Adding zero. */
export function addZero(a: number, b: number, show = `${f(a)} + ${f(b)} = ${f(a + b)}`): Lesson {
  const L = new LessonBuilder();
  const n = a || b;
  L.say('Adding 0 means adding nothing at all.');
  return L.end(n, `So the number stays ${f(n)}.`, show);
}

/** Count on from the bigger number in ones. */
export function countOn(a: number, b: number, show = `${f(a)} + ${f(b)} = ${f(a + b)}`): Lesson {
  if (a === 0 || b === 0) return addZero(a, b, show);
  const L = new LessonBuilder();
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const sum = a + b;
  const line = new Line('linear', countingRange(big - 1, sum + 1));
  L.board = line.b;
  line.pt(big, 0, { tone: 'start' });
  L.say(b > a ? `Start with the bigger number, ${f(big)}. Then count on ${f(small)}.` : `Start at ${f(a)} and count on ${f(b)}.`);
  const seq: number[] = [];
  for (let x = big; x < sum; x++) {
    line.hop(x, x + 1, L.i);
    seq.push(x + 1);
  }
  line.pt(sum, L.i, { tone: 'end', hl: L.i + 1 });
  L.say(`Count on ${f(small)}: ${seq.join(', ')}.`);
  L.slip(sum - 1, `So close! Start counting on from the number after ${f(big)}.`);
  L.slip(sum + 1, `So close! Don't count ${f(big)} itself — start from the next number.`);
  if (a > b) L.slip(a - b, 'That is taking away. + means add, so count on.');
  return named(L.end(sum, undefined, show), 'Count on', 'add' as 'add' | 'sub', () => addWays(a, b));
}

/** Count back in ones. */
export function countBack(a: number, b: number, show = `${f(a)} − ${f(b)} = ${f(a - b)}`): Lesson {
  const L = new LessonBuilder();
  const res = a - b;
  if (b === 0) {
    L.say('Taking away 0 takes away nothing.');
    return L.end(a, `So the number stays ${f(a)}.`, show);
  }
  const line = new Line('linear', countingRange(res - 1, a + 1));
  L.board = line.b;
  line.pt(a, 0, { tone: 'start' });
  L.say(`Start at ${f(a)} and count back ${f(b)}.`);
  const seq: number[] = [];
  for (let x = a; x > res; x--) {
    line.hop(x, x - 1, L.i);
    seq.push(x - 1);
  }
  line.pt(res, L.i, { tone: 'end', hl: L.i + 1 });
  L.say(`Count back ${f(b)}: ${seq.join(', ')}.`);
  L.slip(res + 1, `So close! Don't count ${f(a)} itself — start from the number before it.`);
  L.slip(res - 1, 'So close! Count back carefully, one jump for each number.');
  L.slip(a + b, 'That is adding. − means take away, so count back.');
  return named(L.end(res, undefined, show), 'Count back', 'sub' as 'add' | 'sub', () => subWays(a, b));
}

/** Count up from b to a (for a − b when the numbers are close). */
export function countUpSub(a: number, b: number, show = `${f(a)} − ${f(b)} = ${f(a - b)}`): Lesson {
  const L = new LessonBuilder();
  const res = a - b;
  const line = new Line('linear', countingRange(b - 1, a + 1));
  L.board = line.b;
  line.pt(b, 0, { tone: 'start' }).pt(a, 0, { tone: 'mark' });
  L.say(`${f(b)} and ${f(a)} are close together, so count up from ${f(b)} to ${f(a)}.`);
  for (let x = b; x < a; x++) line.hop(x, x + 1, L.i);
  L.say(`From ${f(b)} up to ${f(a)} is ${f(res)} jump${res === 1 ? '' : 's'}.`);
  L.slip(a + b, 'That is adding. − means take away.');
  return named(L.end(res, undefined, show), 'Count up', 'sub' as 'add' | 'sub', () => subWays(a, b));
}

/** Make the next ten first: 8 + 5 = 8 + 2 + 3. (Needs the sum to pass a ten.) */
export function bridgeAdd(a: number, b: number, show = `${f(a)} + ${f(b)} = ${f(a + b)}`): Lesson {
  const swap = b > a && a < 10;
  const [x, y] = swap ? [b, a] : [a, b];
  const sum = a + b;
  const T = Math.floor(x / 10) * 10 + 10;
  const k = T - x;
  const rest = y - k;
  if (rest <= 0 || y >= 10) return y < 10 ? countOn(a, b, show) : partitionAdd(a, b, show);
  const L = new LessonBuilder();
  const line = sum <= 20 ? new Line('linear', { min: 0, max: 20, tick: 1, labelEvery: 1 }) : new Line('even');
  L.board = line.b;
  line.pt(x, 0, { tone: 'start' }).pt(T, 0, { tone: 'mark' });
  L.say(`${swap ? `Start with the bigger number, ${f(x)}.` : `Start at ${f(x)}.`} Make ${f(T)} first.`);
  line.hop(x, T, L.i);
  L.say(`${f(x)} needs ${f(k)} more to make ${f(T)}.`, `${f(x)} + ${f(k)} = ${f(T)}`);
  L.steps[L.steps.length - 1].turn = { ask: `${f(x)} + ? = ${f(T)}`, answer: f(k), choices: uniq([f(k), f(k + 1), f(Math.max(0, k - 1)), f(T - x + 2)]).slice(0, 3) };
  line.hop(T, sum, L.i).pt(sum, L.i, { tone: 'end', hl: L.i + 1 });
  L.say(`${f(y)} is ${f(k)} and ${f(rest)}, so add the ${f(rest)} that is left.`, `${f(T)} + ${f(rest)} = ${f(sum)}`);
  L.slip(sum - 10, `Careful: you passed ${f(T)}, so the answer is in the next ten.`);
  if (x !== y) L.slip(2 * x, `That is ${f(x)} + ${f(x)}, double ${f(x)}. The other number is ${f(y)}.`);
  L.slip(sum - 1, 'So close — check the last jump.');
  L.slip(sum + 1, 'So close — check the last jump.');
  return named(L.end(sum, undefined, show), 'Make ten', 'add' as 'add' | 'sub', () => addWays(a, b));
}

/** Take away down to the ten first: 13 − 5 = 13 − 3 − 2. (Needs b to pass the ten.) */
export function bridgeSub(a: number, b: number, show = `${f(a)} − ${f(b)} = ${f(a - b)}`): Lesson {
  const T = floorTo(a, 10);
  const k = a - T;
  const rest = b - k;
  if (k === 0 || rest <= 0 || b >= 10) return a <= 20 ? countBack(a, b, show) : partitionSub(a, b, show);
  const res = a - b;
  const L = new LessonBuilder();
  const line = a <= 20 ? new Line('linear', { min: 0, max: 20, tick: 1, labelEvery: 1 }) : new Line('even');
  L.board = line.b;
  line.pt(a, 0, { tone: 'start' }).pt(T, 0, { tone: 'mark' });
  L.say(`Take ${f(b)} away in two jumps. First get down to ${f(T)}.`);
  line.hop(a, T, L.i);
  L.say(`Take away ${f(k)} to get to ${f(T)}.`, `${f(a)} − ${f(k)} = ${f(T)}`);
  line.hop(T, res, L.i).pt(res, L.i, { tone: 'end', hl: L.i + 1 });
  L.say(`${f(b)} is ${f(k)} and ${f(rest)}, so take away the other ${f(rest)}.`, `${f(T)} − ${f(rest)} = ${f(res)}`);
  L.slip(res + 10, `Careful: you went below ${f(T)}, so the answer is in the ten below.`);
  L.slip(a + b, 'That is adding. − means take away.');
  return named(L.end(res, undefined, show), 'Back to ten', 'sub' as 'add' | 'sub', () => subWays(a, b));
}

/** A multiple of ten take away a single digit: 50 − 7 (10 − 7 = 3, so 43). */
export function subFromTen(a: number, b: number, show = `${f(a)} − ${f(b)} = ${f(a - b)}`): Lesson {
  const L = new LessonBuilder();
  const res = a - b;
  const line = new Line('even');
  L.board = line.b;
  line.pt(a, 0, { tone: 'start' }).pt(a - 10, 0, { tone: 'mark' });
  L.say(`${f(a)} is ${f(a - 10)} and 10. Take the ${f(b)} from the 10.`, `10 − ${f(b)} = ${f(10 - b)}`);
  line.hop(a, res, L.i).pt(res, L.i, { tone: 'end', hl: L.i + 1 });
  L.say(`${f(a - 10)} and the ${f(10 - b)} left make ${f(res)}.`, `${f(a - 10)} + ${f(10 - b)} = ${f(res)}`);
  L.slip(a - 10 + b, `Take the ${f(b)} away from the 10: 10 − ${f(b)} = ${f(10 - b)}.`);
  return L.end(res, undefined, show);
}

/** Keep the tens, work with the ones (13 + 4, 17 − 3, 347 + 2). */
export function keepTheTen(a: number, b: number, op: '+' | '−', show = `${f(a)} ${op} ${f(b)} = ${f(op === '+' ? a + b : a - b)}`): Lesson {
  const L = new LessonBuilder();
  const res = op === '+' ? a + b : a - b;
  const tens = floorTo(a, 10);
  const ones = a - tens;
  const onesRes = op === '+' ? ones + b : ones - b;
  if (a < 1000 && res < 1000) L.board = { kind: 'blocks', groups: [blocksOf(a), blocksOf(res, 2)] };
  L.say(`${f(a)} is ${f(tens)} and ${f(ones)}. Keep the ${f(tens)}.`);
  L.say(op === '+' ? `Add ${f(b)} to the ones.` : `Take ${f(b)} from the ones.`, `${f(ones)} ${op} ${f(b)} = ${f(onesRes)}`);
  L.say(`${f(tens)} and ${f(onesRes)} make ${f(res)}.`, `${f(tens)} + ${f(onesRes)} = ${f(res)}`);
  L.slip(onesRes, `Don't forget the ${f(tens)}!`);
  L.slip(op === '+' ? a - b : a + b, op === '+' ? 'That is taking away. + means add.' : 'That is adding. − means take away.');
  return named(L.end(res, undefined, show), 'Keep the ten', op === '+' ? 'add' : 'sub' as 'add' | 'sub', () => op === '+' ? addWays(a, b) : subWays(a, b));
}

// ── Jumps on an empty number line ──────────────────────────────────────────

/** Landing points counting up from `from` to `to`: next ten, next hundred, then big jumps, then the rest. */
export function jumpsUp(from: number, to: number): number[] {
  const out: number[] = [];
  let x = from;
  const go = (y: number) => {
    if (y > x && y <= to) {
      out.push(clean(y));
      x = clean(y);
    }
  };
  if (!isInt(x)) go(Math.ceil(x));
  for (const u of [10, 100, 1000]) if (x % u !== 0) go(ceilTo(x, u));
  for (const u of [1000, 100, 10]) go(floorTo(to, u));
  go(to);
  return out;
}

/**
 * Count up in jumps from `from` to `to` and add the jumps (missing numbers, differences, change).
 * `intro` is the first sentence.
 */
export function frog(from: number, to: number, intro: string, o: { money?: boolean; endText?: string; show?: string; answerAs?: string } = {}): Lesson {
  const fmt = (n: number): string => (o.money ? rs(n) : f(n));
  // Too many jumps (big numbers): the written method is clearer.
  if (jumpsUp(from, to).length > 4) {
    const L = new LessonBuilder();
    L.say(`The gap from ${fmt(from)} to ${fmt(to)} is ${fmt(to)} − ${fmt(from)}. Work it out in columns.`);
    L.take(columnSub(to, from, { money: o.money }));
    return L.end(o.answerAs ?? fmt(clean(to - from)), o.endText, o.show);
  }
  const L = new LessonBuilder();
  const line = new Line('even');
  L.board = line.b;
  line.pt(from, 0, { tone: 'start', label: fmt(from) }).pt(to, 0, { tone: 'mark', label: fmt(to) });
  L.say(intro);
  const lands = jumpsUp(from, to);
  let prev = from;
  const hops: number[] = [];
  lands.forEach((at, k) => {
    const d = clean(at - prev);
    hops.push(d);
    line.hop(prev, at, L.i, `+${fmt(d)}`);
    if (at !== to) line.pt(at, L.i, { label: fmt(at) });
    let text: string;
    if (at === to) text = k === 0 ? `Jump straight to ${fmt(to)}.` : `Then jump to ${fmt(to)}.`;
    else if (!isInt(prev) && isInt(at)) text = `Jump to the next whole rupee, ${fmt(at)}.`;
    else if (at % 100 === 0 && prev % 100 !== 0 && d < 100) text = `Jump to the next hundred, ${fmt(at)}.`;
    else if (at % 10 === 0 && prev % 10 !== 0 && d < 10) text = `Jump to the next ten, ${fmt(at)}.`;
    else if (d % 1000 === 0) text = `Jump ${f(d / 1000)} thousand${d === 1000 ? '' : 's'} to ${fmt(at)}.`;
    else if (d % 100 === 0) text = `Jump ${f(d / 100)} hundred${d === 100 ? '' : 's'} to ${fmt(at)}.`;
    else if (d % 10 === 0) text = `Jump ${f(d / 10)} ten${d === 10 ? '' : 's'} to ${fmt(at)}.`;
    else text = `Jump to ${fmt(at)}.`;
    L.say(text, `${fmt(prev)} + ${fmt(d)} = ${fmt(at)}`);
    prev = at;
  });
  const total = clean(to - from);
  if (hops.length > 1) L.say('Add up the jumps.', `${hops.map(fmt).join(' + ')} = ${fmt(total)}`);
  L.slip(clean(to + from), 'That is adding them together. We need the gap between them.');
  if (total >= 20) {
    L.slip(clean(total + 10), 'Check the tens — you have 10 too many.');
    L.slip(clean(total - 10), 'Check the tens — you are 10 short.');
  }
  return L.end(o.answerAs ?? fmt(total), o.endText, o.show);
}

/** a + ? = c, counting up (in ones for small numbers). */
export function missingAddend(a: number, c: number, show = `${f(a)} + ${f(c - a)} = ${f(c)}`): Lesson {
  const b = c - a;
  if (c <= 20 && b <= 10 && isInt(a) && isInt(c)) {
    const L = new LessonBuilder();
    const line = new Line('linear', countingRange(a - 1, c + 1));
    L.board = line.b;
    line.pt(a, 0, { tone: 'start' }).pt(c, 0, { tone: 'mark' });
    L.say(`What goes with ${f(a)} to make ${f(c)}? Start at ${f(a)} and count up to ${f(c)}.`);
    const seq: number[] = [];
    for (let x = a; x < c; x++) {
      line.hop(x, x + 1, L.i);
      seq.push(x + 1);
    }
    if (b > 0) L.say(`Count the jumps: ${seq.join(', ')}. That is ${f(b)} jump${b === 1 ? '' : 's'}.`);
    else L.say(`${f(a)} is already ${f(c)}, so we add nothing.`);
    L.slip(c, `${f(c)} is the total. We need how many to add to ${f(a)}.`);
    L.slip(a + c, 'That is adding both numbers. We need the gap between them.');
    return L.end(b, undefined, show);
  }
  return frog(a, c, `What do we add to ${f(a)} to make ${f(c)}? Count up from ${f(a)} in jumps.`, { show });
}

/** ? + b = c: the missing number is c − b. */
export function missingFirst(b: number, c: number, show = `${f(c - b)} + ${f(b)} = ${f(c)}`): Lesson {
  if (c > 20 && c - b <= 4 * b) return frog(b, c, `The missing number and ${f(b)} make ${f(c)}. Count up from ${f(b)} to ${f(c)}.`, { show });
  const L = new LessonBuilder();
  L.say(`The missing number and ${f(b)} make ${f(c)}. So take ${f(b)} away from ${f(c)}.`);
  L.take(subLesson(c, b));
  return L.end(c - b, undefined, show);
}

/** a − ? = c: how much was taken away is the gap from c up to a. */
export function missingSubtrahend(a: number, c: number, show = `${f(a)} − ${f(a - c)} = ${f(c)}`): Lesson {
  const b = a - c;
  if (a > 20) return frog(c, a, `What was taken from ${f(a)} to leave ${f(c)}? It is the gap between them: count up from ${f(c)} to ${f(a)}.`, { show });
  const L = new LessonBuilder();
  const line = new Line('linear', countingRange(c - 1, a + 1));
  L.board = line.b;
  line.pt(a, 0, { tone: 'start' }).pt(c, 0, { tone: 'mark' });
  L.say(`We start at ${f(a)} and end at ${f(c)}. How many did we take away?`);
  for (let x = a; x > c; x--) line.hop(x, x - 1, L.i);
  if (b > 0) L.say(`Count back from ${f(a)} to ${f(c)}: that is ${f(b)} jump${b === 1 ? '' : 's'}.`);
  else L.say(`${f(a)} and ${f(c)} are the same, so nothing was taken.`);
  L.slip(a + c, 'Not quite: we need the gap between the two numbers.');
  return L.end(b, undefined, show);
}

/** ? − b = c: add back what was taken. */
export function missingMinuend(b: number, c: number, show = `${f(b + c)} − ${f(b)} = ${f(c)}`): Lesson {
  const L = new LessonBuilder();
  L.say(`Taking away ${f(b)} left ${f(c)}. To find the start, add the ${f(b)} back.`);
  L.take(addLesson(c, b));
  L.slip(c - b, 'Add it back: taking away again goes the wrong way.');
  return L.end(b + c, undefined, show);
}

// ── Place value jumps ──────────────────────────────────────────────────────

/** Adding or taking whole tens / hundreds / thousands when only that digit changes; null otherwise. */
export function placeJump(a: number, b: number, op: '+' | '−', show = `${f(a)} ${op} ${f(b)} = ${f(op === '+' ? a + b : a - b)}`): Lesson | null {
  if (!isInt(a) || !isInt(b) || b <= 0) return null;
  const p = b % 1000 === 0 ? 3 : b % 100 === 0 ? 2 : b % 10 === 0 ? 1 : -1;
  if (p < 1 || b >= 10 ** (p + 1)) return null;
  const k = b / 10 ** p;
  const d = Math.floor(a / 10 ** p) % 10;
  const nd = op === '+' ? d + k : d - k;
  if (nd < 0 || nd > 9) return null;
  const res = op === '+' ? a + b : a - b;
  const L = new LessonBuilder();
  const width = Math.max(String(a).length, String(res).length, p + 1);
  const heads = ['O', 'T', 'H', 'Th', 'TTh'].slice(0, width).reverse();
  const row = (n: number, at: number): TableBoard['rows'][number] => ({
    at,
    cells: String(n)
      .padStart(width, ' ')
      .split('')
      .map((ch, i) => (width - 1 - i === p ? { v: ch.trim() || '0', tone: 'key' as const, hl: at } : ch.trim())),
  });
  L.board = { kind: 'table', head: heads, rows: [row(a, 0), { ...row(res, 1), note: `${op} ${f(b)}` }] };
  L.say(`${f(b)} is ${f(k)} ${k === 1 ? PLACE_ONE[p] : PLACES[p]}. Only the ${PLACES[p]} digit changes.`);
  const pl = (x: number) => `${f(x)} ${x === 1 ? PLACE_ONE[p] : PLACES[p]}`;
  L.say(`${op === '+' ? 'Add' : 'Take away'} ${pl(k)}.`, `${pl(d)} ${op} ${pl(k)} = ${pl(nd)}`);
  L.slip(op === '+' ? a + k : a - k, `${f(b)} is ${f(k)} ${PLACES[p]}, not ${f(k)} ones.`);
  return L.end(res, undefined, show);
}

/** Add the tens, then the ones, as jumps (mental, no carrying). */
export function partitionAdd(a: number, b: number, show = `${f(a)} + ${f(b)} = ${f(a + b)}`): Lesson {
  const L = new LessonBuilder();
  const line = new Line('even');
  L.board = line.b;
  const tens = floorTo(b, 10);
  const ones = b - tens;
  const mid = a + tens;
  const res = a + b;
  line.pt(a, 0, { tone: 'start' });
  L.say(tens && ones ? `Start at ${f(a)}. Split ${f(b)} into ${f(tens)} and ${f(ones)}.` : `Start at ${f(a)}.`);
  if (tens) {
    line.hop(a, mid, L.i).pt(mid, L.i, { tone: ones ? undefined : 'end', hl: ones ? undefined : L.i + 1 });
    L.say(ones ? 'Add the tens first.' : `Add ${f(tens)}.`, `${f(a)} + ${f(tens)} = ${f(mid)}`);
  }
  if (ones) {
    line.hop(mid, res, L.i).pt(res, L.i, { tone: 'end', hl: L.i + 1 });
    L.say(tens ? 'Then add the ones.' : `Add ${f(ones)}.`, `${f(mid)} + ${f(ones)} = ${f(res)}`);
  }
  L.slip(a - b, 'That is taking away. + means add.');
  return named(L.end(res, undefined, show), 'Split', 'add' as 'add' | 'sub', () => addWays(a, b));
}

/** Take the tens, then the ones, as jumps back (mental, no exchanging). */
export function partitionSub(a: number, b: number, show = `${f(a)} − ${f(b)} = ${f(a - b)}`): Lesson {
  const L = new LessonBuilder();
  const line = new Line('even');
  L.board = line.b;
  const tens = floorTo(b, 10);
  const ones = b - tens;
  const mid = a - tens;
  const res = a - b;
  line.pt(a, 0, { tone: 'start' });
  L.say(tens && ones ? `Start at ${f(a)}. Split ${f(b)} into ${f(tens)} and ${f(ones)}.` : `Start at ${f(a)}.`);
  if (tens) {
    line.hop(a, mid, L.i).pt(mid, L.i, { tone: ones ? undefined : 'end', hl: ones ? undefined : L.i + 1 });
    L.say(ones ? 'Take away the tens first.' : `Take away ${f(tens)}.`, `${f(a)} − ${f(tens)} = ${f(mid)}`);
  }
  if (ones) {
    line.hop(mid, res, L.i).pt(res, L.i, { tone: 'end', hl: L.i + 1 });
    L.say(tens ? 'Then take away the ones.' : `Take away ${f(ones)}.`, `${f(mid)} − ${f(ones)} = ${f(res)}`);
  }
  L.slip(a + b, 'That is adding. − means take away.');
  return named(L.end(res, undefined, show), 'Split', 'sub' as 'add' | 'sub', () => subWays(a, b));
}

// ── Column methods ─────────────────────────────────────────────────────────

interface Aligned {
  strs: string[];
  width: number;
  dp: number;
  /** Column index of the decimal point (−1 if none). */
  point: number;
}
function align(nums: number[], extra: number[] = []): Aligned {
  const dp = Math.max(...[...nums, ...extra].map(decimals));
  const str = (n: number) => (dp ? clean(n).toFixed(dp) : String(clean(n)));
  const strs = nums.map(str);
  const width = Math.max(...[...nums, ...extra].map((n) => str(n).length));
  return { strs, width, dp, point: dp ? width - dp - 1 : -1 };
}
/** Place of column c (counted from the left) in a grid of width w with dp decimal places. */
function placeOf(c: number, w: number, dp: number): { name: string; one: string; value: number } {
  const fromRight = w - 1 - c;
  if (dp && fromRight < dp) {
    const k = dp - 1 - fromRight;
    return { name: DEC_PLACES[k], one: DEC_PLACES[k].replace(/s$/, ''), value: 10 ** -(k + 1) };
  }
  const k = fromRight - (dp ? dp + 1 : 0);
  return { name: PLACES[k] ?? 'place', one: PLACE_ONE[k] ?? 'place', value: 10 ** k };
}
function heads(w: number, dp: number): string[] | undefined {
  const out: string[] = [];
  for (let c = 0; c < w; c++) {
    const fromRight = w - 1 - c;
    if (dp && fromRight < dp) out.push(['t', 'h', 'th'][dp - 1 - fromRight]);
    else if (dp && fromRight === dp) out.push('');
    else out.push(['O', 'T', 'H', 'Th', 'TTh', 'L', 'TL'][fromRight - (dp ? dp + 1 : 0)] ?? '');
  }
  return w <= 8 ? out : undefined;
}
const digitAt = (s: string, w: number, c: number): number | undefined => {
  const i = c - (w - s.length);
  if (i < 0) return undefined;
  const ch = s[i];
  return ch === '.' || ch === undefined ? undefined : Number(ch);
};
const withPoint = (digitsStr: string, dp: number): number => Number(dp ? `${digitsStr.slice(0, -dp) || '0'}.${digitsStr.slice(-dp)}` : digitsStr);

/** Column addition (two or more numbers, whole or decimal), carrying from right to left. */
export function columnAdd(nums: number[], o: { money?: boolean; show?: string } = {}): Lesson {
  const L = new LessonBuilder();
  const total = clean(nums.reduce((p, c) => p + c, 0));
  const A = align(nums, [total]);
  const { strs, dp, point, width } = A;
  const k = nums.length;
  const ansRow = k + 1;
  const cells: ColsCell[] = [];
  strs.forEach((s, i) => s.split('').forEach((ch, j) => cells.push({ r: i + 1, c: width - s.length + j, ch })));
  const board: ColsBoard = { kind: 'cols', width, heads: heads(width, dp), rows: ['small', ...nums.map(() => 'num' as const), 'ans'], rules: [k], ops: [{ r: k, ch: '+' }], cells, focus: [] };
  L.board = board;
  const padded = dp > 0 && nums.some((n) => decimals(n) < dp);
  L.say(dp ? `Line up the decimal points, so each column is the same place.${padded ? ' Fill any gaps with 0.' : ''}` : 'Line up the numbers: ones under ones, tens under tens.');
  if (point >= 0) cells.push({ r: ansRow, c: point, ch: '.', at: 1, tone: 'ans' });
  let carry = 0;
  let turned = false;
  let noCarry = '';
  const carried: { carry: number; name: string; value: number }[] = [];
  const bring: number[] = [];
  const flushBring = () => {
    if (!bring.length) return;
    const names = bring.map((c) => placeOf(c, width, dp).name).reverse();
    for (const c of bring) {
      const d = strs.map((s) => digitAt(s, width, c)).find((x) => x !== undefined)!;
      cells.push({ r: ansRow, c, ch: String(d), tone: 'ans', at: L.i });
      board.focus!.push({ c, at: L.i, until: L.i + 1 });
    }
    L.say(`Nothing to add in the ${list(names)}: just write ${bring.length === 1 ? 'it' : 'them'} down.`);
    bring.length = 0;
  };
  for (let c = width - 1; c >= 0; c--) {
    if (c === point) continue;
    const ds = strs.map((s) => digitAt(s, width, c)).filter((x): x is number => x !== undefined);
    const place = placeOf(c, width, dp);
    if (!ds.length) {
      if (carry) {
        flushBring();
        cells.push({ r: ansRow, c, ch: String(carry), tone: 'ans', at: L.i });
        board.focus!.push({ c, at: L.i, until: L.i + 1 });
        L.say(`Write the carried ${carry} in the ${place.name}.`);
        carry = 0;
      }
      continue;
    }
    noCarry = String(ds.reduce((p, x) => p + x, 0) % 10) + noCarry;
    if (ds.length === 1 && !carry) {
      bring.push(c);
      continue;
    }
    flushBring();
    const terms = carry ? [carry, ...ds] : ds;
    const s = terms.reduce((p, x) => p + x, 0);
    const write = s % 10;
    const next = Math.floor(s / 10);
    if (carry) carried.push({ carry, name: place.name, value: place.value });
    cells.push({ r: ansRow, c, ch: String(write), tone: 'ans', at: L.i });
    board.focus!.push({ c, at: L.i, until: L.i + 1 });
    let left = c - 1;
    if (left === point) left--;
    if (next) cells.push({ r: 0, c: left, ch: String(next), tone: 'carry', at: L.i });
    const nextPlace = placeOf(left, width, dp).name;
    L.sayThen(`Add the ${place.name}${carry ? `, with the carried ${carry}` : ''}:`, `${terms.join(' + ')} = ${s}`, next ? `Write ${write} and carry ${next} to the ${nextPlace}.` : `Write ${write}.`);
    // Your turn (the first carry): what goes to the next column?
    if (next && !turned) {
      turned = true;
      L.steps[L.steps.length - 1].turn = { ask: `${s} is ${next} ${placeOf(left, width, dp).one}${next > 1 ? 's' : ''} and ${write}. What do we carry?`, answer: String(next), choices: uniq([String(next), String(write === next ? next + 1 : write), String(s)]) };
    }
    carry = next;
  }
  flushBring();
  // Two whole numbers to 999: base-ten blocks over the columns, bundling as they carry.
  if (nums.length === 2 && twoInts(nums[0], nums[1]) && total < 1000 && !dp) {
    const cols: { step: number }[] = [];
    for (let p = 0; p < width; p++) cols.push({ step: board.focus!.find((z) => z.c === width - 1 - p)?.at ?? 0 });
    L.board = { kind: 'stack', boards: [{ kind: 'bundle', nums, cols }, board] };
  }
  const show = (s: string) => (o.money ? `₹${s}` : s);
  const totalStr = dp ? total.toFixed(dp) : String(total);
  const nc = withPoint(noCarry, dp);
  if (Number.isFinite(nc) && clean(nc) !== total) L.slip(clean(nc), 'Don’t forget to carry: when a column makes 10 or more, carry the ten to the next column.');
  for (const ci of carried) {
    const val = clean(total - ci.carry * ci.value);
    if (val > 0) L.slip(val, `Check the ${ci.name}: remember the carried ${ci.carry}.`);
  }
  // Writing each column's whole total (47 + 38 → 715) instead of carrying.
  if (!dp && nums.length === 2 && carried.length) {
    let joined = '';
    for (let c = 0; c < width; c++) {
      const ds = strs.map((s) => digitAt(s, width, c)).filter((x): x is number => x !== undefined);
      if (ds.length) joined += String(ds.reduce((p, x) => p + x, 0));
    }
    if (Number(joined) !== total) L.slip(Number(joined), 'You wrote each column’s whole total. When a column makes 10 or more, write the ones digit and carry the ten.');
  }
  return named(L.end(show(o.money && dp ? total.toFixed(2) : totalStr), undefined, o.show ?? `${strs.map(show).join(' + ')} = ${show(totalStr)}`), 'Column', 'add' as 'add' | 'sub', () => nums.length === 2 ? addWays(nums[0], nums[1]) : []);
}

/** Column subtraction, exchanging from the next column (and across zeros) when needed. */
export function columnSub(a: number, b: number, o: { money?: boolean; show?: string } = {}): Lesson {
  const L = new LessonBuilder();
  const res = clean(a - b);
  const A = align([a, b], [res]);
  const { strs, dp, point, width } = A;
  const [top, bot] = strs;
  const resStr = dp ? res.toFixed(dp) : String(res);
  // Rows: 0 second exchange, 1 first exchange, 2 top number, 3 bottom number, 4 answer.
  const cells: ColsCell[] = [];
  top.split('').forEach((ch, j) => cells.push({ r: 2, c: width - top.length + j, ch }));
  bot.split('').forEach((ch, j) => cells.push({ r: 3, c: width - bot.length + j, ch }));
  const board: ColsBoard = { kind: 'cols', width, heads: heads(width, dp), rows: ['small', 'small', 'num', 'num', 'ans'], rules: [3], ops: [{ r: 3, ch: '−' }], cells, focus: [] };
  L.board = board;
  const padded = dp > 0 && [a, b].some((n) => decimals(n) < dp);
  L.say(dp ? `Line up the decimal points.${padded ? ' Fill any gaps with 0.' : ''} Start from the right.` : 'Line up the numbers, then start with the ones.');
  if (point >= 0) cells.push({ r: 4, c: point, ch: '.', at: 1, tone: 'ans' });
  const cur: number[] = [];
  const used: number[] = [];
  const cellOf: (ColsCell | undefined)[] = [];
  for (let c = 0; c < width; c++) {
    cur[c] = digitAt(top, width, c) ?? 0;
    used[c] = 0;
    cellOf[c] = cells.find((x) => x.r === 2 && x.c === c);
  }
  const rewrite = (c: number, v: number, at: number) => {
    const old = cellOf[c];
    if (old) old.cross = at;
    const cell: ColsCell = { r: used[c] === 0 ? 1 : 0, c, ch: String(v), tone: 'new', at };
    cells.push(cell);
    cellOf[c] = cell;
    used[c]++;
  };
  const firstAns = width - resStr.length;
  const bring: number[] = [];
  const flushBring = () => {
    if (!bring.length) return;
    const names = bring.map((c) => placeOf(c, width, dp).name).reverse();
    const shown = bring.filter((c) => c >= firstAns);
    for (const c of shown) {
      cells.push({ r: 4, c, ch: String(cur[c]), tone: 'ans', at: L.i });
      board.focus!.push({ c, at: L.i, until: L.i + 1 });
    }
    L.say(shown.length ? `Nothing to take away from the ${list(names)}: write ${shown.length === 1 ? 'it' : 'them'} down.` : `Nothing is left in the ${list(names)}.`);
    bring.length = 0;
  };
  let exchanged = false;
  let notReduced = 0;
  let smallFromBig = '';
  for (let c = width - 1; c >= 0; c--) {
    if (c === point) continue;
    const bd = digitAt(bot, width, c);
    const td = digitAt(top, width, c) ?? 0;
    smallFromBig = String(Math.abs(td - (bd ?? 0))) + smallFromBig;
    const place = placeOf(c, width, dp);
    if (bd === undefined) {
      bring.push(c);
      continue;
    }
    flushBring();
    let lead = '';
    if (cur[c] < bd) {
      exchanged = true;
      let k = c - 1;
      while (k >= 0 && (k === point || cur[k] === 0)) k--;
      const between: number[] = [];
      for (let j = c - 1; j > k; j--) if (j !== point) between.push(j);
      const at = L.i;
      const was = cur[c];
      cur[k] -= 1;
      rewrite(k, cur[k], at);
      for (const j of between) {
        cur[j] = 9;
        rewrite(j, 9, at);
      }
      cur[c] += 10;
      rewrite(c, cur[c], at);
      const kp = placeOf(k, width, dp);
      notReduced += kp.value;
      if (!between.length) lead = `${was} is less than ${bd}, so exchange 1 ${kp.one} for 10 ${place.name}. `;
      else {
        const bn = between.map((j) => placeOf(j, width, dp).name).reverse();
        lead = `${was} is less than ${bd}, and there are no ${list(bn)} to use, so exchange 1 ${kp.one}: the zero${bn.length > 1 ? 's' : ''} become${bn.length > 1 ? '' : 's'} 9 and the ${place.name} become ${cur[c]}. `;
      }
    }
    const r = cur[c] - bd;
    const writes = c >= firstAns;
    if (writes) cells.push({ r: 4, c, ch: String(r), tone: 'ans', at: L.i });
    board.focus!.push({ c, at: L.i, until: L.i + 1 });
    L.sayThen(`${lead}Take away the ${place.name}:`, `${cur[c]} − ${bd} = ${r}`, writes ? `Write ${r}.` : 'Nothing to write.');
  }
  flushBring();
  const show = (s: string) => (o.money ? `₹${s}` : s);
  if (exchanged) {
    const sfb = withPoint(smallFromBig, dp);
    if (Number.isFinite(sfb) && clean(sfb) !== res) L.slip(clean(sfb), 'You took the smaller digit from the bigger one. When the top digit is smaller, exchange from the next column first.');
  }
  if (notReduced && !between0(notReduced)) L.slip(clean(res + notReduced), 'You exchanged, but the column you took from still needs to go down by 1: cross it out and write one less.');
  L.slip(clean(a + b), 'That is adding. − means take away.');
  return named(L.end(show(resStr), undefined, o.show ?? `${show(top)} − ${show(bot)} = ${show(resStr)}`), 'Column', 'sub' as 'add' | 'sub', () => subWays(a, b));
}

// ── Choosing a method ──────────────────────────────────────────────────────

/** The friendliest way to add two numbers of this size. */
export function addLesson(a: number, b: number, show = `${f(a)} + ${f(b)} = ${f(clean(a + b))}`): Lesson {
  if (a === 0 || b === 0) return addZero(a, b, show);
  if (!isInt(a) || !isInt(b)) return columnAdd([a, b], { show });
  const s = a + b;
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  if (s <= 10 || (small <= 3 && s <= 20)) return countOn(a, b, show);
  if (s <= 20) return big >= 10 ? keepTheTen(big, small, '+', show) : bridgeAdd(a, b, show);
  const pj = (small % 10 === 0 ? placeJump(big, small, '+', show) : null) ?? (big % 10 === 0 && small % 10 !== 0 ? placeJump(small, big, '+', show) : null);
  if (pj) return pj;
  if (small <= 9) return (big % 10) + small >= 10 ? bridgeAdd(big, small, show) : keepTheTen(big, small, '+', show);
  if (big < 100 && (a % 10) + (b % 10) < 10) return partitionAdd(big, small, show);
  return columnAdd([a, b], { show });
}

/** The friendliest way to take b from a. */
export function subLesson(a: number, b: number, show = `${f(a)} − ${f(b)} = ${f(clean(a - b))}`): Lesson {
  if (!isInt(a) || !isInt(b)) return columnSub(a, b, { show });
  const res = a - b;
  if (b === 0) return countBack(a, 0, show);
  if (a <= 10) return b <= 3 || b <= a / 2 ? countBack(a, b, show) : countUpSub(a, b, show);
  if (a <= 20) {
    if (b <= 2) return countBack(a, b, show);
    if (a % 10 >= b) return keepTheTen(a, b, '−', show);
    if (res <= 4) return countUpSub(a, b, show);
    if (b <= 9 && a % 10 !== 0) return bridgeSub(a, b, show);
    return countUpSub(a, b, show);
  }
  const pj = placeJump(a, b, '−', show);
  if (pj) return pj;
  if (b <= 9) return a % 10 >= b ? keepTheTen(a, b, '−', show) : a % 10 === 0 ? subFromTen(a, b, show) : bridgeSub(a, b, show);
  if (res > 0 && res <= 20) return frog(b, a, `${f(a)} and ${f(b)} are close, so count up from ${f(b)} to ${f(a)}.`, { show });
  if (a < 100 && a % 10 >= b % 10) return partitionSub(a, b, show);
  return columnSub(a, b, { show });
}

/** Money change: count up from the price to what was paid. */
export function changeLesson(price: number, paid: number): Lesson {
  const ch = clean(paid - price);
  return frog(price, paid, `Count up from the price, ${rs(price)}, to the ${rs(paid)} paid.`, { money: true, endText: `So the change is ${rs(ch)}.`, answerAs: rs(ch) });
}

export { digits };

// ── Other ways (shown on "Another way") ────────────────────────────────────

type Way = [name: string, make: () => Lesson | null];

/** Name a lesson's method and attach the other ways of doing the same sum. */
export function named(l: Lesson, method: string, family: 'add' | 'sub', ways: () => Way[]): Lesson {
  return {
    ...l,
    method,
    family,
    alts: () =>
      ways()
        .filter(([n]) => n !== method)
        .map(([n, mk]): Lesson | null => {
          const x = mk();
          return x ? { ...x, method: n, family, alts: undefined } : null;
        })
        .filter((x): x is Lesson => !!x && x.steps.length > 0)
        .slice(0, 2),
  };
}

const twoInts = (a: number, b: number) => isInt(a) && isInt(b) && a >= 0 && b >= 0;

/** The ways to add a + b (whole numbers). */
export function addWays(a: number, b: number): Way[] {
  if (!twoInts(a, b) || a === 0 || b === 0) return [];
  const s = a + b;
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  if (s <= 20) {
    const ways: Way[] = [];
    if (big < 10 && s > 10) ways.push(['Make ten', () => raw(bridgeAdd(a, b))]);
    if (big >= 10) ways.push(['Keep the ten', () => raw(keepTheTen(big, small, '+'))]);
    ways.push(['Count on', () => raw(countOn(a, b))]);
    if (big <= 10) ways.push(['Bead frame', () => beadsAdd(a, b)]);
    return ways;
  }
  const ways: Way[] = [['Column', () => raw(columnAdd([a, b]))]];
  if (big < 100 && small >= 10) ways.push(['Split', () => raw(partitionAdd(big, small))]);
  if (s < 1000) ways.push(['Number line', () => trackAdd(big, small)]);
  return ways;
}

/** The ways to take b from a (whole numbers). */
export function subWays(a: number, b: number): Way[] {
  if (!twoInts(a, b) || b === 0 || b > a) return [];
  const res = a - b;
  if (a <= 20) {
    const ways: Way[] = [];
    if (b <= 9 && a > 10 && a % 10 < b && a % 10 !== 0) ways.push(['Back to ten', () => raw(bridgeSub(a, b))]);
    if (a > 10 && a % 10 >= b) ways.push(['Keep the ten', () => raw(keepTheTen(a, b, '−'))]);
    ways.push(['Count up', () => raw(countUpSub(a, b))]);
    if (b <= 5) ways.push(['Count back', () => raw(countBack(a, b))]);
    ways.push(['Bead frame', () => beadsSub(a, b)]);
    return ways;
  }
  const ways: Way[] = [['Column', () => raw(columnSub(a, b))]];
  if (jumpsUp(b, a).length <= 4) ways.push(['Count up', () => frog(b, a, `Count up from ${f(b)} to ${f(a)}: the jumps add up to the answer.`)]);
  if (b >= 10 && b % 10 !== 0 && res > 0) ways.push(['Slide the gap', () => slideGap(a, b)]);
  if (a < 100 && a % 10 >= b % 10) ways.push(['Split', () => raw(partitionSub(a, b))]);
  return ways;
}

/** A lesson without its method name and other ways (so other ways don't nest). */
const raw = (l: Lesson): Lesson => ({ ...l, method: undefined, family: undefined, alts: undefined });

/** Bead frame: a on the top row, b on the bottom; read the reds (10) and the rest, or make ten. */
export function beadsAdd(a: number, b: number): Lesson | null {
  if (a > 10 || b > 10 || a + b > 20 || a < 1 || b < 1) return null;
  const s = a + b;
  const L = new LessonBuilder();
  const say5 = (n: number) => (n > 5 ? `5 red and ${f(n - 5)} white` : n === 5 ? '5 red' : `${f(n)} red`);
  const board: import('./types.ts').BeadsBoard = { kind: 'beads', rows: [{ slides: [{ step: 0, n: a }] }, { slides: [{ step: 1, n: b }] }], notes: [] };
  L.board = board;
  L.say(`Slide ${f(a)} beads on the top row: ${say5(a)}.`);
  L.say(`Slide ${f(b)} on the bottom row: ${say5(b)}.`);
  if (a >= 5 && b >= 5) {
    board.readAt = L.i;
    const rest = s - 10;
    board.notes!.push({ text: `10 + ${f(rest)} = ${f(s)}`, at: L.i });
    L.say(`The reds make 10. The whites make ${f(rest)}.`, `10 + ${f(rest)} = ${f(s)}`);
  } else if (s > 10) {
    const k = 10 - a;
    board.hop = { step: L.i, n: k };
    board.notes!.push({ text: `10 + ${f(b - k)} = ${f(s)}`, at: L.i });
    L.say(`Move ${f(k)} up to fill the top row: that makes 10. ${f(b - k)} ${b - k === 1 ? 'is' : 'are'} left.`, `10 + ${f(b - k)} = ${f(s)}`);
  } else {
    board.notes!.push({ text: `${f(a)} + ${f(b)} = ${f(s)}`, at: L.i });
    L.say(`Count them all: ${f(s)}.`);
  }
  return L.end(s);
}

/** Bead frame: a beads, slide b away (bottom row first), count what is left. */
export function beadsSub(a: number, b: number): Lesson | null {
  if (a > 20 || b > a || a < 1) return null;
  const res = a - b;
  const top = Math.min(10, a);
  const bot = a - top;
  const L = new LessonBuilder();
  const rows: import('./types.ts').BeadsBoard['rows'] = [{ slides: [{ step: 0, n: top }] }];
  if (a > 10) rows.push({ slides: [{ step: 0, n: bot }] });
  const board: import('./types.ts').BeadsBoard = { kind: 'beads', rows, notes: [] };
  L.board = board;
  L.say(a > 10 ? `Show ${f(a)}: 10 on the top row and ${f(bot)} on the bottom.` : `Show ${f(a)} on the top row.`);
  const fromBot = Math.min(b, bot);
  const fromTop = b - fromBot;
  if (fromBot) rows[1].slides.push({ step: L.i, n: bot - fromBot });
  if (fromTop) rows[0].slides.push({ step: L.i, n: top - fromTop });
  board.notes!.push({ text: `${f(a)} − ${f(b)} = ${f(res)}`, at: L.i });
  L.say(fromBot && fromTop ? `Slide ${f(b)} back: ${f(fromBot)} from the bottom row, then ${f(fromTop)} from the top.` : `Slide ${f(b)} back.`);
  L.say(`${f(res)} ${res === 1 ? 'is' : 'are'} left.`);
  return L.end(res);
}

/** Moving number line for a + b: jump the hundreds and tens, then the ones (via the next ten). */
export function trackAdd(a: number, b: number): Lesson | null {
  if (!twoInts(a, b) || a + b >= 1000) return null;
  const L = new LessonBuilder();
  const line = new Line('even');
  L.board = line.b;
  line.pt(a, 0, { tone: 'start' });
  L.say(`Start at ${f(a)} and jump on ${f(b)}, a bit at a time.`);
  let x = a;
  const big = floorTo(b, 10);
  const ones = b - big;
  if (big) {
    line.hop(x, x + big, L.i).pt(x + big, L.i);
    L.say(`Jump ${f(big)} first.`, `${f(x)} + ${f(big)} = ${f(x + big)}`);
    x += big;
  }
  if (ones) {
    const next = ceilTo(x + 1, 10);
    if (x % 10 && x + ones > next) {
      const k = next - x;
      line.hop(x, next, L.i).pt(next, L.i);
      L.say(`Jump ${f(k)} to the next ten, ${f(next)}.`, `${f(x)} + ${f(k)} = ${f(next)}`);
      x = next;
      line.hop(x, a + b, L.i).pt(a + b, L.i, { tone: 'end', hl: L.i + 1 });
      L.say(`Then the last ${f(ones - k)}.`, `${f(x)} + ${f(ones - k)} = ${f(a + b)}`);
    } else {
      line.hop(x, a + b, L.i).pt(a + b, L.i, { tone: 'end', hl: L.i + 1 });
      L.say(`Then jump the ${f(ones)}.`, `${f(x)} + ${f(ones)} = ${f(a + b)}`);
    }
  }
  return L.end(a + b);
}

/** Slide the gap: a − b keeps its answer when both numbers move the same way (b becomes round). */
export function slideGap(a: number, b: number): Lesson | null {
  if (!twoInts(a, b) || b % 10 === 0 || b > a) return null;
  const up = ceilTo(b, 10) - b;
  const shift = up <= 5 || b % 10 > a % 10 ? up : -(b % 10);
  const a2 = a + shift;
  const b2 = b + shift;
  const res = a - b;
  const L = new LessonBuilder();
  const board: import('./types.ts').TrackBoard = {
    kind: 'track',
    linear: true,
    points: [
      { v: b, tone: 'start', until: 1 },
      { v: a, tone: 'mark', until: 1 },
      { v: b2, tone: 'start', at: 1 },
      { v: a2, tone: 'mark', at: 1 },
    ],
    hops: [],
    gaps: [
      { from: b, to: a, until: 1, label: `${f(a)} − ${f(b)}` },
      { from: b2, to: a2, at: 1, label: `${f(a2)} − ${f(b2)}` },
    ],
  };
  L.board = board;
  L.say(`${f(a)} − ${f(b)} is the gap between ${f(b)} and ${f(a)}.`);
  L.say(`Slide the gap ${f(Math.abs(shift))} ${shift > 0 ? 'up' : 'down'}: both numbers ${shift > 0 ? 'go up' : 'go down'} by ${f(Math.abs(shift))}, and the gap stays the same.`, `${f(a2)} − ${f(b2)}`);
  L.say(`${f(b2)} is a round number, so this is easy.`, `${f(a2)} − ${f(b2)} = ${f(res)}`);
  return L.end(res);
}
