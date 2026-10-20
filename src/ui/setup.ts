// First-run setup (grown-up): add children, set the daily limit and what happens at time-up.

import { html, esc, type App, type Screen } from './app.ts';
import { newChild } from '../storage/save.ts';
import { AVATARS, avatarHtml } from './icons.ts';
import { logoMark } from './loader.ts';
import { stagger, popIn } from '../render/motion.ts';
import { whosPlayingScreen } from './whos.ts';
import { setPace } from '../core/rewards.ts';
import { recheckJars } from '../core/economy.ts';
import { reelScreen } from './reel.ts';
import { lockSetupScreen } from './grownup.ts';
import { isOwnerCode } from '../core/access.ts';

/** [multiplier, label, note] — relative to the calibrated pace (treat ≈ every 10 days, big toy ≈ 3 months). */
const TREAT_PACES: [number, string, string][] = [[0.3, 'Every 3 days', 'Often'], [0.7, 'Every week', 'Faster'], [1, 'Every 10 days', 'Normal'], [3, 'Every month', 'Rare']];
const GOAL_PACES: [number, string, string][] = [[0.33, 'In 1 month', 'Fast'], [0.67, 'In 2 months', 'Faster'], [1, 'In 3 months', 'Normal'], [2, 'In 6 months', 'Rare']];
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** A grown-up check, then setup: the grown-up lock (first time), then the first child. */
export async function startSetup(app: App): Promise<void> {
  if (!(await app.grownUp('Setting up'))) return;
  void app.show(app.save.data.settings.parentPin ? addChildScreen(true) : lockSetupScreen(addChildScreen(true), true));
}

export function welcomeScreen(app: App): Screen {
  // First time: the opening video comes first (it can't be skipped), then setup.
  const seen = !!app.save.data.settings.tourSeen;
  const el = html(`<section class="screen welcome" aria-label="Welcome">
    <div class="wl-hero">${logoMark()}<h1 class="wordmark"><span>M</span><span>N</span></h1><p class="wl-full">Mission Next</p>
    <p class="subtitle">Maths from age 3 to 16, one small step at a time.<br>Real rewards. Boss fights. Big smiles.</p></div>
    ${seen ? '<button class="btn start">Set up for my child</button><button class="btn ghost tour-btn">▶ Watch the video again</button>' : '<button class="btn tour-btn">▶ Start</button>'}
    <p class="fine">${seen ? 'A grown-up sets things up, in about 2 minutes.' : 'First, a one-minute video on how MN works. Then a grown-up sets up, in about 2 minutes.'}</p>
  </section>`);
  el.querySelector('.start')?.addEventListener('click', () => void startSetup(app));
  el.querySelector('.tour-btn')!.addEventListener('click', () =>
    void app.show(reelScreen({ first: !seen, label: 'Set up for my child', done: () => (void app.show(welcomeScreen), void startSetup(app)), leave: () => void app.show(welcomeScreen) }), 'liquid'),
  );
  return {
    el,
    mounted: () => {
      const mark = el.querySelector<SVGElement>('svg')!;
      popIn(mark, 0, 0.9);
      mark.classList.add('alive');
      stagger(el.querySelectorAll('.wordmark span, .subtitle, .tour-btn, .start, .fine'), { delay: 500, gap: 120 });
    },
  };
}

/**
 * Add a child, one question at a time so nothing is missed: name, then age (no guess
 * filled in), then a buddy and whether a grown-up plays along.
 */
