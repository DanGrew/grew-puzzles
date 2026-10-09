const { test, expect } = require('@playwright/test');

// The Privacy page, in the owner's words (the product's docs/CONTENT.md, Privacy), reached from the
// side bar on every page. The puzzles' own email stands in for *[puzzles email]*.
const EMAIL = 'grew.studio.media@gmail.com';
const WORDS = [
  ['Your privacy', 'You don\'t need an account to play — every puzzle is free and open to everyone. If you\'d like your progress saved, you can sign in with Google.'],
  ['No tricks', `There are no tricks and no money-making here. We literally just use your email to save your progress, with Supabase, the service we use for our database. If you have any questions or concerns, please reach out at ${EMAIL}.`],
  ['What we keep', 'Only your email address, the words you\'ve found in each puzzle and what you\'ve found in each maze, with when you found them, and where you are in each maze. We use them for one thing: saving your progress so you can pick up where you left off, on any device.'],
  ['Who else sees it', 'Nobody. Sign-in is handled by Google, and your progress is stored with Supabase. We don\'t sell anything, show ads, or track you.'],
  ['Deleting it', 'Tap your picture, then Delete my account. Everything we keep about you is removed for good.'],
];

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
  await context.route('https://vxschtygvtilsadgixec.supabase.co/**', route => route.abort());
});

for (const address of ['/app/', '/app/play.html?id=WSCH-0001', '/app/collection.html?slug=issue-1-remake', '/app/book.html?slug=issue-1-remake', '/app/about.html', '/app/privacy.html', '/app/how-to-play.html', '/app/saving.html']) {
  test(`on ${address}, Privacy is the side bar's last page, which opens the Privacy page`, async ({ page, baseURL }) => {
    await page.goto(address);
    const last = page.locator('#site-side .page').last();
    await expect(last).toHaveText('Privacy');
    await last.click();
    await expect(page).toHaveURL(`${baseURL}/app/privacy.html`);
    await expect(page.locator('h1')).toHaveText('Your privacy');
  });
}

test('the Privacy page is worded exactly as the owner wrote it, a heading to each part', async ({ page }) => {
  await page.goto('/app/privacy.html');
  await expect(page).toHaveTitle('Privacy · Grew Puzzles');
  await expect(page.locator('main h1, main h2')).toHaveText(WORDS.map(([heading]) => heading));
  await expect(page.locator('main p')).toHaveText(WORDS.map(([, words]) => words));
  await expect(page.locator('main')).not.toContainText('[');
});

test('the puzzles\' email is a link that starts an email to it', async ({ page }) => {
  await page.goto('/app/privacy.html');
  const link = page.locator('main a');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveText(EMAIL);
  await expect(link).toHaveAttribute('href', `mailto:${EMAIL}`);
});

test('on the Privacy page, Privacy is the side bar\'s current entry', async ({ page }) => {
  await page.goto('/app/privacy.html');
  await expect(page.locator('#site-side [aria-current="page"]')).toHaveText(['Privacy']);
});

test('on the narrowest phone the Privacy page reads without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/app/privacy.html');
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
