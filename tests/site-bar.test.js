const { test, expect } = require('@playwright/test');

// The site bar and the side bar every page shares (components/site-bar.js, ui/side-bar-ui.js): the
// name and sign-in across the top; down the left, Wordsearches and Mazes, each with its count and
// its types, then Collections, the text pages and the look. On a phone the side bar is a drawer
// behind a burger at the top left. The indexes are stand-ins, so the counts are known.

function puzzle(kind, n, type) {
  return { hiddenId: `${kind}-${String(n).padStart(4, '0')}`, type, created: '2026-10-08', title: `${kind} ${n}` };
}
const WORDSEARCHES = ['Vanilla', 'Mirra?e', 'Saga', 'Vanilla'].map((type, i) => puzzle('WSCH', i + 1, type));
const MAZES = ['Keys', 'Vanilla', 'Keylecticodes'].map((type, i) => puzzle('MAZE', i + 1, type));
const ISSUE = { slug: 'issue-1', name: 'Issue #1', description: 'Both kinds.', created: '2026-10-08',
  puzzles: [{ id: 'WSCH-0001', number: 1 }, { id: 'MAZE-0001', number: 2 }] };

async function serve(page, { collections = [ISSUE], mazes = MAZES } = {}) {
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: { puzzles: WORDSEARCHES } }));
  await page.route('**/content/puzzles/maze/index.json', r => r.fulfill({ json: { puzzles: mazes } }));
  await page.route('**/content/collections/index.json', r => r.fulfill(
    collections.length ? { json: { collections } } : { status: 404, body: 'Not found' },
  ));
}

const side = page => page.locator('#site-side');
const PAGES = ['/app/', '/app/play.html?id=WSCH-0007', '/app/maze.html?id=MAZE-0001', '/app/collection.html?slug=issue-1',
  '/app/how-to-play.html', '/app/saving.html', '/app/about.html', '/app/privacy.html'];

test('the site address lands on the page with the Grew Puzzles site bar and the side bar beside the page', async ({ page }) => {
  await serve(page);
  await page.goto('/grew-puzzles/');
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.locator('.site .brand')).toHaveText('Grew Puzzles');
  await expect(side(page)).toBeVisible();
  await expect(page.locator('.site .burger')).toBeHidden();
  const bar = await side(page).boundingBox();
  const grid = await page.locator('#tiles').boundingBox();
  expect(bar.x + bar.width).toBeLessThan(grid.x);
});

test('the site bar is set in Sora', async ({ page }) => {
  await page.goto('/app/');
  const font = await page.locator('.site .brand').evaluate(el => getComputedStyle(el).fontFamily);
  expect(font.split(',')[0]).toBe('Sora');
});

test('the brand returns to the landing page', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('.site .brand')).toHaveAttribute('href', 'index.html');
});

test('the side bar lists each kind with its count and its types, then Collections, the text pages and the look', async ({ page }) => {
  await serve(page);
  await page.goto('/app/');
  await expect(side(page).locator('.kind')).toHaveText(['Wordsearches4', 'Mazes3', 'Collections1']);
  await expect(side(page).locator('.types').first().locator('.type')).toHaveText(['Vanilla', 'Saga', 'Mirra?e']);
  await expect(side(page).locator('.types').nth(1).locator('.type')).toHaveText(['Vanilla', 'Keys', 'Keylecticodes']);
  await expect(side(page).locator('.page')).toHaveText(['How to play', 'Saving your progress', 'About us', 'Privacy']);
  await expect(side(page).locator('> *:visible').last()).toHaveClass(/\blook\b/);
  await expect(side(page).locator('.kind').nth(1)).toHaveAttribute('href', 'index.html?kind=maze');
  await expect(side(page).locator('.kind').nth(2)).toHaveAttribute('href', 'index.html?kind=collections');
  await expect(side(page).locator('.types').nth(1).locator('.type', { hasText: 'Keys' })).toHaveAttribute('href', 'index.html?kind=maze&type=Keys');
  await expect(side(page).locator('.page').last()).toHaveAttribute('href', 'privacy.html');
});

test('each type\'s dot is its difficulty\'s colour, a maze type its own kind\'s', async ({ page }) => {
  await serve(page);
  await page.goto('/app/');
  const dot = (kind, type) => side(page).locator('.types').nth(kind).locator('.type', { hasText: type }).locator('.dot')
    .evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await dot(0, 'Vanilla')).toBe('rgb(159, 216, 174)');
  expect(await dot(0, 'Saga')).toBe('rgb(245, 220, 114)');
  expect(await dot(0, 'Mirra?e')).toBe('rgb(241, 154, 154)');
  expect(await dot(1, 'Keys')).toBe('rgb(246, 180, 122)');
  expect(await dot(1, 'Keylecticodes')).toBe('rgb(241, 154, 154)');
});

