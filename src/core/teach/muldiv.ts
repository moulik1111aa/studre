// Multiply and divide: a strategy for each times table, missing factors by counting from a fact
// you know, groups / arrays / sharing pictures, × and ÷ by 10 and 100, the grid method and
// short division ("bus stop").

import { clean } from '../question.ts';
import { LessonBuilder, Line, f, parts, digits, list, PLACES } from './build.ts';
import type { BusBoard, Lesson, TableBoard } from './types.ts';

const PREF = [0, 1, 10, 2, 5, 11, 9, 4, 3, 6, 8, 12, 7];
/** Pick the friendlier table: returns [table, count]. */
export function tableOf(a: number, b: number): [number, number] {
  const ia = PREF.indexOf(a);
  const ib = PREF.indexOf(b);
  if (ia < 0 && ib < 0) return [a, b];
  if (ib < 0 || (ia >= 0 && ia <= ib)) return [a, b];
  return [b, a];
}

/** A times-table fact a × b (both up to 12), with a strategy for the friendlier table. */
export function timesFact(a: number, b: number, show = `${f(a)} × ${f(b)} = ${f(a * b)}`, o: { picture?: boolean; table?: number } = {}): Lesson {
  // A skill practising one table teaches with that table's strategy (unless the other number is 0 or 1).
  const [t, n] = o.table !== undefined && (a === o.table || b === o.table) && Math.min(a, b) > 1 ? [o.table, a === o.table ? b : a] : tableOf(a, b);
  const p = a * b;
  const L = new LessonBuilder();
  if (o.picture !== false && p > 0 && p <= 60 && t <= 10 && n <= 10 && t > 1 && n > 1) {
    L.board = { kind: 'dots', layout: 'array', groups: Array.from({ length: n }, () => ({ n: t })), caption: `${f(n)} rows of ${f(t)}` };
  }
  const swapped = a === t && a !== b;
  if (swapped) L.say(`${f(a)} × ${f(b)} is the same as ${f(b)} × ${f(a)}: ${f(b)} lots of ${f(a)}.`);
  switch (t) {
    case 0:
      L.say('Groups of nothing make nothing: anything × 0 is 0.');
      break;
    case 1:
      L.say(`One lot of ${f(n)} is just ${f(n)}.`);
      break;
    case 10:
      L.say('× 10: every digit moves one place to the left, and 0 fills the ones.', `${f(n)} × 10 = ${f(n * 10)}`);
      break;
    case 2:
      L.say('× 2 means double: add the number to itself.', `${f(n)} + ${f(n)} = ${f(2 * n)}`);
      break;
    case 5:
      if (n <= 4) L.say('Count in 5s.', Array.from({ length: n }, (_, i) => f(5 * (i + 1))).join(', '));
      else L.say('× 5 is half of × 10.', `${f(n)} × 10 = ${f(10 * n)}`, `half of ${f(10 * n)} = ${f(5 * n)}`);
      break;
    case 11:
      if (n <= 9) L.say('× 11 for a single digit: write the digit twice.', `${f(n)} × 10 + ${f(n)} = ${f(11 * n)}`);
      else L.say(`× 11 is × 10 and one more ${f(n)}.`, `${f(n)} × 10 = ${f(10 * n)}`, `${f(10 * n)} + ${f(n)} = ${f(11 * n)}`);
      break;
    case 9:
      L.say(`× 9 is × 10, then take away one ${f(n)}.`, `${f(n)} × 10 = ${f(10 * n)}`, `${f(10 * n)} − ${f(n)} = ${f(9 * n)}`);
      break;
    case 4:
      L.say('× 4 means double, then double again.', `${f(n)} × 2 = ${f(2 * n)}`, `${f(2 * n)} × 2 = ${f(4 * n)}`);
      break;
    case 3:
      L.say(`× 3 is double, then one more ${f(n)}.`, `${f(n)} × 2 = ${f(2 * n)}`, `${f(2 * n)} + ${f(n)} = ${f(3 * n)}`);
      break;
    case 6:
      L.say(`× 6 is × 5, then one more ${f(n)}.`, `${f(n)} × 5 = ${f(5 * n)}`, `${f(5 * n)} + ${f(n)} = ${f(6 * n)}`);
      break;
    case 8:
      L.say('× 8 means double three times.', `${f(n)} × 2 = ${f(2 * n)}`, `${f(2 * n)} × 2 = ${f(4 * n)}`, `${f(4 * n)} × 2 = ${f(8 * n)}`);
      break;
    case 12:
      L.say('× 12 is × 10 and × 2, added together.', `${f(n)} × 10 = ${f(10 * n)}`, `${f(n)} × 2 = ${f(2 * n)}`, `${f(10 * n)} + ${f(2 * n)} = ${f(12 * n)}`);
      break;
    case 7:
      L.say('× 7 is × 5 and × 2, added together.', `${f(n)} × 5 = ${f(5 * n)}`, `${f(n)} × 2 = ${f(2 * n)}`, `${f(5 * n)} + ${f(2 * n)} = ${f(7 * n)}`);
      break;
    default:
      return gridMult(a, b, show);
  }
  if (a > 1 && b > 1) {
    L.slip(a + b, '× is not +. It means groups: ' + `${f(n)} lots of ${f(t)}.`);
    L.slip(t * (n + 1), `That is one ${f(t)} too many.`);
    L.slip(t * (n - 1), `That is one ${f(t)} too few.`);
  }
  return L.end(p, undefined, show);
}

