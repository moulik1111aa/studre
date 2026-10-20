// Stage 6 — Power Up (ages 13–14). Powers and roots, first algebra, money and percent,
// rational numbers, standard form, proportion, and mental shortcuts.

import { stageSkills, NAMES } from '../../skill.ts';
import { clean, frac, gcd, lcm, nearNumbers, num, uniqueWrong, valueOf, type Made } from '../../question.ts';
import type { Rng } from '../../rng.ts';
import type { Lesson } from '../../teach/types.ts';
import * as E from '../../teach/expr.ts';
import * as X from '../../teach/powers.ts';
import * as T from '../../teach/tricks.ts';
import * as W from '../../teach/words.ts';
import * as FO from '../../teach/fracops.ts';
import * as PC from '../../teach/percent.ts';
import * as R from '../../teach/ratio.ts';
import * as NU from '../../teach/numbers.ts';
import * as MT from '../../teach/mental.ts';
import * as AL from '../../teach/algebra.ts';

const { list, add } = stageSkills('arithmetic', 6, { format: 'pad-ext', speedSec: 14 });
export const STAGE6 = list;

const q = (prompt: string, answer: number, r: Rng, hint?: string, extras: number[] = [], teach?: () => Lesson): Made => ({
  prompt,
  answer: num(answer),
  distractors: nearNumbers(r, answer, extras, { min: -100000 }),
  hint,
  teach,
});
/** A made question with its lesson. */
const taught = (m: Made, teach: () => Lesson): Made => ({ ...m, teach });
const name = (r: Rng): string => r.pick(NAMES);
const SUP: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n: number): string => String(n).split('').map((c) => SUP[c]).join('');
const pw = (b: string | number, e: number): string => `${b}${sup(e)}`;
/** Expression options: a list of strings, answer first. */
const choice = (prompt: string, answer: string, wrong: string[], r: Rng, hint?: string): Made => ({
  prompt,
  answer,
  distractors: uniqueWrong(answer, wrong, () => `${answer} + ${r.int(1, 9)}`),
  hint,
  exactForm: true,
});
/** "3x + 4" with tidy signs and coefficients. */
function lin(a: number, b: number, v = 'x'): string {
  const head = a === 0 ? '' : a === 1 ? v : a === -1 ? `−${v}` : `${a < 0 ? '−' : ''}${Math.abs(a)}${v}`;
  if (b === 0) return head || '0';
  if (!head) return b < 0 ? `−${-b}` : String(b);
  return `${head} ${b < 0 ? '−' : '+'} ${Math.abs(b)}`;
}
const signed = (n: number): string => (n < 0 ? `−${-n}` : String(n));

