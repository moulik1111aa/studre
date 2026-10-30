// End-to-end: the real app in Chromium at phone size. Setup → placement → rewards → a level;
// boss and minion fights won by answering correctly; melting, unlocking and time's up.
// Debug builds expose the correct answer on the question card (data-answer) and accept
// `?debug&demo=<level id>` to start from a placed child with rewards chosen.

import { test, expect, type Page } from 'playwright/test';

const PIN = '2468';
/** The grown-up check: the parent PIN once set, else the times question. */
async function grownUp(page: Page): Promise<void> {
  const t = (await page.locator('.grownup h2').textContent()) ?? '';
  const m = /(\d+) × (\d+)/.exec(t);
  const typed = m ? String(Number(m[1]) * Number(m[2])) : PIN;
  for (const d of typed) await page.locator(`.gu-pad [data-k="${d}"]`).click();
  await page.locator('.grownup .ok').click();
}

/** Setup's grown-up lock: make the parent PIN (this browser has no screen lock). */
async function makePin(page: Page): Promise<void> {
  await expect(page.locator('.gu-setup')).toBeVisible();
  await page.click('.gs-pin');
  for (const round of [0, 1]) {
    for (const d of PIN) await page.locator(`.gs-pinbox [data-k="${d}"]`).click();
    await page.click('.gs-next');
    if (!round) await expect(page.locator('.gs-pinbox h2')).toHaveText('Type it again');
  }
}

/** Step through the opening video: each stop's Next unlocks once its line has played. */
async function watchReel(page: Page): Promise<void> {
  for (let k = 0; k < 40 && !(await page.locator('.rl-go').isVisible()); k++) {
    const next = page.locator('.rl-next');
    if ((await next.isVisible()) && (await next.isEnabled())) await next.click();
    else await page.waitForTimeout(100);
  }
  await expect(page.locator('.rl-go')).toBeVisible();
}

/** Answer every question correctly until `done` appears. */
async function playThrough(page: Page, done: string, max = 60): Promise<number> {
  let answered = 0;
  for (let i = 0; i < max * 8 && answered < max; i++) {
    if (await page.locator(done).count()) break;
    // Plus's word before the level: tap it away.
    if (await page.locator('.plus-says:not(.out)').count()) await page.locator('.plus-says').click().catch(() => undefined);
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
      try {
        for (const ch of ans.replace(/^-/, '−')) await page.locator(`.answers [data-k="${ch}"]`).first().dispatchEvent('pointerdown', {}, { timeout: 1500 });
        await page.locator('.answers .ok').click({ timeout: 1500 });
      } catch {
        continue;
      }
    }
    answered++;
    // Wait for the next question (a right answer glows green; a wrong one shows the answer).
    await page.waitForTimeout(150);
    await page.waitForFunction(() => !document.querySelector('.qcard.right, .qcard .reveal'), null, { timeout: 8000 }).catch(() => undefined);
  }
  await expect(page.locator(done)).toBeVisible({ timeout: 20_000 });
  return answered;
}

/** Open a chest: hold the big key until the ring is full. */
async function holdKey(page: Page, ms = 1300): Promise<void> {
  const k = (await page.locator('.cc-key').boundingBox())!;
  await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Step through a tips walkthrough to the end. */
async function stepTips(page: Page): Promise<void> {
  for (let i = 0; i < 12 && (await page.locator('.tips-ov').count()); i++) {
    await page.click('.tip-next');
    await page.waitForTimeout(150);
  }
  await expect(page.locator('.tips-ov')).toHaveCount(0);
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

test.beforeEach(async ({ page }, info) => {
  // Plus's word before each level is tested on its own; elsewhere it stays quiet.
  if (!info.title.startsWith('Plus')) await page.addInitScript(() => Object.assign(window, { __quietPlus: true }));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  (page as unknown as { errors: string[] }).errors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { errors: string[] }).errors).toEqual([]);
});

test('first run: setup, placement, rewards, first level', async ({ page }) => {
  test.setTimeout(180_000);
  // First launch: the opening video (20× faster here), then setup.
  await page.goto('/?debug&fastreel');
  await expect(page.locator('.reel.first')).toBeVisible({ timeout: 20_000 });
  await watchReel(page);
  await page.click('.rl-go');
  await grownUp(page);
  await makePin(page);
  // Add a child, one stop at a time: Next waits for a name, then for an age.
  await expect(page.locator('.stops .stop-now')).toContainText('Name');
  await expect(page.locator('.ac-next')).toBeDisabled();
  await page.fill('.name', 'Riya');
  await page.click('.ac-next');
  await expect(page.locator('.stops .stop-now')).toContainText('Age');
  await expect(page.locator('.ac-next')).toBeDisabled();
  await page.click('.ac-age[data-age="8"]');
  await page.click('.ac-next');
  // Age 8 is suggested to play alone.
  await expect(page.locator('.stops .stop-now')).toContainText('Helper');
  await expect(page.locator('[data-h="0"]')).toHaveClass(/\bon\b/);
  await page.click('.ac-next');
  // Classic or Adventure: Classic unless a grown-up picks Adventure.
  await expect(page.locator('.stops .stop-now')).toContainText('Adventure');
  await expect(page.locator('[data-adv="0"]')).toHaveClass(/\bon\b/);
  await page.click('.ac-next');
  await expect(page.locator('.ac-next')).toHaveText('Save Riya');
  await page.click('.ac-next');
  await page.click('.more-kids .next');
  // Play time and rewards: four stops, the button stays in the same place.
  await expect(page.locator('.stops li')).toHaveCount(4);
  await page.locator('.slider').fill('45');
  await page.click('.limits .done');
  await page.click('.seg-b[data-m="keep"]');
  await page.click('.limits .done');
  await page.click('.limits .done');
  await expect(page.locator('.limits .done')).toHaveText('Finish setup');
  // A finished stop can be tapped to go back to it.
  await page.click('.stops li[data-stop="1"]');
  await expect(page.locator('.seg-b[data-m="keep"]')).toHaveClass(/\bon\b/);
  for (let i = 0; i < 3; i++) await page.click('.limits .done');
  await page.locator('.kid').first().click();
  await expect(page.locator('.placement')).toBeVisible();
  for (let i = 0; i < 30 && !(await page.locator('.go').count()); i++) {
    if (await page.locator('[data-a="yes"]').count()) await page.click('[data-a="yes"]');
    await page.waitForTimeout(400);
  }
  await page.click('.go');
  await expect(page.locator('.rewards')).toContainText('Pick your treat');
  await page.locator('.rw-cat-head').first().click();
  await page.locator('.rw-card').first().click();
  await page.click('.pick');
  await expect(page.locator('.rewards')).toContainText('Pick a big goal', { timeout: 5000 });
  await page.locator('.rw-cat-head').first().click();
  await page.locator('.rw-card').first().click();
  await page.click('.pick');
  // First: the child picks a reading voice.
  await expect(page.locator('.voicechoice')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.vc-go')).toBeDisabled();
  await page.locator('.vc-card').nth(1).click();
  await page.click('.vc-go');
  await expect(page.locator('.map')).toBeVisible({ timeout: 5000 });
  // First visit: Plus's tips; skip them.
  await expect(page.locator('.tips-ov')).toBeVisible({ timeout: 5000 });
  await page.click('.tip-skip');
  await expect(page.locator('.tips-ov')).toHaveCount(0);
  await expect(page.locator('.who small')).toContainText('45 min left');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.settings.limitMinutes).toBe(45);
  expect(save.settings.timeUpMode).toBe('keep');
  expect(save.children[0].placed).toBe(true);
  expect(Object.keys(save.children[0].progress.skipped).length).toBeGreaterThan(0);
  expect(save.children[0].voicePicked).toBe(true);
  expect(save.children[0].together).toBe(3);
  // A parent PIN, not a times question, from now on.
  expect(save.settings.parentPin).toMatch(/:/);

  // The first level is practice together: a word for the grown-up first.
  await page.click('.play-next');
  await expect(page.locator('.play')).toBeVisible();
  await expect(page.locator('.play-title b')).toContainText('Practice together');
  await page.click('.sheet .btn.mint');
  await playThrough(page, '.result');
  await expect(page.locator('.res-title')).not.toHaveText('So close!');
  await expect(page.locator('.rstar.on')).toHaveCount(3);
  await expect(page.locator('.coin-count')).toHaveText(/\+\d+/, { timeout: 5000 });
});

