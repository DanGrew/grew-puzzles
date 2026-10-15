const { test, expect } = require('@playwright/test');

// The site split by kind (TASK-96): the kind is where the player is — Wordsearches, Mazes,
// Minesweeper (TASK-135), Criss-cross (TASK-149) or Mosaic (TASK-165), from the side bar or, on a phone, the switch above
// the grid — and the type
// is what they filter within it. The indexes are stand-ins; every puzzle file asked for is counted,
// and none ever should be.

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
// A minesweeper board's index entry carries the owner's difficulty and its size, as a maze's does.
const BOARDS = [
  { ...puzzle('MINE', 1, 'Vanilla', 'Garden Patch'), ...saved('Easy', 10, 10) },
  { ...puzzle('MINE', 2, 'Vanilla', 'Big Field'), ...saved('Hard', 40, 40) },
];
// A criss-cross's index entry carries the owner's difficulty and its size, as a board's does, and
// its word count.
const CRISSES = [
  { ...puzzle('CRSS', 1, 'Vanilla', 'Big Holiday'), ...saved('Hard', 29, 30), wordCount: 60 },
  { ...puzzle('CRSS', 2, 'Vanilla', 'Summer Holidays'), ...saved('Easy', 17, 15), wordCount: 20 },
];
// A mosaic's index entry carries its difficulty and its size, as a board's does — a board follows
// its picture's shape, so not always square. Its picture's name is the finish's alone; Mosaic 002's
// carries one here so the tile is seen never to show it.
const MOSAICS = [
  { ...puzzle('MOSA', 1, 'Vanilla', 'Mosaic 001'), ...saved('Hard', 50, 38) },
  { ...puzzle('MOSA', 2, 'Vanilla', 'Mosaic 002'), ...saved('Easy', 50, 50), name: 'Robot 20' },
  { ...puzzle('MOSA', 3, 'Vanilla', 'Mosaic 003'), ...saved('Medium', 200, 200) },
];

async function serve(page) {
  const fileRequests = [];
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: { puzzles: WORDSEARCHES } }));
  await page.route('**/content/puzzles/maze/index.json', r => r.fulfill({ json: { puzzles: MAZES } }));
  await page.route('**/content/puzzles/minesweeper/index.json', r => r.fulfill({ json: { puzzles: BOARDS } }));
  await page.route('**/content/puzzles/crisscross/index.json', r => r.fulfill({ json: { puzzles: CRISSES } }));
  await page.route('**/content/puzzles/mosaic/index.json', r => r.fulfill({ json: { puzzles: MOSAICS } }));
  await page.route('**/content/collections/index.json', r => r.fulfill({ status: 404, body: 'Not found' }));
  await page.route(/\/puzzles\/.*(WSCH|MAZE|MINE|CRSS|MOSA)-\d+\.json$/, r => { fileRequests.push(r.request().url()); return r.abort(); });
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

test('sorted by difficulty, the Hard Vanilla maze sits among the Hard mazes, leading them as Vanilla leads the Type filter', async ({ page }) => {
  await serve(page);
  await page.goto('/app/?kind=maze');
  await expect(names(page)).toHaveText(['Secret Code', 'Gold Rush', 'Plain Path', 'Key Keeper', 'Locked Out', 'Grand Finale']);
});

test('every maze tile reads its size under its type, and no date; one saved before the size has none', async ({ page }) => {
  await serve(page);
  await page.goto('/app/?kind=maze');
  const lines = title => page.locator('#tiles .tile', { hasText: title }).locator('.detail .line');
  await expect(lines('Plain Path')).toHaveText(['Vanilla', '100×100']);
  await expect(lines('Locked Out')).toHaveText(['Keys', '48×60']);
  await expect(lines('Key Keeper')).toHaveText(['Keys']);
  await page.goto('/app/');
  await expect(page.locator('#tiles .tile').first().locator('.detail .line')).toHaveText(['Vanilla']);
});