// ── Powers ─────────────────────────────────────────────────────────────────
add('cubes', 'algebra', 'Cubes to 10³', (r) => {
  const n = r.int(2, 10);
  return { ...q(`${pw(n, 3)} = ?`, n ** 3, r, `${n} × ${n} × ${n}.`, [n * n, 3 * n, n ** 3 + n], () => X.cubeLesson(n)), speak: `${n} cubed equals what?` };
}, { format: 'pad' });
add('sqrt', 'algebra', 'Square roots to √400', (r) => {
  const n = r.int(2, 20);
  return { ...q(`√${n * n} = ?`, n, r, `Which number times itself is ${n * n}?`, [n * 2, (n * n) / 2].filter(Number.isInteger), () => X.sqrtLesson(n * n)), speak: `The square root of ${n * n} equals what?` };
}, { format: 'pad' });
add('cbrt', 'algebra', 'Cube roots', (r) => {
  const n = r.int(2, 10);
  return { ...q(`∛${n ** 3} = ?`, n, r, `Which number cubed is ${n ** 3}?`, [n * n, Math.round(n ** 3 / 3)], () => X.cbrtLesson(n ** 3)), speak: `The cube root of ${n ** 3} equals what?` };
}, { format: 'pad' });
add('pow2310', 'algebra', 'Powers of 2, 3 and 10', (r) => {
  const b = r.pick([2, 3, 10]);
  const e = b === 2 ? r.int(4, 10) : b === 3 ? r.int(2, 6) : r.int(2, 7);
  return r.chance(0.7) ? q(`${pw(b, e)} = ?`, b ** e, r, `Multiply ${b} by itself ${e} times.`, [b * e, b ** (e - 1)], () => X.powerLesson(b, e)) : q(`${b}^? = ${b ** e}`, e, r, `How many ${b}s multiply to ${b ** e}?`, [], () => X.whichPower(b, b ** e));
}, { format: 'pad' });
const lawQ = (kind: 'mul' | 'div' | 'pow') => (r: Rng): Made => {
  const b = r.pick(['a', 'x', 'y', '2', '5', '7']);
  const m = r.int(2, 9);
  // Dividing stays at whole powers (negative powers come later, in Zero and negative exponents).
  const n = r.int(2, kind === 'div' ? m : 6);
  const e = kind === 'mul' ? m + n : kind === 'div' ? m - n : m * n;
  const prompt = kind === 'mul' ? `${pw(b, m)} × ${pw(b, n)} = ?` : kind === 'div' ? `${pw(b, m)} ÷ ${pw(b, n)} = ?` : `(${pw(b, m)})${sup(n)} = ?`;
  const wrong = [m * n, m + n, m - n, n - m, m + n + 1].filter((x) => x !== e).map((x) => pw(b, x));
  const rule = kind === 'mul' ? 'Same base: add the powers.' : kind === 'div' ? 'Same base: subtract the powers.' : 'Power of a power: multiply.';
  return taught(choice(prompt, pw(b, e), wrong, r, rule), () => X.indexLaw(kind, b, m, n));
};
add('powmul', 'algebra', 'Multiply powers', lawQ('mul'), { format: 'choice' });
add('powdiv', 'algebra', 'Divide powers', lawQ('div'), { format: 'choice' });
add('powpow', 'algebra', 'Power of a power', lawQ('pow'), { format: 'choice' });
add('zeroneg', 'algebra', 'Zero and negative exponents', (r) => {
  const b = r.int(2, 10);
  if (r.chance(0.3)) return { prompt: `${pw(b, 0)} = ?`, answer: '1', distractors: ['0', String(b), '10'], hint: 'Anything (except 0) to the power 0 is 1.', teach: () => X.zeroNegLesson(b, 0) };
  const e = b <= 5 ? r.int(1, 3) : r.int(1, 2);
  const ans = frac(1, b ** e);
  return { prompt: `${pw(b, -e)} = ?`, answer: ans, distractors: uniqueWrong(ans, [num(-(b ** e)), num(b ** e), frac(1, b * e), num(-b * e), frac(e, b)], () => frac(1, b ** e + r.int(1, 9))), hint: `A negative power means 1 over: 1/${pw(b, e)}.`, teach: () => X.zeroNegLesson(b, e) };
}, { format: 'choice' });
add('estroot', 'mental', 'Estimate square roots', (r) => {
  const n = r.int(3, 18);
  const x = n * n + r.int(1, 2 * n);
  const lo = n;
  const ans = `${lo} and ${lo + 1}`;
  return { prompt: `√${x} lies between…`, answer: ans, distractors: [`${lo - 1} and ${lo}`, `${lo + 1} and ${lo + 2}`, `${Math.floor(x / 2)} and ${Math.floor(x / 2) + 1}`], hint: `${pw(lo, 2)} = ${lo * lo} and ${pw(lo + 1, 2)} = ${(lo + 1) ** 2}.`, exactForm: true, teach: () => X.estRootLesson(x) };
}, { format: 'choice' });

