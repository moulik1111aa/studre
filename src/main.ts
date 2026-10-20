// Boot: restore the save (native mirror on Android). The very first launch plays the opening
// video (reel.ts) and then setup; later launches go straight to "Who's playing?".

import { App } from './ui/app.ts';
import { nativeBridge, nativeStorage } from './platform/native.ts';
import { browserStorage } from './storage/save.ts';
import { reelScreen } from './ui/reel.ts';
import { welcomeScreen, startSetup } from './ui/setup.ts';
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
import { showLesson } from './ui/lesson.ts';
import { accessState, lockScreen, ownerScreen } from './ui/access.ts';
import * as addsub from './core/teach/addsub.ts';
import * as muldiv from './core/teach/muldiv.ts';
import * as fractions from './core/teach/fractions.ts';
import { skillById } from './core/areas/index.ts';
import { makeQuestion } from './core/path.ts';
import { createRng } from './core/rng.ts';


async function boot(): Promise<void> {
  const native = nativeBridge();
  const storage = native ? await nativeStorage(native) : browserStorage();
  const app = new App(document.getElementById('app')!, storage, native);
  if (app.debug) {
    // Screen factories for screenshots and tests.
    Object.assign(window, { __app: app, __screens: { resultScreen, showcaseScreen, rewardsScreen, unlockScreen, timesUpScreen, trophyScreen, parentScreen, welcomeScreen, whosPlayingScreen } });
    // Lessons: open one for a skill's question, or for a hand-made question.
    Object.assign(window, {
      __T: { addsub, muldiv, fractions },
      __showLesson: (q: Parameters<typeof showLesson>[1], given: string | null) => showLesson(app, q, given),
      __lesson: (id: string, seed = 'demo', given: string | null = null, d = 0.6) => {
        const s = skillById(id);
        if (!s) throw new Error(`no skill ${id}`);
        const q = makeQuestion(s, createRng(seed), d, new Set());
        return { q, done: showLesson(app, q, given ?? q.distractors[0] ?? null) };
      },
    });
  }
  const params = new URLSearchParams(location.search);

  // Once a child exists the app opens on "Who's playing?", even if setup was left half-way.
  const home = () => (app.save.data.children.length ? whosPlayingScreen : welcomeScreen);
  // Access keys: the app opens only with a key for this phone (or on the owner's phone).
  // Browser test runs (?debug) skip it unless they ask for it with &lock.
  const gated = !!native || !app.debug || params.has('lock');
  let locked = false;
  const gate = async (how: 'fade' | 'liquid' = 'liquid') => {
    const st = gated ? await accessState(app) : null;
    locked = !!st?.locked;
    if (st?.locked) void app.show(lockScreen(st, () => void gate()), how);
    else void app.show(home(), how);
  };
  app.ownerHook = (passed) => {
    // Back from the owner area: carry on where the owner was (a check that opened it counts as
    // passed), or open the app if it was locked.
    const back = app.maker;
    const fromLock = !!app.screen?.el.classList.contains('lock');
    void app.show(
      ownerScreen(() => {
        const owner = app.screen;
        if (fromLock || !back) return void gate('fade');
        passed();
        setTimeout(() => {
          if (app.screen === owner) void app.show(back, 'fade');
        }, 120);
      }),
      'liquid',
    );
  };
  // Back from the background on a new day: check the key again.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !gated || locked) return;
    const st = await accessState(app);
    if (st.locked) {
      locked = true;
      void app.show(lockScreen(st, () => void gate()));
    }
  });
  const demo = params.get('demo');
  const seeded = app.debug && demo ? seedDemo(app, demo, { coins: Number(params.get('coins')) || 0, age: Number(params.get('age')) || 8, tips: params.has('tips') }) : null;
  if (seeded) {
    const child = app.child!;
    if (params.has('play')) playLevel(app, child, seeded);
    else enterChild(app, child);
    return;
  }
  // The very first launch opens with the video (it can't be skipped), then setup.
  // Later launches go straight in. Browser tests can ask for the old start with ?noloader.
  const firstRun = !app.save.data.settings.tourSeen && !app.save.data.children.length;
  if (firstRun && !params.has('noloader')) {
    void app.show(
      reelScreen({
        first: true,
        label: 'Let’s set up',
        done: () => {
          void gate('fade').then(() => {
            if (!locked && !app.save.data.children.length) void startSetup(app);
          });
        },
      }),
      'fade',
    );
    return;
  }
  void gate('fade');
}

void boot();
