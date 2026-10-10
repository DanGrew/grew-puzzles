const { test, expect } = require('@playwright/test');

// Stand-in indexes: the collection page reads only the indexes — both kinds' and the collections'
// — so each is served in place of the real one; no puzzle file is ever needed.
const puzzles = [
  { hiddenId: 'WSCH-0001', type: 'Vanilla', created: '2026-01-01', title: 'Farm Animals' },
  { hiddenId: 'WSCH-0002', type: 'Missing', created: '2026-01-02', title: 'Flowers' },
  { hiddenId: 'WSCH-0003', type: 'Vanilla', created: '2026-01-03', title: 'Birds' },
];
const mazes = [{ hiddenId: 'MAZE-0001', type: 'Keys', created: '2026-01-04', title: 'Locked Out' }];
const issue = {
  slug: 'issue-1', name: 'Issue #1', description: 'The first book, remade.', created: '2026-01-05',
  puzzles: [{ id: 'WSCH-0002', number: 1 }, { id: 'WSCH-0003', number: 2 }, { id: 'WSCH-0001', number: 3 }],
};
const mixed = {
  slug: 'mixed', name: 'Mixed Bag', description: 'A bit of both.', created: '2026-01-06',
  puzzles: [{ id: 'WSCH-0001', number: 1 }, { id: 'MAZE-0001', number: 2 }],
};

async function serve(page) {
  const fileRequests = [];
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: { puzzles } }));
  await page.route('**/content/puzzles/maze/index.json', r => r.fulfill({ json: { puzzles: mazes } }));
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [issue, mixed] } }));
  await page.route(/\/puzzles\/.*(WSCH|MAZE)-\d+\.json$/, r => { fileRequests.push(r.request().url()); return r.fulfill({ json: {} }); });
  return fileRequests;
}

const tiles = page => page.locator('.tiles .tile');

test('a collection page shows its name and description, then its puzzles in number order, numbered', async ({ page }) => {
  const fileRequests = await serve(page);
  await page.goto('/app/collection.html?slug=issue-1');
  await expect(page.locator('#collection-title')).toHaveText('Issue #1');
  await expect(page).toHaveTitle('Issue #1 · Grew Puzzles');
  await expect(page.locator('#description')).toHaveText('The first book, remade.');
  await expect(tiles(page).locator('.number')).toHaveText(['1', '2', '3']);
  await expect(tiles(page).locator('.name')).toHaveText(['Flowers', 'Birds', 'Farm Animals']);
  await expect(tiles(page).first().locator('.detail .line')).toHaveText(['Missing', '2 Jan 2026']);
  const description = await page.locator('#description').boundingBox();
  const grid = await page.locator('#tiles').boundingBox();
  expect(description.y + description.height).toBeLessThanOrEqual(grid.y);
  await expect(page.locator('#missing')).toBeHidden();
  expect(fileRequests).toEqual([]);
});

test('each number sits plain on its tile\'s band, above the title', async ({ page }) => {
  await serve(page);
  await page.goto('/app/collection.html?slug=issue-1');
  const first = tiles(page).first();
  const number = await first.locator('.number').boundingBox();
  const name = await first.locator('.name').boundingBox();
  expect(number.y + number.height).toBeLessThanOrEqual(name.y);
  await expect(first.locator('.number')).toHaveText(/^1$/);
});

test('each number band is its type\'s colour, the same as that puzzle\'s strip on the landing page', async ({ page }) => {
  await serve(page);
  await page.goto('/app/');
  const strip = id => page.locator(`.tiles .tile[href="play.html?id=${id}"]`)
    .evaluate(el => getComputedStyle(el, '::before').backgroundColor);
  const onLanding = [await strip('WSCH-0002'), await strip('WSCH-0003'), await strip('WSCH-0001')];
  expect(onLanding).toEqual(['rgb(246, 180, 122)', 'rgb(159, 216, 174)', 'rgb(159, 216, 174)']);
  await page.goto('/app/collection.html?slug=issue-1');
  // The tiles draw once the indexes are read — wait for them, never read an empty page.
  await expect(tiles(page).locator('.number')).toHaveCount(onLanding.length);
  const bands = await tiles(page).locator('.number').evaluateAll(els => els.map(el => getComputedStyle(el).backgroundColor));
  expect(bands).toEqual(onLanding);
  await expect(tiles(page).first().locator('.number')).toHaveCSS('color', 'rgb(15, 42, 36)');
});

