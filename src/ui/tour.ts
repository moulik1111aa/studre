// The quick tour, in two parts.
//  1. The story (for grown-ups, from the welcome screen or the parent area): eight short
//     scenes on why Study Hard works. A jar at the bottom fills as you go, so the tour itself
//     shows the idea: small steps add up to something worth having.
//  2. Map tips (for the child, the first time they reach the map): Biscuit points at the
//     treat jar, the big goal, the path, a boss, the timer, Play and the trophy room, and
//     reads each tip aloud. A "?" button on the map plays them again.

import { html, esc, type App, type Screen, type ScreenMaker } from './app.ts';
import type { Child } from '../storage/save.ts';
import { dogSvg, dogHeadSvg } from './dog.ts';
import { rewardById } from '../core/rewards.ts';
import { reducedMotion, wait, EASE_OUT } from '../render/motion.ts';

// ── 1. The story ───────────────────────────────────────────────────────────

interface Scene {
  title: string;
  text: string;
  art: string;
}

const coin = (i: number) => `<i class="ta-coin" style="--k:${i}">●</i>`;

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
    title: 'Treats that mean something',
    text: 'Instead of a chocolate every day, your child earns a treat about once every 10 days (you choose the pace). The wait is what makes it special.',
    art: `<div class="ta ta-days">${Array.from({ length: 10 }, (_, i) => (i < 9 ? `<span class="ta-day" style="--k:${i}"><small>Day ${i + 1}</small><b>🍫</b></span>` : `<span class="ta-day win" style="--k:${i}"><small>Day 10</small><b>🍫</b><em>Earned!</em></span>`)).join('')}</div>`,
  },
  {
    title: 'Learn more, earn more',
    text: 'Every level adds coins to the jar. A perfect 10 out of 10 pays ten times more than just scraping through, so children aim to get it right, not just get it done.',
    art: `<div class="ta ta-earn">
      <div class="ta-q"><span>7 × 8 = </span><b class="ta-ans">56</b><i class="ta-tick">✓</i></div>
      <div class="ta-coins">${[0, 1, 2, 3, 4].map(coin).join('')}</div>
      <div class="ta-jar"><i class="ta-fill"></i></div>
      <div class="ta-pays"><span>10/10 <b>×10</b></span><span>9/10 <b>×5</b></span><span>8/10 <b>×3</b></span></div>
    </div>`,
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
    title: 'Mistakes become lessons',
    text: 'Get one wrong and Biscuit shows how to work it out, step by step, using the same numbers.',
    art: `<div class="ta ta-lesson">
      <div class="ta-card"><p class="ta-lq">85 = 27 + ?</p>
        <p class="ta-ls" style="--k:0"><i>1</i>The missing part is 85 − 27.</p>
        <p class="ta-ls" style="--k:1"><i>2</i>85 − 20 = 65, then − 7 = 58.</p>
        <p class="ta-ls ok" style="--k:2"><i>✓</i>So the answer is 58.</p></div>
      <div class="ta-coach">${dogHeadSvg({ cls: 'alive' })}</div>
    </div>`,
  },
  {
    title: 'You’re in charge',
    text: 'You set the daily time and the prizes. Only a grown-up can hand a prize over, so every promise is kept. No ads, no sign-up, and nothing leaves this phone.',
    art: `<div class="ta ta-charge">${[
      ['⏱️', '30 min a day', 'or what you choose'],
      ['🔒', 'Grown-up check', 'for settings and prizes'],
      ['🎁', 'You hand it over', 'real rewards, real promises'],
      ['📵', 'No ads, offline', 'private by design'],
    ]
      .map(([e, b, s], i) => `<div class="ta-tile" style="--k:${i}"><span>${e}</span><b>${b}</b><small>${s}</small></div>`)
      .join('')}</div>`,
  },
  {
    title: 'Ready, set, learn!',
    text: 'Setting up takes about 2 minutes. Then Biscuit will show your child around the map.',
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

    const go = (k: number, dir = 1) => {
      const old = scenes[i];
      i = Math.max(0, Math.min(n - 1, k));
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
      next.textContent = i === n - 1 ? finish.label : 'Next';
      next.classList.toggle('mint', i === n - 1);
      el.querySelector<HTMLElement>('.st-skip')!.style.visibility = i === n - 1 ? 'hidden' : 'visible';
      if (i === n - 1 && !reducedMotion()) {
        const r = scenes[i].querySelector('.ta-jar')!.getBoundingClientRect();
        setTimeout(() => app.fx.confetti(r.x + r.width / 2, r.y + r.height / 3, 70), 350);
      }
    };
    next.addEventListener('click', () => (i === n - 1 ? finish.go() : go(i + 1, 1)));
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
      if (dx < 0 && i < n - 1) go(i + 1, 1);
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
