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

// Collections are served the same way; left out, the site has none — no collections file at all.
async function serve(page, served, collections) {
  const fileRequests = [];
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: served }));
  await page.route('**/content/collections/index.json', r => r.fulfill(
    collections ? { json: { collections } } : { status: 404, body: 'Not found' },
  ));
  await page.route(/\/puzzles\/.*WSCH-\d+\.json$/, r => { fileRequests.push(r.request().url()); return r.abort(); });
  return fileRequests;
}

test('the site opens straight onto the browse grid, with no intro', async ({ page }) => {
  await serve(page, index(3));
  await page.goto('/grew-puzzles/');
  await expect(page.locator('#browse-title')).toHaveText('Wordsearches');
  await expect(page.locator('#total')).toHaveText('3 puzzles');
  await expect(page.locator('.tiles .tile')).toHaveCount(3);
  // The heading, the filter and sort row, the grid and the pager — nothing else.
  await expect(page.locator('main > *')).toHaveCount(4);
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

// A mixed index: puzzle n was saved n days into the year and takes its type in turn — Vanilla,
// Missing, Mirra?e, Vanilla, … — so 30 puzzles are 10 of each.
function mixed(count) {
  const served = index(count);
  const types = ['Vanilla', 'Missing', 'Mirra?e'];
  served.puzzles.forEach((p, i) => { p.type = types[i % 3]; });
  return served;
}

const tileNames = page => page.locator('.tiles .tile .name');
const tileTypes = page => page.locator('.tiles .tile .detail .line:first-child');
const chip = (page, name) => page.locator('#filters').getByRole('button', { name, exact: true });

test('above the grid, a filter for each type a puzzle has, none picked', async ({ page }) => {
  await serve(page, mixed(30));
  await page.goto('/app/');
  await expect(page.locator('#filters button')).toHaveText(['Mirra?e', 'Missing', 'Vanilla']);
  await expect(page.locator('#filters button[aria-pressed="false"]')).toHaveCount(3);
  await expect(page.locator('#clear')).toBeHidden();
  const filters = await page.locator('#filters').boundingBox();
  const grid = await page.locator('#tiles').boundingBox();
  expect(filters.y + filters.height).toBeLessThanOrEqual(grid.y);
  await expect(page.locator('#sort')).toHaveValue('date');
  await expect(page.locator('#dir')).toHaveText('Newest first');
});

test('picking Missing shows only Missing puzzles, back on page 1', async ({ page }) => {
  await serve(page, mixed(30));
  await page.goto('/app/');
  await page.locator('#pager').getByRole('button', { name: 'Page 2' }).click();
  await chip(page, 'Missing').click();
  await expect(chip(page, 'Missing')).toHaveAttribute('aria-pressed', 'true');
  await expect(tileTypes(page)).toHaveText(Array(10).fill('Missing'));
  await expect(tileNames(page).first()).toHaveText('Puzzle 29');
  await expect(page.locator('#total')).toHaveText('10 puzzles');
  await expect(page.locator('#pager button')).toHaveCount(0);
});

test('picking two types shows puzzles of either', async ({ page }) => {
  await serve(page, mixed(9));
  await page.goto('/app/');
  await chip(page, 'Missing').click();
  await chip(page, 'Mirra?e').click();
  await expect(tileNames(page)).toHaveText(['Puzzle 9', 'Puzzle 8', 'Puzzle 6', 'Puzzle 5', 'Puzzle 3', 'Puzzle 2']);
  await chip(page, 'Missing').click();
  await expect(tileTypes(page)).toHaveText(Array(3).fill('Mirra?e'));
});

test('clearing the filters shows every puzzle again', async ({ page }) => {
  await serve(page, mixed(30));
  await page.goto('/app/');
  await chip(page, 'Vanilla').click();
  await expect(page.locator('#total')).toHaveText('10 puzzles');
  await page.locator('#clear').click();
  await expect(page.locator('#total')).toHaveText('30 puzzles');
  await expect(page.locator('#filters button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('#clear')).toBeHidden();
  await expect(page).toHaveURL(/\/app\/$/);
});

test('picking a sort and a direction reorders, back on page 1', async ({ page }) => {
  const served = index(30);
  served.puzzles.find(p => p.hiddenId === 'WSCH-0005').title = 'Apples';
  await serve(page, served);
  await page.goto('/app/');
  await page.locator('#pager').getByRole('button', { name: 'Page 2' }).click();
  await page.locator('#sort').selectOption('title');
  await expect(page.locator('#dir')).toHaveText('Z to A');
  await expect(tileNames(page).first()).toHaveText('Puzzle 9');
  await expect(page.locator('#pager').getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  await page.locator('#dir').click();
  await expect(page.locator('#dir')).toHaveText('A to Z');
  await expect(tileNames(page).first()).toHaveText('Apples');
  await page.locator('#sort').selectOption('date');
  await expect(page.locator('#dir')).toHaveText('Oldest first');
  await expect(tileNames(page).first()).toHaveText('Puzzle 1');
});

test('sorting by type groups the types, ties newest first', async ({ page }) => {
  await serve(page, mixed(6));
  await page.goto('/app/');
  await page.locator('#sort').selectOption('type');
  await page.locator('#dir').click();
  await expect(tileTypes(page)).toHaveText(['Mirra?e', 'Mirra?e', 'Missing', 'Missing', 'Vanilla', 'Vanilla']);
  await expect(tileNames(page)).toHaveText(['Puzzle 6', 'Puzzle 3', 'Puzzle 5', 'Puzzle 2', 'Puzzle 4', 'Puzzle 1']);
});

test('sorting and filtering together shows the filtered puzzles in the chosen order', async ({ page }) => {
  await serve(page, mixed(9));
  await page.goto('/app/');
  await chip(page, 'Vanilla').click();
  await page.locator('#dir').click();
  await expect(tileNames(page)).toHaveText(['Puzzle 1', 'Puzzle 4', 'Puzzle 7']);
});

test('a filter and a sort survive opening a puzzle and pressing back', async ({ page }) => {
  await serve(page, mixed(9));
  await page.route(/\/puzzles\/.*WSCH-\d+\.json$/, r => r.fulfill({ json: {} }));
  await page.goto('/app/');
  await chip(page, 'Mirra?e').click();
  await page.locator('#sort').selectOption('title');
  await page.locator('#dir').click();
  await expect(page).toHaveURL(/\?type=Mirra%3Fe&sort=title&dir=asc$/);
  await page.locator('.tiles .tile').first().click();
  await expect(page).toHaveURL(/play\.html/);
  await page.goBack();
  await expect(chip(page, 'Mirra?e')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sort')).toHaveValue('title');
  await expect(page.locator('#dir')).toHaveText('A to Z');
  await expect(tileNames(page)).toHaveText(['Puzzle 3', 'Puzzle 6', 'Puzzle 9']);
});

test('a shared link opens with its filter and sort set', async ({ page }) => {
  await serve(page, mixed(9));
  await page.goto('/app/?type=Mirra%3Fe&type=Vanilla&sort=title&dir=asc');
  await expect(page.locator('#filters button[aria-pressed="true"]')).toHaveText(['Mirra?e', 'Vanilla']);
  await expect(page.locator('#clear')).toBeVisible();
  await expect(tileNames(page)).toHaveText(['Puzzle 1', 'Puzzle 3', 'Puzzle 4', 'Puzzle 6', 'Puzzle 7', 'Puzzle 9']);
});

test('the real wordsearch index loads', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#total')).toHaveText(/^\d+ puzzles?( · \d+ collections?)?$/);
});

// A collection of puzzles 1, 2 and 4 of the mixed index — 2 Vanilla and 1 Missing — numbered
// backwards, written on 5 January, the day of puzzle 5.
function issue() {
  return {
    slug: 'issue-1', name: 'Issue #1', description: 'The first book, remade.', created: '2026-01-05',
    puzzles: [{ id: 'WSCH-0001', number: 3 }, { id: 'WSCH-0002', number: 2 }, { id: 'WSCH-0004', number: 1 }],
  };
}
const collectionTiles = page => page.locator('.tiles .tile.collection');

test('a collection tile sits among the puzzles, with its name, description and type breakdown', async ({ page }) => {
  const fileRequests = await serve(page, mixed(6), [issue()]);
  await page.goto('/app/');
  await expect(tileNames(page)).toHaveText(['Puzzle 6', 'Puzzle 5', 'Issue #1', 'Puzzle 4', 'Puzzle 3', 'Puzzle 2', 'Puzzle 1']);
  const tile = collectionTiles(page);
  await expect(tile).toHaveCount(1);
  await expect(tile.locator('.name')).toHaveText('Issue #1');
  await expect(tile.locator('.detail .line')).toHaveText(['The first book, remade.', '2 Vanilla · 1 Missing']);
  await expect(page.locator('#total')).toHaveText('6 puzzles · 1 collection');
  expect(fileRequests).toEqual([]);
});

test('a puzzle shows once in browse, however many collections hold it', async ({ page }) => {
  const again = { ...issue(), slug: 'again', name: 'Again', puzzles: [{ id: 'WSCH-0001', number: 1 }] };
  await serve(page, mixed(4), [issue(), again]);
  await page.goto('/app/');
  await expect(page.locator('.tiles .tile:not(.collection) .name')).toHaveText(['Puzzle 4', 'Puzzle 3', 'Puzzle 2', 'Puzzle 1']);
  await expect(collectionTiles(page).locator('.name')).toHaveText(['Again', 'Issue #1']);
  await expect(page.locator('.tiles .tile .number')).toHaveCount(0);
});

test('the Collections filter comes first and shows only collections; a type shows none', async ({ page }) => {
  await serve(page, mixed(6), [issue()]);
  await page.goto('/app/');
  await expect(page.locator('#filters button')).toHaveText(['Collections', 'Mirra?e', 'Missing', 'Vanilla']);
  await chip(page, 'Collections').click();
  await expect(tileNames(page)).toHaveText(['Issue #1']);
  await expect(page.locator('#total')).toHaveText('1 collection');
  await expect(page).toHaveURL(/\/app\/\?type=Collections$/);
  await chip(page, 'Collections').click();
  await chip(page, 'Vanilla').click();
  await expect(tileNames(page)).toHaveText(['Puzzle 4', 'Puzzle 1']);
  await expect(collectionTiles(page)).toHaveCount(0);
});

test('collections sort by name among titles, together as Collection by type, and by created date', async ({ page }) => {
  const served = mixed(6);
  served.puzzles[0].title = 'Apples';
  await serve(page, served, [issue()]);
  await page.goto('/app/?sort=title&dir=asc');
  await expect(tileNames(page)).toHaveText(['Apples', 'Issue #1', 'Puzzle 2', 'Puzzle 3', 'Puzzle 4', 'Puzzle 5', 'Puzzle 6']);
  await page.locator('#sort').selectOption('type');
  // Collection, then Mirra?e, Missing and Vanilla, each newest first.
  await expect(tileNames(page)).toHaveText(['Issue #1', 'Puzzle 6', 'Puzzle 3', 'Puzzle 5', 'Puzzle 2', 'Puzzle 4', 'Apples']);
  await page.locator('#sort').selectOption('date');
  await expect(page.locator('#dir')).toHaveText('Oldest first');
  // Puzzle 5 shares the collection's day, and a tie goes to the puzzle.
  await expect(tileNames(page)).toHaveText(['Apples', 'Puzzle 2', 'Puzzle 3', 'Puzzle 4', 'Puzzle 5', 'Issue #1', 'Puzzle 6']);
});

test('a link from before collections opens as it always did', async ({ page }) => {
  await serve(page, mixed(9), [issue()]);
  await page.goto('/app/?type=Mirra%3Fe&type=Vanilla&sort=title&dir=asc');
  await expect(page.locator('#filters button[aria-pressed="true"]')).toHaveText(['Mirra?e', 'Vanilla']);
  await expect(tileNames(page)).toHaveText(['Puzzle 1', 'Puzzle 3', 'Puzzle 4', 'Puzzle 6', 'Puzzle 7', 'Puzzle 9']);
});

test('with no collections, there is no Collections filter and none in the menu', async ({ page }) => {
  await serve(page, mixed(3));
  await page.goto('/app/?type=Collections');
  await expect(page.locator('#filters button')).toHaveText(['Mirra?e', 'Missing', 'Vanilla']);
  await expect(page.locator('#total')).toHaveText('3 puzzles');
  await page.locator('.site .burger').click();
  await expect(page.locator('#site-menu a:visible')).toHaveText(['Wordsearches']);
});

test('Collections in the burger menu opens the landing page filtered to collections', async ({ page }) => {
  await serve(page, mixed(6), [issue()]);
  await page.goto('/app/');
  await page.locator('.site .burger').click();
  await expect(page.locator('#site-menu a:visible')).toHaveText(['Wordsearches', 'Collections']);
  await page.locator('#site-menu').getByText('Collections').click();
  await expect(page).toHaveURL(/\/app\/index\.html\?type=Collections$/);
  await expect(chip(page, 'Collections')).toHaveAttribute('aria-pressed', 'true');
  await expect(tileNames(page)).toHaveText(['Issue #1']);
});

test('tapping a collection tile opens its collection page', async ({ page }) => {
  await serve(page, mixed(6), [issue()]);
  await page.goto('/app/');
  await collectionTiles(page).click();
  await expect(page).toHaveURL(/\/app\/collection\.html\?slug=issue-1$/);
  await expect(page.locator('#collection-title')).toHaveText('Issue #1');
});
