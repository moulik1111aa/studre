// Stage 2 — Number Friends (ages 5–6). Spoken prompts, big choice buttons, pictures where they help.

import { stageSkills, OBJECTS, NAMES } from '../../skill.ts';
import { nearNumbers, num, spoken, uniqueWrong, type Made } from '../../question.ts';
import { sequenceQ } from '../../variety.ts';
import type { Rng } from '../../rng.ts';
import * as C from '../../teach/count.ts';
import * as A from '../../teach/addsub.ts';

const { list, add } = stageSkills('arithmetic', 2, { format: 'choice', speedSec: 8 });
export const STAGE2 = list;

/** Spoken + written arithmetic question with near-number distractors. */
function sum(prompt: string, answer: number, r: Rng, speak?: string, hint?: string, extras: number[] = []): Made {
  return { prompt, speak: speak ?? spoken(prompt), answer: num(answer), distractors: nearNumbers(r, answer, extras), hint };
}

// ── Counting & Number ──────────────────────────────────────────────────────
const countTo = (hi: number) => (r: Rng): Made => {
  const start = r.int(Math.max(1, hi - 30), hi - 4);
  const seq = [start, start + 1, start + 2, start + 3];
  const gap = r.int(1, 3);
  return {
    prompt: seq.map((n, i) => (i === gap ? '?' : n)).join(', '),
    speak: `Which number is missing? ${seq.map((n, i) => (i === gap ? 'blank' : n)).join(', ')}`,
    answer: num(seq[gap]),
    distractors: nearNumbers(r, seq[gap], [seq[gap] + 10, seq[gap] - 10].filter((n) => n > 0)),
    teach: () => C.missingInRun(seq, gap),
  };
};
add('count20', 'number', 'Count to 20', countTo(20));
add('count50', 'number', 'Count to 50', countTo(50));
add('count100', 'number', 'Count to 100', countTo(100));

const readNumeral = (lo: number, hi: number) => (r: Rng): Made => {
  const n = r.int(lo, hi);
  const words = toWords(n);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const kind = r.int(0, 2);
  return {
    prompt: kind === 0 ? `Find ${words}` : kind === 1 ? `Which number is ${tens} ten${tens === 1 ? '' : 's'} and ${ones} one${ones === 1 ? '' : 's'}?` : `Which number do we say as “${words}”?`,
    speak: kind === 1 ? `Which number is ${tens} ten${tens === 1 ? '' : 's'} and ${ones} one${ones === 1 ? '' : 's'}?` : `Find the number ${n}`,
    answer: num(n),
    distractors: uniqueWrong(num(n), [num(reverse(n)), num(n + 10), num(n - 10), num(n + 1)].filter((s) => +s >= lo - 10 && +s > 0), () => num(r.int(lo, hi))),
    teach: () => C.readNumber(n, words, kind),
  };
};
add('numeral20', 'number', 'Numerals 11–20', readNumeral(11, 20));
add('numeral100', 'number', 'Numerals to 100', readNumeral(21, 99));

