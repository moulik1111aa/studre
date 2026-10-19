// Integers and number theory (Stages 5–7): adding and subtracting on a number line through
// zero, sign rules for × and ÷, factors, multiples, primes, prime factors, HCF and LCM,
// divisibility rules and digit-sum checks.

import { gcd, lcm } from '../question.ts';
import { LessonBuilder, Line, f } from './build.ts';
import { mulLesson } from './muldiv.ts';
import type { Lesson, TableBoard } from './types.ts';

const br = (n: number): string => (n < 0 ? `(${f(n)})` : f(n));

/** Move from a by `move` (+ right, − left) on a number line, through zero if it crosses. */
function lineSteps(L: LessonBuilder, a: number, move: number): number {
  const ans = a + move;
  const lo = Math.min(a, ans, 0) - 1;
  const hi = Math.max(a, ans, 0) + 1;
  const line = new Line('linear', { min: lo, max: hi, tick: 1, labelEvery: 1 });
  L.board = line.b;
  line.pt(0, 0, { tone: 'zero' }).pt(a, 0, { tone: 'start' });
  const right = move > 0;
  const crosses = (a > 0 && ans < 0) || (a < 0 && ans > 0);
  if (crosses) {
    line.hop(a, 0, L.i).pt(0, L.i, { tone: 'zero' });
    L.say(`Move ${Math.abs(a)} to the ${right ? 'right' : 'left'} to reach 0.`, `${f(a)} ${right ? '+' : '−'} ${Math.abs(a)} = 0`);
    const rest = Math.abs(move) - Math.abs(a);
    line.hop(0, ans, L.i).pt(ans, L.i, { tone: 'end', hl: L.i + 1 });
    L.say(`Then ${rest} more, to the other side of 0.`, `0 ${right ? '+' : '−'} ${rest} = ${f(ans)}`);
  } else {
    line.hop(a, ans, L.i).pt(ans, L.i, { tone: 'end', hl: L.i + 1 });
    L.say(`Move ${Math.abs(move)} to the ${right ? 'right' : 'left'}.`, `${f(a)} ${right ? '+' : '−'} ${Math.abs(move)} = ${f(ans)}`);
  }
  return ans;
}

/** Start at a and move `step` right or left. */
export function moveLesson(a: number, step: number, right: boolean): Lesson {
  const L = new LessonBuilder();
  const move = right ? step : -step;
  const ans = a + move;
  L.say(`Start at ${f(a)}. Right means bigger numbers; left means smaller (more negative).`);
  lineSteps(L, a, move);
  L.slip(a - move, right ? 'Right is towards the bigger numbers.' : 'Left is towards the smaller numbers.');
  return L.end(f(ans), `So you are at ${f(ans)}.`);
}

/** a + b or a − b with integers, on a number line. */
export function intAddSub(a: number, b: number, op: '+' | '−'): Lesson {
  const L = new LessonBuilder();
  const move = op === '+' ? b : -b;
  const ans = a + move;
  if (op === '+' && b < 0) L.say(`Adding a negative number moves left: it is the same as taking away ${-b}.`, `${f(a)} + ${br(b)} = ${f(a)} − ${-b}`);
  else if (op === '−' && b < 0) L.say(`Taking away a negative number is the same as adding: two minuses make a plus.`, `${f(a)} − ${br(b)} = ${f(a)} + ${-b}`);
  else L.say(`Start at ${f(a)}. ${op === '+' ? 'Adding' : 'Taking away'} ${b} moves ${b} to the ${op === '+' ? 'right' : 'left'}.`);
  lineSteps(L, a, move);
  L.slip(a - move, op === '−' && b < 0 ? 'Taking away a negative moves right, like adding.' : op === '+' && b < 0 ? 'Adding a negative moves left.' : 'Check the direction: + moves right, − moves left.');
  if (ans !== 0) L.slip(-ans, 'Check which side of 0 you finish on.');
  return L.end(f(ans), undefined, `${f(a)} ${op} ${br(b)} = ${f(ans)}`);
}

