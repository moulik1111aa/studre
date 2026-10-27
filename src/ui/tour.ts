// The quick tour, in two parts.
//  1. For grown-ups: the opening video, in reel.ts.
//  2. Map tips (for the child, the first time they reach the map): Plus points at the
//     treat jar, the big goal, the path, a boss, the timer, Play and the trophy room, and
//     reads each tip aloud. A "?" button on the map plays them again.

import { html, type App } from './app.ts';
import type { Child } from '../storage/save.ts';
import { plusFaceSvg, type Outfit } from './plus.ts';
import { rewardById } from '../core/rewards.ts';
import { reducedMotion, wait, EASE_OUT } from '../render/motion.ts';

// ── 2. Map tips ────────────────────────────────────────────────────────────

export interface Tip {
  /** What to point at (inside the map screen); none = a tip in the middle. */
  at?: string;
  text: string;
}

function tipsFor(child: Child, el: HTMLElement): Tip[] {
  const w = child.wallet;
  const treat = w.treat.rewardId ? rewardById(w.treat.rewardId)?.name : undefined;
  const goal = w.goal.rewardId ? rewardById(w.goal.rewardId)?.name : undefined;
  const tips: Tip[] = [
    { text: `Hi ${child.name}! I’m Plus. Let me show you around!` },
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
  return runTips(app, el, tipsFor(child, el), {
    onClose: () => {
      app.save.update(() => (child.toured = true));
      el.querySelector('[data-tip-boss]')?.removeAttribute('data-tip-boss');
    },
  });
}

export interface TipsOptions {
  /** Offer Skip (default: yes). */
  skip?: boolean;
  label?: string;
  /** The last button's text. */
  last?: string;
  outfit?: Outfit;
  onClose?: () => void;
}

/** Plus points at things on screen `el`, one tip at a time (read aloud). */
export function runTips(app: App, el: HTMLElement, tips: Tip[], o: TipsOptions = {}): Promise<void> {
  const canSkip = o.skip !== false;
  const ov = html(`<div class="overlay tips-ov" role="dialog" aria-modal="true" aria-label="${o.label ?? 'How it works'}">
    <div class="tip-hole"></div>
    <div class="tip-card">
      <div class="tip-dog">${plusFaceSvg({ cls: 'alive', outfit: o.outfit })}</div>
      <p class="tip-text" aria-live="polite"></p>
      <div class="tip-foot"><span class="tip-count"></span>${canSkip ? '<button class="btn ghost small tip-skip" data-back>Skip</button>' : ''}<button class="btn small tip-next">Next</button></div>
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
      o.onClose?.();
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
      if (target && target.closest('.worlds, .scroll')) {
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
      nextBtn.textContent = k === tips.length - 1 ? (o.last ?? 'Let’s go!') : 'Next';
      nextBtn.classList.toggle('mint', k === tips.length - 1);
      const skipBtn = ov.querySelector<HTMLElement>('.tip-skip');
      if (skipBtn) skipBtn.style.visibility = k === tips.length - 1 ? 'hidden' : 'visible';
      await place();
      if (!reducedMotion()) card.animate([{ opacity: 0, transform: 'translateY(8px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE_OUT });
      app.voice.say(tips[k].text);
      busy = false;
    };
    nextBtn.addEventListener('click', () => void step());
    ov.querySelector('.tip-skip')?.addEventListener('click', close);
    if (!reducedMotion()) ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    void step();
  });
}
