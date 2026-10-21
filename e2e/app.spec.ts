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
    // The right answer is shown after every question; wait for the next one.
    await page.waitForTimeout(150);
    await page.waitForFunction(() => !document.querySelector('.qcard .reveal'), null, { timeout: 8000 }).catch(() => undefined);
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

test('confirm answers: pick, then Check; the answer is always shown', async ({ page }) => {
  await seeded(page, '@2', `window.__app.save.update((d) => { d.settings.confirmAnswers = true; })`);
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
  await expect(page.locator('.reveal.good')).toContainText(ans);
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
  await expect(page.locator('[data-ts="1.5"]')).toHaveClass(/\bon\b/);
  await page.click('[data-ts="0"]');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('studyhard.save')!));
  expect(save.settings.timerScale).toBe(0);
});

test('replaying an earlier level: continue here, or go back to my level', async ({ page }) => {
  await page.goto('/?debug&demo=%4024');
  await expect(page.locator('.map')).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __app: { child: unknown; path: unknown[]; show(m: unknown): void }; __screens: { resultScreen(...a: unknown[]): unknown } };
    w.__app.show(w.__screens.resultScreen(w.__app.child, w.__app.path[5], { stars: 3, score: 10, total: 10, coins: 0, unlocked: [], timeUp: false }));
  });
  await expect(page.locator('.res-actions .next small')).toContainText('Up next');
  await expect(page.locator('.res-actions .resume small')).toContainText('Where you left off');
  await page.click('.res-actions .resume');
  await expect(page.locator('.play, .fight').first()).toBeVisible({ timeout: 8000 });
  const id = await page.evaluate(() => (window as unknown as { __app: { path: { id: string }[] } }).__app.path[24].id);
  expect(id).toBeTruthy();
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