test('boss fight: win against Mr Bubbles', async ({ page }) => {
  await page.goto('/?debug&no3d&demo=boss%3Aarithmetic%3A1%3Amid&play');
  await expect(page.locator('.boss-fight')).toBeVisible();
  await expect(page.locator('.speech')).toContainText('bubbles');
  const n = await playThrough(page, '.result');
  expect(n).toBeGreaterThanOrEqual(10);
  await expect(page.locator('.res-title')).toContainText('defeated');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.children[0].bossesBeaten).toContain('bubbles');
});

test('3D boss arena loads and takes hits (or falls back to 2D)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?debug&demo=boss%3Aarithmetic%3A1%3Amid&play');
  await expect(page.locator('.boss-fight')).toBeVisible();
  await expect(page.locator('.boss3d canvas, .boss3d.flat')).toHaveCount(1, { timeout: 20000 });
  for (let i = 0; i < 2; i++) {
    const card = page.locator('.qcard[data-answer]');
    await expect(card).toBeVisible({ timeout: 30000 });
    const ans = (await card.getAttribute('data-answer'))!;
    const vals = await page.locator('.choice').evaluateAll((bs) => bs.map((b) => decodeURIComponent((b as HTMLElement).dataset.v!)));
    await page.locator('.choice').nth(vals.indexOf(ans)).click();
    await page.waitForTimeout(2500);
  }
  await expect.poll(async () => Number(await page.locator('.hp-bar').getAttribute('aria-valuenow')), { timeout: 15000 }).toBeLessThan(100);
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

test('face-off: tug of war against a guest, scoreboard and coins', async ({ page }) => {
  await page.goto('/?debug&demo=%4040');
  await expect(page.locator('.map')).toBeVisible();
  await page.goto('/?debug&noloader');
  await page.click('.fo-entry');
  await expect(page.locator('.fo-setup')).toBeVisible();
  await page.click('.fo-start');
  await expect(page.locator('.fo-half[data-side="0"] .choice').first()).toBeVisible({ timeout: 8000 });
  for (let i = 0; i < 20 && !(await page.locator('.fo-results').count()); i++) {
    const h = page.locator('.fo-half[data-side="0"]');
    const ans = await h.getAttribute('data-answer');
    const vals = await h.locator('.choice').evaluateAll((bs) => bs.map((b) => decodeURIComponent((b as HTMLElement).dataset.v!)));
    await h.locator('.choice').nth(vals.indexOf(ans!)).dispatchEvent('pointerdown');
    await page.waitForTimeout(400);
  }
  await expect(page.locator('.fo-end.won')).toContainText('Riya wins!');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(Object.values(save.faceoff)).toHaveLength(1);
  expect(save.children[0].wallet.lifetime).toBeGreaterThanOrEqual(5);
});

test('parent can skip a level, and undo the last hour', async ({ page }) => {
  await page.goto('/?debug&demo=%400');
  await expect(page.locator('.map')).toBeVisible();
  // Play the first level to earn stars and coins.
  await page.click('.play-next');
  await playThrough(page, '.result');
  await page.click('.res-actions .home');
  await expect(page.locator('.map')).toBeVisible();
  // Skip the next level (grown-up).
  await page.click('.skip-btn');
  await grownUp(page);
  await page.getByRole('button', { name: 'Skip it' }).click();
  await expect(page.locator('.toast')).toContainText('Level skipped');
  let save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(Object.keys(save.children[0].progress.skippedLevels)).toHaveLength(1);
  expect(save.children[0].wallet.lifetime).toBeGreaterThan(0);
  // Parent area → report → remove the last hour.
  await page.click('.who');
  await page.click('.parent-btn');
  await grownUp(page);
  await page.locator('.report').first().click();
  await page.click('[data-tab="manage"]');
  await page.click('.undo-hour');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Removed');
  save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(Object.keys(save.children[0].progress.skippedLevels ?? {})).toHaveLength(0);
  expect(save.children[0].wallet.lifetime).toBe(0);
  expect(save.children[0].progress.levels).toEqual({});
});

test('pausing hides the question and brings back a fresh one', async ({ page }) => {
  await page.goto('/?debug&demo=%402');
  await expect(page.locator('.map')).toBeVisible();
  await page.click('.play-next');
  const card = page.locator('.qcard[data-answer]');
  await expect(card).toBeVisible();
  await page.waitForTimeout(700);
  const before = await card.evaluate((c) => c.querySelector('.prompt')!.textContent + '|' + (c as HTMLElement).dataset.answer + '|' + c.querySelector('.vis, svg')?.outerHTML);
  await page.click('.quit');
  await expect(page.locator('.qwrap')).toBeHidden();
  await page.getByRole('button', { name: 'Keep going' }).click();
  await expect(page.locator('.qwrap')).toBeVisible();
  await page.waitForTimeout(700);
  const after = await card.evaluate((c) => c.querySelector('.prompt')!.textContent + '|' + (c as HTMLElement).dataset.answer + '|' + c.querySelector('.vis, svg')?.outerHTML);
  expect(after).not.toEqual(before);
  // The level still plays to the end with the same number of questions.
  await playThrough(page, '.result');
});

test('minion fight: a paused question is swapped too', async ({ page }) => {
  await page.goto('/?debug&demo=review%3Aarithmetic%3A2%3A1&play');
  const card = page.locator('.qcard[data-answer]');
  await expect(card).toBeVisible();
  const before = await card.evaluate((c) => c.querySelector('.prompt')!.textContent + '|' + (c as HTMLElement).dataset.answer);
  await page.click('.quit');
  await page.getByRole('button', { name: 'Keep fighting' }).click();
  await expect(card).toBeVisible();
  const after = await card.evaluate((c) => c.querySelector('.prompt')!.textContent + '|' + (c as HTMLElement).dataset.answer);
  expect(after).not.toEqual(before);
  await playThrough(page, '.result');
  await expect(page.locator('.res-title')).toHaveText('Minion beaten!');
});

test('parent can start a child over, then delete the profile', async ({ page }) => {
  await page.goto('/?debug&demo=%400');
  await expect(page.locator('.map')).toBeVisible();
  await page.click('.play-next');
  await playThrough(page, '.result');
  await page.click('.res-actions .home');
  await page.click('.who');
  await page.click('.parent-btn');
  await grownUp(page);
  await page.locator('.report').first().click();
  await page.click('[data-tab="manage"]');
  await page.click('.reset-kid');
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.locator('.toast').last()).toContainText('starting fresh');
  let save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  const kid = save.children[0];
  expect(kid.wallet.lifetime).toBe(0);
  expect(kid.progress.levels).toEqual({});
  expect(kid.placed).toBe(false);
  await page.click('.delete-kid');
  await page.getByRole('button', { name: 'Delete profile' }).click();
  await expect(page.locator('.toast').last()).toContainText('deleted');
  save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.children.find((c: { id: string }) => c.id === kid.id)).toBeUndefined();
});