test('an address naming a difficulty, a type or both opens on exactly that', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await serve(page);
  await page.goto('/app/?kind=maze&difficulty=Hard');
  await expect(names(page)).toHaveText(['Plain Path', 'Key Keeper', 'Locked Out']);
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

// TASK-135: Minesweeper is the third kind, everything the other two have.
test('the side bar reads Wordsearches, Mazes, Minesweeper, Criss-cross, Mosaic and Collections, Minesweeper with its count and its Vanilla dot', async ({ page }) => {
  await serve(page);
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [
    { slug: 'mix', name: 'Mix', description: '', created: '2026-10-09', puzzles: [{ id: 'MINE-0001', number: 1 }] },
  ] } }));
  await page.goto('/app/');
  await expect(side(page).locator('.kind')).toHaveText(['Wordsearches3', 'Mazes6', 'Minesweeper2', 'Criss-cross2', 'Mosaic3', 'Collections1', 'Scorecard']);
  const vanilla = side(page).locator('.types').nth(2).locator('.type');
  await expect(vanilla).toHaveText(['Vanilla']);
  await expect(vanilla.locator('.dot')).toHaveCSS('background-color', 'rgb(159, 216, 174)');
});

test('Minesweeper shows only boards, easiest first, and Filters picks their difficulty and type as for any kind', async ({ page }) => {
  const fileRequests = await serve(page);
  await page.goto('/app/');
  await side(page).locator('.kind', { hasText: 'Minesweeper' }).click();
  await expect(page).toHaveURL(/\/app\/index\.html\?kind=minesweeper$/);
  await expect(page.locator('#browse-title')).toHaveText('Minesweeper');
  await expect(names(page)).toHaveText(['Garden Patch', 'Big Field']);
  await expect(current(page)).toHaveText(['Minesweeper2']);
  await page.locator('#filter-button').click();
  expect(await rowsOf(page)).toEqual([['Difficulty', ['Easy', 'Hard']], ['Type', ['Vanilla']]]);
  await page.locator('#filters').getByRole('button', { name: 'Hard', exact: true }).click();
  await expect(names(page)).toHaveText(['Big Field']);
  await expect(page).toHaveURL(/\?kind=minesweeper&difficulty=Hard$/);
  await side(page).locator('.types').nth(2).locator('.type', { hasText: 'Vanilla' }).click();
  await expect(page).toHaveURL(/\?kind=minesweeper&type=Vanilla$/);
  await expect(names(page)).toHaveText(['Garden Patch', 'Big Field']);
  await expect(current(page)).toHaveText(['Minesweeper2', 'Vanilla']);
  expect(fileRequests).toEqual([]);
});

// A Reveal board (TASK-174) is its own type under Minesweeper: the index says so, and the page reads
// nothing else.
const REVEAL = { ...puzzle('MINE', 3, 'Reveal', 'Reveal 001'), ...saved('Medium', 16, 12) };

test('Minesweeper\'s filters offer Vanilla then Reveal; a Reveal tile wears the board picture with a corner covered, its type and size, and opens the minesweeper page', async ({ page }) => {
  const fileRequests = await serve(page);
  await page.route('**/content/puzzles/minesweeper/index.json', r => r.fulfill({ json: { puzzles: [...BOARDS, REVEAL] } }));
  await page.goto('/app/?kind=minesweeper');
  await expect(names(page)).toHaveText(['Garden Patch', 'Reveal 001', 'Big Field']);
  await page.locator('#filter-button').click();
  expect(await rowsOf(page)).toEqual([['Difficulty', ['Easy', 'Medium', 'Hard']], ['Type', ['Vanilla', 'Reveal']]]);
  await page.locator('#filters').getByRole('button', { name: 'Reveal', exact: true }).click();
  await expect(names(page)).toHaveText(['Reveal 001']);
  await expect(page).toHaveURL(/\?kind=minesweeper&type=Reveal$/);
  const tile = page.locator('#tiles .tile', { hasText: 'Reveal 001' });
  await expect(tile.locator('.detail .line')).toHaveText(['Reveal', '16×12']);
  await expect(tile).toHaveAttribute('href', 'minesweeper.html?id=MINE-0003');
  await expect(tile).toHaveAttribute('data-tone', 'Medium');
  const pictures = await page.locator('#tiles .tile .pic svg').evaluateAll(svgs => svgs.map(s => s.outerHTML));
  await page.goto('/app/?kind=minesweeper&type=Vanilla');
  await expect(names(page)).toHaveCount(2);
  const vanilla = await page.locator('#tiles .tile .pic svg').first().evaluate(s => s.outerHTML);
  expect(pictures[0]).not.toBe(vanilla);
  // Covered squares are shaded, and of the board's two mines only the marked one shows.
  await page.goto('/app/?kind=minesweeper&type=Reveal');
  await expect(page.locator('#tiles .tile .pic svg path[opacity=".22"]')).toHaveCount(1);
  await expect(page.locator('#tiles .tile .pic svg circle')).toHaveCount(1);
  await expect(side(page).locator('.types').nth(2).locator('.type')).toHaveText(['Vanilla', 'Reveal']);
  expect(fileRequests).toEqual([]);
});

