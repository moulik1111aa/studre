// Review fix 8: reward photos are deleted once no reward uses them, and "Delete account and
// data" deletes every photo. (In a browser photos live in IndexedDB; on a phone in files/photos,
// with the same rules: see storage/photos.ts and LocalData.java.)
import { test, expect, type Page } from 'playwright/test';

type W = {
  __app: { show(m: unknown): void; save: { data: { children: { wallet: { treat: { rewardId: string | null; photo?: string; waiting?: boolean } } }[] }; save(): void } };
  __screens: { parentScreen: unknown; rewardsScreen(c: unknown, jar: string): unknown };
};

/** A 1×1 PNG, enough for the photo picker. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const image = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG });

/** The photo ids stored in this browser. */
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((res) => {
        const req = indexedDB.open('studyhard-photos', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('photos');
        req.onsuccess = () => {
          const r = req.result.transaction('photos').objectStore('photos').getAllKeys();
          r.onsuccess = () => res((r.result as IDBValidKey[]).map(String).sort());
        };
      }),
  );

/** Store photos directly (as an older version would have left them). */
const put = (page: Page, ids: string[]) =>
  page.evaluate(
    (ids) =>
      new Promise<void>((res) => {
        const req = indexedDB.open('studyhard-photos', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('photos');
        req.onsuccess = () => {
          const tx = req.result.transaction('photos', 'readwrite');
          for (const id of ids) tx.objectStore('photos').put('data:image/png;base64,AA', id);
          tx.oncomplete = () => res();
        };
      }),
    ids,
  );

async function start(page: Page) {
  await page.goto('/?debug&demo=s4.x7%231');
  await expect(page.locator('.map')).toBeVisible();
}

test('a retaken photo replaces the old one, and a photo not used is deleted', async ({ page }) => {
  await start(page);
  // Empty the treat jar so a treat can be picked again.
  await page.evaluate(() => {
    const w = window as unknown as W;
    const c = w.__app.save.data.children[0];
    c.wallet.treat.rewardId = null;
    c.wallet.treat.waiting = false;
    w.__app.save.save();
    w.__app.show(w.__screens.rewardsScreen(c, 'treat'));
  });
  const pickOne = async () => {
    // (A group stays open after "Look at others".)
    if (!(await page.locator('.rw-card[data-r]').count())) await page.locator('.rw-cat-head').first().click();
    await page.locator('.rw-card[data-r]').first().click();
    await expect(page.locator('.rw-confirm')).toBeVisible();
  };
  await pickOne();
  await page.locator('.rw-confirm .file').setInputFiles(image('one.png'));
  await expect(page.locator('.rw-confirm .agreed')).toBeVisible();
  expect(await stored(page)).toHaveLength(1);
  const first = (await stored(page))[0];
  // Retake: the new photo replaces the first.
  await page.waitForTimeout(20);
  await page.locator('.rw-confirm .file').setInputFiles(image('two.png'));
  await expect.poll(() => stored(page)).toHaveLength(1);
  expect((await stored(page))[0]).not.toBe(first);
  // "Look at others": the photo wasn't used, so it goes.
  await page.click('.rw-confirm [data-back]');
  await expect.poll(() => stored(page)).toEqual([]);
  // Chosen with a photo: it stays, also after a restart.
  await pickOne();
  await page.locator('.rw-confirm .file').setInputFiles(image('three.png'));
  await expect(page.locator('.rw-confirm .agreed')).toBeVisible();
  const kept = await stored(page);
  await page.click('.rw-confirm .pick');
  await page.goto('/?debug&noloader');
  await expect(page.locator('.screen').first()).toBeVisible();
  await page.waitForTimeout(500);
  expect(await stored(page)).toEqual(kept);
});

test('on start, photos no reward uses are deleted (and the ones in use are kept)', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__app.save.data.children[0].wallet.treat.photo = 'pkeep';
    w.__app.save.save();
  });
  await put(page, ['pkeep', 'pold1', 'pold2']);
  await page.goto('/?debug&noloader');
  await expect.poll(() => stored(page)).toEqual(['pkeep']);
});

test('"Delete account and data" deletes every photo', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__app.save.data.children[0].wallet.treat.photo = 'pkeep';
    w.__app.save.save();
  });
  await put(page, ['pkeep', 'pother']);
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__app.show(w.__screens.parentScreen);
  });
  await page.click('.pa-tab[data-id="app"]');
  await expect(page.locator('.erase-row small')).toContainText('reward photos');
  await page.click('.erase-row');
  await expect(page.locator('.er-list')).toContainText('reward photos');
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.locator('.toast')).toContainText('Everything is deleted');
  expect(await stored(page)).toEqual([]);
});