const cmp = (hi: number) => (r: Rng): Made => {
  const a = r.int(1, hi);
  let b = r.int(1, hi);
  if (b === a) b = a === hi ? a - 1 : a + 1;
  const ans = Math.max(a, b);
  return {
    prompt: `Which is bigger: ${a} or ${b}?`,
    speak: `Which is bigger, ${a} or ${b}?`,
    answer: num(ans),
    distractors: [num(Math.min(a, b)), num(ans + 1), num(Math.min(a, b) - 1 > 0 ? Math.min(a, b) - 1 : ans + 2)],
    teach: () => C.biggerOf(a, b, hi),
  };
};
add('compare20', 'number', 'Compare to 20', cmp(20));
add('compare100', 'number', 'Compare to 100 (< >)', (r) => {
  const a = r.int(10, 99);
  let b = r.int(10, 99);
  if (a === b) b = a + 1;
  const sym = a > b ? '>' : '<';
  return {
    prompt: `${a}  ?  ${b}`,
    speak: `Is ${a} greater than or less than ${b}?`,
    answer: sym,
    distractors: [sym === '>' ? '<' : '>', '='],
    exactForm: true,
    hint: 'The open mouth eats the bigger number.',
    teach: () => C.compareSymbol(a, b),
  };
});
add('order3', 'number', 'Order three numbers to 20', (r) => {
  const nums = r.shuffle([...Array(20).keys()].map((n) => n + 1)).slice(0, 3);
  const sorted = [...nums].sort((a, b) => a - b);
  return {
    prompt: `Smallest of ${nums.join(', ')}?`,
    speak: `Which is the smallest: ${nums.join(', ')}?`,
    answer: num(sorted[0]),
    distractors: [num(sorted[1]), num(sorted[2]), num(sorted[0] + 1 === sorted[1] ? sorted[0] + 3 : sorted[0] + 1)],
    teach: () => C.smallestOf(nums, 20),
  };
});
add('beforeafter', 'number', 'Before and after (to 100)', (r) => {
  const n = r.int(2, 99);
  const after = r.chance(0.5);
  const ans = after ? n + 1 : n - 1;
  return { prompt: `What comes ${after ? 'after' : 'before'} ${n}?`, speak: `What number comes ${after ? 'after' : 'before'} ${n}?`, answer: num(ans), distractors: nearNumbers(r, ans, [after ? n - 1 : n + 1, n]), teach: () => C.beforeAfter(n, after) };
});
const skip = (step: number) => (r: Rng, d: number): Made =>
  sequenceQ(r, d, { steps: [step], max: step === 10 ? Math.round(100 + 100 * d) : step * (20 + Math.round(10 * d)), back: true, offStart: true, offFrom: 0.25 });
add('skip2', 'number', 'Count in 2s', skip(2));
add('skip5', 'number', 'Count in 5s', skip(5));
add('skip10', 'number', 'Count in 10s', skip(10));
add('oddeven', 'number', 'Odd or even', (r) => {
  const n = r.int(1, 50);
  const ans = n % 2 === 0 ? 'even' : 'odd';
  return { prompt: `Is ${n} odd or even?`, speak: `Is ${n} odd or even?`, answer: ans, distractors: [ans === 'odd' ? 'even' : 'odd'], exactForm: true, hint: 'Even numbers end in 0, 2, 4, 6 or 8.', teach: () => C.oddEven(n) };
});
add('ordinal', 'number', 'Ordinals to 10th', (r) => {
  const items = r.shuffle([...OBJECTS]).slice(0, 6);
  const i = r.int(0, 5);
  const ord = ['1st', '2nd', '3rd', '4th', '5th', '6th'][i];
  return {
    prompt: `Which is ${ord} in the row?`,
    speak: `Which one is ${['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][i]} in the row?`,
    visual: { kind: 'pattern', items },
    answer: items[i],
    distractors: items.filter((_, k) => k !== i).slice(0, 3),
    exactForm: true,
    teach: () => C.ordinalLesson(items, i),
  };
});
add('teens', 'number', 'Teens as ten and ones', (r) => {
  const ones = r.int(1, 9);
  return { ...sum(`10 + ${ones} = ?`, 10 + ones, r, `Ten and ${ones} more make?`, 'Ten and some ones make a teen number.'), teach: () => C.teenLesson(ones) };
});
add('line20', 'number', 'Number line to 20', (r) => {
  const n = r.int(2, 18);
  const seq = [n - 1, n, n + 1];
  return { prompt: `${seq[0]} — ? — ${seq[2]}`, speak: `What number is between ${seq[0]} and ${seq[2]}?`, answer: num(n), distractors: nearNumbers(r, n, [n + 2, n - 2]), teach: () => C.missingInRun(seq, 1) };
});