// A Keys board (TASK-177) is its own type too, and Minesweeper's types build up: Vanilla, Reveal,
// Keys, Limited Flags — whichever order the index lists them in.
const KEYS = { ...puzzle('MINE', 4, 'Keys', 'Keys 001'), ...saved('Easy', 6, 6) };
const FEW_FLAGS = { ...puzzle('MINE', 5, 'Limited Flags', 'Limited Flags 001'), ...saved('Hard', 10, 10) };

test('Minesweeper\'s filters offer Vanilla, Reveal, Keys and Limited Flags; a Keys tile wears a Reveal board\'s picture and opens the minesweeper page', async ({ page }) => {
  const fileRequests = await serve(page);
  await page.route('**/content/puzzles/minesweeper/index.json', r => r.fulfill({ json: { puzzles: [FEW_FLAGS, KEYS, ...BOARDS, REVEAL] } }));
  await page.goto('/app/?kind=minesweeper');
  await page.locator('#filter-button').click();
  expect(await rowsOf(page)).toEqual([['Difficulty', ['Easy', 'Medium', 'Hard']], ['Type', ['Vanilla', 'Reveal', 'Keys', 'Limited Flags']]]);
  await expect(side(page).locator('.types').nth(2).locator('.type')).toHaveText(['Vanilla', 'Reveal', 'Keys', 'Limited Flags']);
  await page.locator('#filters').getByRole('button', { name: 'Keys', exact: true }).click();
  await expect(names(page)).toHaveText(['Keys 001']);
  await expect(page).toHaveURL(/\?kind=minesweeper&type=Keys$/);
  const tile = page.locator('#tiles .tile', { hasText: 'Keys 001' });
  await expect(tile.locator('.detail .line')).toHaveText(['Keys', '6×6']);
  await expect(tile).toHaveAttribute('href', 'minesweeper.html?id=MINE-0004');
  const keys = await tile.locator('.pic svg').evaluate(s => s.outerHTML);
  await page.goto('/app/?kind=minesweeper&type=Reveal');
  expect(await page.locator('#tiles .tile .pic svg').first().evaluate(s => s.outerHTML)).toBe(keys);
  expect(fileRequests).toEqual([]);
});

// A Canaries board (TASK-204) is its own type too, straight after Reveal, every one Hard or Extreme;
// its index entry carries its canaries (tooling's TASK-202), which its tile reads in its size's place.
const CANARIES = [
  { ...puzzle('MINE', 6, 'Canaries', 'Canaries 001'), ...saved('Hard', 10, 10), canaries: 2 },
  { ...puzzle('MINE', 7, 'Canaries', 'Canaries 002'), ...saved('Extreme', 16, 16), canaries: 1 },
];

