// The learning path: levels built from skills, the rules for each level type,
// unlocking, stars and mastery. Pure logic — the screens and fights sit on top.

import type { Area } from './areas/index.ts';
import type { Skill } from './skill.ts';
import type { Rng } from './rng.ts';
import { vary } from './variety.ts';
import { buildChoices, normalise, type Question } from './question.ts';

export type Tier = 1 | 2 | 3 | 4 | 5;
export const TIER_NAMES: Record<Tier, string> = { 1: 'Learn', 2: 'Practice', 3: 'Practise more', 4: 'Speed', 5: 'Master' };

export type Level =
  | { kind: 'skill'; id: string; index: number; stage: number; skillId: string; tier: Tier }
  | { kind: 'review'; id: string; index: number; stage: number; skillIds: string[]; n: number }
  | { kind: 'boss'; id: string; index: number; stage: number; boss: 'mid' | 'final'; phases: string[][] };

type LevelDraft = Level extends infer L ? (L extends Level ? Omit<L, 'index'> : never) : never;

/** Every level of an area, in path order. */
export function buildPath(area: Area): Level[] {
  const levels: Level[] = [];
  const push = (l: LevelDraft) => levels.push({ ...l, index: levels.length } as Level);
  area.skills.forEach((skills, si) => {
    const stage = si + 1;
    const midAt = Math.floor(skills.length / 2);
    let review = 0;
    skills.forEach((s, i) => {
      for (const tier of [1, 2, 3, 4, 5] as Tier[]) push({ kind: 'skill', id: `${s.id}#${tier}`, stage, skillId: s.id, tier });
      if ((i + 1) % 5 === 0) {
        review++;
        push({ kind: 'review', id: `review:${area.id}:${stage}:${review}`, stage, skillIds: skills.slice(i - 4, i + 1).map((x) => x.id), n: review });
      }
      if (i + 1 === midAt) push({ kind: 'boss', id: `boss:${area.id}:${stage}:mid`, stage, boss: 'mid', phases: thirds(skills.slice(0, midAt)) });
    });
    push({ kind: 'boss', id: `boss:${area.id}:${stage}:final`, stage, boss: 'final', phases: thirds(skills) });
  });
  return levels;
}

function thirds(skills: Skill[]): string[][] {
  const n = skills.length;
  const a = Math.ceil(n / 3);
  const b = Math.ceil((2 * n) / 3);
  return [skills.slice(0, a), skills.slice(a, b), skills.slice(b)].map((g) => g.map((s) => s.id));
}

// ── progress ───────────────────────────────────────────────────────────────

export interface LevelResult {
  stars: 0 | 1 | 2 | 3;
  passes: number;
}

export interface Progress {
  /** Level id → best result. A level is passed when stars ≥ 1. */
  levels: Record<string, LevelResult>;
  /** Skill ids placed past by placement (open on the map, 0 stars until passed). */
  skipped: Record<string, true>;
  /** Skill id → local day (YYYY-MM-DD) it was last practised. */
  lastSeen: Record<string, string>;
  /** Skill id → keys of the last 50 questions (no repeats). */
  history: Record<string, string[]>;
  /** Single levels a parent chose to skip (0 stars, no coins). */
  skippedLevels?: Record<string, true>;
  /** Side quest id → best score out of 100. */
  questBest?: Record<string, number>;
}

export const freshProgress = (): Progress => ({ levels: {}, skipped: {}, lastSeen: {}, history: {} });

export const isPassed = (p: Progress, l: Level): boolean => (p.levels[l.id]?.stars ?? 0) >= 1;

/** Skipped by placement: a skill level whose skill was skipped, or a review/boss whose skills all were. */
export function isSkipped(p: Progress, l: Level): boolean {
  if (p.skippedLevels?.[l.id]) return true;
  if (l.kind === 'skill') return !!p.skipped[l.skillId];
  if (l.kind === 'review') return l.skillIds.every((s) => p.skipped[s]);
  return l.phases.flat().every((s) => p.skipped[s]);
}

export const isDone = (p: Progress, l: Level): boolean => isPassed(p, l) || isSkipped(p, l);

/** Index of the next level to play: the first one neither passed nor skipped. */
export function frontier(path: Level[], p: Progress): number {
  const i = path.findIndex((l) => !isDone(p, l));
  return i === -1 ? path.length : i;
}

export function isPlayable(path: Level[], p: Progress, l: Level): boolean {
  return l.index <= frontier(path, p) || isDone(p, l);
}

export function isMastered(p: Progress, skillId: string): boolean {
  return (p.levels[`${skillId}#5`]?.stars ?? 0) >= 1;
}

/** Stars from a result: pass mark gives 1, 90%+ gives 2, perfect gives 3. */
export function starsFor(correct: number, total: number, passMark: number): 0 | 1 | 2 | 3 {
  if (correct < passMark) return 0;
  if (correct >= total) return 3;
  return correct / total >= 0.9 ? 2 : 1;
}

