// The quick tour, in two parts.
//  1. The story (for grown-ups, from the welcome screen or the parent area): short scenes
//     on why Study Hard works. The grown-up picks a treat, answers a demo question (right and
//     wrong, to see the prize and the lesson), and promises to play the first levels with
//     their child. A jar at the bottom fills as you go.
//  2. Map tips (for the child, the first time they reach the map): Biscuit points at the
//     treat jar, the big goal, the path, a boss, the timer, Play and the trophy room, and
//     reads each tip aloud. A "?" button on the map plays them again.

import { html, esc, type App, type Screen, type ScreenMaker } from './app.ts';
import type { Child } from '../storage/save.ts';
import { dogSvg, dogHeadSvg } from './dog.ts';
import { rewardById, pickable, jarOf, aboutOf, type Reward } from '../core/rewards.ts';
import { reducedMotion, wait, EASE_OUT, popIn, shake } from '../render/motion.ts';

// ── 1. The story ───────────────────────────────────────────────────────────

interface Scene {
  title: string;
  text: string;
  art: string;
  /** Interactive scenes: wire up the art; call `done` once the grown-up has tried it. */
  play?: (art: HTMLElement, done: () => void, ctx: TourCtx) => void;
  /** What Next says until `done` (interactive scenes). */
  gate?: string;
}

/** Shared between scenes: the treat picked for the demo. */
interface TourCtx {
  app: App;
  treat?: Reward;
}


/** Six treats from different categories, for the demo pick. */
function demoTreats(): Reward[] {
  const out: Reward[] = [];
  for (const r of pickable()) if (jarOf(r) === 'treat' && !r.id.startsWith('own.') && !out.some((x) => x.category === r.category)) out.push(r);
  return out.slice(0, 6);
}

function pickTreat(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  const grid = art.querySelector<HTMLElement>('.tp-grid')!;
  const note = art.querySelector<HTMLElement>('.tp-chosen')!;
  const treats = demoTreats();
  grid.innerHTML = treats.map((r, i) => `<button class="tp-card" data-i="${i}" style="--k:${i}"><span>${r.icon}</span><b>${esc(r.name)}</b></button>`).join('');
  grid.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.tp-card');
    if (!b) return;
    const r = treats[Number(b.dataset.i)];
    ctx.treat = r;
    grid.querySelectorAll('.tp-card').forEach((x) => x.classList.toggle('on', x === b));
    popIn(b, 0, 0.92);
    note.innerHTML = `${r.icon} <b>${esc(r.name)}</b> goes in the treat jar: ${esc(aboutOf(r))} of play.`;
    done();
  });
}

interface DemoQ {
  q: string;
  answer: string;
  options: string[];
  steps: string[];
}
const DEMO_QS: DemoQ[] = [
  { q: '7 × 8 = ?', answer: '56', options: ['54', '56', '48', '64'], steps: ['7 × 8 is double 7 × 4.', '7 × 4 = 28.', 'Double 28 is 56.'] },
  { q: '45 − 18 = ?', answer: '27', options: ['33', '27', '23', '37'], steps: ['Take away 10 first: 45 − 10 = 35.', 'Then take away 8: 35 − 8 = 27.'] },
];

