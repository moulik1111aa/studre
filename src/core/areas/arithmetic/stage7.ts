// Stage 7 — Maths Ninja (ages 15–16). Quadratics and simultaneous equations, surds and
// indices, compound change, logs, and the fastest mental-maths tricks.

import { stageSkills, NAMES } from '../../skill.ts';
import { clean, frac, gcd, nearNumbers, num, uniqueWrong, valueOf, type Made } from '../../question.ts';
import type { Rng } from '../../rng.ts';

const { list, add } = stageSkills('arithmetic', 7, { format: 'pad-ext', speedSec: 15 });
export const STAGE7 = list;

const q = (prompt: string, answer: number, r: Rng, hint?: string, extras: number[] = []): Made => ({
  prompt,
  answer: num(answer),
  distractors: nearNumbers(r, answer, extras, { min: -1e9 }),
  hint,
});
const choice = (prompt: string, answer: string, wrong: string[], r: Rng, hint?: string): Made => ({
  prompt,
  answer,
  distractors: uniqueWrong(answer, wrong, () => `${answer} + ${r.int(1, 9)}`),
  hint,
  exactForm: true,
});
const SUP: Record<string, string> = { '-': '⁻', '/': 'ᐟ', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (s: number | string): string => String(s).split('').map((c) => SUP[c] ?? c).join('');
const sgn = (n: number): string => (n < 0 ? `− ${-n}` : `+ ${n}`);
/** "x² + 5x + 6" with tidy signs. */
function quad(a: number, b: number, c: number, v = 'x'): string {
  const parts: string[] = [];
  parts.push(a === 1 ? `${v}²` : a === -1 ? `−${v}²` : `${a}${v}²`);
  if (b) parts.push(`${b < 0 ? '−' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}${v}`);
  if (c) parts.push(sgn(c));
  return parts.join(' ');
}
const bracket = (k: number, v = 'x'): string => `(${v} ${sgn(k)})`;
const name = (r: Rng): string => r.pick(NAMES);

// ── Algebra ────────────────────────────────────────────────────────────────
add('sqplus', 'algebra', 'Expand (a + b)²', (r) => {
  const b = r.int(1, 12);
  return choice(`(x + ${b})² = ?`, quad(1, 2 * b, b * b), [quad(1, 0, b * b), quad(1, b, b * b), quad(1, 2 * b, 2 * b), quad(1, b * b, 2 * b)], r, `(x + ${b})(x + ${b}): don't forget the middle term 2 × ${b}x.`);
}, { format: 'choice' });
add('sqminus', 'algebra', 'Expand (a − b)²', (r) => {
  const b = r.int(1, 12);
  return choice(`(x − ${b})² = ?`, quad(1, -2 * b, b * b), [quad(1, 0, -(b * b)), quad(1, -2 * b, -(b * b)), quad(1, 2 * b, b * b), quad(1, -b, b * b)], r, 'The middle term is negative; the last term is positive.');
}, { format: 'choice' });
add('dots', 'algebra', 'Expand (a + b)(a − b)', (r) => {
  const b = r.int(1, 15);
  return choice(`(x + ${b})(x − ${b}) = ?`, quad(1, 0, -(b * b)), [quad(1, 0, b * b), quad(1, -2 * b, -(b * b)), quad(1, 2 * b, -(b * b)), quad(1, 0, -2 * b)], r, 'The middle terms cancel: x² − b².');
}, { format: 'choice' });
add('expand2', 'algebra', 'Expand two brackets', (r) => {
  const p = r.int(-9, 9) || 2;
  let s = r.int(-9, 9) || 3;
  if (s === -p) s = p + 1;
  return choice(`${bracket(p)}${bracket(s)} = ?`, quad(1, p + s, p * s), [quad(1, p * s, p + s), quad(1, p + s, p + s), quad(1, p - s, p * s), quad(1, 0, p * s)], r, `Middle: ${p} + ${s}; end: ${p} × ${s}.`);
}, { format: 'choice' });
add('factcommon', 'algebra', 'Factorise a common factor', (r) => {
  const k = r.int(2, 9);
  const a = r.int(1, 6);
  let b = r.int(1, 9);
  if (gcd(a, b) !== 1) b = 1;
  const ans = `${k}(${a === 1 ? '' : a}x + ${b})`;
  return choice(`Factorise ${k * a}x + ${k * b}`, ans, [`${k}(${a === 1 ? '' : a}x + ${k * b})`, `${k * a}(x + ${b})`, `x(${k * a} + ${k * b})`, `${b}(${k * a}x + ${k})`], r, `${k} goes into both terms.`);
}, { format: 'choice' });
const roots = (r: Rng): [number, number] => {
  const p = r.int(-9, 9) || 1;
  let s = r.int(-9, 9) || -2;
  if (s === p) s = p + 1;
  if (s === -p) s = -p + (p > 0 ? 1 : -1) || 3;
  return [p, s];
};
add('factquad', 'algebra', 'Factorise x² + bx + c', (r) => {
  const [p, s] = roots(r);
  const ans = `${bracket(p)}${bracket(s)}`;
  return choice(`Factorise ${quad(1, p + s, p * s)}`, ans, [`${bracket(-p)}${bracket(-s)}`, `${bracket(p * s)}${bracket(1)}`, `${bracket(p + s)}${bracket(p * s)}`, `${bracket(-p)}${bracket(s)}`], r, `Find two numbers that multiply to ${p * s} and add to ${p + s}.`);
}, { format: 'choice' });
add('diffsq', 'algebra', 'Difference of squares', (r) => {
  const b = r.int(2, 15);
  const a = r.pick([1, 1, 2, 3]);
  const lhs = a === 1 ? `x² − ${b * b}` : `${a * a}x² − ${b * b}`;
  const ax = a === 1 ? 'x' : `${a}x`;
  return choice(`Factorise ${lhs}`, `(${ax} + ${b})(${ax} − ${b})`, [`(${ax} − ${b})²`, `(${ax} + ${b})²`, `(${ax} − ${b * b})(${ax} + 1)`, `${a * a}(x − ${b})`], r, 'a² − b² = (a + b)(a − b).');
}, { format: 'choice' });
add('solvequad', 'algebra', 'Solve quadratics by factorising (two answers)', (r) => {
  const [p, s] = roots(r);
  const ans = [-p, -s].sort((x, y) => x - y).join(',');
  return { prompt: `Solve ${quad(1, p + s, p * s)} = 0`, answer: ans, distractors: uniqueWrong(ans, [[p, s], [-p, s], [p, -s], [p + s, p * s]].map((l) => l.sort((x, y) => x - y).join(',')), () => `${r.int(-9, 9)},${r.int(-9, 9)}`), hint: `${quad(1, p + s, p * s)} = ${bracket(p)}${bracket(s)}. Each bracket can be 0. Type both answers with "and".` };
});
add('simul', 'algebra', 'Simple simultaneous equations', (r) => {
  const x = r.int(-5, 9);
  const y = r.int(-5, 9);
  const a = r.int(1, 4);
  const b = r.int(1, 4);
  const ans = `x = ${x}; y = ${y}`;
  return choice(`x + y = ${x + y} and ${a === 1 ? '' : a}x − ${b === 1 ? '' : b}y = ${a * x - b * y}`, ans, [`x = ${y}; y = ${x}`, `x = ${x + 1}; y = ${y - 1}`, `x = ${-x}; y = ${x + y + x}`, `x = ${x}; y = ${-y}`].filter((s) => s !== ans), r, 'Use the first equation: y = (x + y) − x, and substitute.');
}, { format: 'choice', speedSec: 40 });
add('rearrange', 'algebra', 'Rearrange formulas', (r) => {
  const forms: [string, string, string[]][] = [
    ['v = u + at. Make t the subject.', 't = (v − u) / a', ['t = v − u − a', 't = (v + u) / a', 't = a / (v − u)', 't = v / a − u']],
    ['A = πr². Make r the subject.', 'r = √(A / π)', ['r = A / π', 'r = √A / π²', 'r = (A / π)²', 'r = Aπ']],
    ['P = 2(l + w). Make w the subject.', 'w = P / 2 − l', ['w = P − 2l', 'w = 2P − l', 'w = (P − l) / 2', 'w = P / 2 + l']],
    ['y = mx + c. Make x the subject.', 'x = (y − c) / m', ['x = y / m − c', 'x = (y + c) / m', 'x = m(y − c)', 'x = y − c − m']],
    ['F = 9C/5 + 32. Make C the subject.', 'C = 5(F − 32) / 9', ['C = 9(F − 32) / 5', 'C = 5F / 9 − 32', 'C = (F + 32) × 5 / 9', 'C = F − 32']],
    ['s = d / t. Make t the subject.', 't = d / s', ['t = s / d', 't = ds', 't = d − s', 't = s − d']],
  ];
  const [p, a, w] = r.pick(forms);
  return choice(p, a, w, r, 'Undo the operations in reverse order, doing the same to both sides.');
}, { format: 'choice', speedSec: 30 });
add('evalpoly', 'algebra', 'Evaluate polynomials', (r) => {
  const x = r.int(-4, 5);
  const [a, b, c] = [r.int(1, 4), r.int(-6, 6), r.int(-9, 9)];
  const cubic = r.chance(0.4);
  const val = cubic ? x ** 3 + b * x + c : a * x * x + b * x + c;
  const expr = cubic ? `x³ ${b ? `${b < 0 ? '−' : '+'} ${Math.abs(b)}x ` : ''}${c ? sgn(c) : ''}`.trim() : quad(a, b, c);
  return q(`If x = ${x}, ${expr} = ?`, val, r, `Powers first; take care with negative x.`, [cubic ? -(x ** 3) + b * x + c : -a * x * x + b * x + c, val + 2 * b * x]);
});

// ── Surds and indices ──────────────────────────────────────────────────────
add('simpsurd', 'algebra', 'Simplify surds', (r) => {
  const k = r.int(2, 9);
  const s = r.pick([2, 3, 5, 6, 7]);
  return choice(`√${k * k * s} = ?`, `${k}√${s}`, [`${s}√${k}`, `${k * k}√${s}`, `${k}√${s * 2}`, `${k + 1}√${s}`], r, `${k * k * s} = ${k * k} × ${s}, and √${k * k} = ${k}.`);
}, { format: 'choice' });
add('mulsurd', 'algebra', 'Multiply surds', (r) => {
  const a = r.pick([2, 3, 5, 6, 7, 8, 10, 12]);
  const b = r.pick([2, 3, 5, 6, 8, 12, 18]);
  const p = a * b;
  let k = 1;
  for (let i = 12; i >= 2; i--) if (p % (i * i) === 0) {
    k = i;
    break;
  }
  const rest = p / (k * k);
  const ans = rest === 1 ? String(k) : k === 1 ? `√${rest}` : `${k}√${rest}`;
  return choice(`√${a} × √${b} = ?`, ans, [`√${a + b}`, `${a}√${b}`, `${p}`, rest === 1 ? `√${k}` : `${rest}√${k}`], r, 'Multiply under one root, then simplify.');
}, { format: 'choice' });
add('rationalise', 'algebra', 'Rationalise simple denominators', (r) => {
  const s = r.pick([2, 3, 5, 6, 7]);
  const k = s * r.int(1, 4);
  const top = k / s;
  const ans = top === 1 ? `√${s}` : `${top}√${s}`;
  return choice(`${k}/√${s} = ?`, ans, [`${k}√${s}`, `√${s}/${k}`, `${k * s}√${s}`, `${top + 1}√${s}`], r, `Multiply top and bottom by √${s}.`);
}, { format: 'choice' });
add('fracind', 'algebra', 'Fractional indices', (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const n = r.int(2, 15);
    return q(`${n * n}${sup('1/2')} = ?`, n, r, 'Power ½ means square root.', [(n * n) / 2].filter(Number.isInteger));
  }
  if (kind === 1) {
    const n = r.int(2, 6);
    return q(`${n ** 3}${sup('1/3')} = ?`, n, r, 'Power ⅓ means cube root.', [n * n]);
  }
  const n = r.int(2, 5);
  return q(`${n * n}${sup('3/2')} = ?`, n ** 3, r, `Square root first (${n}), then cube.`, [n * n * 3, (n * n) ** 2]);
}, { format: 'pad' });
add('stdmul', 'number', 'Standard form × and ÷', (r) => {
  const a = r.int(2, 9);
  const b = r.int(1, 9);
  const m = r.int(2, 9);
  const n = r.int(2, 9);
  const div = r.chance(0.4);
  if (div) {
    const prod = a * b;
    return choice(`(${prod} × 10${sup(m + n)}) ÷ (${b} × 10${sup(n)}) = ?`, `${a} × 10${sup(m)}`, [`${a} × 10${sup(m + 2 * n)}`, `${a} × 10${sup(n)}`, `${a + 1} × 10${sup(m)}`, `${a} × 10${sup(m + 1)}`], r, 'Divide the numbers; subtract the powers of 10.');
  }
  const prod = a * b;
  const ans = prod >= 10 ? `${num(prod / 10)} × 10${sup(m + n + 1)}` : `${prod} × 10${sup(m + n)}`;
  return choice(`(${a} × 10${sup(m)}) × (${b} × 10${sup(n)}) = ?`, ans, [`${prod} × 10${sup(m * n)}`, `${num(prod / 10)} × 10${sup(m + n)}`, `${a + b} × 10${sup(m + n)}`, `${prod} × 10${sup(m + n + 1)}`], r, 'Multiply the numbers; add the powers; keep one digit before the point.');
}, { format: 'choice', speedSec: 25 });

