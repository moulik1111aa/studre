// Powers and roots: squares, cubes, square and cube roots, powers of a number, index laws,
// zero / negative / fractional indices, standard form, logs, surds and recurring decimals.

import { frac, gcd } from '../question.ts';
import { LessonBuilder, f, list } from './build.ts';
import { timesFact, gridMult } from './muldiv.ts';
import type { Lesson, TableBoard } from './types.ts';

const SUP: Record<string, string> = { '-': '⁻', '−': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const sup = (n: number | string): string =>
  String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');
export const pw = (b: string | number, e: number): string => `${b}${sup(e)}`;

/** Rows of powers of b (value v, highlighted at the last); long lists keep the start and the end. */
function powerRows(b: number, e: number): TableBoard['rows'] {
  const keep = (i: number) => e <= 6 || i < 2 || i >= e - 3;
  const rows: TableBoard['rows'] = [];
  for (let i = 0; i < e; i++) {
    if (!keep(i)) {
      if (keep(i - 1)) rows.push({ at: 1, cells: ['⋮', '⋮'] });
      continue;
    }
    rows.push({ at: 1, cells: [pw(b, i + 1), { v: f(b ** (i + 1)), tone: i === e - 1 ? ('good' as const) : undefined }] });
  }
  return rows;
}

/** n² = n × n. */
export function squareLesson(n: number, show = `${n}² = ${n * n}`): Lesson {
  const L = new LessonBuilder();
  L.say(`${n}² means ${n} × ${n}: ${n} multiplied by itself.`);
  L.take(n <= 12 ? timesFact(n, n, `${n} × ${n} = ${n * n}`, { picture: false }) : gridMult(n, n));
  L.slip(2 * n, `${n}² is ${n} × ${n}, not ${n} × 2.`);
  L.slip(n + n, `${n}² is ${n} × ${n}, not ${n} + ${n}.`);
  return L.end(n * n, undefined, show);
}

/** n³ = n × n × n. */
export function cubeLesson(n: number, show = `${n}³ = ${n ** 3}`): Lesson {
  const L = new LessonBuilder();
  L.say(`${n}³ means ${n} × ${n} × ${n}: three ${n}s multiplied.`);
  L.say(`First ${n} × ${n}.`, `${n} × ${n} = ${n * n}`);
  L.say(`Then × ${n} again.`, `${n * n} × ${n} = ${n ** 3}`);
  L.slip(n * n, `That is ${n}². ${n}³ needs one more × ${n}.`);
  L.slip(3 * n, `${n}³ is ${n} × ${n} × ${n}, not ${n} × 3.`);
  return L.end(n ** 3, undefined, show);
}

/** Squares near n, as a table (for roots and estimates). */
function squaresTable(ns: number[], key: number, power = 2): TableBoard {
  return {
    kind: 'table',
    head: ['n', power === 2 ? 'n²' : 'n³'],
    rows: ns.map((k) => ({ cells: [{ v: String(k), tone: k === key ? ('good' as const) : undefined, hl: k === key ? 1 : undefined }, { v: String(k ** power), tone: k === key ? ('good' as const) : undefined, hl: k === key ? 1 : undefined }] })),
  };
}

/** √c: which number times itself makes c? */
export function sqrtLesson(c: number, show = `√${c} = ${Math.round(Math.sqrt(c))}`): Lesson {
  const n = Math.round(Math.sqrt(c));
  const L = new LessonBuilder();
  const near = [n - 1, n, n + 1].filter((k) => k >= 1);
  L.board = squaresTable(near, n);
  L.say(`√${c} asks: which number times itself makes ${c}?`);
  if (n > 10) {
    const lo = Math.floor(n / 10) * 10;
    const last = c % 10;
    const ends = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].filter((d) => (d * d) % 10 === last);
    L.say(`${c} is between ${lo}² = ${lo * lo} and ${lo + 10}² = ${(lo + 10) ** 2}, so the answer is between ${lo} and ${lo + 10}.`);
    L.say(`${c} ends in ${last}, and only numbers ending in ${list(ends.map(String))} make squares ending in ${last}.`);
  }
  L.say(`Try it: ${n} × ${n}.`, `${n} × ${n} = ${c} ✓`);
  L.slip(c / 2, `Square root is not half: ${n} × ${n} = ${c}.`);
  return L.end(n, undefined, show);
}

