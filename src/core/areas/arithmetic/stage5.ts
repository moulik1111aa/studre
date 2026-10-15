// Stage 5 — Fraction Explorer (ages 11–12). All four operations with fractions and decimals,
// percentages, ratio, integers, BODMAS and number theory.

import { stageSkills, NAMES } from '../../skill.ts';
import { clean, frac, gcd, lcm, lerp, nearNumbers, num, uniqueWrong, valueOf, type Made } from '../../question.ts';
import type { Rng } from '../../rng.ts';

const { list, add } = stageSkills('arithmetic', 5, { format: 'pad-ext', speedSec: 12 });
export const STAGE5 = list;

const q = (prompt: string, answer: number, r: Rng, hint?: string, extras: number[] = [], min?: number): Made => ({
  prompt,
  answer: num(answer),
  distractors: nearNumbers(r, answer, extras, min === undefined ? {} : { min }),
  hint,
});
const name = (r: Rng): string => r.pick(NAMES);

/** Wrong options that differ in value from the answer. */
function wrongVals(r: Rng, answer: string, cands: string[], fallback: () => string): string[] {
  const v = valueOf(answer);
  const ok = (s: string) => Number.isFinite(valueOf(s)) && Math.abs(valueOf(s) - v) > 1e-9;
  return uniqueWrong(answer, cands.filter(ok), () => {
    for (let i = 0; i < 20; i++) {
      const c = fallback();
      if (ok(c)) return c;
    }
    return num(v + 1);
  });
}
const fracWrong = (r: Rng, answer: string, cands: [number, number][], den: number) =>
  wrongVals(r, answer, cands.filter(([, d]) => d !== 0).map(([n, d]) => frac(n, d)), () => frac(r.int(1, 2 * den), den));
const decWrong = (r: Rng, answer: number, step: number, extras: number[] = []) =>
  wrongVals(r, num(answer), [...extras, answer + step, answer - step, answer * 10, answer / 10, answer + 10 * step].map((x) => num(clean(x))), () => num(clean(answer + step * r.int(2, 9))));

/** A proper fraction with denominator in [lo, hi]. */
function properFrac(r: Rng, lo: number, hi: number): [number, number] {
  const d = r.int(lo, hi);
  return [r.int(1, d - 1), d];
}
/** Mixed-number string for a positive fraction n/d. */
function mixedStr(n: number, d: number): string {
  const g = gcd(n, d);
  n /= g;
  d /= g;
  const w = Math.floor(n / d);
  const rem = n % d;
  if (rem === 0) return String(w);
  return w ? `${w} ${rem}/${d}` : `${rem}/${d}`;
}

