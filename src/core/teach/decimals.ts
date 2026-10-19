// Decimals (Stage 4): tenths and hundredths in a place-value chart, decimal ↔ fraction by
// making the bottom 10 or 100, and comparing decimals digit by digit.

import { clean, frac, gcd, num } from '../question.ts';
import { LessonBuilder, f } from './build.ts';
import type { Lesson, TableBoard } from './types.ts';

/** A place-value chart for decimals: ones . tenths hundredths. */
function decTable(rows: string[], dp: number, hl?: { at: number; col: number }): TableBoard {
  const intW = Math.max(1, ...rows.map((r) => r.split('.')[0].length));
  const head = [...['O', 'T', 'H'].slice(0, intW).reverse(), '.', ...['t', 'h', 'th'].slice(0, dp)];
  return {
    kind: 'table',
    head,
    rows: rows.map((r) => {
      const [ip, dpart = ''] = r.split('.');
      const cells = [...ip.padStart(intW, ' ').split('').map((c) => c.trim()), '.', ...dpart.padEnd(dp, '0').split('')];
      return { cells: cells.map((c, i) => (hl && i === hl.col ? { v: c, tone: 'key' as const, hl: hl.at } : c)) };
    }),
  };
}

/** n/10 as a decimal. */
export function tenthsLesson(n: number): Lesson {
  const L = new LessonBuilder();
  L.board = decTable([`0.${n}`], 1, { at: 1, col: 2 });
  L.say(`${n}/10 means ${n} tenths.`);
  L.say('Tenths go in the first place after the decimal point.', `${n}/10 = 0.${n}`);
  L.slip(n, `${n} tenths is less than 1, so it goes after the point.`);
  return L.end(num(n / 10));
}

/** w and n tenths. */
export function wholeTenths(w: number, n: number): Lesson {
  const L = new LessonBuilder();
  L.board = decTable([`${w}.${n}`], 1, { at: 1, col: 2 });
  L.say(`Whole ones go before the point: ${w}.`);
  L.say(`Tenths go just after the point: ${n}.`, `${w} + 0.${n} = ${w}.${n}`);
  if (n !== w) L.slip(num(n + w / 10), 'Ones before the point, tenths after it.');
  return L.end(num(w + n / 10));
}

/** n/100 as a decimal. */
export function hundredthsLesson(n: number): Lesson {
  const L = new LessonBuilder();
  const two = String(n).padStart(2, '0');
  L.board = decTable([`0.${two}`], 2);
  L.say(`${n}/100 means ${n} hundredths. Hundredths use two places after the point.`);
  if (n < 10) L.say(`${n} is a single digit, so it goes in the hundredths place, with 0 tenths.`, `${n}/100 = 0.${two}`);
  else L.say(`Write ${two} after the point.`, `${n}/100 = 0.${two}`);
  if (n % 10 === 0) L.say(`0.${two} is the same as ${num(n / 100)}: a 0 at the end changes nothing.`);
  if (n < 10) L.slip(num(n / 10), `0.${n} would be ${n} tenths. Hundredths need two places: 0.0${n}.`);
  else L.slip(num(n / 10), 'Hundredths use two places after the point.');
  return L.end(num(n / 100));
}

/** How many hundredths in a decimal? */
export function countHundredths(n: number): Lesson {
  const L = new LessonBuilder();
  const two = String(n).padStart(2, '0');
  L.board = decTable([`0.${two}`], 2);
  if (num(n / 100) !== `0.${two}`) L.say(`Write ${num(n / 100)} with two places: 0.${two}. Two places after the point are hundredths.`);
  else L.say(`0.${two} has two places after the point: hundredths.`);
  L.say(`Read the digits after the point as hundredths.`, `0.${two} = ${n}/100`);
  L.slip(n * 10, 'Count hundredths: the digits after the point, as two places.');
  return L.end(n, `So there are ${n} hundredths.`);
}

const TO_TENTH: Record<string, [number, number]> = { '1/2': [5, 10], '1/5': [2, 10], '2/5': [4, 10], '3/5': [6, 10], '4/5': [8, 10], '1/4': [25, 100], '3/4': [75, 100], '1/8': [125, 1000], '3/8': [375, 1000], '5/8': [625, 1000], '7/8': [875, 1000], '1/20': [5, 100], '3/20': [15, 100], '7/20': [35, 100], '1/25': [4, 100], '9/25': [36, 100], '1/50': [2, 100] };

/** Fraction → decimal (make the bottom 10, 100 or 1000) and decimal → fraction (read it, then simplify). */
export function decFracLesson(fr: string, dec: string, toDecimal: boolean): Lesson {
  const L = new LessonBuilder();
  const [n, d] = fr.split('/').map(Number);
  const [N, D] = TO_TENTH[fr] ?? [n, d];
  const places = D === 10 ? 'tenths' : D === 100 ? 'hundredths' : 'thousandths';
  if (toDecimal) {
    if (D !== d) L.say(`Make the bottom ${D}: multiply the top and the bottom by ${D / d}.`, `${n}/${d} = ${N}/${D}`);
    else L.say(`${fr} is already ${places}.`);
    L.say(`${N} ${places} as a decimal:`, `${N}/${D} = ${dec}`);
    return L.end(dec);
  }
  L.say(`${dec} is ${N} ${places}.`, `${dec} = ${N}/${D}`);
  const g = gcd(N, D);
  if (g > 1) L.say(`Simplify: divide the top and the bottom by ${g}.`, `${N}/${D} = ${frac(N, D)}`);
  return L.end(fr);
}

/** Compare two decimals: line up the points, compare place by place. */
export function compareDecimals(a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const dp = Math.max(...[a, b].map((x) => (num(x).split('.')[1] ?? '').length));
  const sa = clean(a).toFixed(dp);
  const sb = clean(b).toFixed(dp);
  const big = Math.max(a, b);
  const padded = sa !== num(a) || sb !== num(b);
  L.say(`Line up the decimal points.${padded ? ` Write both with ${dp} places: ${sa} and ${sb}.` : ''}`);
  const wa = Math.floor(a);
  const wb = Math.floor(b);
  // Light the place that decides it.
  const intW = Math.max(String(wa).length, String(wb).length);
  if (wa !== wb) {
    L.board = decTable([sa, sb], dp, { at: 1, col: intW - 1 });
    L.say(`Compare the ones: ${wa} and ${wb}.`);
  } else {
    const da = sa.split('.')[1];
    const db = sb.split('.')[1];
    let k = 0;
    while (k < dp && da[k] === db[k]) k++;
    const name = ['tenths', 'hundredths', 'thousandths'][k];
    L.board = decTable([sa, sb], dp, { at: 1, col: intW + 1 + k });
    L.say(`The ones are the same. Compare the ${name}: ${da[k]} and ${db[k]}.`);
  }
  const small = Math.min(a, b);
  const longer = (num(small).split('.')[1] ?? '').length > (num(big).split('.')[1] ?? '').length;
  L.slip(num(small), longer ? "More digits doesn't mean bigger: compare place by place from the left." : 'Compare place by place from the left.');
  return L.end(num(big), `So ${num(big)} is bigger.`);
}

export { f };