test('confirm answers: pick, then Check; a right answer glows green', async ({ page }) => {
  // A tap-the-answer level (confirming only applies to choices).
  await seeded(page, 's3.compare3#1', `window.__app.save.update((d) => { d.settings.confirmAnswers = true; })`);
  await page.click('.play-next');
  const card = page.locator('.qcard[data-answer]');
  await expect(card).toBeVisible();
  const ans = (await card.getAttribute('data-answer'))!;
  const vals = await page.locator('.choice').evaluateAll((bs) => bs.map((b) => decodeURIComponent((b as HTMLElement).dataset.v!)));
  const wrong = vals.findIndex((v) => v !== ans);
  const right = vals.indexOf(ans);
  await expect(page.locator('.check-btn')).toBeDisabled();
  // A stray tap only picks; it can be changed before Check.
  await page.locator('.choice').nth(wrong).click();
  await expect(page.locator('.choice.picked')).toHaveCount(1);
  await expect(page.locator('.reveal')).toHaveCount(0);
  await page.locator('.choice').nth(right).click();
  await expect(page.locator('.choice').nth(right)).toHaveClass(/picked/);
  await page.click('.check-btn');
  await expect(page.locator('.choice').nth(right)).toHaveClass(/right/);
  await expect(page.locator('.flash-right')).toHaveCount(1);
  // Nothing covers the question: no answer box on a right answer.
  await expect(page.locator('.reveal')).toHaveCount(0);
});

/** Type a wrong answer on the pad (or tap a wrong choice). */
async function answerWrong(page: Page): Promise<string> {
  const card = page.locator('.qcard[data-answer]');
  await expect(card).toBeVisible();
  const ans = (await card.getAttribute('data-answer'))!;
  if (await page.locator('.choice').count()) {
    const vals = await page.locator('.choice').evaluateAll((bs) => bs.map((b) => decodeURIComponent((b as HTMLElement).dataset.v!)));
    await page.locator('.choice').nth(vals.findIndex((v) => v !== ans)).click();
    if (await page.locator('.check-btn').count()) await page.click('.check-btn');
  } else {
    const wrong = String(Number(ans) + 1);
    for (const ch of wrong) await page.locator(`.answers [data-k="${ch}"]`).first().dispatchEvent('pointerdown');
    await page.locator('.answers .ok').click();
  }
  return ans;
}

test('a wrong answer opens a step-by-step lesson, then the level goes on', async ({ page }) => {
  await page.goto(`/?debug&demo=${encodeURIComponent('s3.a22c#1')}&play`);
  const ans = await answerWrong(page);
  await expect(page.locator('.lesson')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.ls-ans')).toContainText(ans);
  await expect(page.locator('.ls-board')).toBeVisible();
  const steps = await page.locator('.ls-step').count();
  expect(steps).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < steps; i++) {
    await page.waitForTimeout(700);
    await page.click('.ls-next');
  }
  await expect(page.locator('.ls-step.end')).toBeVisible();
  await expect(page.locator('.ls-step.end')).toContainText(ans);
  await expect(page.locator('.ls-next')).toHaveText('Got it!');
  await page.waitForTimeout(700);
  await page.click('.ls-next');
  await expect(page.locator('.lesson')).toHaveCount(0);
  // The level carries on with the next question.
  await expect(page.locator('.dots i.miss')).toHaveCount(1);
  await expect(page.locator('.qcard[data-answer]')).toBeVisible();
});

test('practice together: a slip brings a twin question, and only first tries score', async ({ page }) => {
  await seeded(page, 's4.x7#1', `window.__app.save.update((d) => { d.settings.teach = false; d.children[0].together = 3; })`);
  await page.click('.play-next');
  await page.click('.sheet .btn.mint');
  const first = (await page.locator('.qcard .prompt').textContent()) ?? '';
  const ans = await answerWrong(page);
  // A new question of the same kind, with a different answer: no copying.
  await expect(page.locator('.again-note')).toBeVisible({ timeout: 8000 });
  const twin = (await page.locator('.qcard[data-answer]').getAttribute('data-answer'))!;
  expect(twin).not.toBe(ans);
  expect((await page.locator('.qcard .prompt').textContent()) ?? '').not.toBe(first);
  await expect(page.locator('.dots i.miss')).toHaveCount(1);
  await playThrough(page, '.result');
  await expect(page.locator('.res-score')).toHaveText(/^(\d+) \/ (\d+) right$/);
  const [, got, of] = /(\d+) \/ (\d+)/.exec((await page.locator('.res-score').textContent())!)!;
  expect(Number(got)).toBe(Number(of) - 1);
  await expect(page.locator('.res-perfect')).toHaveCount(0);
});

test('lessons can be switched off by a parent, and close with ×', async ({ page }) => {
  await seeded(page, 's4.x7#1', `window.__app.save.update((d) => { d.settings.teach = false; })`);
  await page.click('.play-next');
  await answerWrong(page);
  await page.waitForTimeout(2500);
  await expect(page.locator('.lesson')).toHaveCount(0);
  // On again: the lesson shows, and × closes it straight away.
  await page.evaluate(() => (window as unknown as { __app: { save: { update: (f: (d: { settings: { teach: boolean } }) => void) => void } } }).__app.save.update((d) => { d.settings.teach = true; }));
  await answerWrong(page);
  await expect(page.locator('.lesson')).toBeVisible({ timeout: 5000 });
  await page.click('.ls-close');
  await expect(page.locator('.lesson')).toHaveCount(0);
});

test('every skill shows its lesson without errors', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug&demo=%400');
  await expect(page.locator('.map')).toBeVisible();
  const ids = await page.evaluate(() => (window as unknown as { __app: { path: { kind: string; skillId?: string }[] } }).__app.path.filter((l) => l.kind === 'skill').map((l) => l.skillId!).filter((id, i, a) => a.indexOf(id) === i && /^s[1-7]\./.test(id)));
  expect(ids.length).toBeGreaterThan(300);
  for (const id of ids) {
    const n = await page.evaluate(async (sid) => {
      const w = window as unknown as { __lesson: (id: string, seed: string) => { done: Promise<void> } };
      w.__lesson(sid, `e2e:${sid}`);
      const steps = document.querySelectorAll('.lesson .ls-step').length;
      // Step through to the end, then close.
      for (let i = 1; i < steps; i++) {
        (document.querySelector('.lesson .ls-next') as HTMLButtonElement).click();
        await new Promise((r) => setTimeout(r, 0));
      }
      (document.querySelector('.lesson .ls-close') as HTMLButtonElement).click();
      return steps;
    }, id);
    expect(n, id).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(30);
  }
  expect(errors).toEqual([]);
});

test('opening video: no skip the first time, skippable after', async ({ page }) => {
  await page.goto('/?debug&fastreel');
  await expect(page.locator('.reel.first')).toBeVisible();
  // The first time there is no way round it: no Skip, and Back does nothing.
  await expect(page.locator('.rl-skip')).toHaveCount(0);
  // Next waits for the line to play; Back from the first stop does nothing.
  await expect(page.locator('.rl-next')).toBeDisabled();
  await page.evaluate(() => (window as unknown as { __app: { back(): void } }).__app.back());
  await expect(page.locator('.reel')).toBeVisible();
  await expect(page.locator('.rl-count')).toHaveText('1 of 11');
  await expect(page.locator('.rl-next')).toBeEnabled({ timeout: 5000 });
  await page.click('.rl-next');
  await expect(page.locator('.rl-count')).toHaveText('2 of 11');
  await page.click('.rl-prev');
  await expect(page.locator('.rl-count')).toHaveText('1 of 11');
  // A stop already heard can be passed straight away.
  await expect(page.locator('.rl-next')).toBeEnabled();
  await watchReel(page);
  await expect(page.locator('.rl-again')).toHaveCount(0);
  await page.click('.rl-go');
  await grownUp(page);
  await makePin(page);
  await expect(page.locator('.add-child')).toBeVisible();
  // Once seen it doesn't play on its own; the welcome screen offers setup and the video.
  await page.goto('/?debug&fastreel');
  await expect(page.locator('.welcome .start')).toBeVisible();
  await page.click('.tour-btn');
  await expect(page.locator('.reel')).toBeVisible();
  await expect(page.locator('.reel.first')).toHaveCount(0);
  await expect(page.locator('.rl-next')).toBeEnabled();
  await page.click('.rl-skip');
  await expect(page.locator('.welcome')).toBeVisible();
});

