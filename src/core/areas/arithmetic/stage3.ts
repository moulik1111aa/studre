// Stage 3 — Big Numbers (ages 7–8). Place value, 2- and 3-digit add/subtract, first tables, sharing.

import { stageSkills, NAMES } from '../../skill.ts';
import { nearNumbers, num, uniqueWrong, type Made } from '../../question.ts';
import type { Rng } from '../../rng.ts';
import { sequenceQ } from '../../variety.ts';

const { list, add } = stageSkills('arithmetic', 3, { format: 'pad', speedSec: 10 });
export const STAGE3 = list;

const q = (prompt: string, answer: number, r: Rng, hint?: string, extras: number[] = []): Made => ({
  prompt,
  answer: num(answer),
  distractors: nearNumbers(r, answer, extras),
  hint,
});
/** a + b where the ones digits do / don't carry. */
function pairOnes(r: Rng, carry: boolean): [number, number] {
  const x = carry ? r.int(2, 9) : r.int(0, 8);
  const y = carry ? r.int(10 - x, 9) : r.int(0, 9 - x);
  return [x, y];
}

// ── Place value ────────────────────────────────────────────────────────────
add('tensones', 'number', 'Tens and ones to 100', (r) => {
  const t = r.int(1, 9);
  const o = r.int(0, 9);
  return r.chance(0.5)
    ? q(`${t} tens and ${o} ones = ?`, 10 * t + o, r, 'Tens go first, then ones.', [10 * o + t])
    : q(`How many tens in ${10 * t + o}?`, t, r, 'The tens digit is on the left.', [o]);
}, { format: 'choice' });
add('expanded', 'number', 'Expanded form', (r) => {
  const n = r.int(21, 99);
  return q(`${n} = ${Math.floor(n / 10) * 10} + ?`, n % 10, r, `${n} is ${Math.floor(n / 10)} tens and ${n % 10} ones.`);
});
add('pv3', 'number', '3-digit place value', (r) => {
  const n = r.int(101, 999);
  const place = r.pick(['hundreds', 'tens', 'ones'] as const);
  const digit = place === 'hundreds' ? Math.floor(n / 100) : place === 'tens' ? Math.floor(n / 10) % 10 : n % 10;
  const value = place === 'hundreds' ? digit * 100 : place === 'tens' ? digit * 10 : digit;
  return q(`What is the ${place} digit worth in ${n}?`, value, r, `In ${n}, the ${place} digit is ${digit}.`, [digit]);
});
add('compare3', 'number', 'Compare 3-digit numbers', (r) => {
  const a = r.int(100, 999);
  let b = r.chance(0.5) ? Number(String(a).split('').reverse().join('')) : r.int(100, 999);
  if (b === a || b < 100) b = a + r.int(1, 9);
  const ans = Math.max(a, b);
  return { prompt: `Bigger: ${a} or ${b}?`, answer: num(ans), distractors: [num(Math.min(a, b)), num(ans + 1), num(ans - 10)], hint: 'Compare the hundreds first.' };
}, { format: 'choice' });
add('order3d', 'number', 'Order 3-digit numbers', (r) => {
  const nums = [r.int(100, 999), r.int(100, 999), r.int(100, 999)];
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  return { prompt: `Smallest of ${nums.join(', ')}?`, answer: num(sorted[0]), distractors: uniqueWrong(num(sorted[0]), sorted.slice(1).map(num), () => num(r.int(100, 999))) };
}, { format: 'choice' });
add('round10', 'number', 'Round to the nearest 10', (r) => {
  const n = r.int(11, 999);
  const ans = Math.round(n / 10) * 10;
  return q(`Round ${n} to the nearest 10`, ans, r, 'Look at the ones: 5 or more rounds up.', [Math.floor(n / 10) * 10, ans + 10].filter((x) => x !== ans));
}, { format: 'choice' });
add('ba1000', 'number', 'Before and after to 1000', (r) => {
  const n = r.int(100, 998);
  const step = r.pick([1, 10, 100]);
  const up = r.chance(0.5);
  const ans = up ? n + step : n - step;
  return q(`${step} ${up ? 'more' : 'less'} than ${n}?`, ans, r, undefined, [up ? n - step : n + step]);
});
const skipBy = (steps: number[]) => (r: Rng, d: number): Made =>
  sequenceQ(r, d, { steps, max: steps[0] === 100 ? 1000 : Math.round(50 + 50 * d), back: true, offStart: true, offFrom: 0.25 });