export function addChildScreen(firstRun: boolean) {
  return (app: App): Screen => {
    let step = 0;
    let name = '';
    let age = 0;
    let avatar = app.save.data.children.length % AVATARS.length;
    let assisted: boolean | null = null;
    const STOPS = ['Name', 'Age', 'Helper', 'Buddy'];
    const el = html(`<section class="screen add-child" aria-label="Add a child">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">←</button><span class="t">Add a child</span><span style="width:50px"></span></header>
      <div class="stops-slot"></div>
      <div class="scroll ac-body"></div>
      <button class="btn ac-next">Next</button>
    </section>`);
    const body = el.querySelector<HTMLElement>('.ac-body')!;
    const next = el.querySelector<HTMLButtonElement>('.ac-next')!;
    const who = () => esc(name || 'your child');

    const paint = () => {
      el.querySelector('.stops-slot')!.innerHTML = stopsHtml(STOPS, step);
      if (step === 0) {
        body.innerHTML = `<h1 class="ac-q">What is your child’s name?</h1>
          <label class="field"><input class="name ac-name" maxlength="20" placeholder="e.g. Riya" autocomplete="off" value="${esc(name)}" aria-label="Child’s name"></label>
          <p class="fine">Only shown on this phone.</p>`;
        const input = body.querySelector<HTMLInputElement>('.name')!;
        const sync = () => {
          name = input.value.trim();
          next.disabled = !name;
        };
        input.addEventListener('input', sync);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && name) go(1);
        });
        sync();
        next.textContent = 'Next';
        setTimeout(() => input.focus(), 300);
      } else if (step === 1) {
        body.innerHTML = `<h1 class="ac-q">How old is ${who()}?</h1>
          <div class="ac-ages">${Array.from({ length: 14 }, (_, k) => k + 3).map((a) => `<button class="ac-age${a === age ? ' on' : ''}" data-age="${a}">${a}</button>`).join('')}</div>
          <p class="fine">Questions and levels are matched to this age.</p>`;
        body.querySelector('.ac-ages')!.addEventListener('click', (e) => {
          const b = (e.target as HTMLElement).closest<HTMLElement>('.ac-age');
          if (!b) return;
          age = Number(b.dataset.age);
          body.querySelectorAll('.ac-age').forEach((x) => x.classList.toggle('on', x === b));
          popIn(b, 0, 0.85);
          next.disabled = false;
        });
        next.disabled = !age;
        next.textContent = 'Next';
      } else if (step === 2) {
        const on = assisted ?? age <= 6;
        body.innerHTML = `<h1 class="ac-q">Who will hold the phone?</h1>
          <div class="seg seg-col ac-help">
            <button class="seg-b${on ? ' on' : ''}" data-h="1"><b>👪 We’ll play together</b><small>Questions read aloud, no timers, and a tip for you on every question. Best for ages 3 to 6.</small>${age <= 6 ? '<em>Suggested</em>' : ''}</button>
            <button class="seg-b${on ? '' : ' on'}" data-h="0"><b>🧒 ${who()} plays alone</b><small>For children who can read the questions.</small>${age > 6 ? '<em>Suggested</em>' : ''}</button>
          </div>
          <p class="fine">You can change this later in the grown-up area.</p>`;
        body.querySelectorAll<HTMLElement>('[data-h]').forEach((b) =>
          b.addEventListener('click', () => {
            assisted = b.dataset.h === '1';
            body.querySelectorAll('[data-h]').forEach((x) => x.classList.toggle('on', x === b));
          }),
        );
        next.disabled = false;
        next.textContent = 'Next';
      } else {
        body.innerHTML = `<h1 class="ac-q">Pick a buddy for ${who()}</h1>
          <div class="ac-preview">${avatarHtml(avatar, 84)}</div>
          <div class="avatars">${AVATARS.map((_, i) => `<button class="av${i === avatar ? ' on' : ''}" data-i="${i}" aria-label="Avatar ${i + 1}">${avatarHtml(i, 52)}</button>`).join('')}</div>`;
        body.querySelector('.avatars')!.addEventListener('click', (e) => {
          const b = (e.target as HTMLElement).closest<HTMLElement>('.av');
          if (!b) return;
          avatar = Number(b.dataset.i);
          body.querySelector('.ac-preview')!.innerHTML = avatarHtml(avatar, 84);
          popIn(body.querySelector('.ac-preview .avatar')!, 0, 0.7);
          body.querySelectorAll<HTMLElement>('.av').forEach((x) => x.classList.toggle('on', Number(x.dataset.i) === avatar));
        });
        next.disabled = false;
        next.textContent = `Save ${name}`;
      }
      stagger(body.children, { gap: 70 });
    };
    const go = (k: number) => {
      step = k;
      paint();
    };
    const save = async () => {
      // The owner code as the name makes a tester: every level and boss open, no time limit.
      const tester = /^\d{7}$/.test(name) && (await isOwnerCode(name));
      const c = newChild(tester ? 'Tester' : name, age, avatar, app.today);
      c.assisted = assisted ?? age <= 6;
      if (tester) Object.assign(c, { tester: true, placed: true, together: 0, assisted: false });
      app.save.update((d) => d.children.push(c));
      if (tester) app.toast('Tester made: every level is open.');
      void app.show(firstRun ? moreChildrenScreen : whosPlayingScreen);
    };
    next.addEventListener('click', () => {
      if (next.disabled) return;
      if (step < STOPS.length - 1) go(step + 1);
      else void save();
    });
    // Tap a stop already passed to go back to it.
    el.querySelector('.stops-slot')!.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('[data-stop]');
      if (li && Number(li.dataset.stop) < step) go(Number(li.dataset.stop));
    });
    const back = () => {
      if (step > 0) go(step - 1);
      else void app.show(firstRun ? welcomeScreen : whosPlayingScreen);
    };
    el.querySelector('.back-btn')!.addEventListener('click', back);
    return {
      el,
      mounted: () => paint(),
      back: () => {
        back();
        return true;
      },
    };
  };
}

function moreChildrenScreen(app: App): Screen {
  const kids = app.save.data.children;
  const el = html(`<section class="screen more-kids" aria-label="Children">
    <h1 class="title center">Children</h1>
    <div class="kids">${kids.map((c) => `<div class="kid card">${avatarHtml(c.avatar, 72)}<b>${esc(c.name)}</b><small>Age ${c.age}</small></div>`).join('')}</div>
    <button class="btn ghost add">+ Add another child</button>
    <button class="btn next">Next</button>
  </section>`);
  el.querySelector('.add')!.addEventListener('click', () => void app.show(addChildScreen(true)));
  el.querySelector('.next')!.addEventListener('click', () => void app.show(limitsScreen(true)));
  return { el, mounted: () => stagger(el.children, { gap: 80 }) };
}

