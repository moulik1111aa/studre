// Web pages outside MN open only after a parent check (Google Play's rule for apps for
// children), in the phone's browser.

import type { App } from './app.ts';

export const SITE = 'https://mn-mission-next.web.app';
export const PRIVACY_URL = `${SITE}/privacy`;
export const DELETE_URL = `${SITE}/delete`;

/** Open a web page. `checked`: a parent check was already passed (the Parent area). */
export async function openLink(app: App, url: string, checked = true): Promise<void> {
  if (!checked && !(await app.grownUp('Open a web page'))) return;
  if (app.native?.openUrl) return void (await app.native.openUrl({ url }).catch(() => app.toast('Couldn’t open the page.')));
  window.open(url, '_blank', 'noopener');
}