add('skip34', 'number', 'Count in 3s and 4s', skipBy([3, 4]));
add('skip100', 'number', 'Count in 100s', skipBy([100]));

// ── Add ────────────────────────────────────────────────────────────────────
add('a21nc', 'addsub', '2-digit + 1-digit, no carrying', (r) => {
  const [x, y] = pairOnes(r, false);
  const a = 10 * r.int(1, 9) + x;
  return q(`${a} + ${y} = ?`, a + y, r);
});
add('a2tens', 'addsub', '2-digit + tens', (r) => {
  const a = r.int(11, 69);
  const t = 10 * r.int(1, Math.floor((99 - a) / 10));
  return q(`${a} + ${t} = ?`, a + t, r, 'Only the tens change.', [a + t / 10]);
});
add('a22nc', 'addsub', '2-digit + 2-digit, no carrying', (r) => {
  const [x, y] = pairOnes(r, false);
  const ta = r.int(1, 7);
  const tb = r.int(1, 8 - ta);
  return q(`${10 * ta + x} + ${10 * tb + y} = ?`, 10 * (ta + tb) + x + y, r, 'Add the tens, then the ones.');
});
add('a21c', 'addsub', '2-digit + 1-digit, carrying', (r) => {
  const [x, y] = pairOnes(r, true);
  const a = 10 * r.int(1, 8) + x;
  return q(`${a} + ${y} = ?`, a + y, r, `${x} + ${y} is more than 10, so carry one ten.`, [a + y - 10]);
});
add('a22c', 'addsub', '2-digit + 2-digit, carrying', (r, d) => {
  const [x, y] = pairOnes(r, true);
  const ta = r.int(1, d < 0.5 ? 4 : 7);
  const tb = r.int(1, 8 - ta);
  const a = 10 * ta + x;
  const b = 10 * tb + y;
  return q(`${a} + ${b} = ?`, a + b, r, 'Add the ones, carry the ten, then add the tens.', [a + b - 10]);
});
add('a3x2d', 'addsub', 'Three 2-digit numbers', (r) => {
  const ns = [r.int(10, 40), r.int(10, 30), r.int(10, 29)];
  const t = ns.reduce((p, c) => p + c, 0);
  return q(`${ns.join(' + ')} = ?`, t, r, 'Add two, then add the third.', [t - 10]);
});
add('plus9_11', 'mental', '+9 and +11 tricks', (r) => {
  const a = r.int(12, 88);
  const b = r.pick([9, 11, 19, 21]);
  const trick = b === 9 ? 'add 10, take 1' : b === 11 ? 'add 10, add 1' : b === 19 ? 'add 20, take 1' : 'add 20, add 1';
  return q(`${a} + ${b} = ?`, a + b, r, trick, [a + b + 1, a + b - 1]);
}, { speedSec: 6 });
add('a31', 'addsub', '3-digit + 1-digit', (r) => {
  const a = r.int(101, 989);
  const b = r.int(2, 9);
  return q(`${a} + ${b} = ?`, a + b, r, undefined, [a + b - 10]);
});
add('a3tens', 'addsub', '3-digit + tens', (r) => {
  const a = r.int(101, 899);
  const t = 10 * r.int(1, 9);
  return q(`${a} + ${t} = ?`, a + t, r, undefined, [a + t - 100]);
});
add('a3hund', 'addsub', '3-digit + hundreds', (r) => {
  const a = r.int(101, 599);
  const h = 100 * r.int(1, 3);
  return q(`${a} + ${h} = ?`, a + h, r, 'Only the hundreds change.', [a + h / 10]);
});
add('a33nc', 'addsub', '3-digit + 3-digit, no carrying', (r) => {
  const dig = () => {
    const x = r.int(0, 8);
    return [x, r.int(0, 9 - x)];
  };
  const [h1, h2] = [r.int(1, 4), r.int(1, 4)];
  const [t1, t2] = dig();
  const [o1, o2] = dig();
  const a = 100 * h1 + 10 * t1 + o1;
  const b = 100 * h2 + 10 * t2 + o2;
  return q(`${a} + ${b} = ?`, a + b, r);
});
add('a33c', 'addsub', '3-digit + 3-digit, carrying', (r) => {
  const a = r.int(105, 599);
  const b = r.int(105, 399);
  return q(`${a} + ${b} = ?`, a + b, r, 'Line up ones, tens, hundreds; carry when a column passes 9.', [a + b - 10, a + b - 100]);
});
add('miss100', 'addsub', 'Missing addend to 100', (r) => {
  const a = r.int(11, 89);
  const t = 10 * r.int(Math.ceil((a + 1) / 10), 10);
  return q(`${a} + ? = ${t}`, t - a, r, `Count up from ${a} to ${t}.`);
});
add('make100', 'mental', 'Make 100', (r) => {
  const a = r.chance(0.3) ? 10 * r.int(1, 9) : r.int(1, 99);
  const b = 100 - a;
  const tip = a % 10 ? 'The tens make 90 and the ones make 10.' : 'Count on in tens to 100.';
  const extras = [110 - a, 90 - a, b + 10, b - 10].filter((x) => x > 0 && x !== b);
  const roll = r.next();
  if (roll < 0.35) return q(`${a} + ? = 100`, b, r, tip, extras);
  if (roll < 0.5) return q(`? + ${a} = 100`, b, r, tip, extras);
  if (roll < 0.65) return q(`100 − ${a} = ?`, b, r, tip, extras);
  if (roll < 0.8) return q(`Which number goes with ${a} to make 100?`, b, r, tip, extras);
  if (roll < 0.9) return q(`A jar holds 100 sweets. It has ${a}. How many more fit?`, b, r, tip, extras);
  return q(`A 100 cm ribbon has ${a} cm cut off. How many cm are left?`, b, r, tip, extras);
}, { speedSec: 6 });