// ── Algebra ────────────────────────────────────────────────────────────────
add('subst', 'algebra', 'Substitute into expressions', (r) => {
  const x = r.int(-5, 9);
  const a = r.int(2, 9);
  const b = r.int(-9, 9);
  const kind = r.int(0, 2);
  if (kind === 0) return q(`If x = ${x}, ${lin(a, b)} = ?`, a * x + b, r, `${a} × (${x}) ${b < 0 ? '−' : '+'} ${Math.abs(b)}.`, [a + x + b, a * x - b], () => AL.substLinear(a, b, x));
  if (kind === 1) return q(`If x = ${x}, x² + ${a} = ?`, x * x + a, r, `x² = (${x}) × (${x}) = ${x * x}.`, [2 * x + a, -(x * x) + a], () => AL.substSquare(x, a));
  const y = r.int(1, 6);
  return q(`If a = ${a} and b = ${y}, 3a − 2b = ?`, 3 * a - 2 * y, r, `3 × ${a} − 2 × ${y}.`, [3 * a + 2 * y, 3 * y - 2 * a], () => AL.subst2(a, y));
});
add('liketerms', 'algebra', 'Collect like terms', (r) => {
  const [a, b, c, d] = [r.int(2, 9), r.int(1, 9), r.int(-6, 6) || 2, r.int(-9, 9) || 3];
  const ans = lin(a + c, b + d);
  const m: Made = choice(`${lin(a, b)} ${c < 0 ? '−' : '+'} ${Math.abs(c) === 1 ? '' : Math.abs(c)}x ${d < 0 ? '−' : '+'} ${Math.abs(d)} = ?`, ans, [lin(a + c, b - d), lin(a - c, b + d), lin(a + c + b + d, 0), lin(a + b, c + d)], r, 'Add the x terms; add the numbers.');
  m.teach = () => AL.likeTerms(a, b, c, d);
  return m;
}, { format: 'choice' });
add('expand1', 'algebra', 'Expand a single bracket', (r) => {
  const k = r.pick([2, 3, 4, 5, 6, -2, -3]);
  const a = r.int(1, 5);
  const b = r.int(-9, 9) || 4;
  const inner = lin(a, b);
  return taught(choice(`${signed(k)}(${inner}) = ?`, lin(k * a, k * b), [lin(k * a, b), lin(a, k * b), lin(k * a, -k * b), lin(k + a, k + b)], r, `Multiply both terms by ${signed(k)}.`), () => AL.expandSingle(k, a, b));
}, { format: 'choice' });
add('eq1', 'algebra', 'One-step equations', (r) => {
  const x = r.int(-9, 15);
  const kind = r.int(0, 3);
  const a = r.int(2, 12);
  const t = () => AL.eqOneStep(kind as 0 | 1 | 2 | 3, a, x);
  if (kind === 0) return q(`x + ${a} = ${x + a}. x = ?`, x, r, `Take ${a} from both sides.`, [x + 2 * a], t);
  if (kind === 1) return q(`x − ${a} = ${x - a}. x = ?`, x, r, `Add ${a} to both sides.`, [x - 2 * a], t);
  if (kind === 2) return q(`${a}x = ${a * x}. x = ?`, x, r, `Divide both sides by ${a}.`, [a * x - a], t);
  return q(`x ÷ ${a} = ${x}. x = ?`, a * x, r, `Multiply both sides by ${a}.`, [x], t);
});
add('eq2', 'algebra', 'Two-step equations', (r) => {
  const x = r.int(-6, 12);
  const a = r.int(2, 9);
  const b = r.int(-15, 15) || 5;
  return q(`${lin(a, b)} = ${a * x + b}. x = ?`, x, r, `Undo ${b < 0 ? '−' : '+'} ${Math.abs(b)} first, then ÷ ${a}.`, [Math.round((a * x + 2 * b) / a), x + 1], () => AL.eqTwoStep(a, b, a * x + b));
});
add('eqboth', 'algebra', 'Unknowns on both sides', (r) => {
  const x = r.int(-5, 10);
  const c = r.int(1, 6);
  const a = c + r.int(1, 5);
  const b = r.int(-10, 10);
  const d = (a - c) * x + b;
  return q(`${lin(a, b)} = ${lin(c, d)}. x = ?`, x, r, `Take ${c}x from both sides: ${lin(a - c, b)} = ${d}.`, [-x, x + 1], () => AL.eqBoth(a, b, c, d));
});
add('eqbrack', 'algebra', 'Equations with brackets', (r) => {
  const x = r.int(-4, 10);
  const k = r.int(2, 6);
  const b = r.int(-6, 8) || 2;
  return q(`${k}(${lin(1, b)}) = ${k * (x + b)}. x = ?`, x, r, `Divide by ${k} first: ${lin(1, b)} = ${x + b}.`, [x + b, k * x], () => AL.eqBracket(k, b, k * (x + b)));
});
add('ineq', 'algebra', 'Simple inequalities', (r) => {
  const x = r.int(-3, 9);
  const a = r.int(2, 6);
  const b = r.int(-8, 8);
  const ans = `x > ${signed(x)}`;
  return taught(choice(`Solve ${lin(a, b)} > ${a * x + b}`, ans, [`x < ${signed(x)}`, `x > ${signed(a * x + b)}`, `x > ${signed(x + 1)}`, `x < ${signed(-x)}`], r, `Solve it like an equation: take ${b < 0 ? '−' : ''}${Math.abs(b)}, then ÷ ${a}.`), () => AL.ineqLesson(a, b, a * x + b));
}, { format: 'choice' });
add('wordeq', 'word', 'Word problems to equations', (r) => {
  const who = name(r);
  const x = r.int(3, 20);
  const k = r.int(2, 5);
  const p = r.int(2, 15);
  return r.chance(0.5)
    ? q(`${who} thinks of a number, multiplies by ${k} and adds ${p}. The answer is ${k * x + p}. The number?`, x, r, `${k}n + ${p} = ${k * x + p}.`, [k * x + p - p, x + p], () => AL.thinkNumber(k, p, k * x + p))
    : q(`A pen costs ₹${p} more than a pencil. Together they cost ₹${2 * x + p}. The pencil costs?`, x, r, `x + (x + ${p}) = ${2 * x + p}.`, [x + p, Math.round((2 * x + p) / 2)], () => AL.penPencil(p, 2 * x + p));
}, { format: 'pad', speedSec: 30 });
add('nth', 'algebra', 'Linear sequences: nth term', (r) => {
  const d = r.int(2, 9) * (r.chance(0.2) ? -1 : 1);
  const c = r.int(-6, 10);
  const terms = [1, 2, 3, 4].map((n) => d * n + c);
  if (r.chance(0.5)) return taught(choice(`nth term of ${terms.join(', ')}, …?`, lin(d, c, 'n'), [lin(c, d, 'n'), lin(d, terms[0], 'n'), lin(d, c + d, 'n'), lin(1, d, 'n')], r, `It goes up by ${d}, so ${d}n…, then adjust.`), () => AL.nthRule(terms, d, c));
  const n = r.int(10, 50);
  return q(`${terms.join(', ')}, … What is term ${n}?`, d * n + c, r, `The rule is ${lin(d, c, 'n')}.`, [d * n, d * (n - 1) + c], () => AL.nthValue(terms, d, c, n));
}, { format: 'choice' });