// ── Fractions ──────────────────────────────────────────────────────────────
add('simplify', 'fdp', 'Simplify', (r) => {
  const [n, d] = properFrac(r, 2, 9);
  const g = gcd(n, d);
  const m = r.int(2, 6);
  const ans = frac(n, d);
  const N = (n / g) * m;
  const D = (d / g) * m;
  return { prompt: `Simplify ${N}/${D}`, answer: ans, distractors: uniqueWrong(ans, [`${N / m}/${D}`, `${N}/${D / m}`, `${n / g + 1}/${d / g}`, `${N / 2}/${D / 2}`].filter((s) => !s.includes('.')), () => `${r.int(1, 9)}/${r.int(2, 12)}`).filter((s) => s !== `${N}/${D}`), hint: `Divide top and bottom by ${g * m}, the biggest number that divides both.`, exactForm: true };
});
add('cmpunlike', 'fdp', 'Compare unlike fractions', (r) => {
  const [a, b] = properFrac(r, 2, 9);
  let [c, d] = properFrac(r, 2, 9);
  if (a * d === b * c) [c, d] = [c, d + 1];
  const bigA = a / b > c / d;
  const ans = bigA ? `${a}/${b}` : `${c}/${d}`;
  return { prompt: `Bigger: ${a}/${b} or ${c}/${d}?`, answer: ans, distractors: [bigA ? `${c}/${d}` : `${a}/${b}`], hint: `Make the bottoms the same: ${lcm(b, d)}.` };
}, { format: 'choice' });
const addSub = (sub: boolean) => (r: Rng, d0: number): Made => {
  const [a, b] = properFrac(r, 2, lerp(5, 10, d0));
  let [c, d] = properFrac(r, 2, lerp(5, 10, d0));
  if (b === d) d = d + 1 > 10 ? d - 1 : d + 1;
  if (c >= d) c = d - 1;
  let [x1, y1, x2, y2] = [a, b, c, d];
  if (sub && x1 / y1 < x2 / y2) [x1, y1, x2, y2] = [c, d, a, b];
  if (sub && x1 * y2 === x2 * y1) x1 = Math.min(y1 - 1, x1 + 1) || x1;
  const num_ = sub ? x1 * y2 - x2 * y1 : x1 * y2 + x2 * y1;
  const ans = frac(num_, y1 * y2);
  return {
    prompt: `${x1}/${y1} ${sub ? '−' : '+'} ${x2}/${y2} = ?`,
    answer: ans,
    distractors: fracWrong(r, ans, [[sub ? x1 - x2 : x1 + x2, sub ? Math.abs(y1 - y2) || 1 : y1 + y2], [num_ + 1, y1 * y2], [num_, y1 + y2], [sub ? x1 - x2 : x1 + x2, y1 * y2]], y1 * y2),
    hint: `Common bottom ${lcm(y1, y2)}: rewrite both fractions first.`,
  };
};
add('addunlike', 'fdp', 'Add unlike fractions', addSub(false));
add('subunlike', 'fdp', 'Subtract unlike fractions', addSub(true));
const mixedAS = (sub: boolean) => (r: Rng): Made => {
  const d = r.pick([2, 3, 4, 5, 6, 8]);
  const w1 = r.int(2, 6);
  const w2 = r.int(1, w1 - 1);
  const n1 = r.int(1, d - 1);
  const n2 = r.int(1, d - 1);
  const A = w1 * d + n1;
  const B = w2 * d + n2;
  const N = sub ? A - B : A + B;
  const ans = mixedStr(N, d);
  return {
    prompt: `${w1} ${n1}/${d} ${sub ? '−' : '+'} ${w2} ${n2}/${d} = ?`,
    answer: ans,
    distractors: wrongVals(r, ans, [mixedStr(N + d, d), mixedStr(Math.max(1, N - d), d), mixedStr(N + 1, d), mixedStr(Math.max(1, N - 1), d)], () => mixedStr(r.int(1, 8 * d), d)),
    hint: sub ? 'Subtract the wholes, then the fractions — borrow a whole if you need to.' : 'Add the wholes, add the fractions, then tidy up.',
  };
};
add('addmixed', 'fdp', 'Add mixed numbers', mixedAS(false), { format: 'choice' });
add('submixed', 'fdp', 'Subtract mixed numbers', mixedAS(true), { format: 'choice' });
add('fxwhole', 'fdp', 'Fraction × whole', (r) => {
  const [n, d] = properFrac(r, 2, 9);
  const w = r.int(2, 12);
  const ans = frac(n * w, d);
  return { prompt: `${n}/${d} × ${w} = ?`, answer: ans, distractors: fracWrong(r, ans, [[n * w, d * w], [n + w, d], [n, d * w], [n * w + 1, d]], d), hint: `Multiply the top by ${w}: ${n * w}/${d}.` };
});
add('fxf', 'fdp', 'Fraction × fraction', (r) => {
  const [a, b] = properFrac(r, 2, 9);
  const [c, d] = properFrac(r, 2, 9);
  const ans = frac(a * c, b * d);
  return { prompt: `${a}/${b} × ${c}/${d} = ?`, answer: ans, distractors: fracWrong(r, ans, [[a + c, b + d], [a * d, b * c], [a * c, b + d], [a * c + 1, b * d]], b * d), hint: 'Tops times tops, bottoms times bottoms.' };
});
add('wdivf', 'fdp', 'Whole ÷ fraction', (r) => {
  const d = r.int(2, 8);
  const n = r.chance(0.6) ? 1 : r.int(1, d - 1);
  const w = n * r.int(1, 6);
  const ans = frac(w * d, n);
  return { prompt: `${w} ÷ ${n}/${d} = ?`, answer: ans, distractors: fracWrong(r, ans, [[w * n, d], [w, d * n], [w * d + 1, n], [w * d * 2, n]], n), hint: `Dividing by ${n}/${d} is multiplying by ${d}/${n}.` };
});
add('fdivf', 'fdp', 'Fraction ÷ fraction', (r) => {
  const [a, b] = properFrac(r, 2, 8);
  const [c, d] = properFrac(r, 2, 8);
  const ans = frac(a * d, b * c);
  return { prompt: `${a}/${b} ÷ ${c}/${d} = ?`, answer: ans, distractors: fracWrong(r, ans, [[a * c, b * d], [b * c, a * d], [a * d + 1, b * c], [a, b * c]], b * c), hint: `Keep, change, flip: ${a}/${b} × ${d}/${c}.` };
});
add('fracqty', 'word', 'Multi-step fraction of a quantity', (r) => {
  const d1 = r.pick([2, 3, 4, 5]);
  const d2 = r.pick([2, 3, 4]);
  const total = d1 * d2 * r.int(2, 8);
  const spent = total / d1;
  const rest = total - spent;
  const ans = rest - rest / d2;
  return q(`${name(r)} has ₹${total}. They spend 1/${d1} on a book, then 1/${d2} of what is left on lunch. How much is left?`, ans, r, `After the book: ₹${rest}. Then take away 1/${d2} of ${rest}.`, [rest, total - total / d2]);
}, { format: 'pad', speedSec: 30 });