test('Plus says a word before a level, and cheers after a miss', async ({ page }) => {
  await page.goto('/?debug&demo=%4012&play');
  await expect(page.locator('.plus-says')).toBeVisible();
  await expect(page.locator('.plus-says .ps-text')).toContainText('Plus');
  await page.locator('.plus-says').click();
  await expect(page.locator('.plus-says')).toHaveCount(0);
  await expect(page.locator('.qcard')).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __app: { child: unknown; path: unknown[]; show(m: unknown): void }; __screens: { resultScreen(...a: unknown[]): unknown } };
    w.__app.show(w.__screens.resultScreen(w.__app.child, w.__app.path[12], { stars: 0, score: 5, total: 10, coins: 0, unlocked: [], timeUp: false }));
  });
  await expect(page.locator('.res-plus')).toBeVisible();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.children[0].lastPlay.score).toBe(5);
});

test('school path: pick a board and class, edit the skills, and the map follows it', async ({ page }) => {
  await page.goto('/?debug&demo=%4012&age=9');
  await expect(page.locator('.map')).toBeVisible();
  await page.evaluate(() => { const w = window as unknown as { __app: { show(m: unknown): void }; __screens: { parentScreen: unknown } }; w.__app.show(w.__screens.parentScreen); });
  await page.click('.kid-set');
  await page.click('.school-btn');
  await page.click('[data-b="cbse"]');
  await page.click('.school .done');
  // The usual class for age 9 is marked.
  await expect(page.locator('[data-g="4"] em')).toBeVisible();
  await expect(page.locator('.school .done')).toBeDisabled();
  await page.click('[data-g="4"]');
  await page.click('.school .done');
  const ticked = await page.locator('.sc-skill input:checked').count();
  expect(ticked).toBeGreaterThan(20);
  await page.locator('.sc-skill input:checked').first().uncheck();
  await page.click('.school .done');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.children[0].school).toMatchObject({ board: 'cbse', grade: '4', on: true });
  expect(save.children[0].school.skills.length).toBe(ticked - 1);
  await expect(page.locator('.school-btn')).toContainText('CBSE / NCERT · Class 4');
  // The map shows the school path only.
  await page.goto('/?debug&noloader');
  await page.locator('.kid').first().click();
  await expect(page.locator('.school-chip')).toContainText('Class 4');
  await expect(page.locator('.world.soon')).toHaveCount(0);
  // Back to the age path.
  await page.evaluate(() => { const w = window as unknown as { __app: { show(m: unknown): void }; __screens: { parentScreen: unknown } }; w.__app.show(w.__screens.parentScreen); });
  await page.click('.kid-set');
  await page.click('.school-btn');
  await page.click('[data-b=""]');
  await page.click('.school .done');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(after.children[0].school.on).toBe(false);
});

test('parents choose how long timed questions last', async ({ page }) => {
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  await page.evaluate(() => { const w = window as unknown as { __app: { show(m: unknown): void }; __screens: { parentScreen: unknown } }; w.__app.show(w.__screens.parentScreen); });
  await page.click('.pa-mode [data-mode="advanced"]');
  await expect(page.locator('.pt-val')).toHaveText('20 seconds');
  await page.locator('.pt-slider').fill('35');
  await page.locator('.pt-slider').dispatchEvent('change');
  await expect(page.locator('.pt-val')).toHaveText('35 seconds');
  await expect(page.locator('.pt-note')).toContainText('Easy');
  let save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.settings.timerSeconds).toBe(35);
  // The far end switches the timer off.
  await page.locator('.pt-slider').fill('65');
  await page.locator('.pt-slider').dispatchEvent('change');
  await expect(page.locator('.pt-val')).toHaveText('No timer');
  save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.settings.timerSeconds).toBe(0);
});

test('replaying an earlier level: continue here, or go back to my level', async ({ page }) => {
  await page.goto('/?debug&demo=%4024');
  await expect(page.locator('.map')).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __app: { child: unknown; path: unknown[]; show(m: unknown): void }; __screens: { resultScreen(...a: unknown[]): unknown } };
    w.__app.show(w.__screens.resultScreen(w.__app.child, w.__app.path[5], { stars: 3, score: 10, total: 10, coins: 0, unlocked: [], timeUp: false }));
  });
  await expect(page.locator('.res-actions .next')).toHaveText(/^Next/);
  await expect(page.locator('.res-actions .resume')).toHaveText('My level ↩');
  // The little ? says where each one goes.
  await page.locator('.tw-q').first().click();
  await expect(page.locator('.tw-tip')).toContainText('Next:');
  await page.locator('.tw-q').nth(1).click();
  await expect(page.locator('.tw-tip')).toContainText('Your level:');
  await page.click('.res-actions .resume');
  await expect(page.locator('.play, .fight').first()).toBeVisible({ timeout: 8000 });
  const id = await page.evaluate(() => (window as unknown as { __app: { path: { id: string }[] } }).__app.path[24].id);
  expect(id).toBeTruthy();
});

test('report: tabs with statistics, saved as a report card that restores on another phone', async ({ page, browser }) => {
  // Play one level so the play log has something in it.
  await page.goto('/?debug&demo=s3.compare3%231&play');
  await playThrough(page, '.result');
  await page.evaluate(() => { const w = window as unknown as { __app: { show(m: unknown): void }; __screens: { parentScreen: unknown } }; w.__app.show(w.__screens.parentScreen); });
  await page.locator('.report').first().click();
  await expect(page.locator('.rp-kpi')).toHaveCount(6);
  await page.click('[data-tab="skills"]');
  await expect(page.locator('.rp-stage').first()).toBeVisible();
  await page.click('[data-tab="activity"]');
  await expect(page.locator('.rp-recent li')).toHaveCount(1);
  await expect(page.locator('.rp-recent')).toContainText('Compare 3-digit numbers · Learn');
  await page.click('[data-tab="rewards"]');
  await expect(page.locator('.rp-jar').first()).toBeVisible();
  // Save the report card.
  await page.click('.rp-export');
  const file = await page.evaluate(() => (window as unknown as { __lastExport: { name: string; text: string } }).__lastExport);
  expect(file.name).toMatch(/^MN-.+-report-\d{4}-\d{2}-\d{2}\.html$/);
  expect(file.text).toContain('report card');
  expect(file.text).toContain('id="mn-backup"');
  const childId = await page.evaluate(() => (window as unknown as { __app: { child: { id: string } } }).__app.child.id);

  // Another phone with its own child: restore adds this one.
  const other = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  await other.goto('/?debug&demo=%4012');
  await expect(other.locator('.map')).toBeVisible();
  await other.evaluate(() => { const w = window as unknown as { __app: { show(m: unknown): void }; __screens: { parentScreen: unknown } }; w.__app.show(w.__screens.parentScreen); });
  const restore = async () => {
    const chooser = other.waitForEvent('filechooser');
    await other.click('.restore-kid');
    await (await chooser).setFiles({ name: file.name, mimeType: 'text/html', buffer: Buffer.from(file.text) });
  };
  await restore();
  await other.locator('.sheet .btn.mint').click();
  let save = await other.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  const restored = save.children.find((c: { id: string }) => c.id === childId);
  expect(restored).toBeTruthy();
  expect(restored.log.length).toBe(1);
  // Restoring the same child again combines instead of adding a copy.
  await restore();
  await expect(other.locator('.sheet h2')).toContainText('already on this phone');
  await other.locator('.sheet .btn.mint').click();
  save = await other.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.children.filter((c: { id: string }) => c.id === childId).length).toBe(1);
  expect(save.children.find((c: { id: string }) => c.id === childId).log.length).toBe(1);
  // An edited file is refused.
  file.text = file.text.replace('"lifetime":', '"lifetime":9');
  await restore();
  await expect(other.locator('.toast').last()).toContainText('changed since it was saved');
  await other.close();
});

