// Counting and early number (ages 3–6): counting with number badges, small groups at a glance,
// numerals, comparing groups, number tracks, one more / one less, ten frames, patterns,
// adding and taking away with pictures, doubles, halves, odd and even, ordinals and coins.

import { LessonBuilder, Line, f, list, ORDINAL } from './build.ts';
import { addLesson, subLesson, countUpSub } from './addsub.ts';
import type { DotGroup, Lesson } from './types.ts';

const PLURAL: Record<string, string> = { mango: 'mangoes', fish: 'fish', butterfly: 'butterflies' };
const things = (o: string | undefined, n = 2): string => (!o ? (n === 1 ? 'dot' : 'dots') : n === 1 ? o : PLURAL[o] ?? `${o}s`);
const are = (n: number): string => (n === 1 ? 'is' : 'are');
const seq = (from: number, to: number): string => Array.from({ length: to - from + 1 }, (_, i) => from + i).join(', ');

/** Count objects (or dots, lined up) with number badges; the last number said is how many. */
export function countObjects(n: number, o?: string, lineUp = false): Lesson {
  const L = new LessonBuilder();
  L.board = { kind: 'dots', layout: 'row', groups: [{ n, emoji: o, count: 1 }] };
  L.say(lineUp ? `Line the ${things(o)} up, so you count each one once.` : `Let's count the ${things(o)} together. Touch each one as you count.`);
  L.say('Count them one by one.', seq(1, n));
  L.slip(n + 1, 'Touch each one only once.');
  L.slip(n - 1, 'Make sure you count every one.');
  return L.end(n, `The last number we say tells how many: ${n}.`);
}

/** Small groups at a glance: 4 is 2 and 2. */
export function glanceLesson(n: number, o?: string, frame = false): Lesson {
  const L = new LessonBuilder();
  if (frame) {
    L.board = { kind: 'dots', layout: 'frame', groups: [{ n, count: 1 }] };
    L.say(n === 5 ? 'A whole row of the frame is 5.' : n > 5 ? `The top row is full: that is 5. Then ${n - 5} more.` : `Count the dots in the top row.`, n > 5 ? `5 + ${n - 5} = ${n}` : seq(1, n));
    return L.end(n, `So there ${are(n)} ${n}.`);
  }
  const split = n <= 2 ? [n] : n === 3 ? [2, 1] : n === 4 ? [2, 2] : [3, 2];
  L.board = { kind: 'dots', layout: 'groups', groups: split.map((k) => ({ n: k, emoji: o })) };
  L.say(n <= 2 ? (n === 1 ? 'There is just one.' : 'A pair: two.') : 'Look for small groups you know.');
  if (split.length > 1) L.say(`I see ${list(split.map(String))}.`, `${split.join(' + ')} = ${n}`);
  return L.end(n, `So there ${are(n)} ${n}.`);
}

/** What a numeral means: n things. */
export function numeralLesson(n: number, o?: string): Lesson {
  const L = new LessonBuilder();
  L.board = { kind: 'dots', layout: 'row', groups: [{ n, emoji: o, count: 1 }], caption: String(n) };
  L.say(o ? `Count the ${things(o)}.` : `The number ${n} means ${n} things. Count to ${n}.`, seq(1, n));
  return L.end(n, o ? `There ${are(n)} ${n}, and this is how we write it: ${n}.` : `This is how we write ${n}: ${n}.`);
}

/** Which picture shows n? */
export function matchLesson(n: number, o: string): Lesson {
  const L = new LessonBuilder();
  L.board = { kind: 'dots', layout: 'row', groups: [{ n, emoji: o, count: 1 }] };
  L.say(`We need the picture with ${n} ${things(o, n)}.`);
  L.say(`Count to ${n} like this: ${seq(1, n)}.`);
  return L.end(n, `So pick the picture with ${n}.`);
}