/** a × ? = c: how many a's make c? Count from a fact you know (×1, ×5 or ×10). */
export function missingFactor(a: number, c: number, show = `${f(a)} × ${f(c / a)} = ${f(c)}`, o: { intro?: string } = {}): Lesson {
  const k = c / a;
  const L = new LessonBuilder();
  if (k > 12 && a > 1) {
    // Beyond the tables: it is a division.
    L.say(`How many ${f(a)}s make ${f(c)}? That is ${f(c)} ÷ ${f(a)}.`);
    L.take(divLesson(c, a));
    return L.end(k, undefined, show);
  }
  L.say(o.intro ?? `How many ${f(a)}s make ${f(c)}?`);
  if (a === 1 || k <= 1) {
    L.say(k === 1 ? `One ${f(a)} is ${f(c)}.` : `1 × anything is that number, so it is ${f(c)}.`);
    return L.end(k, undefined, show);
  }
  const line = new Line('even');
  L.board = line.b;
  let from: number;
  if (k <= 5) {
    from = 0;
    line.pt(0, 0, { tone: 'start' });
  } else {
    from = k <= 7 ? 5 : 10;
    line.pt(0, 0).pt(from * a, L.i, { tone: 'start', label: f(from * a) });
    line.hop(0, from * a, L.i, `${from} × ${f(a)}`);
    L.say(`Start from a fact you know: ${from} × ${f(a)} = ${f(from * a)}.`);
  }
  const seq: number[] = [];
  let x = from;
  const at = L.i;
  if (k > from) {
    while (x < k) {
      line.hop(x * a, (x + 1) * a, at, `+${f(a)}`);
      x++;
      seq.push(x * a);
    }
  } else {
    while (x > k) {
      line.hop(x * a, (x - 1) * a, at, `−${f(a)}`);
      x--;
      seq.push(x * a);
    }
  }
  line.pt(c, at, { tone: 'end', hl: at + 1 });
  if (from === 0) L.sayThen(`Count in ${f(a)}s up to ${f(c)}.`, seq.map(f).join(', '), `That is ${k} jumps of ${f(a)}.`);
  else if (k > from) L.sayThen(`Count on in ${f(a)}s up to ${f(c)}.`, seq.map(f).join(', '), `${from} and ${k - from} more make ${k} lots of ${f(a)}.`);
  else if (k < from) L.sayThen(`Count back in ${f(a)}s to ${f(c)}.`, seq.map(f).join(', '), `${from} take away ${from - k} is ${k} lots of ${f(a)}.`);
  else L.say(`That is exactly ${f(c)}: ${k} lots of ${f(a)}.`);
  L.slip(c - a, `That is ${f(c)} take away ${f(a)}. We need how many ${f(a)}s make ${f(c)}.`);
  return L.end(k, undefined, show);
}

/** c ÷ d as the times table backwards. */
export function divFact(c: number, d: number, show = `${f(c)} ÷ ${f(d)} = ${f(c / d)}`): Lesson {
  const k = c / d;
  if (d === 10 || d === 100) return divTen(c, d, show);
  if (d === 1) {
    const L = new LessonBuilder();
    L.say('Dividing by 1 leaves the number the same.');
    return L.end(c, undefined, show);
  }
  if (c === 0) {
    const L = new LessonBuilder();
    L.say(`0 shared between ${f(d)} is 0 each.`);
    return L.end(0, undefined, show);
  }
  const L = new LessonBuilder();
  const inner = missingFactor(d, c, show, { intro: `Division is the times table backwards: ${f(d)} × ? = ${f(c)}. How many ${f(d)}s make ${f(c)}?` });
  L.take(inner);
  L.slip(c - d, '÷ means sharing into equal groups, not taking away.');
  L.slip(c * d, 'That is ×. ÷ shares into equal groups.');
  return L.end(k, undefined, show);
}

