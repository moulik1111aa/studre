// Where a child goes next: melting, waiting rewards, placement, choosing rewards, the map,
// and the daily time limit. Screens call these instead of knowing the whole flow.

import type { App } from './app.ts';
import type { Child } from '../storage/save.ts';
import { applyMelt, secondsLeft } from '../core/economy.ts';
import type { Level } from '../core/path.ts';
import { mapScreen } from './map.ts';
import { placementScreen } from './placement.ts';
import { rewardsScreen } from './rewards.ts';
import { unlockScreen, meltedScreen } from './unlock.ts';
import { levelScreen } from './level.ts';
import { fightScreen } from './fight.ts';
import { timesUpScreen } from './timesup.ts';
import { whosPlayingScreen } from './whos.ts';
import { worldColors } from './worlds.ts';
import { voiceChoiceScreen, useVoice } from './voicechoice.ts';
import { belowAge } from '../core/placement.ts';
import { AREAS } from '../core/areas/index.ts';

export function enterChild(app: App, child: Child, how: 'fade' | 'liquid' = 'fade', checkMelt = true): void {
  app.save.update((d) => {
    d.activeChildId = child.id;
    // Levels follow age: anything below the child's age stage is out of the way (still open
    // on the map). Also moves children placed by older versions up to their age.
    if (child.placed) for (const id of belowAge(child.age, AREAS[0].skills.flat())) child.progress.skipped[id] = true;
  });
  useVoice(app, child);
  if (checkMelt) {
    let lost = { treat: 0, goal: 0, days: 0 };
    app.save.update(() => (lost = applyMelt(child.wallet, app.today, app.save.data.settings.holiday)));
    if (lost.treat > 0 || lost.goal > 0) {
      void app.show(meltedScreen(child, lost), how);
      return;
    }
  }
  const w = child.wallet;
  if (w.treat.waiting) return void app.show(unlockScreen(child, 'treat'), how);
  if (w.goal.waiting) return void app.show(unlockScreen(child, 'goal'), how);
  if (!child.placed) return void app.show(placementScreen(child), how);
  if (!w.treat.rewardId || !w.goal.rewardId) return void app.show(rewardsScreen(child, !w.treat.rewardId ? 'treat' : 'goal'), how);
  // First time: the child picks who reads to them, then Biscuit shows them the map.
  if (!child.voicePicked) return void app.show(voiceChoiceScreen(child, () => void app.show(mapScreen(child), 'liquid')), how);
  void app.show(mapScreen(child), how);
}

export function goHome(app: App): void {
  const c = app.child;
  if (c) enterChild(app, c, 'fade', false);
  else void app.show(whosPlayingScreen);
}

/** Is there time left today? (In "keep playing" mode, play continues without coins.) */
export function timeState(app: App, child: Child): 'ok' | 'stop' | 'no-coins' {
  if (child.tester) return 'ok';
  const left = secondsLeft(child.wallet, app.today, app.save.data.settings.limitMinutes);
  if (left > 0) return 'ok';
  return app.save.data.settings.timeUpMode === 'stop' ? 'stop' : 'no-coins';
}

export function playLevel(app: App, child: Child, level: Level, harder = false): void {
  if (timeState(app, child) === 'stop') {
    void app.show(timesUpScreen(child));
    return;
  }
  const make = level.kind === 'skill' ? levelScreen(child, level, harder) : fightScreen(child, level);
  const screen = make;
  void app.show((a) => {
    const s = screen(a);
    s.colors = worldColors(level.stage);
    return s;
  }, 'liquid');
}
