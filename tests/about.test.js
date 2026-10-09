const { test, expect } = require('@playwright/test');

// The About us page, in the owner's words (the product's docs/CONTENT.md, About us), reached from
// the side bar on every page.
const WORDS = [
  ['Thank you!', 'Thank you for playing our puzzles! We hope they bring a little joy and fun to your day.'],
  ['About us', 'We\'re a little family working on being creative together. We take inspiration from our home and our family, and our love of dinosaurs and animals – our four-year-old can\'t get enough of them!'],
  ['About these puzzles', 'We\'ve used some modern tools to help us create these puzzles. It hasn\'t been easy, but it\'s been fun, and it\'s taken time and care. We pick every puzzle ourselves. Please forgive us if you spot any mistakes (fingers crossed, no major ones!).'],
];

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
  await context.route('https://vxschtygvtilsadgixec.supabase.co/**', route => route.abort());
});

for (const address of ['/app/', '/app/play.html?id=WSCH-0001', '/app/collection.html?slug=issue-1-remake', '/app/book.html?slug=issue-1-remake', '/app/about.html', '/app/privacy.html', '/app/how-to-play.html', '/app/saving.html']) {
  test(`on ${address}, the side bar holds About us, which opens the About us page`, async ({ page, baseURL }) => {
    await page.goto(address);
    const about = page.locator('#site-side .page', { hasText: 'About us' });
    await expect(about).toHaveCount(1);
    await about.click();
    await expect(page).toHaveURL(`${baseURL}/app/about.html`);
    await expect(page.locator('h1')).toHaveText('Thank you!');
  });
}

test('the About us page is worded exactly as the owner wrote it, a heading to each part, in order', async ({ page }) => {
  await page.goto('/app/about.html');
  await expect(page).toHaveTitle('About us · Grew Puzzles');
  await expect(page.locator('main h1, main h2')).toHaveText(WORDS.map(([heading]) => heading));
  await expect(page.locator('main p')).toHaveText(WORDS.map(([, words]) => words));
  await expect(page.locator('main a')).toHaveCount(0);
});

test('on the About us page, About us is the side bar\'s current entry', async ({ page }) => {
  await page.goto('/app/about.html');
  await expect(page.locator('#site-side [aria-current="page"]')).toHaveText(['About us']);
});

test('the About us page wears the site bar, and its words sit on the card with a character, Themed', async ({ page }) => {
  await page.goto('/app/about.html');
  await expect(page.locator('.site .brand')).toHaveText('Grew Puzzles');
  await expect(page.locator('.page-card p')).toHaveCount(WORDS.length);
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await expect(page.locator('#theme-figure')).toBeVisible();
});

test('Plain, the About us page shows no character', async ({ page }) => {
  await page.goto('/app/about.html');
  await page.locator('#site-side .look button[data-look="plain"]').click();
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  await expect(page.locator('main p')).toHaveCount(WORDS.length);
});

test('on the narrowest phone the About us page reads without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/app/about.html');
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
