// Stage 1 — Tiny Counters (ages 3–4). Everything is spoken and pictured; answers are taps.

import { stageSkills, OBJECTS, thing, type ObjectName } from '../../skill.ts';
import { num, uniqueWrong, type Made } from '../../question.ts';
import type { Rng } from '../../rng.ts';
import * as C from '../../teach/count.ts';

const { list, add } = stageSkills('arithmetic', 1, { format: 'picture', speedSec: 10 });
export const STAGE1 = list;

const obj = (rng: Rng): ObjectName => rng.pick(OBJECTS);

/** Three distinct small whole numbers in [lo, hi], excluding the answer. */
function smallWrong(rng: Rng, answer: number, lo: number, hi: number): string[] {
  return uniqueWrong(num(answer), [num(answer + 1), num(answer - 1), num(answer + 2)].filter((s) => +s >= lo && +s <= hi), () => num(rng.int(lo, hi)));
}

function countQ(rng: Rng, lo: number, hi: number): Made {
  const n = rng.int(lo, hi);
  const o = obj(rng);
  return {
    prompt: `How many ${thing(o, 2)}?`,
    speak: `How many ${thing(o, 2)} can you count?`,
    visual: { kind: 'objects', groups: [{ object: o, count: n }] },
    answer: num(n),
    distractors: smallWrong(rng, n, Math.max(0, lo - 1), hi + 1),
    hint: 'Touch each one as you count: one, two, three…',
    teach: () => C.countObjects(n, o),
  };
}

const dotsQ = (lo: number, hi: number) => (r: Rng): Made => {
  const n = r.int(lo, hi);
  if (r.chance(0.4)) {
    const o = obj(r);
    return {
      prompt: r.pick([`Count the ${thing(o, 2)}`, `How many ${thing(o, 2)} here?`]),
      speak: `Count the ${thing(o, 2)}. How many are there?`,
      visual: { kind: 'objects', groups: [{ object: o, count: n }] },
      answer: num(n),
      distractors: smallWrong(r, n, Math.max(1, lo - 1), hi + 1),
      hint: 'Touch each one as you count.',
      teach: () => C.countObjects(n, o),
    };
  }
  return {
    prompt: 'How many dots?',
    speak: 'Count the dots. How many are there?',
    visual: { kind: 'dots', count: n },
    answer: num(n),
    distractors: smallWrong(r, n, Math.max(1, lo - 1), hi + 1),
    hint: 'Touch each dot once as you count.',
    teach: () => C.countObjects(n, undefined, true),
  };
};
add('count3', 'number', 'Count 1–3 objects', (r) => countQ(r, 1, 3));
add('count5', 'number', 'Count 1–5 objects', (r) => countQ(r, 1, 5));
add('count5s', 'number', 'Count scattered objects 1–5', dotsQ(2, 5));
add('count10', 'number', 'Count 1–10 objects', (r, d) => countQ(r, d < 0.5 ? 4 : 6, d < 0.5 ? 8 : 10));
add('count10s', 'number', 'Count scattered objects 1–10', dotsQ(5, 10));

const glance = (hi: number) => (r: Rng): Made => {
  const n = r.int(1, hi);
  const frame = hi >= 5 && r.chance(0.35);
  if (!frame && r.chance(0.4)) {
    const o = obj(r);
    return {
      prompt: `Quick! How many ${thing(o, 2)}?`,
      speak: `Look quickly. How many ${thing(o, 2)}?`,
      visual: { kind: 'objects', groups: [{ object: o, count: n }] },
      answer: num(n),
      distractors: smallWrong(r, n, 1, hi + 1),
      teach: () => C.glanceLesson(n, o),
    };
  }
  return {
    prompt: frame ? 'Quick! How many in the frame?' : r.pick(['How many? Quick!', 'Quick look: how many?']),
    speak: frame ? 'Look quickly. How many dots in the frame?' : 'Look quickly. How many dots?',
    visual: frame ? { kind: 'tenframe', count: n } : { kind: 'dots', count: n },
    answer: num(n),
    distractors: smallWrong(r, n, 1, hi + 1),
    teach: () => C.glanceLesson(n, undefined, frame),
  };
};
add('glance3', 'number', 'Recognise dots at a glance (1–3)', glance(3), { speedSec: 4 });
add('glance5', 'number', 'Recognise dots at a glance (1–5)', glance(5), { speedSec: 5 });