/** n things, some go away: how many are left (maybe zero)? */
export function goneLesson(n: number, gone: number, o?: string): Lesson {
  const L = new LessonBuilder();
  const left = n - gone;
  const groups: DotGroup[] = [];
  if (left) groups.push({ n: left, emoji: o, count: 2 });
  groups.push({ n: gone, emoji: o, gone, goneAt: 1 });
  L.board = { kind: 'dots', layout: 'row', groups };
  L.say(`There ${n === 1 ? 'was' : 'were'} ${n} ${things(o, n)}.`);
  if (!gone) return L.end(n, n === 1 ? 'None go away, so it is still here: 1.' : `None go away, so all ${n} are still here.`);
  L.say(`${gone} ${gone === 1 ? 'goes' : 'go'} away. Cross ${gone === 1 ? 'it' : 'them'} out.`);
  if (!left) return L.end(0, 'None are left. None at all is zero: 0.');
  L.say(`Count the ones left: ${seq(1, left)}.`);
  L.slip(n, `${gone} went away, so there are fewer now.`);
  return L.end(left, `So ${left} ${left === 1 ? 'is' : 'are'} left.`, `${n} − ${gone} = ${left}`);
}

/** Which group has more / fewer: line them up in rows. */
export function compareGroups(counts: number[], o: string, more: boolean): Lesson {
  const L = new LessonBuilder();
  const ans = more ? Math.max(...counts) : Math.min(...counts);
  L.board = { kind: 'dots', layout: 'array', groups: counts.map((n) => ({ n, emoji: o, label: String(n), hl: n === ans ? 2 : undefined })) };
  L.say('Line the groups up in rows, starting at the same place.');
  L.say(`Count each row: ${list(counts.map(String))}.`);
  return L.end(ans, more ? `The longest row has ${ans}: that group has more.` : `The shortest row has ${ans}: that group has fewer.`);
}

/** Same amount: count the group, then find another with that many. */
export function sameLesson(n: number, o: string): Lesson {
  const L = new LessonBuilder();
  L.board = { kind: 'dots', layout: 'row', groups: [{ n, emoji: o, count: 1 }] };
  L.say(`Count the ${things(o)}: ${seq(1, n)}.`);
  return L.end(n, `There ${are(n)} ${n}, so pick the group that also has ${n}.`);
}

/** Biggest / smallest numbers on a number line. */
export function onLine(nums: number[], biggest: boolean, max = 10): Lesson {
  const L = new LessonBuilder();
  const ans = biggest ? Math.max(...nums) : Math.min(...nums);
  const line = new Line('linear', { min: 0, max, tick: 1, labelEvery: max <= 20 ? 1 : 5 });
  L.board = line.b;
  nums.forEach((n) => line.pt(n, 0, { tone: 'mark' }));
  L.say('Find each number on the number line.');
  line.pt(ans, 1, { tone: 'end', hl: 1 });
  L.say(biggest ? 'Numbers further along the line are bigger.' : 'Numbers nearer the start are smaller.');
  const two = nums.length === 2;
  return L.end(ans, biggest ? `${ans} is further along, so it is the ${two ? 'bigger' : 'biggest'}.` : `${ans} is nearer the start, so it is the ${two ? 'smaller' : 'smallest'}.`);
}

/** A run of numbers with one missing (counting up or back in ones). */
export function missingInRun(terms: number[], gap: number): Lesson {
  const L = new LessonBuilder();
  const back = terms[1] < terms[0];
  const lo = Math.min(...terms);
  const hi = Math.max(...terms);
  const line = new Line('linear', { min: Math.max(0, lo - 1), max: hi + 1, tick: 1, labelEvery: 1 });
  L.board = line.b;
  terms.forEach((t, i) => i !== gap && line.pt(t, 0, { tone: 'mark' }));
  L.say(`Say the numbers in order: ${terms.map((t, i) => (i === gap ? 'something' : String(t))).join(', ')}.`);
  const ans = terms[gap];
  const prev = gap > 0 ? terms[gap - 1] : terms[gap + 1];
  const viaNext = gap === 0;
  if (viaNext) line.hop(terms[1], ans, 1);
  else line.hop(prev, ans, 1);
  line.pt(ans, 1, { tone: 'end', hl: 1 });
  if (viaNext) L.say(back ? `Counting back, each number is one less. The number before ${terms[1]} is one more: ${ans}.` : `Each number is one more. The number before ${terms[1]} is ${ans}.`);
  else L.say(back ? `Counting back, each number is one less than the one before. One less than ${prev} is ${ans}.` : `Each number is one more than the one before. One more than ${prev} is ${ans}.`);
  return L.end(ans);
}

