const { test, expect } = require('@playwright/test');

// Stand-in indexes: the collection page reads only the wordsearch index and the collections
// index, so both are served in place of the real ones — no puzzle file is ever needed.
const puzzles = [
  { hiddenId: 'WSCH-0001', type: 'Vanilla', created: '2026-01-01', title: 'Farm Animals' },
  { hiddenId: 'WSCH-0002', type: 'Missing', created: '2026-01-02', title: 'Flowers' },
  { hiddenId: 'WSCH-0003', type: 'Vanilla', created: '2026-01-03', title: 'Birds' },
];
const issue = {
  slug: 'issue-1', name: 'Issue #1', description: 'The first book, remade.', created: '2026-01-05',
  puzzles: [{ id: 'WSCH-0002', number: 1 }, { id: 'WSCH-0003', number: 2 }, { id: 'WSCH-0001', number: 3 }],
};

async function serve(page) {
  const fileRequests = [];
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: { puzzles } }));
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [issue] } }));
  await page.route(/\/puzzles\/.*WSCH-\d+\.json$/, r => { fileRequests.push(r.request().url()); return r.fulfill({ json: {} }); });
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

test('a collection page offers Print book, between its description and its puzzles', async ({ page }) => {
  await serve(page);
  await page.goto('/app/collection.html?slug=issue-1');
  const print = page.locator('#print-book');
  await expect(print).toBeVisible();
  await expect(print).toHaveText('Print book');
  await expect(print).toHaveAttribute('href', 'book.html?slug=issue-1');
  const description = await page.locator('#description').boundingBox();
  const button = await print.boundingBox();
  const grid = await page.locator('#tiles').boundingBox();
  expect(button.y).toBeGreaterThanOrEqual(description.y + description.height);
  expect(grid.y).toBeGreaterThanOrEqual(button.y + button.height);
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
  await first.goto('/app/');
  await first.locator('.tiles .tile.collection').click();
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
  await expect(page.locator('#print-book')).toBeHidden();
  await expect(tiles(page)).toHaveCount(0);
  await page.locator('#missing a').click();
  await expect(page).toHaveURL(/\/app\/index\.html\?type=Collections$/);
});

test('the burger menu on a collection page holds Wordsearches, Collections, How to play, About us and Privacy, Collections current', async ({ page }) => {
  await serve(page);
  await page.goto('/app/collection.html?slug=issue-1');
  await page.locator('.site .burger').click();
  const entries = page.locator('#site-menu a:visible');
  await expect(entries).toHaveText(['Wordsearches', 'Collections', 'How to play', 'About us', 'Privacy']);
  await expect(entries.nth(1)).toHaveAttribute('aria-current', 'page');
  await expect(entries.nth(1)).toHaveAttribute('href', 'index.html?type=Collections');
});

test('the real collections load, each with its puzzles numbered from 1', async ({ page }) => {
  await page.goto('/app/?type=Collections');
  await page.locator('.tiles .tile.collection').first().click();
  await expect(page).toHaveURL(/collection\.html\?slug=/);
  await expect(tiles(page).locator('.number').first()).toHaveText('1');
});