// ── Money and percent ──────────────────────────────────────────────────────
add('pctchange', 'fdp', 'Percentage change', (r) => {
  const old = 20 * r.int(2, 25);
  const p = r.pick([5, 10, 15, 20, 25, 30, 40, 50]);
  const up = r.chance(0.5);
  const nw = old + ((up ? 1 : -1) * old * p) / 100;
  return q(`${old} ${up ? 'rises' : 'falls'} to ${num(nw)}. Percentage change?`, p, r, `Change ÷ original × 100: ${num(Math.abs(nw - old))} ÷ ${old}.`, [Math.round((Math.abs(nw - old) / nw) * 100)], () => PC.pctChangeLesson(old, nw));
}, { format: 'pad' });
add('reversepct', 'fdp', 'Reverse percentages', (r) => {
  const orig = 20 * r.int(2, 30);
  const p = r.pick([10, 20, 25, 50]);
  const up = r.chance(0.5);
  const now = orig * (1 + ((up ? 1 : -1) * p) / 100);
  return q(`After a ${p}% ${up ? 'increase' : 'decrease'}, a price is ₹${num(now)}. The original?`, orig, r, `₹${num(now)} is ${up ? 100 + p : 100 - p}% of the original.`, [Math.round(now * (1 + ((up ? -1 : 1) * p) / 100))], () => PC.reversePctLesson(now, p, up));
}, { format: 'pad', speedSec: 25 });
add('profit', 'word', 'Profit and loss', (r) => {
  const cost = 50 * r.int(2, 20);
  const p = r.pick([10, 20, 25, 30, 40]);
  const profit = r.chance(0.6);
  const sell = cost * (1 + ((profit ? 1 : -1) * p) / 100);
  return r.chance(0.5)
    ? q(`Bought for ₹${cost}, sold for ₹${num(sell)}. ${profit ? 'Profit' : 'Loss'} %?`, p, r, `${profit ? 'Profit' : 'Loss'} ÷ cost price × 100.`, [Math.round((Math.abs(sell - cost) / sell) * 100)], () => PC.pctChangeLesson(cost, sell, { base: 'cost price', word: profit ? 'profit' : 'loss', money: true }))
    : q(`Bought for ₹${cost}, sold at a ${p}% ${profit ? 'profit' : 'loss'}. Selling price?`, sell, r, `${p}% of ${cost} = ${(cost * p) / 100}.`, [cost * (1 + ((profit ? -1 : 1) * p) / 100)], () => PC.pctChangePrice(cost, p, profit, { what: profit ? 'the profit' : 'the loss', label: 'selling price' }));
}, { format: 'pad', speedSec: 25 });
add('discount', 'word', 'Discount', (r) => {
  const mrp = 100 * r.int(2, 30);
  const p = r.pick([10, 15, 20, 25, 30, 40, 50]);
  return q(`A ₹${mrp} jacket has ${p}% off. Sale price?`, mrp - (mrp * p) / 100, r, `${p}% of ${mrp} = ${(mrp * p) / 100}.`, [(mrp * p) / 100, mrp - p], () => PC.pctChangePrice(mrp, p, false, { what: 'the discount', label: 'sale price' }));
}, { format: 'pad', speedSec: 20 });
add('simpleint', 'word', 'Simple interest', (r) => {
  const P = 1000 * r.int(1, 20);
  const R = r.pick([4, 5, 6, 8, 10, 12]);
  const T = r.int(1, 5);
  const I = (P * R * T) / 100;
  return q(`Simple interest on ₹${P} at ${R}% a year for ${T} year${T > 1 ? 's' : ''}?`, I, r, 'I = P × R × T ÷ 100.', [(P * R) / 100, P + I], () => PC.simpleInterestLesson(P, R, T));
}, { format: 'pad', speedSec: 25 });
add('compound', 'word', 'Compound interest (1–2 years)', (r) => {
  const P = 1000 * r.int(1, 10);
  const R = r.pick([5, 10, 20]);
  const T = r.int(1, 2);
  const A = clean(P * (1 + R / 100) ** T);
  return q(`₹${P} at ${R}% compound interest for ${T} year${T > 1 ? 's' : ''}. Amount?`, A, r, `Multiply by ${1 + R / 100} each year.`, [P + (P * R * T) / 100, A - P], () => PC.compoundLesson(P, R, T));
}, { format: 'pad', speedSec: 30 });
add('gst', 'word', 'Adding GST', (r) => {
  const price = 100 * r.int(1, 40);
  const g = r.pick([5, 12, 18, 28]);
  return q(`₹${price} + ${g}% GST = ?`, price + (price * g) / 100, r, `${g}% of ${price} = ${(price * g) / 100}.`, [(price * g) / 100, price + g], () => PC.pctChangePrice(price, g, true, { what: 'the GST', label: 'price with GST' }));
}, { format: 'pad', speedSec: 20 });
add('successive', 'fdp', 'Successive percentages', (r) => {
  const a = r.pick([10, 20, 25, 50]);
  const b = r.pick([10, 20, 25]);
  const kind = r.int(0, 1);
  if (kind === 0) {
    const net = clean((1 + a / 100) * (1 - b / 100) * 100 - 100);
    return q(`Up ${a}%, then down ${b}%. Overall change in %? (− for a fall)`, net, r, `× ${1 + a / 100} × ${1 - b / 100}.`, [a - b, clean(a - b - (a * b) / 100 + 1)], () => PC.netChangeLesson([a, -b]));
  }
  const price = 400;
  const final = clean(price * (1 - a / 100) * (1 - b / 100));
  return q(`₹${price}, then ${a}% off, then another ${b}% off. Final price?`, final, r, 'Apply each discount to the new price.', [price * (1 - (a + b) / 100)], () => PC.twoDiscounts(price, a, b));
}, { speedSec: 30 });