function assistDemo(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  const say = (t: string) => ctx.app.voice.say(t, undefined, true);
  const ask = () => {
    art.innerHTML = `<div class="tl-card"><div class="as-ducks">${'🦆'.repeat(3)}</div><h3>How many ducks?</h3>
      <div class="tl-choices as-choices">${['2', '3', '4'].map((o) => `<button class="tl-choice" data-v="${o}">${o}</button>`).join('')}</div>
      <p class="coach-note"><b>👪 Grown-up:</b> Point at each duck as you count together: one, two, three.</p></div>
      <div class="tl-out" aria-live="polite"></div>`;
    const out = art.querySelector<HTMLElement>('.tl-out')!;
    art.querySelector('.tl-choices')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.tl-choice');
      if (!b || b.disabled) return;
      if (b.dataset.v !== '3') {
        b.classList.add('wrong');
        b.disabled = true;
        shake(b);
        say('Let’s count them together. One, two, three. Try again!');
        out.innerHTML = '<p class="tl-why">No marks lost. You count together, and they try again.</p>';
        return;
      }
      b.classList.add('right');
      art.querySelectorAll<HTMLButtonElement>('.tl-choice').forEach((x) => (x.disabled = true));
      say('Yes! Three ducks. Well done!');
      out.innerHTML = '<p class="tl-right">Yes! Three ducks. <b>Coins still count</b> when you help.</p><button class="btn ghost small tl-next">Try it again</button>';
      out.querySelector('.tl-next')!.addEventListener('click', ask);
      done();
    });
  };
  ask();
  say('How many ducks?');
}

function tryLevel(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  let k = 0;
  let fill = 0;
  let wrongSeen = false;
  const icon = () => ctx.treat?.icon ?? '🍫';
  const ask = () => {
    const d = DEMO_QS[k % DEMO_QS.length];
    let prize = 30;
    art.innerHTML = `<div class="tl-top"><span class="tl-prize">Perfect score <b>🪙 +${prize}</b></span><span class="tl-jar"><i style="height:${fill}%"></i><em>${icon()}</em></span></div>
      <div class="tl-card"><h3>${d.q}</h3><div class="tl-choices">${d.options.map((o) => `<button class="tl-choice" data-v="${o}">${o}</button>`).join('')}</div></div>
      <div class="tl-out" aria-live="polite"></div>`;
    const out = art.querySelector<HTMLElement>('.tl-out')!;
    const chip = art.querySelector<HTMLElement>('.tl-prize')!;
    art.querySelector('.tl-choices')!.addEventListener('click', async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.tl-choice');
      if (!b || b.disabled) return;
      if (b.dataset.v !== d.answer) {
        wrongSeen = true;
        b.classList.add('wrong');
        b.disabled = true;
        shake(b);
        prize = Math.max(5, Math.round(prize / 2));
        chip.innerHTML = `After a slip <b>🪙 +${prize}</b>`;
        popIn(chip, 0, 0.9);
        out.innerHTML = `<div class="tl-lesson"><p class="tl-why">Not quite. Biscuit shows how, with the same numbers:</p>${d.steps.map((st, i) => `<p class="ta-ls" style="--k:${i}"><i>${i + 1}</i>${esc(st)}</p>`).join('')}<p class="tl-again">Now try again.</p></div>`;
        return;
      }
      b.classList.add('right');
      art.querySelectorAll<HTMLButtonElement>('.tl-choice').forEach((x) => (x.disabled = true));
      fill = Math.min(100, fill + (prize >= 30 ? 22 : 11));
      const jar = art.querySelector<HTMLElement>('.tl-jar i')!;
      requestAnimationFrame(() => (jar.style.height = `${fill}%`));
      const coins = art.querySelector<HTMLElement>('.tl-jar')!;
      if (!reducedMotion()) {
        const r = coins.getBoundingClientRect();
        ctx.app.fx.confetti(r.x + r.width / 2, r.y, 24, 0.5);
      }
      out.innerHTML = `<p class="tl-right">Right! <b>🪙 +${prize}</b> into the ${esc(ctx.treat?.name.toLowerCase() ?? 'treat')} jar. ${prize >= 30 ? 'A perfect round pays the most, so children aim to get it right.' : 'Getting it right first time would have paid double.'}</p>
        <button class="btn ghost small tl-next">${wrongSeen ? 'Another question' : 'Another one: try a wrong answer'}</button>`;
      out.querySelector('.tl-next')!.addEventListener('click', () => {
        k++;
        ask();
      });
      done();
    });
  };
  ask();
}