test('Minesweeper lists Canaries after Reveal; filtered to it, only its Hard and Extreme boards show, each wearing a Reveal board\'s picture and reading its canaries', async ({ page }) => {
  const fileRequests = await serve(page);
  await page.route('**/content/puzzles/minesweeper/index.json', r => r.fulfill({ json: { puzzles: [FEW_FLAGS, ...CANARIES, KEYS, ...BOARDS, REVEAL] } }));
  await page.goto('/app/?kind=minesweeper');
  await expect(side(page).locator('.kind', { hasText: 'Minesweeper' })).toHaveText('Minesweeper7');
  await expect(side(page).locator('.types').nth(2).locator('.type')).toHaveText(['Vanilla', 'Reveal', 'Canaries', 'Keys', 'Limited Flags']);
  await page.locator('#filter-button').click();
  expect(await rowsOf(page)).toEqual([['Difficulty', ['Easy', 'Medium', 'Hard', 'Extreme']], ['Type', ['Vanilla', 'Reveal', 'Canaries', 'Keys', 'Limited Flags']]]);
  await page.locator('#filters').getByRole('button', { name: 'Canaries', exact: true }).click();
  await expect(names(page)).toHaveText(['Canaries 001', 'Canaries 002']);
  await expect(page).toHaveURL(/\?kind=minesweeper&type=Canaries$/);
  expect(await page.locator('#tiles .tile').evaluateAll(tiles => tiles.map(t => t.dataset.tone))).toEqual(['Hard', 'Extreme']);
  const tile = page.locator('#tiles .tile', { hasText: 'Canaries 001' });
  await expect(tile.locator('.detail .line')).toHaveText(['Canaries', '🐤 2']);
  await expect(page.locator('#tiles .tile', { hasText: 'Canaries 002' }).locator('.detail .line')).toHaveText(['Canaries', '🐤 1']);
  await expect(tile).toHaveAttribute('href', 'minesweeper.html?id=MINE-0006');
  const canaries = await tile.locator('.pic svg').evaluate(s => s.outerHTML);
  // From the side bar, Canaries opens the kind filtered to it alone, and is what the page is current for.
  await page.goto('/app/?kind=minesweeper&type=Reveal');
  expect(await page.locator('#tiles .tile .pic svg').first().evaluate(s => s.outerHTML)).toBe(canaries);
  await side(page).locator('.types').nth(2).locator('.type', { hasText: 'Canaries' }).click();
  await expect(page).toHaveURL(/\/app\/index\.html\?kind=minesweeper&type=Canaries$/);
  await expect(current(page)).toHaveText(['Minesweeper7', 'Canaries']);
  expect(fileRequests).toEqual([]);
});

test('a board\'s tile wears the minesweeper picture, reads its size as a maze tile does, and opens the minesweeper page', async ({ page }) => {
  const fileRequests = await serve(page);
  await page.goto('/app/?kind=maze');
  await expect(names(page)).toHaveCount(6);
  const maze = await page.locator('#tiles .tile .pic svg').first().evaluate(s => s.outerHTML);
  await page.goto('/app/?kind=minesweeper');
  await expect(names(page)).toHaveCount(2);
  const boards = await page.locator('#tiles .tile .pic svg').evaluateAll(svgs => svgs.map(s => s.outerHTML));
  expect(new Set(boards).size).toBe(1);
  expect(boards[0]).not.toBe(maze);
  expect(boards[0]).toContain('<text');
  await expect(page.locator('#tiles .tile .pic svg').first().locator('circle')).toHaveCount(2);
  const tile = page.locator('#tiles .tile', { hasText: 'Garden Patch' });
  await expect(tile.locator('.detail .line')).toHaveText(['Vanilla', '10×10']);
  await expect(tile).toHaveAttribute('href', 'minesweeper.html?id=MINE-0001');
  await expect(tile).toHaveAttribute('data-tone', 'Easy');
  await expect(page.locator('#tiles .tile', { hasText: 'Big Field' })).toHaveAttribute('data-tone', 'Hard');
  expect(fileRequests).toEqual([]);
});

// TASK-149: Criss-cross is the fourth kind, everything the other three have — and only data.
test('Criss-cross sits after Minesweeper in the side bar, with its count and its Vanilla dot in Easy\'s colour', async ({ page }) => {
  await serve(page);
  await page.goto('/app/');
  await expect(side(page).locator('.kind').nth(3)).toHaveText('Criss-cross2');
  await expect(side(page).locator('.kind').nth(3)).toHaveAttribute('href', 'index.html?kind=crisscross');
  const vanilla = side(page).locator('.types').nth(3).locator('.type');
  await expect(vanilla).toHaveText(['Vanilla']);
  await expect(vanilla.locator('.dot')).toHaveCSS('background-color', 'rgb(159, 216, 174)');
});