// ── Pictures ───────────────────────────────────────────────────────────────

/** g groups of `each`: count in steps. */
export function groupsLesson(g: number, each: number, emoji?: string, show = `${f(g)} × ${f(each)} = ${f(g * each)}`): Lesson {
  const L = new LessonBuilder();
  L.board = { kind: 'dots', layout: 'groups', groups: Array.from({ length: g }, (_, i) => ({ n: each, emoji, count: 1, countFrom: i * each + 1, label: f((i + 1) * each), labelAt: 1 })) };
  L.say(`There are ${f(g)} groups with ${f(each)} in each.`);
  L.say(`Count on in ${f(each)}s, one group at a time.`, Array.from({ length: g }, (_, i) => f((i + 1) * each)).join(', '));
  L.slip(g + each, 'That adds the two numbers. Count all the things in all the groups.');
  return L.end(g * each, undefined, show);
}

/** An array: rows of `cols`, counted row by row. */
export function arrayLesson(rows: number, cols: number, emoji = 'star', show = `${rows} × ${cols} = ${rows * cols}`): Lesson {
  const L = new LessonBuilder();
  L.board = { kind: 'dots', layout: 'array', groups: Array.from({ length: rows }, (_, i) => ({ n: cols, emoji, label: String((i + 1) * cols), labelAt: 1 })) };
  L.say(`There are ${rows} rows with ${cols} in each row.`);
  L.say(`Count in ${cols}s, one row at a time.`, Array.from({ length: rows }, (_, i) => String((i + 1) * cols)).join(', '));
  L.slip(rows + cols, 'That adds the two numbers. Count them all, row by row: every row is the same size.');
  return L.end(rows * cols, undefined, show);
}

/** Sharing: total shared equally between p. */
export function shareLesson(total: number, p: number, emoji?: string, who = 'friends', show = `${f(total)} ÷ ${f(p)} = ${f(total / p)}`): Lesson {
  const each = total / p;
  const L = new LessonBuilder();
  L.board = { kind: 'dots', layout: 'groups', groups: Array.from({ length: p }, (_, i) => ({ n: each, emoji, at: 1, label: `${who === 'friends' ? 'Friend' : 'Group'} ${i + 1}` })) };
  L.say(`Share ${f(total)} equally between ${f(p)} ${who}.`);
  L.say(`Give one to each, again and again, until none are left.`, `${f(p)} × ${f(each)} = ${f(total)}`);
  L.slip(total - p, 'Sharing is not taking away: give one to each, round and round.');
  return L.end(each, `So each gets ${f(each)}.`, show);
}

// ── × and ÷ by 10, 100 ─────────────────────────────────────────────────────

function shiftTable(before: string, after: string, note: string): TableBoard {
  const intDigits = (s: string) => s.split('.')[0].length;
  const decDigits = (s: string) => (s.split('.')[1] ?? '').length;
  const il = Math.max(intDigits(before), intDigits(after));
  const dl = Math.max(decDigits(before), decDigits(after));
  const H = ['O', 'T', 'H', 'Th', 'TTh', 'L'];
  const head = [...H.slice(0, il).reverse(), ...(dl ? ['t', 'h', 'th'].slice(0, dl) : [])];
  const row = (s: string, at: number) => {
    const [ip, dp = ''] = s.split('.');
    const cells = [...ip.padStart(il, ' ').split('').map((c) => c.trim()), ...dp.padEnd(dl, ' ').split('').map((c) => c.trim())];
    return { at, cells: cells.map((c) => ({ v: c, tone: at ? ('key' as const) : undefined })) };
  };
  return { kind: 'table', head, rows: [row(before, 0), { ...row(after, 1), note }] };
}

/** × 10 or × 100 (whole or decimal): digits move left. */
export function timesTen(a: number, m: number, show = `${f(a)} × ${f(m)} = ${f(clean(a * m))}`): Lesson {
  const res = clean(a * m);
  const k = Math.round(Math.log10(m));
  const L = new LessonBuilder();
  L.board = shiftTable(String(clean(a)), String(res), `× ${f(m)}`);
  L.say(`× ${f(m)} moves every digit ${k === 1 ? 'one place' : `${k} places`} to the left.`);
  L.say(Number.isInteger(a) ? `The empty place${k === 1 ? '' : 's'} on the right fill${k === 1 ? 's' : ''} with 0.` : 'The digits get bigger; the decimal point stays put.', `${f(a)} × ${f(m)} = ${f(res)}`);
  L.slip(clean(a * (m === 10 ? 100 : 10)), `× ${f(m)} moves digits ${k === 1 ? 'one place' : 'two places'}, not ${k === 1 ? 'two' : 'one'}.`);
  return L.end(res, undefined, show);
}

