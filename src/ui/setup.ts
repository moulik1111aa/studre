// First-run setup (grown-up): add children, set the daily limit and what happens at time-up.

import { html, esc, type App, type Screen } from './app.ts';
import { newChild } from '../storage/save.ts';
import { AVATARS, avatarHtml } from './icons.ts';
import { logoMark } from './loader.ts';
import { stagger, popIn } from '../render/motion.ts';
import { whosPlayingScreen } from './whos.ts';
import { setPace } from '../core/rewards.ts';
import { recheckJars } from '../core/economy.ts';

/** [multiplier, label, note] — relative to the calibrated pace (treat ≈ weekly, big toy ≈ 2 months). */
const TREAT_PACES: [number, string, string][] = [[0.45, '3 days', 'Often'], [1, '1 week', 'Normal'], [2, '2 weeks', 'Slower'], [4.3, '1 month', 'Rare']];
const GOAL_PACES: [number, string, string][] = [[0.5, '1 month', 'Faster'], [1, '2 months', 'Normal'], [1.5, '3 months', 'Slower'], [3, '6 months', 'Rare']];
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

export function welcomeScreen(app: App): Screen {
  const el = html(`<section class="screen welcome" aria-label="Welcome">
    <div class="wl-hero">${logoMark()}<h1 class="wordmark"><span>Study</span> <span>Hard</span></h1>
    <p class="subtitle">Maths from age 3 to 16, one small step at a time.<br>Real rewards. Boss fights. Big smiles.</p></div>
    <button class="btn start">Set up for my child</button>
    <p class="fine">A grown-up sets things up. It takes 2 minutes.</p>
  </section>`);
  el.querySelector('.start')!.addEventListener('click', async () => {
    if (await app.grownUp('Setting up')) void app.show(addChildScreen(true));
  });
  return {
    el,
    mounted: () => {
      const mark = el.querySelector<SVGElement>('svg')!;
      popIn(mark, 0, 0.9);
      mark.classList.add('alive');
      stagger(el.querySelectorAll('.wordmark span, .subtitle, .start, .fine'), { delay: 500, gap: 120 });
    },
  };
}

export function addChildScreen(firstRun: boolean) {
  return (app: App): Screen => {
    let age = 6;
    let avatar = app.save.data.children.length % AVATARS.length;
    const el = html(`<section class="screen add-child" aria-label="Add a child">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">←</button><span class="t">Add a child</span><span style="width:50px"></span></header>
      <div class="scroll ac-body">
        <div class="ac-preview">${avatarHtml(avatar, 96)}</div>
        <label class="field"><span>Name</span><input class="name" maxlength="20" placeholder="e.g. Riya" autocomplete="off"></label>
        <div class="field"><span>Age</span><div class="stepper"><button class="icon-btn minus" aria-label="Younger">−</button><b class="age">6</b><button class="icon-btn plus" aria-label="Older">+</button></div></div>
        <div class="field"><span>Pick a buddy</span><div class="avatars">${AVATARS.map((_, i) => `<button class="av${i === avatar ? ' on' : ''}" data-i="${i}" aria-label="Avatar ${i + 1}">${avatarHtml(i, 52)}</button>`).join('')}</div></div>
      </div>
      <button class="btn save">Save</button>
    </section>`);
    const paintAvatar = () => {
      el.querySelector('.ac-preview')!.innerHTML = avatarHtml(avatar, 96);
      popIn(el.querySelector('.ac-preview .avatar')!, 0, 0.7);
      el.querySelectorAll<HTMLElement>('.av').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === avatar));
    };
    el.querySelector('.avatars')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.av');
      if (b) {
        avatar = Number(b.dataset.i);
        paintAvatar();
      }
    });
    const ageEl = el.querySelector<HTMLElement>('.age')!;
    el.querySelector('.minus')!.addEventListener('click', () => (ageEl.textContent = String((age = Math.max(3, age - 1)))));
    el.querySelector('.plus')!.addEventListener('click', () => (ageEl.textContent = String((age = Math.min(16, age + 1)))));
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(firstRun ? welcomeScreen : whosPlayingScreen));
    el.querySelector('.save')!.addEventListener('click', () => {
      const name = el.querySelector<HTMLInputElement>('.name')!.value.trim();
      if (!name) {
        app.toast('Please type a name.');
        el.querySelector<HTMLInputElement>('.name')!.focus();
        return;
      }
      const c = newChild(name, age, avatar, app.today);
      app.save.update((d) => d.children.push(c));
      void app.show(firstRun ? moreChildrenScreen : whosPlayingScreen);
    });
    return { el, mounted: () => stagger(el.querySelectorAll('.ac-preview, .field, .save'), { gap: 80 }) };
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