// ── Decimals ───────────────────────────────────────────────────────────────
add('dec2as', 'fdp', 'Add/subtract 2-dp decimals', (r) => {
  const a = r.int(100, 2000) / 100;
  const b = r.int(1, Math.round(a * 100) - 1) / 100;
  const sub = r.chance(0.5);
  const ans = clean(sub ? a - b : a + b);
  return { prompt: `${a.toFixed(2)} ${sub ? '−' : '+'} ${b.toFixed(2)} = ?`, answer: num(ans), distractors: decWrong(r, ans, 0.1, [clean(ans + 0.01)]), hint: 'Line up the decimal points.' };
});
add('decxw', 'fdp', 'Decimal × whole', (r) => {
  const a = r.int(11, 99) / 10;
  const w = r.int(2, 9);
  const ans = clean(a * w);
  return { prompt: `${num(a)} × ${w} = ?`, answer: num(ans), distractors: decWrong(r, ans, 0.1, [clean(ans * 10)]), hint: `${Math.round(a * 10)} × ${w} = ${Math.round(a * 10) * w}, then one decimal place.` };
});
add('decxd', 'fdp', 'Decimal × decimal', (r) => {
  const a = r.int(2, 9) / 10;
  const b = r.int(2, 99) / 10;
  const ans = clean(a * b);
  return { prompt: `${num(a)} × ${num(b)} = ?`, answer: num(ans), distractors: decWrong(r, ans, 0.01, [clean(ans * 10), clean(ans / 10)]), hint: 'Multiply as whole numbers, then count the decimal places in both.' };
});
add('decdivw', 'fdp', 'Decimal ÷ whole', (r) => {
  const w = r.int(2, 9);
  const ans = r.int(11, 99) / 10;
  const a = clean(ans * w);
  return { prompt: `${num(a)} ÷ ${w} = ?`, answer: num(ans), distractors: decWrong(r, ans, 0.1), hint: 'Divide as normal; keep the point in line.' };
});
add('divbydec', 'fdp', '÷ by a decimal', (r) => {
  const dv = r.pick([0.1, 0.2, 0.5, 0.25, 0.4, 1.5, 2.5]);
  const ans = r.int(2, 20);
  const a = clean(ans * dv);
  return { prompt: `${num(a)} ÷ ${num(dv)} = ?`, answer: num(ans), distractors: decWrong(r, ans, 1, [clean(a * dv), clean(ans / 10)]), hint: 'Multiply both numbers by 10 (or 100) until you divide by a whole number.' };
});
add('rounddec', 'fdp', 'Round decimals', (r) => {
  const x = r.int(1001, 99999) / 1000;
  const dp = r.pick([0, 1, 2]);
  const ans = clean(Math.round(x * 10 ** dp) / 10 ** dp);
  const label = dp === 0 ? 'the nearest whole number' : `${dp} decimal place${dp > 1 ? 's' : ''}`;
  return { prompt: `Round ${x} to ${label}`, answer: num(ans), distractors: decWrong(r, ans, 10 ** -dp, [clean(Math.floor(x * 10 ** dp) / 10 ** dp), clean(Math.ceil(x * 10 ** dp) / 10 ** dp)]), hint: 'Look at the next digit: 5 or more rounds up.' };
}, { format: 'choice' });
add('fracdec', 'fdp', 'Common fraction ↔ decimal', (r) => {
  const pairs: [string, string][] = [['1/8', '0.125'], ['3/8', '0.375'], ['5/8', '0.625'], ['1/20', '0.05'], ['3/20', '0.15'], ['1/25', '0.04'], ['7/20', '0.35'], ['1/50', '0.02'], ['9/25', '0.36'], ['3/4', '0.75'], ['2/5', '0.4'], ['7/8', '0.875']];
  const [f, dcm] = r.pick(pairs);
  const others = r.shuffle(pairs.filter((p) => p[0] !== f));
  return r.chance(0.5)
    ? { prompt: `${f} as a decimal = ?`, answer: dcm, distractors: uniqueWrong(dcm, others.map((p) => p[1]), () => '0.3') }
    : { prompt: `${dcm} as a fraction = ?`, answer: f, distractors: uniqueWrong(f, others.map((p) => p[0]), () => '1/3') };
}, { format: 'choice' });

