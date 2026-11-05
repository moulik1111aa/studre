// A paper worksheet: which skills go on it, and how hard. Study time away from the screen,
// made from the child's own place on the path: mostly the skill they are on now, a few from
// just before it, the Fix-it skills still coming back, and some older ones to keep fresh.

import { frontier, forAge, isPassed, type Level, type Progress } from './path.ts';
import { dueFix, type FixHolder } from './fixit.ts';
import type { Rng } from './rng.ts';

export interface SheetItem {
  skillId: string;
  /** Difficulty, already adjusted for age. */
  d: number;
  why: 'now' | 'recent' | 'fixit' | 'review';
}

export interface SheetChild extends FixHolder {
  age: number;
  progress: Progress;
}

/** Questions on a sheet: fewer, bigger ones for little children. */
export const sheetSize = (age: number): number => (age <= 6 ? 12 : 20);

/** Difficulty for the skill in progress, from the tier the child has reached. */
const TIER_D = [0.25, 0.4, 0.55, 0.7, 0.85];

export function worksheetPlan(c: SheetChild, path: Level[], today: string, rng: Rng, stageOf: (skillId: string) => number | undefined, n = sheetSize(c.age)): SheetItem[] {
  const skillLevels = path.filter((l): l is Extract<Level, { kind: 'skill' }> => l.kind === 'skill');
  const front = frontier(path, c.progress);
  // The skill the child is on now: the first skill level at or after the frontier (or the last one).
  const nowLevel = skillLevels.find((l) => l.index >= front) ?? skillLevels[skillLevels.length - 1];
  if (!nowLevel) return [];
  const passedSkills: string[] = [];
  for (const l of skillLevels) if (l.index < nowLevel.index && isPassed(c.progress, l) && !passedSkills.includes(l.skillId) && l.skillId !== nowLevel.skillId) passedSkills.push(l.skillId);
  const recent = passedSkills.slice(-3).reverse();
  // Older ones to keep fresh: from the stage in progress or the one before it, not far below.
  const nowStage = stageOf(nowLevel.skillId) ?? 1;
  const older = passedSkills.slice(0, -3).filter((id) => (stageOf(id) ?? 0) >= nowStage - 1);
  const age = (id: string, d: number) => forAge(d, c.age, stageOf(id) ?? 1);

  const items: SheetItem[] = [];
  const add = (skillId: string, d: number, why: SheetItem['why']) => items.length < n && items.push({ skillId, d: Math.round(d * 100) / 100, why });

  // Fix-it skills first (at most a fifth of the sheet), at the difficulty they were missed.
  const fix = dueFix(c, '9999-12-31', (id) => !!stageOf(id), Math.ceil(n / 5));
  for (const f of fix) add(f.skillId, f.d, 'fixit');
  // Older skills to keep fresh: a fifth of the sheet.
  for (const id of rng.shuffle([...older]).slice(0, Math.floor(n / 5))) add(id, age(id, 0.6), 'review');
  // The few just before now: two each.
  for (const id of recent) for (const d of [0.5, 0.7]) add(id, age(id, d), 'recent');
  // The rest: the skill in progress, getting a little harder down the page.
  const base = TIER_D[nowLevel.tier - 1];
  const left = n - items.length;
  for (let k = 0; k < left; k++) add(nowLevel.skillId, age(nowLevel.skillId, Math.min(1, base + (0.2 * k) / Math.max(1, left - 1))), 'now');
  // Easier ones first: the skill in progress, then recent, review and Fix-it.
  const order: SheetItem['why'][] = ['now', 'recent', 'review', 'fixit'];
  return items.sort((a, b) => order.indexOf(a.why) - order.indexOf(b.why) || a.d - b.d);
}
