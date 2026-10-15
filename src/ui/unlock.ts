// Reward unlocked (drawn in, spotlight, confetti, "Show Mummy/Papa!", Given ✓ behind the
// grown-up check) and the melted-chocolate "welcome back" after missed days.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { rewardById, costOf } from '../core/rewards.ts';
import { markGiven } from '../core/economy.ts';
import { ICONS } from './icons.ts';
import { JarBar } from './jars.ts';
import { popIn, stagger, wait, reducedMotion, EASE_OUT } from '../render/motion.ts';
import { enterChild } from './flow.ts';
import { rewardsScreen } from './rewards.ts';
import { mapScreen } from './map.ts';

export function unlockScreen(child: Child, jarName: 'treat' | 'goal') {
  return (app: App): Screen => {
    const jar = child.wallet[jarName];
    const r = rewardById(jar.rewardId ?? '')!;
    const el = html(`<section class="screen unlock" aria-label="Reward unlocked">
      <div class="spotlight" aria-hidden="true"></div>
      <p class="chip">${jarName === 'treat' ? 'Treat' : 'Big goal'} unlocked!</p>
      <div class="ul-stage"><div class="ul-ring" aria-hidden="true"></div><div class="ul-icon">${r.icon}</div></div>
      <h1 class="title">${esc(r.name)}</h1>
      <p class="subtitle">You earned it, ${esc(child.name)}! <b>Show this to Mummy or Papa!</b></p>
      <div class="ul-photo"></div>
      <div class="ul-actions">
        <button class="btn mint given">${ICONS.check} Given (grown-up)</button>
        <button class="btn ghost later">Keep playing</button>
      </div>
      <p class="ul-wait">Waiting to be given</p>
    </section>`);
    if (jar.photo) void app.photos.load(jar.photo).then((url) => {
      if (url) el.querySelector('.ul-photo')!.innerHTML = `<img class="agreed" alt="What was agreed" src="${url}">`;
    });
    el.querySelector('.given')!.addEventListener('click', async () => {
      if (!(await app.grownUp('Mark the reward as given'))) return;
      app.save.update(() => markGiven(child.wallet, jarName, app.today));
      app.sfx.fanfare();
      void app.show(rewardsScreen(child, jarName));
    });
    el.querySelector('.later')!.addEventListener('click', () => {
      const other = jarName === 'treat' ? child.wallet.goal : child.wallet.treat;
      if (other.waiting) return void app.show(unlockScreen(child, jarName === 'treat' ? 'goal' : 'treat'));
      void app.show(mapScreen(child));
    });
    return {
      el,
      mounted: async () => {
        const icon = el.querySelector<HTMLElement>('.ul-icon')!;
        if (!reducedMotion()) {
          el.querySelector('.spotlight')!.animate([{ transform: 'rotate(-40deg)', opacity: 0 }, { transform: 'rotate(20deg)', opacity: 1 }], { duration: 1400, easing: EASE_OUT, fill: 'both' });
          icon.animate([{ transform: 'scale(0) rotate(-30deg)', filter: 'grayscale(1) brightness(2)' }, { transform: 'scale(1.25) rotate(8deg)', filter: 'grayscale(.5)', offset: 0.6 }, { transform: 'scale(1)', filter: 'none' }], { duration: 1100, easing: EASE_OUT, fill: 'backwards' });
        }
        stagger(el.querySelectorAll('.chip, .title, .subtitle, .ul-actions .btn'), { delay: 600, gap: 110 });
        app.sfx.fanfare();
        await wait(700);
        const b = icon.getBoundingClientRect();
        app.fx.confetti(b.x + b.width / 2, b.y + b.height / 2, 120, 1.4);
        await wait(600);
        app.fx.confetti(b.x + b.width / 2, b.y, 60);
        app.voice.say(`Hooray! You earned the ${r.name}! Show this to Mummy or Papa!`);
      },
    };
  };
}

export function meltedScreen(child: Child, lost: { treat: number; goal: number; days: number }) {
  return (app: App): Screen => {
    const r = child.wallet.treat.rewardId ? rewardById(child.wallet.treat.rewardId) : undefined;
    const el = html(`<section class="screen melted" aria-label="Welcome back">
      <div class="melt-choc" aria-hidden="true">
        <svg viewBox="0 0 120 140"><defs><linearGradient id="ch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A5B34"/><stop offset="1" stop-color="#5B3216"/></linearGradient></defs>
          <rect x="22" y="14" width="76" height="70" rx="10" fill="url(#ch)"/>
          <g fill="#7A4524" opacity=".7"><rect x="30" y="22" width="26" height="24" rx="4"/><rect x="64" y="22" width="26" height="24" rx="4"/><rect x="30" y="52" width="26" height="24" rx="4"/><rect x="64" y="52" width="26" height="24" rx="4"/></g>
          <path class="drip d1" d="M34 82 C34 96 40 98 40 108 C40 114 32 114 32 108 C32 100 30 94 30 82 Z" fill="#6B3A1C"/>
          <path class="drip d2" d="M62 82 C62 104 70 108 70 120 C70 128 58 128 58 120 C58 110 56 100 56 82 Z" fill="#6B3A1C"/>
          <path class="drip d3" d="M88 82 C88 92 92 94 92 100 C92 104 86 104 86 100 C86 96 84 92 84 82 Z" fill="#6B3A1C"/>
        </svg>
      </div>
      <h1 class="title">Welcome back, ${esc(child.name)}!</h1>
      <p class="subtitle">You missed ${lost.days} day${lost.days === 1 ? '' : 's'}, so your ${r ? esc(r.name.toLowerCase()) : 'treat'} melted a little${r ? ` (−${Math.round(lost.treat)} of ${costOf(r)} coins)` : ''}.</p>
      <p class="subtitle">Play today and it starts filling again! 🍫</p>
      <div class="jar-slot"></div>
      <button class="btn go">Let’s play!</button>
    </section>`);
    const jar = new JarBar(child);
    el.querySelector('.jar-slot')!.appendChild(jar.el);
    el.querySelector('.go')!.addEventListener('click', () => enterChild(app, child, 'fade', false));
    return {
      el,
      mounted: () => {
        app.sfx.drip();
        stagger(el.querySelectorAll('.title, .subtitle, .jar-slot, .go'), { delay: 500, gap: 120 });
        if (!reducedMotion()) {
          el.querySelectorAll<SVGPathElement>('.drip').forEach((d, i) =>
            d.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 1600, delay: 200 + i * 300, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'backwards' }),
          );
        }
        popIn(el.querySelector('.melt-choc')!);
      },
    };
  };
}