// ── Percent ────────────────────────────────────────────────────────────────
add('pctfd', 'fdp', '% ↔ fraction ↔ decimal', (r) => {
  const p = r.pick([5, 10, 20, 25, 30, 40, 50, 60, 75, 80, 12.5, 35, 45, 90]);
  const kind = r.int(0, 2);
  if (kind === 0) return { prompt: `${p}% as a decimal = ?`, answer: num(p / 100), distractors: decWrong(r, p / 100, 0.1, [p / 10]), hint: '% means out of 100: divide by 100.' };
  if (kind === 1) return { prompt: `${p}% as a fraction = ?`, answer: frac(p * 2, 200), distractors: fracWrong(r, frac(p * 2, 200), [[p * 2, 20], [1, Math.round(100 / p) + 1], [p * 2 + 20, 200]], 10), hint: `${p}/100, then simplify.` };
  return q(`${num(p / 100)} = ?%`, p, r, 'Multiply by 100.', [p / 10, p * 10]);
});
add('pcteasy', 'fdp', '10%, 25% and 50% of', (r) => {
  const p = r.pick([10, 25, 50]);
  const n = (100 / p) * r.int(2, 40);
  return q(`${p}% of ${n} = ?`, (n * p) / 100, r, p === 10 ? '10% = ÷ 10.' : p === 25 ? '25% = ÷ 4.' : '50% = half.', [n / 10, n / 2, n / 4].filter((x) => x !== (n * p) / 100));
}, { format: 'pad' });
add('pctany', 'fdp', 'Any % of', (r) => {
  const p = r.pick([5, 15, 20, 30, 35, 40, 60, 70, 75, 80, 90]);
  const n = 20 * r.int(1, 25);
  const ans = (n * p) / 100;
  return q(`${p}% of ${n} = ?`, ans, r, `10% of ${n} is ${n / 10}. Build ${p}% from that.`, [n / 10, ans + n / 10]);
});
add('pcttotal', 'fdp', 'What percent of the total?', (r) => {
  const total = r.pick([20, 25, 40, 50, 80, 200]);
  const p = r.pick([10, 20, 25, 40, 50, 60, 75, 80]);
  const part = (total * p) / 100;
  if (!Number.isInteger(part)) return q(`${total / 2} out of ${total} = ?%`, 50, r, 'Half is 50%.', [25, 75]);
  return q(`${part} out of ${total} = ?%`, p, r, `${part}/${total}, then make it out of 100.`, [part, Math.round(100 - p)]);
});
add('pctinc', 'fdp', 'Simple percentage increase', (r) => {
  const p = r.pick([10, 20, 25, 50]);
  const price = 20 * r.int(2, 30);
  const up = r.chance(0.6);
  const ans = up ? price + (price * p) / 100 : price - (price * p) / 100;
  return q(`A ₹${price} toy ${up ? 'goes up' : 'is reduced'} by ${p}%. New price?`, ans, r, `${p}% of ${price} = ${(price * p) / 100}.`, [(price * p) / 100, up ? price - (price * p) / 100 : price + (price * p) / 100]);
}, { format: 'pad', speedSec: 20 });