const numeral = (lo: number, hi: number) => (r: Rng): Made => {
  const n = r.int(lo, hi);
  if (r.chance(0.4)) {
    const o = obj(r);
    return {
      prompt: `Which number is this many ${thing(o, 2)}?`,
      speak: `Count the ${thing(o, 2)}. Which number shows how many?`,
      visual: { kind: 'objects', groups: [{ object: o, count: n }] },
      answer: num(n),
      distractors: smallWrong(r, n, Math.max(1, lo - 1), hi),
      teach: () => C.numeralLesson(n, o),
    };
  }
  return {
    prompt: `Find the number ${n}`,
    speak: `Can you find the number ${n}?`,
    answer: num(n),
    distractors: smallWrong(r, n, Math.max(1, lo - 1), hi),
    teach: () => C.numeralLesson(n),
  };
};
add('numeral5', 'number', 'Recognise numerals 1–5', numeral(1, 5));
add('numeral10', 'number', 'Recognise numerals 6–10', numeral(6, 10));

const matchGroup = (hi: number) => (r: Rng): Made => {
  const n = r.int(1, hi);
  const o = obj(r);
  return {
    prompt: `Which picture shows ${n}?`,
    speak: `Which picture has ${n} ${thing(o, n)}?`,
    answer: num(n),
    distractors: smallWrong(r, n, 1, hi + 1),
    optionObject: o,
    teach: () => C.matchLesson(n, o),
  };
};
add('match5', 'number', 'Match a numeral to a group (1–5)', matchGroup(5));
add('match10', 'number', 'Match a numeral to a group (1–10)', matchGroup(10));

add('zero', 'number', 'Zero: none left', (r) => {
  const o = obj(r);
  const n = r.int(1, 4);
  const eaten = r.chance(0.6) ? n : r.int(0, n - 1);
  const left = n - eaten;
  return {
    prompt: `${n} ${thing(o, n)}. ${eaten} go away. How many are left?`,
    speak: `There were ${n} ${thing(o, n)}. ${eaten} went away. How many are left? If none are left, the answer is zero.`,
    visual: { kind: 'objects', groups: [{ object: o, count: n, crossed: eaten }] },
    answer: num(left),
    distractors: smallWrong(r, left, 0, 5),
    hint: 'If every one has gone, the answer is zero.',
    teach: () => C.goneLesson(n, eaten, o),
  };
});

const compare = (more: boolean) => (r: Rng): Made => {
  const o = obj(r);
  const counts = r.shuffle([1, 2, 3, 4, 5, 6, 7]).slice(0, 3);
  const answer = more ? Math.max(...counts) : Math.min(...counts);
  return {
    prompt: more ? 'Which group has more?' : 'Which group has fewer?',
    speak: more ? `Which group has more ${thing(o, 2)}?` : `Which group has fewer ${thing(o, 2)}?`,
    answer: num(answer),
    distractors: counts.filter((c) => c !== answer).map(num).concat(num(answer + 1)),
    optionObject: o,
    teach: () => C.compareGroups(counts, o, more),
  };
};
add('more', 'number', 'Which group has more?', compare(true));
add('fewer', 'number', 'Which group has fewer?', compare(false));

add('same', 'number', 'Same amount?', (r) => {
  const o = obj(r);
  const n = r.int(2, 6);
  return {
    prompt: `Which group has the same as ${n}?`,
    speak: `Here are ${n} ${thing(o, n)}. Which group has the same number?`,
    visual: { kind: 'objects', groups: [{ object: o, count: n }] },
    answer: num(n),
    distractors: smallWrong(r, n, 1, 8),
    optionObject: o,
    teach: () => C.sameLesson(n, o),
  };
});

add('bigger10', 'number', 'Bigger number (1–10)', (r, d) => {
  const small = d >= 0.4 && r.chance(0.35);
  let nums: number[];
  let pick: number;
  let extra: number | undefined;
  do {
    nums = r.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 3);
    pick = small ? Math.min(...nums) : Math.max(...nums);
    const p = pick;
    extra = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((n) => !nums.includes(n) && (small ? n > p : n < p));
  } while (extra === undefined);
  return {
    prompt: small ? 'Which number is smallest?' : 'Which number is biggest?',
    speak: small ? 'Which number is the smallest?' : 'Which number is the biggest?',
    answer: num(pick),
    distractors: nums.filter((n) => n !== pick).map(num).concat(num(extra)),
    teach: () => C.onLine(nums, !small, 10),
  };
});

