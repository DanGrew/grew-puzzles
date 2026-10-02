const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');

// The site publishes no puzzle of its own here: the fixture is served as WSCH-0007.
const COLS = PUZZLE.grid[0].length;
const FOUND_INK = 'rgb(15, 42, 36)';
const WRONG_RED = 'rgb(224, 71, 59)';

async function open(page, query, puzzle) {
  await page.route('**/content/puzzles/wordsearch/WSCH-0007.json', route => route.fulfill({ json: puzzle || PUZZLE }));
  await page.goto('/app/play.html' + (query || '?id=WSCH-0007'));
}

function cell(page, r, c) {
  return page.locator('#grid .cell').nth(r * COLS + c);
}

async function tapAll(page, cells) {
  for (const [r, c] of cells) await cell(page, r, c).click();
}

async function lineEnds(locator) {
  return locator.evaluate(l => ['x1', 'y1', 'x2', 'y2'].map(a => Number(l.getAttribute(a))));
}

const ALL_WORDS = [
  [[4, 2], [2, 2]], [[1, 2], [3, 4]], [[5, 0], [5, 2]], [[6, 3], [4, 5]],
  [[0, 0], [0, 7]], [[0, 7], [2, 7]], [[7, 2], [7, 0]], [[1, 0], [6, 0]]
];

test('the address holds the hidden ID; the page shows the title centred with the date small beneath, and the type in the grid band', async ({ page }) => {
  await open(page);
  await expect(page).toHaveURL(/\/app\/play\.html\?id=WSCH-0007$/);
  const title = page.locator('#title');
  const created = page.locator('#created');
  await expect(title).toHaveText('Farm Kitchen');
  await expect(created).toHaveText('2 Oct 2026');
  await expect(page).toHaveTitle('Farm Kitchen · Grew Puzzles');
  await expect(page.locator('#label')).toHaveText('Vanilla');
  await expect(page.locator('#grid .cell')).toHaveCount(64);
  await expect(cell(page, 0, 0)).toHaveText('I');
  await expect(page.locator('.site .brand')).toHaveText('Grew Puzzles');

  const wrap = await page.locator('.play-head').boundingBox();
  const centre = box => box.x + box.width / 2;
  const box = await title.boundingBox();
  const date = await created.boundingBox();
  expect(Math.abs(centre(box) - centre(wrap))).toBeLessThan(2);
  expect(Math.abs(centre(date) - centre(wrap))).toBeLessThan(2);
  expect(date.y).toBeGreaterThanOrEqual(box.y + box.height);
  const size = locator => locator.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(await size(created)).toBeLessThan(await size(title));
  await expect(page.locator('body')).not.toContainText('WSCH');
});

test('a type name shows in the band exactly as written', async ({ page }) => {
  await open(page, null, { ...PUZZLE, type: 'Mirra?e' });
  await expect(page.locator('#label')).toHaveText('Mirra?e');
  await expect(page.locator('#solution-label')).toHaveText('Mirra?e · Solution');
});

test('the word list shows every word as written, with the count', async ({ page }) => {
  await open(page);
  await expect(page.locator('#words li')).toHaveText(['Cat', 'Cow', 'Ewe', 'Hen', 'Ice cream', 'Map', 'Pig', 'Piglet']);
  await expect(page.locator('#count')).toHaveText('0/8');
});

test('tapping both ends of a word draws a black line through it and crosses it off', async ({ page }) => {
  await open(page);
  await tapAll(page, [[4, 2], [2, 2]]);
  const line = page.locator('#overlay line.mark-found');
  await expect(line).toHaveCount(1);
  expect(await lineEnds(line)).toEqual([2.5, 4.5, 2.5, 2.5]);
  await expect(line).toHaveCSS('stroke', FOUND_INK);
  await expect(page.locator('#words li', { hasText: 'Cat' })).toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('1/8');
  await expect(page.locator('#overlay .mark-wrong')).toHaveCount(0);
});

test('a word counts from either end', async ({ page }) => {
  await open(page);
  await tapAll(page, [[2, 2], [4, 2]]);
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(1);
  await expect(page.locator('#count')).toHaveText('1/8');
});

test('a first tap rings the letter', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 0]]);
  await expect(page.locator('#overlay circle.mark-select')).toHaveCount(1);
});

test('two letters that spell no word draw a red line, and tapping further along extends it until they do', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 0], [0, 3]]);
  const red = page.locator('#overlay line.mark-wrong');
  expect(await lineEnds(red)).toEqual([0.5, 0.5, 3.5, 0.5]);
  await expect(red).toHaveCSS('stroke', WRONG_RED);
  await expect(page.locator('#overlay circle.mark-wrong')).toHaveCount(1);

  await tapAll(page, [[0, 5]]);
  expect(await lineEnds(red)).toEqual([0.5, 0.5, 5.5, 0.5]);
  await expect(page.locator('#count')).toHaveText('0/8');

  await tapAll(page, [[0, 7]]);
  await expect(red).toHaveCount(0);
  await expect(page.locator('#words li', { hasText: 'Ice cream' })).toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('1/8');
});

