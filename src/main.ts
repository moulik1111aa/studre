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

const LOADER_KEY = 'studyhard.loaderDay';

async function boot(): Promise<void> {
  const native = nativeBridge();
  const storage = native ? await nativeStorage(native) : browserStorage();
  const app = new App(document.getElementById('app')!, storage, native);
  if (app.debug) (window as unknown as { __app: App }).__app = app;
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
  if (app.debug && demo && seedDemo(app, demo, { coins: Number(params.get('coins')) || 0, age: Number(params.get('age')) || 8 })) {
    const child = app.child!;
    if (params.has('play')) playLevel(app, child, app.path.find((l) => l.id === demo)!);
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