test('map tips: shown once, then again from the ? button', async ({ page }) => {
  await page.goto('/?debug&demo=%4012&tips');
  await expect(page.locator('.tips-ov')).toBeVisible({ timeout: 5000 });
  for (let i = 0; i < 12 && (await page.locator('.tips-ov').count()); i++) {
    await page.click('.tip-next');
    await page.waitForTimeout(150);
  }
  await expect(page.locator('.tips-ov')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __app: { child: { toured?: boolean } } }).__app.child.toured)).toBe(true);
  await page.click('.help-btn');
  await expect(page.locator('.tips-ov')).toBeVisible();
  await page.click('.tip-skip');
  await expect(page.locator('.tips-ov')).toHaveCount(0);
});

test('locked copy: phone code shown, a wrong key is refused, a wrong code is just a wrong answer', async ({ page }) => {
  await page.goto('/?debug&noloader&lock');
  await expect(page.locator('.lock')).toBeVisible();
  await expect(page.locator('.lk-phone b')).toHaveText(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  await page.fill('.lk-key', 'SH-0123456789ABCDEFGH');
  await page.click('.lk-go');
  await expect(page.locator('.lk-msg')).toContainText('doesn’t work on this phone');
  await page.click('.lk-adult');
  for (const d of '1234567') await page.locator(`.gu-pad [data-k="${d}"]`).click();
  await page.locator('.grownup .ok').click();
  await expect(page.locator('.grownup')).toBeVisible();
  await expect(page.locator('.owner')).toHaveCount(0);
  await page.click('.grownup [data-back]');
  await expect(page.locator('.lock')).toBeVisible();
});

test('adventure: a parent turns it on, quests fill from play, the chest pays once, badges show', async ({ page }) => {
  type W = { __app: { child: { wallet: { lifetime: number }; log?: unknown[]; stats: { secondsByDay: Record<string, number> } }; today: string; save: { update(f: () => void): void }; show(m: unknown): void }; __screens: { parentScreen: unknown; mapScreen(c: unknown): unknown } };
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  await expect(page.locator('.adv-btn')).toHaveCount(0);
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.parentScreen); });
  await page.click('.kid-set');
  await expect(page.locator('.adv-toggle')).not.toBeChecked();
  await page.click('.adv-toggle');
  // The first time, the grown-up is shown what Adventure is (no skipping).
  await expect(page.locator('.tips-ov')).toBeVisible();
  await expect(page.locator('.tip-skip')).toHaveCount(0);
  await stepTips(page);
  await expect(page.locator('.adv-toggle')).toBeChecked();
  // A good afternoon of play today.
  await page.evaluate(() => {
    const w = window as unknown as W;
    const c = w.__app.child;
    w.__app.save.update(() => {
      c.log ??= [];
      for (let i = 0; i < 6; i++) c.log.push({ t: Date.now() - 60_000 + i, d: w.__app.today, id: `x${i}`, k: 'skill', st: 3, tier: 1, sc: 10, of: 10, s: 3, sec: 200, c: 10, a: { 's3.x2': [10, 10, 30000] } });
      c.stats.secondsByDay[w.__app.today] = 1500;
    });
    w.__app.show(w.__screens.mapScreen(c));
  });
  await expect(page.locator('.adv-btn.ready')).toBeVisible();
  await page.click('.adv-btn');
  await expect(page.locator('.adv-quests').first().locator('.aq.done')).toHaveCount(3);
  const before = await page.evaluate(() => (window as unknown as W).__app.child.wallet.lifetime);
  await page.click('.adv-chest.ready[data-kind="daily"]');
  // The chest is locked: hold the key until the ring fills.
  await expect(page.locator('.chest-cer')).toBeVisible();
  await holdKey(page);
  await expect(page.locator('.cc-loot')).toBeVisible();
  await expect(page.locator('.cc-gems')).toContainText('gems');
  await page.click('.cc-done');
  await expect(page.locator('.chest-cer')).toHaveCount(0);
  await expect(page.locator('.adv-chest.open[data-kind="daily"]')).toBeVisible({ timeout: 5000 });
  const after = await page.evaluate(() => (window as unknown as W).__app.child.wallet.lifetime);
  expect(after).toBeGreaterThan(before);
  await expect(page.locator('.adv-chest.ready[data-kind="daily"]')).toHaveCount(0);
  await page.click('.rp-tab[data-tab="badges"]');
  await expect(page.locator('.adv-count')).toContainText('badges');
  expect(await page.locator('.ab.on').count()).toBeGreaterThan(0);
  expect(await page.locator('.ab:not(.on)').count()).toBeGreaterThan(40);
  // Switched off again: the map is back to the plain version.
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.parentScreen); });
  await page.click('.kid-set');
  await page.click('.adv-toggle');
  await expect(page.locator('.adv-toggle')).not.toBeChecked();
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.mapScreen(w.__app.child)); });
  await expect(page.locator('.map')).toBeVisible();
  await expect(page.locator('.adv-btn')).toHaveCount(0);
});

test('adventure XP: past play counts, a new level is celebrated once, and a combo shows in levels', async ({ page }) => {
  type W = { __app: { child: { stats: { correct: number }; adventure?: { seenLevel?: number } }; path: unknown[]; save: { update(f: () => void): void }; show(m: unknown): void }; __screens: { parentScreen: unknown; mapScreen(c: unknown): unknown; resultScreen(...a: unknown[]): unknown } };
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.parentScreen); });
  await page.click('.kid-set');
  await page.click('.adv-toggle');
  await stepTips(page);
  // Switching on does not celebrate old levels.
  const seen = await page.evaluate(() => (window as unknown as W).__app.child.adventure!.seenLevel);
  expect(seen).toBeGreaterThanOrEqual(1);
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.mapScreen(w.__app.child)); });
  await expect(page.locator('.who-lv')).toContainText(`Level ${seen}`);
  // 150 more right answers = 1,500 XP: at least one new level after the next result.
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__app.save.update(() => (w.__app.child.stats.correct += 150));
    w.__app.show(w.__screens.resultScreen(w.__app.child, w.__app.path[1], { stars: 3, score: 10, total: 10, coins: 0, unlocked: [], timeUp: false }));
  });
  await expect(page.locator('.xp-gain')).toContainText('XP');
  await expect(page.locator('.lvlup')).toBeVisible({ timeout: 8000 });
  await page.click('.lu-ok');
  await expect(page.locator('.lvlup')).toHaveCount(0);
  const after = await page.evaluate(() => (window as unknown as W).__app.child.adventure!.seenLevel!);
  expect(after).toBeGreaterThan(seen!);
  // The same level is not celebrated twice.
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.resultScreen(w.__app.child, w.__app.path[1], { stars: 3, score: 10, total: 10, coins: 0, unlocked: [], timeUp: false })); });
  await page.waitForTimeout(3500);
  await expect(page.locator('.lvlup')).toHaveCount(0);
  // Three right in a row in a level: the combo meter.
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.mapScreen(w.__app.child)); });
  await page.click('.play-next');
  for (let k = 0; k < 3; k++) {
    const card = page.locator('.qcard[data-answer]');
    await expect(card).toBeVisible();
    await page.waitForFunction(() => document.querySelector('.choice:not([disabled]), .pad .key'));
    const ans = (await card.getAttribute('data-answer'))!;
    if (await page.locator('.choice').count()) {
      const vals = await page.locator('.choice').evaluateAll((bs) => bs.map((b) => decodeURIComponent((b as HTMLElement).dataset.v!)));
      await page.locator('.choice').nth(vals.indexOf(ans)).click();
      if (await page.locator('.check-btn').count()) await page.click('.check-btn');
    } else {
      for (const ch of ans.replace(/^-/, '−')) await page.locator(`.answers [data-k="${ch}"]`).first().dispatchEvent('pointerdown');
      await page.locator('.answers .ok').click();
    }
    if (k < 2) await page.waitForFunction(() => !document.querySelector('.qcard.right, .qcard .reveal'), null, { timeout: 8000 });
  }
  await expect(page.locator('.combo')).toContainText('3 in a row');
});