const SCENES: Scene[] = [
  {
    title: 'Hi, I’m Biscuit!',
    text: 'Study Hard is a maths adventure from age 3 to 16, with boss fights and family face-offs on the way. It starts right where your child is and grows with them.',
    art: `<div class="ta ta-hello">${['1', '+', '3', '×', '7', '½', '=', '9'].map((s, i) => `<span class="ta-orbit" style="--k:${i}">${s}</span>`).join('')}<div class="ta-dog">${dogSvg({ cls: 'alive', noShadow: true })}</div></div>`,
  },
  {
    title: 'Swap the scroll for a goal',
    text: 'Reels hand out a tiny buzz every few seconds, so nothing feels worth waiting for. Here, every minute of play builds towards something real.',
    art: `<div class="ta ta-reels">
      <div class="ta-phone"><div class="ta-strip">${['🎬', '😂', '🔥', '🐱', '💃', '🎮', '😂', '🔥', '🎬', '😂'].map((e) => `<b>${e}<small>♥ ${Math.floor(Math.random() * 90 + 10)}k</small></b>`).join('')}</div><span class="ta-stop">✕</span></div>
      <span class="ta-arrow">→</span>
      <div class="ta-goal"><span class="ta-goaljar"><i></i></span><b>🎯</b></div>
    </div>`,
  },
  {
    title: 'Pick a treat, like your child will',
    text: 'Instead of a chocolate every day, your child saves up for a treat that comes about every 10 days. Tap one for this demo.',
    art: `<div class="ta ta-pick"><div class="tp-grid"></div><p class="tp-chosen" aria-live="polite">&nbsp;</p></div>`,
    gate: 'Pick a treat first',
    play: pickTreat,
  },
  {
    title: 'Now play, like your child will',
    text: 'Answer the question. Try a wrong answer too, to see what happens.',
    art: `<div class="ta ta-try"></div>`,
    gate: 'Answer the question first',
    play: tryLevel,
  },
  {
    title: 'Dream big, save slowly',
    text: 'One coin in every five goes to a big dream, like a bicycle, saved for over a few months. Miss a day and the jars melt a little, so a little practice every day wins.',
    art: `<div class="ta ta-dream">
      <div class="ta-bigjar"><i class="ta-big-fill"></i><span class="ta-bub" style="--k:0"></span><span class="ta-bub" style="--k:1"></span><span class="ta-bub" style="--k:2"></span></div>
      <div class="ta-dreamside"><b class="ta-bike">🚲</b><span class="ta-months">3 months</span><span class="ta-melt"><i class="ta-drop"></i>Skip a day: it melts</span></div>
    </div>`,
  },
  {
    title: 'You’re in charge',
    text: 'You set the daily time and the prizes. Only a grown-up can hand a prize over, so every promise is kept. No ads, no sign-up, and nothing leaves this phone.',
    art: `<div class="ta ta-charge">${[
      ['⏱️', '30 min a day', 'or what you choose'],
      ['🔒', 'Grown-up lock', 'your screen lock or a PIN'],
      ['🎁', 'You hand it over', 'real rewards, real promises'],
      ['📵', 'No ads, offline', 'private by design'],
    ]
      .map(([e, b, s], i) => `<div class="ta-tile" style="--k:${i}"><span>${e}</span><b>${b}</b><small>${s}</small></div>`)
      .join('')}</div>`,
  },
  {
    title: 'Play the first levels together',
    text: 'Your child picks a reading voice, then plays their first 3 levels with you beside them. There a slip costs nothing: Biscuit shows how, they try again, and coins still count.',
    art: `<div class="ta ta-together">
      <button class="btn ghost tg-voice">🔊 Hear a reading voice</button>
      <button class="card tg-pledge" aria-pressed="false"><span class="tg-box">✓</span><span><b>I’ll sit with my child</b><small>for their first 3 levels</small></span></button>
    </div>`,
    gate: 'Tap “I’ll sit with my child”',
    play: (art, done, ctx) => {
      art.querySelector('.tg-voice')!.addEventListener('click', () => ctx.app.voice.say('Hello! I will read every question to you. What is 7 plus 8?', undefined, true));
      const pledge = art.querySelector<HTMLElement>('.tg-pledge')!;
      pledge.addEventListener('click', () => {
        pledge.classList.add('on');
        pledge.setAttribute('aria-pressed', 'true');
        popIn(pledge, 0, 0.95);
        done();
      });
    },
  },
  {
    title: 'Little ones play with you',
    text: 'For ages 3–6, or any child who can’t read yet, assisted mode keeps you alongside every level: questions are read aloud, there are no timers, a slip means try again, and each question has a tip for you. Try it.',
    art: `<div class="ta ta-assist"></div>`,
    gate: 'Count the ducks first',
    play: assistDemo,
  },
  {
    title: 'Ready, set, learn!',
    text: 'Setting up takes about 2 minutes. Then sit with your child for their first few levels.',
    art: `<div class="ta ta-ready"><div class="ta-dog">${dogSvg({ cls: 'alive', noShadow: true })}</div><div class="ta-jar full"><i class="ta-fill"></i><b>⭐</b></div></div>`,
  },
];

