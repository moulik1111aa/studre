// A paper worksheet: the last 3 or 4 skills a child played, mixed together, so the sheet
// practises exactly what they've been doing in MN. Each skill gets a fair share of the sheet,
// at about the level they reached in it, and no two questions in a row are the same skill.
// A child who hasn't played enough yet gets the skill they're on now and the ones just before.

import { frontier, forAge, isPassed, type Level, type Progress } from './path.ts';
import type { FixHolder } from './fixit.ts';
import type { PlayEntry } from './stats.ts';
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
  /** Placement has run (their first play). Until then the map hasn't moved them up to their age. */
  placed?: boolean;
  /** The play log, newest last: what was answered in each game. */
  log?: PlayEntry[];
}

/** Skills on a sheet: the most recently played, up to this many. */
export const SHEET_SKILLS = 4;

/** The stage meant for an age: stage s is for ages 2s+1 and 2s+2. */
export const stageForAge = (age: number): number => Math.min(7, Math.max(1, Math.ceil((age - 2) / 2)));

/** Questions on a sheet: fewer, bigger ones for little children. */
export const sheetSize = (age: number): number => (age <= 6 ? 12 : 20);

/** Difficulty for the skill in progress, from the tier the child has reached. */
const TIER_D = [0.25, 0.4, 0.55, 0.7, 0.85];

/** The skills played most recently (newest first), from the play log's answers. */
export function lastPlayedSkills(log: PlayEntry[] | undefined, known: (id: string) => boolean, n = SHEET_SKILLS): string[] {
  const out: string[] = [];
  const entries = [...(log ?? [])].sort((x, y) => y.t - x.t);
  for (const e of entries) {
    // Within one game, the skill answered most often counts first.
    const ids = Object.entries(e.a ?? {})
      .filter(([id, [asked]]) => asked > 0 && known(id))
      .sort(([, [a1]], [, [a2]]) => a2 - a1)
      .map(([id]) => id);
    for (const id of ids) if (!out.includes(id)) out.push(id);
    if (out.length >= n) break;
  }
  return out.slice(0, n);
}

export function worksheetPlan(c: SheetChild, path: Level[], _today: string, rng: Rng, stageOf: (skillId: string) => number | undefined, n = sheetSize(c.age)): SheetItem[] {
  const skillLevels = path.filter((l): l is Extract<Level, { kind: 'skill' }> => l.kind === 'skill');
  if (!skillLevels.length) return [];
  const onPath = new Set(skillLevels.map((l) => l.skillId));
  const played = lastPlayedSkills(c.log, (id) => onPath.has(id) && !!stageOf(id));

  // Not enough played yet: the skill they're on now and the ones just before it.
  if (played.length < 3) {
    const front = frontier(path, c.progress);
    let nowLevel = skillLevels.find((l) => l.index >= front) ?? skillLevels[skillLevels.length - 1];
    // Before their first play (placement), a child is still at the start of the map: begin at
    // the stage for their age, as placement would.
    const ageStage = stageForAge(c.age);
    if (!c.placed && (stageOf(nowLevel.skillId) ?? 1) < ageStage) nowLevel = skillLevels.find((l) => (stageOf(l.skillId) ?? 1) >= ageStage && l.tier === 1) ?? nowLevel;
    const order = [...new Set(skillLevels.filter((l) => l.index <= nowLevel.index).map((l) => l.skillId))].reverse();
    for (const id of order) if (played.length < 3 && !played.includes(id)) played.push(id);
  }

  // About the level reached in each skill: the highest step passed, a little either side.
  const tierOf = (id: string) => {
    let t = 1;
    for (let k = 1; k <= 5; k++) if (isPassed(c.progress, { id: `${id}#${k}` } as Level)) t = Math.min(5, k + 1);
    return t;
  };
  const perSkill = played.map((id, i) => {
    const share = Math.floor(n / played.length) + (i < n % played.length ? 1 : 0);
    const base = TIER_D[Math.min(4, tierOf(id) - 1)];
    return Array.from({ length: share }, (_, k) => ({ skillId: id, d: Math.round(forAge(Math.min(1, Math.max(0.2, base - 0.1 + (0.25 * k) / Math.max(1, share - 1))), c.age, stageOf(id) ?? 1) * 100) / 100, why: (i === 0 ? 'now' : 'recent') as SheetItem['why'] }));
  });
  // Mixed: round by round, each skill once per round in a shuffled order, so the sheet gets
  // a little harder as it goes and never has the same skill twice in a row.
  const items: SheetItem[] = [];
  let last = '';
  for (let r = 0; items.length < n && r < n; r++) {
    const round = rng.shuffle(perSkill.filter((l) => l[r]).map((l) => l[r]));
    if (round.length > 1 && round[0].skillId === last) round.push(round.shift()!);
    for (const q of round) items.push(q);
    last = items.at(-1)?.skillId ?? '';
  }
  return items.slice(0, n);
}