// ── Subtract ───────────────────────────────────────────────────────────────
add('s21nb', 'addsub', '2-digit − 1-digit, no borrowing', (r) => {
  const o = r.int(1, 9);
  const a = 10 * r.int(1, 9) + o;
  const b = r.int(1, o);
  return q(`${a} − ${b} = ?`, a - b, r);
});
add('s2tens', 'addsub', '2-digit − tens', (r) => {
  const a = r.int(21, 99);
  const t = 10 * r.int(1, Math.floor(a / 10) - 1 || 1);
  return q(`${a} − ${t} = ?`, a - t, r, 'Only the tens change.', [a - t / 10]);
});
add('s22nb', 'addsub', '2-digit − 2-digit, no borrowing', (r) => {
  const ta = r.int(2, 9);
  const oa = r.int(1, 9);
  const tb = r.int(1, ta - 1);
  const ob = r.int(0, oa);
  return q(`${10 * ta + oa} − ${10 * tb + ob} = ?`, 10 * (ta - tb) + oa - ob, r);
});
add('s21b', 'addsub', '2-digit − 1-digit, borrowing', (r) => {
  const o = r.int(0, 8);
  const a = 10 * r.int(2, 9) + o;
  const b = r.int(o + 1, 9);
  return q(`${a} − ${b} = ?`, a - b, r, 'Borrow one ten to make the ones bigger.', [a - b + 10]);
});
add('s22b', 'addsub', '2-digit − 2-digit, borrowing', (r) => {
  const oa = r.int(0, 8);
  const ob = r.int(oa + 1, 9);
  const ta = r.int(3, 9);
  const tb = r.int(1, ta - 1);
  const a = 10 * ta + oa;
  const b = 10 * tb + ob;
  return q(`${a} − ${b} = ?`, a - b, r, 'Borrow a ten, then subtract ones and tens.', [a - b + 10, Math.abs(10 * (ta - tb) + (ob - oa))]);
});
add('subfrom100', 'mental', 'Subtract from 100', (r) => {
  const b = r.int(1, 99);
  return q(`100 − ${b} = ?`, 100 - b, r, 'Find what adds to make 100.', [110 - b]);
});
add('s31', 'addsub', '3-digit − 1-digit', (r) => {
  const a = r.int(110, 999);
  const b = r.int(2, 9);
  return q(`${a} − ${b} = ?`, a - b, r, undefined, [a - b + 10]);
});
add('s3hund', 'addsub', '3-digit − hundreds', (r) => {
  const a = r.int(301, 999);
  const h = 100 * r.int(1, Math.floor(a / 100) - 1);
  return q(`${a} − ${h} = ?`, a - h, r, 'Only the hundreds change.');
});
add('s33nb', 'addsub', '3-digit − 3-digit, no borrowing', (r) => {
  const da = [r.int(3, 9), r.int(1, 9), r.int(1, 9)];
  const db = [r.int(1, da[0] - 1), r.int(0, da[1]), r.int(0, da[2])];
  const a = 100 * da[0] + 10 * da[1] + da[2];
  const b = 100 * db[0] + 10 * db[1] + db[2];
  return q(`${a} − ${b} = ?`, a - b, r);
});
add('s33b', 'addsub', '3-digit − 3-digit, borrowing', (r) => {
  const a = r.int(300, 999);
  const b = r.int(101, a - 50);
  return q(`${a} − ${b} = ?`, a - b, r, 'Borrow from the next column when the top digit is smaller.', [a - b + 10, a - b - 10]);
});
add('howmanymore', 'word', 'How many more?', (r) => {
  const [p, s] = [r.pick(NAMES), r.pick(NAMES)];
  const a = r.int(20, 99);
  const b = r.int(a + 3, a + 60);
  return q(`${p} scored ${a}, ${s === p ? 'Kiara' : s} scored ${b}. How many more did ${s === p ? 'Kiara' : s} score?`, b - a, r, 'Find the difference: bigger minus smaller.', [a + b]);
});
add('misssub2', 'addsub', 'Missing subtrahend', (r) => {
  const a = r.int(30, 99);
  const b = r.int(5, a - 5);
  return q(`${a} − ? = ${a - b}`, b, r, `${a} − ${a - b} gives the missing number.`);
});

