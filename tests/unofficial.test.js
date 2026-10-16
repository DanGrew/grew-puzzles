const { test, expect } = require('@playwright/test');

// The Unofficial page, in the owner's words (the product's docs/CONTENT.md, Unofficial), reached
// from the side bar on every page: the words, then every fan subject by name, kept by hand in the
// page, A to Z, each once (the product's docs/RIGHTS.md).
const WORDS = 'Everything on the website is made by us and is not official. This includes, but is not exhaustive:';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
  await context.route('https://vxschtygvtilsadgixec.supabase.co/**', route => route.abort());
});

for (const address of ['/app/', '/app/play.html?id=WSCH-0001', '/app/collection.html?slug=issue-1-remake', '/app/book.html?slug=issue-1-remake', '/app/about.html', '/app/privacy.html', '/app/how-to-play.html', '/app/saving.html', '/app/feedback.html', '/app/unofficial.html']) {
  test(`on ${address}, the side bar holds Unofficial after About us, which opens the Unofficial page`, async ({ page, baseURL }) => {
    await page.goto(address);
    const pages = page.locator('#site-side .page');
    await expect(pages).toHaveText(['Saving your progress', 'About us', 'Unofficial', 'Feedback', 'Privacy']);
    await pages.filter({ hasText: 'Unofficial' }).click();
    await expect(page).toHaveURL(`${baseURL}/app/unofficial.html`);
    await expect(page.locator('h1')).toHaveText('Unofficial');
  });
}

test('the Unofficial page opens with the owner\'s words, exactly, and the list of fan subjects under them', async ({ page }) => {
  await page.goto('/app/unofficial.html');
  await expect(page).toHaveTitle('Unofficial · Grew Puzzles');
  await expect(page.locator('main p')).toHaveText([WORDS]);
  await expect(page.locator('main p + ul.fan-subjects')).toHaveCount(1);
  await expect(page.locator('main ul')).toHaveCount(1);
});

test('the fan subjects are plain lines, A to Z, each once', async ({ page }) => {
  await page.goto('/app/unofficial.html');
  const names = await page.locator('.fan-subjects li').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  const trimmed = names.map(name => name.trim());
  expect(trimmed.every(name => name.length > 0)).toBe(true);
  expect(trimmed).toEqual([...new Set(trimmed)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
  await expect(page.locator('.fan-subjects a')).toHaveCount(0);
});

test('on the Unofficial page, Unofficial is the side bar\'s current entry', async ({ page }) => {
  await page.goto('/app/unofficial.html');
  await expect(page.locator('#site-side [aria-current="page"]')).toHaveText(['Unofficial']);
});

test('the Unofficial page wears the site bar, and its words sit on the card with a character, Themed', async ({ page }) => {
  await page.goto('/app/unofficial.html');
  await expect(page.locator('.site .brand')).toHaveText('Grew Puzzles');
  await expect(page.locator('.page-card p')).toHaveCount(1);
  await expect(page.locator('.page-card .fan-subjects')).toHaveCount(1);
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await expect(page.locator('#theme-figure')).toBeVisible();
});

test('Plain, the Unofficial page shows no character', async ({ page }) => {
  await page.goto('/app/unofficial.html');
  await page.locator('#site-side .look select').selectOption('plain');
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  await expect(page.locator('main p')).toHaveText([WORDS]);
});

test('on the narrowest phone the Unofficial page reads without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/app/unofficial.html');
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