export function recordResult(p: Progress, levelId: string, stars: 0 | 1 | 2 | 3): { firstPass: boolean } {
  const prev = p.levels[levelId];
  const firstPass = stars >= 1 && (prev?.stars ?? 0) === 0;
  p.levels[levelId] = { stars: Math.max(prev?.stars ?? 0, stars) as 0 | 1 | 2 | 3, passes: (prev?.passes ?? 0) + (stars >= 1 ? 1 : 0) };
  return { firstPass };
}

// ── rounds ─────────────────────────────────────────────────────────────────

export interface RoundRules {
  count: number;
  passMark: number;
  /** Seconds per question; 0 for no timer. */
  timer: number;
  hints: boolean;
  /** Master: needs this many correct in a row (the round lasts up to `count`). */
  streak?: number;
}

export interface Round {
  rules: RoundRules;
  questions: Question[];
}

export function rulesFor(level: Level, skill?: Skill, boost = 0): RoundRules {
  const base = baseRules(level, skill);
  if (!boost || level.kind === 'boss') return base;
  // Harder (1) / toughest (2): no hints, a higher pass mark, and a timer on every level at 2.
  const speed = skill?.speedSec ?? 10;
  return {
    ...base,
    hints: false,
    passMark: base.streak ? base.passMark : Math.min(base.count, base.passMark + boost),
    timer: base.timer || (boost >= 2 ? Math.round(speed * 1.5) : 0),
  };
}

function baseRules(level: Level, skill?: Skill): RoundRules {
  if (level.kind === 'review') return { count: 10, passMark: 10, timer: 0, hints: false };
  if (level.kind === 'boss') return { count: 0, passMark: 0, timer: 0, hints: false };
  const speed = skill?.speedSec ?? 10;
  switch (level.tier) {
    case 1:
      return { count: 8, passMark: 6, timer: 0, hints: true };
    case 2:
      return { count: 10, passMark: 8, timer: 0, hints: true };
    case 3:
      return { count: 10, passMark: 8, timer: 0, hints: false };
    case 4:
      return { count: 10, passMark: 8, timer: speed, hints: false };
    case 5:
      return { count: 15, passMark: 10, timer: Math.round(speed * 1.2), hints: false, streak: 10 };
  }
}

const DIFFICULTY: Record<Tier, [number, number]> = { 1: [0, 0.3], 2: [0, 0.5], 3: [0.3, 1], 4: [0.4, 1], 5: [0.5, 1] };

/** Make one question for a skill, avoiding the keys in `avoid` (retries a few times). */
/** Identity of a question: what is asked and its answer (not the order of the options). */
export const questionKey = (skillId: string, m: { prompt: string; visual?: unknown; answer: string; distractors?: string[]; optionObject?: string }): string =>
  `${skillId}|${m.prompt}|${m.visual ? JSON.stringify(m.visual) : ''}|${m.answer}|${m.optionObject ?? ''}` +
  // When the prompt has no numbers ("Which group has more?"), the options are the question.
  (/\d/.test(m.prompt) ? '' : `|${[...(m.distractors ?? [])].sort().join(',')}`);

const numbersIn = (q: { prompt: string; answer: string }): string[] => [...(q.prompt.match(/\d+(?:\.\d+)?/g) ?? []), q.answer];
/**
 * Too close to a question already in the round: shares three or more numbers (e.g.
 * "12, 16, 20, 24" and "16, 20, 24, 28"), or is the same sum turned around.
 */
export function tooSimilar(a: { prompt: string; answer: string }, b: { prompt: string; answer: string }): boolean {
  const na = numbersIn(a);
  const nb = new Set(numbersIn(b));
  const shared = new Set(na.filter((n) => nb.has(n))).size;
  if (shared >= 3) return true;
  const shape = (p: string) => p.replace(/\d+(?:\.\d+)?/g, '#');
  return shared >= 2 && a.answer === b.answer && shape(a.prompt).length === shape(b.prompt).length;
}

/** A prompt with its numbers blanked out: its layout. */
export const promptShape = (prompt: string): string => prompt.replace(/\d+(\.\d+)?/g, '#');

