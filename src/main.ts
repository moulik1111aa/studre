// Boot: restore the save (native mirror on Android), show the staged loader (the full one
// on the first launch of the day), then setup for a new install or "Who's playing?".

import { App } from './ui/app.ts';
import { nativeBridge, nativeStorage } from './platform/native.ts';
import { browserStorage } from './storage/save.ts';
import { loaderScreen } from './ui/loader.ts';
import { welcomeScreen } from './ui/setup.ts';
import { whosPlayingScreen } from './ui/whos.ts';
import { seedDemo } from './ui/demo.ts';
import { enterChild, playLevel } from './ui/flow.ts';
import { resultScreen } from './ui/result.ts';
import { showcaseScreen } from './ui/showcase.ts';
import { rewardsScreen } from './ui/rewards.ts';
import { unlockScreen } from './ui/unlock.ts';
import { timesUpScreen } from './ui/timesup.ts';
import { trophyScreen } from './ui/trophy.ts';
import { parentScreen } from './ui/parent.ts';

const LOADER_KEY = 'studyhard.loaderDay';

async function boot(): Promise<void> {
  const native = nativeBridge();
  const storage = native ? await nativeStorage(native) : browserStorage();
  const app = new App(document.getElementById('app')!, storage, native);
  if (app.debug) {
    // Screen factories for screenshots and tests.
    Object.assign(window, { __app: app, __screens: { resultScreen, showcaseScreen, rewardsScreen, unlockScreen, timesUpScreen, trophyScreen, parentScreen, welcomeScreen, whosPlayingScreen, loaderScreen } });
  }
  const params = new URLSearchParams(location.search);

  let full = true;
  try {
    full = localStorage.getItem(LOADER_KEY) !== app.today;
    localStorage.setItem(LOADER_KEY, app.today);
  } catch {
    /* storage blocked: always show the full loader */
  }
  const start = () => void app.show(app.save.data.setupDone && app.save.data.children.length ? whosPlayingScreen : welcomeScreen, 'liquid');
  const demo = params.get('demo');
  const seeded = app.debug && demo ? seedDemo(app, demo, { coins: Number(params.get('coins')) || 0, age: Number(params.get('age')) || 8 }) : null;
  if (seeded) {
    const child = app.child!;
    if (params.has('play')) playLevel(app, child, seeded);
    else enterChild(app, child);
    return;
  }
  if (params.has('noloader')) {
    void app.show(app.save.data.setupDone && app.save.data.children.length ? whosPlayingScreen : welcomeScreen);
    return;
  }
  void app.show(loaderScreen(start, full));
}

void boot();