/** a × b or a ÷ b with integers: sizes, then the sign rule. */
export function intMulDiv(a: number, b: number, op: '×' | '÷'): Lesson {
  const L = new LessonBuilder();
  const ans = op === '×' ? a * b : a / b;
  const sa = a < 0 ? '−' : '+';
  const sb = b < 0 ? '−' : '+';
  const same = sa === sb;
  const rules: [string, string, string][] = [['+', '+', '+'], ['−', '−', '+'], ['+', '−', '−'], ['−', '+', '−']];
  L.board = { kind: 'table', head: ['first', 'second', 'answer'], rows: rules.map(([x, y, z]) => ({ cells: [x, y, { v: z, tone: x === sa && y === sb ? ('key' as const) : undefined, hl: x === sa && y === sb ? 1 : undefined }] })) };
  L.say(`First ${op === '×' ? 'multiply' : 'divide'} the sizes, ignoring the signs.`, `${Math.abs(a)} ${op} ${Math.abs(b)} = ${Math.abs(ans)}`);
  L.say(same ? 'The signs are the same, so the answer is positive.' : 'The signs are different, so the answer is negative.', `${sa} ${op} ${sb} = ${same ? '+' : '−'}`);
  L.slip(-ans, same ? 'Same signs give a positive answer.' : 'Different signs give a negative answer.');
  return L.end(f(ans), undefined, `${f(a)} ${op} ${br(b)} = ${f(ans)}`);
}

// ── Factors, multiples and primes ──────────────────────────────────────────

const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((i) => n % i === 0);

/** How many factors does n have? Find them in pairs. */
export function factorCount(n: number): Lesson {
  const L = new LessonBuilder();
  const pairs: [number, number][] = [];
  for (let i = 1; i * i <= n; i++) if (n % i === 0) pairs.push([i, n / i]);
  const sq = pairs.some(([x, y]) => x === y);
  const count = divisors(n).length;
  L.board = { kind: 'table', head: ['factor', '×', 'factor'], rows: pairs.map(([x, y], k) => ({ at: 1, cells: [String(x), '×', x === y ? '(same)' : String(y)], ...(k === 0 ? {} : {}) })) };
  L.say(`Factors come in pairs that multiply to ${n}. Start at 1 and go up.`);
  L.say(`Stop when the pairs meet: after ${pairs[pairs.length - 1][0]}, the pairs just repeat the other way round.`, pairs.map(([x, y]) => `${x} × ${y}`).join(', '));
  L.say(sq ? `There are ${pairs.length} pairs, but ${pairs[pairs.length - 1][0]} × ${pairs[pairs.length - 1][0]} uses the same number twice, so count it once.` : `There are ${pairs.length} pairs, and each pair gives 2 factors.`, sq ? `${pairs.length} × 2 − 1 = ${count}` : `${pairs.length} × 2 = ${count}`);
  L.slip(pairs.length, 'Each pair has two factors: count both.');
  return L.end(count, `So ${n} has ${count} factors.`);
}

/** Which is NOT a factor of n? */
export function notFactorChoice(n: number, ans: number, others: number[]): Lesson {
  const L = new LessonBuilder();
  const all = [ans, ...others].sort((x, y) => x - y);
  L.board = { kind: 'table', head: ['try', `${n} ÷`, ''], rows: all.map((x) => ({ at: 1, cells: [String(x), n % x ? `${Math.floor(n / x)} r ${n % x}` : String(n / x), { v: n % x ? '✗' : '✓', tone: n % x ? ('bad' as const) : ('good' as const) }] })) };
  L.say(`A factor of ${n} divides ${n} exactly, with nothing left over.`);
  L.say(`Divide ${n} by each number. The one with a remainder is not a factor.`);
  return L.end(ans, `So ${ans} is not a factor of ${n}.`, `${n} ÷ ${ans} = ${Math.floor(n / ans)} r ${n % ans}`);
}

/** The kth multiple of n. */
export function kthMultiple(n: number, k: number): Lesson {
  const L = new LessonBuilder();
  L.say(`The multiples of ${n} are the ${n} times table: ${n}, ${2 * n}, ${3 * n}, … The ${k}th one is ${n} × ${k}.`);
  L.take(mulLesson(n, k));
  L.slip(n + k, `Multiply: ${n} × ${k}, not ${n} + ${k}.`);
  return L.end(n * k, undefined, `${n} × ${k} = ${n * k}`);
}