// ── Add & Subtract ─────────────────────────────────────────────────────────
add('add10', 'addsub', 'Add within 10', (r) => {
  const a = r.int(1, 8);
  const b = r.int(1, 10 - a);
  return { ...sum(`${a} + ${b} = ?`, a + b, r), teach: () => A.addLesson(a, b) };
});
add('add0', 'addsub', 'Add 0', (r) => {
  const a = r.int(0, 20);
  return r.chance(0.5)
    ? { ...sum(`${a} + 0 = ?`, a, r, undefined, 'Adding zero changes nothing.'), teach: () => A.addZero(a, 0) }
    : { ...sum(`0 + ${a} = ?`, a, r, undefined, 'Adding zero changes nothing.'), teach: () => A.addZero(0, a) };
});
add('counton', 'addsub', 'Count on 1 and 2', (r) => {
  const a = r.int(3, 18);
  const b = r.int(1, 2);
  return { ...sum(`${a} + ${b} = ?`, a + b, r, undefined, `Start at ${a} and count on ${b}.`), teach: () => A.countOn(a, b) };
});
add('doubles5', 'addsub', 'Doubles to 5 + 5', (r) => {
  const a = r.int(1, 5);
  return { ...sum(`${a} + ${a} = ?`, 2 * a, r), teach: () => C.doubleLesson(a) };
});
add('neardoubles', 'addsub', 'Near doubles', (r) => {
  const a = r.int(2, 9);
  return { ...sum(`${a} + ${a + 1} = ?`, 2 * a + 1, r, undefined, `${a} + ${a} = ${2 * a}, and one more.`, [2 * a]), teach: () => C.nearDouble(a, a + 1) };
});
add('make10', 'addsub', 'Pairs that make 10', (r) => {
  const a = r.chance(0.08) ? r.pick([0, 10]) : r.int(1, 9);
  const b = 10 - a;
  const story = a >= 1 && a <= 9;
  const forms: [string, string?][] = [
    [`${a} + ? = 10`],
    [`? + ${a} = 10`],
    [`10 = ${a} + ?`],
    [`10 − ${a} = ?`],
    [`${a} birds on a wire. How many more to make 10?`, `There are ${a} birds. How many more birds make 10?`],
    [`You have ${a} sweets. How many more to make 10?`],
  ];
  const k = r.int(0, story ? forms.length - 1 : 3);
  const [prompt, speak] = forms[k];
  const show = k < 4 ? prompt.replace('?', String(b)) : `${a} + ${b} = 10`;
  return { ...sum(prompt, b, r, `${a} and what make 10? Count on from ${a}.`, speak), teach: () => C.makeN(a, 10, undefined, show) };
});
add('add3nums', 'addsub', 'Add three small numbers', (r) => {
  const [a, b, c] = [r.int(1, 5), r.int(1, 5), r.int(1, 5)];
  return { ...sum(`${a} + ${b} + ${c} = ?`, a + b + c, r, undefined, 'Look for a pair that makes 10 first.'), teach: () => C.add3Lesson(a, b, c) };
});
add('add20nb', 'addsub', 'Add within 20 without bridging', (r) => {
  const a = r.int(11, 17);
  const b = r.int(1, 19 - a);
  return { ...sum(`${a} + ${b} = ?`, a + b, r), teach: () => A.keepTheTen(a, b, '+') };
});
add('add20b', 'addsub', 'Add within 20 bridging 10', (r) => {
  const a = r.int(5, 9);
  const b = r.int(11 - a, 9);
  return { ...sum(`${a} + ${b} = ?`, a + b, r, undefined, `Make 10 first: ${a} + ${10 - a} = 10, then add ${b - (10 - a)} more.`), teach: () => A.bridgeAdd(a, b) };
});
add('add10to', 'addsub', 'Add 10', (r) => {
  const a = r.int(1, 89);
  return { ...sum(`${a} + 10 = ?`, a + 10, r, undefined, 'The tens digit goes up by one.', [a + 1]), teach: () => A.placeJump(a, 10, '+') ?? A.addLesson(a, 10) };
});
add('missadd10', 'addsub', 'Missing addend within 10', (r) => {
  const total = r.int(4, 10);
  const a = r.int(1, total - 1);
  return { ...sum(`${a} + ? = ${total}`, total - a, r, `${a} plus what makes ${total}?`, `Count up from ${a} to ${total}.`), teach: () => A.missingAddend(a, total) };
});
add('missadd20', 'addsub', 'Missing addend within 20', (r) => {
  const total = r.int(11, 20);
  const a = r.int(2, total - 2);
  return { ...sum(`${a} + ? = ${total}`, total - a, r, `${a} plus what makes ${total}?`), teach: () => A.missingAddend(a, total) };
});
add('take10', 'addsub', 'Take away within 10', (r) => {
  const a = r.int(3, 10);
  const b = r.int(1, a);
  return { ...sum(`${a} − ${b} = ?`, a - b, r), teach: () => A.subLesson(a, b) };
});
add('sub012', 'addsub', 'Subtract 0, 1 and 2', (r) => {
  const a = r.int(2, 20);
  const b = r.int(0, 2);
  return { ...sum(`${a} − ${b} = ?`, a - b, r), teach: () => A.countBack(a, b) };
});
add('subfrom10', 'addsub', 'Subtract from 10', (r) => {
  const b = r.int(0, 10);
  return { ...sum(`10 − ${b} = ?`, 10 - b, r), teach: () => C.tenTakeAway(b) };
});
add('difference', 'addsub', 'Difference between two numbers', (r) => {
  const a = r.int(2, 20);
  const b = r.int(1, a - 1);
  const name = r.pick(NAMES);
  return { prompt: `${name} has ${a} stickers, you have ${b}. How many more does ${name} have?`, speak: `${name} has ${a} stickers. You have ${b}. How many more does ${name} have?`, answer: num(a - b), distractors: nearNumbers(r, a - b, [a + b]), teach: () => C.differenceStory(a, b, `How many more is the difference between ${a} and ${b}.`) };
});
add('sub20nb', 'addsub', 'Subtract within 20 without bridging', (r) => {
  const a = r.int(12, 19);
  const b = r.int(1, a - 10);
  return { ...sum(`${a} − ${b} = ?`, a - b, r), teach: () => A.keepTheTen(a, b, '−') };
});
add('sub20b', 'addsub', 'Subtract within 20 bridging 10', (r) => {
  const a = r.int(11, 18);
  const b = r.int(a - 9, 9);
  return { ...sum(`${a} − ${b} = ?`, a - b, r, undefined, `Take away ${a - 10} to get to 10, then ${b - (a - 10)} more.`), teach: () => A.bridgeSub(a, b) };
});
add('sub10', 'addsub', 'Subtract 10', (r) => {
  const a = r.int(11, 99);
  return { ...sum(`${a} − 10 = ?`, a - 10, r, undefined, 'The tens digit goes down by one.', [a - 1]), teach: () => A.placeJump(a, 10, '−') ?? A.subLesson(a, 10) };
});
add('misssub', 'addsub', 'Missing number in subtraction', (r) => {
  const a = r.int(6, 20);
  const b = r.int(1, a - 1);
  return { ...sum(`${a} − ? = ${a - b}`, b, r, `${a} minus what makes ${a - b}?`), teach: () => A.missingSubtrahend(a, a - b) };
});
add('factfamily', 'addsub', 'Fact families', (r) => {
  const a = r.int(2, 9);
  const b = r.int(2, 9);
  const forms = [
    [`${a + b} − ${a} = ?`, b],
    [`${a + b} − ${b} = ?`, a],
    [`${b} + ${a} = ?`, a + b],
  ] as const;
  const [p, ans] = r.pick(forms);
  return { ...sum(p, ans, r, undefined, `${a} + ${b} = ${a + b}, so the family is ${a}, ${b} and ${a + b}.`), teach: () => C.factFamily(a, b, p, ans) };
});

