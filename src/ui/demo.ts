// Debug-only demo saves for screenshots and end-to-end tests (`?debug&demo=<level id>`):
// one placed child with rewards chosen and every level before the given one passed.
// `@N` picks the level by its position on the path instead of its id.

import type { App } from './app.ts';
import type { Level } from '../core/path.ts';
import { newChild } from '../storage/save.ts';
import { chooseReward } from '../core/economy.ts';

export function seedDemo(app: App, levelId: string, opts: { coins?: number; age?: number } = {}): Level | null {
  const at = levelId.startsWith('@') ? Number(levelId.slice(1)) : app.path.findIndex((l) => l.id === levelId);
  if (!(at >= 0 && at < app.path.length)) return null;
  const c = newChild('Riya', opts.age ?? 8, 0, app.today);
  c.placed = true;
  for (const l of app.path.slice(0, at)) c.progress.levels[l.id] = { stars: 3, passes: 1 };
  chooseReward(c.wallet, 'sweets.milk-chocolate-bar');
  chooseReward(c.wallet, 'toys.toy-car');
  if (opts.coins) {
    c.wallet.treat.coins = opts.coins;
    c.wallet.goal.coins = opts.coins / 4;
  }
  c.wallet.lastPlayDay = app.today;
  app.save.update((d) => {
    d.setupDone = true;
    d.children = [c];
    d.activeChildId = c.id;
  });
  return app.path[at];
}