/** ÷ 10 or ÷ 100: digits move right. */
export function divTen(n: number, m: number, show = `${f(n)} ÷ ${f(m)} = ${f(clean(n / m))}`): Lesson {
  const res = clean(n / m);
  const k = Math.round(Math.log10(m));
  const L = new LessonBuilder();
  L.board = shiftTable(String(clean(n)), String(res), `÷ ${f(m)}`);
  L.say(`÷ ${f(m)} moves every digit ${k === 1 ? 'one place' : `${k} places`} to the right.`);
  L.say(Number.isInteger(n) && n % m === 0 ? `The 0${k === 1 ? '' : 's'} at the end disappear${k === 1 ? 's' : ''}.` : 'Digits that pass the ones go after the decimal point.', `${f(n)} ÷ ${f(m)} = ${f(res)}`);
  L.slip(clean(n / (m === 10 ? 100 : 10)), `÷ ${f(m)} moves digits ${k === 1 ? 'one place' : 'two places'}.`);
  L.slip(clean(n * m), 'That is ×. ÷ makes the number smaller.');
  return L.end(res, undefined, show);
}

/** A multiple of ten times a single digit: 40 × 7 = 4 × 7 × 10. */
export function timesTens(a: number, b: number, show = `${f(a)} × ${f(b)} = ${f(a * b)}`): Lesson {
  const [t, n] = a % 10 === 0 ? [a, b] : [b, a];
  const z = t / 10;
  const L = new LessonBuilder();
  L.say(`${f(t)} is ${f(z)} tens. Do ${f(z)} × ${f(n)} first.`, `${f(z)} × ${f(n)} = ${f(z * n)}`);
  L.say('Then × 10 for the tens.', `${f(z * n)} × 10 = ${f(z * n * 10)}`);
  L.slip(z * n, 'Remember the × 10: they were tens.');
  return L.end(a * b, undefined, show);
}

// ── Grid method ────────────────────────────────────────────────────────────

/** Multiply by splitting into place parts: a grid of smaller products, then add. */
export function gridMult(a: number, b: number, show = `${f(a)} × ${f(b)} = ${f(a * b)}`): Lesson {
  const L = new LessonBuilder();
  // Split the bigger number along the top; the smaller one down the side.
  const [top, side] = a >= b ? [a, b] : [b, a];
  const tp = parts(top);
  const sp = side >= 10 ? parts(side) : [side];
  const rows: TableBoard['rows'] = sp.map((s) => ({ cells: [{ v: f(s), tone: 'key' as const }, ...tp.map((t) => ({ v: f(t * s), at: 0 }))] }));
  L.board = { kind: 'table', head: ['×', ...tp.map(f)], rows, label: true };
  const splitText = sp.length > 1 ? `Split ${f(top)} into ${list(tp.map(f))}, and ${f(side)} into ${list(sp.map(f))}.` : `Split ${f(top)} into ${list(tp.map(f))}.`;
  L.say(splitText, `${f(top)} = ${tp.map(f).join(' + ')}`);
  const products: number[] = [];
  sp.forEach((s, ri) => {
    const at = L.i;
    tp.forEach((t, ci) => {
      const cell = rows[ri].cells[ci + 1] as { v: string; at?: number };
      cell.at = at;
      products.push(t * s);
    });
    L.say(sp.length > 1 ? `Multiply each part by ${f(s)}.` : 'Multiply each part.', ...tp.map((t) => `${f(t)} × ${f(s)} = ${f(t * s)}`));
  });
  L.say('Add all the parts.', `${products.map(f).join(' + ')} = ${f(a * b)}`);
  const last = tp[tp.length - 1];
  if (sp.length === 1 && tp.length > 1) L.slip(a * b - (top - last) * side + (top - last), `Multiply every part, not just the ${f(last)}.`);
  return L.end(a * b, undefined, show);
}

// ── Short division ─────────────────────────────────────────────────────────