/** One more / one less than n (with objects). */
export function oneMoreLess(n: number, more: boolean, o?: string): Lesson {
  const L = new LessonBuilder();
  const ans = more ? n + 1 : n - 1;
  L.board = more
    ? { kind: 'dots', layout: 'row', groups: [{ n, emoji: o, count: 2 }, { n: 1, emoji: o, at: 1, count: 2, countFrom: n + 1 }] }
    : { kind: 'dots', layout: 'row', groups: [...(ans ? [{ n: ans, emoji: o, count: 2 }] : []), { n: 1, emoji: o, gone: 1, goneAt: 1 }] };
  L.say(`Here ${n === 1 ? 'is' : 'are'} ${n}.`);
  L.say(more ? 'One more: add one.' : 'One less: take one away.');
  if (ans) L.say(`Count them now: ${seq(1, ans)}.`);
  return L.end(ans, `${more ? 'One more' : 'One less'} than ${n} is ${ans}.`, `${n} ${more ? '+' : '−'} 1 = ${ans}`);
}

/** Ten frame: how many dots / how many more to fill it. */
export function tenFrameLesson(n: number, fill: boolean): Lesson {
  const L = new LessonBuilder();
  if (fill) {
    L.board = { kind: 'dots', layout: 'frame', groups: [{ n }, { n: 10 - n, hollow: true, count: 1 }] };
    L.say(`A ten frame holds 10. It has ${n}.`);
    L.say(`Count the empty boxes: ${seq(1, 10 - n)}.`);
    L.slip(n, `${n} are filled. We need the empty ones.`);
    return L.end(10 - n, `So ${10 - n} more fill the frame.`, `${n} + ${10 - n} = 10`);
  }
  L.board = { kind: 'dots', layout: 'frame', groups: [{ n, count: 1 }] };
  if (n >= 5) L.say(n === 10 ? 'Both rows are full: 5 and 5.' : `The top row is full: that is 5. Then ${n - 5} more.`, `5 + ${n - 5} = ${n}`);
  else L.say('Count the dots.', seq(1, n));
  return L.end(n, `So there ${are(n)} ${n}.`);
}

/** Continue a pattern: find the part that repeats. */
export function patternLesson(shown: string[], unit: string[], next: string): Lesson {
  const L = new LessonBuilder();
  const groups: DotGroup[] = [];
  for (let i = 0; i < shown.length; i += unit.length) groups.push({ n: Math.min(unit.length, shown.length - i), items: shown.slice(i, i + unit.length), at: 1 });
  groups.push({ n: 1, items: [next], at: 2, hl: 2 });
  L.board = { kind: 'dots', layout: 'groups', groups };
  L.say(`Say the pattern out loud: ${shown.join(', ')}…`);
  L.say(`The part that repeats is ${list(unit)}.`);
  return L.end(next, `So next comes the ${next}.`);
}

/** Add with pictures: put them together and count them all. */
export function addPictures(x: number, y: number, o?: string): Lesson {
  const L = new LessonBuilder();
  L.board = { kind: 'dots', layout: 'groups', joiner: '+', groups: [{ n: x, emoji: o, count: 1 }, { n: y, emoji: o, count: 1, countFrom: x + 1 }] };
  L.say(`Put the ${x} and the ${y} together.`);
  L.say(`Count them all: ${seq(1, x + y)}.`);
  L.slip(x > y ? x - y : y - x, 'That is taking away. Here we put them together.');
  return L.end(x + y, `${x} and ${y} make ${x + y}.`, `${x} + ${y} = ${x + y}`);
}

