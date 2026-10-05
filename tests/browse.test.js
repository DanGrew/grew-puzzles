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
  // The heading, the filter and sort row, the grid and the pager — nothing else; signed out, the
  // Continue playing rail never shows.
  await expect(page.locator('main > :not([hidden])')).toHaveCount(4);
  await expect(page.locator('main > #rail')).toBeHidden();
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
// The filters live in a popup the Filters button opens: a chip per type, and a name per difficulty.
const filterButton = page => page.locator('#filter-button');
const popup = page => page.locator('#filters');
const chip = (page, name) => popup(page).getByRole('button', { name, exact: true, includeHidden: true });
const chips = page => popup(page).locator('.chip');
const level = (page, name) => popup(page).locator('.level', { hasText: new RegExp(`^${name}$`) });
async function openFilters(page) {
  await filterButton(page).click();
  await expect(popup(page)).toBeVisible();
}
// Picks a type the way a player does: open the popup, press the type, close the popup.
async function pick(page, name) {
  await openFilters(page);
  await chip(page, name).click();
  await page.keyboard.press('Escape');
  await expect(popup(page)).toBeHidden();
}

test('above the grid, a Filters button then the sort, no type filters showing, none picked', async ({ page }) => {
  await serve(page, mixed(30));
  await page.goto('/app/');
  await expect(page.locator('.controls > :visible')).toHaveCount(3);
  await expect(page.locator('.controls > :visible').first()).toHaveText('Filters');
  await expect(page.locator('.controls > :visible').nth(1)).toHaveClass('sort');
  await expect(chips(page)).toHaveText(['Vanilla', 'Missing', 'Mirra?e']);
  await expect(chips(page).first()).toBeHidden();
  await expect(popup(page).locator('[aria-pressed="true"]')).toHaveCount(0);
  const button = await filterButton(page).boundingBox();
  const grid = await page.locator('#tiles').boundingBox();
  expect(button.y + button.height).toBeLessThanOrEqual(grid.y);
  await expect(page.locator('#sort')).toHaveValue('date');
  await expect(page.locator('#dir')).toHaveText('Newest first');
});

test('the Filters button counts the types picked', async ({ page }) => {
  await serve(page, mixed(9));
  await page.goto('/app/');
  await expect(filterButton(page)).toHaveText('Filters');
  await pick(page, 'Missing');
  await expect(filterButton(page)).toHaveText('Filters · 1');
  await pick(page, 'Vanilla');
  await expect(filterButton(page)).toHaveText('Filters · 2');
});

test('the popup opens over the page without moving the tiles, and closes back to its button', async ({ page }) => {
  await serve(page, mixed(9));
  await page.goto('/app/');
  const before = await page.locator('#tiles').boundingBox();
  await openFilters(page);
  await expect(filterButton(page)).toHaveAttribute('aria-expanded', 'true');
  expect(await page.locator('#tiles').boundingBox()).toEqual(before);
  const box = await popup(page).boundingBox();
  expect(box.y).toBeLessThan(before.y + 20);

  // Pressing outside it.
  await page.mouse.click(5, box.y + box.height + 40);
  await expect(popup(page)).toBeHidden();
  await expect(filterButton(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(filterButton(page)).toBeFocused();

  // Escape, from a type inside it.
  await openFilters(page);
  await chip(page, 'Missing').focus();
  await page.keyboard.press('Escape');
  await expect(popup(page)).toBeHidden();
  await expect(filterButton(page)).toBeFocused();

  // The Filters button again.
  await openFilters(page);
  await filterButton(page).click();
  await expect(popup(page)).toBeHidden();
  await expect(filterButton(page)).toBeFocused();
});

test('pressing the sort while the popup is open closes it and leaves the keyboard on the sort', async ({ page }) => {
  await serve(page, mixed(9));
  await page.goto('/app/');
  await openFilters(page);
  await page.locator('#dir').click();
  await expect(popup(page)).toBeHidden();
  await expect(page.locator('#dir')).toBeFocused();
});

// One puzzle of each type the site has a difficulty for, as the real index holds them.
function graded() {
  const served = index(6);
  ['Vanilla', 'Saga', 'Wildcards', 'Missing', 'Repeats', 'Mirra?e'].forEach((type, i) => { served.puzzles[i].type = type; });
  return served;
}
const rowsOf = page => popup(page).locator('.filter-rows > *').evaluateAll(cells => {
  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push([cells[i].innerText.trim(), [...cells[i + 1].querySelectorAll('.chip')].map(c => c.textContent)]);
  }
  return rows;
});

test('the popup has a row per difficulty, Easy to Extreme, its name on the left and its types A to Z on the right', async ({ page }) => {
  await serve(page, graded());
  await page.goto('/app/');
  await openFilters(page);
  expect(await rowsOf(page)).toEqual([
    ['Easy', ['Vanilla']],
    ['Medium', ['Saga', 'Wildcards']],
    ['Hard', ['Missing', 'Repeats']],
    ['Extreme', ['Mirra?e']],
  ]);
  const lefts = locator => locator.evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().left)));
  const names = await lefts(popup(page).locator('.level'));
  const firsts = await lefts(popup(page).locator('.types .chip:first-child'));
  expect(new Set(names).size).toBe(1);
  expect(new Set(firsts).size).toBe(1);
  expect(firsts[0]).toBeGreaterThan(names[0]);
});