// ── Multiply ───────────────────────────────────────────────────────────────
add('groups', 'muldiv', 'Equal groups (pictures)', (r) => {
  const g = r.int(2, 5);
  const each = r.int(2, 5);
  const o = r.pick(['apple', 'star', 'balloon', 'cookie'] as const);
  return {
    prompt: `${g} groups of ${each} = ?`,
    speak: `${g} groups with ${each} in each. How many altogether?`,
    visual: { kind: 'objects', groups: Array.from({ length: g }, () => ({ object: o, count: each })) },
    answer: num(g * each),
    distractors: nearNumbers(r, g * each, [g + each]),
    hint: `Add ${each} again and again, ${g} times.`,
  };
}, { format: 'choice' });
add('arrays', 'muldiv', 'Arrays', (r) => {
  const rows = r.int(2, 5);
  const cols = r.int(2, 6);
  return {
    prompt: `${rows} rows of ${cols} = ?`,
    visual: { kind: 'objects', groups: Array.from({ length: rows }, () => ({ object: 'star', count: cols })) },
    answer: num(rows * cols),
    distractors: nearNumbers(r, rows * cols, [rows + cols]),
    hint: `${rows} × ${cols}`,
  };
}, { format: 'choice' });
const times = (ts: number[], max = 10) => (r: Rng): Made => {
  const t = r.pick(ts);
  const n = r.int(0, max);
  return r.chance(0.5) ? q(`${t} × ${n} = ?`, t * n, r, undefined, [t * (n + 1), t + n]) : q(`${n} × ${t} = ?`, t * n, r, undefined, [t * (n - 1 >= 0 ? n - 1 : n + 2), t + n]);
};
add('x2', 'muldiv', '× 2', times([2]), { speedSec: 6 });
add('x10', 'muldiv', '× 10', times([10]), { speedSec: 6 });
add('x5', 'muldiv', '× 5', times([5]), { speedSec: 6 });
add('x3', 'muldiv', '× 3', times([3]), { speedSec: 7 });
add('x4', 'muldiv', '× 4', times([4]), { speedSec: 7 });
add('x2510', 'muldiv', 'Mixed 2, 5, 10', times([2, 5, 10], 12), { speedSec: 6 });
add('x2to5', 'muldiv', 'Mixed 2–5', times([2, 3, 4, 5], 12), { speedSec: 6 });
add('dblhalf100', 'mental', 'Double and halve to 100', (r) => {
  if (r.chance(0.5)) {
    const a = r.int(6, 50);
    return q(`Double ${a} = ?`, 2 * a, r, 'Double the tens, double the ones, add.', [a + 2]);
  }
  const a = 2 * r.int(6, 50);
  return q(`Half of ${a} = ?`, a / 2, r, 'Halve the tens, halve the ones, add.', [a / 2 + 5]);
});
add('x10rules', 'muldiv', '× 1 and × 0', (r) => {
  const n = r.int(2, 99);
  const z = r.chance(0.5) ? 0 : 1;
  return q(`${n} × ${z} = ?`, n * z, r, z ? 'Anything times 1 stays the same.' : 'Anything times 0 is 0.', [z ? 0 : n, n + 1]);
}, { format: 'choice', speedSec: 5 });