// ── Number ─────────────────────────────────────────────────────────────────
add('recurring', 'fdp', 'Recurring decimals → fractions', (r) => {
  if (r.chance(0.6)) {
    const d = r.int(1, 8);
    const ans = frac(d, 9);
    return { prompt: `0.${String(d).repeat(4)}… as a fraction = ?`, answer: ans, distractors: uniqueWrong(ans, [frac(d, 10), frac(d, 99), frac(d + 1, 9), frac(d, 100)].filter((x) => Math.abs(valueOf(x) - d / 9) > 1e-9), () => frac(r.int(1, 9), 11)), hint: 'One repeating digit d is d/9.' };
  }
  const dd = r.int(10, 98);
  const ans = frac(dd, 99);
  const s = String(dd).padStart(2, '0');
  return { prompt: `0.${s.repeat(3)}… as a fraction = ?`, answer: ans, distractors: uniqueWrong(ans, [frac(dd, 100), frac(dd, 90), frac(dd + 1, 99), frac(dd, 9)].filter((x) => Math.abs(valueOf(x) - dd / 99) > 1e-9), () => frac(r.int(1, 98), 999)), hint: 'Two repeating digits dd is dd/99.' };
}, { format: 'choice' });
add('compoundn', 'word', 'Multi-year compound interest', (r) => {
  const P = 1000 * r.pick([1, 2, 4, 5, 8, 10]);
  const R = r.pick([10, 20]);
  const T = r.int(2, 3);
  const A = clean(P * (1 + R / 100) ** T);
  return q(`₹${P} at ${R}% a year, compounded for ${T} years. Final amount?`, A, r, `× ${1 + R / 100} each year, ${T} times.`, [P + (P * R * T) / 100, clean(A - P)]);
}, { format: 'pad', speedSec: 40 });
add('deprec', 'word', 'Depreciation', (r) => {
  const P = 10000 * r.int(1, 10);
  const R = r.pick([10, 20]);
  const T = r.int(1, 3);
  const V = clean(P * (1 - R / 100) ** T);
  return q(`A ₹${P} scooter loses ${R}% of its value each year. Value after ${T} year${T > 1 ? 's' : ''}?`, V, r, `× ${1 - R / 100} each year.`, [P - (P * R * T) / 100]);
}, { format: 'pad', speedSec: 40 });
add('pctchain', 'fdp', 'Chains of percentage change', (r) => {
  const a = r.pick([10, 20, 25, 50]);
  const b = r.pick([10, 20, 25, 50]);
  const c = r.pick([10, 20]);
  const m = (1 + a / 100) * (1 - b / 100) * (1 + c / 100);
  const ans = clean(Math.round(m * 1000) / 10);
  return q(`A price goes up ${a}%, down ${b}%, then up ${c}%. The final price is what % of the start?`, ans, r, `Multiplier: ${1 + a / 100} × ${1 - b / 100} × ${1 + c / 100}.`, [100 + a - b + c]);
}, { speedSec: 40 });
add('ratioadv', 'fdp', 'Advanced ratio and proportion', (r) => {
  const a = r.int(2, 5);
  const b = r.int(2, 7);
  const k = r.int(2, 8);
  if (r.chance(0.5)) {
    const diff = Math.abs(a - b) || 1;
    const bb = a === b ? b + 1 : b;
    const unit = r.int(2, 12);
    return q(`Boys to girls is ${a}:${bb}. There are ${Math.abs(bb - a) * unit} more ${bb > a ? 'girls' : 'boys'}. How many children?`, (a + bb) * unit, r, `The difference is ${Math.abs(bb - a)} parts = ${Math.abs(bb - a) * unit}.`, [(a + bb) * diff, unit * a]);
  }
  return q(`y is proportional to x². When x = ${a}, y = ${k * a * a}. Find y when x = ${b}.`, k * b * b, r, `y = ${k}x².`, [k * a * b, (k * a * a * b) / a]);
}, { format: 'pad', speedSec: 40 });
add('logs', 'algebra', 'Log basics', (r) => {
  const base = r.pick([10, 2]);
  const e = base === 10 ? r.int(0, 6) : r.int(1, 10);
  return { ...q(`log${base === 10 ? '₁₀' : '₂'} ${base ** e} = ?`, e, r, `${base} to what power is ${base ** e}?`, [base ** e / base, e + 1].filter(Number.isInteger)), speak: `Log base ${base} of ${base ** e} equals what?` };
}, { format: 'pad' });