/** ∛c: which number cubed makes c? */
export function cbrtLesson(c: number, show = `∛${c} = ${Math.round(Math.cbrt(c))}`): Lesson {
  const n = Math.round(Math.cbrt(c));
  const L = new LessonBuilder();
  L.board = squaresTable([n - 1, n, n + 1].filter((k) => k >= 1), n, 3);
  L.say(`∛${c} asks: which number multiplied by itself three times makes ${c}?`);
  L.say(`Try ${n}.`, `${n} × ${n} × ${n} = ${c} ✓`);
  L.slip(n * n, `${n * n} is ${n}². The cube root is the number that is multiplied.`);
  return L.end(n, undefined, show);
}

/** b^e by repeated multiplication. */
export function powerLesson(b: number, e: number, show = `${pw(b, e)} = ${f(b ** e)}`): Lesson {
  const L = new LessonBuilder();
  const vals = Array.from({ length: e }, (_, i) => b ** (i + 1));
  L.board = { kind: 'table', head: ['power', 'value'], rows: powerRows(b, e) };
  L.say(`${pw(b, e)} means ${e} lots of ${b} multiplied together.`, Array(e).fill(String(b)).join(' × '));
  L.say(`Keep multiplying by ${b}.`, vals.map(f).join(', '));
  L.slip(b * e, `${pw(b, e)} is not ${b} × ${e}: it is ${e} lots of ${b} multiplied together.`);
  return L.end(b ** e, undefined, show);
}

/** b^? = v: how many times do we multiply b? */
export function whichPower(b: number, v: number): Lesson {
  const L = new LessonBuilder();
  const vals: number[] = [];
  for (let x = b; x <= v; x *= b) vals.push(x);
  const e = vals.length;
  L.board = { kind: 'table', head: ['power', 'value'], rows: powerRows(b, e) };
  L.say(`How many lots of ${b} multiply to make ${f(v)}?`);
  L.say(`Keep multiplying by ${b} until you reach ${f(v)}.`, vals.map(f).join(', '));
  return L.end(e, `That took ${e} lots of ${b}, so the power is ${e}.`, `${pw(b, e)} = ${f(v)}`);
}

/** Index laws: multiply (add powers), divide (subtract), power of a power (multiply). */
export function indexLaw(kind: 'mul' | 'div' | 'pow', b: string, m: number, n: number): Lesson {
  const L = new LessonBuilder();
  const e = kind === 'mul' ? m + n : kind === 'div' ? m - n : m * n;
  const ans = pw(b, e);
  const rep = (k: number) => Array(k).fill(b).join(' × ');
  if (kind === 'mul') {
    L.say(`${pw(b, m)} is ${m} lots of ${b} multiplied together, and ${pw(b, n)} is ${n} more.`, m + n <= 10 ? `(${rep(m)}) × (${rep(n)})` : null);
    L.say('Same base, multiplying: add the powers.', `${m} + ${n} = ${e}`);
    L.slip(pw(b, m * n), 'When multiplying, add the powers (multiply them only for a power of a power).');
  } else if (kind === 'div') {
    L.say(`${pw(b, m)} ÷ ${pw(b, n)}: each ${b} on the bottom cancels one ${b} on the top, so ${Math.min(m, n)} of them cancel.`);
    L.say('Same base, dividing: subtract the powers.', `${m} − ${n} = ${f(e)}`);
    L.slip(pw(b, m + n), 'When dividing, subtract the powers.');
  } else {
    L.say(`(${pw(b, m)})${sup(n)} means ${n} lots of ${pw(b, m)} multiplied.`, `${Array(n).fill(pw(b, m)).join(' × ')}`);
    L.say('A power of a power: multiply the powers.', `${m} × ${n} = ${e}`);
    L.slip(pw(b, m + n), 'For a power of a power, multiply the powers.');
  }
  return L.end(ans, e === 1 ? `So the answer is ${ans}, which is just ${b}.` : undefined);
}