// ── Ratio ──────────────────────────────────────────────────────────────────
add('ratiosimp', 'fdp', 'Simplify a ratio', (r) => {
  const a = r.int(1, 7);
  let b = r.int(1, 9);
  if (gcd(a, b) !== 1) b = a + 1;
  const m = r.int(2, 8);
  const ans = `${a}:${b}`;
  return { prompt: `Simplify ${a * m} : ${b * m}`, answer: ans, distractors: uniqueWrong(ans, [`${b}:${a}`, `${a + 1}:${b}`, `${a * 2}:${b * 2 + 1}`, `${a}:${b + 1}`], () => `${r.int(1, 9)}:${r.int(1, 9)}`), hint: `Divide both sides by ${m}.` };
}, { format: 'choice' });
add('ratioshare', 'word', 'Share in a ratio', (r) => {
  const a = r.int(1, 5);
  const b = r.int(1, 5) + (a === 1 ? 1 : 0);
  const unit = r.int(2, 15);
  const total = (a + b) * unit;
  const [n1, n2] = [name(r), name(r)];
  const big = Math.max(a, b) * unit;
  return q(`${n1} and ${n2 === n1 ? 'Dev' : n2} share ₹${total} in the ratio ${a}:${b}. The bigger share?`, a === b ? a * unit : big, r, `${a + b} parts make ${total}, so one part is ${unit}.`, [unit, Math.min(a, b) * unit, total / 2].filter((x) => x !== big));
}, { format: 'pad', speedSec: 20 });
add('unitary', 'word', 'Unitary method', (r) => {
  const n = r.int(2, 9);
  const each = r.int(3, 40);
  const m = r.int(2, 12);
  const item = r.pick(['pens', 'mangoes', 'notebooks', 'samosas', 'stickers']);
  return q(`${n} ${item} cost ₹${n * each}. How much for ${m}?`, m * each, r, `1 costs ₹${each}.`, [each, n * each + m]);
}, { format: 'pad', speedSec: 20 });
add('recipe', 'word', 'Scaling (recipes)', (r) => {
  const serves = r.pick([2, 4]);
  const want = serves * r.pick([2, 3]) / (r.chance(0.3) ? 2 : 1);
  const g = 50 * r.int(1, 8);
  const ans = (g * want) / serves;
  return q(`A recipe for ${serves} uses ${g} g of rice. How many grams for ${want}?`, ans, r, `${want} people is ${want / serves} times the recipe.`, [g + want, g * want]);
}, { format: 'pad', speedSec: 20 });

// ── Integers ───────────────────────────────────────────────────────────────
add('numline', 'number', 'Negatives on a number line', (r) => {
  const a = r.int(-10, 5);
  const step = r.int(2, 9);
  const right = r.chance(0.5);
  const ans = right ? a + step : a - step;
  return q(`Start at ${a}. Move ${step} to the ${right ? 'right' : 'left'}. Where are you?`, ans, r, 'Right is bigger, left is smaller.', [right ? a - step : a + step], -40);
});
const intOp = (op: '+' | '−' | '×' | '÷') => (r: Rng): Made => {
  const s = () => (r.chance(0.5) ? -1 : 1);
  let a = s() * r.int(1, 15);
  const b = s() * r.int(1, op === '×' || op === '÷' ? 9 : 15);
  let ans: number;
  if (op === '÷') {
    ans = s() * r.int(1, 9);
    a = ans * b;
  } else ans = op === '+' ? a + b : op === '−' ? a - b : a * b;
  const show = (x: number) => (x < 0 ? `(−${-x})` : String(x));
  const rule = op === '+' || op === '−' ? 'Use a number line; subtracting a negative is adding.' : 'Same signs give +, different signs give −.';
  return { prompt: `${a < 0 ? `−${-a}` : a} ${op} ${show(b)} = ?`, answer: num(ans), distractors: nearNumbers(r, ans, [-ans || 1, op === '−' ? a + b : op === '+' ? a - b : -ans], { min: -500 }), hint: rule };
};
add('intadd', 'number', 'Add integers', intOp('+'));
add('intsub', 'number', 'Subtract integers', intOp('−'));
add('intmul', 'number', 'Multiply integers', intOp('×'));
add('intdiv', 'number', 'Divide integers', intOp('÷'));

