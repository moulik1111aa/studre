// Review fix 7: the Google Play build opens without any access key, and has no test hooks even
// with ?debug. The shared build (dist/, served at /) still asks for a key on a phone it doesn't know.
import { test, expect, type Page } from 'playwright/test';
// @ts-expect-error plain JavaScript module used by the build
import { playBundle } from '../scripts/check-play.mjs';

let playHtml = '';
test.beforeAll(async () => {
  playHtml = await playBundle();
});

/** A family that has seen the opening video but has no children yet. */
async function seed(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('studyhard.save')) localStorage.setItem('studyhard.save', JSON.stringify({ version: 1, children: [], settings: { tourSeen: true } }));
  });
}

const PIN = '2468';
/** The parent check (the times question before a PIN exists, then the PIN). */
async function grownUp(page: Page): Promise<void> {
  const t = (await page.locator('.grownup h2').textContent()) ?? '';
  const m = /(\d+) × (\d+)/.exec(t);
  for (const d of m ? String(Number(m[1]) * Number(m[2])) : PIN) await page.locator(`.gu-pad [data-k="${d}"]`).click();
  await page.locator('.grownup .ok').click();
}

async function openPlay(page: Page, query = '') {
  await page.route('**/play.html*', (r) => r.fulfill({ body: playHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto(`/play.html${query}`);
}

test('the Play build opens with no key and no lock screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seed(page);
  await openPlay(page);
  await expect(page.locator('.screen.welcome')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.screen.lock')).toHaveCount(0);
  // Setup still works without the owner code: parent check, parent PIN, one child, Who's playing.
  await page.click('.welcome .start');
  await grownUp(page);
  await expect(page.locator('.gu-setup')).toBeVisible();
  await page.click('.gs-pin');
  for (const round of [0, 1]) {
    for (const d of PIN) await page.locator(`.gs-pinbox [data-k="${d}"]`).click();
    await page.click('.gs-next');
    if (!round) await expect(page.locator('.gs-pinbox h2')).toHaveText('Type it again');
  }
  await page.fill('.name', 'Riya');
  await page.click('.ac-next');
  await page.click('.ac-age[data-age="8"]');
  for (let i = 0; i < 3; i++) await page.click('.ac-next');
  await expect(page.locator('.ac-next')).toHaveText('Save Riya');
  await page.click('.ac-next');
  await page.click('.more-kids .next');
  // Play time and rewards: five stops, all left as they are.
  await expect(page.locator('.stops li')).toHaveCount(5);
  for (let i = 0; i < 5; i++) await page.click('.limits .done');
  await expect(page.locator('.kid')).toContainText(['Riya']);
  await expect(page.locator('.screen.lock')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the Play build has no test hooks, even with ?debug', async ({ page }) => {
  await seed(page);
  await openPlay(page, '?debug&cloudmock&store');
  await expect(page.locator('.screen.welcome')).toBeVisible({ timeout: 15_000 });
  const hooks = await page.evaluate(() => ['__app', '__screens', '__share', '__shared', '__syncNow', '__mockGoogle', '__mockBilling'].filter((k) => k in window));
  expect(hooks).toEqual([]);
});

test('the shared build still asks for a key on a phone it doesn’t know', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await expect(page.locator('.screen.lock')).toBeVisible({ timeout: 15_000 });
});