/** The story. `finish` is where "Let's set up" (or "Done") goes; `leave` is for Skip / back. */
export function storyScreen(finish: { label: string; go: () => void }, leave: ScreenMaker) {
  return (app: App): Screen => {
    let i = 0;
    const n = SCENES.length;
    const el = html(`<section class="screen story" aria-label="Quick tour">
      <header class="st-top"><span class="st-count" aria-live="polite"></span><button class="btn ghost small st-skip">Skip tour</button></header>
      <div class="st-stage">${SCENES.map((s, k) => `<article class="st-scene" data-i="${k}" aria-hidden="true"><div class="st-art">${s.art}</div><h2 class="st-title">${esc(s.title)}</h2><p class="st-text">${esc(s.text)}</p></article>`).join('')}</div>
      <footer class="st-foot">
        <button class="icon-btn st-prev" aria-label="Back">←</button>
        <div class="st-progress" aria-hidden="true"><span class="st-pjar"><i></i></span><span class="st-dots">${SCENES.map(() => '<i></i>').join('')}</span></div>
        <button class="btn st-next">Next</button>
      </footer>
    </section>`);
    const scenes = [...el.querySelectorAll<HTMLElement>('.st-scene')];
    const dots = [...el.querySelectorAll<HTMLElement>('.st-dots i')];
    const next = el.querySelector<HTMLButtonElement>('.st-next')!;
    const prev = el.querySelector<HTMLButtonElement>('.st-prev')!;
    const fill = el.querySelector<HTMLElement>('.st-pjar i')!;

    const ctx: TourCtx = { app };
    const started = new Set<number>();
    const finished = new Set<number>();
    const ready = (k: number) => !SCENES[k].play || finished.has(k);
    const paintNext = () => {
      const last = i === n - 1;
      next.disabled = !ready(i);
      next.textContent = !ready(i) ? SCENES[i].gate ?? 'Try it first' : last ? finish.label : 'Next';
      next.classList.toggle('mint', last || (!!SCENES[i].play && ready(i)));
    };
    const go = (k: number, dir = 1) => {
      const old = scenes[i];
      i = Math.max(0, Math.min(n - 1, k));
      const sc = SCENES[i];
      if (sc.play && !started.has(i)) {
        started.add(i);
        const at = i;
        sc.play(scenes[i].querySelector<HTMLElement>('.ta')!, () => {
          finished.add(at);
          if (i === at) paintNext();
        }, ctx);
      }
      scenes.forEach((s, j) => {
        s.classList.toggle('on', j === i);
        s.setAttribute('aria-hidden', String(j !== i));
      });
      if (old !== scenes[i] && !reducedMotion()) {
        old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-40 * dir}px)` }], { duration: 260, easing: EASE_OUT });
        scenes[i].animate([{ opacity: 0, transform: `translateX(${40 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE_OUT });
      }
      dots.forEach((d, j) => d.classList.toggle('on', j <= i));
      fill.style.height = `${((i + 1) / n) * 100}%`;
      el.querySelector('.st-count')!.textContent = `${i + 1} of ${n}`;
      prev.style.visibility = i ? 'visible' : 'hidden';
      paintNext();
      el.querySelector<HTMLElement>('.st-skip')!.style.visibility = i === n - 1 ? 'hidden' : 'visible';
      if (i === n - 1 && !reducedMotion()) {
        const r = scenes[i].querySelector('.ta-jar')!.getBoundingClientRect();
        setTimeout(() => app.fx.confetti(r.x + r.width / 2, r.y + r.height / 3, 70), 350);
      }
    };
    next.addEventListener('click', () => {
      if (!ready(i)) return;
      if (i === n - 1) finish.go();
      else go(i + 1, 1);
    });
    prev.addEventListener('click', () => go(i - 1, -1));
    el.querySelector('.st-skip')!.addEventListener('click', () => void app.show(leave));
    // Swipe between scenes.
    let x0: number | null = null;
    const stage = el.querySelector<HTMLElement>('.st-stage')!;
    stage.addEventListener('pointerdown', (e) => (x0 = e.clientX));
    stage.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 50) return;
      if (dx < 0 && i < n - 1 && ready(i)) go(i + 1, 1);
      if (dx > 0 && i > 0) go(i - 1, -1);
    });
    return {
      el,
      mounted: () => go(0),
      back: () => {
        if (i > 0) go(i - 1, -1);
        else void app.show(leave);
        return true;
      },
    };
  };
}