test('Criss-cross shows only criss-crosses, easiest first, and Filters picks their difficulty and type as for any kind', async ({ page }) => {
  const fileRequests = await serve(page);
  await page.goto('/app/');
  await side(page).locator('.kind', { hasText: 'Criss-cross' }).click();
  await expect(page).toHaveURL(/\/app\/index\.html\?kind=crisscross$/);
  await expect(page.locator('#browse-title')).toHaveText('Criss-cross');
  await expect(names(page)).toHaveText(['Summer Holidays', 'Big Holiday']);
  await expect(current(page)).toHaveText(['Criss-cross2']);
  await page.locator('#filter-button').click();
  expect(await rowsOf(page)).toEqual([['Difficulty', ['Easy', 'Hard']], ['Type', ['Vanilla']]]);
  await page.locator('#filters').getByRole('button', { name: 'Hard', exact: true }).click();
  await expect(names(page)).toHaveText(['Big Holiday']);
  await expect(page).toHaveURL(/\?kind=crisscross&difficulty=Hard$/);
  await side(page).locator('.types').nth(3).locator('.type', { hasText: 'Vanilla' }).click();
  await expect(page).toHaveURL(/\?kind=crisscross&type=Vanilla$/);
  await expect(names(page)).toHaveText(['Summer Holidays', 'Big Holiday']);
  await expect(current(page)).toHaveText(['Criss-cross2', 'Vanilla']);
  expect(fileRequests).toEqual([]);
});

test('a criss-cross\'s tile wears the criss-cross picture, its own, reads its word count, not its size, and opens the criss-cross page', async ({ page }) => {
  const fileRequests = await serve(page);
  const pictureOf = async address => {
    await page.goto(address);
    await expect(names(page)).not.toHaveCount(0);
    return page.locator('#tiles .tile .pic svg').first().evaluate(s => s.outerHTML);
  };
  const others = [await pictureOf('/app/'), await pictureOf('/app/?kind=maze'), await pictureOf('/app/?kind=minesweeper')];
  await page.goto('/app/?kind=crisscross');
  await expect(names(page)).toHaveCount(2);
  const crisses = await page.locator('#tiles .tile .pic svg').evaluateAll(svgs => svgs.map(s => s.outerHTML));
  expect(new Set(crisses).size).toBe(1);
  others.forEach(other => expect(crisses[0]).not.toBe(other));
  expect(crisses[0]).not.toContain('<text');
  const tile = page.locator('#tiles .tile', { hasText: 'Summer Holidays' });
  await expect(tile.locator('.detail .line')).toHaveText(['Vanilla', '20 words']);
  await expect(page.locator('#tiles .tile', { hasText: 'Big Holiday' }).locator('.detail .line')).toHaveText(['Vanilla', '60 words']);
  await expect(tile).toHaveAttribute('href', 'crisscross.html?id=CRSS-0002');
  await expect(tile).toHaveAttribute('data-tone', 'Easy');
  await expect(page.locator('#tiles .tile', { hasText: 'Big Holiday' })).toHaveAttribute('data-tone', 'Hard');
  const pic = await tile.locator('.pic').boundingBox();
  const name = await tile.locator('.name').boundingBox();
  expect(pic.height).toBeGreaterThan(0);
  expect(pic.y + pic.height).toBeLessThanOrEqual(name.y);
  expect(fileRequests).toEqual([]);
});

// TASK-165: Mosaic is the fifth kind, everything the other four have — and only data.
test('Mosaic sits after Criss-cross in the side bar, with its count and its Vanilla dot in Easy\'s colour', async ({ page }) => {
  await serve(page);
  await page.goto('/app/');
  await expect(side(page).locator('.kind').nth(4)).toHaveText('Mosaic3');
  await expect(side(page).locator('.kind').nth(4)).toHaveAttribute('href', 'index.html?kind=mosaic');
  const vanilla = side(page).locator('.types').nth(4).locator('.type');
  await expect(vanilla).toHaveText(['Vanilla']);
  await expect(vanilla.locator('.dot')).toHaveCSS('background-color', 'rgb(159, 216, 174)');
});

