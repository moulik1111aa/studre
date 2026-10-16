// Choosing rewards: a picture catalogue by category. Pick a treat, then a big goal; once
// chosen it is locked in. A grown-up can attach a photo of what was agreed.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { CATEGORIES, pickable, rewardById, setOwnRewards, costOf, aboutOf, jarOf, PRICES, type Reward, type Jar, type PriceTier } from '../core/rewards.ts';
import { chooseReward } from '../core/economy.ts';
import { ICONS, coinSvg, avatarHtml } from './icons.ts';
import { stagger, popIn, EASE_OUT, reducedMotion } from '../render/motion.ts';
import { enterChild } from './flow.ts';

export function rewardsScreen(child: Child, jar: Jar) {
  return (app: App): Screen => {
    const hidden = new Set(app.save.data.settings.hiddenCategories);
    let list = pickable().filter((r) => jarOf(r) === jar && !hidden.has(r.category));
    const cats = CATEGORIES.filter((c) => c.id === 'own' ? !hidden.has('own') : list.some((r) => r.category === c.id));
    let active = cats[0]?.id;
    const el = html(`<section class="screen rewards" aria-label="Choose a reward">
      <header class="rw-head">${avatarHtml(child.avatar, 48)}<div><h1 class="title">${jar === 'treat' ? 'Pick your treat!' : 'Pick a big goal!'}</h1>
        <p class="subtitle">${jar === 'treat' ? 'Play every day to fill the bar.' : 'Save up slowly for something special.'}</p></div></header>
      <nav class="cats scroll" aria-label="Categories">${cats.map((c) => `<button class="cat" data-c="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('')}</nav>
      <div class="rw-grid scroll"></div>
    </section>`);
    const grid = el.querySelector<HTMLElement>('.rw-grid')!;
    const paint = () => {
      el.querySelectorAll<HTMLElement>('.cat').forEach((b) => b.classList.toggle('on', b.dataset.c === active));
      grid.innerHTML =
        list
          .filter((r) => r.category === active)
          .map((r) => `<button class="rw-card" data-r="${r.id}"><span class="rw-icon">${r.icon}</span><b>${esc(r.name)}</b><span class="rw-cost">${coinSvg}${costOf(r)}</span><small>${aboutOf(r)}</small></button>`)
          .join('') + (active === 'own' ? `<button class="rw-card rw-add"><span class="rw-icon">＋</span><b>Add your own</b><small>A grown-up names it and picks its size</small></button>` : '');
      stagger(grid.children, { gap: 40, y: 14 });
      grid.querySelectorAll<HTMLButtonElement>('.rw-card[data-r]').forEach((b) => b.addEventListener('click', () => confirm(rewardById(b.dataset.r!)!)));
      grid.querySelector('.rw-add')?.addEventListener('click', async () => {
        if (await app.grownUp('Add your own reward')) addOwn();
      });
    };
    el.querySelector('.cats')!.addEventListener('click', (e) => {
      const c = (e.target as HTMLElement).closest<HTMLElement>('.cat')?.dataset.c;
      if (c) {
        active = c;
        paint();
      }
    });

    /** A grown-up adds a reward that is not in the list: name, picture and size. */
    const addOwn = () => {
      const sizes: [PriceTier, string][] = jar === 'treat'
        ? [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]
        : [['toyS', 'Toy'], ['toyM', 'Bigger toy'], ['toyB', 'Big'], ['dream', 'Dream']];
      const icons = jar === 'treat' ? ['🎁', '🍫', '🍦', '🍕', '🎟️', '📚', '🎨', '🧸'] : ['🎁', '🧸', '🎮', '🚲', '🎢', '⚽', '🎧', '🏏'];
      let tier: PriceTier = sizes[0][0];
      let icon = icons[0];
      const ov = html(`<div class="overlay" role="dialog" aria-modal="true" aria-label="Add your own reward"><div class="sheet own-sheet">
        <h2>Your own reward</h2>
        <label class="field"><span>What is it?</span><input class="own-name" maxlength="40" placeholder="${jar === 'treat' ? 'e.g. Pani puri at the stall' : 'e.g. Cricket gloves'}"></label>
        <div class="field"><span>Picture</span><div class="own-icons">${icons.map((i, k) => `<button class="own-ic${k ? '' : ' on'}" data-i="${i}">${i}</button>`).join('')}</div></div>
        <div class="field"><span>How big is it?</span><div class="seg seg${sizes.length}">${sizes.map(([t, n], k) => `<button class="seg-b${k ? '' : ' on'}" data-t="${t}"><b>${n}</b><small>${PRICES[t].about.replace('about ', '')}</small></button>`).join('')}</div></div>
        <div class="actions"><button class="btn mint own-save">Add it</button><button class="btn ghost" data-back>Cancel</button></div>
      </div></div>`);
      const close = () => ov.remove();
      ov.querySelector('[data-back]')!.addEventListener('click', close);
      ov.querySelectorAll<HTMLButtonElement>('.own-ic').forEach((b) => b.addEventListener('click', () => {
        icon = b.dataset.i!;
        ov.querySelectorAll('.own-ic').forEach((x) => x.classList.toggle('on', x === b));
      }));
      ov.querySelectorAll<HTMLButtonElement>('.seg-b').forEach((b) => b.addEventListener('click', () => {
        tier = b.dataset.t as PriceTier;
        ov.querySelectorAll('.seg-b').forEach((x) => x.classList.toggle('on', x === b));
      }));
      ov.querySelector('.own-save')!.addEventListener('click', () => {
        const name = ov.querySelector<HTMLInputElement>('.own-name')!.value.trim().slice(0, 40);
        if (!name) {
          app.toast('Type what the reward is.');
          return;
        }
        const own = { id: `own.${Date.now().toString(36)}`, name, icon, tier };
        app.save.update((d) => d.settings.ownRewards.push(own));
        setOwnRewards(app.save.data.settings.ownRewards);
        list = pickable().filter((r) => jarOf(r) === jar && !hidden.has(r.category));
        close();
        paint();
        confirm(rewardById(own.id)!);
      });
      app.root.appendChild(ov);
      if (!reducedMotion()) ov.querySelector('.sheet')!.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 420, easing: EASE_OUT });
    };

    const confirm = (r: Reward) => {
      let photo: string | undefined;
      const ov = html(`<div class="overlay" role="dialog" aria-modal="true" aria-label="${esc(r.name)}"><div class="sheet rw-confirm">
        <div class="rw-big">${r.icon}</div><h2>${esc(r.name)}</h2>
        <p class="rw-price">${coinSvg} ${costOf(r)} coins · ${aboutOf(r)}</p>
        <p class="lock-note">${ICONS.lock} Once you choose, it’s locked in until you earn it.</p>
        <div class="photo-slot"></div>
        <div class="actions">
          <button class="btn mint pick">Choose this!</button>
          <button class="btn ghost small add-photo">${ICONS.camera} Add photo of what we agreed (grown-up)</button>
          <button class="btn ghost" data-back>Look at others</button>
        </div>
        <input type="file" accept="image/*" class="file" hidden>
      </div></div>`);
      const close = () => ov.remove();
      ov.querySelector('[data-back]')!.addEventListener('click', close);
      const file = ov.querySelector<HTMLInputElement>('.file')!;
      ov.querySelector('.add-photo')!.addEventListener('click', async () => {
        if (await app.grownUp('Add a photo of the agreed reward')) file.click();
      });
      file.addEventListener('change', async () => {
        const f = file.files?.[0];
        if (!f) return;
        try {
          photo = await app.photos.save(f);
          const url = await app.photos.load(photo);
          ov.querySelector('.photo-slot')!.innerHTML = `<img class="agreed" alt="Agreed reward photo" src="${url}">`;
          popIn(ov.querySelector('.agreed')!);
        } catch {
          app.toast('That photo could not be added.');
        }
      });
      ov.querySelector('.pick')!.addEventListener('click', () => {
        app.save.update(() => chooseReward(child.wallet, r.id, photo));
        close();
        app.sfx.fanfare();
        const b = el.querySelector(`[data-r="${CSS.escape(r.id)}"]`)?.getBoundingClientRect();
        if (b) app.fx.confetti(b.x + b.width / 2, b.y + b.height / 2, 50);
        setTimeout(() => enterChild(app, child, 'fade', false), 700);
      });
      app.root.appendChild(ov);
      if (!reducedMotion()) ov.querySelector('.sheet')!.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 480, easing: EASE_OUT });
      popIn(ov.querySelector('.rw-big')!, 150, 0.3);
    };

    return {
      el,
      mounted: () => {
        stagger([el.querySelector('.rw-head')!, el.querySelector('.cats')!], { gap: 90 });
        paint();
      },
    };
  };
}