test('Mazes with no mazes yet counts 0 and lists no types; Collections hides with no collections', async ({ page }) => {
  await serve(page, { collections: [], mazes: [] });
  await page.goto('/app/');
  await expect(side(page).locator('.kind:visible')).toHaveText(['Wordsearches4', 'Mazes0']);
  await expect(side(page).locator('.types').nth(1).locator('.type')).toHaveCount(0);
});

for (const address of PAGES) {
  test(`on ${address}, the side bar sits down the left and the burger is gone`, async ({ page }) => {
    await serve(page);
    await page.route(/\/content\/puzzles\/(wordsearch|maze)\/(WSCH|MAZE)-\d+\.json$/, r => r.fulfill({ status: 404, body: 'Not found' }));
    await page.goto(address);
    await expect(side(page).locator('.kind')).toHaveText(['Wordsearches4', 'Mazes3', 'Collections1']);
    await expect(page.locator('.site .burger')).toBeHidden();
    const bar = await side(page).boundingBox();
    expect(bar.x).toBeLessThan(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  });
}

test('each page marks its own place: the play page Wordsearches, the maze page Mazes, a collection Collections', async ({ page }) => {
  await serve(page);
  const current = () => side(page).locator('[aria-current="page"]');
  await page.goto('/app/play.html?id=WSCH-0007');
  await expect(current()).toHaveText(['Wordsearches4']);
  await page.goto('/app/maze.html?id=MAZE-0001');
  await expect(current()).toHaveText(['Mazes3']);
  await page.goto('/app/collection.html?slug=issue-1');
  await expect(current()).toHaveText(['Collections1']);
});

test('on the play page its own Print comes first, above the kinds', async ({ page }) => {
  await serve(page);
  await page.goto('/app/play.html?id=WSCH-0007');
  await expect(side(page).locator('.side-own > *')).toHaveText(['Print']);
  const print = await side(page).locator('#print').boundingBox();
  const kinds = await side(page).locator('.kind').first().boundingBox();
  expect(print.y).toBeLessThan(kinds.y);
  await page.goto('/app/about.html');
  await expect(side(page).locator('.side-own')).toBeHidden();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('there is no side bar beside the page; a burger at the top left opens it as a drawer', async ({ page }) => {
    await serve(page);
    await page.goto('/app/');
    const burger = page.locator('.site .burger');
    await expect(side(page)).toBeHidden();
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    const box = await burger.boundingBox();
    const brand = await page.locator('.site .brand').boundingBox();
    expect(box.x + box.width).toBeLessThan(brand.x);

    await burger.click();
    await expect(side(page)).toBeVisible();
    await expect(burger).toHaveAttribute('aria-expanded', 'true');
    const drawer = await side(page).boundingBox();
    expect(drawer.x).toBe(0);
    expect(drawer.width).toBeLessThan(390);
    await expect(side(page).locator('.kind')).toHaveText(['Wordsearches4', 'Mazes3', 'Collections1']);
  });

  test('the burger, from the keyboard, closes the drawer again', async ({ page }) => {
    await page.goto('/app/');
    const burger = page.locator('.site .burger');
    await burger.focus();
    await page.keyboard.press('Enter');
    await expect(side(page)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(side(page)).toBeHidden();
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
  });

  test('while open the drawer dims the page behind it, and a tap there only closes it', async ({ page }) => {
    await page.goto('/app/');
    await page.locator('.site .burger').click();
    await expect(page.locator('.side-scrim')).toBeVisible();
    const before = page.url();
    await page.mouse.click(370, 400);
    await expect(side(page)).toBeHidden();
    await expect(page.locator('.side-scrim')).toBeHidden();
    expect(page.url()).toBe(before);
  });

  test('clicking inside the open drawer keeps it open', async ({ page }) => {
    await page.goto('/app/');
    await page.locator('.site .burger').click();
    await side(page).dispatchEvent('click');
    await expect(side(page)).toBeVisible();
  });

  test('clicking beside the drawer closes it', async ({ page }) => {
    await page.goto('/app/');
    await page.locator('.site .burger').click();
    await page.mouse.click(370, 600);
    await expect(side(page)).toBeHidden();
  });

  test('Escape closes the drawer and returns focus to the burger', async ({ page }) => {
    await page.goto('/app/');
    const burger = page.locator('.site .burger');
    await burger.click();
    await page.keyboard.press('Escape');
    await expect(side(page)).toBeHidden();
    await expect(burger).toBeFocused();
  });

  test('Escape with the drawer closed leaves the keyboard where it was', async ({ page }) => {
    await page.goto('/app/');
    await page.locator('#sort').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#sort')).toBeFocused();
  });

  test('other keys leave the drawer open', async ({ page }) => {
    await page.goto('/app/');
    await page.locator('.site .burger').click();
    await page.keyboard.press('a');
    await expect(side(page)).toBeVisible();
  });
});

test('the side bar never prints', async ({ page }) => {
  await serve(page);
  await page.goto('/app/about.html');
  await page.emulateMedia({ media: 'print' });
  await expect(side(page)).toBeHidden();
  await expect(page.locator('.site .burger')).toBeHidden();
});