/** Train stops: where you are in a short setup, with the current stop lit up. */
export function stopsHtml(labels: string[], at: number): string {
  return `<ol class="stops" aria-label="Step ${at + 1} of ${labels.length}">${labels
    .map((l, i) => `<li class="${i < at ? 'stop-past' : i === at ? 'stop-now' : ''}" data-stop="${i}"><i>${i < at ? '✓' : i + 1}</i><span>${l}</span></li>`)
    .join('')}</ol>`;
}

/** Daily play time and reward pace, one question per stop. */
export function limitsScreen(firstRun: boolean) {
  return (app: App): Screen => {
    const st = app.save.data.settings;
    let mins = st.limitMinutes;
    let mode = st.timeUpMode;
    const pace = { treat: st.treatPace, goal: st.goalPace };
    let step = 0;
    const LABELS = ['Play time', 'Time’s up', 'Treats', 'Big goals'];
    const el = html(`<section class="screen limits" aria-label="Daily play time">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">←</button><span class="t">Play time and rewards</span><span style="width:50px"></span></header>
      <div class="stops-slot"></div>
      <div class="scroll lim-body"></div>
      <footer class="lim-foot"><button class="btn done">Next</button></footer>
    </section>`);
    const body = el.querySelector<HTMLElement>('.lim-body')!;
    const next = el.querySelector<HTMLButtonElement>('.done')!;
    const seg = (items: string, attr: string) => `<div class="seg ${attr}">${items}</div>`;
    const paint = () => {
      el.querySelector('.stops-slot')!.innerHTML = stopsHtml(LABELS, step);
      if (step === 0) {
        body.innerHTML = `<div class="card lim-card lim-one"><h2 class="ac-q">How long can each child play a day?</h2>
          <div class="lim-value"><b class="mins">${mins}</b> minutes</div>
          <input type="range" min="10" max="120" step="5" value="${mins}" class="slider" aria-label="Minutes per day">
          <p class="fine">Only time inside a level counts. 20 to 30 minutes works well.</p></div>`;
        const slider = body.querySelector<HTMLInputElement>('.slider')!;
        slider.addEventListener('input', () => (body.querySelector('.mins')!.textContent = String((mins = Number(slider.value)))));
      } else if (step === 1) {
        body.innerHTML = `<div class="card lim-card lim-one"><h2 class="ac-q">When the time is up…</h2>
          ${seg(`<button class="seg-b${mode === 'stop' ? ' on' : ''}" data-m="stop"><b>Stop for today</b><small>A “see you tomorrow” screen</small></button><button class="seg-b${mode === 'keep' ? ' on' : ''}" data-m="keep"><b>Keep playing</b><small>…but no more coins today</small></button>`, 'seg-col')}</div>`;
        body.querySelectorAll<HTMLElement>('[data-m]').forEach((b) =>
          b.addEventListener('click', () => {
            mode = b.dataset.m as 'stop' | 'keep';
            body.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x === b));
          }),
        );
      } else {
        const which = step === 2 ? 'treat' : 'goal';
        const opts = which === 'treat' ? TREAT_PACES : GOAL_PACES;
        body.innerHTML = `<div class="card lim-card lim-one"><h2 class="ac-q">${which === 'treat' ? 'How often can they earn a small treat?' : 'And a big goal, like a toy?'}</h2>
          ${seg(opts.map(([v, t, n]) => `<button class="seg-b${near(pace[which], v) ? ' on' : ''}" data-v="${v}"><b>${t}</b><small>${n}</small></button>`).join(''), 'seg-grid')}
          <p class="fine">If they play every day. You can change this any time.</p></div>`;
        body.querySelectorAll<HTMLElement>('[data-v]').forEach((b) =>
          b.addEventListener('click', () => {
            pace[which] = Number(b.dataset.v);
            body.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b));
          }),
        );
      }
      next.textContent = step < LABELS.length - 1 ? 'Next' : firstRun ? 'Finish setup' : 'Save';
      stagger(body.querySelectorAll('.lim-card > *'), { gap: 50 });
    };
    const save = () => {
      app.save.update((d) => {
        d.settings.limitMinutes = mins;
        d.settings.timeUpMode = mode;
        d.settings.treatPace = pace.treat;
        d.settings.goalPace = pace.goal;
        d.setupDone = true;
        setPace(pace.treat, pace.goal);
        for (const c of d.children) recheckJars(c.wallet);
      });
      void app.show(whosPlayingScreen);
    };
    next.addEventListener('click', () => {
      if (step < LABELS.length - 1) {
        step++;
        paint();
      } else save();
    });
    // Tap a stop already passed to go back to it.
    el.querySelector('.stops-slot')!.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('[data-stop]');
      if (li && Number(li.dataset.stop) < step) {
        step = Number(li.dataset.stop);
        paint();
      }
    });
    const back = () => {
      if (step > 0) {
        step--;
        paint();
      } else void app.show(firstRun ? moreChildrenScreen : whosPlayingScreen);
    };
    el.querySelector('.back-btn')!.addEventListener('click', back);
    return { el, mounted: paint, back: () => (back(), true) };
  };
}