test('backup: grown-ups see it first, a child can only carry on, and saving a report card clears it', async ({ page }) => {
  type W = { __app: { child: { stats: { secondsByDay: Record<string, number> }; backupAt?: number }; save: { update(f: () => void): void; data: { settings: { backupSnoozeUntil?: number } } } } };
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  // Two days of play, never backed up.
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__app.save.update(() => {
      w.__app.child.stats.secondsByDay['2026-10-01'] = 600;
      w.__app.child.stats.secondsByDay['2026-10-02'] = 600;
    });
  });
  await page.goto('/?debug&noloader&backup');
  await expect(page.locator('.bkgate')).toBeVisible();
  await expect(page.locator('.bk-title')).toHaveText('Grown-ups first');
  // A child can only carry on.
  await page.click('.bk-kid-go');
  await expect(page.locator('.whos')).toBeVisible();
  // Next time the app opens, it is there again.
  await page.goto('/?debug&noloader&backup');
  await expect(page.locator('.bkgate')).toBeVisible();
  // Backing up needs the grown-up check, then saves the report card.
  await page.click('.bk-now');
  await expect(page.locator('.grownup')).toBeVisible();
  await grownUp(page);
  await expect(page.locator('.whos')).toBeVisible({ timeout: 8000 });
  const file = await page.evaluate(() => (window as unknown as { __lastExport: { name: string; text: string } }).__lastExport);
  expect(file.name).toMatch(/report/);
  expect(file.text).toContain('mn-backup');
  await page.goto('/?debug&noloader&backup');
  await expect(page.locator('.whos')).toBeVisible();
  await expect(page.locator('.bkgate')).toHaveCount(0);
});

test('backup: "remind me in 3 days" needs a grown-up, and the parent area shows the last backup', async ({ page }) => {
  type W = { __app: { child: { stats: { secondsByDay: Record<string, number> } }; save: { update(f: () => void): void; data: { settings: { backupSnoozeUntil?: number } } }; show(m: unknown): void }; __screens: { parentScreen: unknown } };
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__app.save.update(() => {
      w.__app.child.stats.secondsByDay['2026-10-01'] = 600;
      w.__app.child.stats.secondsByDay['2026-10-02'] = 600;
    });
  });
  await page.goto('/?debug&noloader&backup');
  await page.click('.bk-later');
  await grownUp(page);
  await expect(page.locator('.whos')).toBeVisible();
  const snooze = await page.evaluate(() => (window as unknown as W).__app.save.data.settings.backupSnoozeUntil ?? 0);
  expect(snooze).toBeGreaterThan(Date.now() + 2 * 86_400_000);
  await page.goto('/?debug&noloader&backup');
  await expect(page.locator('.bkgate')).toHaveCount(0);
  // Parent area: backups and reminders.
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.parentScreen); });
  await expect(page.locator('.pa-backup')).toContainText('Never backed up');
  await page.click('.bk-all');
  await expect(page.locator('.pa-backup')).toContainText('Last backup today');
  // Reminder settings are saved (Advanced → Notes).
  await page.click('.pa-mode [data-mode="advanced"]');
  await page.click('.pa-group[data-g="notes"]');
  await page.locator('[data-r="melt"]').uncheck();
  await expect(page.locator('.pr-per')).toBeHidden();
  const rs = await page.evaluate(() => (window as unknown as { __app: { save: { data: { settings: { reminders?: { melt: boolean } } } } } }).__app.save.data.settings.reminders);
  expect(rs?.melt).toBe(false);
});

test('wardrobe: gems from levels buy a hat for Plus, and he wears it on the map', async ({ page }) => {
  type W = { __app: { child: { stats: { correct: number }; adventure?: { equipped?: Record<string, string> } }; save: { update(f: () => void): void }; show(m: unknown): void }; __screens: { parentScreen: unknown; mapScreen(c: unknown): unknown; adventureScreen(c: unknown, t?: string): unknown } };
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.parentScreen); });
  await page.click('.kid-set');
  await page.click('.adv-toggle');
  await stepTips(page);
  // Lots of right answers: new levels, and gems with them.
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__app.save.update(() => (w.__app.child.stats.correct += 300));
    w.__app.show(w.__screens.adventureScreen(w.__app.child, 'wardrobe'));
  });
  await page.locator('.lu-ok').click({ timeout: 8000 }).catch(() => undefined);
  await expect(page.locator('.wd-gems')).toContainText('gems to spend');
  await page.click('.wd-item[data-id="party-hat"]');
  await expect(page.locator('.wd-item[data-id="party-hat"]')).toHaveClass(/\bon\b/);
  await expect(page.locator('.wd-plus .px-hat')).toHaveAttribute('data-item', 'party-hat');
  // Too dear for now: nothing is bought.
  await page.click('.wd-item[data-id="space-helmet"]');
  expect(await page.evaluate(() => (window as unknown as W).__app.child.adventure!.equipped!.hat)).toBe('party-hat');
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.mapScreen(w.__app.child)); });
  await expect(page.locator('.map-buddy .px-hat')).toHaveAttribute('data-item', 'party-hat');
  // Tap again to take it off.
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.adventureScreen(w.__app.child, 'wardrobe')); });
  await page.click('.wd-item[data-id="party-hat"]');
  await expect(page.locator('.wd-plus .px-hat')).toHaveCount(0);
});

test('weekly raid: right answers this week hit the monster, and beating it opens a raid chest once', async ({ page }) => {
  type C = { log?: unknown[]; age: number; adventure?: { claimed: Record<string, number>; gifted?: Record<string, number>; badges: Record<string, number> } };
  type W = { __app: { child: C; today: string; save: { update(f: () => void): void }; show(m: unknown): void }; __screens: { adventureScreen(c: unknown): unknown } };
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  const levels = async (n: number) =>
    page.evaluate((k) => {
      const w = window as unknown as W;
      const c = w.__app.child;
      w.__app.save.update(() => {
        c.adventure ??= { claimed: {}, badges: {}, cheered: {}, on: true } as never;
        (c.adventure as unknown as { toured: boolean }).toured = true;
        c.log ??= [];
        for (let i = 0; i < k; i++) c.log.push({ t: Date.now() - 1000 + i + c.log.length, d: w.__app.today, id: `r${c.log.length}`, k: 'skill', st: 3, tier: 1, sc: 8, of: 10, s: 1, sec: 100, c: 5, a: { 's3.x2': [10, 8, 30000] } });
      });
      w.__app.show(w.__screens.adventureScreen(c));
    }, n);
  await levels(2); // 16 hits
  await expect(page.locator('.adv-raid')).toContainText('HP left');
  await page.click('.adv-raid');
  await expect(page.locator('.raid .rd-hp')).toContainText(/\d+ \/ (150|250) HP/);
  const hp = Number((await page.locator('.rd-hp b').textContent())!);
  expect(hp).toBeGreaterThan(100);
  await expect(page.locator('.rd-chest')).toHaveCount(0);
  await levels(40); // plenty to beat it
  await page.click('.adv-raid');
  await page.click('.rd-chest');
  await expect(page.locator('.chest-cer.raid')).toBeVisible();
  await holdKey(page);
  await expect(page.locator('.cc-gems')).toContainText('gems');
  await expect(page.locator('.cc-gift')).toContainText('From');
  await page.click('.cc-done');
  await expect(page.locator('.rd-done')).toContainText('Beaten');
  const a = await page.evaluate(() => (window as unknown as W).__app.child.adventure!);
  expect(Object.keys(a.claimed).filter((k) => k.startsWith('r:')).length).toBe(1);
  expect(Object.keys(a.gifted ?? {}).length).toBe(1);
  expect(a.badges['raid-1']).toBeTruthy();
});