/** The smallest multiple of n bigger than X. */
export function nextMultiple(n: number, X: number): Lesson {
  const L = new LessonBuilder();
  const q = Math.floor(X / n);
  const ans = n * (q + 1);
  L.say(`How many ${n}s fit into ${X}?`, `${X} ÷ ${n} = ${q} r ${X % n}`);
  L.say(`So ${n} × ${q} = ${n * q} is not bigger than ${X}. The next multiple is one more ${n}.`, `${n} × ${q + 1} = ${ans}`);
  L.slip(n * q, `${n * q} is smaller than ${X}. Go one ${n} further.`);
  return L.end(ans, `So the answer is ${ans}.`);
}

/** A factor (other than 1 and n) if there is one. */
function smallFactor(n: number): number {
  for (let p = 2; p * p <= n; p++) if (n % p === 0) return p;
  return 0;
}

/** Which is prime / not prime? Test each option. */
export function primeChoice(options: number[], wantPrime: boolean, ans: number): Lesson {
  const L = new LessonBuilder();
  const all = [...options].sort((x, y) => x - y);
  L.board = {
    kind: 'table',
    head: ['number', 'test', ''],
    rows: all.map((x) => {
      const p = smallFactor(x);
      return { at: 1, cells: [String(x), p ? `${p} × ${x / p}` : 'only 1 × ' + x, { v: p ? 'not prime' : 'prime', tone: (x === ans ? 'good' : 'dim') as 'good' | 'dim' }] };
    }),
  };
  L.say('A prime number has exactly two factors: 1 and itself. To test one, try dividing by 2, 3, 5 and 7.');
  L.say('Test each number.');
  const p = smallFactor(ans);
  return L.end(ans, wantPrime ? `${ans} has no factor except 1 and ${ans}, so ${ans} is prime.` : `${ans} = ${p} × ${ans / p}, so ${ans} is not prime.`);
}

/** n as a product of primes: keep dividing by the smallest prime that works. */
export function primeFactors(n: number, ans: string): Lesson {
  const L = new LessonBuilder();
  const rows: TableBoard['rows'] = [];
  let x = n;
  const ps: number[] = [];
  L.say('Divide by the smallest prime that goes in. Keep going until you reach 1.');
  while (x > 1) {
    const p = smallFactor(x) || x;
    rows.push({ at: 1, cells: [{ v: String(p), tone: 'key' as const }, String(x)] });
    ps.push(p);
    x /= p;
  }
  rows.push({ at: 1, cells: ['', '1'] });
  L.board = { kind: 'table', head: ['÷', 'number'], rows };
  L.say('Each line divides by a prime.', ...ps.map((p, i) => `${n / ps.slice(0, i).reduce((a, b) => a * b, 1)} ÷ ${p} = ${n / ps.slice(0, i + 1).reduce((a, b) => a * b, 1)}`));
  L.say('The primes you divided by multiply back to the number.', `${ps.join(' × ')} = ${n}`);
  return L.end(ans, `So ${n} = ${ans}.`);
}

/** HCF by listing factors. */
export function hcfLesson(A: number, B: number, o: { intro?: string; end?: string } = {}): Lesson {
  const L = new LessonBuilder();
  const g = gcd(A, B);
  const fa = divisors(A);
  const fb = divisors(B);
  const common = fa.filter((x) => fb.includes(x));
  if (o.intro) L.say(o.intro);
  L.say('List the factors of each number.', `${A}: ${fa.join(', ')}`, `${B}: ${fb.join(', ')}`);
  L.say('Find the ones in both lists. The biggest is the HCF.', `both: ${common.join(', ')}`);
  L.slip(lcm(A, B), 'That is a common multiple. The HCF is the biggest number that goes into both.');
  return L.end(g, o.end ?? `So the HCF is ${g}.`);
}

/** LCM by listing multiples of the bigger number. */
export function lcmLesson(a: number, b: number, o: { intro?: string; end?: string } = {}): Lesson {
  const L = new LessonBuilder();
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const l = lcm(a, b);
  const list: number[] = [];
  for (let x = big; x <= l; x += big) list.push(x);
  if (o.intro) L.say(o.intro);
  L.say(`List the multiples of the bigger number, ${big}, until you reach one that ${small} also goes into.`, list.join(', '));
  L.say(`${l} is in the ${small} times table too.`, `${l} ÷ ${small} = ${l / small}`);
  if (a * b !== l) L.slip(a * b, `${a} × ${b} is a common multiple, but there is a smaller one.`);
  L.slip(gcd(a, b), 'That is the HCF. The LCM is the smallest number both go into.');
  return L.end(l, o.end ?? `So the LCM is ${l}.`);
}