/** b⁰ = 1 and b⁻ᵉ = 1/bᵉ. */
export function zeroNegLesson(b: number, e: number): Lesson {
  const L = new LessonBuilder();
  if (e === 0) {
    L.say(`Think of ${pw(b, 3)} ÷ ${pw(b, 3)}: anything divided by itself is 1.`);
    L.say('By the rule, the powers subtract: 3 − 3 = 0.', `${pw(b, 3)} ÷ ${pw(b, 3)} = ${pw(b, 0)} = 1`);
    L.slip(0, `${pw(b, 0)} is 1, not 0.`);
    return L.end(1);
  }
  L.say(`A negative power means 1 over the positive power.`, `${pw(b, -e)} = 1/${pw(b, e)}`);
  L.say(`Work out ${pw(b, e)}.`, `${pw(b, e)} = ${b ** e}`);
  L.slip(String(-(b ** e)), 'A negative power does not make the answer negative: it means 1 over.');
  return L.end(frac(1, b ** e), undefined, `${pw(b, -e)} = 1/${b ** e}`);
}

/** √x lies between n and n + 1. */
export function estRootLesson(x: number): Lesson {
  const n = Math.floor(Math.sqrt(x));
  const L = new LessonBuilder();
  L.board = { kind: 'table', head: ['n', 'n²'], rows: [n - 1, n, n + 1, n + 2].filter((k) => k > 0).map((k) => ({ cells: [String(k), { v: String(k * k), tone: k === n || k === n + 1 ? ('good' as const) : undefined, hl: k === n || k === n + 1 ? 1 : undefined }] })) };
  L.say(`Find the square numbers either side of ${x}.`);
  L.say(`${n}² = ${n * n} and ${n + 1}² = ${(n + 1) ** 2}. ${x} is between them.`);
  return L.end(`${n} and ${n + 1}`, `So √${x} is between ${n} and ${n + 1}.`);
}

/** Write a big number in standard form. */
export function stdFormLesson(n: number, m: number, e: number): Lesson {
  const L = new LessonBuilder();
  L.say('Standard form has one digit before the decimal point, then × a power of 10.');
  L.say(`Put the point after the first digit: ${f(m)}.`);
  L.say(`The point moved ${e} places, so it is × 10${sup(e)}.`, `${f(m)} × 10${sup(e)} = ${n.toLocaleString('en-US')}`);
  return L.end(`${f(m)} × 10${sup(e)}`);
}

/** How many digits has m × 10^e? */
export function stdDigitsLesson(m: number, e: number): Lesson {
  const L = new LessonBuilder();
  const n = Math.round(m * 10 ** e);
  L.say(`× 10${sup(e)} moves the point ${e} places to the right.`, `${f(m)} × 10${sup(e)} = ${n.toLocaleString('en-US')}`);
  L.say(`Count the digits: one before the point, then ${e} more.`);
  return L.end(e + 1, `So it has ${e + 1} digits.`);
}

/** Standard form × and ÷: numbers then powers, then tidy to one digit before the point. */
export function stdMulLesson(a: number, m: number, b: number, n: number, div: boolean): Lesson {
  const L = new LessonBuilder();
  if (div) {
    const q = a / b;
    L.say('Divide the numbers.', `${f(a)} ÷ ${f(b)} = ${f(q)}`);
    L.say('Divide the powers of 10: subtract them.', `10${sup(m)} ÷ 10${sup(n)} = 10${sup(m - n)}`);
    return L.end(`${f(q)} × 10${sup(m - n)}`);
  }
  const p = a * b;
  L.say('Multiply the numbers.', `${f(a)} × ${f(b)} = ${f(p)}`);
  L.say('Multiply the powers of 10: add them.', `10${sup(m)} × 10${sup(n)} = 10${sup(m + n)}`);
  if (p >= 10) {
    L.say(`${f(p)} has two digits before the point. Make it ${f(p / 10)} and add 1 to the power.`, `${f(p)} × 10${sup(m + n)} = ${f(p / 10)} × 10${sup(m + n + 1)}`);
    return L.end(`${f(p / 10)} × 10${sup(m + n + 1)}`);
  }
  return L.end(`${f(p)} × 10${sup(m + n)}`);
}

/** Fractional indices: ½ is a square root, ⅓ a cube root, 3/2 root then cube. */
export function fracIndexLesson(kind: 0 | 1 | 2, base: number): Lesson {
  const L = new LessonBuilder();
  if (kind === 0) {
    const n = Math.round(Math.sqrt(base));
    L.say('A power of ½ means the square root.', `${base}${sup('1/2')} = √${base}`);
    L.say(`Which number times itself makes ${base}?`, `${n} × ${n} = ${base}`);
    L.slip(base / 2, 'Power ½ is the square root, not half.');
    return L.end(n);
  }
  if (kind === 1) {
    const n = Math.round(Math.cbrt(base));
    L.say('A power of ⅓ means the cube root.', `${base}${sup('1/3')} = ∛${base}`);
    L.say(`Which number cubed makes ${base}?`, `${n} × ${n} × ${n} = ${base}`);
    L.slip(base / 3, 'Power ⅓ is the cube root, not a third.');
    return L.end(n);
  }
  const n = Math.round(Math.sqrt(base));
  L.say('A power of 3/2 means: square root first (the 2), then cube (the 3).');
  L.say('Square root first.', `√${base} = ${n}`);
  L.say('Then cube it.', `${n}³ = ${n} × ${n} × ${n} = ${n ** 3}`);
  return L.end(n ** 3);
}

