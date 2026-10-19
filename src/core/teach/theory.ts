// Number facts (Stages 3–4): divisibility rules, multiples and factors — each option checked.

import { LessonBuilder, f } from './build.ts';
import type { Lesson, TableBoard } from './types.ts';

const digitSum = (n: number): number => String(Math.abs(n)).split('').reduce((p, d) => p + Number(d), 0);

const RULES: Record<number, string> = {
  2: 'A number divides by 2 when its last digit is even: 0, 2, 4, 6 or 8.',
  5: 'A number divides by 5 when it ends in 0 or 5.',
  10: 'A number divides by 10 when it ends in 0.',
  3: 'A number divides by 3 when its digits add up to a number in the 3 times table.',
  9: 'A number divides by 9 when its digits add up to a number in the 9 times table.',
};

function test(n: number, by: number): { check: string; ok: boolean } {
  if (by === 3 || by === 9) {
    const s = digitSum(n);
    return { check: `${String(n).split('').join(' + ')} = ${s}`, ok: s % by === 0 };
  }
  return { check: `ends in ${n % 10}`, ok: n % by === 0 };
}

/** Which number divides exactly by `by`? Check each option with the rule. */
export function divisibleChoice(by: number, ans: number, wrongs: number[]): Lesson {
  const L = new LessonBuilder();
  const all = [ans, ...wrongs].sort((x, y) => x - y);
  const table: TableBoard = { kind: 'table', head: ['number', 'check', ''], rows: all.map((n) => { const t = test(n, by); return { at: 1, cells: [String(n), t.check, { v: t.ok ? '✓' : '✗', tone: t.ok ? 'good' as const : 'bad' as const }] }; }) };
  L.board = table;
  L.say(RULES[by]);
  L.say('Check each number.');
  return L.end(ans, `So ${ans} divides exactly by ${by}.`, `${ans} ÷ ${by} = ${f(ans / by)}`);
}

/** Which is a multiple of n? Divide each option by n. */
export function multipleChoice(n: number, m: number, wrongs: number[]): Lesson {
  const L = new LessonBuilder();
  const all = [m, ...wrongs].sort((x, y) => x - y);
  L.board = { kind: 'table', head: ['number', `÷ ${n}`, ''], rows: all.map((x) => ({ at: 1, cells: [String(x), x % n ? `${Math.floor(x / n)} r ${x % n}` : String(x / n), { v: x % n ? '✗' : '✓', tone: x % n ? 'bad' as const : 'good' as const }] })) };
  L.say(`Multiples of ${n} are in the ${n} times table: they divide by ${n} with nothing left over.`);
  L.say(`Divide each number by ${n}.`);
  return L.end(m, `So ${m} is a multiple of ${n}.`, `${n} × ${m / n} = ${m}`);
}

/** Which is a factor of n? A factor divides n exactly. */
export function factorChoice(n: number, fac: number, wrongs: number[]): Lesson {
  const L = new LessonBuilder();
  const all = [fac, ...wrongs].sort((x, y) => x - y);
  L.board = { kind: 'table', head: ['try', `${n} ÷`, ''], rows: all.map((x) => ({ at: 1, cells: [String(x), n % x ? `${Math.floor(n / x)} r ${n % x}` : String(n / x), { v: n % x ? '✗' : '✓', tone: n % x ? 'bad' as const : 'good' as const }] })) };
  L.say(`A factor of ${n} divides ${n} exactly, with nothing left over.`);
  L.say(`Divide ${n} by each number.`);
  return L.end(fac, `So ${fac} is a factor of ${n}.`, `${fac} × ${n / fac} = ${n}`);
}
