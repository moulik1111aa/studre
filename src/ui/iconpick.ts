// MN Premium: choose the app's launcher icon (Android). The phone keeps the choice itself (one
// launcher entry is on at a time), so there is nothing to save in the app.

import { esc, type App } from './app.ts';
import { APP_ICONS, appIconSvg, type AppIconId } from './appicons.ts';

/** Can this phone switch icons? (The Android app; browser test runs too, to see the sheet.) */
export const iconsAvailable = (app: App): boolean => !!app.native?.setAppIcon || app.debug;

let shown: AppIconId = 'sky';
/** The icon on the home screen now. */
export async function currentIcon(app: App): Promise<AppIconId> {
  try {
    const r = await app.native?.appIcon?.();
    if (r?.name && APP_ICONS.some((i) => i.id === r.name)) shown = r.name as AppIconId;
  } catch {
    /* older app: the sky icon */
  }
  return shown;
}

export async function chooseAppIcon(app: App): Promise<void> {
  const now = await currentIcon(app);
  const { el, result } = app.sheet(
    `<h2>App icon</h2><p class="fine">The icon for MN on your home screen. Some phones close MN for a moment when it changes.</p>
     <div class="ic-grid">${APP_ICONS.map((i) => `<button class="ic-opt${i.id === now ? ' on' : ''}" data-icon="${i.id}" aria-pressed="${i.id === now}">${appIconSvg(i.id, 'square', 72)}<span>${esc(i.name)}</span></button>`).join('')}</div>`,
    [{ label: 'Done', value: null, kind: 'ghost', back: true }],
    'App icon',
  );
  // The choice applies as soon as one is tapped.
  const sheet = el;
  sheet.querySelectorAll<HTMLButtonElement>('.ic-opt').forEach((b) =>
    b.addEventListener('click', async () => {
      const id = b.dataset.icon as AppIconId;
      sheet.querySelectorAll('.ic-opt').forEach((x) => (x.classList.toggle('on', x === b), x.setAttribute('aria-pressed', String(x === b))));
      let ok = !app.native?.setAppIcon;
      try {
        ok = (await app.native?.setAppIcon?.({ name: id }))?.ok ?? ok;
      } catch {
        ok = false;
      }
      if (ok) {
        shown = id;
        app.toast(`MN’s icon is now ${APP_ICONS.find((i) => i.id === id)!.name}. It can take a few seconds to change on the home screen.`, 4000);
        document.querySelectorAll('.ic-now').forEach((n) => (n.innerHTML = appIconSvg(id, 'square', 40)));
      } else app.toast('The icon could not be changed on this phone.');
    }),
  );
  await result;
}