test('each difficulty\'s name is underlined in its colour, the colour of its types\' tile strips', async ({ page }) => {
  await serve(page, graded());
  await page.goto('/app/');
  await openFilters(page);
  const underline = name => level(page, name).evaluate(el => getComputedStyle(el).textDecorationColor);
  const strip = type => page.locator(`.tiles .tile[data-type="${type}"]`).evaluate(el => getComputedStyle(el, '::before').backgroundColor);
  expect(await underline('Easy')).toBe(STRIP.green);
  expect(await underline('Medium')).toBe(STRIP.yellow);
  expect(await underline('Hard')).toBe(STRIP.orange);
  expect(await underline('Extreme')).toBe(STRIP.red);
  expect(await underline('Medium')).toBe(await strip('Saga'));
  expect(await underline('Hard')).toBe(await strip('Repeats'));
  await expect(level(page, 'Easy')).toHaveCSS('text-decoration-line', 'underline');
});

test('pressing a type fills it in its difficulty\'s colour and narrows the tiles at once, the popup staying open', async ({ page }) => {
  await serve(page, mixed(9));
  await page.goto('/app/');
  await openFilters(page);
  await chip(page, 'Missing').click();
  await expect(chip(page, 'Missing')).toHaveCSS('background-color', STRIP.orange);
  await expect(tileTypes(page)).toHaveText(Array(3).fill('Missing'));
  await expect(popup(page)).toBeVisible();
  await expect(page.locator('#apply, button:text-is("Apply")')).toHaveCount(0);
  await chip(page, 'Vanilla').click();
  await expect(chip(page, 'Vanilla')).toHaveCSS('background-color', STRIP.green);
  await expect(tileNames(page)).toHaveText(['Puzzle 8', 'Puzzle 7', 'Puzzle 5', 'Puzzle 4', 'Puzzle 2', 'Puzzle 1']);
  // The popup is never redrawn under the player, so the type just pressed keeps the keyboard.
  await expect(chip(page, 'Vanilla')).toBeFocused();
});

test('a difficulty\'s name picks its whole row, then the rest of it, then unpicks it, never touching other rows', async ({ page }) => {
  await serve(page, graded());
  await page.goto('/app/');
  await openFilters(page);
  await chip(page, 'Vanilla').click();
  await level(page, 'Hard').click();
  await expect(chip(page, 'Missing')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'Repeats')).toHaveAttribute('aria-pressed', 'true');
  await expect(level(page, 'Hard')).toHaveAttribute('aria-pressed', 'true');
  await expect(level(page, 'Hard')).toHaveCSS('background-color', STRIP.orange);
  await expect(tileTypes(page)).toHaveText(['Repeats', 'Missing', 'Vanilla']);

  await level(page, 'Hard').click();
  await expect(popup(page).locator('.chip[aria-pressed="true"]')).toHaveText(['Vanilla']);
  await expect(level(page, 'Hard')).toHaveAttribute('aria-pressed', 'false');

  await chip(page, 'Saga').click();
  await expect(level(page, 'Medium')).toHaveAttribute('aria-pressed', 'false');
  await level(page, 'Medium').click();
  await expect(popup(page).locator('.chip[aria-pressed="true"]')).toHaveText(['Vanilla', 'Saga', 'Wildcards']);
  await expect(level(page, 'Medium')).toHaveAttribute('aria-pressed', 'true');
  await expect(level(page, 'Easy')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\?type=Vanilla&type=Saga&type=Wildcards$/);
});

