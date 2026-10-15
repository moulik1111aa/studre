// End-to-end: the real app in Chromium at phone size. Setup → placement → rewards → a level;
// boss and minion fights won by answering correctly; melting, unlocking and time's up.
// Debug builds expose the correct answer on the question card (data-answer) and accept
// `?debug&demo=<level id>` to start from a placed child with rewards chosen.

import { test, expect, type Page } from 'playwright/test';

async function grownUp(page: Page): Promise<void> {
  const t = (await page.locator('.grownup h2').textContent()) ?? '';
  const [, a, b] = /(\d+) × (\d+)/.exec(t)!;
  for (const d of String(Number(a) * Number(b))) await page.locator(`.gu-pad [data-k="${d}"]`).click();
  await page.locator('.grownup .ok').click();
}

/** Answer every question correctly until `done` appears. */
async function playThrough(page: Page, done: string, max = 60): Promise<number> {
  let answered = 0;
  for (let i = 0; i < max * 8 && answered < max; i++) {
    if (await page.locator(done).count()) break;
    const card = page.locator('.qcard[data-answer]');
    if (!(await card.count()) || !(await page.locator('.choice:not([disabled]), .pad .key').count())) {
      await page.waitForTimeout(200);
      continue;
    }
    const ans = (await card.getAttribute('data-answer'))!;
    if (await page.locator('.choice').count()) {
      const vals = await page.locator('.choice').evaluateAll((bs) => bs.map((b) => decodeURIComponent((b as HTMLElement).dataset.v!)));
      const idx = vals.indexOf(ans);
      expect(idx, `answer ${ans} among ${vals.join(', ')}`).toBeGreaterThanOrEqual(0);
      try {
        await page.locator('.choice').nth(idx).click({ timeout: 1500 });
      } catch {
        continue;
      }
    } else {
      for (const ch of ans.replace(/^-/, '−')) await page.locator(`.answers [data-k="${ch}"]`).first().dispatchEvent('pointerdown');
      await page.locator('.answers .ok').click();
    }
    answered++;
    await page.waitForTimeout(250);
  }
  await expect(page.locator(done)).toBeVisible({ timeout: 20_000 });
  return answered;
}

async function seeded(page: Page, level: string, mutate?: string): Promise<void> {
  await page.goto(`/?debug&demo=${encodeURIComponent(level)}`);
  await expect(page.locator('.map')).toBeVisible();
  if (mutate) {
    await page.evaluate(mutate);
    await page.goto('/?debug&noloader');
    await page.locator('.kid').first().click();
  }
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  (page as unknown as { errors: string[] }).errors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { errors: string[] }).errors).toEqual([]);
});

test('first run: setup, placement, rewards, first level', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?debug');
  await expect(page.locator('.welcome')).toBeVisible({ timeout: 20_000 });
  await page.click('.start');
  await grownUp(page);
  await page.fill('.name', 'Riya');
  await page.click('.plus');
  await page.click('.plus');
  await expect(page.locator('.age')).toHaveText('8');
  await page.click('.save');
  await page.click('.more-kids .next');
  await page.locator('.slider').fill('45');
  await page.click('.seg-b[data-m="keep"]');
  await page.click('.limits .done');
  await page.locator('.kid').first().click();
  await expect(page.locator('.placement')).toBeVisible();
  for (let i = 0; i < 30 && !(await page.locator('.go').count()); i++) {
    if (await page.locator('[data-a="yes"]').count()) await page.click('[data-a="yes"]');
    await page.waitForTimeout(400);
  }
  await page.click('.go');
  await expect(page.locator('.rewards')).toContainText('Pick your treat');
  await page.locator('.rw-card').first().click();
  await page.click('.pick');
  await expect(page.locator('.rewards')).toContainText('Pick a big goal', { timeout: 5000 });
  await page.locator('.rw-card').first().click();
  await page.click('.pick');
  await expect(page.locator('.map')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.who small')).toContainText('45 min left');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.settings.limitMinutes).toBe(45);
  expect(save.settings.timeUpMode).toBe('keep');
  expect(save.children[0].placed).toBe(true);
  expect(Object.keys(save.children[0].progress.skipped).length).toBeGreaterThan(0);

  await page.click('.play-next');
  await expect(page.locator('.play')).toBeVisible();
  await playThrough(page, '.result');
  await expect(page.locator('.res-title')).not.toHaveText('So close!');
  await expect(page.locator('.rstar.on')).toHaveCount(3);
  await expect(page.locator('.coin-count')).toHaveText(/\+\d+/, { timeout: 5000 });
});

test('boss fight: win against Mr Bubbles', async ({ page }) => {
  await page.goto('/?debug&demo=boss%3Aarithmetic%3A1%3Amid&play');
  await expect(page.locator('.boss-fight')).toBeVisible();
  await expect(page.locator('.speech')).toContainText('bubbles');
  const n = await playThrough(page, '.result');
  expect(n).toBeGreaterThanOrEqual(10);
  await expect(page.locator('.res-title')).toContainText('defeated');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.children[0].bossesBeaten).toContain('bubbles');
});

test('minion review needs all ten right', async ({ page }) => {
  await page.goto('/?debug&demo=review%3Aarithmetic%3A2%3A1&play');
  await expect(page.locator('.minion-fight')).toBeVisible();
  await playThrough(page, '.result');
  await expect(page.locator('.res-title')).toHaveText('Minion beaten!');
});

test('missed days melt the treat a little', async ({ page }) => {
  await seeded(
    page,
    '@0',
    `(() => { const a = window.__app; a.save.update((d) => { const w = d.children[0].wallet; w.treat.coins = 200; w.lastPlayDay = '2000-01-01'; w.meltCheckedDay = undefined; const t = new Date(); t.setDate(t.getDate() - 4); w.lastPlayDay = t.toISOString().slice(0, 10); }); })()`,
  );
  await expect(page.locator('.melted')).toBeVisible();
  await expect(page.locator('.melted')).toContainText('melted a little');
  await page.click('.melted .go');
  await expect(page.locator('.map')).toBeVisible();
});

test('a full jar unlocks the reward; Given needs a grown-up', async ({ page }) => {
  await seeded(page, '@0', `window.__app.save.update((d) => { const t = d.children[0].wallet.treat; t.coins = 360; t.waiting = true; })`);
  await expect(page.locator('.unlock')).toBeVisible();
  await expect(page.locator('.unlock .title')).toHaveText('Milk chocolate bar');
  await page.click('.given');
  await grownUp(page);
  await expect(page.locator('.rewards')).toContainText('Pick your treat');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.children[0].wallet.earned.length).toBe(1);
  expect(save.children[0].wallet.treat.rewardId).toBeFalsy();
});

test("time's up stops play for the day", async ({ page }) => {
  await seeded(page, '@0', `window.__app.save.update((d) => { const w = d.children[0].wallet; w.todayDay = window.__app.today; w.todaySeconds = 31 * 60; })`);
  await expect(page.locator('.map')).toBeVisible();
  await page.click('.play-next');
  await expect(page.locator('.timesup')).toBeVisible();
});
