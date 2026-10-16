// Who's playing? Big avatar buttons for each child, plus the parent area.

import { html, esc, type App, type Screen } from './app.ts';
import { ICONS, avatarHtml } from './icons.ts';
import { LOGO_MARK } from './loader.ts';
import { stagger, drawOn } from '../render/motion.ts';
import { enterChild } from './flow.ts';
import { parentScreen } from './parent.ts';
import { faceoffSetupScreen } from './faceoff.ts';
import { jarProgress } from '../core/economy.ts';
import { rewardById } from '../core/rewards.ts';

export function whosPlayingScreen(app: App): Screen {
  const kids = app.save.data.children;
  const el = html(`<section class="screen whos" aria-label="Who's playing">
    <header class="topbar"><button class="icon-btn faceoff-btn" aria-label="Face-off">${ICONS.swords}</button><div class="brand">${LOGO_MARK}<b>Study Hard</b></div><button class="icon-btn parent-btn" aria-label="Parent area">${ICONS.gear}</button></header>
    <h1 class="title center">Who’s playing?</h1>
    <div class="kids">${kids
      .map((c) => {
        const r = c.wallet.treat.rewardId ? rewardById(c.wallet.treat.rewardId) : undefined;
        const p = Math.round(jarProgress(c.wallet.treat) * 100);
        return `<button class="kid card" data-id="${c.id}">${avatarHtml(c.avatar, 84)}<b>${esc(c.name)}</b><small>${r ? `${r.icon} ${p}%` : 'Age ' + c.age}</small></button>`;
      })
      .join('')}</div>
    ${kids.length ? `<button class="btn ghost fo-entry">${ICONS.swords} Face-off: play together</button>` : ''}
  </section>`);
  el.querySelectorAll<HTMLButtonElement>('.kid').forEach((b) =>
    b.addEventListener('click', () => {
      const c = app.save.data.children.find((k) => k.id === b.dataset.id)!;
      enterChild(app, c, 'liquid');
    }),
  );
  el.querySelector('.fo-entry')?.addEventListener('click', () => void app.show(faceoffSetupScreen(), 'liquid'));
  el.querySelector('.faceoff-btn')!.addEventListener('click', () => void app.show(faceoffSetupScreen(), 'liquid'));
  el.querySelector('.parent-btn')!.addEventListener('click', async () => {
    if (await app.grownUp('Parent area')) void app.show(parentScreen);
  });
  return {
    el,
    mounted: () => {
      const mark = el.querySelector<SVGElement>('.brand svg')!;
      void drawOn(mark, { duration: 500, stagger: 30 }).then(() => mark.classList.add('alive'));
      stagger([el.querySelector('.title')!, ...el.querySelectorAll('.kid')], { gap: 90 });
    },
  };
}