// ── Rational numbers ───────────────────────────────────────────────────────
add('rationals', 'fdp', 'Operations on rationals', (r) => {
  const [a, b] = [r.int(1, 7) * (r.chance(0.5) ? -1 : 1), r.int(2, 9)];
  const [c, d] = [r.int(1, 7) * (r.chance(0.5) ? -1 : 1), r.int(2, 9)];
  const op = r.pick(['+', '×'] as const);
  const ans = op === '+' ? frac(a * d + c * b, b * d) : frac(a * c, b * d);
  const show = (n: number, m: number) => (n < 0 ? `(−${-n}/${m})` : `${n}/${m}`);
  const wrong = op === '+' ? [frac(a + c, b + d), frac(a * d - c * b, b * d), frac(-(a * d + c * b), b * d)] : [frac(-a * c, b * d), frac(a * d, b * c), frac(a + c, b * d)];
  const v = valueOf(ans);
  return { prompt: `${show(a, b)} ${op} ${show(c, d)} = ?`, answer: ans, distractors: uniqueWrong(ans, wrong.filter((w) => Math.abs(valueOf(w) - v) > 1e-9), () => frac(r.int(-20, 20) || 1, b * d)).filter((w) => Math.abs(valueOf(w) - v) > 1e-9), hint: op === '+' ? `Common denominator ${lcm(b, d)}.` : 'Multiply tops and bottoms; mind the signs.', teach: () => FO.signedFracLesson(a, b, c, d, op) };
});
add('negfrac', 'fdp', 'Negative fractions', (r) => {
  const b = r.int(2, 9);
  const a = r.int(1, b - 1);
  const d = r.int(2, 9);
  const c = r.int(1, d - 1);
  const ans = frac(-a * d - c * b, b * d);
  return { prompt: `−${a}/${b} − ${c}/${d} = ?`, answer: ans, distractors: uniqueWrong(ans, [frac(a * d + c * b, b * d), frac(-a * d + c * b, b * d), frac(-(a + c), b + d)].filter((w) => w !== ans), () => frac(-r.int(1, 20), b * d)), hint: 'Both go down: add the sizes, keep the minus.', teach: () => FO.negFracLesson(a, b, c, d) };
});
add('bodmaspow', 'algebra', 'BODMAS with powers and negatives', (r) => {
  const a = r.int(2, 6);
  const b = r.int(2, 9);
  const c = r.int(2, 5);
  const kind = r.int(0, 2);
  if (kind === 0) return q(`${b} + ${a}² × ${c} = ?`, b + a * a * c, r, `Power first: ${a}² = ${a * a}.`, [(b + a * a) * c, b + 2 * a * c], () => E.evalLesson(`${b} + ${a}² × ${c}`));
  if (kind === 1) return q(`(−${a})² − ${b} = ?`, a * a - b, r, `(−${a})² = ${a * a}: a negative squared is positive.`, [-(a * a) - b], () => E.evalLesson(`(−${a})² − ${b}`));
  return q(`−${a}² + ${b} = ?`, -(a * a) + b, r, `Only ${a} is squared: −(${a * a}) + ${b}.`, [a * a + b], () => E.evalLesson(`−${a}² + ${b}`));
});