// ── Divisibility ───────────────────────────────────────────────────────────

const RULE: Record<number, string> = {
  4: 'A number divides by 4 when its last two digits do.',
  6: 'A number divides by 6 when it is even and its digits add up to a multiple of 3.',
  8: 'A number divides by 8 when you can halve it three times and still get whole numbers.',
  11: 'A number divides by 11 when its alternating digit sum (add, take away, add…) divides by 11.',
  7: 'To test 7: double the last digit and take it from the rest. Repeat until it is small, then check the 7 times table.',
  13: 'To test 13: take 4 times the last digit and add it to the rest. Repeat until it is small, then check the 13 times table.',
};

/** One test of n for `by`, as a short line. */
function testLine(n: number, by: number): string {
  const ds = String(n).split('').map(Number);
  if (by === 4) return `${n % 100} ÷ 4 ${(n % 100) % 4 ? '✗' : '✓'}`;
  if (by === 6) return `${n % 2 ? 'odd' : 'even'}, digits add to ${ds.reduce((p, c) => p + c, 0)}`;
  if (by === 8) {
    const h: string[] = [];
    let x = n;
    for (let i = 0; i < 3 && x % 2 === 0; i++) h.push(String((x /= 2)));
    return h.length === 3 ? `${n} → ${h.join(' → ')}` : `${n} → ${h.join(' → ')}${h.length ? ' → ' : ''}stops`;
  }
  if (by === 11) {
    const s = ds.reduce((p, d, i) => p + (i % 2 ? -d : d), 0);
    return `${ds.map((d, i) => (i ? (i % 2 ? `− ${d}` : `+ ${d}`) : String(d))).join(' ')} = ${f(s)}`;
  }
  const chain: number[] = [n];
  let x = n;
  while (x >= 100 && chain.length < 4) {
    x = by === 7 ? Math.abs(Math.floor(x / 10) - 2 * (x % 10)) : Math.floor(x / 10) + 4 * (x % 10);
    chain.push(x);
  }
  return chain.join(' → ');
}

/** Which number divides exactly by `by`? */
export function divRuleChoice(by: number, ans: number, wrongs: number[]): Lesson {
  const L = new LessonBuilder();
  const all = [ans, ...wrongs].sort((x, y) => x - y);
  L.board = { kind: 'table', head: ['number', 'test', ''], rows: all.map((n) => ({ at: 1, cells: [String(n), testLine(n, by), { v: n % by ? '✗' : '✓', tone: n % by ? ('bad' as const) : ('good' as const) }] })) };
  L.say(RULE[by]);
  L.say('Test each number.');
  return L.end(ans, `So ${ans} divides exactly by ${by}.`, `${ans} ÷ ${by} = ${ans / by}`);
}

/** Digital root: keep adding the digits until one digit is left (9 for multiples of 9). */
const root = (n: number): number => (n % 9 === 0 ? 9 : n % 9);
const digitAdd = (n: number): string => {
  let x = n;
  const out = [String(x)];
  while (x > 9) {
    x = String(x).split('').reduce((p, d) => p + Number(d), 0);
    out.push(String(x));
  }
  return out.join(' → ');
};

/** Which answer to a × b passes the digit-sum check? */
export function digitSumChoice(a: number, b: number, options: number[]): Lesson {
  const L = new LessonBuilder();
  const ra = root(a);
  const rb = root(b);
  const want = root(ra * rb);
  const all = [...options].sort((x, y) => x - y);
  L.board = { kind: 'table', head: ['answer', 'digit sum', ''], rows: all.map((x) => ({ at: 2, cells: [String(x), digitAdd(x), { v: root(x) === want ? '✓' : '✗', tone: root(x) === want ? ('good' as const) : ('bad' as const) }] })) };
  L.say('Add the digits of each number until one digit is left.', `${digitAdd(a)}`, `${digitAdd(b)}`);
  L.say(`Multiply those, and add the digits again. The right answer must give the same.`, `${ra} × ${rb} = ${ra * rb}${ra * rb > 9 ? ` → ${digitAdd(ra * rb).split(' → ').slice(1).join(' → ')}` : ''}`);
  L.say(`Check each answer: which one gives ${want}?`);
  return L.end(a * b, `${a * b} gives ${want}, so it passes.`, `${a} × ${b} = ${a * b}`);
}