/** Short division ("bus stop"), digit by digit, carrying remainders. Decimal points carry up. */
export function busStop(n: number | string, d: number, o: { show?: string; remainder?: boolean } = {}): Lesson {
  const s = typeof n === 'number' ? String(clean(n)) : n;
  const ds = s.split('');
  const L = new LessonBuilder();
  const board: BusBoard = { kind: 'bus', divisor: f(d), digits: ds, answer: ds.map(() => ({ ch: '' })), carries: [] };
  L.board = board;
  L.say(`Divide ${s} by ${f(d)} one digit at a time, from the left.`);
  let carry = 0;
  let started = false;
  let q = '';
  ds.forEach((ch, i) => {
    if (ch === '.') {
      board.answer[i] = { ch: '.', at: L.i };
      q += '.';
      started = true;
      return;
    }
    const cur = carry * 10 + Number(ch);
    const qq = Math.floor(cur / d);
    const r = cur % d;
    const isLast = ds.slice(i + 1).every((c) => c === '.');
    const nextI = ds.findIndex((c, j) => j > i && c !== '.');
    if (!started && qq === 0 && !isLast) {
      if (r) board.carries.push({ i: nextI, ch: String(r), at: L.i });
      L.say(`${cur} is smaller than ${f(d)}, so carry ${cur} to the next digit.`);
      carry = r;
      return;
    }
    started = true;
    board.answer[i] = { ch: String(qq), at: L.i };
    q += String(qq);
    if (r && !isLast) board.carries.push({ i: nextI, ch: String(r), at: L.i });
    L.sayThen(`How many ${f(d)}s in ${cur}?`, `${cur} ÷ ${f(d)} = ${qq}${r ? ` r ${r}` : ''}`, r && !isLast ? `Write ${qq} and carry ${r}.` : isLast && r ? `Write ${qq}. ${r} is left over.` : `Write ${qq}.`);
    carry = r;
  });
  const quotient = Number(q.startsWith('.') ? `0${q}` : q);
  if (carry && o.remainder) {
    board.rem = { text: `r ${carry}`, at: L.i - 1 };
    return L.end(`${f(quotient)} r ${carry}`, undefined, o.show ?? `${s} ÷ ${f(d)} = ${f(quotient)} r ${carry}`);
  }
  return L.end(quotient, undefined, o.show ?? `${s} ÷ ${f(d)} = ${f(quotient)}`);
}

/** Choose a way to multiply: a fact, tens, ×10s, or the grid. */
export function mulLesson(a: number, b: number, show = `${f(a)} × ${f(b)} = ${f(clean(a * b))}`): Lesson {
  if (a <= 12 && b <= 12 && Number.isInteger(a) && Number.isInteger(b)) return timesFact(a, b, show);
  if ([10, 100, 1000].includes(b)) return timesTen(a, b, show);
  if ([10, 100, 1000].includes(a)) return timesTen(b, a, show);
  if ((a % 10 === 0 && a <= 90 && b <= 9) || (b % 10 === 0 && b <= 90 && a <= 9)) return timesTens(a, b, show);
  return gridMult(a, b, show);
}

/** Choose a way to divide: a fact, ÷10s, or short division. */
export function divLesson(c: number, d: number, show = `${f(c)} ÷ ${f(d)} = ${f(clean(c / d))}`): Lesson {
  if (d === 10 || d === 100 || d === 1000) return divTen(c, d, show);
  if (c / d <= 12 && Number.isInteger(c / d)) return divFact(c, d, show);
  if (d <= 12) return busStop(c, d, { show });
  return gridDiv(c, d, show);
}

/** Bigger divisions: count up in easy chunks of the divisor. */
export function gridDiv(c: number, d: number, show = `${f(c)} ÷ ${f(d)} = ${f(c / d)}`): Lesson {
  const k = c / d;
  const L = new LessonBuilder();
  const tens = Math.floor(k / 10) * 10;
  L.say(`How many ${f(d)}s make ${f(c)}? Take away easy chunks of ${f(d)}s.`);
  if (tens) L.say(`${f(tens)} × ${f(d)} = ${f(tens * d)}.`, `${f(c)} − ${f(tens * d)} = ${f(c - tens * d)}`);
  const rest = k - tens;
  if (rest) L.say(`${f(rest)} × ${f(d)} = ${f(rest * d)}.`, `${f(c - tens * d)} − ${f(rest * d)} = 0`);
  L.say('Add the chunks.', `${tens ? `${f(tens)} + ` : ''}${f(rest)} = ${f(k)}`);
  return L.end(k, undefined, show);
}

export { digits, PLACES };