export function makeQuestion(skill: Skill, rng: Rng, d: number, avoid: Set<string>, choiceCount?: number, last?: string, round: { prompt: string; answer: string; visual?: unknown; distractors?: string[]; optionObject?: string }[] = []): Question {
  const make = () => vary(skill.make(rng, d), rng, skill.stage, d);
  // Not three questions laid out the same way in a row ("10 = 7 + ?", "10 = 6 + ?", …),
  // when the skill has other ways to ask.
  const [p1, p2] = round.slice(-2).map((q) => promptShape(q.prompt));
  const thirdInARow = (prompt: string) => round.length >= 2 && p1 === p2 && promptShape(prompt) === p1;
  let made = make();
  // Prefer a question not asked recently and not like one already in this round; then at
  // least one not already in this round; never the same as the one just asked.
  for (let tries = 0; tries < 80; tries++) {
    const k = questionKey(skill.id, made);
    const inRound = round.some((q) => questionKey(skill.id, q) === k);
    const fresh = !avoid.has(k) && !round.some((q) => tooSimilar(made, q)) && !thirdInARow(made.prompt);
    if (k !== last && (fresh || (tries >= 40 && !inRound) || tries >= 70)) break;
    made = make();
  }
  const n = choiceCount ?? (skill.format === 'picture' ? 3 : 4);
  return { ...made, skillId: skill.id, format: skill.format, choices: buildChoices(rng, made.answer, made.distractors, n), key: questionKey(skill.id, made), d };
}

/**
 * A fresh question in place of one that was on screen when play was paused, so pausing
 * cannot buy thinking time: same skill, difficulty and answer style, different numbers
 * and a different answer.
 */
export function replaceQuestion(q: Question, skill: Skill, rng: Rng, avoid: Set<string>, round: Question[] = []): Question {
  const others = round.filter((o) => o.key !== q.key);
  let fresh = q;
  for (let t = 0; t < 15 && (fresh.key === q.key || sameAnswer(fresh.answer, q.answer)); t++) {
    fresh = makeQuestion(skill, rng, q.d ?? 0.5, new Set([...avoid, q.key]), q.choices.length, q.key, others);
  }
  return fresh;
}

/**
 * Build a round of questions for a skill or review level.
 * `earlier` are skills before this one on the path (for Practise-more mix-ins);
 * `warmup` are mastered skills due for revision (at most 2 are added at the start).
 */
export function makeRound(level: Level, skillsById: (id: string) => Skill | undefined, p: Progress, rng: Rng, earlier: Skill[] = [], warmup: Skill[] = [], boost = 0): Round {
  if (level.kind === 'boss') throw new Error('boss levels use the fight engine');
  const questions: Question[] = [];
  const seen = new Set<string>();
  const histFor = (id: string) => new Set(p.history[id] ?? []);
  const add = (s: Skill, d: number) => {
    const avoid = new Set([...seen, ...histFor(s.id)]);
    const q = makeQuestion(s, rng, d, avoid, undefined, questions.at(-1)?.key, questions);
    seen.add(q.key);
    questions.push(q);
  };
  for (const w of warmup.slice(0, 2)) add(w, 0.6);
  if (level.kind === 'review') {
    const skills = level.skillIds.map((id) => skillsById(id)!).filter(Boolean);
    for (let i = 0; i < 10; i++) add(skills[i % skills.length], Math.min(1, 0.5 + 0.2 * boost + 0.5 * rng.next()));
    return { rules: rulesFor(level, undefined, boost), questions: [...questions.slice(0, warmup.length), ...rng.shuffle(questions.slice(warmup.length))] };
  }
  const skill = skillsById(level.skillId)!;
  const rules = rulesFor(level, skill, boost);
  const [lo0, hi0] = DIFFICULTY[level.tier];
  const lo = Math.min(1, lo0 + 0.3 * boost);
  const hi = Math.min(1, hi0 + 0.3 * boost);
  const others = earlier.filter((e) => e.id !== skill.id);
  const mix = level.tier === 3 && others.length ? 2 : 0;
  const own = rules.count - mix;
  for (let i = 0; i < own; i++) add(skill, lo + ((hi - lo) * i) / Math.max(1, own - 1));
  for (let i = 0; i < mix; i++) add(rng.pick(others.slice(-8)), 0.7);
  if (mix) {
    // place the mix-ins in the middle and end, not first
    const tail = questions.splice(questions.length - mix, mix);
    questions.splice(Math.floor(questions.length / 2), 0, tail[0]);
    if (tail[1]) questions.push(tail[1]);
  }
  return { rules, questions };
}

/** Remember asked questions (last 50 per skill) and when each skill was practised. */
export function noteAsked(p: Progress, qs: Question[], day: string): void {
  for (const q of qs) {
    const h = (p.history[q.skillId] ??= []);
    h.push(q.key);
    if (h.length > 50) h.splice(0, h.length - 50);
    p.lastSeen[q.skillId] = day;
  }
}

/** Mastered skills not practised for 14+ days (most overdue first). */
export function dueForRevision(p: Progress, skills: Skill[], today: string): Skill[] {
  const age = (d?: string) => (d ? (Date.parse(today) - Date.parse(d)) / 86400000 : Infinity);
  return skills.filter((s) => isMastered(p, s.id) && age(p.lastSeen[s.id]) >= 14).sort((a, b) => age(p.lastSeen[b.id]) - age(p.lastSeen[a.id]));
}

/** Compare an answer with normalisation (used by the round runner). */
export const sameAnswer = (a: string, b: string): boolean => normalise(a) === normalise(b);
