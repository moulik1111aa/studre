// Certificates (MN ×): one for each challenge a child has beaten on the map. Beating a stage's
// final challenge also finishes that stage, so its certificate says so. The day comes from the
// play log (the first time it was won); nothing extra is stored.

import { bossFor } from './boss.ts';
import { isPassed, type Level, type Progress } from './path.ts';
import type { PlayEntry } from './stats.ts';

export interface Cert {
  /** The boss level's id. */
  id: string;
  kind: 'challenge' | 'stage';
  stage: number;
  boss: string;
  bossId: string;
  /** First day it was won, when the play log still has it. */
  day?: string;
}

export function certificatesFor(path: Level[], progress: Progress, log: PlayEntry[] = []): Cert[] {
  const firstWin = new Map<string, string>();
  for (const e of log) if (e.s >= 1 && (!firstWin.has(e.id) || e.d < firstWin.get(e.id)!)) firstWin.set(e.id, e.d);
  return path
    .filter((l): l is Extract<Level, { kind: 'boss' }> => l.kind === 'boss' && isPassed(progress, l))
    .map((l) => ({ id: l.id, kind: l.boss === 'final' ? 'stage' : 'challenge', stage: l.stage, boss: bossFor(l.stage, l.boss).name, bossId: bossFor(l.stage, l.boss).id, day: firstWin.get(l.id) }));
}
