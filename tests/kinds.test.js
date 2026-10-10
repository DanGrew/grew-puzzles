const { test, expect } = require('@playwright/test');

// The site split by kind (TASK-96): the kind is where the player is — Wordsearches or Mazes, from
// the side bar or, on a phone, the switch above the grid — and the type is what they filter within
// it. The indexes are stand-ins; every puzzle file asked for is counted, and none ever should be.

const puzzle = (kind, n, type, title) => ({ hiddenId: `${kind}-${String(n).padStart(4, '0')}`, type, created: `2026-10-0${n}`, title });
const WORDSEARCHES = [
  puzzle('WSCH', 1, 'Vanilla', 'Farmyard'), puzzle('WSCH', 2, 'Saga', 'Long Story'), puzzle('WSCH', 3, 'Mirra?e', 'Mirror'),
];
// A maze's index entry carries the difficulty the owner saved and its size (TASK-111) — Plain Path
// a Vanilla saved as Hard. Key Keeper was saved before either, so it has neither.
const saved = (difficulty, width, height) => ({ difficulty, width, height });
const MAZES = [
  { ...puzzle('MAZE', 1, 'Vanilla', 'Plain Path'), ...saved('Hard', 100, 100) },
  { ...puzzle('MAZE', 2, 'Collectibles', 'Gold Rush'), ...saved('Medium', 32, 40) },
  { ...puzzle('MAZE', 3, 'Code Breaker', 'Secret Code'), ...saved('Medium', 32, 40) },
  { ...puzzle('MAZE', 4, 'Keys', 'Locked Out'), ...saved('Hard', 48, 60) },
  { ...puzzle('MAZE', 5, 'Keylecticodes', 'Grand Finale'), ...saved('Extreme', 32, 40) },
  puzzle('MAZE', 6, 'Keys', 'Key Keeper'),
];

async function serve(page) {
  const fileRequests = [];
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: { puzzles: WORDSEARCHES } }));
  await page.route('**/content/puzzles/maze/index.json', r => r.fulfill({ json: { puzzles: MAZES } }));
  await page.route('**/content/collections/index.json', r => r.fulfill({ status: 404, body: 'Not found' }));
  await page.route(/\/puzzles\/.*(WSCH|MAZE)-\d+\.json$/, r => { fileRequests.push(r.request().url()); return r.abort(); });
  return fileRequests;
}

const side = page => page.locator('#site-side');
const names = page => page.locator('#tiles .tile .name');
const current = page => side(page).locator('[aria-current="page"]');
const rowsOf = page => page.locator('#filters .filter-rows > :not([hidden])').evaluateAll(cells => {
  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push([cells[i].innerText.trim(), [...cells[i + 1].querySelectorAll('.chip')].map(c => c.textContent)]);
  }
  return rows;
});

test('the landing page opens on the Wordsearches grid, Wordsearches highlighted, only wordsearches showing', async ({ page }) => {
  await serve(page);
  await page.goto('/app/');
  await expect(page.locator('#browse-title')).toHaveText('Wordsearches');
  await expect(names(page)).toHaveText(['Farmyard', 'Long Story', 'Mirror']);
  await expect(current(page)).toHaveText(['Wordsearches3']);
  await expect(side(page).locator('.kind').first()).toHaveCSS('background-color', 'rgb(31, 111, 92)');
});

test('Mazes in the side bar shows only mazes, and Filters offers their difficulties and only the maze types, in one list', async ({ page }) => {
  const fileRequests = await serve(page);
  await page.goto('/app/');
  await side(page).locator('.kind', { hasText: 'Mazes' }).click();
  await expect(page).toHaveURL(/\/app\/index\.html\?kind=maze$/);
  await expect(page.locator('#browse-title')).toHaveText('Mazes');
  await expect(page.locator('#total')).toHaveText('6 puzzles');
  await expect(current(page)).toHaveText(['Mazes6']);
  await page.locator('#filter-button').click();
  expect(await rowsOf(page)).toEqual([
    ['Difficulty', ['Medium', 'Hard', 'Extreme']], ['Type', ['Vanilla', 'Code Breaker', 'Collectibles', 'Keys', 'Keylecticodes']],
  ]);
  expect(fileRequests).toEqual([]);
});

test('a type under a kind opens that kind filtered to that type alone, the type marked', async ({ page }) => {
  await serve(page);
  await page.goto('/app/?type=Saga&type=Mirra%3Fe');
  const keys = side(page).locator('.types').nth(1).locator('.type', { hasText: 'Keys' });
  await keys.click();
  await expect(page).toHaveURL(/\/app\/index\.html\?kind=maze&type=Keys$/);
  await expect(names(page)).toHaveText(['Key Keeper', 'Locked Out']);
  await expect(page.locator('#filter-button')).toHaveText('Filters · 1');
  await expect(current(page)).toHaveText(['Mazes6', 'Keys']);
});

