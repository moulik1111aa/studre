// Place value and bigger numbers: tens and ones with blocks, what a digit is worth, comparing
// from the left, rounding on a number line, estimating, steps of 1/10/100, and sequences.

import { clean } from '../question.ts';
import { LessonBuilder, Line, f, list, PLACES, PLACE_ONE } from './build.ts';
import { placeJump } from './addsub.ts';
import type { Lesson, TableBoard } from './types.ts';

const HEADS = ['O', 'T', 'H', 'Th', 'TTh', 'L'];

/** t tens and o ones. */
export function tensOnes(t: number, o: number): Lesson {
  const L = new LessonBuilder();
  const n = 10 * t + o;
  L.board = { kind: 'blocks', groups: [{ h: 0, t, o, label: `${t} tens, ${o} ones` }] };
  L.say(`${t} tens make ${10 * t}.`, `${t} × 10 = ${10 * t}`);
  L.say(`Add the ${o} ones.`, `${10 * t} + ${o} = ${n}`);
  if (o !== t) L.slip(10 * o + t, 'Tens go first, then the ones.');
  return L.end(n);
}

/** How many tens in n? */
export function tensIn(n: number): Lesson {
  const L = new LessonBuilder();
  const t = Math.floor(n / 10);
  const o = n % 10;
  L.board = { kind: 'blocks', groups: [{ h: 0, t, o, label: String(n) }] };
  L.say(`${n} is ${t} tens and ${o} ones.`, `${n} = ${10 * t} + ${o}`);
  L.say('The tens digit is the one on the left.');
  if (o !== t) L.slip(o, `${o} is the ones digit. The tens digit is on the left.`);
  return L.end(t);
}

/** n = tens + ? */
export function expandedLesson(n: number): Lesson {
  const L = new LessonBuilder();
  const t = Math.floor(n / 10);
  const o = n % 10;
  L.board = { kind: 'blocks', groups: [{ h: 0, t, o, label: String(n) }] };
  L.say(`${n} is ${t} tens and ${o} ones.`);
  L.say(`${t} tens are ${10 * t}, and ${o} ones are ${o}.`, `${n} = ${10 * t} + ${o}`);
  L.slip(t, `${t} is the tens digit. We need the ones.`);
  return L.end(o);
}

/** A place-value chart for one or more numbers (rows), digits right-aligned. */
function pvTable(nums: number[], width: number, hl?: { col: number; at: number }): TableBoard {
  const head = HEADS.slice(0, width).reverse();
  return {
    kind: 'table',
    head,
    rows: nums.map((n) => ({
      cells: String(n)
        .padStart(width, ' ')
        .split('')
        .map((ch, i) => (hl && width - 1 - i === hl.col ? { v: ch.trim(), tone: 'key' as const, hl: hl.at } : ch.trim())),
    })),
  };
}

/** What is the digit in a place worth? */
export function digitValue(n: number, p: number): Lesson {
  const L = new LessonBuilder();
  const d = Math.floor(n / 10 ** p) % 10;
  const w = String(n).length;
  L.board = pvTable([n], w, { col: p, at: 1 });
  L.say(`Put ${n} in a place-value chart.`);
  L.say(`The ${PLACES[p]} digit is ${d}.`);
  L.say(`It means ${d} ${d === 1 ? PLACE_ONE[p] : PLACES[p]}.`, `${d} × ${f(10 ** p)} = ${f(d * 10 ** p)}`);
  L.slip(d, `${d} is the digit. We need what it is worth: ${d} ${PLACES[p]}.`);
  return L.end(d * 10 ** p);
}

/** How many thousands make a lakh. */
export function lakhThousands(): Lesson {
  const L = new LessonBuilder();
  L.say('1 lakh is 1,00,000: a 1 and five zeros.');
  L.say('1 thousand is 1,000. How many thousands make 1,00,000?', '1,000 × 10 = 10,000', '1,000 × 100 = 1,00,000');
  return L.end(100, 'So 100 thousands make 1 lakh.');
}