add('order5', 'number', 'Order numbers 1–5', (r) => {
  if (r.chance(0.35)) {
    const n = r.int(1, 4);
    const o = obj(r);
    return {
      prompt: `What comes after ${n}?`,
      speak: `Count on. What number comes after ${n}?`,
      visual: { kind: 'objects', groups: [{ object: o, count: n }] },
      answer: num(n + 1),
      distractors: smallWrong(r, n + 1, 1, 6),
      hint: 'One more.',
      teach: () => C.oneMoreLess(n, true, o),
    };
  }
  const start = r.int(1, 2);
  const seq = [start, start + 1, start + 2, start + 3];
  const gap = r.int(1, 3);
  const missing = seq[gap];
  return {
    prompt: `${seq.map((n, i) => (i === gap ? '?' : n)).join('  ')}`,
    speak: `What number is missing? ${seq.map((n, i) => (i === gap ? 'something' : n)).join(', ')}.`,
    answer: num(missing),
    distractors: smallWrong(r, missing, 1, 6),
    teach: () => C.missingInRun(seq, gap),
  };
});

add('line10', 'number', 'Missing number on a 1–10 line', (r) => {
  const start = r.int(1, 6);
  const seq = [start, start + 1, start + 2, start + 3, start + 4];
  const gap = r.int(1, 4);
  return {
    prompt: seq.map((n, i) => (i === gap ? '?' : n)).join('  '),
    speak: `Which number is missing? ${seq.map((n, i) => (i === gap ? 'something' : n)).join(', ')}.`,
    answer: num(seq[gap]),
    distractors: smallWrong(r, seq[gap], 1, 10),
    teach: () => C.missingInRun(seq, gap),
  };
});

const countBack = (hi: number) => (r: Rng, d: number): Made => {
  if (r.chance(0.3)) {
    const n = r.int(1, hi);
    const o = obj(r);
    return {
      prompt: `What comes just before ${n}?`,
      speak: `Count backwards. What number comes just before ${n}?`,
      visual: { kind: 'objects', groups: [{ object: o, count: n }] },
      answer: num(n - 1),
      distractors: smallWrong(r, n - 1, 0, hi),
      hint: 'One less.',
      teach: () => C.oneMoreLess(n, false, o),
    };
  }
  const start = r.int(4, hi);
  const seq = [start, start - 1, start - 2, start - 3];
  const gap = d < 0.3 || r.chance(0.5) ? 3 : r.int(1, 2);
  const shown = gap === 3 ? seq.slice(0, 3) : seq;
  const ans = seq[gap];
  return {
    prompt: shown.map((n, i) => (i === gap ? '?' : String(n))).join(', ') + (gap === 3 ? ', ?' : ''),
    speak: `Count backwards: ${shown.map((n, i) => (i === gap ? 'something' : String(n))).join(', ')}${gap === 3 ? ', something' : ''}. Which number is missing?`,
    answer: num(ans),
    distractors: smallWrong(r, ans, 0, hi),
    hint: 'Counting back, each number is one less.',
    teach: () => C.missingInRun(seq, gap),
  };
};
add('back5', 'number', 'Count back from 5', countBack(5));
add('back10', 'number', 'Count back from 10', countBack(10));

const oneMoreLess = (more: boolean) => (r: Rng): Made => {
  const n = more ? r.int(1, 9) : r.int(2, 10);
  const ans = more ? n + 1 : n - 1;
  const o = obj(r);
  return {
    prompt: `One ${more ? 'more' : 'less'} than ${n}?`,
    speak: `Here are ${n} ${thing(o, n)}. What is one ${more ? 'more' : 'less'} than ${n}?`,
    visual: { kind: 'objects', groups: [{ object: o, count: n }] },
    answer: num(ans),
    distractors: smallWrong(r, ans, 0, 11),
    teach: () => C.oneMoreLess(n, more, o),
  };
};
add('onemore', 'number', 'One more than (to 10)', oneMoreLess(true));
add('oneless', 'number', 'One less than (to 10)', oneMoreLess(false));

add('tenframe', 'number', 'Ten frame: how many?', (r, d) => {
  const n = r.int(3, 10);
  if (d >= 0.4 && n < 10 && r.chance(0.4)) {
    return {
      prompt: 'How many more to fill the frame?',
      speak: 'How many more dots would fill the ten frame?',
      visual: { kind: 'tenframe', count: n },
      answer: num(10 - n),
      distractors: smallWrong(r, 10 - n, 1, 9),
      hint: 'Count the empty boxes.',
      teach: () => C.tenFrameLesson(n, true),
    };
  }
  return {
    prompt: 'How many in the ten frame?',
    speak: 'How many dots are in the ten frame?',
    visual: { kind: 'tenframe', count: n },
    answer: num(n),
    distractors: smallWrong(r, n, 1, 10),
    hint: 'A full row has 5.',
    teach: () => C.tenFrameLesson(n, false),
  };
});