// ── Mental tricks ──────────────────────────────────────────────────────────
add('sq5', 'mental', 'Squares ending in 5', (r) => {
  const t = r.int(1, 12);
  const n = 10 * t + 5;
  return { ...q(`${n}² = ?`, n * n, r, `${t} × ${t + 1} = ${t * (t + 1)}, then write 25.`, [t * t * 100 + 25, n * n + 100]), speak: `${n} squared equals what?` };
}, { format: 'pad' });
add('sq50', 'mental', 'Squares near 50', (r) => {
  const d = r.int(-9, 9) || 4;
  const n = 50 + d;
  return { ...q(`${n}² = ?`, n * n, r, `25${d >= 0 ? ' + ' : ' − '}${Math.abs(d)} = ${25 + d} hundreds, then add ${d * d}.`, [n * n - 100, (25 + d) * 100]), speak: `${n} squared equals what?` };
}, { format: 'pad' });
add('sq100', 'mental', 'Squares near 100', (r) => {
  const d = r.int(-12, 12) || 3;
  const n = 100 + d;
  return { ...q(`${n}² = ?`, n * n, r, `${n} ${d >= 0 ? '+' : '−'} ${Math.abs(d)} = ${n + d}, then write ${d * d < 10 ? '0' : ''}${d * d}.`, [n * n + 100, (n + d) * 100]), speak: `${n} squared equals what?` };
}, { format: 'pad' });
add('base100', 'mental', 'Base method near 100', (r) => {
  const a = 100 + (r.int(-9, 9) || 2);
  const b = 100 + (r.int(-9, 9) || -3);
  return q(`${a} × ${b} = ?`, a * b, r, `Cross: ${a} ${b - 100 >= 0 ? '+' : '−'} ${Math.abs(b - 100)} = ${a + b - 100}, then (${a - 100}) × (${b - 100}) = ${(a - 100) * (b - 100)}.`, [(a + b - 100) * 100, a * b + 100]);
}, { format: 'pad' });
add('x11three', 'mental', '× 11 for 3-digit numbers', (r) => {
  const n = r.int(101, 999);
  return q(`${n} × 11 = ?`, n * 11, r, 'Write the first digit, then add neighbouring pairs, then the last digit.', [n * 10, n * 11 + 100]);
}, { format: 'pad' });
add('cross', 'mental', '2-digit × 2-digit cross method', (r) => {
  const a = r.int(21, 99);
  const b = r.int(21, 99);
  return q(`${a} × ${b} = ?`, a * b, r, 'Ones × ones, then cross-multiply and add, then tens × tens.', [a * b + 100, a * b - 10]);
}, { format: 'pad', speedSec: 30 });
add('x9comp', 'mental', 'Complements for × 9s', (r) => {
  const n = r.int(12, 98);
  const m = r.pick([99, 999]);
  return q(`${n} × ${m} = ?`, n * m, r, `${n} × ${m + 1} − ${n}.`, [n * (m + 1), n * m + n]);
}, { format: 'pad' });
add('div71113', 'number', 'Divisibility by 7, 11 and 13', (r) => {
  const by = r.pick([7, 11, 13]);
  const ans = by * r.int(80, 900);
  const wrong: number[] = [];
  while (wrong.length < 3) {
    const w = ans + r.int(1, by - 1) + by * r.int(-3, 3);
    if (w % by !== 0 && !wrong.includes(w)) wrong.push(w);
  }
  return { prompt: `Which divides exactly by ${by}?`, answer: num(ans), distractors: wrong.map(num), hint: by === 11 ? 'Alternating digit sum divides by 11.' : `Double the last digit and subtract it from the rest (${by === 7 ? '÷ 7' : 'or × 4 and add for 13'}).` };
}, { format: 'choice', speedSec: 25 });
add('cbrt6', 'mental', 'Cube roots of 6-digit perfect cubes', (r) => {
  const n = r.int(47, 99);
  const LAST: Record<number, number> = { 0: 0, 1: 1, 2: 8, 3: 7, 4: 4, 5: 5, 6: 6, 7: 3, 8: 2, 9: 9 };
  return { ...q(`∛${n ** 3} = ?`, n, r, `The last digit ${(n ** 3) % 10} → ${LAST[(n ** 3) % 10]}. The first part ${Math.floor(n ** 3 / 1000)} lies between ${Math.floor(n / 10)}³ and ${Math.floor(n / 10) + 1}³.`, [n + 10, n - 10]), speak: `Cube root of ${n ** 3}` };
}, { format: 'pad', speedSec: 25 });
add('sqrt4', 'mental', 'Square roots of 4-digit perfect squares', (r) => {
  const n = r.int(32, 99);
  return { ...q(`√${n * n} = ?`, n, r, `Between ${Math.floor(n / 10) * 10} and ${Math.floor(n / 10) * 10 + 10}; the last digit ${(n * n) % 10} narrows it.`, [n + 10, 10 * (n % 10) + Math.floor(n / 10)]), speak: `Square root of ${n * n}` };
}, { format: 'pad', speedSec: 25 });
add('fastfrac', 'mental', 'Fast fraction addition', (r) => {
  const a = r.int(2, 12);
  let b = r.int(2, 12);
  if (a === b) b++;
  const ans = frac(a + b, a * b);
  return { prompt: `1/${a} + 1/${b} = ?`, answer: ans, distractors: uniqueWrong(ans, [frac(2, a + b), frac(1, a + b), frac(a + b, a + b + 1), frac(a * b, a + b)].filter((x) => Math.abs(valueOf(x) - (a + b) / (a * b)) > 1e-9), () => frac(r.int(1, 20), a * b)), hint: '1/a + 1/b = (a + b)/ab.' };
});
add('pctswap', 'mental', 'x% of y = y% of x', (r) => {
  const x = r.pick([4, 8, 12, 16, 18, 24, 32, 36, 44, 48, 64]);
  const y = r.pick([25, 50, 75, 20]);
  return q(`${x}% of ${y} = ?`, (x * y) / 100, r, `Swap: ${y}% of ${x} is easy.`, [(x * y) / 10, x + y]);
});
add('estroot7', 'mental', 'Estimating products and roots', (r) => {
  if (r.chance(0.5)) {
    const n = r.int(10, 30);
    const x = n * n + r.int(1, n);
    return { prompt: `√${x} to the nearest whole number = ?`, answer: num(n), distractors: [num(n + 1), num(n - 1), num(Math.round(x / 2))], hint: `${n}² = ${n * n}, ${n + 1}² = ${(n + 1) ** 2}.` };
  }
  const a = r.int(110, 990);
  const b = r.int(11, 99);
  const ans = Math.round(a / 100) * 100 * Math.round(b / 10) * 10;
  return { prompt: `${a} × ${b} ≈ ? (1 significant figure each)`, answer: num(ans), distractors: uniqueWrong(num(ans), [ans * 10, ans / 10, a * b].map(num), () => num(ans * 2)), hint: 'Round each to 1 significant figure first.' };
}, { format: 'choice' });