test('Mosaic shows only mosaics, easiest first, Filters picks their difficulty and type, and sort works as for any kind', async ({ page }) => {
  const fileRequests = await serve(page);
  await page.goto('/app/');
  await side(page).locator('.kind', { hasText: 'Mosaic' }).click();
  await expect(page).toHaveURL(/\/app\/index\.html\?kind=mosaic$/);
  await expect(page.locator('#browse-title')).toHaveText('Mosaic');
  await expect(names(page)).toHaveText(['Mosaic 002', 'Mosaic 003', 'Mosaic 001']);
  await expect(current(page)).toHaveText(['Mosaic3']);
  await page.locator('#filter-button').click();
  expect(await rowsOf(page)).toEqual([['Difficulty', ['Easy', 'Medium', 'Hard']], ['Type', ['Vanilla']]]);
  await page.locator('#filters').getByRole('button', { name: 'Hard', exact: true }).click();
  await expect(names(page)).toHaveText(['Mosaic 001']);
  await expect(page).toHaveURL(/\?kind=mosaic&difficulty=Hard$/);
  await side(page).locator('.types').nth(4).locator('.type', { hasText: 'Vanilla' }).click();
  await expect(page).toHaveURL(/\?kind=mosaic&type=Vanilla$/);
  await expect(names(page)).toHaveText(['Mosaic 002', 'Mosaic 003', 'Mosaic 001']);
  await expect(current(page)).toHaveText(['Mosaic3', 'Vanilla']);
  await page.goto('/app/?kind=mosaic&sort=date');
  await expect(names(page)).toHaveText(['Mosaic 003', 'Mosaic 002', 'Mosaic 001']);
  await page.goto('/app/?kind=mosaic&sort=difficulty&dir=asc');
  await expect(names(page)).toHaveText(['Mosaic 001', 'Mosaic 003', 'Mosaic 002']);
  expect(fileRequests).toEqual([]);
});