// ── 2. Map tips ────────────────────────────────────────────────────────────

interface Tip {
  /** What to point at (inside the map screen); none = a tip in the middle. */
  at?: string;
  text: string;
}

function tipsFor(child: Child, el: HTMLElement): Tip[] {
  const w = child.wallet;
  const treat = w.treat.rewardId ? rewardById(w.treat.rewardId)?.name : undefined;
  const goal = w.goal.rewardId ? rewardById(w.goal.rewardId)?.name : undefined;
  const tips: Tip[] = [
    { text: `Hi ${child.name}! I’m Biscuit. Let me show you around!` },
    { at: '.jarbar .treat', text: `This is your treat jar. Every level you finish adds coins. Fill it all the way to win ${treat ? `your ${treat.toLowerCase()}` : 'a treat'}!` },
    { at: '.jarbar .goal', text: `This big jar is for your dream${goal ? `: ${goal.toLowerCase()}` : ''}. It fills up slowly, so keep going!` },
    { at: '.node.current', text: 'This is where you are on the path. Each stop has 5 levels. Finish them to move on.' },
  ];
  // A boss further along the path, if there is one on the map.
  const nodes = [...el.querySelectorAll<HTMLElement>('.node')];
  const cur = nodes.findIndex((x) => x.classList.contains('current'));
  const boss = nodes.slice(Math.max(0, cur)).find((x) => x.classList.contains('boss'));
  if (boss) {
    boss.dataset.tipBoss = '';
    tips.push({ at: '[data-tip-boss]', text: 'Bosses wait along the path. Beat them with right answers to open new places!' });
  }
  tips.push(
    { at: '.ring', text: 'This shows how many minutes you can play today. When it runs out, see you tomorrow!' },
    { at: '.play-next', text: 'Tap Play to start your next level. Get every answer right to earn the most coins!' },
    { at: '.trophy-btn', text: 'Your trophies and badges live here.' },
    { text: 'Play a little every day, or your jars melt a bit. Ready?' },
  );
  return tips;
}