/** Take away with pictures: cross out, count what is left. */
export function takePictures(x: number, y: number, o?: string): Lesson {
  const L = new LessonBuilder();
  const left = x - y;
  L.board = { kind: 'dots', layout: 'row', groups: [...(left ? [{ n: left, emoji: o, count: 2 }] : []), { n: y, emoji: o, gone: y, goneAt: 1 }] };
  L.say(`There ${are(x)} ${x} ${things(o, x)}.`);
  L.say(`${y} ${y === 1 ? 'goes' : 'go'} away: cross ${y === 1 ? 'it' : 'them'} out.`);
  if (left) L.say(`Count the ones left: ${seq(1, left)}.`);
  L.slip(x + y, 'That is adding. These ones go away.');
  return L.end(left, `${x} take away ${y} leaves ${left}.`, `${x} − ${y} = ${left}`);
}

/** How many more make n (5 or 10): count the empty spaces. */
export function makeN(x: number, n: number, o?: string, show = `${x} + ${n - x} = ${n}`): Lesson {
  const L = new LessonBuilder();
  const need = n - x;
  if (n === 10) L.board = { kind: 'dots', layout: 'frame', groups: [{ n: x }, { n: need, hollow: true, count: 1 }] };
  else L.board = { kind: 'dots', layout: 'row', groups: [{ n: x, emoji: o }, { n: need, hollow: true, count: 1 }] };
  L.say(x ? `We have ${x}. We need ${n} altogether.` : `We have none yet. We need ${n}.`);
  if (need) L.say(`Count the empty spaces: ${seq(1, need)}.`);
  else L.say(`We already have ${n}, so we need no more.`);
  L.slip(n, `${n} is the total. Count only the empty spaces.`);
  L.slip(x, `${x} is what we have. Count the empty spaces.`);
  return L.end(need, `So we need ${need} more.`, show);
}

/** Double: the same number twice. */
export function doubleLesson(a: number, show = `${a} + ${a} = ${2 * a}`): Lesson {
  const L = new LessonBuilder();
  if (a <= 10) L.board = { kind: 'dots', layout: 'groups', joiner: '+', groups: [{ n: a, count: 1 }, { n: a, count: 1, countFrom: a + 1 }] };
  L.say('Double means the same number twice.', `${a} + ${a}`);
  if (a <= 10) L.say(`Count them all: ${seq(1, 2 * a)}.`);
  L.slip(a + 2, 'Double means two lots of the number, not add 2.');
  return L.end(2 * a, undefined, show);
}

/** Near doubles: a + (a + 1) is double a, and one more. */
export function nearDouble(a: number, b: number, show = `${a} + ${b} = ${a + b}`): Lesson {
  const L = new LessonBuilder();
  const s = Math.min(a, b);
  L.board = { kind: 'dots', layout: 'array', groups: [{ n: s }, { n: s + 1, hl: 2 }] };
  L.say(`${a} + ${b} is nearly a double: ${s} + ${s}, and one more.`);
  L.say(`Double ${s} is ${2 * s}.`, `${s} + ${s} = ${2 * s}`);
  L.say('Then add the one extra.', `${2 * s} + 1 = ${2 * s + 1}`);
  L.slip(2 * s, 'Don’t forget the one extra.');
  return L.end(a + b, undefined, show);
}