// ── Number ─────────────────────────────────────────────────────────────────
add('stdform', 'number', 'Standard form (large numbers)', (r) => {
  const m = r.int(11, 99) / 10;
  const e = r.int(3, 9);
  const n = Math.round(m * 10 ** e);
  if (r.chance(0.5)) {
    const ans = `${num(m)} × 10${sup(e)}`;
    return taught(choice(`${n.toLocaleString('en-US')} in standard form = ?`, ans, [`${num(m)} × 10${sup(e + 1)}`, `${num(m)} × 10${sup(e - 1)}`, `${Math.round(m * 10)} × 10${sup(e)}`, `${num(m / 10)} × 10${sup(e)}`], r, 'One digit before the point, then count the jumps.'), () => X.stdFormLesson(n, m, e));
  }
  return { prompt: `${num(m)} × 10${sup(e)} has how many digits?`, answer: String(e + 1), distractors: [String(e), String(e + 2), String(e - 1)], hint: `It is ${n.toLocaleString('en-US')}.`, teach: () => X.stdDigitsLesson(m, e) };
}, { format: 'choice' });
add('hcflcmword', 'word', 'HCF/LCM word problems', (r) => {
  if (r.chance(0.5)) {
    const a = r.pick([4, 6, 8, 9, 10, 12, 15]);
    let b = r.pick([6, 8, 10, 12, 14, 15, 20]);
    if (b === a) b += 2;
    return q(`One bus comes every ${a} minutes, another every ${b}. Both left at 9:00. In how many minutes do they next leave together?`, lcm(a, b), r, 'Find the LCM.', [a * b === lcm(a, b) ? a + b : a * b, gcd(a, b)], () => NU.lcmLesson(a, b, { intro: 'They leave together again after a number of minutes that is in both times tables: the lowest common multiple (LCM).', end: `So they next leave together after ${lcm(a, b)} minutes.` }));
  }
  const g = r.int(3, 12);
  const a = g * r.int(2, 6);
  let b = g * r.int(2, 6);
  if (b === a) b += g;
  return q(`${a} red and ${b} blue beads go into identical bags with none left over. Most bags possible?`, gcd(a, b), r, 'Find the HCF.', [lcm(a, b), g === gcd(a, b) ? g * 2 : g], () => NU.hcfLesson(a, b, { intro: `Identical bags means the ${a} red beads and the ${b} blue beads both share equally between the bags. So the number of bags must divide both: the highest common factor (HCF).`, end: `So the most bags is ${gcd(a, b)}.` }));
}, { format: 'pad', speedSec: 30 });
add('ratio3', 'fdp', 'Three-part ratios', (r) => {
  const [a, b, c] = [r.int(1, 5), r.int(1, 5), r.int(1, 5)];
  const unit = r.int(2, 20);
  const total = (a + b + c) * unit;
  return q(`Share ${total} in the ratio ${a}:${b}:${c}. The middle share (${b} parts)?`, b * unit, r, `${a + b + c} parts = ${total}, so 1 part = ${unit}.`, [unit, a * unit === b * unit ? c * unit + unit : a * unit], () => R.shareRatio(total, [a, b, c], 1, { what: 'The middle share' }));
}, { format: 'pad' });
add('proportion', 'word', 'Direct and inverse proportion', (r) => {
  if (r.chance(0.5)) {
    const n = r.int(2, 8);
    const each = r.int(5, 60);
    const m = r.int(3, 15);
    return q(`${n} kg of apples cost ₹${n * each}. Cost of ${m} kg?`, m * each, r, 'Direct: more kg, more cost.', [each, n * each + m], () => R.unitaryLesson(n, n * each, m, { item: 'kg', unitWord: '1 kg' }));
  }
  const workers = r.pick([2, 3, 4, 5, 6]);
  const days = r.pick([4, 6, 8, 10, 12]);
  const total = workers * days;
  const w2 = r.pick([2, 3, 4, 6, 8, 12].filter((x) => total % x === 0 && x !== workers));
  return q(`${workers} painters take ${days} days. How many days for ${w2} painters?`, total / w2, r, `Inverse: total work = ${total} painter-days.`, [(days * w2) / workers], () => R.inverseLesson(workers, days, w2));
}, { format: 'pad', speedSec: 25 });
add('sdt', 'word', 'Speed, distance and time', (r) => {
  const s = 5 * r.int(4, 24);
  const t = r.pick([0.5, 1, 1.5, 2, 2.5, 3, 4]);
  const d = s * t;
  const kind = r.int(0, 2);
  if (kind === 0) return q(`A car goes ${s} km/h for ${num(t)} h. Distance in km?`, d, r, 'Distance = speed × time.', [s + t, s / t], () => R.sdtLesson('d', s, t));
  if (kind === 1) return q(`${num(d)} km in ${num(t)} h. Speed in km/h?`, s, r, 'Speed = distance ÷ time.', [d * t], () => R.sdtLesson('s', s, t));
  return q(`${num(d)} km at ${s} km/h. Time in hours?`, t, r, 'Time = distance ÷ speed.', [clean(t * 2), clean(t + 1)], () => R.sdtLesson('t', s, t));
}, { speedSec: 25 });
add('avgmissing', 'mental', 'Averages with a missing value', (r) => {
  const n = r.int(4, 6);
  const mean = r.int(8, 40);
  const known = Array.from({ length: n - 1 }, () => mean + r.int(-8, 8));
  const missing = mean * n - known.reduce((a, b) => a + b, 0);
  return q(`The average of ${n} numbers is ${mean}. ${n - 1} of them are ${known.join(', ')}. What is the last one?`, missing, r, `Total must be ${mean} × ${n} = ${mean * n}.`, [mean, missing + n], () => R.missingMeanLesson(n, mean, known));
}, { format: 'pad', speedSec: 30 });

