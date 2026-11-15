// Review fix 10: Android 16 ignores the portrait lock on screens 600dp and wider, so every
// screen must be usable on a tablet held sideways: nothing wider than the screen, every
// button on the glass, the content in a centred column.
import { test, expect, type Page } from 'playwright/test';

type W = { __app: { show(m: unknown): void; child: unknown; screen?: { el: HTMLElement } }; __screens: Record<string, (...a: unknown[]) => unknown> };

/** Show a screen by name from the test hooks, with arguments made inside the page (no
 * arguments: the name is itself the screen maker). */
async function show(page: Page, name: string, args: string) {
  await page.evaluate(
    ([name, args]) => {
      const w = window as unknown as W;
      const child = w.__app.child;
      // eslint-disable-next-line no-new-func
      const a = new Function('child', `return [${args}]`)(child) as unknown[];
      const s = w.__screens[name];
      w.__app.show(a.length ? s(...a) : s);
    },
    [name, args],
  );
  await page.waitForTimeout(700);
}

/** Nothing sideways-scrolls, every visible button is on the glass, and something can be tapped. */
async function usable(page: Page, what: string) {
  await page.waitForFunction(() => !!(window as unknown as W).__app.screen?.el, undefined, { timeout: 5000 });
  const r = await page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const screen = (window as unknown as W).__app.screen!.el;
    const buttons = [...screen.querySelectorAll<HTMLElement>('button, [role="button"], a.btn')].filter((b) => {
      const s = getComputedStyle(b);
      const r = b.getBoundingClientRect();
      return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0 && !b.closest('[aria-hidden="true"]');
    });
    const off = buttons
      .map((b) => ({ b, r: b.getBoundingClientRect() }))
      // Rows that scroll sideways on purpose (tabs, carousels) may hold buttons past the edge.
      .filter(({ b, r }) => (r.left < -1 || r.right > vw + 1) && !b.closest('.pa-tabs, .hscroll, [data-scroll-x], .carousel'))
      .map(({ b }) => (b.textContent || b.getAttribute('aria-label') || b.className).trim().slice(0, 40));
    const onGlass = buttons.filter((b) => {
      const r = b.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw;
    }).length;
    return { wide: document.documentElement.scrollWidth - vw, screenWide: screen.scrollWidth - screen.clientWidth, off, onGlass, cls: screen.className };
  });
  expect(r.wide, `${what}: the page is wider than the screen`).toBeLessThanOrEqual(1);
  expect(r.screenWide, `${what} (${r.cls}): the screen scrolls sideways`).toBeLessThanOrEqual(1);
  expect(r.off, `${what}: buttons off the screen`).toEqual([]);
  expect(r.onGlass, `${what}: no button on the screen`).toBeGreaterThan(0);
}

for (const size of [
  { name: 'tablet sideways', width: 1280, height: 800 },
  { name: 'unfolded foldable sideways', width: 884, height: 674 },
]) {
  test(`every main screen is usable on a ${size.name} (${size.width}×${size.height})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/?debug&demo=%4012&noloader');
    await expect(page.locator('.map')).toBeVisible();
    await usable(page, 'map');
    const screens: [string, string][] = [
      ['whosPlayingScreen', ''],
      ['welcomeScreen', ''],
      ['rewardsScreen', "child, 'treat'"],
      ['reportScreen', 'child'],
      ['adventureScreen', 'child'],
      ['trophyScreen', 'child'],
      ['faceoffSetupScreen', 'undefined'],
      ['addChildScreen', 'false'],
      ['limitsScreen', 'false'],
    ];
    for (const [name, args] of screens) {
      await show(page, name, args);
      await usable(page, name);
    }
    // The Parent area, every tab.
    await show(page, 'parentScreen', '');
    const tabs = await page.locator('.pa-tab[data-id]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id!));
    expect(tabs.length).toBeGreaterThan(2);
    for (const id of tabs) {
      await page.click(`.pa-tab[data-id="${id}"]`);
      await page.waitForTimeout(300);
      await usable(page, `Parent area, ${id}`);
    }
    // A question.
    await show(page, 'mapScreen', 'child');
    await page.click('.play-next');
    await expect(page.locator('.qcard')).toBeVisible();
    await usable(page, 'question');
  });
}