/** Half: share into 2 equal groups. */
export function halveLesson(n: number, show = `Half of ${n} = ${n / 2}`): Lesson {
  const L = new LessonBuilder();
  const h = n / 2;
  if (n <= 20) L.board = { kind: 'dots', layout: 'groups', groups: [{ n: h, at: 1, label: String(h) }, { n: h, at: 1, label: String(h) }] };
  L.say(`Half means sharing ${n} into 2 equal groups.`);
  L.say(n <= 20 ? 'Give one to each group, again and again.' : `What number doubled makes ${n}?`, `${h} + ${h} = ${n}`);
  L.slip(n * 2, 'That is double. Half is smaller: share into 2.');
  return L.end(h, `So half of ${n} is ${h}.`, show);
}

/** Add three numbers: find a friendly pair first. */
export function add3Lesson(a: number, b: number, c: number): Lesson {
  const L = new LessonBuilder();
  const ns = [a, b, c];
  let order = [0, 1, 2];
  const pairs: [number, number][] = [[0, 1], [0, 2], [1, 2]];
  const ten = pairs.find(([i, j]) => ns[i] + ns[j] === 10);
  const dbl = pairs.find(([i, j]) => ns[i] === ns[j]);
  const pick = ten ?? dbl;
  if (pick) order = [pick[0], pick[1], 3 - pick[0] - pick[1]];
  const [x, y, z] = order.map((i) => ns[i]);
  L.say(ten ? `Find two that make 10: ${x} and ${y}.` : dbl ? `Find a double: ${x} and ${y}.` : 'Add the first two numbers.', `${x} + ${y} = ${x + y}`);
  L.say('Then add the last one.', `${x + y} + ${z} = ${x + y + z}`);
  return L.end(a + b + c, undefined, `${a} + ${b} + ${c} = ${a + b + c}`);
}

/** Fact families: a + b = c, so c − a = b and c − b = a. */
export function factFamily(a: number, b: number, prompt: string, ans: number): Lesson {
  const L = new LessonBuilder();
  const c = a + b;
  L.board = { kind: 'bars', bars: [{ total: String(c), parts: [{ w: a, text: String(a), tone: 1 }, { w: b, text: String(b), tone: 2, on: 1 }] }] };
  L.say(`${a} and ${b} make ${c}: the whole bar is ${c}, and the parts are ${a} and ${b}.`, `${a} + ${b} = ${c}`);
  L.say('The same three numbers make every fact in the family.', `${c} − ${a} = ${b}`, `${c} − ${b} = ${a}`, `${b} + ${a} = ${c}`);
  return L.end(ans, undefined, prompt.replace('?', String(ans)));
}

/** + or −: is the answer bigger or smaller than the first number? */
export function whichSign(a: number, b: number, r: number): Lesson {
  const L = new LessonBuilder();
  const plus = r > a;
  L.say(`Start with ${a}. The answer, ${r}, is ${plus ? 'bigger' : 'smaller'}.`);
  L.say(plus ? 'Getting bigger means we added.' : 'Getting smaller means we took away.', `${a} ${plus ? '+' : '−'} ${b} = ${r}`);
  return L.end(plus ? '+' : '−', `So the sign is ${plus ? '+' : '−'}.`);
}

/** = or ≠: work out both sides. */
export function equalNot(a: number, b: number, c: number, d: number): Lesson {
  const L = new LessonBuilder();
  const s1 = a + b;
  const s2 = c + d;
  L.say('Work out each side.', `${a} + ${b} = ${s1}`, `${c} + ${d} = ${s2}`);
  return L.end(s1 === s2 ? '=' : '≠', s1 === s2 ? `Both make ${s1}, so they are equal: =` : `${s1} and ${s2} are different, so they are not equal: ≠`);
}

