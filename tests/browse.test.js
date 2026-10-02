const { test, expect } = require('@playwright/test');

// A stand-in index: the browse page reads only the index, so it is served in place of the real
// one — no puzzle file is ever needed. Puzzle n was saved n days into the year, so the highest
// is the newest; the index lists them oldest first, as Save appends them.
function index(count) {
  const puzzles = Array.from({ length: count }, (_, i) => {
    const day = new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10);
    return { hiddenId: `WSCH-${String(i + 1).padStart(4, '0')}`, type: 'Vanilla', created: day, title: `Puzzle ${i + 1}` };
  });
  return { puzzles };
}

async function serve(page, served) {
  const fileRequests = [];
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: served }));
  await page.route(/\/puzzles\/.*WSCH-\d+\.json$/, r => { fileRequests.push(r.request().url()); return r.abort(); });
  return fileRequests;
}

test('the site opens straight onto the browse grid, with no intro', async ({ page }) => {
  await serve(page, index(3));
  await page.goto('/grew-puzzles/');
  await expect(page.locator('#browse-title')).toHaveText('Wordsearches');
  await expect(page.locator('#total')).toHaveText('3 puzzles');
  await expect(page.locator('.tiles .tile')).toHaveCount(3);
  await expect(page.locator('main > *')).toHaveCount(3);
});

test('a tile shows the title, with its type and created date small beneath — no number, no hidden ID', async ({ page }) => {
  const fileRequests = await serve(page, index(3));
  await page.goto('/app/');
  const first = page.locator('.tiles .tile').first();
  await expect(first.locator('.name')).toHaveText('Puzzle 3');
  await expect(first.locator('.detail .line')).toHaveText(['Vanilla', '3 Jan 2026']);
  const name = await first.locator('.name').boundingBox();
  const detail = await first.locator('.detail').boundingBox();
  expect(detail.y).toBeGreaterThanOrEqual(name.y + name.height);
  const size = locator => locator.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(await size(first.locator('.detail'))).toBeLessThan(await size(first.locator('.name')));
  await expect(page.locator('body')).not.toContainText('WSCH');
  await expect(page.locator('body')).not.toContainText(/Vanilla \d/);
  expect(fileRequests).toEqual([]);
});

test('a type name shows exactly as written', async ({ page }) => {
  const served = index(1);
  served.puzzles[0].type = 'Mirra?e';
  await serve(page, served);
  await page.goto('/app/');
  await expect(page.locator('.tiles .tile .detail .line')).toHaveText(['Mirra?e', '1 Jan 2026']);
});

test('up to 24 puzzles fit one page, with no pager', async ({ page }) => {
  await serve(page, index(24));
  await page.goto('/app/');
  await expect(page.locator('.tiles .tile')).toHaveCount(24);
  await expect(page.locator('#pager button')).toHaveCount(0);
});

test('more than 24 puzzles page 24 at a time, newest first', async ({ page }) => {
  await serve(page, index(30));
  await page.goto('/app/');
  const names = page.locator('.tiles .tile .name');
  await expect(names).toHaveCount(24);
  await expect(names.first()).toHaveText('Puzzle 30');
  await expect(names.last()).toHaveText('Puzzle 7');

  const pager = page.locator('#pager');
  await expect(pager.locator('button')).toHaveText(['‹', '1', '2', '›']);
  await expect(pager.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  await expect(pager.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');

  await pager.getByRole('button', { name: 'Next page' }).click();
  await expect(names).toHaveText(['Puzzle 6', 'Puzzle 5', 'Puzzle 4', 'Puzzle 3', 'Puzzle 2', 'Puzzle 1']);
  await expect(pager.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  await expect(pager.getByRole('button', { name: 'Next page' })).toBeDisabled();

  await pager.getByRole('button', { name: 'Page 1' }).click();
  await expect(names.first()).toHaveText('Puzzle 30');
});

test('every tile is the same height, whether its title takes one line or wraps', async ({ page }) => {
  const served = index(30);
  served.puzzles.find(p => p.hiddenId === 'WSCH-0028').title = 'Musical Instruments';
  await serve(page, served);
  await page.goto('/app/');
  const heights = () => page.locator('.tiles .tile').evaluateAll(tiles => tiles.map(t => t.getBoundingClientRect().height));
  await expect(page.locator('.tiles .tile')).toHaveCount(24);
  const wrapped = await heights();
  expect(new Set(wrapped).size).toBe(1);

  await page.locator('#pager').getByRole('button', { name: 'Page 2' }).click();
  await expect(page.locator('.tiles .tile')).toHaveCount(6);
  expect(await heights()).toEqual(Array(6).fill(wrapped[0]));
});

test('clicking a tile opens that puzzle\'s play page at its hidden ID', async ({ page }) => {
  await serve(page, index(30));
  await page.goto('/app/');
  await page.locator('#pager').getByRole('button', { name: 'Page 2' }).click();
  const tile = page.locator('.tiles .tile').first();
  await expect(tile).toHaveAttribute('href', 'play.html?id=WSCH-0006');
  await tile.click();
  await expect(page).toHaveURL(/\/app\/play\.html\?id=WSCH-0006$/);
});

test('Wordsearches in the burger menu brings you back to the grid', async ({ page }) => {
  await serve(page, index(3));
  await page.goto('/app/');
  await page.locator('.site .burger').click();
  await page.locator('#site-menu').getByText('Wordsearches').click();
  await expect(page).toHaveURL(/\/app\/index\.html$/);
  await expect(page.locator('.tiles .tile')).toHaveCount(3);
});

test('the real wordsearch index loads', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#total')).toHaveText(/^\d+ puzzles?$/);
});