/** Compare numbers from the left (biggest or smallest). */
export function compareNumbers(nums: number[], biggest: boolean): Lesson {
  const L = new LessonBuilder();
  const w = Math.max(...nums.map((n) => String(n).length));
  const ans = biggest ? Math.max(...nums) : Math.min(...nums);
  const table = pvTable(nums, w);
  L.board = table;
  L.say(`Line the numbers up by place value. Compare from the left: the ${PLACES[w - 1]} first.`);
  let cands = nums.map((_, i) => i);
  for (let p = w - 1; p >= 0 && cands.length > 1; p--) {
    const ds = cands.map((i) => Math.floor(nums[i] / 10 ** p) % 10);
    const best = biggest ? Math.max(...ds) : Math.min(...ds);
    const keep = cands.filter((_, k) => ds[k] === best);
    const at = L.i;
    for (const i of cands) {
      const cell = table.rows[i].cells[w - 1 - p];
      table.rows[i].cells[w - 1 - p] = { v: typeof cell === 'string' ? cell : cell.v, tone: keep.includes(i) ? 'good' : 'dim', hl: at };
    }
    const two = nums.length === 2;
    if (keep.length === cands.length) L.say(`The ${PLACES[p]} are ${two ? 'both' : 'all'} ${best}: a tie, so look at the next place.`);
    else L.say(`In the ${PLACES[p]}: ${list(ds.map(String))}. ${best} is the ${biggest ? (two ? 'bigger' : 'biggest') : two ? 'smaller' : 'smallest'}.`);
    cands = keep;
  }
  const two = nums.length === 2;
  // Big numbers written with commas, as in the question.
  const big = ans >= 10000 ? ans.toLocaleString('en-IN') : f(ans);
  return L.end(ans, `So ${big} is the ${biggest ? (two ? 'bigger' : 'biggest') : two ? 'smaller' : 'smallest'}.`);
}

/** Round n to the nearest `to` (10, 100, 1000; or 1, 0.1, 0.01 for decimals) on a number line. */
export function roundLesson(n: number, to: number): Lesson {
  const L = new LessonBuilder();
  const lo = clean(Math.floor(clean(n / to)) * to);
  const hi = clean(lo + to);
  const mid = clean(lo + to / 2);
  const ans = clean(Math.round(clean(n / to)) * to);
  const nextPlace = to >= 1 ? (to === 1 ? 'tenths' : PLACES[Math.round(Math.log10(to)) - 1]) : ['hundredths', 'thousandths', 'ten-thousandths'][Math.round(-Math.log10(to)) - 1];
  const digit = Math.floor(clean((n - lo) / (to / 10)));
  if (clean(n - lo) === 0) {
    L.say(`${f(n)} is already a whole number of ${to >= 1 ? PLACES[Math.round(Math.log10(to))] : nextPlace.replace('ths', 'ths')}: nothing to round.`);
    return L.end(n, `So ${f(n)} stays ${f(n)}.`);
  }
  const line = new Line('linear', { min: lo, max: hi });
  L.board = line.b;
  line.pt(lo, 0, { tone: 'mark' }).pt(hi, 0, { tone: 'mark' }).pt(mid, 1, { label: `${f(mid)}` }).pt(n, 0, { tone: 'start' });
  L.say(`${f(n)} is between ${f(lo)} and ${f(hi)}.`);
  L.say(`Halfway is ${f(mid)}. Look at the ${nextPlace} digit: ${digit}.`);
  line.pt(ans, 2, { tone: 'end', hl: 2 });
  L.say(digit >= 5 ? `${digit} is 5 or more, so round up.` : `${digit} is less than 5, so round down.`);
  L.slip(ans === lo ? hi : lo, digit >= 5 ? '5 or more rounds up.' : 'Less than 5 rounds down.');
  return L.end(ans, `So ${f(n)} rounds to ${f(ans)}.`);
}

