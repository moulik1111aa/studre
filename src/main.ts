// Boot: restore the save (native mirror on Android). The very first launch plays the opening
// video (reel.ts) and then setup; later launches go straight to "Who's playing?".

import { App, errorScreen } from './ui/app.ts';
import { openerScreen } from './ui/opener.ts';
import { nativeBridge, nativeStorage } from './platform/native.ts';
import { browserStorage, PLUS_THEMES } from './storage/save.ts';
import { welcomeScreen, startSetup } from './ui/setup.ts';
import { whosPlayingScreen } from './ui/whos.ts';
// #unless play
import { seedDemo } from './ui/demo.ts';
// #end
// #unless play
import { enterChild, playLevel } from './ui/flow.ts';
// #end
import { startReminders } from './ui/remindsync.ts';
import { startInbox } from './ui/inbox.ts';
// #unless play
import { accessState, lockScreen } from './ui/access.ts';
import { ownerScreen } from './ui/owner.ts';
import { installTestHooks } from './testhooks.ts';
// #end
import { startCloud } from './ui/cloud.ts';
import { hasPlus, onPlusChange, plusState, startPlus, storeBuild } from './ui/membership.ts';


/** The app once it exists, so a start-up failure can still offer "Save a copy of my data". */
let theApp: App | undefined;

async function boot(): Promise<void> {
  const native = nativeBridge();
  const storage = native ? await nativeStorage(native) : browserStorage();
  const app = new App(document.getElementById('app')!, storage, native);
  theApp = app;
  // Test hooks: browser test runs and screenshots only (never in the Play build).
  // #unless play
  if (app.debug) installTestHooks(app);
  // #end
  const params = new URLSearchParams(location.search);

  // Once a child exists the app opens on "Who's playing?", even if setup was left half-way.
  // When there is a week of unsaved progress, parents see the backup screen first (browser
  // test runs only when they ask for it with &backup).
  const home = () => (app.save.data.children.length ? whosPlayingScreen : welcomeScreen);
  // Access keys: the app opens only with a key for this phone (or on the owner's phone).
  // Browser test runs (?debug) skip it unless they ask for it with &lock.
  // The Play Store build has no keys or approvals: anyone may use it (MN × is sold there), and
  // none of this is in it.
  let locked = false;
  // #unless play
  const gated = !app.storeBuild && (!!native || !app.debug || params.has('lock'));
  // #end
  const gate = async (how: 'fade' | 'liquid' = 'liquid') => {
    // #unless play
    const st = gated ? await accessState(app) : null;
    locked = !!st?.locked;
    if (st?.locked) return void app.show(lockScreen(st, () => void gate()), how);
    // #end
    void app.show(home(), how);
  };
  // #unless play
  // The owner area (not in the Play Store build).
  if (ownerScreen && !app.storeBuild) app.ownerHook = (passed) => {
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
  // #end
  // Shapes, Print and Precision are MN × looks: without MN × (Play build) they show as Notebook until MN × is on
  // again. The saved choice is kept. While MN × is still being checked with Play, the look stays as it was.
  const fitLook = () => {
    const saved = app.save.data.settings.theme;
    if (!PLUS_THEMES.includes(saved) || !storeBuild(app) || new URLSearchParams(location.search).has('theme')) return;
    app.applyTheme(plusState(app) === 'off' ? 'studio' : saved);
  };
  fitLook();
  // When Play's answer changes MN ×: the look again, and the map again (a school syllabus path needs MN ×).
  onPlusChange(() => {
    fitLook();
    if (app.screen?.el.classList.contains('map') && app.maker) void app.show(app.maker, 'fade');
  });
  // Reward photos no reward uses any more (left by older versions, or a sheet closed some
  // other way) are deleted.
  void app.photos.tidy(app.save.data).catch((e) => console.error('photos', e));
  // The phone's reminders and home-screen widgets follow the save (never in the way of opening).
  try {
    startReminders(app);
  } catch (e) {
    console.error('reminders', e);
  }
  // Backup files shared to MN from WhatsApp, Files… restore once the app is open and unlocked.
  try {
    startInbox(app, () => !locked && !!app.screen && !app.screen.el.classList.contains('reel'));
  } catch (e) {
    console.error('inbox', e);
  }
  // MN × (Play Store build): what the Play account owns; school syllabuses need it.
  app.plus = () => hasPlus(app);
  try {
    startPlus(app);
  } catch (e) {
    console.error('plus', e);
  }
  // Google sign-in: keep the family's progress backed up and in sync (when signed in).
  try {
    startCloud(app);
  } catch (e) {
    console.error('cloud', e);
  }
  // #unless play
  const demo = params.get('demo');
  const seeded = app.debug && demo ? seedDemo(app, demo, { coins: Number(params.get('coins')) || 0, age: Number(params.get('age')) || 8, tips: params.has('tips') }) : null;
  if (seeded) {
    const child = app.child!;
    if (params.has('play')) playLevel(app, child, seeded);
    else enterChild(app, child);
    return;
  }
  // #end
  // The very first launch opens with the video (it can't be skipped), then setup.
  // Later launches go straight in. Browser tests can ask for the old start with ?noloader.
  const firstRun = !app.save.data.settings.tourSeen && !app.save.data.children.length;
  if (firstRun && !params.has('noloader')) {
    void app.show(
      openerScreen({
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

void boot().catch((e) => {
  // A start-up failure: show it rather than an empty sky.
  console.error('boot failed', e);
  const root = document.getElementById('app');
  if (root && !root.querySelector('.screen')) {
    root.appendChild(errorScreen(e, theApp).el);
  }
});