/** log_b(v): b to what power makes v? */
export function logLesson(b: number, v: number): Lesson {
  const L = new LessonBuilder();
  const e = Math.round(Math.log(v) / Math.log(b));
  L.say(`log${b === 10 ? '₁₀' : '₂'} ${f(v)} asks: ${b} to what power makes ${f(v)}?`);
  if (e === 0) {
    L.say(`Any number to the power 0 is 1.`, `${b}⁰ = 1`);
    return L.end(0);
  }
  const vals = Array.from({ length: e }, (_, i) => b ** (i + 1));
  L.board = { kind: 'table', head: ['power', 'value'], rows: powerRows(b, e) };
  L.say(`Count the powers of ${b}.`, vals.map(f).join(', '));
  return L.end(e, `${pw(b, e)} = ${f(v)}, so the log is ${e}.`);
}

/** √(k²s) = k√s. */
export function surdSimplify(k: number, s: number): Lesson {
  const L = new LessonBuilder();
  const n = k * k * s;
  L.say(`Find the biggest square number that divides ${n}.`, `${n} = ${k * k} × ${s}`);
  L.say('Split the root, and take the square root of the square.', `√${n} = √${k * k} × √${s} = ${k}√${s}`);
  return L.end(`${k}√${s}`);
}

/** √a × √b = √(ab), then simplify. */
export function surdMultiply(a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const p = a * b;
  let k = 1;
  for (let i = 12; i >= 2; i--)
    if (p % (i * i) === 0) {
      k = i;
      break;
    }
  const rest = p / (k * k);
  const ans = rest === 1 ? String(k) : k === 1 ? `√${rest}` : `${k}√${rest}`;
  L.say('Multiply under one square root.', `√${a} × √${b} = √${p}`);
  if (k > 1) L.say(`${p} = ${k * k} × ${rest}, and √${k * k} = ${k}.`, rest === 1 ? `√${p} = ${k}` : `√${p} = ${k}√${rest}`);
  else L.say(`${p} has no square factor, so it stays as √${p}.`);
  L.slip(`√${a + b}`, 'Multiply the numbers under the roots, don’t add them.');
  return L.end(ans);
}

/** k/√s: multiply top and bottom by √s. */
export function rationaliseLesson(k: number, s: number): Lesson {
  const L = new LessonBuilder();
  const top = k / s;
  L.say(`Multiply the top and the bottom by √${s}. That doesn’t change the value.`, `${k}/√${s} × √${s}/√${s}`);
  L.say(`√${s} × √${s} = ${s}, so the bottom becomes ${s}.`, `= ${k}√${s} / ${s}`);
  L.say(`${k} ÷ ${s} = ${top}.`, `= ${top === 1 ? '' : top}√${s}`);
  return L.end(top === 1 ? `√${s}` : `${top}√${s}`);
}

/** 0.ddd… and 0.dddd… as fractions. */
export function recurringLesson(digits: string): Lesson {
  const L = new LessonBuilder();
  const k = digits.length;
  const d = Number(digits);
  const nines = Number('9'.repeat(k));
  const rep = digits.repeat(k === 1 ? 3 : 2);
  const m = 10 ** k;
  L.say(`Call the number x.`, `x = 0.${rep}…`);
  L.say(`${k === 1 ? '1 digit repeats' : `${k} digits repeat`}, so multiply by ${m}.`, `${m}x = ${digits}.${rep}…`);
  L.say('Subtract: the repeating parts cancel.', `${m}x − x = ${digits}`, `${nines}x = ${digits}`);
  const ans = frac(d, nines);
  const g = gcd(d, nines);
  if (g > 1) L.say(`Simplify by dividing top and bottom by ${g}.`, `${d}/${nines} = ${ans}`);
  return L.end(ans, undefined, `x = ${ans}`);
}