// ── Mixed ──────────────────────────────────────────────────────────────────
add('word20', 'word', 'Add/subtract word problems within 20', (r) => {
  const name = r.pick(NAMES);
  if (r.chance(0.5)) {
    const a = r.int(3, 12);
    const b = r.int(2, 20 - a);
    return { prompt: `${name} has ${a} marbles and finds ${b} more. How many now?`, speak: `${name} has ${a} marbles and finds ${b} more. How many now?`, answer: num(a + b), distractors: nearNumbers(r, a + b, [a - b > 0 ? a - b : a + b + 2]), teach: () => C.storySum('+', a, b, '“Finds more” means add.') };
  }
  const a = r.int(8, 20);
  const b = r.int(2, a - 1);
  return { prompt: `${name} had ${a} sweets and gave away ${b}. How many are left?`, speak: `${name} had ${a} sweets and gave away ${b}. How many are left?`, answer: num(a - b), distractors: nearNumbers(r, a - b, [a + b]), teach: () => C.storySum('−', a, b, '“Gave away” means take away.') };
});
add('whichsign', 'addsub', 'Choose + or −', (r) => {
  const a = r.int(4, 15);
  const b = r.int(1, Math.min(9, a - 1));
  const plus = r.chance(0.5);
  return { prompt: `${a} ? ${b} = ${plus ? a + b : a - b}`, speak: `${a}, something, ${b} equals ${plus ? a + b : a - b}. Plus or minus?`, answer: plus ? '+' : '−', distractors: [plus ? '−' : '+'], exactForm: true, teach: () => C.whichSign(a, b, plus ? a + b : a - b) };
});
add('equalnot', 'addsub', 'Equal or not equal', (r) => {
  const a = r.int(1, 9);
  const b = r.int(1, 9);
  const c = r.int(1, 9);
  const equal = r.chance(0.5);
  const d = equal ? a + b - c : a + b - c + r.pick([1, -1, 2]);
  const ok = d >= 0 ? d : d + 3;
  const truth = a + b === c + ok;
  return { prompt: `${a} + ${b}  ?  ${c} + ${ok}`, speak: `Is ${a} plus ${b} the same as ${c} plus ${ok}?`, answer: truth ? '=' : '≠', distractors: [truth ? '≠' : '='], exactForm: true, teach: () => C.equalNot(a, b, c, ok) };
});
add('coins20', 'word', 'Count coins to ₹20', (r) => {
  const values: number[] = [];
  let total = 0;
  const k = r.int(2, 4);
  while (values.length < k) {
    const c = r.pick([1, 2, 5, 10]);
    if (total + c > 20) break;
    values.push(c);
    total += c;
  }
  if (!values.length) values.push(5), (total = 5);
  return { prompt: 'How many rupees?', speak: 'Add up the coins. How many rupees?', visual: { kind: 'money', values }, answer: num(total), distractors: nearNumbers(r, total, [total + 5, total - 5].filter((n) => n > 0)), teach: () => C.coinsLesson(values) };
}, { speedSec: 12 });
add('halve20', 'muldiv', 'Halve even numbers to 20', (r) => {
  const h = r.int(1, 10);
  return { ...sum(`Half of ${2 * h} = ?`, h, r, `What is half of ${2 * h}?`, 'Share into two equal groups.', [2 * h, h + 2]), teach: () => C.halveLesson(2 * h) };
});
add('double20', 'muldiv', 'Double to 20', (r) => {
  const a = r.int(1, 10);
  return { ...sum(`Double ${a} = ?`, 2 * a, r, `What is double ${a}?`, `Double means ${a} + ${a}.`, [a + 2]), teach: () => C.doubleLesson(a, `Double ${a} = ${2 * a}`) };
});
add('mix10', 'addsub', 'Speed mix within 10', (r) => {
  const a = r.int(1, 9);
  if (r.chance(0.5)) {
    const b = r.int(1, 10 - a);
    return { ...sum(`${a} + ${b} = ?`, a + b, r), teach: () => A.addLesson(a, b) };
  }
  const b = r.int(1, a);
  return { ...sum(`${a} − ${b} = ?`, a - b, r), teach: () => A.subLesson(a, b) };
}, { speedSec: 5 });
add('mix20', 'addsub', 'Speed mix within 20', (r) => {
  const a = r.int(2, 18);
  if (r.chance(0.5)) {
    const b = r.int(1, 20 - a);
    return { ...sum(`${a} + ${b} = ?`, a + b, r), teach: () => A.addLesson(a, b) };
  }
  const b = r.int(1, a);
  return { ...sum(`${a} − ${b} = ?`, a - b, r), teach: () => A.subLesson(a, b) };
}, { speedSec: 6 });

// ── helpers ────────────────────────────────────────────────────────────────
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function toWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  return String(n);
}
function reverse(n: number): number {
  const r = Number(String(n).split('').reverse().join(''));
  return r === n ? n + 1 : r;
}