test('Vanilla under Mazes never shows a Vanilla wordsearch, nor Vanilla under Wordsearches a maze', async ({ page }) => {
  await serve(page);
  await page.goto('/app/');
  await side(page).locator('.types').nth(1).locator('.type', { hasText: 'Vanilla' }).click();
  await expect(names(page)).toHaveText(['Plain Path']);
  await side(page).locator('.types').first().locator('.type', { hasText: 'Vanilla' }).click();
  await expect(page).toHaveURL(/\/app\/index\.html\?type=Vanilla$/);
  await expect(names(page)).toHaveText(['Farmyard']);
  await expect(current(page)).toHaveText(['Wordsearches3', 'Vanilla']);
});

test('the side bar follows the filters: a type marked while it is picked alone, and unmarked once another joins it', async ({ page }) => {
  await serve(page);
  await page.goto('/app/?kind=maze');
  await page.locator('#filter-button').click();
  await page.locator('#filters .chip', { hasText: 'Collectibles' }).click();
  await expect(current(page)).toHaveText(['Mazes6', 'Collectibles']);
  await page.locator('#filters .chip', { hasText: 'Keylecticodes' }).click();
  await expect(current(page)).toHaveText(['Mazes6']);
});

test('an address naming a kind and a type opens on exactly that, so a link to "Mazes, Keys" can be shared', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await serve(page);
  await page.goto('/app/?kind=maze&type=Keys');
  await expect(page.locator('#browse-title')).toHaveText('Mazes');
  await expect(names(page)).toHaveText(['Key Keeper', 'Locked Out']);
  await page.locator('#filter-button').click();
  await expect(page.locator('#filters .chip[aria-pressed="true"]')).toHaveText(['Keys']);
  await expect(current(page)).toHaveText(['Mazes6', 'Keys']);
});

test('a Vanilla maze the owner saved as Hard wears Hard\'s colour; a maze saved before the pick wears its type\'s', async ({ page }) => {
  await serve(page);
  await page.goto('/app/?kind=maze');
  const strip = title => page.locator('#tiles .tile', { hasText: title }).evaluate(el => getComputedStyle(el, '::before').backgroundColor);
  expect(await strip('Plain Path')).toBe('rgb(246, 180, 122)');
  expect(await strip('Key Keeper')).toBe('rgb(246, 180, 122)');
  expect(await strip('Gold Rush')).toBe('rgb(245, 220, 114)');
});

test('picking Hard shows every Hard maze, whatever its type; Hard and Vanilla only the Hard Vanilla one; neither, every maze', async ({ page }) => {
  const fileRequests = await serve(page);
  await page.goto('/app/?kind=maze&sort=title&dir=asc');
  await page.locator('#filter-button').click();
  const pickOf = name => page.locator('#filters').getByRole('button', { name, exact: true });
  await pickOf('Hard').click();
  await expect(names(page)).toHaveText(['Key Keeper', 'Locked Out', 'Plain Path']);
  await pickOf('Vanilla').click();
  await expect(names(page)).toHaveText(['Plain Path']);
  await expect(page).toHaveURL(/\?kind=maze&type=Vanilla&difficulty=Hard&sort=title&dir=asc$/);
  await page.locator('#clear').click();
  await expect(names(page)).toHaveCount(6);
  expect(fileRequests).toEqual([]);
});

test('sorted by difficulty, the Hard Vanilla maze sits among the Hard mazes', async ({ page }) => {
  await serve(page);
  await page.goto('/app/?kind=maze');
  await expect(names(page)).toHaveText(['Secret Code', 'Gold Rush', 'Key Keeper', 'Locked Out', 'Plain Path', 'Grand Finale']);
});

test('every maze tile reads its size under its type; one saved before the size has none', async ({ page }) => {
  await serve(page);
  await page.goto('/app/?kind=maze');
  const lines = title => page.locator('#tiles .tile', { hasText: title }).locator('.detail .line');
  await expect(lines('Plain Path')).toHaveText(['Vanilla', '100×100', '1 Oct 2026']);
  await expect(lines('Locked Out')).toHaveText(['Keys', '48×60', '4 Oct 2026']);
  await expect(lines('Key Keeper')).toHaveText(['Keys', '6 Oct 2026']);
  await page.goto('/app/');
  await expect(page.locator('#tiles .tile').first().locator('.detail .line')).toHaveText(['Vanilla', '1 Oct 2026']);
});