// ── Mental ─────────────────────────────────────────────────────────────────
add('sq2130', 'mental', 'Squares 21–30', (r) => {
  const n = r.int(21, 30);
  return { ...q(`${n}² = ?`, n * n, r, `${n}² = ${n - (n % 10)}² + 2 × ${n - (n % 10)} × ${n % 10} + ${n % 10}².`, [n * n - 10, (n - 1) ** 2], () => X.squareLesson(n)), speak: `${n} squared equals what?` };
}, { format: 'pad' });
add('x11any', 'mental', '× 11 for any 2-digit number', (r) => {
  const a = 10 * r.int(4, 9) + r.int(6, 9);
  return q(`${a} × 11 = ?`, a * 11, r, `Digits ${Math.floor(a / 10)} and ${a % 10}: their sum ${Math.floor(a / 10) + (a % 10)} carries into the hundreds.`, [a * 11 - 100, a * 10], () => T.x11(a));
}, { format: 'pad' });
add('x525125', 'mental', '× 5, × 25 and × 125 tricks', (r) => {
  const m = r.pick([5, 25, 125]);
  const k = m === 5 ? 2 : m === 25 ? 4 : 8;
  const a = k * (m === 5 ? r.int(8, 49) : r.int(3, 40));
  return q(`${a} × ${m} = ?`, a * m, r, `× ${m} = × ${m * k} ÷ ${k}.`, [a * m * 2, a * (m + 5)], () => MT.timesFriendly(a, m));
}, { format: 'pad' });
add('div525', 'mental', '÷ 5 and ÷ 25 tricks', (r) => {
  const m = r.pick([5, 25]);
  const a = m * r.int(5, 80);
  return q(`${a} ÷ ${m} = ?`, a / m, r, `÷ ${m} = × ${100 / m} ÷ 100.`, [a / (m * 2), (a * 2) / m], () => MT.divFriendly(a, m));
}, { format: 'pad' });
add('pctshort', 'mental', 'Percent shortcuts', (r) => {
  const a = r.pick([8, 12, 16, 24, 36, 44, 48]);
  const b = 25 * r.int(1, 8);
  return q(`${a}% of ${b} = ?`, (a * b) / 100, r, `x% of y = y% of x: ${b}% of ${a} is easier.`, [(a * b) / 10, a + b], () => PC.pctSwapLesson(a, b));
}, { speedSec: 12 });
add('twostep6', 'word', 'Two-step word problems', (r) => {
  const who = name(r);
  const boxes = r.int(3, 9);
  const per = r.int(12, 48);
  const price = r.pick([2, 5, 10]);
  // Sell a real share of them (not 6 out of 60).
  const sold = r.int(Math.round(boxes * per * 0.3), Math.round(boxes * per * 0.85));
  return r.chance(0.5)
    ? q(`${who} buys ${boxes} boxes of ${per} chocolates and sells ${sold}. How many are left?`, boxes * per - sold, r, `${boxes} × ${per} = ${boxes * per}.`, [boxes * per + sold], () => W.boxesLeft(boxes, per, sold))
    : q(`${who} sells ${boxes} boxes of ${per} chocolates at ₹${price} each chocolate. Takings?`, boxes * per * price, r, `${boxes * per} chocolates × ₹${price}.`, [boxes * per, boxes * price], () => W.takings(boxes, per, price));
}, { format: 'pad', speedSec: 30 });
add('approx', 'mental', 'Estimation and approximation', (r) => {
  const a = r.int(21, 89) + r.int(1, 9) / 10;
  const b = r.int(11, 49) + r.int(1, 9) / 10;
  const c = r.pick([2, 4, 5, 10]);
  const ans = (Math.round(a / 10) * 10 * Math.round(b / 10) * 10) / c;
  return { prompt: `Estimate ${num(a)} × ${num(b)} ÷ ${c} (round to 1 significant figure)`, answer: num(ans), distractors: uniqueWrong(num(ans), [ans * 10, ans / 10, ans * 2, ans + 100].map((x) => num(clean(x))), () => num(ans + 50)), hint: `${num(a)} ≈ ${Math.round(a / 10) * 10}, ${num(b)} ≈ ${Math.round(b / 10) * 10}.`, teach: () => MT.estimateProduct(a, b, 10, 10, { div: c }) };
}, { format: 'choice' });
add('digitsum', 'mental', 'Digit-sum checks', (r) => {
  const a = r.int(12, 99);
  const b = r.int(12, 99);
  const right = a * b;
  const wrong = [right + 9 * r.int(1, 3) + r.int(1, 8), right + 10, right - 1].filter((w) => w % 9 !== right % 9);
  return { prompt: `${a} × ${b}: which answer passes the digit-sum check?`, answer: num(right), distractors: wrong.map(num), hint: `Digit sum of ${a} × digit sum of ${b} should match the answer's digit sum (mod 9).`, teach: () => NU.digitSumChoice(a, b, [right, ...wrong]) };
}, { format: 'choice', speedSec: 20 });
const SPEED = ['cubes', 'sqrt', 'cbrt', 'zeroneg', 'sq2130', 'x11any', 'x525125', 'div525', 'discount', 'pctshort'];
add('speed6', 'mental', 'Speed mix', (r, d) => {
  const id = `s6.${r.pick(SPEED)}`;
  return list.find((x) => x.id === id)!.make(r, d);
}, { speedSec: 10 });