// ── Order of operations ────────────────────────────────────────────────────
add('bodmas', 'algebra', 'BODMAS without brackets', (r) => {
  const [a, b, c, d] = [r.int(2, 12), r.int(2, 9), r.int(2, 9), r.int(1, 20)];
  return r.chance(0.5)
    ? q(`${a} × ${b} − ${c} × ${d % 9 + 1} = ?`, a * b - c * (d % 9 + 1), r, 'Both × first, then −.', [(a * b - c) * (d % 9 + 1)], -200)
    : q(`${d} + ${a * b} ÷ ${b} − ${c} = ?`, d + a - c, r, '÷ first, then + and − from left to right.', [Math.round((d + a * b) / b) - c], -200);
});
add('brackets', 'algebra', 'BODMAS with brackets', (r) => {
  const [a, b, c] = [r.int(2, 15), r.int(2, 15), r.int(2, 9)];
  return r.chance(0.5)
    ? q(`(${a} + ${b}) × ${c} = ?`, (a + b) * c, r, 'Brackets first.', [a + b * c])
    : q(`${c} × (${a + b} − ${b}) = ?`, c * a, r, 'Brackets first.', [c * (a + b) - b]);
});

// ── Number theory ──────────────────────────────────────────────────────────
const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((i) => n % i === 0);
const isPrime = (n: number) => n > 1 && divisors(n).length === 2;
add('factors', 'muldiv', 'Factors', (r) => {
  const n = r.pick([24, 30, 36, 40, 42, 48, 54, 56, 60, 64, 72, 84, 90, 96, 100]);
  return r.chance(0.5)
    ? q(`How many factors does ${n} have?`, divisors(n).length, r, 'Pair them up: 1 × n, 2 × …')
    : { prompt: `Which is NOT a factor of ${n}?`, answer: num(r.pick(Array.from({ length: 20 }, (_, i) => i + 2).filter((i) => n % i !== 0))), distractors: r.shuffle(divisors(n).filter((x) => x > 1 && x < n)).slice(0, 3).map(num), hint: `A factor divides ${n} exactly.` };
}, { format: 'choice' });
add('multiples', 'muldiv', 'Multiples', (r) => {
  const n = r.int(6, 25);
  const k = r.int(3, 12);
  return r.chance(0.5)
    ? q(`The ${k}th multiple of ${n} = ?`, n * k, r, `${n} × ${k}.`, [n * (k + 1), n + k])
    : q(`Smallest multiple of ${n} bigger than ${n * k - r.int(1, n - 1)}?`, n * k, r, `Count in ${n}s.`, [n * k - n, n * k + n]);
}, { format: 'pad' });
add('primes', 'muldiv', 'Primes to 100', (r) => {
  const primes = Array.from({ length: 98 }, (_, i) => i + 2).filter(isPrime);
  const tricky = [21, 27, 33, 39, 49, 51, 57, 63, 69, 77, 81, 87, 91, 93, 99, 15, 45, 55, 65, 85];
  return r.chance(0.6)
    ? { prompt: 'Which is a prime number?', answer: num(r.pick(primes.filter((p) => p > 10))), distractors: r.shuffle(tricky).slice(0, 3).map(num), hint: 'A prime has exactly two factors: 1 and itself.' }
    : { prompt: 'Which is NOT prime?', answer: num(r.pick(tricky)), distractors: r.shuffle(primes.filter((p) => p > 10)).slice(0, 3).map(num), hint: 'Try dividing by 3, 7 and 11.' };
}, { format: 'choice' });
add('primefac', 'muldiv', 'Prime factorisation', (r) => {
  const ps = [2, 2, 2, 3, 3, 5, 7];
  const k = r.int(3, 4);
  const pick = r.shuffle(ps).slice(0, k).sort((a, b) => a - b);
  const n = pick.reduce((a, b) => a * b, 1);
  const ans = pick.join(' × ');
  const wrong = [
    [...pick.slice(0, -1), pick[pick.length - 1] + 2],
    [pick[0] * pick[1], ...pick.slice(2)],
    [...pick, 2],
    pick.map((p) => (p === 2 ? 3 : p === 3 ? 2 : p)),
  ].map((l) => l.sort((a, b) => a - b).join(' × '));
  return { prompt: `${n} as a product of primes = ?`, answer: ans, distractors: uniqueWrong(ans, wrong, () => `2 × ${r.int(3, 9)}`), hint: 'Keep dividing by the smallest prime that works.', exactForm: true };
}, { format: 'choice' });
add('hcf', 'muldiv', 'HCF', (r) => {
  const g = r.int(2, 12);
  let a = r.int(2, 9);
  let b = r.int(2, 9);
  if (gcd(a, b) !== 1) b = a + 1;
  if (a === b) a++;
  return q(`HCF of ${g * a} and ${g * b} = ?`, g, r, 'The biggest number that divides both.', [g * a, gcd(g * a, g * b) * 2]);
});
add('lcm', 'muldiv', 'LCM', (r) => {
  const a = r.int(2, 12);
  let b = r.int(2, 12);
  if (b === a) b++;
  const L = lcm(a, b);
  return q(`LCM of ${a} and ${b} = ?`, L, r, 'The smallest number both go into.', [a * b === L ? L * 2 : a * b, gcd(a, b)]);
});
add('div46811', 'number', 'Divisibility by 4, 6, 8 and 11', (r) => {
  const by = r.pick([4, 6, 8, 11]);
  const ans = by * r.int(15, 120);
  const wrong: number[] = [];
  while (wrong.length < 3) {
    const w = r.int(120, 999);
    if (w % by !== 0 && !wrong.includes(w)) wrong.push(w);
  }
  const rule: Record<number, string> = { 4: 'The last two digits divide by 4.', 6: 'Even, and the digits add to a multiple of 3.', 8: 'The last three digits divide by 8.', 11: 'Alternate digits: add, subtract, add — the result divides by 11.' };
  return { prompt: `Which divides exactly by ${by}?`, answer: num(ans), distractors: wrong.map(num), hint: rule[by] };
}, { format: 'choice' });