test('a mosaic\'s tile wears the mosaic picture, the same on every one, reads its size, never its picture\'s name, and opens the mosaic page', async ({ page }) => {
  const fileRequests = await serve(page);
  const pictureOf = async address => {
    await page.goto(address);
    await expect(names(page)).not.toHaveCount(0);
    return page.locator('#tiles .tile .pic svg').first().evaluate(s => s.outerHTML);
  };
  const others = [
    await pictureOf('/app/'), await pictureOf('/app/?kind=maze'), await pictureOf('/app/?kind=minesweeper'), await pictureOf('/app/?kind=crisscross'),
  ];
  await page.goto('/app/?kind=mosaic');
  await expect(names(page)).toHaveCount(3);
  const mosaics = await page.locator('#tiles .tile .pic svg').evaluateAll(svgs => svgs.map(s => s.outerHTML));
  expect(new Set(mosaics).size).toBe(1);
  others.forEach(other => expect(mosaics[0]).not.toBe(other));
  await expect(page.locator('#tiles .tile', { hasText: 'Mosaic 001' }).locator('.detail .line')).toHaveText(['Vanilla', '50×38']);
  const tile = page.locator('#tiles .tile', { hasText: 'Mosaic 002' });
  await expect(tile.locator('.detail .line')).toHaveText(['Vanilla', '50×50']);
  await expect(page.locator('#tiles')).not.toContainText('Robot');
  await expect(tile).toHaveAttribute('href', 'mosaic.html?id=MOSA-0002');
  await expect(tile).toHaveAttribute('data-tone', 'Easy');
  await expect(page.locator('#tiles .tile', { hasText: 'Mosaic 001' })).toHaveAttribute('data-tone', 'Hard');
  const pic = await tile.locator('.pic').boundingBox();
  const name = await tile.locator('.name').boundingBox();
  expect(pic.height).toBeGreaterThan(0);
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

  test('a Words | Mazes | Mines | Criss-cross | Mosaic switch sits above the grid, the current kind filled', async ({ page }) => {
    await serve(page);
    await page.goto('/app/');
    const kinds = page.locator('main .kind-switch a');
    await expect(kinds).toHaveText(['Words3', 'Mazes6', 'Mines2', 'Criss-cross2', 'Mosaic3']);
    await expect(kinds.first()).toHaveAttribute('aria-current', 'page');
    const box = await page.locator('.kind-switch').boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual((await page.locator('#tiles').boundingBox()).y);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await kinds.nth(1).click();
    await expect(page).toHaveURL(/\/app\/index\.html\?kind=maze$/);
    await expect(names(page)).toHaveCount(6);
    await expect(kinds.nth(1)).toHaveAttribute('aria-current', 'page');
    await expect(kinds.first()).toHaveAttribute('aria-current', 'false');
    await kinds.nth(2).click();
    await expect(page).toHaveURL(/\/app\/index\.html\?kind=minesweeper$/);
    await expect(names(page)).toHaveText(['Garden Patch', 'Big Field']);
    await kinds.nth(3).click();
    await expect(page).toHaveURL(/\/app\/index\.html\?kind=crisscross$/);
    await expect(names(page)).toHaveText(['Summer Holidays', 'Big Holiday']);
    await expect(kinds.nth(3)).toHaveAttribute('aria-current', 'page');
    await kinds.nth(4).click();
    await expect(page).toHaveURL(/\/app\/index\.html\?kind=mosaic$/);
    await expect(names(page)).toHaveText(['Mosaic 002', 'Mosaic 003', 'Mosaic 001']);
    await expect(kinds.nth(4)).toHaveAttribute('aria-current', 'page');
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

  // TASK-107: a collection of both kinds counts each kind, a line each, never adding their Vanillas.
  test('a collection tile of both kinds counts each kind on a line of its own, never cut short', async ({ page }) => {
    await serve(page);
    await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [
      { slug: 'mix', name: 'Mix', description: 'Both.', created: '2026-10-09', puzzles: [
        { id: 'MAZE-0001', number: 1 }, { id: 'WSCH-0001', number: 2 }, { id: 'MAZE-0004', number: 3 }, { id: 'WSCH-0002', number: 4 },
      ] },
    ] } }));
    await page.goto('/app/?kind=collections');
    const lines = page.locator('#tiles .tile.collection .detail .line');
    await expect(lines).toHaveText(['Both.', '2 Wordsearches', '2 Mazes']);
    expect(await lines.evaluateAll(els => els.some(el => el.scrollWidth > el.clientWidth))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('a collection holding criss-crosses counts them on a line of their own, last: 2 Criss-crosses', async ({ page }) => {
    await serve(page);
    await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [
      { slug: 'mix', name: 'Mix', description: 'Every kind.', created: '2026-10-09', puzzles: [
        { id: 'CRSS-0001', number: 1 }, { id: 'WSCH-0001', number: 2 }, { id: 'MINE-0001', number: 3 }, { id: 'MAZE-0001', number: 4 },
        { id: 'CRSS-0002', number: 5 },
      ] },
    ] } }));
    await page.goto('/app/?kind=collections');
    const lines = page.locator('#tiles .tile.collection .detail .line');
    await expect(lines).toHaveText(['Every kind.', '1 Wordsearch', '1 Maze', '1 Minesweeper', '2 Criss-crosses']);
    expect(await lines.evaluateAll(els => els.some(el => el.scrollWidth > el.clientWidth))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('a collection holding mosaics counts them on a line of their own, last: 3 Mosaics', async ({ page }) => {
    await serve(page);
    await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [
      { slug: 'mix', name: 'Mix', description: 'Every kind.', created: '2026-10-09', puzzles: [
        { id: 'MOSA-0001', number: 1 }, { id: 'WSCH-0001', number: 2 }, { id: 'MINE-0001', number: 3 }, { id: 'MAZE-0001', number: 4 },
        { id: 'CRSS-0001', number: 5 }, { id: 'MOSA-0002', number: 6 }, { id: 'MOSA-0003', number: 7 },
      ] },
    ] } }));
    await page.goto('/app/?kind=collections');
    const lines = page.locator('#tiles .tile.collection .detail .line');
    await expect(lines).toHaveText(['Every kind.', '1 Wordsearch', '1 Maze', '1 Minesweeper', '1 Criss-cross', '3 Mosaics']);
    expect(await lines.evaluateAll(els => els.some(el => el.scrollWidth > el.clientWidth))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('a collection holding boards counts them on a line of their own: 3 Minesweepers', async ({ page }) => {
    await serve(page);
    await page.route('**/content/puzzles/minesweeper/index.json', r => r.fulfill({ json: { puzzles: [
      ...BOARDS, { ...puzzle('MINE', 3, 'Vanilla', 'Third'), ...saved('Easy', 10, 10) },
    ] } }));
    await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [
      { slug: 'mix', name: 'Mix', description: 'All three.', created: '2026-10-09', puzzles: [
        { id: 'MINE-0001', number: 1 }, { id: 'WSCH-0001', number: 2 }, { id: 'MINE-0002', number: 3 }, { id: 'MAZE-0001', number: 4 },
        { id: 'MINE-0003', number: 5 },
      ] },
    ] } }));
    await page.goto('/app/?kind=collections');
    const lines = page.locator('#tiles .tile.collection .detail .line');
    await expect(lines).toHaveText(['All three.', '1 Wordsearch', '1 Maze', '3 Minesweepers']);
    expect(await lines.evaluateAll(els => els.some(el => el.scrollWidth > el.clientWidth))).toBe(false);
  });
});

