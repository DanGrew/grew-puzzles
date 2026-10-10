const { test, expect } = require('@playwright/test');

// Filtering is looking through the same page, not going somewhere new (BUG-124): every pick on the
// landing page — a kind, a type or Collections in the side bar, the phone's switch, a filter, Clear,
// the sort — redraws its tiles where they are, so the Themed background stays. A page that loaded
// again would lose the mark set on it below. The indexes are stand-ins; the characters are real.

const puzzle = (kind, n, type, title) => ({ hiddenId: `${kind}-${String(n).padStart(4, '0')}`, type, created: `2026-10-0${n}`, title });
const WORDSEARCHES = [
  puzzle('WSCH', 1, 'Vanilla', 'Farmyard'), puzzle('WSCH', 2, 'Saga', 'Long Story'), puzzle('WSCH', 3, 'Missing', 'Gaps'),
];
const MAZES = [
  { ...puzzle('MAZE', 1, 'Vanilla', 'Plain Path'), difficulty: 'Hard' },
  { ...puzzle('MAZE', 2, 'Keys', 'Locked Out'), difficulty: 'Hard' },
];
const COLLECTIONS = [
  { slug: 'mix', name: 'Mix', description: 'Both.', created: '2026-10-09', puzzles: [{ id: 'WSCH-0001', number: 1 }, { id: 'MAZE-0001', number: 2 }] },
];

async function serve(page) {
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: { puzzles: WORDSEARCHES } }));
  await page.route('**/content/puzzles/maze/index.json', r => r.fulfill({ json: { puzzles: MAZES } }));
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: COLLECTIONS } }));
}

const side = page => page.locator('#site-side');
const names = page => page.locator('#tiles .tile .name');
const sceneOf = page => page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage);
const typeIn = (page, kind, type) => side(page).locator('.types').nth(kind).locator('.type', { hasText: type });

// The landing page, Themed, wearing its background, marked so a reload would show.
async function landing(page, path = '/app/') {
  await serve(page);
  await page.goto(path);
  await expect(names(page).first()).toBeVisible();
  await expect.poll(() => sceneOf(page)).toMatch(/-bg\.webp/);
  await page.evaluate(() => { window.stayed = true; });
  return sceneOf(page);
}

async function stayed(page, scene) {
  expect(await page.evaluate(() => window.stayed)).toBe(true);
  expect(await sceneOf(page)).toBe(scene);
}

test('picking Saga in the side bar shows the Saga tiles without loading the page again, the background as it was', async ({ page }) => {
  const scene = await landing(page);
  await typeIn(page, 0, 'Saga').click();
  await expect(names(page)).toHaveText(['Long Story']);
  await expect(page).toHaveURL(/\/app\/index\.html\?type=Saga$/);
  await stayed(page, scene);
});

test('Mazes, Collections and Wordsearches in the side bar each redraw the page where it is', async ({ page }) => {
  const scene = await landing(page);
  await side(page).locator('.kind', { hasText: 'Mazes' }).click();
  await expect(page.locator('#browse-title')).toHaveText('Mazes');
  await expect(names(page)).toHaveText(['Locked Out', 'Plain Path']);
  await page.locator('#filter-button').click();
  await expect(page.locator('#filters .chip')).toHaveText(['Hard', 'Vanilla', 'Keys']);
  await page.keyboard.press('Escape');
  await side(page).locator('.kind', { hasText: 'Collections' }).click();
  await expect(page.locator('#browse-title')).toHaveText('Collections');
  await expect(names(page)).toHaveText(['Mix']);
  await expect(page.locator('#filter-button')).toBeHidden();
  await side(page).locator('.kind', { hasText: 'Wordsearches' }).click();
  await expect(page.locator('#browse-title')).toHaveText('Wordsearches');
  await expect(names(page)).toHaveCount(3);
  await expect(page.locator('#filter-button')).toBeVisible();
  await stayed(page, scene);
});

test('every pick in the Filters popup, Clear, the sort and its direction keep the page and its background', async ({ page }) => {
  const scene = await landing(page);
  await page.locator('#filter-button').click();
  await page.locator('#filters .chip', { hasText: 'Missing' }).click();
  await expect(names(page)).toHaveText(['Gaps']);
  await page.locator('#clear').click();
  await expect(names(page)).toHaveCount(3);
  await page.locator('#sort').selectOption('title');
  await page.locator('#dir').click();
  await expect(names(page)).toHaveText(['Farmyard', 'Gaps', 'Long Story']);
  await stayed(page, scene);
});

