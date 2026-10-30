// The ☰ side menu, like a game's: a panel slides in from the left over a dimmed screen.
// Tapping an item (or outside, or ✕, or Android back) closes it.

import { html, esc, type App } from './app.ts';
import { reducedMotion, EASE_OUT } from '../render/motion.ts';

export const MENU_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';

export type DrawerItem =
  | { heading: string }
  | { id: string; icon: string; label: string; note?: string; current?: boolean; onPick: () => void };

export interface DrawerOptions {
  title: string;
  /** A line under the title (e.g. the child's name). */
  sub?: string;
  /** Markup shown before the title (an avatar). */
  badge?: string;
  items: DrawerItem[];
}

/** Open the menu. Resolves when it has closed. */
export function openDrawer(app: App, o: DrawerOptions): Promise<void> {
  const ov = html(`<div class="overlay drawer-ov" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
    <nav class="drawer">
      <div class="dr-head">${o.badge ?? ''}<div class="dr-t"><b>${esc(o.title)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div><button class="icon-btn dr-close" aria-label="Close menu" data-back>✕</button></div>
      <ul class="dr-list">${o.items
        .map((it) =>
          'heading' in it
            ? `<li class="dr-h">${esc(it.heading)}</li>`
            : `<li><button class="dr-item${it.current ? ' on' : ''}" data-id="${esc(it.id)}"${it.current ? ' aria-current="page"' : ''}><span class="dr-i" aria-hidden="true">${it.icon}</span><span class="dr-l"><b>${esc(it.label)}</b>${it.note ? `<small>${esc(it.note)}</small>` : ''}</span></button></li>`,
        )
        .join('')}</ul>
    </nav>
  </div>`);
  app.root.appendChild(ov);
  const panel = ov.querySelector<HTMLElement>('.drawer')!;
  const calm = reducedMotion();
  if (!calm) {
    ov.animate([{ backgroundColor: 'rgba(8,8,30,0)' }, { backgroundColor: 'rgba(8,8,30,.55)' }], { duration: 220, fill: 'both' });
    panel.animate([{ transform: 'translateX(-100%)' }, { transform: 'none' }], { duration: 280, easing: EASE_OUT });
  }
  app.sfx.tap();
  return new Promise((done) => {
    let closing = false;
    const close = async (then?: () => void) => {
      if (closing) return;
      closing = true;
      if (!calm) {
        ov.animate([{ backgroundColor: 'rgba(8,8,30,.55)' }, { backgroundColor: 'rgba(8,8,30,0)' }], { duration: 180, fill: 'both' });
        await panel.animate([{ transform: 'none' }, { transform: 'translateX(-100%)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
      }
      ov.remove();
      done();
      then?.();
    };
    ov.addEventListener('click', (e) => {
      if (e.target === ov) void close();
    });
    ov.querySelector('.dr-close')!.addEventListener('click', () => void close());
    ov.querySelectorAll<HTMLButtonElement>('.dr-item').forEach((b) =>
      b.addEventListener('click', () => {
        const it = o.items.find((x) => 'id' in x && x.id === b.dataset.id) as Extract<DrawerItem, { id: string }> | undefined;
        void close(it?.onPick);
      }),
    );
    (ov.querySelector<HTMLElement>('.dr-item.on') ?? ov.querySelector<HTMLElement>('.dr-item'))?.focus({ preventScroll: true });
  });
}
