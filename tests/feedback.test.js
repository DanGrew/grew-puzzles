const { test, expect } = require('@playwright/test');

// The Feedback page, in the owner's words (the product's docs/CONTENT.md, Feedback), reached from
// the side bar on every page. The site has nothing to send through, so feedback goes by email.
const EMAIL = 'grew.puzzles@gmail.com';
const WORDS = [
  ['We\'d love to hear from you', 'Tell us what you think! Something you loved, something that didn\'t work, or an idea to make the puzzles better. We read every message.'],
  ['Ideas and requests', 'Is there a theme, a word list or a kind of puzzle you\'d like to see? Ask away, and we\'ll do our best to make it.'],
  ['Spotted a mistake?', 'If a puzzle doesn\'t look right, tell us which one (its name is at the top of its page) and we\'ll put it right.'],
  ['Get in touch', `Email us at ${EMAIL}. We're a little family, so it might take us a few days to reply, but we will.`],
];

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
  await context.route('https://vxschtygvtilsadgixec.supabase.co/**', route => route.abort());
});

for (const address of ['/app/', '/app/play.html?id=WSCH-0001', '/app/collection.html?slug=issue-1-remake', '/app/book.html?slug=issue-1-remake', '/app/about.html', '/app/privacy.html', '/app/how-to-play.html', '/app/saving.html', '/app/feedback.html']) {
  test(`on ${address}, the side bar holds Feedback after About us, which opens the Feedback page`, async ({ page, baseURL }) => {
    await page.goto(address);
    const pages = page.locator('#site-side .page');
    await expect(pages).toHaveText(['How to play', 'Saving your progress', 'About us', 'Feedback', 'Privacy']);
    await pages.filter({ hasText: 'Feedback' }).click();
    await expect(page).toHaveURL(`${baseURL}/app/feedback.html`);
    await expect(page.locator('h1')).toHaveText('We\'d love to hear from you');
  });
}

test('the Feedback page is worded exactly as the owner wrote it, a heading to each part, in order', async ({ page }) => {
  await page.goto('/app/feedback.html');
  await expect(page).toHaveTitle('Feedback · Grew Puzzles');
  await expect(page.locator('main h1, main h2')).toHaveText(WORDS.map(([heading]) => heading));
  await expect(page.locator('main p')).toHaveText(WORDS.map(([, words]) => words));
});

test('the puzzles\' email is a link that starts an email to it, titled Grew Puzzles feedback', async ({ page }) => {
  await page.goto('/app/feedback.html');
  const link = page.locator('main a');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveText(EMAIL);
  const href = new URL(await link.getAttribute('href'));
  expect(href.protocol).toBe('mailto:');
  expect(href.pathname).toBe(EMAIL);
  expect(href.searchParams.get('subject')).toBe('Grew Puzzles feedback');
});

test('on the Feedback page, Feedback is the side bar\'s current entry', async ({ page }) => {
  await page.goto('/app/feedback.html');
  await expect(page.locator('#site-side [aria-current="page"]')).toHaveText(['Feedback']);
});

test('the Feedback page wears the site bar, and its words sit on the card with a character, Themed', async ({ page }) => {
  await page.goto('/app/feedback.html');
  await expect(page.locator('.site .brand')).toHaveText('Grew Puzzles');
  await expect(page.locator('.page-card p')).toHaveCount(WORDS.length);
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await expect(page.locator('#theme-figure')).toBeVisible();
});

test('Plain, the Feedback page shows no character', async ({ page }) => {
  await page.goto('/app/feedback.html');
  await page.locator('#site-side .look button[data-look="plain"]').click();
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  await expect(page.locator('main p')).toHaveCount(WORDS.length);
});

test('on the narrowest phone the Feedback page reads without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/app/feedback.html');
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
