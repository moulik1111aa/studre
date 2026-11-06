// New branches on the one road (Measure & time, Shapes & space, Data & chance, and a few more
// Numbers and Algebra skills): each skill names the skill it goes after. arithmetic/index.ts
// slots them in after the age moves.

import { stageSkills, type Skill, type SkillOptions } from '../../skill.ts';
import { spoken, type Made, type Strand, type Visual } from '../../question.ts';
import type { MathVisual } from '../../vis.ts';
import type { Lesson } from '../../teach/types.ts';

export interface Extra {
  skill: Skill;
  after: string;
}

export function extraSkills(stage: number, defaults: Required<SkillOptions>) {
  const { list: skills, add: addSkill } = stageSkills('arithmetic', stage, defaults);
  const list: Extra[] = [];
  /** Add a skill that goes after `after` (a skill id, or an earlier new one). */
  const add = (after: string, id: string, strand: Strand, name: string, make: Skill['make'], opts: SkillOptions = {}): void => {
    const little = stage <= 2;
    addSkill(id, strand, name, little ? (r, d) => withSpeech(make(r, d)) : make, opts);
    list.push({ skill: skills[skills.length - 1], after });
  };
  return { list, add };
}

const withSpeech = (m: Made): Made => (m.speak ? m : { ...m, speak: spoken(m.prompt) });

/** A question with its picture, options and lesson. */
export function made(
  prompt: string,
  answer: string | number,
  wrong: (string | number)[],
  o: { visual?: Visual; options?: Record<string, MathVisual>; hint?: string; speak?: string; teach?: () => Lesson; exact?: boolean } = {},
): Made {
  const a = String(answer);
  const seen = new Set([a]);
  const distractors: string[] = [];
  for (const w of wrong) {
    const s = String(w);
    if (!seen.has(s)) {
      seen.add(s);
      distractors.push(s);
    }
  }
  if (!o.options) for (const c of topUp(a)) {
    if (distractors.length >= 3) break;
    if (!seen.has(c)) {
      seen.add(c);
      distractors.push(c);
    }
  }
  return {
    prompt,
    answer: a,
    distractors,
    ...(o.visual ? { visual: o.visual } : {}),
    ...(o.options ? { optionVisuals: o.options } : {}),
    ...(o.hint ? { hint: o.hint } : {}),
    ...(o.speak ? { speak: o.speak } : {}),
    ...(o.teach ? { teach: o.teach } : {}),
    ...(o.exact ? { exactForm: true } : {}),
  };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
const fmtN = (n: number) => String(Math.round(n * 1e9) / 1e9);

/** More wrong options of the same kind as the answer, so every question has 4 choices. */
export function topUp(a: string): string[] {
  const n = Number(a);
  if (a.trim() !== '' && Number.isFinite(n)) return [n + 1, n - 1, n + 2, n + 10, n * 2, n + 5].filter((x) => x >= 0 || n < 0).map(fmtN);
  let m = /^\((−?-?\d+(?:\.\d+)?), (−?-?\d+(?:\.\d+)?)\)$/.exec(a);
  if (m) {
    const [x, y] = [Number(m[1].replace('−', '-')), Number(m[2].replace('−', '-'))];
    const P = (p: number, q: number) => `(${String(p).replace('-', '−')}, ${String(q).replace('-', '−')})`;
    return [P(x + 1, y), P(x, y + 1), P(y, x), P(x - 1, y), P(x, y - 1)];
  }
  m = /^(\d+):(\d\d)( am| pm)?$/.exec(a);
  if (m) {
    const h = Number(m[1]), mm = Number(m[2]), ap = m[3] ?? '';
    const T = (hh: number, mi: number) => `${m![1].length === 2 && !ap ? String(hh).padStart(2, '0') : hh}:${String(mi).padStart(2, '0')}${ap}`;
    return [T(h, (mm + 5) % 60), T(h, (mm + 55) % 60), T((h % 12) + 1, mm), T(h === 1 ? 12 : h - 1, mm), T(h, (mm + 30) % 60)];
  }
  m = /^(-?\d+)\/(\d+)$/.exec(a);
  if (m) {
    const [p, q] = [Number(m[1]), Number(m[2])];
    return [`${p + 1}/${q}`, `${p}/${q + 1}`, `${q}/${p || 1}`, `${p + 2}/${q}`];
  }
  if (DAY_NAMES.includes(a)) return DAY_NAMES.filter((d) => d !== a);
  if (MONTH_NAMES.includes(a)) return MONTH_NAMES.filter((d) => d !== a);
  if (ROMANS.includes(a)) { const i = ROMANS.indexOf(a); return [ROMANS[i + 1] ?? 'XXII', ROMANS[Math.max(0, i - 1)], ROMANS[(i + 5) % 21], ROMANS[(i + 10) % 21]]; }
  m = /^(\d+) o'clock$/.exec(a) ?? /^half past (\d+)$/.exec(a);
  if (m) { const h = Number(m[1]); return [`${(h % 12) + 1} o'clock`, `half past ${(h % 12) + 1}`, `${h === 1 ? 12 : h - 1} o'clock`, `half past ${h === 1 ? 12 : h - 1}`, `${h} o'clock`, `half past ${h}`]; }
  m = /^(\d+)√3$/.exec(a);
  if (m) { const k = Number(m[1]); return [`${k * 2}√3`, `${k}√2`, `${k * 3}`]; }
  m = /^(\d+)–(\d+)$/.exec(a);
  if (m) { const [x, y] = [Number(m[1]), Number(m[2])]; const w = y - x; return [`${x + w}–${y + w}`, `${Math.max(0, x - w)}–${Math.max(w, y - w)}`, `${x + 2 * w}–${y + 2 * w}`]; }
  return [];
}