add('pattern', 'number', 'Continue a pattern (AB, ABB)', (r) => {
  const [a, b, c] = r.shuffle([...OBJECTS]).slice(0, 3);
  const unit = r.chance(0.5) ? [a, b] : [a, b, b];
  const items: string[] = [];
  while (items.length < 6) items.push(...unit);
  const shown = items.slice(0, 5);
  const next = items[5];
  return {
    prompt: 'What comes next?',
    speak: 'Look at the pattern. What comes next?',
    visual: { kind: 'pattern', items: shown },
    answer: next,
    distractors: [a, b, c].filter((x) => x !== next).concat(OBJECTS.find((x) => ![a, b, c].includes(x))!),
    teach: () => C.patternLesson(shown, unit, next),
  };
}, { speedSec: 12 });

const pictureSum = (hi: number, take: boolean) => (r: Rng): Made => {
  const o = obj(r);
  if (!take) {
    const x = r.int(1, hi - 1);
    const y = r.int(1, hi - x);
    return {
      prompt: `${x} + ${y} = ?`,
      speak: `${x} ${thing(o, x)} and ${y} more ${thing(o, y)}. How many altogether?`,
      visual: { kind: 'objects', groups: [{ object: o, count: x }, { object: o, count: y }], joiner: '+' },
      answer: num(x + y),
      distractors: smallWrong(r, x + y, 1, hi + 1),
      hint: 'Count all of them together.',
      teach: () => C.addPictures(x, y, o),
    };
  }
  const x = r.int(2, hi);
  const y = r.int(1, x - 1);
  return {
    prompt: `${x} − ${y} = ?`,
    speak: `There are ${x} ${thing(o, x)}. ${y} go away. How many are left?`,
    visual: { kind: 'objects', groups: [{ object: o, count: x, crossed: y }] },
    answer: num(x - y),
    distractors: smallWrong(r, x - y, 0, hi),
    hint: 'Count the ones that are not crossed out.',
    teach: () => C.takePictures(x, y, o),
  };
};
add('add3', 'addsub', 'Add within 3 with pictures', pictureSum(3, false));
add('add5', 'addsub', 'Add within 5 with pictures', pictureSum(5, false));
add('take3', 'addsub', 'Take away within 3 with pictures', pictureSum(3, true));
add('take5', 'addsub', 'Take away within 5 with pictures', pictureSum(5, true));

add('make5', 'addsub', 'Make 5', (r) => {
  const o = obj(r);
  const x = r.int(0, 4);
  return {
    prompt: `${x} + ? = 5`,
    speak: `Here are ${x} ${thing(o, x)}. How many more make 5?`,
    visual: { kind: 'objects', groups: [{ object: o, count: x }] },
    answer: num(5 - x),
    distractors: smallWrong(r, 5 - x, 0, 5),
    hint: 'Count up from the ones you have to 5.',
    teach: () => C.makeN(x, 5, o),
  };
});

add('story5', 'word', 'Picture stories: add or take away within 5', (r) => {
  const o = r.pick(['duck', 'balloon', 'butterfly', 'fish'] as const);
  if (r.chance(0.5)) {
    const x = r.int(1, 3);
    const y = r.int(1, 5 - x);
    const verb = { duck: 'swim over', balloon: 'float in', butterfly: 'fly in', fish: 'swim in' }[o];
    return {
      prompt: `${x} + ${y} = ?`,
      speak: `${x} ${thing(o, x)}. Then ${y} more ${verb}. How many now?`,
      visual: { kind: 'objects', groups: [{ object: o, count: x }, { object: o, count: y }], joiner: '+' },
      answer: num(x + y),
      distractors: smallWrong(r, x + y, 1, 6),
      teach: () => C.addPictures(x, y, o),
    };
  }
  const x = r.int(2, 5);
  const y = r.int(1, x - 1);
  const verb = { duck: 'swim away', balloon: 'float away', butterfly: 'fly away', fish: 'swim away' }[o];
  return {
    prompt: `${x} − ${y} = ?`,
    speak: `${x} ${thing(o, x)}. ${y} ${verb}. How many are left?`,
    visual: { kind: 'objects', groups: [{ object: o, count: x, crossed: y }] },
    answer: num(x - y),
    distractors: smallWrong(r, x - y, 0, 5),
    teach: () => C.takePictures(x, y, o),
  };
});