/** Odd or even: make pairs. */
export function oddEven(n: number): Lesson {
  const L = new LessonBuilder();
  const ones = n % 10;
  const odd = n % 2 === 1;
  const show = n <= 20 ? n : ones;
  if (show) L.board = { kind: 'dots', layout: 'pairs', groups: [{ n: show - (odd ? 1 : 0) }, ...(odd ? [{ n: 1, hl: 1 }] : [])] };
  if (n > 20) L.say(`Only the ones digit matters: tens always share into pairs. The ones digit of ${n} is ${ones}.`);
  else L.say(`Put ${n} dots into pairs.`);
  if (!show) L.say('There are no ones, so nothing is left over.');
  else L.say(odd ? 'One is left over, with no partner.' : 'Every dot has a partner.');
  return L.end(odd ? 'odd' : 'even', `So ${n} is ${odd ? 'odd' : 'even'}. ${odd ? 'Odd numbers end in 1, 3, 5, 7 or 9.' : 'Even numbers end in 0, 2, 4, 6 or 8.'}`);
}

/** Ordinals: count from the start of the row. */
export function ordinalLesson(items: string[], i: number): Lesson {
  const L = new LessonBuilder();
  const ords = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
  L.board = { kind: 'dots', layout: 'row', groups: items.map((it, k) => ({ n: 1, items: [it], label: ords[k], hl: k === i ? 2 : undefined })) };
  L.say('Start counting from the beginning of the row, on the left.');
  L.say(`Count along: ${ORDINAL.slice(1, i + 2).join(', ')}.`);
  return L.end(items[i], `The ${ORDINAL[i + 1]} one is the ${items[i]}.`);
}

/** Count coins: biggest first, then add on. */
export function coinsLesson(values: number[]): Lesson {
  const L = new LessonBuilder();
  const sorted = [...values].sort((x, y) => y - x);
  const total = values.reduce((p, x) => p + x, 0);
  L.board = { kind: 'dots', layout: 'row', groups: sorted.map((v) => ({ n: 1, face: `₹${v}` })) };
  if (sorted.length === 1) {
    L.say(`There is one ₹${total} coin.`);
    return L.end(total, `So there are ${total} rupees.`, `₹${total}`);
  }
  L.say('Put the coins in order, biggest first.');
  const lines: string[] = [];
  let run = sorted[0];
  for (const v of sorted.slice(1)) {
    lines.push(`${run} + ${v} = ${run + v}`);
    run += v;
  }
  L.say(`Start at ${sorted[0]} and add on the next coins.`, ...lines);
  return L.end(total, `So there are ${total} rupees.`, `₹${total}`);
}

/** Compare two numbers with < or > (tens first, then ones). */
export function compareSymbol(a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const sym = a > b ? '>' : '<';
  const ta = Math.floor(a / 10);
  const tb = Math.floor(b / 10);
  const tens = ta !== tb;
  // Light the column that decides: the tens, or the ones when the tens match.
  const key = (v: number, hl: number) => ({ v: String(v), tone: 'key' as const, hl });
  L.board = { kind: 'table', head: ['', 'T', 'O'], label: true, rows: [a, b].map((n) => ({ cells: [String(n), tens ? key(Math.floor(n / 10), 1) : String(Math.floor(n / 10)), tens ? String(n % 10) : key(n % 10, 2)] })) };
  L.say('Compare the tens first.');
  if (tens) L.say(`${a} has ${ta} tens and ${b} has ${tb} tens, so ${Math.max(a, b)} is bigger.`);
  else {
    L.say(`Both have ${ta} tens. So compare the ones.`);
    L.say(`${a % 10} ones and ${b % 10} ones, so ${Math.max(a, b)} is bigger.`);
  }
  L.say('The open side of the sign faces the bigger number.');
  return L.end(sym, `So ${a} ${sym} ${b}.`);
}

/** Which is bigger (to 20) on a number line. */
export function biggerOf(a: number, b: number, max = 20): Lesson {
  return onLine([a, b], true, max);
}

/** Smallest of a few numbers to 20. */
export function smallestOf(nums: number[], max = 20): Lesson {
  return onLine(nums, false, max);
}