// ── Divide ─────────────────────────────────────────────────────────────────
add('share', 'muldiv', 'Sharing equally (pictures)', (r) => {
  const people = r.int(2, 4);
  const each = r.int(1, 5);
  const o = r.pick(['cookie', 'mango', 'ball'] as const);
  return {
    prompt: `${people * each} shared by ${people} = ?`,
    speak: `Share ${people * each} ${o === 'mango' ? 'mangoes' : o + 's'} equally between ${people} friends. How many each?`,
    visual: { kind: 'objects', groups: [{ object: o, count: people * each }] },
    answer: num(each),
    distractors: nearNumbers(r, each, [people, people * each - people].filter((x) => x > 0)),
    hint: 'Give one each, again and again, until none are left.',
  };
}, { format: 'choice' });
const div = (ds: number[]) => (r: Rng): Made => {
  const dv = r.pick(ds);
  const n = r.int(1, 10);
  return q(`${dv * n} ÷ ${dv} = ?`, n, r, `How many ${dv}s make ${dv * n}?`, [dv * n - dv, n + dv]);
};
add('d2', 'muldiv', '÷ 2', div([2]), { speedSec: 6 });
add('d5', 'muldiv', '÷ 5', div([5]), { speedSec: 6 });
add('d10', 'muldiv', '÷ 10', div([10]), { speedSec: 6 });
add('d3', 'muldiv', '÷ 3', div([3]), { speedSec: 7 });
add('d4', 'muldiv', '÷ 4', div([4]), { speedSec: 7 });
add('halfquarter', 'fdp', 'Halves and quarters', (r) => {
  if (r.chance(0.4)) {
    const parts = r.pick([2, 4]);
    const shaded = parts === 2 ? 1 : r.int(1, 3);
    const ans = parts === 2 ? '1/2' : shaded === 2 ? '1/2' : `${shaded}/4`;
    return { prompt: 'What fraction is shaded?', visual: { kind: 'shape-fraction', shaded, parts, shape: 'circle' }, answer: ans, distractors: uniqueWrong(ans, ['1/2', '1/4', '3/4', '1/3'], () => '2/3') };
  }
  const quarter = r.chance(0.5);
  const n = (quarter ? 4 : 2) * r.int(1, 12);
  return q(`${quarter ? 'A quarter' : 'Half'} of ${n} = ?`, quarter ? n / 4 : n / 2, r, quarter ? 'Halve it, then halve again.' : 'Share into 2 equal parts.', [quarter ? n / 2 : n / 4]);
}, { format: 'choice' });

// ── Mixed ──────────────────────────────────────────────────────────────────
add('change100', 'word', 'Money and change to ₹100', (r) => {
  const price = r.int(11, 95);
  const paid = price <= 50 && r.chance(0.5) ? 50 : 100;
  const name = r.pick(NAMES);
  return q(`${name} buys a toy for ₹${price} and pays ₹${paid}. Change?`, paid - price, r, `Count up from ₹${price} to ₹${paid}.`, [paid - price + 10]);
});
add('word2step3', 'word', 'Two-step word problems', (r) => {
  const name = r.pick(NAMES);
  const a = r.int(20, 60);
  const b = r.int(5, 30);
  const c = r.int(5, a + b - 5);
  return q(`${name} had ${a} cards, got ${b} more, then gave away ${c}. How many now?`, a + b - c, r, 'First add, then subtract.', [a + b, a - c > 0 ? a - c : a + b + c]);
});
add('mix3', 'mental', 'Speed mix', (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.int(12, 79);
    const b = r.int(5, 20);
    return q(`${a} + ${b} = ?`, a + b, r);
  }
  if (kind === 1) {
    const a = r.int(30, 99);
    const b = r.int(5, 25);
    return q(`${a} − ${b} = ?`, a - b, r);
  }
  const t = r.pick([2, 3, 4, 5, 10]);
  const n = r.int(1, 10);
  return kind === 2 ? q(`${t} × ${n} = ?`, t * n, r) : q(`${t * n} ÷ ${t} = ?`, n, r);
}, { speedSec: 6 });