/** Estimate a sum by rounding each number to the nearest 100. */
export function estimateSum(a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const ra = Math.round(a / 100) * 100;
  const rb = Math.round(b / 100) * 100;
  L.say(`Round ${a} to the nearest hundred: the tens digit is ${Math.floor(a / 10) % 10}.`, `${a} ≈ ${ra}`);
  L.say(`Round ${b} the same way: the tens digit is ${Math.floor(b / 10) % 10}.`, `${b} ≈ ${rb}`);
  L.say('Add the rounded numbers.', `${ra} + ${rb} = ${ra + rb}`);
  L.slip(a + b, 'That is the exact answer. Round each number first, then add.');
  return L.end(ra + rb);
}

/** 1, 10 or 100 more / less than n. */
export function stepMoreLess(n: number, step: number, up: boolean): Lesson {
  const res = up ? n + step : n - step;
  const show = `${n} ${up ? '+' : '−'} ${step} = ${res}`;
  if (step > 1) {
    const pj = placeJump(n, step, up ? '+' : '−', show);
    if (pj) return pj;
  }
  const L = new LessonBuilder();
  const line = new Line('even');
  L.board = line.b;
  line.pt(n, 0, { tone: 'start' });
  const p = Math.round(Math.log10(step));
  L.say(`${step} ${up ? 'more' : 'less'} means ${up ? 'add' : 'take away'} 1 ${PLACE_ONE[p]}.`);
  line.hop(n, res, 1).pt(res, 1, { tone: 'end', hl: 1 });
  if (step === 1) L.say(up ? 'Count on one.' : 'Count back one.', show);
  else {
    const d = Math.floor(n / step) % 10;
    L.say(up ? `There are ${d} ${PLACES[p]}; one more makes 10 ${PLACES[p]}, which is 1 ${PLACE_ONE[p + 1]}.` : `There are no ${PLACES[p]} left, so use 1 ${PLACE_ONE[p + 1]}: it is 10 ${PLACES[p]}.`, show);
  }
  L.slip(up ? n - step : n + step, up ? '“More” means add.' : '“Less” means take away.');
  return L.end(res);
}

/** A sequence that goes up or down in equal jumps, with one term missing. */
export function sequenceLesson(terms: number[], gap: number): Lesson {
  const L = new LessonBuilder();
  const known = terms.map((t, i) => (i === gap ? null : t));
  // Find the jump from two neighbours that are both shown.
  let k = 0;
  while (known[k] === null || known[k + 1] === null) k++;
  const step = terms[k + 1] - terms[k];
  const ans = terms[gap];
  const sorted = [...terms].sort((x, y) => x - y);
  const line = new Line('linear', { min: sorted[0], max: sorted[sorted.length - 1] });
  L.board = line.b;
  terms.forEach((t, i) => i !== gap && line.pt(t, 0, { tone: 'mark' }));
  L.say(`Find the jump between two numbers next to each other: ${terms[k]} to ${terms[k + 1]}.`, step > 0 ? `${terms[k + 1]} − ${terms[k]} = ${step}` : `${terms[k]} − ${terms[k + 1]} = ${-step}`);
  for (let i = 0; i < terms.length - 1; i++) if (i !== gap && i + 1 !== gap) line.hop(terms[i], terms[i + 1], 1);
  L.say(step > 0 ? `Each number is ${step} more than the one before.` : `Each number is ${-step} less than the one before.`);
  const at = L.i;
  if (gap > 0) {
    const prev = terms[gap - 1];
    line.hop(prev, ans, at).pt(ans, at, { tone: 'end', hl: at });
    // The jump on from the answer fills the last gap in the pattern.
    if (gap < terms.length - 1) line.hop(ans, terms[gap + 1], at);
    L.say(`So after ${prev} comes:`, `${prev} ${step > 0 ? '+' : '−'} ${Math.abs(step)} = ${ans}`);
  } else {
    const next = terms[1];
    line.hop(ans, next, at).pt(ans, at, { tone: 'end', hl: at });
    L.say(`The first number is one jump before ${next}:`, `${next} ${step > 0 ? '−' : '+'} ${Math.abs(step)} = ${ans}`);
  }
  if (gap > 0) L.slip(terms[gap - 1] + (step > 0 ? 1 : -1), `The jump is ${Math.abs(step)}, not 1.`);
  return L.end(ans);
}
