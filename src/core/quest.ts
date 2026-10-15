// Side quests (unlocked by beating a boss): 100 quick questions in 300 seconds drawn from
// every skill before that boss. Optional and replayable — they keep earlier skills sharp.

import type { Level, Progress } from './path.ts';
import { isPassed } from './path.ts';

export const QUEST = { questions: 100, seconds: 300 };

export interface SideQuest {
  id: string;
  stage: number;
  /** The boss level that unlocks it. */
  bossLevelId: string;
  skillIds: string[];
}

export function questsFor(path: Level[]): SideQuest[] {
  const out: SideQuest[] = [];
  for (const l of path) {
    if (l.kind !== 'boss') continue;
    // Everything up to this boss in its stage, plus the stage before (brain gym, not new work).
    const before = path.filter((x) => x.index < l.index && x.kind === 'skill' && x.stage >= l.stage - 1 && x.tier === 1);
    out.push({ id: `quest:${l.id}`, stage: l.stage, bossLevelId: l.id, skillIds: before.map((x) => (x as { skillId: string }).skillId) });
  }
  return out;
}

export const questUnlocked = (path: Level[], p: Progress, q: SideQuest): boolean => {
  const boss = path.find((l) => l.id === q.bossLevelId);
  return !!boss && isPassed(p, boss);
};

/** Stars for a side quest score (out of 100). */
export const questStars = (correct: number): 0 | 1 | 2 | 3 => (correct >= 90 ? 3 : correct >= 70 ? 2 : correct >= 40 ? 1 : 0);