// ── Mixed ──────────────────────────────────────────────────────────────────
const SPEED = ['sq5', 'sq50', 'base100', 'x11three', 'x9comp', 'logs', 'fracind', 'pctswap'];
add('speed7', 'mental', 'Speed mix', (r, d) => {
  const id = `s7.${r.pick(SPEED)}`;
  return list.find((x) => x.id === id)!.make(r, d);
}, { speedSec: 10 });
add('multistep', 'word', 'Multi-step problems', (r) => {
  const who = name(r);
  const kind = r.int(0, 2);
  if (kind === 0) {
    const price = 100 * r.int(5, 40);
    const disc = r.pick([10, 20, 25]);
    const gst = r.pick([5, 12, 18]);
    const ans = clean(price * (1 - disc / 100) * (1 + gst / 100));
    return q(`A ₹${price} phone case has ${disc}% off, then ${gst}% GST is added. Final price?`, ans, r, 'Discount first, then add GST to the new price.', [clean(price * (1 + (gst - disc) / 100))]);
  }
  if (kind === 1) {
    const s1 = 10 * r.int(3, 8);
    const s2 = 10 * r.int(3, 8);
    const t = r.pick([1, 2, 3]);
    return q(`${who} drives ${t} h at ${s1} km/h, then ${t} h at ${s2} km/h. Average speed?`, (s1 + s2) / 2, r, 'Total distance ÷ total time.', [s1 + s2]);
  }
  const w = r.int(4, 12);
  const l = w + r.int(2, 10);
  const tile = r.pick([25, 40, 50]);
  return q(`A room is ${l} m by ${w} m. Tiles cost ₹${tile} per m². Total cost?`, l * w * tile, r, `Area ${l * w} m², then × ${tile}.`, [2 * (l + w) * tile]);
}, { format: 'pad', speedSec: 45 });
add('algsprint', 'algebra', 'Algebra sprint', (r) => {
  const x = r.int(-8, 12);
  const a = r.int(2, 9);
  const b = r.int(-20, 20) || 7;
  const kind = r.int(0, 2);
  if (kind === 0) return q(`${a}x ${sgn(b)} = ${a * x + b}. x = ?`, x, r, `Undo ${sgn(b)}, then ÷ ${a}.`, [-x]);
  if (kind === 1) return q(`x/${a} ${sgn(b)} = ${x + b}. x = ?`, a * x, r, `Undo ${sgn(b)}, then × ${a}.`, [x]);
  return q(`${a}(x ${sgn(b)}) = ${a * (x + b)}. x = ?`, x, r, `÷ ${a} first.`, [x + b]);
}, { speedSec: 12 });
add('missingop7', 'algebra', 'Missing-operator puzzles', (r) => {
  const a = r.int(3, 12);
  const b = r.int(2, 9);
  const c = r.int(2, 6);
  const ops = ['+', '−', '×'] as const;
  const o1 = r.pick(ops);
  const o2 = r.pick(ops);
  const ev = (x: number, op: string, y: number) => (op === '+' ? x + y : op === '−' ? x - y : x * y);
  // Respect BODMAS: × binds tighter.
  const val = (p: string, s: string) => (s === '×' && p !== '×' ? ev(a, p, b * c) : ev(ev(a, p, b), s, c));
  const res = val(o1, o2);
  const ans = `${o1} ${o2}`;
  const wrong = ops.flatMap((p) => ops.map((s) => [p, s] as const)).filter(([p, s]) => val(p, s) !== res).map(([p, s]) => `${p} ${s}`);
  return { prompt: `${a} ? ${b} ? ${c} = ${res}`, answer: ans, distractors: r.shuffle(wrong).slice(0, 3), hint: 'Remember × comes before + and −.', exactForm: true, speak: `${a}, ${b}, ${c} make ${res}. Which two signs?` };
}, { format: 'choice', speedSec: 25 });
add('grand', 'mental', 'Grand review', (r, d) => {
  // The toughest Stage 7 skills, all answered as choices.
  const own = ['solvequad', 'factquad', 'simpsurd', 'logs', 'compoundn', 'cross', 'recurring', 'expand2', 'rearrange', 'sq100'];
  const id = `s7.${r.pick(own)}`;
  return list.find((x) => x.id === id)!.make(r, d);
}, { format: 'choice', speedSec: 25 });