// The switch was built for two kinds, and three's full names run past a phone's switch, so on a
// phone it reads Words | Mazes | Mines (the spec's call, TASK-135) — Criss-cross fourth
// (TASK-149) and Mosaic fifth (TASK-165). Four don't fit the narrowest phone, so there the switch scrolls sideways inside
// itself: each name whole, on one row, the page never pushed sideways, and the current kind shown.
test.describe('on the narrowest phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  const wordsearches = Array.from({ length: 120 }, (_, i) => puzzle('WSCH', i + 1, 'Vanilla', `Puzzle ${i + 1}`));

  test('the switch reads Words | Mazes | Mines | Criss-cross | Mosaic on one row, every name whole, scrolling inside itself', async ({ page }) => {
    await serve(page);
    await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: { puzzles: wordsearches } }));
    await page.goto('/app/');
    const kinds = page.locator('main .kind-switch a');
    await expect(kinds).toHaveText(['Words120', 'Mazes6', 'Mines2', 'Criss-cross2', 'Mosaic3']);
    expect(await kinds.evaluateAll(els => els.some(el => el.scrollWidth > el.clientWidth))).toBe(false);
    const tops = await kinds.evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
    expect(new Set(tops).size).toBe(1);
    const nav = await page.locator('.kind-switch').boundingBox();
    expect(nav.x + nav.width).toBeLessThanOrEqual(360);
    expect(await page.locator('.kind-switch').evaluate(el => getComputedStyle(el).overflowX)).toBe('auto');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });

  test('on Criss-cross, the switch shows Criss-cross whole, filled, and the page stays put', async ({ page }) => {
    await serve(page);
    await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: { puzzles: wordsearches } }));
    await page.goto('/app/?kind=crisscross');
    const criss = page.locator('main .kind-switch a').nth(3);
    await expect(criss).toHaveAttribute('aria-current', 'page');
    const nav = await page.locator('.kind-switch').boundingBox();
    const box = await criss.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(nav.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(nav.x + nav.width + 0.5);
    expect(await page.evaluate(() => [window.scrollX, document.documentElement.scrollWidth])).toEqual([0, 360]);
  });

  test('on Mosaic, last on the switch, the switch scrolls to show Mosaic whole, filled, and the page stays put', async ({ page }) => {
    await serve(page);
    await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: { puzzles: wordsearches } }));
    await page.goto('/app/?kind=mosaic');
    const mosaic = page.locator('main .kind-switch a').nth(4);
    await expect(mosaic).toHaveAttribute('aria-current', 'page');
    expect(await page.locator('.kind-switch').evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    const nav = await page.locator('.kind-switch').boundingBox();
    const box = await mosaic.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(nav.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(nav.x + nav.width + 0.5);
    expect(await page.evaluate(() => [window.scrollX, document.documentElement.scrollWidth])).toEqual([0, 360]);
  });
});

test('on a desktop there is no kinds switch — the side bar is the way between kinds', async ({ page }) => {
  await serve(page);
  await page.goto('/app/');
  await expect(page.locator('.kind-switch')).toBeHidden();
});