test('a quick tap on the chest key does not open it; holding does', async ({ page }) => {
  type W = { __app: { child: { log?: unknown[]; stats: { secondsByDay: Record<string, number> }; adventure?: unknown }; today: string; save: { update(f: () => void): void }; show(m: unknown): void }; __screens: { adventureScreen(c: unknown): unknown } };
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as W;
    const c = w.__app.child;
    w.__app.save.update(() => {
      c.adventure = { on: true, claimed: {}, badges: {}, cheered: {}, toured: true };
      c.log ??= [];
      for (let i = 0; i < 6; i++) c.log.push({ t: Date.now() - 1000 + i, d: w.__app.today, id: `x${i}`, k: 'skill', st: 3, tier: 1, sc: 10, of: 10, s: 3, sec: 200, c: 10, a: { 's3.x2': [10, 10, 30000] } });
      c.stats.secondsByDay[w.__app.today] = 1500;
    });
    w.__app.show(w.__screens.adventureScreen(c));
  });
  await page.locator('.lu-ok').click({ timeout: 4000 }).catch(() => undefined);
  await page.click('.adv-chest.ready[data-kind="daily"]');
  await holdKey(page, 200);
  await expect(page.locator('.cc-loot')).toBeHidden();
  await expect(page.locator('.cc-hint')).toContainText('Hold');
  await holdKey(page);
  await expect(page.locator('.cc-loot')).toBeVisible();
});

test('adventure tips: grown-ups first time without Skip, then with Skip; children only after 3 levels', async ({ page }) => {
  type W = { __app: { child: { log?: unknown[]; adventure?: { toured?: boolean } }; today: string; save: { update(f: () => void): void }; show(m: unknown): void }; __screens: { parentScreen: unknown; mapScreen(c: unknown): unknown } };
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.parentScreen); });
  // In Advanced → Help (it is also on each child's page).
  await page.click('.pa-mode [data-mode="advanced"]');
  await page.click('.pa-group[data-g="help"]');
  await page.click('.adv-what');
  await expect(page.locator('.tips-ov')).toBeVisible();
  await expect(page.locator('.tip-skip')).toHaveCount(0);
  await stepTips(page);
  await page.click('.adv-what');
  await expect(page.locator('.tip-skip')).toBeVisible();
  await page.click('.tip-skip');
  await expect(page.locator('.tips-ov')).toHaveCount(0);
  // A child with Adventure and 2 levels played: no Adventure tips yet.
  const map = async (levels: number) =>
    page.evaluate((n) => {
      const w = window as unknown as W;
      const c = w.__app.child;
      w.__app.save.update(() => {
        c.adventure = { on: true, claimed: {}, badges: {}, cheered: {} } as never;
        c.log = [];
        for (let i = 0; i < n; i++) c.log.push({ t: Date.now() - 1000 + i, d: '2026-10-01', id: `x${i}`, k: 'skill', st: 3, tier: 1, sc: 8, of: 10, s: 1, sec: 100, c: 5, a: { 's3.x2': [10, 8, 30000] } });
      });
      w.__app.show(w.__screens.mapScreen(c));
    }, levels);
  await map(2);
  await page.waitForTimeout(2000);
  await expect(page.locator('.tips-ov')).toHaveCount(0);
  await map(3);
  await expect(page.locator('.tips-ov[aria-label="Adventure tips"]')).toBeVisible({ timeout: 5000 });
  await stepTips(page);
  expect(await page.evaluate(() => (window as unknown as W).__app.child.adventure!.toured)).toBe(true);
});

test('add a child with Adventure on from the start', async ({ page }) => {
  type W = { __app: { save: { data: { children: { name: string; adventure?: { on: boolean } }[]; settings: { advTipsSeen?: boolean } } }; show(m: unknown): void }; __screens: { addChildScreen(f: boolean): unknown } };
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.addChildScreen(false)); });
  await page.fill('.name', 'Kabir');
  await page.click('.ac-next');
  await page.click('.ac-age[data-age="9"]');
  await page.click('.ac-next');
  await page.click('.ac-next');
  await expect(page.locator('.stops .stop-now')).toContainText('Adventure');
  await page.click('[data-adv="1"]');
  await expect(page.locator('.tips-ov')).toBeVisible();
  await stepTips(page);
  await page.click('.ac-next');
  await page.click('.ac-next');
  const kid = await page.evaluate(() => (window as unknown as W).__app.save.data.children.find((c) => c.name === 'Kabir'));
  expect(kid?.adventure?.on).toBe(true);
});

test('the sound logo plays at the big moments, and not with sound off', async ({ page }) => {
  type W = { __app: { child: unknown; path: unknown[]; sfx: { chimes: number; enabled: boolean }; show(m: unknown): void }; __screens: { resultScreen(...a: unknown[]): unknown; whosPlayingScreen: unknown } };
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  const chimes = () => page.evaluate(() => (window as unknown as W).__app.sfx.chimes);
  await page.evaluate(() => ((window as unknown as W).__app.sfx.enabled = true));
  const before = await chimes();
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.resultScreen(w.__app.child, w.__app.path[1], { stars: 3, score: 10, total: 10, coins: 0, unlocked: [], timeUp: false, perfect: true })); });
  await expect.poll(chimes).toBeGreaterThan(before);
  // Sound off: nothing.
  await page.waitForTimeout(2600);
  const n = await chimes();
  await page.evaluate(() => { const w = window as unknown as W; w.__app.sfx.enabled = false; w.__app.show(w.__screens.resultScreen(w.__app.child, w.__app.path[1], { stars: 3, score: 10, total: 10, coins: 0, unlocked: [], timeUp: false, perfect: true })); });
  await page.waitForTimeout(1500);
  expect(await chimes()).toBe(n);
});