/** Before / after: one less / one more. */
export function beforeAfter(n: number, after: boolean): Lesson {
  const L = new LessonBuilder();
  const ans = after ? n + 1 : n - 1;
  const line = new Line('linear', { min: Math.max(0, n - 5), max: Math.max(n - 5, 0) + 10, tick: 1, labelEvery: 1 });
  L.board = line.b;
  line.pt(n, 0, { tone: 'start' });
  L.say(after ? `After means the next number: one more than ${n}.` : `Before means the number just before: one less than ${n}.`);
  line.hop(n, ans, 1).pt(ans, 1, { tone: 'end', hl: 1 });
  L.say(after ? `Jump one step on.` : 'Jump one step back.', `${n} ${after ? '+' : '−'} 1 = ${ans}`);
  return L.end(ans);
}

/** Teens: ten and some ones. */
export function teenLesson(ones: number): Lesson {
  const L = new LessonBuilder();
  L.board = { kind: 'blocks', groups: [{ h: 0, t: 1, o: ones, label: `10 + ${ones}` }] };
  L.say(`A ten and ${ones} ones.`);
  L.say(`Ten and ${ones} more make ${10 + ones}: the 1 in front means one ten.`, `10 + ${ones} = ${10 + ones}`);
  L.slip(ones, `Don't forget the ten!`);
  L.slip(ones + 1, 'The 10 is a whole ten, not 1.');
  return L.end(10 + ones);
}

/** Reading a number: tens and ones. */
export function readNumber(n: number, words: string, kind: number): Lesson {
  const L = new LessonBuilder();
  const t = Math.floor(n / 10);
  const o = n % 10;
  L.board = { kind: 'blocks', groups: [{ h: 0, t, o, label: String(n) }] };
  if (kind === 1) L.say(`${t} ten${t === 1 ? '' : 's'} is ${t * 10}, and ${o} one${o === 1 ? '' : 's'} is ${o}.`);
  else L.say(`“${words}” means ${t} ten${t === 1 ? '' : 's'} and ${o} one${o === 1 ? '' : 's'}.`);
  L.say('Write the tens digit first, then the ones digit.', `${t * 10} + ${o} = ${n}`);
  if (o && o !== t) L.slip(o * 10 + t, `The tens digit comes first: ${t}, then ${o}.`);
  return L.end(n);
}

/** Difference story: count up from the smaller to the bigger. */
export function differenceStory(a: number, b: number, intro: string): Lesson {
  const L = new LessonBuilder();
  L.say(intro);
  L.take(a - b <= 10 && a <= 20 ? countUpSub(a, b) : subLesson(a, b));
  L.slip(a + b, '“How many more” means the difference, not the total.');
  return L.end(a - b, undefined, `${a} − ${b} = ${a - b}`);
}

/** A story sum: decide add or take away, then work it out. */
export function storySum(op: '+' | '−', a: number, b: number, why: string): Lesson {
  const L = new LessonBuilder();
  L.say(why);
  L.take(op === '+' ? addLesson(a, b) : subLesson(a, b));
  return L.end(op === '+' ? a + b : a - b, undefined, `${f(a)} ${op} ${f(b)} = ${f(op === '+' ? a + b : a - b)}`);
}

/** 10 − b on a full ten frame: cross out b, count what is left. */
export function tenTakeAway(b: number, show = `10 − ${b} = ${10 - b}`): Lesson {
  const L = new LessonBuilder();
  const left = 10 - b;
  L.board = { kind: 'dots', layout: 'frame', groups: [...(left ? [{ n: left, count: 2 }] : []), ...(b ? [{ n: b, gone: b, goneAt: 1 }] : [])] };
  L.say('A full ten frame is 10.');
  if (!b) return L.end(10, 'We take away nothing, so it stays 10.', show);
  L.say(`Take away ${b}: cross ${b === 1 ? 'it' : 'them'} out.`);
  if (left) L.say(`Count what is left: ${seq(1, left)}.`);
  L.slip(10 + b, 'That is adding. − means take away.');
  return L.end(left, undefined, show);
}
