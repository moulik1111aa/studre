import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allSkills } from '../src/core/areas/index.ts';
import { makeQuestion } from '../src/core/path.ts';
import { createRng } from '../src/core/rng.ts';
import { checkLesson } from '../scripts/check-lessons.ts';
import * as A from '../src/core/teach/addsub.ts';
import * as M from '../src/core/teach/muldiv.ts';
import { evalLesson } from '../src/core/teach/expr.ts';
import type { ColsBoard, BusBoard } from '../src/core/teach/types.ts';

const LESSON_STAGES = 7;

test('every question has a lesson that ends with the right answer', () => {
  const problems: string[] = [];
  for (const s of allSkills()) {
    const rng = createRng(`teach:${s.id}`);
    for (let i = 0; i < 24; i++) {
      const q = makeQuestion(s, rng, [0, 0.35, 0.7, 1][i % 4], new Set());
      if (s.stage > LESSON_STAGES && !q.teach) continue;
      for (const p of checkLesson(s.id, q)) problems.push(`${p.skill} "${p.prompt}": ${p.issue}`);
    }
  }
  assert.deepEqual(problems.slice(0, 10), []);
});

/** The answer row of a column board, as written (digits and point). */
const answerRow = (b: ColsBoard): string => {
  const ans = b.rows.length - 1;
  return Array.from({ length: b.width }, (_, c) => b.cells.filter((x) => x.r === ans && x.c === c).map((x) => x.ch).join('')).join('');
};

test('column addition and subtraction write the right digits', () => {
  const rng = createRng('cols');
  for (let i = 0; i < 400; i++) {
    const a = rng.int(0, 9999);
    const b = rng.int(0, 9999);
    const add = A.columnAdd([a, b]);
    assert.equal(answerRow(add.board as ColsBoard), String(a + b), `${a} + ${b}`);
    const [hi, lo] = a >= b ? [a, b] : [b, a];
    const sub = A.columnSub(hi, lo);
    assert.equal(answerRow(sub.board as ColsBoard), String(hi - lo), `${hi} − ${lo}`);
  }
  // Decimals and money.
  assert.equal(answerRow(A.columnAdd([7.7, 2.8]).board as ColsBoard), '10.5');
  assert.equal(answerRow(A.columnSub(5.4, 0.9).board as ColsBoard), '4.5');
  assert.equal(answerRow(A.columnSub(7.4, 2.35).board as ColsBoard), '5.05');
  assert.equal(answerRow(A.columnAdd([23.45, 12.8]).board as ColsBoard), '36.25');
});

test('short division writes the right quotient and remainder', () => {
  const rng = createRng('bus');
  for (let i = 0; i < 300; i++) {
    const d = rng.int(2, 9);
    const n = rng.int(10, 999);
    const l = M.busStop(n, d, { remainder: true });
    const b = l.board as BusBoard;
    const q = Number(b.answer.map((x) => x.ch).join('') || '0');
    assert.equal(q, Math.floor(n / d), `${n} ÷ ${d}`);
    const last = l.steps[l.steps.length - 1].say;
    assert.ok(last.includes(n % d ? `${Math.floor(n / d)} r ${n % d}` : String(n / d)), `${n} ÷ ${d}: ${last}`);
  }
});

test('order of operations: the evaluator gets BODMAS right', () => {
  const cases: [string, number][] = [
    ['5 + 3 × 4', 17],
    ['29 − 3 × 8', 5],
    ['24 ÷ 4 + 7', 13],
    ['(8 + 4) × 3', 36],
    ['3 × (14 − 5)', 27],
    ['6 + 4² × 3', 54],
    ['(−3)² − 5', 4],
    ['−3² + 7', -2],
    ['9 + 56 ÷ 7 − 4', 13],
    ['20 − 8 − 5', 7],
    ['48 ÷ 4 ÷ 2', 6],
  ];
  for (const [e, v] of cases) {
    const l = evalLesson(e);
    const last = l.steps[l.steps.length - 1].say;
    assert.ok(last.endsWith(`${v < 0 ? '−' + -v : v}.`), `${e} → ${last}`);
  }
});

test('lessons are not too long and slips never match the right answer', () => {
  for (const s of allSkills().filter((x) => x.stage <= LESSON_STAGES)) {
    const rng = createRng(`len:${s.id}`);
    for (let i = 0; i < 12; i++) {
      const q = makeQuestion(s, rng, 1, new Set());
      const issues = checkLesson(s.id, q).filter((p) => p.issue.startsWith('long') || p.issue.startsWith('slip'));
      assert.deepEqual(issues, []);
    }
  }
});

test('percent, factorising and equation lessons get the right answer across many cases', async () => {
  const PC = await import('../src/core/teach/percent.ts');
  const AL = await import('../src/core/teach/algebra.ts');
  const last = (l: { steps: { say: string }[] }) => l.steps[l.steps.length - 1].say;
  for (const p of [5, 10, 12, 15, 18, 20, 25, 28, 30, 35, 40, 50, 60, 75, 80, 90]) {
    for (const n of [20, 40, 100, 160, 200, 340, 1000, 2400]) {
      const v = (n * p) / 100;
      assert.ok(last(PC.pctOfLesson(p, n)).includes(String(v)), `${p}% of ${n}: ${last(PC.pctOfLesson(p, n))}`);
    }
  }
  for (let p = -9; p <= 9; p++)
    for (let s = -9; s <= 9; s++) {
      if (!p || !s || p === -s) continue;
      const l = AL.factorQuad(p, s);
      assert.equal(last(l), `So the answer is ${AL.bracket(p)}${AL.bracket(s)}.`);
      // The pair the table lights adds and multiplies right.
      const rows = (l.board as { rows: { cells: { v: string; tone?: string }[] }[] }).rows;
      assert.ok(rows.some((r) => r.cells[0].tone === 'good'), `${p}, ${s}`);
    }
  for (let x = -5; x <= 9; x++) for (const a of [1, 2, 3]) for (const b of [1, 2, 4]) assert.ok(last(AL.simulLesson(x, 3 - x, a, b)).includes(`x = ${x < 0 ? '−' + -x : x}`));
});