test('an address naming a difficulty, a type or both opens on exactly that', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await serve(page);
  await page.goto('/app/?kind=maze&difficulty=Hard');
  await expect(names(page)).toHaveText(['Key Keeper', 'Locked Out', 'Plain Path']);
  await expect(page.locator('#filter-button')).toHaveText('Filters · 1');
  await page.goto('/app/?kind=maze&type=Vanilla&difficulty=Hard');
  await expect(names(page)).toHaveText(['Plain Path']);
  await expect(page.locator('#filter-button')).toHaveText('Filters · 2');
  await page.locator('#filter-button').click();
  await expect(page.locator('#filters [aria-pressed="true"]')).toHaveText(['Hard', 'Vanilla']);
  await page.goto('/app/?kind=maze&difficulty=Easy');
  await expect(names(page)).toHaveCount(6);
});

test('an address naming a type its kind lacks, or a kind the site lacks, falls back to that kind\'s whole grid', async ({ page }) => {
  await serve(page);
  await page.goto('/app/?type=Keys');
  await expect(page.locator('#browse-title')).toHaveText('Wordsearches');
  await expect(names(page)).toHaveCount(3);
  await page.goto('/app/?kind=crosswords');
  await expect(page.locator('#browse-title')).toHaveText('Wordsearches');
  await expect(current(page)).toHaveText(['Wordsearches3']);
});

test('every puzzle tile shows its kind\'s picture between its strip and its title, the same on every tile of a kind', async ({ page }) => {
  const fileRequests = await serve(page);
  const pictures = () => page.locator('#tiles .tile .pic svg').evaluateAll(svgs => svgs.map(s => s.outerHTML));
  await page.goto('/app/');
  await expect(names(page)).toHaveCount(3);
  const grids = await pictures();
  expect(grids).toHaveLength(3);
  expect(new Set(grids).size).toBe(1);
  expect(grids[0]).toContain('<text');
  await page.goto('/app/?kind=maze');
  await expect(names(page)).toHaveCount(6);
  const mazes = await pictures();
  expect(mazes).toHaveLength(6);
  expect(new Set(mazes).size).toBe(1);
  expect(mazes[0]).not.toContain('<text');
  const tile = page.locator('#tiles .tile').first();
  const strip = await tile.evaluate(el => el.getBoundingClientRect().top + parseFloat(getComputedStyle(el, '::before').height));
  const pic = await tile.locator('.pic').boundingBox();
  const name = await tile.locator('.name').boundingBox();
  expect(pic.y).toBeGreaterThanOrEqual(strip);
  expect(pic.y + pic.height).toBeLessThanOrEqual(name.y);
  expect(fileRequests).toEqual([]);
});

test('a collection tile has no picture', async ({ page }) => {
  await serve(page);
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [
    { slug: 'mix', name: 'Mix', description: 'Both.', created: '2026-10-09', puzzles: [{ id: 'WSCH-0001', number: 1 }, { id: 'MAZE-0001', number: 2 }] },
  ] } }));
  await page.goto('/app/?kind=collections');
  await expect(page.locator('#tiles .tile.collection')).toHaveCount(1);
  await expect(page.locator('#tiles .tile.collection .pic')).toBeHidden();
  await expect(page.locator('#tiles .tile.collection .pic svg')).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a Wordsearches | Mazes switch sits above the grid, the current kind filled', async ({ page }) => {
    await serve(page);
    await page.goto('/app/');
    const kinds = page.locator('main .kind-switch a');
    await expect(kinds).toHaveText(['Wordsearches3', 'Mazes6']);
    await expect(kinds.first()).toHaveAttribute('aria-current', 'page');
    const box = await page.locator('.kind-switch').boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual((await page.locator('#tiles').boundingBox()).y);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await kinds.nth(1).click();
    await expect(page).toHaveURL(/\/app\/index\.html\?kind=maze$/);
    await expect(names(page)).toHaveCount(6);
    await expect(kinds.nth(1)).toHaveAttribute('aria-current', 'page');
    await expect(kinds.first()).toHaveAttribute('aria-current', 'false');
  });

  test('the burger\'s drawer is the same side bar, and a type in it opens its kind filtered to it', async ({ page }) => {
    await serve(page);
    await page.goto('/app/');
    await page.locator('.site .burger').click();
    await side(page).locator('.types').nth(1).locator('.type', { hasText: 'Keylecticodes' }).click();
    await expect(page).toHaveURL(/\?kind=maze&type=Keylecticodes$/);
    await expect(names(page)).toHaveText(['Grand Finale']);
    await expect(side(page)).toBeHidden();
  });

  test('nothing scrolls sideways', async ({ page }) => {
    await serve(page);
    await page.goto('/app/?kind=maze');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test('on a desktop there is no Wordsearches | Mazes switch — the side bar is the way between kinds', async ({ page }) => {
  await serve(page);
  await page.goto('/app/');
  await expect(page.locator('.kind-switch')).toBeHidden();
});
