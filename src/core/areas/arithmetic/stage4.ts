// Stage 4 — Times Master (ages 9–10). Tables to 12, written × and ÷, numbers to a lakh,
// first fractions and decimals, money with paise, temperatures below zero.

import { stageSkills, NAMES } from '../../skill.ts';
import { clean, frac, lerp, nearNumbers, num, uniqueWrong, valueOf, type Made } from '../../question.ts';
import type { Rng } from '../../rng.ts';

const { list, add } = stageSkills('arithmetic', 4, { format: 'pad', speedSec: 8 });
export const STAGE4 = list;

const q = (prompt: string, answer: number, r: Rng, hint?: string, extras: number[] = []): Made => ({
  prompt,
  answer: num(answer),
  distractors: nearNumbers(r, answer, extras),
  hint,
});

/** Wrong decimals near an answer, at the answer's own precision. */
function nearDec(r: Rng, answer: number, step: number, extras: number[] = []): string[] {
  const pool = [answer + step, answer - step, answer + 10 * step, answer - 10 * step, answer + 2 * step, answer * 10, answer / 10];
  return uniqueWrong(
    num(answer),
    [...extras, ...r.shuffle(pool)].filter((x) => x >= 0).map((x) => num(clean(x))),
    () => num(clean(answer + step * r.int(3, 9) * (r.chance(0.5) ? 1 : -1))),
  ).filter((s) => valueOf(s) >= 0);
}

/** Wrong fractions: none equal in value to the answer. */
function wrongFracs(r: Rng, answer: string, cands: [number, number][], den: number): string[] {
  const v = valueOf(answer);
  const out = uniqueWrong(
    answer,
    cands.filter(([, d]) => d > 0).map(([n, d]) => frac(n, d)).filter((f) => Math.abs(valueOf(f) - v) > 1e-9),
    () => frac(r.int(1, den + 2), den),
  );
  return out.filter((f) => Math.abs(valueOf(f) - v) > 1e-9);
}

const name = (r: Rng): string => r.pick(NAMES);