test('Collections has its own row after Extreme with nothing on the left; Clear filters sits at the bottom while something is picked', async ({ page }) => {
  await serve(page, graded(), [issue()]);
  await page.goto('/app/');
  await openFilters(page);
  expect((await rowsOf(page)).slice(-2)).toEqual([['Extreme', ['Mirra?e']], ['', ['Collections']]]);
  await expect(popup(page).locator('.level:visible')).toHaveCount(4);
  await expect(page.locator('#clear')).toBeHidden();
  await chip(page, 'Collections').click();
  await expect(chip(page, 'Collections')).toHaveCSS('background-color', STRIP.blue);
  await expect(page.locator('#clear')).toBeVisible();
  const clear = await page.locator('#clear').boundingBox();
  const rows = await popup(page).locator('.filter-rows').boundingBox();
  expect(clear.y).toBeGreaterThanOrEqual(rows.y + rows.height);
  await page.locator('#clear').click();
  await expect(page.locator('#clear')).toBeHidden();
  await expect(popup(page)).toBeVisible();
  await expect(page.locator('#total')).toHaveText('6 puzzles · 1 collection');
});

test('a difficulty with no type has no row, and a type with no difficulty sits under Easy, in green', async ({ page }) => {
  const served = index(3);
  ['Vanilla', 'Brand New', 'Mirra?e'].forEach((type, i) => { served.puzzles[i].type = type; });
  await serve(page, served);
  await page.goto('/app/');
  await openFilters(page);
  expect(await rowsOf(page)).toEqual([['Easy', ['Brand New', 'Vanilla']], ['Extreme', ['Mirra?e']]]);
  await chip(page, 'Brand New').click();
  await expect(chip(page, 'Brand New')).toHaveCSS('background-color', STRIP.green);
});