test('a type picked in the side bar closes an open Filters popup, as a fresh page would have it', async ({ page }) => {
  await landing(page);
  await page.locator('#filter-button').click();
  await typeIn(page, 1, 'Keys').click();
  await expect(names(page)).toHaveText(['Locked Out']);
  await expect(page.locator('#filters')).toBeHidden();
  await expect(page.locator('#filter-button')).toHaveAttribute('aria-expanded', 'false');
});

test('the address follows each pick, and opened in a new tab shows the same tiles', async ({ page, context }) => {
  await landing(page);
  await typeIn(page, 1, 'Keys').click();
  await page.locator('#sort').selectOption('title');
  await expect(page).toHaveURL(/\/app\/index\.html\?kind=maze&type=Keys&sort=title$/);
  const copied = page.url();
  const other = await context.newPage();
  await serve(other);
  await other.goto(copied);
  await expect(other.locator('#browse-title')).toHaveText('Mazes');
  await expect(names(other)).toHaveText(['Locked Out']);
  await expect(other.locator('#sort')).toHaveValue('title');
});

test('Back after each pick goes back to the pick before, and Forward again, without loading the page', async ({ page }) => {
  const scene = await landing(page);
  await typeIn(page, 0, 'Saga').click();
  await expect(names(page)).toHaveText(['Long Story']);
  await side(page).locator('.kind', { hasText: 'Mazes' }).click();
  await expect(names(page)).toHaveCount(2);
  await page.locator('#filter-button').click();
  await page.locator('#filters .chip', { hasText: 'Keys' }).click();
  await expect(names(page)).toHaveText(['Locked Out']);

  await page.goBack();
  await expect(page).toHaveURL(/\/app\/index\.html\?kind=maze$/);
  await expect(names(page)).toHaveCount(2);
  await expect(page.locator('#filters .chip[aria-pressed="true"]')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('#browse-title')).toHaveText('Wordsearches');
  await expect(names(page)).toHaveText(['Long Story']);
  await expect(side(page).locator('[aria-current="page"]')).toHaveText(['Wordsearches3', 'Saga']);
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(names(page)).toHaveCount(3);
  await page.goForward();
  await expect(names(page)).toHaveText(['Long Story']);
  await stayed(page, scene);
});

test('a link to the landing page opened in a new tab is still the browser\'s', async ({ page, context }) => {
  await landing(page);
  const opened = context.waitForEvent('page');
  await typeIn(page, 0, 'Saga').click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] });
  const other = await opened;
  await expect(other).toHaveURL(/\/app\/index\.html\?type=Saga$/);
  await expect(names(page)).toHaveCount(3);
  await expect(page).toHaveURL(/\/app\/$/);
});

test('opening a puzzle, How to play or another page from the landing page still goes there', async ({ page }) => {
  await landing(page);
  await page.locator('#tiles .tile', { hasText: 'Farmyard' }).click();
  await expect(page).toHaveURL(/\/app\/play\.html\?id=WSCH-0001$/);
  expect(await page.evaluate(() => window.stayed)).toBeUndefined();
  await landing(page);
  await side(page).getByRole('link', { name: 'How to play' }).click();
  await expect(page).toHaveURL(/\/app\/how-to-play\.html$/);
  expect(await page.evaluate(() => window.stayed)).toBeUndefined();
});

test('on any other page the side bar\'s kinds and types still go to the landing page', async ({ page }) => {
  await serve(page);
  await page.goto('/app/privacy.html');
  await typeIn(page, 1, 'Keys').click();
  await expect(page).toHaveURL(/\/app\/index\.html\?kind=maze&type=Keys$/);
  await expect(names(page)).toHaveText(['Locked Out']);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a type picked from the drawer redraws the page where it is, and the drawer closes', async ({ page }) => {
    const scene = await landing(page);
    await page.locator('.site .burger').click();
    await typeIn(page, 1, 'Keys').click();
    await expect(names(page)).toHaveText(['Locked Out']);
    await expect(side(page)).toBeHidden();
    await expect(page.locator('.site .burger')).toHaveAttribute('aria-expanded', 'false');
    await stayed(page, scene);
  });

  test('the Wordsearches | Mazes switch redraws the page where it is', async ({ page }) => {
    const scene = await landing(page);
    await page.locator('main .kind-switch a', { hasText: 'Mazes' }).click();
    await expect(names(page)).toHaveCount(2);
    await expect(page.locator('main .kind-switch a').nth(1)).toHaveAttribute('aria-current', 'page');
    await stayed(page, scene);
  });
});
