// When new skills join the road, a child who is already past where they go isn't sent back:
// new stops behind the child's furthest level open as "skipped" (playable, no stars yet), and
// minion fights and bosses behind it whose groups changed are skipped too. Runs once per
// road version for each child.
import type { Child } from '../storage/save.ts';
import { isDone, isPassed, type Level } from './path.ts';

/** Bump when skills are added in the middle of the road. */
export const ROAD_VERSION = 2;

export function catchUp(child: Child, path: Level[]): boolean {
  if ((child.roadV ?? 1) >= ROAD_VERSION) return false;
  child.roadV = ROAD_VERSION;
  const p = child.progress;
  let furthest = -1;
  path.forEach((l, i) => {
    if (isPassed(p, l)) furthest = i;
  });
  if (furthest < 0) return true;
  for (let i = 0; i < furthest; i++) {
    const l = path[i];
    if (isDone(p, l)) continue;
    if (l.kind === 'skill') {
      // Skip the whole skill only if none of its levels was played (a new skill).
      const played = path.some((x) => x.kind === 'skill' && x.skillId === l.skillId && (p.levels[x.id]?.stars ?? 0) > 0);
      if (!played) p.skipped[l.skillId] = true;
      else (p.skippedLevels ??= {})[l.id] = true;
    } else (p.skippedLevels ??= {})[l.id] = true;
  }
  return true;
}