export function limitsScreen(firstRun: boolean) {
  return (app: App): Screen => {
    const st = app.save.data.settings;
    const el = html(`<section class="screen limits" aria-label="Daily limit">
      <header class="topbar"><span style="width:50px"></span><span class="t">Daily play time</span><span style="width:50px"></span></header>
      <div class="card lim-card">
        <p class="subtitle">How long can each child play per day?</p>
        <div class="lim-value"><b class="mins">${st.limitMinutes}</b> minutes</div>
        <input type="range" min="10" max="120" step="5" value="${st.limitMinutes}" class="slider" aria-label="Minutes per day">
        <p class="subtitle">When time is up:</p>
        <div class="seg">
          <button class="seg-b${st.timeUpMode === 'stop' ? ' on' : ''}" data-m="stop"><b>Stop for today</b><small>See you tomorrow screen</small></button>
          <button class="seg-b${st.timeUpMode === 'keep' ? ' on' : ''}" data-m="keep"><b>Keep playing</b><small>…but no more coins today</small></button>
        </div>
      </div>
      <div class="card lim-card">
        <p class="subtitle">How often can they earn a small treat?</p>
        <div class="seg seg4" data-pace="treat">${TREAT_PACES.map(([v, t, n]) => `<button class="seg-b${near(st.treatPace, v) ? ' on' : ''}" data-v="${v}"><b>${t}</b><small>${n}</small></button>`).join('')}</div>
        <p class="subtitle">And a big toy?</p>
        <div class="seg seg4" data-pace="goal">${GOAL_PACES.map(([v, t, n]) => `<button class="seg-b${near(st.goalPace, v) ? ' on' : ''}" data-v="${v}"><b>${t}</b><small>${n}</small></button>`).join('')}</div>
        <p class="fine">If they play every day. Bigger treats take longer. You can change this any time.</p>
      </div>
      <button class="btn done">${firstRun ? 'Finish setup' : 'Save'}</button>
    </section>`);
    let mins = st.limitMinutes;
    let mode = st.timeUpMode;
    const pace = { treat: st.treatPace, goal: st.goalPace };
    el.querySelectorAll<HTMLElement>('[data-pace]').forEach((g) =>
      g.querySelectorAll<HTMLElement>('.seg-b').forEach((b) =>
        b.addEventListener('click', () => {
          pace[g.dataset.pace as 'treat' | 'goal'] = Number(b.dataset.v);
          g.querySelectorAll('.seg-b').forEach((x) => x.classList.toggle('on', x === b));
        }),
      ),
    );
    const slider = el.querySelector<HTMLInputElement>('.slider')!;
    slider.addEventListener('input', () => (el.querySelector('.mins')!.textContent = String((mins = Number(slider.value)))));
    el.querySelectorAll<HTMLElement>('.seg-b[data-m]').forEach((b) =>
      b.addEventListener('click', () => {
        mode = b.dataset.m as 'stop' | 'keep';
        el.querySelectorAll('.seg-b[data-m]').forEach((x) => x.classList.toggle('on', x === b));
      }),
    );
    el.querySelector('.done')!.addEventListener('click', () => {
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
    });
    return { el, mounted: () => stagger(el.querySelectorAll('.lim-card > *, .done'), { gap: 50 }) };
  };
}