test('a tap off the line changes nothing; tapping the last letter again clears the selection', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 0], [0, 3]]);
  const before = await page.locator('#overlay').innerHTML();
  await tapAll(page, [[2, 1]]);
  expect(await page.locator('#overlay').innerHTML()).toBe(before);

  await tapAll(page, [[0, 3]]);
  await expect(page.locator('#overlay > *')).toHaveCount(0);
});

test('P then G inside PIGLET draws a red line and does not cross off PIG', async ({ page }) => {
  await open(page);
  await tapAll(page, [[1, 0], [3, 0]]);
  await expect(page.locator('#overlay line.mark-wrong')).toHaveCount(1);
  await expect(page.locator('#words li', { hasText: /^Pig$/ })).not.toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('0/8');
});

test('a letter two found words share is circled', async ({ page }) => {
  await open(page);
  await tapAll(page, [[1, 0], [6, 0]]);
  await expect(page.locator('#overlay circle.mark-shared')).toHaveCount(0);
  await tapAll(page, [[5, 0], [5, 2]]);
  const ring = page.locator('#overlay circle.mark-shared');
  await expect(ring).toHaveCount(1);
  await expect(ring).toHaveAttribute('cx', '0.5');
  await expect(ring).toHaveAttribute('cy', '5.5');
});

test('the corner icon flips to the solution and back, keeping the found words', async ({ page }) => {
  await open(page);
  await tapAll(page, [[4, 2], [2, 2]]);
  const flip = page.locator('#flip');

  await flip.click();
  await expect(page.locator('#card')).toHaveClass(/flipped/);
  await expect(flip).toHaveAttribute('aria-pressed', 'true');
  await expect(flip).toHaveAttribute('aria-label', 'Back to puzzle');
  await expect(page.locator('#solution-label')).toHaveText('Vanilla · Solution');
  await expect(page.locator('#back')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#solution-overlay line.mark-found')).toHaveCount(8);
  await expect(page.locator('#solution-overlay circle.mark-shared')).toHaveCount(2);

  await flip.click();
  await expect(page.locator('#card')).not.toHaveClass(/flipped/);
  await expect(flip).toHaveAttribute('aria-label', 'Show solution');
  await expect(page.locator('#back')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(1);
  await expect(page.locator('#count')).toHaveText('1/8');
  await tapAll(page, [[1, 2], [3, 4]]);
  await expect(page.locator('#count')).toHaveText('2/8');
});

test('finding the last word pops the board and sparkles', async ({ page }) => {
  await open(page);
  await expect(page.locator('#complete')).toBeHidden();
  for (const ends of ALL_WORDS) await tapAll(page, ends);
  await expect(page.locator('#count')).toHaveText('8/8');
  await expect(page.locator('#complete')).toBeVisible();
  await expect(page.locator('#board')).toHaveClass(/pop/);
  await expect(page.locator('#board .spark')).toHaveCount(28);
});

for (const width of [600, 1200]) {
  test(`the word list sits under the grid, as wide as it, in centred columns (${width}px window)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const stage = await page.locator('.stage').boundingBox();
    const aside = await page.locator('aside').boundingBox();
    expect(aside.y).toBeGreaterThan(stage.y + stage.height);
    expect(Math.abs(aside.width - stage.width)).toBeLessThan(2);
    expect(Math.abs(aside.x - stage.x)).toBeLessThan(2);

    const tops = await page.locator('#words li').evaluateAll(lis => lis.map(li => li.getBoundingClientRect().top));
    expect(new Set(tops).size).toBeLessThan(tops.length);
    await expect(page.locator('#words li').first()).toHaveCSS('justify-self', 'center');
  });
}

test('the ? beside the title opens the instructions, and Escape closes them', async ({ page }) => {
  await open(page);
  const help = page.locator('#help');
  await expect(help).toBeHidden();

  await page.locator('#help-button').click();
  await expect(help).toBeVisible();
  await expect(help).toContainText('Tap a letter, then another in line with it.');
  const button = await page.locator('#help-button').boundingBox();
  const card = await help.boundingBox();
  expect(card.y).toBeGreaterThan(button.y + button.height);

  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
});

test('clicking away closes the instructions', async ({ page }) => {
  await open(page);
  await page.locator('#help-button').click();
  await page.mouse.click(10, 800);
  await expect(page.locator('#help')).toBeHidden();
});

test('a hidden ID with no puzzle says so', async ({ page }) => {
  await open(page, '?id=WSCH-0099');
  await expect(page.locator('#title')).toHaveText('Puzzle not found');
  await expect(page.locator('#created')).toHaveText('');
  await expect(page.locator('#missing')).toBeVisible();
  await expect(page.locator('#play')).toBeHidden();
});

for (const query of ['', '?id=7', '?collection=vanilla&id=7', '?id=../index']) {
  test(`an address that names no hidden ID says so, fetching nothing (${query || 'no query'})`, async ({ page }) => {
    const fetched = [];
    await page.route('**/content/**', route => { fetched.push(route.request().url()); return route.abort(); });
    await page.goto('/app/play.html' + query);
    await expect(page.locator('#title')).toHaveText('Puzzle not found');
    expect(fetched).toEqual([]);
  });
}
