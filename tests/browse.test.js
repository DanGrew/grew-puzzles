const { test, expect } = require('@playwright/test');

// Stand-in collections: the browse page reads only the index and each manifest, so these are
// served in place of the real ones — no puzzle file is ever needed.
function manifest(count, name = 'Vanilla', collection = 'vanilla') {
  const puzzles = Array.from({ length: count }, (_, i) => ({
    publicId: count - i, title: `Puzzle ${count - i}`, file: `${String(count - i).padStart(4, '0')}.json`,
  }));
  return { collection, name, puzzles };
}

async function serve(page, vanilla) {
  const fileRequests = [];
  await page.route('**/puzzles/collections.json', r => r.fulfill({ json: { collections: ['vanilla', 'other'] } }));
  await page.route('**/puzzles/vanilla/manifest.json', r => r.fulfill({ json: vanilla }));
  await page.route('**/puzzles/other/manifest.json', r => r.fulfill({ json: manifest(3, 'Other', 'other') }));
  await page.route(/\/puzzles\/.*\d{4}\.json$/, r => { fileRequests.push(r.request().url()); return r.abort(); });
  return fileRequests;
}

test('the site opens straight onto the browse grid, with no intro', async ({ page }) => {
  await serve(page, manifest(3));
  await page.goto('/grew-puzzles/');
  await expect(page.locator('#browse-title')).toHaveText('Vanilla');
  await expect(page.locator('#total')).toHaveText('3 puzzles');
  await expect(page.locator('.tiles .tile')).toHaveCount(3);
  await expect(page.locator('main > *')).toHaveCount(3);
});

test('a tile shows the title and public ID, never the hidden ID', async ({ page }) => {
  const fileRequests = await serve(page, manifest(3));
  await page.goto('/app/');
  const first = page.locator('.tiles .tile').first();
  await expect(first.locator('.id')).toHaveText('Vanilla 1');
  await expect(first.locator('.name')).toHaveText('Puzzle 1');
  await expect(page.locator('body')).not.toContainText('WSCH');
  expect(fileRequests).toEqual([]);
});

test('only Vanilla shows, though the index names another collection', async ({ page }) => {
  await serve(page, manifest(3));
  await page.goto('/app/');
  await expect(page.locator('.tiles .tile')).toHaveCount(3);
  await expect(page.locator('body')).not.toContainText('Other');
});

test('up to 24 puzzles fit one page, with no pager', async ({ page }) => {
  await serve(page, manifest(24));
  await page.goto('/app/');
  await expect(page.locator('.tiles .tile')).toHaveCount(24);
  await expect(page.locator('#pager button')).toHaveCount(0);
});

test('more than 24 puzzles page 24 at a time, ordered by public ID', async ({ page }) => {
  await serve(page, manifest(30));
  await page.goto('/app/');
  const ids = page.locator('.tiles .tile .id');
  await expect(ids).toHaveCount(24);
  await expect(ids.first()).toHaveText('Vanilla 1');
  await expect(ids.last()).toHaveText('Vanilla 24');

  const pager = page.locator('#pager');
  await expect(pager.locator('button')).toHaveText(['‹', '1', '2', '›']);
  await expect(pager.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  await expect(pager.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');

  await pager.getByRole('button', { name: 'Next page' }).click();
  await expect(ids).toHaveText(['Vanilla 25', 'Vanilla 26', 'Vanilla 27', 'Vanilla 28', 'Vanilla 29', 'Vanilla 30']);
  await expect(pager.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  await expect(pager.getByRole('button', { name: 'Next page' })).toBeDisabled();

  await pager.getByRole('button', { name: 'Page 1' }).click();
  await expect(ids.first()).toHaveText('Vanilla 1');
});

test('clicking a tile opens that puzzle\'s play page', async ({ page }) => {
  await serve(page, manifest(30));
  await page.goto('/app/');
  await page.locator('#pager').getByRole('button', { name: 'Page 2' }).click();
  const tile = page.locator('.tiles .tile').first();
  await expect(tile).toHaveAttribute('href', 'play.html?collection=vanilla&id=25');
  await tile.click();
  await expect(page).toHaveURL(/\/app\/play\.html\?collection=vanilla&id=25$/);
});

test('Wordsearches in the burger menu brings you back to the grid', async ({ page }) => {
  await serve(page, manifest(3));
  await page.goto('/app/');
  await page.locator('.site .burger').click();
  await page.locator('#site-menu').getByText('Wordsearches').click();
  await expect(page).toHaveURL(/\/app\/index\.html$/);
  await expect(page.locator('.tiles .tile')).toHaveCount(3);
});

test('the real Vanilla manifest loads', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#browse-title')).toHaveText('Vanilla');
  await expect(page.locator('#total')).toHaveText(/^\d+ puzzles?$/);
});