// ── Facts ──────────────────────────────────────────────────────────────────
const times = (n: number) => (r: Rng, d: number): Made => {
  const k = r.int(lerp(1, 3, d), 12);
  return r.chance(0.75)
    ? q(r.chance(0.5) ? `${n} × ${k} = ?` : `${k} × ${n} = ?`, n * k, r, `Count on in ${n}s, or use a fact you know: ${n} × ${k - 1} = ${n * (k - 1)}.`, [n * (k + 1), n * (k - 1), (n + 1) * k])
    : q(`${n} × ? = ${n * k}`, k, r, `How many ${n}s make ${n * k}?`);
};
add('x6', 'muldiv', '× 6', times(6));
add('x7', 'muldiv', '× 7', times(7));
add('x8', 'muldiv', '× 8', times(8));
add('x9', 'muldiv', '× 9', times(9));
add('x11', 'muldiv', '× 11', times(11));
add('x12', 'muldiv', '× 12', times(12));
add('xmix', 'muldiv', 'Mixed tables to 12', (r, d) => {
  const a = r.int(lerp(2, 6, d), 12);
  const b = r.int(2, 12);
  return q(`${a} × ${b} = ?`, a * b, r, undefined, [a * (b + 1), (a - 1) * b]);
});
add('squares', 'muldiv', 'Squares to 12²', (r) => {
  const n = r.int(2, 12);
  return r.chance(0.7)
    ? { ...q(`${n}² = ?`, n * n, r, `${n}² means ${n} × ${n}.`, [2 * n, n * n + n]), speak: `${n} squared equals what?` }
    : q(`? × ? = ${n * n} (the same number twice)`, n, r, 'Which number times itself?');
});
const share = (n: number | number[]) => (r: Rng): Made => {
  const dv = Array.isArray(n) ? r.pick(n) : n;
  const k = r.int(2, 12);
  return q(`${dv * k} ÷ ${dv} = ?`, k, r, `${dv} × what = ${dv * k}?`, [k + 1, k - 1, dv]);
};
add('d6', 'muldiv', '÷ 6', share(6));
add('d7', 'muldiv', '÷ 7', share(7));
add('d8', 'muldiv', '÷ 8', share(8));
add('d9', 'muldiv', '÷ 9', share(9));
add('d1112', 'muldiv', '÷ 11 and ÷ 12', share([11, 12]));
add('dmix', 'muldiv', 'Mixed division facts', share([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));

// ── Multiply ───────────────────────────────────────────────────────────────
add('m21nc', 'muldiv', '2-digit × 1-digit, no carrying', (r) => {
  const b = r.int(2, 4);
  const t = r.int(1, Math.floor(9 / b));
  const o = r.int(1, Math.floor(9 / b));
  const a = 10 * t + o;
  return q(`${a} × ${b} = ?`, a * b, r, `${10 * t} × ${b} = ${10 * t * b}, and ${o} × ${b} = ${o * b}.`);
});
add('m21c', 'muldiv', '2-digit × 1-digit, carrying', (r, d) => {
  const b = r.int(lerp(3, 6, d), 9);
  const a = r.int(13, 99);
  return q(`${a} × ${b} = ?`, a * b, r, `Split ${a}: ${Math.floor(a / 10) * 10} × ${b} + ${a % 10} × ${b}.`, [a * b + 10, a * b - 10]);
});
add('m10100', 'muldiv', '× 10 and × 100', (r) => {
  const a = r.int(3, 999);
  const m = r.pick([10, 100]);
  return q(`${a} × ${m} = ?`, a * m, r, `× ${m}: every digit moves ${m === 10 ? 'one place' : 'two places'} left.`, [a * (m === 10 ? 100 : 10)]);
});
add('mtens', 'muldiv', '× multiples of 10', (r) => {
  const a = 10 * r.int(2, 9);
  const b = r.int(2, 9);
  return q(r.chance(0.5) ? `${a} × ${b} = ?` : `${b} × ${a} = ?`, a * b, r, `${a / 10} × ${b} = ${(a / 10) * b}, then × 10.`, [(a / 10) * b, a * b * 10]);
});
add('m31', 'muldiv', '3-digit × 1-digit', (r, d) => {
  const a = r.int(lerp(102, 300, d), 999);
  const b = r.int(2, 9);
  return q(`${a} × ${b} = ?`, a * b, r, 'Multiply hundreds, tens and ones, then add.', [a * b + 100, a * b - 10]);
});
add('m22', 'muldiv', '2-digit × 2-digit by partitioning', (r, d) => {
  const a = r.int(11, lerp(25, 49, d));
  const b = r.int(11, lerp(19, 39, d));
  const t = Math.floor(b / 10) * 10;
  return q(`${a} × ${b} = ?`, a * b, r, `${a} × ${t} = ${a * t}, ${a} × ${b - t} = ${a * (b - t)}. Add them.`, [a * t, a * b + 10]);
});
add('x11trick', 'mental', '2-digit × 11 trick', (r) => {
  const a = r.int(11, 99);
  return q(`${a} × 11 = ?`, a * 11, r, `Split the digits and put their sum in the middle: ${Math.floor(a / 10)}_${a % 10}.`, [a * 10, a * 11 + 100]);
});
add('x25', 'mental', '× 25 by quartering', (r) => {
  const a = 4 * r.int(2, 25);
  return q(`${a} × 25 = ?`, a * 25, r, `× 25 is × 100 then ÷ 4: ${a * 100} ÷ 4.`, [a * 20, a * 50]);
});
add('dblhalf', 'mental', 'Double-and-halve strategy', (r) => {
  const a = 2 * r.int(4, 25);
  const b = r.pick([5, 15, 25, 35, 45]);
  return q(`${a} × ${b} = ?`, a * b, r, `Halve ${a} and double ${b}: ${a / 2} × ${2 * b}.`, [a * b + 5, (a / 2) * b]);
});

// ── Divide ─────────────────────────────────────────────────────────────────
add('d21', 'muldiv', '2-digit ÷ 1-digit, exact', (r) => {
  const dv = r.int(2, 9);
  const k = r.int(Math.ceil(12 / dv), Math.floor(99 / dv));
  return q(`${dv * k} ÷ ${dv} = ?`, k, r, `Split ${dv * k} into easy parts of ${dv}s.`);
});
add('d21r', 'muldiv', '2-digit ÷ 1-digit with remainder', (r) => {
  const dv = r.int(3, 9);
  const k = r.int(3, Math.floor(98 / dv) - 1);
  const rem = r.int(1, dv - 1);
  const n = dv * k + rem;
  const ans = `${k} r ${rem}`;
  return {
    prompt: `${n} ÷ ${dv} = ? remainder ?`,
    speak: `${n} divided by ${dv}: what is the answer and the remainder?`,
    answer: ans,
    distractors: uniqueWrong(ans, [`${k} r ${rem + 1 < dv ? rem + 1 : rem - 1}`, `${k + 1} r ${rem}`, `${k - 1} r ${rem}`, `${k} r ${dv}`], () => `${k + r.int(-2, 2)} r ${r.int(1, dv - 1)}`),
    hint: `${dv} × ${k} = ${dv * k}, and ${rem} is left over.`,
    exactForm: true,
  };
}, { format: 'choice' });
add('d31', 'muldiv', '3-digit ÷ 1-digit', (r) => {
  const dv = r.int(2, 9);
  const k = r.int(Math.ceil(100 / dv), Math.floor(999 / dv));
  return q(`${dv * k} ÷ ${dv} = ?`, k, r, 'Divide the hundreds, then the tens, then the ones.', [k + 10, k - 10]);
});
add('d10100', 'muldiv', '÷ 10 and ÷ 100', (r) => {
  const m = r.pick([10, 100]);
  const k = r.int(2, 999);
  return q(`${k * m} ÷ ${m} = ?`, k, r, `÷ ${m}: digits move ${m === 10 ? 'one place' : 'two places'} right.`, [k * 10, Math.round(k / 10) || k + 3]);
});
add('divisible', 'number', 'Divisibility by 2, 3, 5, 9, 10', (r) => {
  const by = r.pick([2, 3, 5, 9, 10]);
  const ans = by * r.int(12, 111);
  const wrong: number[] = [];
  while (wrong.length < 3) {
    const w = r.int(100, 999);
    if (w % by !== 0 && !wrong.includes(w)) wrong.push(w);
  }
  const rule: Record<number, string> = { 2: 'Even numbers end in 0, 2, 4, 6 or 8.', 3: 'Add the digits: the sum divides by 3.', 5: 'It ends in 0 or 5.', 9: 'Add the digits: the sum divides by 9.', 10: 'It ends in 0.' };
  return { prompt: `Which number divides exactly by ${by}?`, answer: num(ans), distractors: wrong.map(num), hint: rule[by] };
}, { format: 'choice' });

// ── Big numbers ────────────────────────────────────────────────────────────
add('lakh', 'number', 'Place value to 1 lakh', (r) => {
  const n = r.int(10001, 99999);
  const places = [
    ['ten thousands', 10000],
    ['thousands', 1000],
    ['hundreds', 100],
    ['tens', 10],
  ] as const;
  const [pname, pv] = r.pick(places);
  const digit = Math.floor(n / pv) % 10;
  const shown = r.chance(0.5) ? n.toLocaleString('en-IN') : n.toLocaleString('en-US');
  if (digit === 0 || r.chance(0.25)) return q(`How many thousands make 1 lakh (1,00,000)?`, 100, r, '1 lakh = 100 thousand.', [10, 1000]);
  return q(`In ${shown}, what is the ${pname} digit worth?`, digit * pv, r, `The ${pname} digit is ${digit}.`, [digit, digit * pv * 10]);
});
add('cmpbig', 'number', 'Compare and order large numbers', (r) => {
  const a = r.int(10000, 99999);
  const s = String(a);
  const swapped = Number(s[0] + s[2] + s[1] + s.slice(3));
  const b = swapped !== a ? swapped : a + 1000;
  const c = r.int(10000, 99999);
  const nums = r.shuffle([...new Set([a, b, c])]);
  const big = Math.max(...nums);
  return { prompt: `Largest: ${nums.map((x) => x.toLocaleString('en-IN')).join('  ·  ')}?`, answer: num(big), distractors: uniqueWrong(num(big), nums.filter((x) => x !== big).map(num), () => num(big - r.int(1, 999))), hint: 'Compare from the left: ten thousands first.' };
}, { format: 'choice' });
add('round1000', 'number', 'Round to 100 and 1000', (r) => {
  const n = r.int(1050, 9949);
  const to = r.pick([100, 1000]);
  const ans = Math.round(n / to) * to;
  return q(`Round ${n} to the nearest ${to}`, ans, r, `Look at the ${to === 100 ? 'tens' : 'hundreds'} digit: 5 or more rounds up.`, [Math.floor(n / to) * to === ans ? ans + to : Math.floor(n / to) * to, Math.round(n / 10) * 10]);
}, { format: 'choice' });
add('estimate', 'mental', 'Estimate sums', (r) => {
  const a = r.int(110, 890);
  const b = r.int(110, 890);
  const ans = Math.round(a / 100) * 100 + Math.round(b / 100) * 100;
  return { prompt: `About how much is ${a} + ${b}? (round to 100s)`, answer: num(ans), distractors: uniqueWrong(num(ans), [ans + 100, ans - 100, ans + 200, a + b].map(num), () => num(ans + 100 * r.int(-3, 3))), hint: `${a} ≈ ${Math.round(a / 100) * 100}, ${b} ≈ ${Math.round(b / 100) * 100}.` };
}, { format: 'choice' });
add('a44', 'addsub', '4-digit addition', (r, d) => {
  const a = r.int(1000, lerp(4999, 8999, d));
  const b = r.int(1000, 9999 - a);
  return q(`${a} + ${b} = ?`, a + b, r, 'Add ones, tens, hundreds, thousands — carry when you pass 9.', [a + b + 100, a + b - 10]);
});
add('s44', 'addsub', '4-digit subtraction', (r, d) => {
  const a = r.int(lerp(3000, 5000, d), 9999);
  const b = r.int(1000, a - 100);
  return q(`${a} − ${b} = ?`, a - b, r, 'Start with the ones; borrow from the next column when needed.', [a - b + 10, a - b - 100]);
});

// ── Fractions ──────────────────────────────────────────────────────────────
add('fshape', 'fdp', 'Fraction of a shape', (r) => {
  const parts = r.pick([2, 3, 4, 5, 6, 8, 10]);
  const shaded = r.int(1, parts - 1);
  const ans = frac(shaded, parts);
  return {
    prompt: 'What fraction is shaded?',
    visual: { kind: 'shape-fraction', shape: r.chance(0.5) ? 'circle' : 'bar', parts, shaded },
    answer: ans,
    distractors: wrongFracs(r, ans, [[parts - shaded, parts], [shaded, parts + 1], [shaded + 1, parts], [shaded, parts - shaded]], parts),
    hint: `Count the shaded parts (${shaded}) out of all the equal parts (${parts}).`,
  };
}, { format: 'choice' });
add('unitof', 'fdp', 'Unit fraction of a number', (r) => {
  const dn = r.int(2, 10);
  const k = r.int(2, 12);
  return q(`1/${dn} of ${dn * k} = ?`, k, r, `1/${dn} means share into ${dn} equal parts: ${dn * k} ÷ ${dn}.`, [dn * k - dn, k * 2]);
});
add('fracof', 'fdp', 'Fraction of a number', (r) => {
  const dn = r.int(3, 10);
  const nu = r.int(2, dn - 1);
  const k = r.int(2, 10);
  return q(`${nu}/${dn} of ${dn * k} = ?`, nu * k, r, `First 1/${dn} of ${dn * k} = ${k}, then × ${nu}.`, [k, nu * k + k]);
});
add('equiv', 'fdp', 'Equivalent fractions', (r) => {
  const dn = r.int(2, 6);
  const nu = r.int(1, dn - 1);
  const m = r.int(2, 6);
  return r.chance(0.5)
    ? q(`${nu}/${dn} = ?/${dn * m}`, nu * m, r, `${dn} × ${m} = ${dn * m}, so the top is × ${m} too.`, [nu + m, nu * m + 1])
    : q(`${nu * m}/${dn * m} = ${nu}/?`, dn, r, `Divide top and bottom by ${m}.`, [dn * m, dn + 1]);
});
add('cmpfrac', 'fdp', 'Compare fractions with the same denominator', (r) => {
  const dn = r.int(4, 12);
  const a = r.int(1, dn - 1);
  let b = r.int(1, dn - 1);
  if (b === a) b = a === 1 ? 2 : a - 1;
  return { prompt: `Bigger: ${a}/${dn} or ${b}/${dn}?`, answer: `${Math.max(a, b)}/${dn}`, distractors: [`${Math.min(a, b)}/${dn}`], hint: 'Same-size pieces: more pieces is bigger.' };
}, { format: 'choice' });
add('addfrac', 'fdp', 'Add fractions with the same denominator', (r) => {
  const dn = r.int(4, 12);
  const a = r.int(1, dn - 2);
  const b = r.int(1, dn - 1 - a);
  const ans = frac(a + b, dn);
  return { prompt: `${a}/${dn} + ${b}/${dn} = ?`, answer: ans, distractors: wrongFracs(r, ans, [[a + b, 2 * dn], [a + b + 1, dn], [a + b - 1, dn], [a * b, dn]], dn), hint: 'Add the tops; the bottom stays the same.' };
}, { format: 'pad-ext' });
add('subfrac', 'fdp', 'Subtract fractions with the same denominator', (r) => {
  const dn = r.int(4, 12);
  const a = r.int(2, dn - 1);
  const b = r.int(1, a - 1);
  const ans = frac(a - b, dn);
  return { prompt: `${a}/${dn} − ${b}/${dn} = ?`, answer: ans, distractors: wrongFracs(r, ans, [[a - b, 0], [a - b + 1, dn], [a + b, dn], [a - b - 1, dn], [a - b, dn + 1]], dn), hint: 'Take away the tops; the bottom stays the same.' };
}, { format: 'pad-ext' });
add('mixed', 'fdp', 'Mixed and improper fractions', (r) => {
  const dn = r.int(2, 8);
  const w = r.int(1, 4);
  const nu = r.int(1, dn - 1);
  const imp = w * dn + nu;
  if (r.chance(0.5)) {
    const ans = `${imp}/${dn}`;
    return { prompt: `${w} ${nu}/${dn} as an improper fraction = ?`, answer: ans, distractors: uniqueWrong(ans, [`${w * nu + dn}/${dn}`, `${imp + 1}/${dn}`, `${w + nu}/${dn}`, `${imp}/${dn + 1}`], () => `${imp + r.int(2, 5)}/${dn}`), hint: `${w} whole = ${w * dn}/${dn}; add ${nu}/${dn}.`, exactForm: true };
  }
  const ans = `${w} ${nu}/${dn}`;
  return { prompt: `${imp}/${dn} as a mixed number = ?`, answer: ans, distractors: uniqueWrong(ans, [`${w + 1} ${nu}/${dn}`, `${w} ${nu + 1 < dn ? nu + 1 : nu - 1 || 1}/${dn}`, `${nu} ${w}/${dn}`, `${w - 1 || w + 2} ${nu}/${dn}`], () => `${r.int(1, 6)} ${r.int(1, dn - 1)}/${dn}`), hint: `${imp} ÷ ${dn} = ${w} remainder ${nu}.`, exactForm: true };
}, { format: 'choice' });

// ── Decimals ───────────────────────────────────────────────────────────────
add('tenths', 'fdp', 'Tenths', (r) => {
  const n = r.int(1, 9);
  const w = r.int(0, 9);
  return r.chance(0.5)
    ? { prompt: `${n}/10 as a decimal = ?`, answer: num(n / 10), distractors: nearDec(r, n / 10, 0.1, [n, n / 100]), hint: `${n} tenths = 0.${n}.` }
    : { prompt: `${w} and ${n} tenths = ?`, answer: num(w + n / 10), distractors: nearDec(r, w + n / 10, 0.1, [w + n / 100, n + w / 10]), hint: `Whole ones before the point, tenths after.` };
}, { format: 'pad-ext' });
add('hundredths', 'fdp', 'Hundredths', (r) => {
  const n = r.int(1, 99);
  return r.chance(0.5)
    ? { prompt: `${n}/100 as a decimal = ?`, answer: num(n / 100), distractors: nearDec(r, n / 100, 0.01, [n / 10]), hint: 'Hundredths use two places after the point.' }
    : q(`How many hundredths in ${num(n / 100)}?`, n, r, `0.01 is one hundredth.`, [n * 10]);
}, { format: 'pad-ext' });
add('decfrac', 'fdp', 'Decimal ↔ fraction', (r) => {
  const pairs: [string, string][] = [['1/2', '0.5'], ['1/4', '0.25'], ['3/4', '0.75'], ['1/5', '0.2'], ['2/5', '0.4'], ['3/5', '0.6'], ['4/5', '0.8'], ['1/10', '0.1'], ['3/10', '0.3'], ['7/10', '0.7'], ['9/10', '0.9'], ['1/100', '0.01']];
  const [f, dcm] = r.pick(pairs);
  const others = pairs.filter((p) => p[0] !== f);
  if (r.chance(0.5)) {
    return { prompt: `${f} as a decimal = ?`, answer: dcm, distractors: uniqueWrong(dcm, r.shuffle(others).map((p) => p[1]), () => '0.3'), hint: 'Make the bottom 10 or 100.' };
  }
  return { prompt: `${dcm} as a fraction = ?`, answer: f, distractors: uniqueWrong(f, r.shuffle(others).map((p) => p[0]), () => '1/3'), hint: 'Read the decimal: tenths or hundredths, then simplify.' };
}, { format: 'choice' });
add('cmpdec', 'fdp', 'Compare decimals', (r) => {
  const a = r.int(1, 99) / 10;
  let b = r.chance(0.5) ? Math.floor(a) + r.int(1, 99) / 100 : r.int(1, 99) / 10;
  if (clean(b) === clean(a)) b = clean(a + 0.05);
  const big = Math.max(a, b);
  return { prompt: `Bigger: ${num(a)} or ${num(b)}?`, answer: num(big), distractors: [num(Math.min(a, b))], hint: 'Line up the points; compare ones, then tenths, then hundredths.' };
}, { format: 'choice' });
add('adddec', 'fdp', 'Add 1-dp decimals', (r) => {
  const a = r.int(1, 99) / 10;
  const b = r.int(1, 99) / 10;
  return { prompt: `${num(a)} + ${num(b)} = ?`, answer: num(clean(a + b)), distractors: nearDec(r, clean(a + b), 0.1), hint: 'Line up the points and add like whole numbers.' };
}, { format: 'pad-ext' });
add('subdec', 'fdp', 'Subtract 1-dp decimals', (r) => {
  const a = r.int(20, 99) / 10;
  const b = r.int(1, Math.round(a * 10) - 1) / 10;
  return { prompt: `${num(a)} − ${num(b)} = ?`, answer: num(clean(a - b)), distractors: nearDec(r, clean(a - b), 0.1), hint: 'Line up the points and subtract like whole numbers.' };
}, { format: 'pad-ext' });
add('dec10', 'fdp', '× and ÷ decimals by 10 and 100', (r) => {
  const a = r.int(1, 999) / 100;
  const m = r.pick([10, 100]);
  const mul = r.chance(0.5);
  const ans = clean(mul ? a * m : a / m);
  return { prompt: `${num(a)} ${mul ? '×' : '÷'} ${m} = ?`, answer: num(ans), distractors: uniqueWrong(num(ans), [mul ? a / m : a * m, mul ? a * (m === 10 ? 100 : 10) : a / (m === 10 ? 100 : 10), a].map((x) => num(clean(x))), () => num(clean(ans * 10))), hint: `The digits move ${m === 10 ? 'one place' : 'two places'} ${mul ? 'left' : 'right'}.` };
}, { format: 'pad-ext' });

// ── Mixed ──────────────────────────────────────────────────────────────────
add('paise', 'word', 'Money with paise', (r) => {
  const a = r.int(100, 5000) / 100;
  const b = r.int(100, 3000) / 100;
  const shop = r.pick(['a notebook', 'a pen', 'a juice', 'a comic', 'some fruit', 'a toy']);
  const other = r.pick(['a sticker pack', 'a pencil box', 'a snack', 'a balloon']);
  if (r.chance(0.5)) {
    const ans = clean(a + b);
    return { prompt: `${name(r)} buys ${shop} for ₹${a.toFixed(2)} and ${other} for ₹${b.toFixed(2)}. Total in ₹?`, answer: num(ans), distractors: nearDec(r, ans, 0.1, [ans + 1, ans - 0.01]), hint: '100 paise = ₹1. Add the rupees and the paise.' };
  }
  const pay = Math.ceil(a / 10) * 10 + (a % 10 === 0 ? 10 : 0);
  const ans = clean(pay - a);
  return { prompt: `${shop[0].toUpperCase() + shop.slice(1)} costs ₹${a.toFixed(2)}. ${name(r)} pays ₹${pay}. Change in ₹?`, answer: num(ans), distractors: nearDec(r, ans, 0.1, [ans + 1, clean(ans - 1)]), hint: `Count up from ₹${a.toFixed(2)} to ₹${pay}.` };
}, { format: 'pad-ext', speedSec: 14 });
add('temp', 'number', 'Negative numbers via temperature', (r) => {
  const t = r.int(-5, 8);
  const ch = r.int(2, 10);
  const colder = r.chance(0.6);
  const ans = colder ? t - ch : t + ch;
  const city = r.pick(['Shimla', 'Leh', 'Manali', 'Gulmarg', 'Darjeeling']);
  return {
    prompt: `It is ${t}°C in ${city}. It gets ${ch}° ${colder ? 'colder' : 'warmer'}. Now?`,
    answer: num(ans),
    distractors: nearNumbers(r, ans, [colder ? t + ch : t - ch, -ans || ans + 2], { min: -30 }),
    hint: `Picture a thermometer: ${colder ? 'down' : 'up'} ${ch} from ${t}.`,
  };
}, { format: 'pad-ext', speedSec: 12 });
add('bodmas0', 'algebra', 'Order of operations without brackets', (r) => {
  const a = r.int(2, 20);
  const b = r.int(2, 9);
  const c = r.int(2, 9);
  const kind = r.int(0, 2);
  if (kind === 0) return q(`${a} + ${b} × ${c} = ?`, a + b * c, r, `× before +: ${b} × ${c} = ${b * c} first.`, [(a + b) * c]);
  if (kind === 1) return q(`${a + b * c} − ${b} × ${c} = ?`, a, r, `× before −: ${b} × ${c} = ${b * c} first.`, [(a + b * c - b) * c]);
  return q(`${b * c * 2} ÷ ${b} + ${a} = ?`, 2 * c + a, r, `÷ before +: ${b * c * 2} ÷ ${b} = ${2 * c} first.`, [Math.round((b * c * 2) / (b + a))]);
}, { speedSec: 12 });
add('twostep', 'word', 'Two-step word problems', (r) => {
  const who = name(r);
  const kind = r.int(0, 3);
  if (kind === 0) {
    const p = r.int(3, 9);
    const n = r.int(4, 12);
    const g = r.int(2, p * n - 2);
    return q(`${who} has ${p} packs of ${n} stickers and gives away ${g}. How many are left?`, p * n - g, r, `First ${p} × ${n} = ${p * n}, then take away ${g}.`, [p * n + g, p * n]);
  }
  if (kind === 1) {
    const price = r.int(12, 60);
    const k = r.int(2, 6);
    const note = (Math.floor((price * k) / 100) + 1) * 100 + (r.chance(0.5) ? 100 : 0);
    return q(`${who} buys ${k} books at ₹${price} each and pays ₹${note}. Change?`, note - price * k, r, `Cost: ${k} × ${price} = ${price * k}. Then ${note} − ${price * k}.`, [price * k, note - price]);
  }
  if (kind === 2) {
    const kids = r.int(3, 8);
    const each = r.int(3, 9);
    const extra = r.int(1, kids - 1);
    return q(`${kids * each + extra} sweets are shared by ${kids} children. ${extra} are left over. How many does each get?`, each, r, `Take away the ${extra} left over, then ÷ ${kids}.`, [each + 1]);
  }
  const rows = r.int(3, 9);
  const cols = r.int(4, 12);
  const empty = r.int(1, rows * cols - 1);
  return q(`A hall has ${rows} rows of ${cols} chairs. ${empty} are empty. How many people are sitting?`, rows * cols - empty, r, `${rows} × ${cols} = ${rows * cols} chairs.`, [rows * cols + empty]);
}, { speedSec: 25 });
add('multfac', 'muldiv', 'Multiples and factors', (r) => {
  if (r.chance(0.5)) {
    const n = r.int(3, 12);
    const m = n * r.int(2, 9);
    const wrong = uniqueWrong(num(m), [m + 1, m - 1, m + n - 1, m + 2].filter((x) => x % n !== 0).map(num), () => num(n * r.int(2, 9) + r.int(1, n - 1)));
    return { prompt: `Which is a multiple of ${n}?`, answer: num(m), distractors: wrong, hint: `Multiples of ${n} are in the ${n} times table.` };
  }
  const n = r.pick([12, 16, 18, 20, 24, 28, 30, 36, 40, 42, 45, 48]);
  const facs = Array.from({ length: n }, (_, i) => i + 1).filter((i) => n % i === 0 && i > 1 && i < n);
  const f = r.pick(facs);
  const non = Array.from({ length: 13 }, (_, i) => i + 2).filter((i) => n % i !== 0);
  return { prompt: `Which is a factor of ${n}?`, answer: num(f), distractors: r.shuffle(non).slice(0, 3).map(num), hint: `A factor divides ${n} exactly.` };
}, { format: 'choice' });
const SPEED = ['x6', 'x7', 'x8', 'x9', 'x12', 'squares', 'dmix', 'mtens', 'x25', 'm10100'];
add('speed4', 'mental', 'Speed mix', (r, d) => {
  const id = r.pick(SPEED);
  const s = list.find((x) => x.id === `s4.${id}`)!;
  return s.make(r, d);
}, { speedSec: 6 });