test('on a phone the popup fits the screen, its columns side by side, each name level with its first types', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const served = graded();
  served.puzzles.push(...['Alphabet Soup', 'Backwards', 'Crossover', 'Diagonals'].map((type, i) => ({
    hiddenId: `WSCH-01${i}0`, type, created: '2026-02-01', title: type,
  })));
  await serve(page, served, [issue()]);
  await page.goto('/app/');
  await openFilters(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const box = await popup(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  // Each named row: its name's box, and its types' column and first type's box.
  const rows = await popup(page).locator('.filter-rows > .types').evaluateAll(cells => cells.map(types => {
    const name = types.previousElementSibling.querySelector('.level').getBoundingClientRect();
    const column = types.getBoundingClientRect();
    return { name: { top: name.top, right: name.right }, left: column.left, right: column.right,
      first: types.querySelector('.chip').getBoundingClientRect().top };
  }));
  expect(rows).toHaveLength(5);
  rows.slice(0, 4).forEach(row => {
    expect(row.left).toBeGreaterThanOrEqual(row.name.right);
    expect(row.right).toBeLessThanOrEqual(box.x + box.width);
    expect(Math.abs(row.name.top - row.first)).toBeLessThan(1);
  });
  // Easy wraps: its five types take more than one line, all inside the right column.
  const easy = popup(page).locator('.types').first();
  const tops = await easy.locator('.chip').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBeGreaterThan(1);
  const lefts = await easy.locator('.chip').evaluateAll(els => els.map(el => el.getBoundingClientRect().left));
  lefts.forEach(left => expect(left).toBeGreaterThanOrEqual(rows[0].left));
});

test('picking Missing shows only Missing puzzles, back on page 1', async ({ page }) => {
  await serve(page, mixed(30));
  await page.goto('/app/');
  await page.locator('#pager').getByRole('button', { name: 'Page 2' }).click();
  await pick(page, 'Missing');
  await expect(chip(page, 'Missing')).toHaveAttribute('aria-pressed', 'true');
  await expect(tileTypes(page)).toHaveText(Array(10).fill('Missing'));
  await expect(tileNames(page).first()).toHaveText('Puzzle 29');
  await expect(page.locator('#total')).toHaveText('10 puzzles');
  await expect(page.locator('#pager button')).toHaveCount(0);
});

test('picking two types shows puzzles of either', async ({ page }) => {
  await serve(page, mixed(9));
  await page.goto('/app/');
  await pick(page, 'Missing');
  await pick(page, 'Mirra?e');
  await expect(tileNames(page)).toHaveText(['Puzzle 9', 'Puzzle 8', 'Puzzle 6', 'Puzzle 5', 'Puzzle 3', 'Puzzle 2']);
  await pick(page, 'Missing');
  await expect(tileTypes(page)).toHaveText(Array(3).fill('Mirra?e'));
});

test('clearing the filters shows every puzzle again', async ({ page }) => {
  await serve(page, mixed(30));
  await page.goto('/app/');
  await pick(page, 'Vanilla');
  await expect(page.locator('#total')).toHaveText('10 puzzles');
  await openFilters(page);
  await page.locator('#clear').click();
  await expect(page.locator('#total')).toHaveText('30 puzzles');
  await expect(filterButton(page)).toHaveText('Filters');
  await expect(filterButton(page)).toBeFocused();
  await expect(page.locator('#filters .chip[aria-pressed="true"]')).toHaveCount(0);
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
  await pick(page, 'Vanilla');
  await page.locator('#dir').click();
  await expect(tileNames(page)).toHaveText(['Puzzle 1', 'Puzzle 4', 'Puzzle 7']);
});

test('a filter and a sort survive opening a puzzle and pressing back', async ({ page }) => {
  await serve(page, mixed(9));
  await page.route(/\/puzzles\/.*WSCH-\d+\.json$/, r => r.fulfill({ json: {} }));
  await page.goto('/app/');
  await pick(page, 'Mirra?e');
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

test('a shared link opens with its filter and sort set, the popup closed and the button counting', async ({ page }) => {
  await serve(page, mixed(9));
  await page.goto('/app/?type=Mirra%3Fe&type=Vanilla&sort=title&dir=asc');
  await expect(filterButton(page)).toHaveText('Filters · 2');
  await expect(popup(page)).toBeHidden();
  await expect(page.locator('#filters .chip[aria-pressed="true"]')).toHaveText(['Vanilla', 'Mirra?e']);
  await openFilters(page);
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

test('the Collections filter comes after the types and shows only collections; a type shows none', async ({ page }) => {
  await serve(page, mixed(6), [issue()]);
  await page.goto('/app/');
  await expect(chips(page)).toHaveText(['Vanilla', 'Missing', 'Mirra?e', 'Collections']);
  await pick(page, 'Collections');
  await expect(tileNames(page)).toHaveText(['Issue #1']);
  await expect(page.locator('#total')).toHaveText('1 collection');
  await expect(page).toHaveURL(/\/app\/\?type=Collections$/);
  await pick(page, 'Collections');
  await pick(page, 'Vanilla');
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
  await expect(page.locator('#filters .chip[aria-pressed="true"]')).toHaveText(['Vanilla', 'Mirra?e']);
  await expect(tileNames(page)).toHaveText(['Puzzle 1', 'Puzzle 3', 'Puzzle 4', 'Puzzle 6', 'Puzzle 7', 'Puzzle 9']);
});

test('with no collections, there is no Collections filter and none in the menu', async ({ page }) => {
  await serve(page, mixed(3));
  await page.goto('/app/?type=Collections');
  await expect(chips(page)).toHaveText(['Vanilla', 'Missing', 'Mirra?e']);
  await expect(filterButton(page)).toHaveText('Filters');
  await expect(page.locator('#total')).toHaveText('3 puzzles');
  await page.locator('.site .burger').click();
  await expect(page.locator('#site-menu a:visible')).toHaveText(['Wordsearches', 'About us', 'Privacy']);
});

test('Collections in the burger menu opens the landing page filtered to collections', async ({ page }) => {
  await serve(page, mixed(6), [issue()]);
  await page.goto('/app/');
  await page.locator('.site .burger').click();
  await expect(page.locator('#site-menu a:visible')).toHaveText(['Wordsearches', 'Collections', 'About us', 'Privacy']);
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

// Each type's strip colour, as the browser computes it: green, yellow, orange, red as it gets
// harder, collections blue.
const STRIP = {
  green: 'rgb(159, 216, 174)', yellow: 'rgb(245, 220, 114)', orange: 'rgb(246, 180, 122)',
  red: 'rgb(241, 154, 154)', blue: 'rgb(156, 198, 239)',
};
const COLOUR_OF = {
  Vanilla: STRIP.green, Wildcards: STRIP.yellow, Saga: STRIP.yellow, Missing: STRIP.orange, Repeats: STRIP.orange,
  'Mirra?e': STRIP.red,
};
// Every tile shown, as its title, its first detail line (a puzzle's type, a collection's
// description) and the colour of its strip.
const strips = page => page.locator('.tiles .tile').evaluateAll(tiles => tiles.map(t => ({
  title: t.querySelector('.name').textContent,
  type: t.querySelector('.detail .line').textContent,
  strip: getComputedStyle(t, '::before').backgroundColor,
})));
// One puzzle of each type, Vanilla newest, then a type the site has no colour for.
function everyType() {
  const types = ['Vanilla', 'Wildcards', 'Saga', 'Missing', 'Repeats', 'Mirra?e', 'Brand New'];
  const served = index(types.length);
  served.puzzles.forEach((p, i) => { p.type = types[types.length - 1 - i]; });
  return served;
}

test('a tile\'s strip is coloured by its type\'s difficulty, a collection\'s blue', async ({ page }) => {
  await serve(page, everyType(), [{ ...issue(), created: '2025-12-31' }]);
  await page.goto('/app/');
  await expect(page.locator('.tiles .tile')).toHaveCount(8);
  expect(await strips(page)).toEqual([
    { title: 'Puzzle 7', type: 'Vanilla', strip: STRIP.green },
    { title: 'Puzzle 6', type: 'Wildcards', strip: STRIP.yellow },
    { title: 'Puzzle 5', type: 'Saga', strip: STRIP.yellow },
    { title: 'Puzzle 4', type: 'Missing', strip: STRIP.orange },
    { title: 'Puzzle 3', type: 'Repeats', strip: STRIP.orange },
    { title: 'Puzzle 2', type: 'Mirra?e', strip: STRIP.red },
    { title: 'Puzzle 1', type: 'Brand New', strip: STRIP.green },
    { title: 'Issue #1', type: 'The first book, remade.', strip: STRIP.blue },
  ]);
});

test('the tile green is lighter than the band green, which the heading keeps; a picked type takes the tile green', async ({ page }) => {
  await serve(page, mixed(3));
  await page.goto('/app/');
  await pick(page, 'Vanilla');
  const band = 'rgb(31, 111, 92)';
  await expect(page.locator('.browse-head')).toHaveCSS('background-color', band);
  await expect(chip(page, 'Vanilla')).toHaveCSS('background-color', STRIP.green);
  await expect(chip(page, 'Missing')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const lightness = rgb => rgb.match(/\d+/g).map(Number).reduce((a, b) => a + b);
  expect(lightness(STRIP.green)).toBeGreaterThan(lightness(band) + 200);
});

test('a collection tile and a Saga tile are the same card as every other — no stack behind', async ({ page }) => {
  await serve(page, everyType(), [issue()]);
  await page.goto('/app/');
  const look = locator => locator.evaluate(el => {
    const s = getComputedStyle(el);
    return { shadow: s.boxShadow, border: s.border, radius: s.borderRadius };
  });
  const plain = await look(page.locator('.tiles .tile[data-type="Vanilla"]'));
  expect(await look(collectionTiles(page))).toEqual(plain);
  expect(await look(page.locator('.tiles .tile[data-type="Saga"]'))).toEqual(plain);
  expect(plain.shadow).toBe('rgb(15, 42, 36) 5px 5px 0px 0px');
});

test('filtering, sorting and paging leave every tile its type\'s colour', async ({ page }) => {
  await serve(page, mixed(30), [issue()]);
  await page.goto('/app/');
  const coloured = async () => (await strips(page)).forEach(({ type, strip }) => {
    expect(strip).toBe(COLOUR_OF[type] ?? STRIP.blue);
  });
  await coloured();
  await page.locator('#pager').getByRole('button', { name: 'Page 2' }).click();
  await coloured();
  await page.locator('#sort').selectOption('type');
  await coloured();
  await pick(page, 'Mirra?e');
  await expect(tileTypes(page)).toHaveText(Array(10).fill('Mirra?e'));
  await coloured();
  await pick(page, 'Collections');
  await expect(page.locator('#total')).toHaveText('10 puzzles · 1 collection');
  await coloured();
  expect(new Set((await strips(page)).map(t => t.strip))).toEqual(new Set([STRIP.red, STRIP.blue]));
});