test('dragon map: a grown-up switches it on, the levels lie along a dragon curve, and a finished chapter unfolds the next', async ({ page }) => {
  type C = { foldSeen?: number; dragonMap?: boolean; progress: { levels: Record<string, unknown> } };
  type W = { __app: { child: C; path: { id: string }[]; save: { update(f: () => void): void }; show(m: unknown): void }; __screens: { mapScreen(c: unknown): unknown; parentScreen: unknown } };
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Off by default: the usual map.
  await page.goto('/?debug&noloader&age=4&demo=%405');
  await expect(page.locator('.map .worlds')).toBeVisible();
  await expect(page.locator('.fold-stage')).toHaveCount(0);
  // A grown-up switches it on in the Parent area.
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.parentScreen); });
  await page.click('.kid-set');
  await expect(page.locator('.dragon-toggle')).not.toBeChecked();
  await page.click('.dragon-toggle');
  await expect(page.locator('.dragon-toggle')).toBeChecked();
  expect(await page.evaluate(() => (window as unknown as W).__app.child.dragonMap)).toBe(true);
  // The first visit unfolds the map from a single strip, then shows chapter 1.
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.mapScreen(w.__app.child)); });
  await expect(page.locator('.fold-stage canvas')).toBeVisible();
  await expect(page.locator('.map .worlds')).toHaveCount(0);
  await expect(page.locator('.fold-banner')).toContainText('Every line is one level');
  const seen = () => page.evaluate(() => (window as unknown as W).__app.child.foldSeen);
  await expect.poll(seen, { timeout: 15000 }).toBe(8);
  await expect(page.locator('.fold-cap')).toContainText('Chapter 1');
  // The current stop opens its 5 levels.
  await page.locator('.fold-anchor.current').click();
  await expect(page.locator('.skill-sheet .tier-row')).toHaveCount(5);
  await page.click('.skill-sheet [data-back]');
  await page.click('.fold-fit');
  await page.click('.fold-me');
  // 16 levels done: the map unfolds into chapter 3 (levels 17–32).
  await page.evaluate(() => {
    const a = (window as unknown as W).__app;
    a.save.update(() => { for (const l of a.path.slice(0, 16)) a.child.progress.levels[l.id] = { stars: 3, passes: 1 }; });
    a.show((window as unknown as W).__screens.mapScreen(a.child));
  });
  await expect(page.locator('.fold-banner')).toContainText('Chapter 3! The map unfolds.');
  await expect.poll(seen, { timeout: 15000 }).toBe(32);
  await expect(page.locator('.fold-cap')).toContainText('levels 17–32');
  // Off again: back to the usual map, same progress.
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.parentScreen); });
  await page.click('.kid-set');
  await page.click('.dragon-toggle');
  await expect(page.locator('.dragon-toggle')).not.toBeChecked();
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.mapScreen(w.__app.child)); });
  await expect(page.locator('.map .worlds')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Adventure pet: the egg hatches, the child picks and names a pet, feeds it, and it sits on the map', async ({ page }) => {
  type C = { stats: { correct: number }; log?: unknown[]; adventure?: { pet?: { name: string; species: string; treats?: Record<string, number> }; badges: Record<string, number> } };
  type W = { __app: { child: C; today: string; path: { id: string }[]; save: { update(f: () => void): void }; show(m: unknown): void }; __screens: { adventureScreen(c: unknown, t?: string): unknown; mapScreen(c: unknown): unknown } };
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug&noloader&demo=%4030');
  await expect(page.locator('.map')).toBeVisible();
  // Adventure on, the egg turned up a minute ago, and 2 levels played since.
  await page.evaluate(() => {
    const a = (window as unknown as W).__app;
    const c = a.child;
    a.save.update(() => {
      c.adventure = { on: true, claimed: {}, badges: {}, cheered: {}, toured: true, eggAt: Date.now() - 60000 } as never;
      c.stats.correct += 300;
      for (let i = 0; i < 2; i++) (c.log ??= []).push({ t: Date.now() - 1000 * (i + 1), d: a.today, id: a.path[i].id, k: 'skill', st: 1, tier: 1, sc: 10, of: 10, s: 3, sec: 60, c: 5, a: {} });
    });
    a.show((window as unknown as W).__screens.adventureScreen(c));
  });
  await page.click('.rp-tab[data-tab="pet"]');
  await expect(page.locator('.pet-eggcard h2')).toHaveText('A mystery egg!');
  await expect(page.locator('.pet-eggcard')).toContainText('Finish 1 more level');
  // One more level: it's ready.
  await page.evaluate(() => {
    const w = window as unknown as W;
    const a = w.__app;
    a.save.update(() => a.child.log!.push({ t: Date.now(), d: a.today, id: a.path[3].id, k: 'skill', st: 1, tier: 1, sc: 10, of: 10, s: 3, sec: 60, c: 5, a: {} }));
    a.show(w.__screens.adventureScreen(a.child, 'pet'));
  });
  await page.click('.pet-hatch');
  await expect(page.locator('.ph-pick')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.ph-opt')).toHaveCount(4);
  await page.click('.ph-opt[data-sp="owl"]');
  await expect(page.locator('.ph-ok')).toBeDisabled();
  await page.fill('.ph-input', 'Professor Hootington');
  await expect(page.locator('.ph-input')).toHaveValue('Professor Ho');
  await page.fill('.ph-input', 'Hoot');
  await page.click('.ph-ok');
  await expect(page.locator('.ph-name h2')).toHaveText('Say hi to Hoot!');
  await page.click('.ph-done');
  await expect(page.locator('.pet-hero h2')).toHaveText('Hoot');
  await expect(page.locator('.pet-kind')).toHaveText('Baby owl');
  const pet = () => page.evaluate(() => (window as unknown as W).__app.child.adventure!.pet!);
  expect((await pet()).species).toBe('owl');
  expect(await page.evaluate(() => !!(window as unknown as W).__app.child.adventure!.badges['pet-parent'])).toBe(true);
  // A snack: gems go, hearts come.
  const gems = Number((await page.locator('.pet-gems').textContent())!.replace(/\D/g, ''));
  await page.click('.pet-snack[data-snack="cookie"]');
  await expect(page.locator('.pet-hearts')).toContainText('2', { timeout: 6000 });
  await expect(page.locator('.pet-gems')).toContainText(String(gems - 10));
  expect(Object.keys((await pet()).treats ?? {}).length).toBe(1);
  // On the map, beside the child.
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.mapScreen(w.__app.child)); });
  await expect(page.locator('.map .who .who-pet svg.pet-owl')).toBeVisible();
  expect(errors).toEqual([]);
});

test('parent area: Basic has the everyday settings, Advanced has the rest in groups, each child has a page', async ({ page }) => {
  type W = { __app: { child: { challenge?: number }; show(m: unknown): void }; __screens: { parentScreen: unknown } };
  await page.goto('/?debug&demo=%4012');
  await expect(page.locator('.map')).toBeVisible();
  await page.evaluate(() => { const w = window as unknown as W; w.__app.show(w.__screens.parentScreen); });
  // Basic: children, daily play, sound, look, backup; nothing advanced.
  await expect(page.locator('.pa-mode [data-mode="basic"]')).toHaveAttribute('aria-selected', 'true');
  for (const sel of ['.pa-kid', '.limits', '[data-k="holiday"]', '[data-k="sound"]', '[data-k="voice"]', '.theme-tile', '.bk-all', '.to-adv']) await expect(page.locator(sel).first()).toBeAttached();
  for (const sel of ['.pt-slider', '[data-r="melt"]', '.lock-row', '[data-k="showFps"]', '.adv-toggle']) await expect(page.locator(sel)).toHaveCount(0);
  // Advanced: six groups, one at a time.
  await page.click('.to-adv');
  await expect(page.locator('.pa-group')).toHaveCount(6);
  await expect(page.locator('.pt-slider')).toBeVisible();
  await page.click('.pa-group[data-g="device"]');
  await expect(page.locator('[data-k="showFps"]')).toBeAttached();
  await expect(page.locator('.pt-slider')).toHaveCount(0);
  await page.click('.pa-group[data-g="security"]');
  await expect(page.locator('.lock-row')).toBeVisible();
  // A child's own page: difficulty is changed there.
  await page.click('.pa-mode [data-mode="basic"]');
  await page.click('.kid-set');
  await expect(page.locator('.kid-settings .adv-toggle')).toBeAttached();
  await page.click('.level-btn');
  await page.locator('.sheet button', { hasText: 'Harder' }).click();
  await expect(page.locator('.level-btn')).toContainText('Harder');
  expect(await page.evaluate(() => (window as unknown as W).__app.child.challenge)).toBe(1);
  await page.click('.back-btn');
  await expect(page.locator('.pa-kid')).toContainText('Harder');
});