test('the collection page has no filter, no sort and no pager', async ({ page }) => {
  await serve(page);
  await page.goto('/app/collection.html?slug=issue-1');
  await expect(tiles(page)).toHaveCount(3);
  await expect(page.locator('#filters, #sort, #dir, #pager')).toHaveCount(0);
  await expect(page.locator('main select, main button')).toHaveCount(0);
});

test('a collection page offers Print book at the foot of its side bar, in Colour, Black and white or Plain', async ({ page }) => {
  await serve(page);
  await page.goto('/app/collection.html?slug=issue-1');
  const print = page.locator('#site-side #book');
  await expect(print).toBeVisible();
  await expect(print.locator('.print-name')).toHaveText('Print book');
  await expect(print.locator('a')).toHaveText(['Colour', 'Black and white', 'Plain']);
  expect(await print.locator('a').evaluateAll(as => as.map(a => a.getAttribute('href')))).toEqual(
    ['colour', 'mono', 'plain'].map(style => `book.html?slug=issue-1&print=${style}`));
});

test('tapping a numbered tile opens that puzzle on the play page', async ({ page }) => {
  await serve(page);
  await page.goto('/app/collection.html?slug=issue-1');
  const second = tiles(page).nth(1);
  await expect(second).toHaveAttribute('href', 'play.html?id=WSCH-0003');
  await second.click();
  await expect(page).toHaveURL(/\/app\/play\.html\?id=WSCH-0003$/);
});

test('a copied collection address opens the same collection elsewhere', async ({ browser }) => {
  const first = await browser.newPage();
  await serve(first);
  await first.goto('/app/?kind=collections');
  await first.locator('.tiles .tile.collection', { hasText: 'Issue #1' }).click();
  await expect(first.locator('#collection-title')).toHaveText('Issue #1');
  const address = first.url();
  const elsewhere = await (await browser.newContext()).newPage();
  await serve(elsewhere);
  await elsewhere.goto(address);
  await expect(elsewhere.locator('#collection-title')).toHaveText('Issue #1');
  await expect(elsewhere.locator('.tiles .tile .name')).toHaveText(['Flowers', 'Birds', 'Farm Animals']);
});

test('an address naming no collection says so, and leads back to the collections', async ({ page }) => {
  await serve(page);
  await page.goto('/app/collection.html?slug=nope');
  await expect(page.locator('#collection-title')).toHaveText('Collection not found');
  await expect(page.locator('#missing')).toBeVisible();
  await expect(page.locator('#description')).toBeHidden();
  await expect(page.locator('#book')).toBeHidden();
  await expect(tiles(page)).toHaveCount(0);
  await page.locator('#missing a').click();
  await expect(page).toHaveURL(/\/app\/index\.html\?kind=collections$/);
});

test('the side bar on a collection page has Collections current, leading back to every collection', async ({ page }) => {
  await serve(page);
  await page.goto('/app/collection.html?slug=issue-1');
  const kinds = page.locator('#site-side .kind');
  await expect(kinds).toHaveText(['Wordsearches3', 'Mazes1', 'Collections2']);
  await expect(page.locator('#site-side [aria-current="page"]')).toHaveText(['Collections2']);
  await expect(kinds.nth(2)).toHaveAttribute('href', 'index.html?kind=collections');
});

test('a collection holding both kinds lists all its puzzles, each its own kind\'s picture, a maze opening the maze page', async ({ page }) => {
  const fileRequests = await serve(page);
  await page.goto('/app/collection.html?slug=mixed');
  await expect(tiles(page).locator('.name')).toHaveText(['Farm Animals', 'Locked Out']);
  await expect(tiles(page).nth(1)).toHaveAttribute('href', 'maze.html?id=MAZE-0001');
  await expect(tiles(page).nth(1).locator('.number')).toHaveCSS('background-color', 'rgb(246, 180, 122)');
  const pictures = await tiles(page).locator('.pic svg').evaluateAll(svgs => svgs.map(s => s.outerHTML));
  expect(pictures).toHaveLength(2);
  expect(pictures[0]).toContain('<text');
  expect(pictures[1]).not.toContain('<text');
  await page.goto('/app/?kind=collections');
  await expect(page.locator('.tiles .tile.collection')).toHaveCount(2);
  expect(fileRequests).toEqual([]);
});

test('the real collections load, each with its puzzles numbered from 1', async ({ page }) => {
  await page.goto('/app/?kind=collections');
  await page.locator('.tiles .tile.collection').first().click();
  await expect(page).toHaveURL(/collection\.html\?slug=/);
  await expect(tiles(page).locator('.number').first()).toHaveText('1');
});
