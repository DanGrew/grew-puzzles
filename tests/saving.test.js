const { test, expect } = require('@playwright/test');

// The Saving your progress page, in the owner's words (the product's docs/CONTENT.md, Saving your
// progress), reached from the side bar on every page, after How to play.
const WORDS = [
  'Sign in with Google and we\'ll save your progress as you play: every word, the moment you find it! Close the page, come back tomorrow, and pick up right where you left off.',
  'Play anywhere. Start a puzzle on your phone and finish it on your laptop! Sign in with the same Google account and your finds will be waiting. Playing on two at once? Just reopen the puzzle on the other one to catch up.',
  'Lost your connection? Don\'t worry, we\'ll keep trying until your finds are saved. A little note under the words lets you know until they are, so keep the puzzle open.',
  'Ticks and Continue playing. Finished a puzzle? It gets a ✓ on its tile. Wandered off halfway? It\'ll be waiting for you under Continue playing at the top of the page.',
  'Not signed in? That\'s fine too. Every puzzle plays just the same, we just can\'t remember where you got to. Sign in partway through and the words you\'ve found in that puzzle are saved.',
  'Mazes too. Every time you stop, we save where you are and everything you\'ve picked up. Come back later and your trail will be waiting, right up to where you left off.',
];

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
  await context.route('https://vxschtygvtilsadgixec.supabase.co/**', route => route.abort());
});

for (const address of ['/app/', '/app/play.html?id=WSCH-0001', '/app/collection.html?slug=issue-1-remake', '/app/book.html?slug=issue-1-remake', '/app/about.html', '/app/privacy.html', '/app/how-to-play.html', '/app/saving.html', '/app/feedback.html']) {
  test(`on ${address}, the side bar holds Saving your progress after How to play, which opens its page`, async ({ page, baseURL }) => {
    await page.goto(address);
    const pages = await page.locator('#site-side .page').allTextContents();
    expect(pages.slice(-5)).toEqual(['How to play', 'Saving your progress', 'About us', 'Feedback', 'Privacy']);
    await page.locator('#site-side .page', { hasText: 'Saving your progress' }).click();
    await expect(page).toHaveURL(`${baseURL}/app/saving.html`);
    await expect(page.locator('h1')).toHaveText('Saving your progress');
  });
}

test('the Saving your progress page is worded exactly as the owner wrote it, each point led in bold', async ({ page }) => {
  await page.goto('/app/saving.html');
  await expect(page).toHaveTitle('Saving your progress · Grew Puzzles');
  await expect(page.locator('main h1')).toHaveText('Saving your progress');
  await expect(page.locator('main h2')).toHaveCount(0);
  await expect(page.locator('main p')).toHaveText(WORDS);
  await expect(page.locator('main p strong')).toHaveText(['Play anywhere.', 'Lost your connection?', 'Ticks and Continue playing.', 'Not signed in?', 'Mazes too.']);
  await expect(page.locator('main a')).toHaveCount(0);
  await expect(page.locator('main img')).toHaveCount(0);
});

test('on the Saving your progress page, Saving your progress is the side bar\'s current entry', async ({ page }) => {
  await page.goto('/app/saving.html');
  await expect(page.locator('#site-side [aria-current="page"]')).toHaveText(['Saving your progress']);
});

test('How to play keeps to the puzzle types, with nothing about saving', async ({ page }) => {
  await page.goto('/app/how-to-play.html');
  await expect(page.locator('main')).not.toContainText('Saving your progress');
});

for (const [device, width, height] of [['a phone', 375, 700], ['a desktop', 1280, 800]]) {
  test(`on ${device}, the Saving your progress page wears the site bar, and its words sit on the card with a character, Themed`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/app/saving.html');
    await expect(page.locator('.site .brand')).toHaveText('Grew Puzzles');
    await expect(page.locator('.page-card p')).toHaveCount(WORDS.length);
    await expect(page.locator('#name-tag')).not.toBeEmpty();
    await expect(page.locator('#theme-figure')).toBeVisible();
  });
}

test('Plain, the Saving your progress page shows no character', async ({ page }) => {
  await page.goto('/app/saving.html');
  await page.locator('#site-side .look button[data-look="plain"]').click();
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  await expect(page.locator('main p')).toHaveCount(WORDS.length);
});

test('on the narrowest phone the Saving your progress page reads without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/app/saving.html');
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