/** Show the map tips over the map screen `el`. Resolves when they are done or skipped. */
export function showMapTips(app: App, child: Child, el: HTMLElement): Promise<void> {
  const tips = tipsFor(child, el);
  const ov = html(`<div class="overlay tips-ov" role="dialog" aria-modal="true" aria-label="How it works">
    <div class="tip-hole"></div>
    <div class="tip-card">
      <div class="tip-dog">${dogHeadSvg({ cls: 'alive' })}</div>
      <p class="tip-text" aria-live="polite"></p>
      <div class="tip-foot"><span class="tip-count"></span><button class="btn ghost small tip-skip" data-back>Skip</button><button class="btn small tip-next">Next</button></div>
    </div>
  </div>`);
  const hole = ov.querySelector<HTMLElement>('.tip-hole')!;
  const card = ov.querySelector<HTMLElement>('.tip-card')!;
  const text = ov.querySelector<HTMLElement>('.tip-text')!;
  const nextBtn = ov.querySelector<HTMLButtonElement>('.tip-next')!;
  let k = -1;
  let busy = false;
  app.root.appendChild(ov);

  return new Promise<void>((resolve) => {
    const close = () => {
      app.voice.stop();
      app.save.update(() => (child.toured = true));
      el.querySelector('[data-tip-boss]')?.removeAttribute('data-tip-boss');
      const done = () => {
        ov.remove();
        // Back to where the child is on the path.
        el.querySelector('.node.current')?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
        resolve();
      };
      if (reducedMotion()) done();
      else ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).finished.then(done);
    };
    const place = async () => {
      const tip = tips[k];
      const target = tip.at ? el.querySelector<HTMLElement>(tip.at) : null;
      if (target && target.closest('.worlds')) {
        // Jump the map to it (a smooth scroll would move it after we measure).
        target.scrollIntoView({ block: 'center', behavior: 'auto' });
        await wait(60);
      }
      const root = app.root.getBoundingClientRect();
      if (target) {
        const r = target.getBoundingClientRect();
        const pad = 8;
        const x = r.x - root.x - pad;
        const y = r.y - root.y - pad;
        Object.assign(hole.style, { left: `${x}px`, top: `${y}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`, borderRadius: `${Math.min(28, (r.height + pad * 2) / 2)}px` });
        hole.classList.add('lit');
        // The card goes on the side of the screen with more room.
        const below = r.y + r.height / 2 - root.y < root.height / 2;
        card.classList.toggle('below', below);
        card.classList.toggle('above', !below);
        card.style.top = below ? `${Math.min(root.height - 230, y + r.height + pad * 2 + 14)}px` : '';
        card.style.bottom = below ? '' : `${Math.max(16, root.height - y + 14)}px`;
      } else {
        Object.assign(hole.style, { left: `${root.width / 2}px`, top: `${root.height / 2}px`, width: '0px', height: '0px' });
        hole.classList.remove('lit');
        card.classList.remove('below', 'above');
        card.style.top = '';
        card.style.bottom = '';
      }
    };
    const step = async () => {
      if (busy) return;
      busy = true;
      k++;
      if (k >= tips.length) {
        close();
        return;
      }
      text.textContent = tips[k].text;
      ov.querySelector('.tip-count')!.textContent = `${k + 1} / ${tips.length}`;
      nextBtn.textContent = k === tips.length - 1 ? 'Let’s go!' : 'Next';
      nextBtn.classList.toggle('mint', k === tips.length - 1);
      ov.querySelector<HTMLElement>('.tip-skip')!.style.visibility = k === tips.length - 1 ? 'hidden' : 'visible';
      await place();
      if (!reducedMotion()) card.animate([{ opacity: 0, transform: 'translateY(8px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE_OUT });
      app.voice.say(tips[k].text);
      busy = false;
    };
    nextBtn.addEventListener('click', () => void step());
    ov.querySelector('.tip-skip')!.addEventListener('click', close);
    if (!reducedMotion()) ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    void step();
  });
}