// ── Mental and mixed ───────────────────────────────────────────────────────
add('x999', 'mental', '× 9 and × 99 tricks', (r) => {
  const n = r.int(12, 99);
  const m = r.pick([9, 99]);
  return q(`${n} × ${m} = ?`, n * m, r, `× ${m} = × ${m + 1} then take away ${n}.`, [n * (m + 1), n * m + n], 0);
}, { format: 'pad' });
add('compens', 'mental', 'Compensation (+ near hundreds)', (r) => {
  const a = r.int(120, 800);
  const near = 100 * r.int(1, 4) + r.pick([-2, -1, 1, 2, -3, 3]);
  const sub = r.chance(0.5) && a > near;
  return q(`${a} ${sub ? '−' : '+'} ${near} = ?`, sub ? a - near : a + near, r, `Use ${Math.round(near / 100) * 100}, then adjust by ${Math.abs(near - Math.round(near / 100) * 100)}.`);
}, { format: 'pad' });
add('average', 'mental', 'Averages', (r) => {
  const n = r.int(3, 5);
  const mean = r.int(5, 40);
  const vals = Array.from({ length: n - 1 }, () => mean + r.int(-6, 6));
  vals.push(mean * n - vals.reduce((a, b) => a + b, 0));
  return q(`Average of ${r.shuffle(vals).join(', ')} = ?`, mean, r, `Add them (${mean * n}) and ÷ ${n}.`, [mean * n, mean + 1]);
}, { format: 'pad', speedSec: 20 });
add('estprod', 'mental', 'Estimate products', (r) => {
  const a = r.int(12, 98);
  const b = r.int(12, 98);
  const ans = Math.round(a / 10) * 10 * Math.round(b / 10) * 10;
  return { prompt: `About how much is ${a} × ${b}? (round each to tens)`, answer: num(ans), distractors: uniqueWrong(num(ans), [ans * 10, ans / 10, ans + 1000, a * b].map(num), () => num(ans + 100 * r.int(1, 9))), hint: `${a} ≈ ${Math.round(a / 10) * 10}, ${b} ≈ ${Math.round(b / 10) * 10}.` };
}, { format: 'choice' });
add('sq20', 'muldiv', 'Squares to 20²', (r) => {
  const n = r.int(11, 20);
  return { ...q(`${n}² = ?`, n * n, r, `${n} × ${n}. (${n}² = ${n}0 × ${n} − ${n} × ${10 - (n % 10 || 10)} … or just multiply!)`, [n * n - n, n * 2, (n - 1) * (n - 1)]), hint: `${n} × ${n}: try ${n} × 10 + ${n} × ${n - 10}.`, speak: `${n} squared equals what?` };
}, { format: 'pad' });
add('fpword', 'word', 'Fraction and percent word problems', (r) => {
  const who = name(r);
  const kind = r.int(0, 2);
  if (kind === 0) {
    const total = 40 * r.int(1, 10);
    const p = r.pick([10, 20, 25, 30, 40, 75]);
    return q(`${who}'s class has ${total} students. ${p}% walk to school. How many walk?`, (total * p) / 100, r, `${p}% of ${total}.`, [total - (total * p) / 100]);
  }
  if (kind === 1) {
    const d = r.pick([3, 4, 5, 6, 8]);
    const n = r.int(1, d - 1);
    const total = d * r.int(3, 12);
    return q(`${who} read ${n}/${d} of a ${total}-page book. How many pages are left?`, total - (total * n) / d, r, `Read: ${(total * n) / d}. Left: ${total} − that.`, [(total * n) / d]);
  }
  const score = r.int(12, 24);
  const out = r.pick([25, 30, 40, 50]);
  const pct = Math.round((score / out) * 100);
  if (Math.abs((score / out) * 100 - pct) > 1e-9) return q(`${who} scored ${out / 2} out of ${out}. What percent?`, 50, r, 'Half is 50%.', [25, out / 2]);
  return q(`${who} scored ${score} out of ${out}. What percent?`, pct, r, `${score}/${out} = ?/100.`, [score, 100 - pct]);
}, { format: 'pad', speedSec: 30 });
add('missingop', 'algebra', 'Missing-operation puzzles', (r) => {
  const a = r.int(2, 12);
  const b = r.int(2, 9);
  const op = r.pick(['+', '−', '×', '÷'] as const);
  const A = op === '÷' ? a * b : op === '−' ? a + b : a;
  const res = op === '+' ? A + b : op === '−' ? A - b : op === '×' ? A * b : A / b;
  const all = ['+', '−', '×', '÷'];
  const results: Record<string, number> = { '+': A + b, '−': A - b, '×': A * b, '÷': A / b };
  const wrong = all.filter((o) => o !== op && results[o] !== res);
  return { prompt: `${A} ? ${b} = ${res}`, answer: op, distractors: wrong, hint: 'Try each sign in your head.', exactForm: true, speak: `${A}, something, ${b} equals ${res}. Which sign?` };
}, { format: 'choice' });
add('inverse', 'algebra', 'Check by inverse operation', (r) => {
  if (r.chance(0.5)) {
    const a = r.int(200, 999);
    const b = r.int(100, a - 1);
    return q(`${a} − ${b} = ${a - b}. Check it: ${a - b} + ${b} = ?`, a, r, 'Adding back undoes subtracting.', [a - b, a + b]);
  }
  const b = r.int(3, 9);
  const k = r.int(12, 99);
  return q(`${b * k} ÷ ${b} = ${k}. Check it: ${k} × ${b} = ?`, b * k, r, 'Multiplying undoes dividing.', [k + b]);
}, { format: 'pad' });
const SPEED = ['fxwhole', 'pcteasy', 'intadd', 'intmul', 'hcf', 'lcm', 'sq20', 'x999', 'decxw'];
add('speed5', 'mental', 'Speed mix', (r, d) => {
  const id = `s5.${r.pick(SPEED)}`;
  return list.find((x) => x.id === id)!.make(r, d);
}, { speedSec: 8 });
