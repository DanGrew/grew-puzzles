const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');

// The site publishes no puzzle of its own here: the fixture is served as WSCH-0007.
const COLS = PUZZLE.grid[0].length;
const FOUND_INK = 'rgb(15, 42, 36)';
const WRONG_RED = 'rgb(224, 71, 59)';

const LAYOUT_KEY = 'grew-puzzles.words-layout';
// The fixture with each row written twice: a grid wider than a phone, or than 600px beside a list.
const WIDE_PUZZLE = { ...PUZZLE, grid: PUZZLE.grid.map(row => row.repeat(2)) };

async function open(page, query, puzzle) {
  await page.route('**/content/puzzles/wordsearch/WSCH-0007.json', route => route.fulfill({ json: puzzle || PUZZLE }));
  await page.goto('/app/play.html' + (query || '?id=WSCH-0007'));
}

// Opens the puzzle with a words layout already chosen on this device.
async function openIn(page, layout) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout]);
  await open(page);
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
  test(`in Bottom the word list sits under the grid, as wide as it, in centred columns (${width}px window)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openIn(page, 'bottom');
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

test('the menu holds How to play, which opens the instructions and closes the menu; Escape closes them', async ({ page }) => {
  await open(page);
  const help = page.locator('#help');
  await expect(help).toBeHidden();
  await expect(page.locator('.play-head button')).toHaveCount(0);

  await page.locator('.site .burger').click();
  const entries = page.locator('#site-menu > *');
  await expect(entries).toHaveText(['How to play']);
  await entries.click();
  await expect(help).toBeVisible();
  await expect(help).toContainText('Tap a letter, then another in line with it.');
  await expect(page.locator('#site-menu')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
});

test('clicking away closes the instructions', async ({ page }) => {
  await open(page);
  await page.locator('.site .burger').click();
  await page.locator('#site-menu > *').click();
  await page.mouse.click(10, 800);
  await expect(page.locator('#help')).toBeHidden();
});

test('the brand is the one way back to the puzzles: no All puzzles link, no Wordsearches entry', async ({ page }) => {
  await open(page);
  await expect(page.locator('.site .brand')).toHaveAttribute('href', 'index.html');
  await expect(page.getByRole('link', { name: 'All puzzles', exact: true })).toHaveCount(0);
  await page.locator('.site .burger').click();
  await expect(page.locator('#site-menu')).not.toContainText('Wordsearches');
});

// ---- Where the words sit ----

const layoutButton = page => page.locator('#words-layout');
const toggle = page => page.locator('#words-toggle');

test('a first visit opens in Overlay: no list on the page, and a show-words button beside the layout button', async ({ page }) => {
  await open(page);
  await expect(page.locator('#words-list')).toBeHidden();
  await expect(layoutButton(page)).toHaveAttribute('title', 'Words: over the grid');
  await expect(layoutButton(page).locator('.icon-overlay')).toBeVisible();
  await expect(toggle(page)).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-label', 'Show words');
  await expect(toggle(page).locator('.icon-expand')).toBeVisible();

  const card = await page.locator('.card').boundingBox();
  const layout = await layoutButton(page).boundingBox();
  const beside = await toggle(page).boundingBox();
  const flip = await page.locator('#flip').boundingBox();
  expect(layout.x).toBeLessThan(card.x);
  expect(layout.y).toBeLessThan(card.y);
  expect(beside.x).toBeGreaterThan(layout.x + layout.width);
  expect(beside.x + beside.width).toBeLessThan(flip.x);
});

test('the layout button cycles Bottom → Right → Overlay → Bottom, its icon and tooltip following, the play untouched', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await openIn(page, 'bottom');
  await tapAll(page, [[4, 2], [2, 2], [0, 0]]);
  const steps = [
    ['bottom', 'Words: under the grid'],
    ['right', 'Words: beside the grid'],
    ['overlay', 'Words: over the grid'],
    ['bottom', 'Words: under the grid']
  ];
  for (const [i, [layout, title]] of steps.entries()) {
    await expect(page.locator('#play')).toHaveAttribute('data-words', layout);
    await expect(layoutButton(page)).toHaveAttribute('title', title);
    await expect(layoutButton(page).locator('svg:visible')).toHaveClass('icon-' + layout);
    await expect(page.locator('#count')).toHaveText('1/8');
    await expect(page.locator('#overlay circle.mark-select')).toHaveCount(1);
    if (i < steps.length - 1) await layoutButton(page).click();
  }
});

test('in Bottom and Right there is no show/hide words button', async ({ page }) => {
  await openIn(page, 'bottom');
  await expect(toggle(page)).toBeHidden();
  await layoutButton(page).click();
  await expect(page.locator('#play')).toHaveAttribute('data-words', 'right');
  await expect(toggle(page)).toBeHidden();
});

test('in Right the word list sits beside the grid on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await openIn(page, 'right');
  const stage = await page.locator('.stage').boundingBox();
  const aside = await page.locator('aside').boundingBox();
  expect(aside.x).toBeGreaterThan(stage.x + stage.width);
  expect(Math.abs(aside.y - stage.y)).toBeLessThan(2);
});

test('in Right on a screen too narrow for both, the word list sits under the grid', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.addInitScript(key => localStorage.setItem(key, 'right'), LAYOUT_KEY);
  await open(page, null, WIDE_PUZZLE);
  await expect(page.locator('#play')).toHaveAttribute('data-words', 'right');
  const stage = await page.locator('.stage').boundingBox();
  const aside = await page.locator('aside').boundingBox();
  expect(aside.y).toBeGreaterThan(stage.y + stage.height);
});

test('in Overlay, show words covers the grid with the list and hide words shows the grid as it was', async ({ page }) => {
  await open(page);
  await tapAll(page, [[4, 2], [2, 2], [0, 0], [0, 3]]);
  const before = await page.locator('#overlay').innerHTML();

  await toggle(page).click();
  const list = page.locator('#words-list');
  await expect(list).toBeVisible();
  const card = await page.locator('.card').boundingBox();
  const cover = await list.boundingBox();
  expect(cover).toEqual(card);
  await expect(list.locator('.list-head')).toContainText('Words');
  await expect(page.locator('#count')).toHaveText('1/8');
  await expect(page.locator('#words li', { hasText: 'Cat' })).toHaveClass(/done/);
  await expect(toggle(page)).toHaveAttribute('aria-label', 'Hide words');
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle(page).locator('.icon-collapse')).toBeVisible();
  await expect(toggle(page).locator('.icon-expand')).toBeHidden();

  await toggle(page).click();
  await expect(list).toBeHidden();
  await expect(toggle(page)).toHaveAttribute('aria-label', 'Show words');
  expect(await page.locator('#overlay').innerHTML()).toBe(before);
  await tapAll(page, [[0, 7]]);
  await expect(page.locator('#count')).toHaveText('2/8');
});

test('while the list covers the grid, tapping where the grid sits selects nothing', async ({ page }) => {
  await open(page);
  await toggle(page).click();
  const box = await cell(page, 7, 7).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#overlay > *')).toHaveCount(0);
  await expect(page.locator('#grid')).toHaveJSProperty('inert', true);
});

test('the solution still works with the list closed, and show words waits while it shows', async ({ page }) => {
  await open(page);
  await page.locator('#flip').click();
  await expect(page.locator('#card')).toHaveClass(/flipped/);
  await expect(toggle(page)).toBeHidden();
  await page.locator('#flip').click();
  await expect(toggle(page)).toBeVisible();

  await toggle(page).click();
  await expect(page.locator('#flip')).toBeHidden();
});

test('the choice is remembered on this device across a reload and another puzzle', async ({ page }) => {
  await open(page);
  await layoutButton(page).click();
  await expect(page.locator('#play')).toHaveAttribute('data-words', 'bottom');
  expect(await page.evaluate(key => localStorage.getItem(key), LAYOUT_KEY)).toBe('bottom');

  await page.reload();
  await expect(page.locator('#play')).toHaveAttribute('data-words', 'bottom');
  await page.route('**/content/puzzles/wordsearch/WSCH-0008.json', route => route.fulfill({ json: PUZZLE }));
  await page.goto('/app/play.html?id=WSCH-0008');
  await expect(page.locator('#play')).toHaveAttribute('data-words', 'bottom');
});

test('a page that cannot read or store the choice opens in Overlay and still cycles', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  await open(page);
  await expect(page.locator('#play')).toHaveAttribute('data-words', 'overlay');
  await layoutButton(page).click();
  await expect(page.locator('#play')).toHaveAttribute('data-words', 'bottom');
});

for (const layout of ['bottom', 'right', 'overlay']) {
  test(`a finished puzzle still says Puzzle complete in ${layout}`, async ({ page }) => {
    await openIn(page, layout);
    for (const ends of ALL_WORDS) await tapAll(page, ends);
    await expect(page.locator('#complete')).toBeVisible();
    await expect(page.locator('#complete')).toBeInViewport();
  });
}

test('on a phone the page is the screen wide: burger top-right, title, date and bar centred on the screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await open(page, null, WIDE_PUZZLE);
  await expect(page.locator('#grid .cell').first()).toBeVisible();
  const screen = 390;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(screen);
  const centre = box => box.x + box.width / 2;
  for (const selector of ['.site', '#title', '#created']) {
    expect(Math.abs(centre(await page.locator(selector).boundingBox()) - screen / 2)).toBeLessThan(2);
  }
  const burger = await page.locator('.site .burger').boundingBox();
  expect(burger.x + burger.width).toBeGreaterThan(screen - 40);
  expect(burger.y).toBeLessThan(60);
  await context.close();
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
