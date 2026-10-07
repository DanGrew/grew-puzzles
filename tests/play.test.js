const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');

// The site publishes no puzzle of its own here: the fixture is served as WSCH-0007.
const COLS = PUZZLE.grids[0].rows[0].length;
const FOUND_INK = 'rgb(15, 42, 36)';
const WRONG_RED = 'rgb(224, 71, 59)';

const LAYOUT_KEY = 'grew-puzzles.words-layout';
const LOOK_KEY = 'grew-puzzles.look';

// Plain, the site as it always was: a test of the cards' own arrangement holds it, since Themed
// may leave the character room beside the words (tests/theme.test.js).
async function plain(page) {
  await page.addInitScript(key => localStorage.setItem(key, 'plain'), LOOK_KEY);
}
// The fixture with each row written twice: a grid wider than a phone, or than 600px beside a list.
const WIDE_PUZZLE = { ...PUZZLE, grids: [{ rows: PUZZLE.grids[0].rows.map(row => row.repeat(2)) }] };

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

test('two letters that spell no word draw a red line; each later in-line tap points it from the circle until it spans a word', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 2], [0, 5]]);
  const red = page.locator('#overlay line.mark-wrong');
  expect(await lineEnds(red)).toEqual([2.5, 0.5, 5.5, 0.5]);
  await expect(red).toHaveCSS('stroke', WRONG_RED);
  await expect(page.locator('#overlay circle.mark-wrong')).toHaveCount(1);

  await tapAll(page, [[0, 3]]);
  expect(await lineEnds(red)).toEqual([2.5, 0.5, 3.5, 0.5]);
  await tapAll(page, [[0, 6]]);
  expect(await lineEnds(red)).toEqual([2.5, 0.5, 6.5, 0.5]);
  await tapAll(page, [[3, 2]]);
  expect(await lineEnds(red)).toEqual([2.5, 0.5, 2.5, 3.5]);
  await expect(page.locator('#overlay circle.mark-wrong')).toHaveCount(1);
  await expect(page.locator('#count')).toHaveText('0/8');
});

test('a red line pointed at the far end of a word crosses it off and the circle goes', async ({ page }) => {
  await open(page);
  await tapAll(page, [[4, 2], [4, 4], [2, 2]]);
  await expect(page.locator('#overlay .mark-wrong')).toHaveCount(0);
  await expect(page.locator('#overlay circle')).toHaveCount(0);
  await expect(page.locator('#words li', { hasText: 'Cat' })).toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('1/8');
});

test("a tap off the circle's lines or on the red line's end changes nothing; tapping the circle clears it all", async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 0], [0, 3]]);
  const before = await page.locator('#overlay').innerHTML();
  await tapAll(page, [[2, 1]]);
  expect(await page.locator('#overlay').innerHTML()).toBe(before);
  await tapAll(page, [[0, 3]]);
  expect(await page.locator('#overlay').innerHTML()).toBe(before);

  await tapAll(page, [[0, 0]]);
  await expect(page.locator('#overlay > *')).toHaveCount(0);
});

test('tapping a lone circled letter again clears it', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 0], [0, 0]]);
  await expect(page.locator('#overlay > *')).toHaveCount(0);
});

test('P then G inside PIGLET stays red, then tapping the T crosses off PIGLET', async ({ page }) => {
  await open(page);
  await tapAll(page, [[1, 0], [3, 0]]);
  await expect(page.locator('#overlay line.mark-wrong')).toHaveCount(1);
  await expect(page.locator('#words li', { hasText: /^Pig$/ })).not.toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('0/8');

  await tapAll(page, [[6, 0]]);
  await expect(page.locator('#overlay .mark-wrong')).toHaveCount(0);
  await expect(page.locator('#words li', { hasText: 'Piglet' })).toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('1/8');
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

test('the menu holds Print, then How to play — the site\'s page, the only one', async ({ page }) => {
  await open(page);
  await expect(page.locator('.play-head button')).toHaveCount(0);
  await page.locator('.site .burger').click();
  const entries = page.locator('#site-menu > *');
  await expect(entries).toHaveText(['Print', 'How to play', 'About us', /^Look/, 'Privacy']);
  await expect(entries.nth(1)).toHaveAttribute('href', 'how-to-play.html');
  await expect(page.locator('[popover]#help')).toHaveCount(0);
});

test('the brand is the one way back to the puzzles: no All puzzles link, no Wordsearches entry', async ({ page }) => {
  await open(page);
  await expect(page.locator('.site .brand')).toHaveAttribute('href', 'index.html');
  await expect(page.getByRole('link', { name: 'All puzzles', exact: true })).toHaveCount(0);
  await page.locator('.site .burger').click();
  await expect(page.locator('#site-menu')).not.toContainText('Wordsearches');
});

// ---- A puzzle with a missing word ----

const REVEAL_RED = 'rgb(179, 38, 30)';
// The fixture as a Missing puzzle: Goat listed, sorted in among the rest, nowhere in the grid.
const MISSING_PUZZLE = {
  ...PUZZLE, type: 'Missing',
  words: [...PUZZLE.words.slice(0, 3), { word: 'Goat', missing: true }, ...PUZZLE.words.slice(3)]
};
const goat = page => page.locator('#words li', { hasText: 'Goat' });

// Opens the Missing puzzle with the words under the grid, so the list is always in view.
async function openMissing(page) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, 'bottom']);
  await open(page, null, MISSING_PUZZLE);
}

test('a Missing puzzle lists every word unmarked, counts only the placed ones, and says Missing in the band', async ({ page }) => {
  await openMissing(page);
  await expect(page.locator('#label')).toHaveText('Missing');
  await expect(page.locator('#words li')).toHaveText(['Cat', 'Cow', 'Ewe', 'Goat', 'Hen', 'Ice cream', 'Map', 'Pig', 'Piglet']);
  await expect(page.locator('#words li.done, #words li.revealed')).toHaveCount(0);
  await expect(page.locator('#count')).toHaveText('0/8');
});

test('finding the last real word completes a Missing puzzle and turns the missing word red', async ({ page }) => {
  await openMissing(page);
  for (const ends of ALL_WORDS.slice(0, -1)) await tapAll(page, ends);
  await expect(page.locator('#count')).toHaveText('7/8');
  await expect(goat(page)).not.toHaveClass(/revealed/);
  await expect(page.locator('#complete')).toBeHidden();

  await tapAll(page, ALL_WORDS[ALL_WORDS.length - 1]);
  await expect(page.locator('#count')).toHaveText('8/8');
  await expect(page.locator('#complete')).toBeVisible();
  await expect(page.locator('#board .spark')).toHaveCount(28);
  await expect(goat(page)).toHaveClass(/revealed/);
  await expect(goat(page)).not.toHaveClass(/done/);
  await expect(goat(page)).toHaveCSS('color', REVEAL_RED);
  await expect(page.locator('#words li.revealed')).toHaveCount(1);
});

test('the solution of a Missing puzzle lines through every placed word and shows the missing one red until flipped back', async ({ page }) => {
  await openMissing(page);
  await tapAll(page, [[4, 2], [2, 2]]);
  const flip = page.locator('#flip');

  await flip.click();
  await expect(page.locator('#solution-label')).toHaveText('Missing · Solution');
  await expect(page.locator('#solution-overlay line.mark-found')).toHaveCount(8);
  await expect(goat(page)).toHaveClass(/revealed/);
  await expect(goat(page)).toHaveCSS('color', REVEAL_RED);

  await flip.click();
  await expect(goat(page)).not.toHaveClass(/revealed/);
  await expect(page.locator('#words li', { hasText: 'Cat' })).toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('1/8');
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(1);
});

test('a puzzle with no missing word shows nothing red, finished or flipped', async ({ page }) => {
  await openIn(page, 'bottom');
  await page.locator('#flip').click();
  await expect(page.locator('#words li.revealed')).toHaveCount(0);
  await page.locator('#flip').click();
  for (const ends of ALL_WORDS) await tapAll(page, ends);
  await expect(page.locator('#count')).toHaveText('8/8');
  await expect(page.locator('#words li.revealed')).toHaveCount(0);
});

// ---- A puzzle with wildcards ----

// The fixture as a Wildcards puzzle: Cat's A (row 3, col 2) and Ice cream's second C (row 0, col 3) show ?.
const WILD_PUZZLE = { ...PUZZLE, type: 'Wildcards', grids: [{ rows: PUZZLE.grids[0].rows, wildcards: [{ row: 3, col: 2 }, { row: 0, col: 3 }] }] };
const solutionCell = (page, r, c) => page.locator('#solution-grid .cell').nth(r * COLS + c);

test('a Wildcards puzzle shows ? at its wildcards, letter-sized, and says Wildcards in the band', async ({ page }) => {
  await open(page, null, WILD_PUZZLE);
  await expect(page.locator('#label')).toHaveText('Wildcards');
  await expect(cell(page, 3, 2)).toHaveText('?');
  await expect(cell(page, 0, 3)).toHaveText('?');
  await expect(page.locator('#grid .cell', { hasText: '?' })).toHaveCount(2);
  await expect(page.locator('#grid .cell.wild')).toHaveCount(2);
  await expect(cell(page, 3, 2)).toHaveAttribute('aria-label', '?, row 4, column 3');

  const size = locator => locator.evaluate(el => {
    const s = getComputedStyle(el);
    return [s.fontSize, s.fontWeight, el.getBoundingClientRect().width, el.getBoundingClientRect().height];
  });
  expect(await size(cell(page, 3, 2))).toEqual(await size(cell(page, 3, 1)));
  await expect(cell(page, 3, 2)).toHaveCSS('color', 'rgb(31, 111, 92)');
  await expect(cell(page, 3, 1)).toHaveCSS('color', FOUND_INK);
});

test('a word through a ? is found and crossed off, and the ? stays a ?', async ({ page }) => {
  await open(page, null, WILD_PUZZLE);
  await tapAll(page, [[4, 2], [2, 2]]);
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(1);
  await expect(page.locator('#words li', { hasText: 'Cat' })).toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('1/8');
  await expect(cell(page, 3, 2)).toHaveText('?');
});

test('the solution of a Wildcards puzzle shows every real letter, lined through; flipping back the ?s return with the found words', async ({ page }) => {
  await open(page, null, WILD_PUZZLE);
  await tapAll(page, [[4, 2], [2, 2]]);
  await page.locator('#flip').click();
  await expect(page.locator('#solution-label')).toHaveText('Wildcards · Solution');
  await expect(page.locator('#solution-grid .cell', { hasText: '?' })).toHaveCount(0);
  await expect(solutionCell(page, 3, 2)).toHaveText('A');
  await expect(solutionCell(page, 0, 3)).toHaveText('C');
  await expect(page.locator('#solution-grid .cell.wild')).toHaveCount(0);
  await expect(page.locator('#solution-overlay line.mark-found')).toHaveCount(8);

  await page.locator('#flip').click();
  await expect(cell(page, 3, 2)).toHaveText('?');
  await expect(cell(page, 0, 3)).toHaveText('?');
  await expect(page.locator('#words li', { hasText: 'Cat' })).toHaveClass(/done/);
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(1);
  await expect(page.locator('#count')).toHaveText('1/8');
});

test('every word of a Wildcards puzzle can be found, completing it', async ({ page }) => {
  await open(page, null, WILD_PUZZLE);
  for (const ends of ALL_WORDS) await tapAll(page, ends);
  await expect(page.locator('#count')).toHaveText('8/8');
  await expect(page.locator('#complete')).toBeVisible();
  await expect(page.locator('#grid .cell', { hasText: '?' })).toHaveCount(2);
});

test('a puzzle with no wildcards shows no ?, on either side', async ({ page }) => {
  await open(page);
  await expect(page.locator('#grid .cell', { hasText: '?' })).toHaveCount(0);
  await expect(page.locator('#grid .cell.wild')).toHaveCount(0);
  await expect(cell(page, 3, 2)).toHaveText('A');
  await expect(solutionCell(page, 3, 2)).toHaveText('A');
});

test('a Wildcards puzzle prints its ?s in black, letter-sized', async ({ page }) => {
  await open(page, null, WILD_PUZZLE);
  await page.emulateMedia({ media: 'print' });
  await expect(cell(page, 3, 2)).toHaveText('?');
  await expect(cell(page, 3, 2)).toHaveCSS('color', 'rgb(0, 0, 0)');
});

// ---- A puzzle with repeated words ----

// Sheep 45 times on a 15 × 15 grid: three to a row, rows alternately forwards and backwards.
const SHEEP_COLS = 15;
const SHEEP_ENDS = Array.from({ length: 45 }, (_, i) => {
  const row = Math.floor(i / 3), col = (i % 3) * 5;
  return [[row, col + (row % 2) * 4], [row, col + 4 - (row % 2) * 4]];
});
const SHEEP_PUZZLE = {
  ...PUZZLE, type: 'Repeats', title: 'Sheep',
  grids: [{ rows: Array.from({ length: 15 }, (_, r) => ['SHEEP', 'PEEHS'][r % 2].repeat(3)) }],
  words: SHEEP_ENDS.map(([start, end]) => ({
    word: 'Sheep', grid: 0, start: { row: start[0], col: start[1] }, direction: end[1] > start[1] ? 'E' : 'W', length: 5
  }))
};
// Cup five times among Cow and Hen.
const cup = (row, col, direction) => ({ word: 'Cup', grid: 0, start: { row, col }, direction, length: 3 });
const CUP_PUZZLE = {
  ...PUZZLE, type: 'Repeats', title: 'Cups',
  grids: [{ rows: ['CUPTCUPL', 'PUCHENRT', 'CTLCOWLR', 'URTLRTRL', 'PLRTCUPT', 'TRLRTLRL', 'LTRTLRTR', 'RLTLRTLR'] }],
  words: [
    { word: 'Cow', grid: 0, start: { row: 2, col: 3 }, direction: 'E', length: 3 },
    cup(0, 0, 'E'), cup(0, 4, 'E'), cup(1, 2, 'W'), cup(2, 0, 'S'), cup(4, 4, 'E'),
    { word: 'Hen', grid: 0, start: { row: 1, col: 3 }, direction: 'E', length: 3 }
  ]
};
const sheepCell = (page, r, c) => page.locator('#grid .cell').nth(r * SHEEP_COLS + c);
const progress = (page, word) => page.locator('#words li', { hasText: word }).locator('.progress');
// Each listed word as the paper reads it: the word, then its count of copies when it carries one.
const printedLines = page => page.locator('#words li').evaluateAll(lis => lis.map(li => {
  const count = getComputedStyle(li, '::after').content;
  return li.firstChild.textContent + (count === 'none' ? '' : ' ' + JSON.parse(count));
}));
// Once the fonts are in, the page sizes paper's word columns.
const columnsSized = page => expect(page.locator('#words')).toHaveAttribute('style', /--print-word-w/);
// On paper: the columns' width, the words laid out wider than their column — running into the
// next — and how many lines each word takes, by its text.
async function printedFit(page) {
  await columnsSized(page);
  await page.emulateMedia({ media: 'print' });
  return page.locator('#words').evaluate(ul => {
    const lis = Array.from(ul.children);
    const one = Math.min(...lis.map(li => li.getBoundingClientRect().height));
    // A printed word's box grows to hold its widest unbreakable piece, count and all, so it runs
    // into the next when that box is wider than its column: as many columns of column-width as
    // fit across the list, stretched to fill it.
    const css = getComputedStyle(ul);
    const gap = parseFloat(css.columnGap), want = parseFloat(css.columnWidth);
    const count = Math.max(1, Math.floor((ul.clientWidth + gap) / (want + gap)));
    const column = (ul.clientWidth - (count - 1) * gap) / count;
    return {
      want,
      over: lis.filter(li => li.getBoundingClientRect().width > column + 0.5).map(li => li.firstChild.textContent),
      lines: Object.fromEntries(lis.map(li => [li.firstChild.textContent, Math.round(li.getBoundingClientRect().height / one)]))
    };
  });
}

// Opens a Repeats puzzle with the words under the grid, so the list is always in view.
async function openRepeats(page, puzzle) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, 'bottom']);
  await open(page, null, puzzle);
}

async function findSheep(page, ends) {
  for (const [r, c] of ends) await sheepCell(page, r, c).click();
}

test('a Sheep ×45 puzzle lists Sheep once with 0/45 beside it, and says Repeats in the band', async ({ page }) => {
  await openRepeats(page, SHEEP_PUZZLE);
  await expect(page.locator('#label')).toHaveText('Repeats');
  await expect(page.locator('#words li')).toHaveCount(1);
  await expect(page.locator('#words li')).toHaveText('Sheep0/45');
  await expect(progress(page, 'Sheep')).toBeVisible();
  await expect(page.locator('#count')).toHaveText('0/45');
});

test('one copy of Sheep is lined through and reads 1/45; finding that copy again changes nothing', async ({ page }) => {
  await openRepeats(page, SHEEP_PUZZLE);
  await findSheep(page, SHEEP_ENDS[4]);
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(1);
  await expect(progress(page, 'Sheep')).toHaveText('1/45');
  await expect(page.locator('#words li')).not.toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('1/45');

  await findSheep(page, SHEEP_ENDS[4]);
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(1);
  await expect(progress(page, 'Sheep')).toHaveText('1/45');
  await expect(page.locator('#count')).toHaveText('1/45');
});

test('finding all 45 copies crosses Sheep off and sparkles', async ({ page }) => {
  await openRepeats(page, SHEEP_PUZZLE);
  for (const ends of SHEEP_ENDS.slice(0, -1)) await findSheep(page, ends);
  await expect(progress(page, 'Sheep')).toHaveText('44/45');
  await expect(page.locator('#words li')).not.toHaveClass(/done/);
  await expect(page.locator('#complete')).toBeHidden();

  await findSheep(page, SHEEP_ENDS[44]);
  await expect(progress(page, 'Sheep')).toHaveText('45/45');
  await expect(page.locator('#words li')).toHaveClass(/done/);
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(45);
  await expect(page.locator('#complete')).toBeVisible();
  await expect(page.locator('#board .spark')).toHaveCount(28);
});

test('Cup with 5 copies shows 0/5, the other words show as before, and the count covers every copy', async ({ page }) => {
  await openRepeats(page, CUP_PUZZLE);
  await expect(page.locator('#words li')).toHaveText(['Cow', 'Cup0/5', 'Hen']);
  await expect(progress(page, 'Cup')).toBeVisible();
  await expect(progress(page, 'Cow')).toBeHidden();
  await expect(progress(page, 'Hen')).toBeHidden();
  await expect(page.locator('#count')).toHaveText('0/7');

  await tapAll(page, [[1, 2], [1, 0]]);
  await tapAll(page, [[2, 3], [2, 5]]);
  await expect(progress(page, 'Cup')).toHaveText('1/5');
  await expect(page.locator('#words li', { hasText: 'Cow' })).toHaveClass(/done/);
  await expect(page.locator('#words li', { hasText: 'Cup' })).not.toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('2/7');
});

test('the solution lines through every copy; flipping back, the found copies are intact', async ({ page }) => {
  await openRepeats(page, SHEEP_PUZZLE);
  await findSheep(page, SHEEP_ENDS[0]);
  await findSheep(page, SHEEP_ENDS[7]);
  await page.locator('#flip').click();
  await expect(page.locator('#solution-label')).toHaveText('Repeats · Solution');
  await expect(page.locator('#solution-overlay line.mark-found')).toHaveCount(45);

  await page.locator('#flip').click();
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(2);
  await expect(progress(page, 'Sheep')).toHaveText('2/45');
  await expect(page.locator('#count')).toHaveText('2/45');
});

test('a puzzle where every word has one copy shows no progress beside any word', async ({ page }) => {
  await openIn(page, 'bottom');
  await expect(page.locator('#words li .progress')).toHaveCount(8);
  for (const p of await page.locator('#words li .progress').all()) await expect(p).toBeHidden();
  await tapAll(page, [[4, 2], [2, 2]]);
  for (const p of await page.locator('#words li .progress').all()) await expect(p).toBeHidden();
});

test('the printout leaves the progress off, as it does the count', async ({ page }) => {
  await openRepeats(page, CUP_PUZZLE);
  await tapAll(page, [[1, 2], [1, 0]]);
  await page.emulateMedia({ media: 'print' });
  await expect(progress(page, 'Cup')).toBeHidden();
  await expect(page.locator('#words li', { hasText: 'Cup' })).toBeVisible();
});

test('a printed Sheep puzzle lists Sheep once, as Sheep ×45', async ({ page }) => {
  await openRepeats(page, SHEEP_PUZZLE);
  await page.emulateMedia({ media: 'print' });
  expect(await printedLines(page)).toEqual(['Sheep ×45']);
});

test('a printed Cup puzzle reads Cup ×5 on its one line, and Cow and Hen as before', async ({ page }) => {
  await openRepeats(page, CUP_PUZZLE);
  await page.emulateMedia({ media: 'print' });
  expect(await printedLines(page)).toEqual(['Cow', 'Cup ×5', 'Hen']);
  const heights = await page.locator('#words li').evaluateAll(lis => lis.map(li => li.getBoundingClientRect().height));
  expect(new Set(heights).size).toBe(1);
});

test('printed after finding copies on screen, the sheet still reads Sheep ×45, never the progress', async ({ page }) => {
  await openRepeats(page, SHEEP_PUZZLE);
  for (const ends of SHEEP_ENDS.slice(0, 12)) await findSheep(page, ends);
  await expect(progress(page, 'Sheep')).toHaveText('12/45');
  await page.emulateMedia({ media: 'print' });
  expect(await printedLines(page)).toEqual(['Sheep ×45']);
  await expect(progress(page, 'Sheep')).toBeHidden();
});

test('a puzzle with no repeated word prints every word alone, nothing after it', async ({ page }) => {
  await open(page);
  await page.emulateMedia({ media: 'print' });
  expect(await printedLines(page)).toEqual(['Cat', 'Cow', 'Ewe', 'Hen', 'Ice cream', 'Map', 'Pig', 'Piglet']);
});

test('the screen never shows the printed count: Cup keeps its 0/5', async ({ page }) => {
  await openRepeats(page, CUP_PUZZLE);
  expect(await printedLines(page)).toEqual(['Cow', 'Cup', 'Hen']);
  await expect(progress(page, 'Cup')).toHaveText('0/5');
});

// A Mirra?e at a real one's size, 25 × 35, its list long words with the longest of them five times.
const LONG_WORDS = Array.from({ length: 60 }, (_, i) => 'Pachycephalosaur' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26)));
const MIRRAGE_PUZZLE = {
  ...PUZZLE, type: 'Mirra?e', title: 'Dinosaurs',
  grids: [{ rows: Array.from({ length: 35 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXY') }],
  words: LONG_WORDS.map(word => ({ word, grid: 0, start: { row: 0, col: 0 }, direction: 'E', length: 3 }))
    .concat(Array.from({ length: 4 }, () => ({ word: LONG_WORDS[0], grid: 0, start: { row: 0, col: 0 }, direction: 'E', length: 3 })))
};

for (const layout of ['bottom', 'right', 'overlay']) {
  test(`a Mirra?e-size list printed from ${layout} keeps every long word, and its ×5, on one line in its own column`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout]);
    await open(page, null, MIRRAGE_PUZZLE);
    const fit = await printedFit(page);
    expect((await printedLines(page))[0]).toBe(LONG_WORDS[0] + ' ×5');
    expect(fit.over).toEqual([]);
    expect(new Set(Object.values(fit.lines))).toEqual(new Set([1]));
    expect(fit.want).toBeGreaterThan(88);
  });
}

test('a long word in capitals gets a column wide enough for it too', async ({ page }) => {
  const caps = ['WWWWMMMMWWWW', 'MOWWOWMOM', 'Cat'];
  await openRepeats(page, { ...PUZZLE, words: caps.map(word => ({ ...PUZZLE.words[0], word })) });
  const fit = await printedFit(page);
  expect(fit.over).toEqual([]);
  expect(fit.lines).toEqual({ WWWWMMMMWWWW: 1, MOWWOWMOM: 1, Cat: 1 });
});

test('a word\'s count never leaves it: Royal blue ×5 wraps, if it must, between Royal and blue ×5', async ({ page }) => {
  const words = ['Royal blue', 'Royal blue', 'Royal blue', 'Royal blue', 'Royal blue', 'Mint'];
  await openRepeats(page, { ...PUZZLE, words: words.map(word => ({ ...PUZZLE.words[0], word })) });
  const fit = await printedFit(page);
  expect(fit.over).toEqual([]);
  // The last line holds blue and its count together: its last piece of text ends before the count starts.
  const tail = await page.locator('#words li', { hasText: 'Royal blue' }).evaluate(li => {
    const range = document.createRange();
    range.setStart(li.firstChild, li.firstChild.textContent.indexOf('blue'));
    range.setEnd(li.firstChild, li.firstChild.textContent.length);
    const blue = range.getBoundingClientRect(), box = li.getBoundingClientRect();
    return { blueBottom: Math.round(blue.bottom), boxBottom: Math.round(box.bottom) };
  });
  expect(Math.abs(tail.blueBottom - tail.boxBottom)).toBeLessThanOrEqual(2);
});

test('a list whose words all fit keeps paper\'s 88px columns, as before', async ({ page }) => {
  await openIn(page, 'bottom');
  const fit = await printedFit(page);
  expect(fit.want).toBe(88);
  expect(fit.over).toEqual([]);
});

test('a line of two words too long for its column wraps at its space, and runs into nothing', async ({ page }) => {
  const words = ['Raspberry ripple', 'Mint', 'Toffee'];
  await openRepeats(page, { ...PUZZLE, words: words.map(word => ({ ...PUZZLE.words[0], word })) });
  const fit = await printedFit(page);
  expect(fit.want).toBe(88);
  expect(fit.over).toEqual([]);
  expect(fit.lines).toEqual({ 'Raspberry ripple': 2, Mint: 1, Toffee: 1 });
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

// ---- How the words fill their card ----

// The fixture with 60 words listed: its eight, then 52 missing ones (Word 01…Word 52) — more than
// fit beside or over its grid card in one column.
const LONG_PUZZLE = {
  ...PUZZLE, type: 'Missing',
  words: [...PUZZLE.words, ...Array.from({ length: 52 }, (_, i) => ({ word: 'Word ' + String(i + 1).padStart(2, '0'), missing: true }))]
};

async function openWords(page, layout, puzzle) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout]);
  await open(page, null, puzzle);
  await expect(page.locator('#play')).toHaveAttribute('data-sits', /./);
  await page.evaluate(() => document.fonts.ready);
  await expect(toggle(page)).toBeVisible({ visible: layout === 'overlay' });
  await [() => {}, () => toggle(page).click()][Number(layout === 'overlay')]();
}

// Each word's box, in list order.
function wordBoxes(page) {
  return page.locator('#words li').evaluateAll(lis => lis.map(li => {
    const r = li.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, centre: r.left + r.width / 2 };
  }));
}

// The list's columns, in order, as runs of words sharing a centre line, each word under the one
// before; a new column starts level with the first word, to its right.
function columnsOf(boxes) {
  const columns = [[boxes[0]]];
  for (const box of boxes.slice(1)) {
    const column = columns[columns.length - 1], last = column[column.length - 1];
    if (Math.abs(box.centre - last.centre) < 1) {
      expect(box.top).toBeGreaterThan(last.top);
      column.push(box);
    } else {
      expect(box.centre).toBeGreaterThan(last.centre);
      expect(Math.abs(box.top - boxes[0].top)).toBeLessThan(1);
      columns.push([box]);
    }
  }
  return columns;
}

function expectEven(columns) {
  const lengths = columns.map(c => c.length);
  expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
}

const box = (page, selector) => page.locator(selector).boundingBox();

// Where each word sits in the words card — its centre line and top — and the card's own size:
// what a find, a cross-off or a reveal must leave as it was.
async function wordPlaces(page) {
  const card = await box(page, '#words-list');
  const at = n => Math.round(n * 10) / 10;
  return {
    card: [at(card.width), at(card.height)],
    words: (await wordBoxes(page)).map(w => [at(w.centre - card.x), at(w.top - card.y)])
  };
}

for (const layout of ['bottom', 'right', 'overlay']) {
  for (const [name, puzzle] of [['eight', PUZZLE], ['sixty', LONG_PUZZLE]]) {
    test(`in ${layout}, ${name} words read down the first column, then the next, the columns even and each word centred`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 900 });
      await openWords(page, layout, puzzle);
      const boxes = await wordBoxes(page);
      const columns = columnsOf(boxes);
      expect(columns.flat()).toHaveLength(puzzle.words.length);
      expectEven(columns);
      // Beside or over the grid, eight words fit one column down its height; under it they spread
      // across its width; sixty take more than one anywhere.
      expect(columns.length > 1).toBe(layout === 'bottom' || name === 'sixty');
      await expect(page.locator('#words li').first()).toHaveCSS('justify-self', 'center');
    });
  }
}

for (const width of [1400, 900, 600]) {
  test(`in Bottom the words card is never wider than the grid card, and a longer list makes it taller (${width}px window)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await plain(page);
    await openWords(page, 'bottom', PUZZLE);
    const stage = await box(page, '.stage');
    const short = await box(page, 'aside');
    expect(short.y).toBeGreaterThan(stage.y + stage.height);
    expect(Math.abs(short.width - stage.width)).toBeLessThan(1);
    expect(Math.abs(short.x - stage.x)).toBeLessThan(1);

    await page.unrouteAll();
    await page.route('**/content/puzzles/wordsearch/WSCH-0007.json', route => route.fulfill({ json: LONG_PUZZLE }));
    await page.reload();
    await expect(page.locator('#words li')).toHaveCount(60);
    await page.evaluate(() => document.fonts.ready);
    const long = await box(page, 'aside');
    expect(Math.abs(long.width - short.width)).toBeLessThan(1);
    expect(long.height).toBeGreaterThan(short.height);
    for (const word of await wordBoxes(page)) {
      expect(word.left).toBeGreaterThanOrEqual(long.x);
      expect(word.right).toBeLessThanOrEqual(long.x + long.width);
    }
  });
}

test('in Bottom on a screen narrower than the grid card, the words card is the screen wide, not wider', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 });
  await openWords(page, 'bottom', WIDE_PUZZLE);
  const stage = await box(page, '.stage');
  const aside = await box(page, 'aside');
  expect(aside.width).toBeLessThan(stage.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(400);
});

test('in Right the words card lines up with the grid card top and bottom; a short list leaves room under its words', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openWords(page, 'right', { ...PUZZLE, words: PUZZLE.words.slice(0, 3) });
  const stage = await box(page, '.stage');
  const aside = await box(page, 'aside');
  expect(aside.x).toBeGreaterThan(stage.x + stage.width);
  expect(Math.abs(aside.y - stage.y)).toBeLessThan(1);
  expect(Math.abs(aside.y + aside.height - (stage.y + stage.height))).toBeLessThan(1);
  const words = await wordBoxes(page);
  expect(Math.max(...words.map(w => w.bottom))).toBeLessThan(aside.y + aside.height / 2);
});

test('in Right a long list adds columns to the right instead of growing taller', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openWords(page, 'right', PUZZLE);
  const short = await box(page, 'aside');
  const shortColumns = columnsOf(await wordBoxes(page)).length;
  await page.unrouteAll();
  await page.route('**/content/puzzles/wordsearch/WSCH-0007.json', route => route.fulfill({ json: LONG_PUZZLE }));
  await page.reload();
  await expect(page.locator('#words li')).toHaveCount(60);
  await page.evaluate(() => document.fonts.ready);
  const stage = await box(page, '.stage');
  const long = await box(page, 'aside');
  expect(long.x).toBeGreaterThan(stage.x + stage.width);
  expect(Math.abs(long.y - stage.y)).toBeLessThan(1);
  expect(Math.abs(long.height - short.height)).toBeLessThan(1);
  expect(long.width).toBeGreaterThan(short.width);
  expect(columnsOf(await wordBoxes(page)).length).toBeGreaterThan(shortColumns);
  for (const word of await wordBoxes(page)) expect(word.bottom).toBeLessThanOrEqual(long.y + long.height);
});

test('in Right on a screen too narrow for the columns beside the grid, the list drops under it as Bottom', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await openWords(page, 'right', WIDE_PUZZLE);
  await expect(page.locator('#play')).toHaveAttribute('data-words', 'right');
  const stage = await box(page, '.stage');
  const aside = await box(page, 'aside');
  expect(aside.y).toBeGreaterThan(stage.y + stage.height);
  expect(aside.width).toBeLessThanOrEqual(stage.width);
  expectEven(columnsOf(await wordBoxes(page)));
});

// The fixture 25 columns wide, as a Mirrorise grid is: a grid card wider than the site's 1080px page.
const WIDE_25_PUZZLE = { ...PUZZLE, grids: [{ rows: PUZZLE.grids[0].rows.map(row => row.repeat(4).slice(0, 25)) }] };

test('in Right a 25-column grid has its words beside it whenever the window is wide enough for both', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openWords(page, 'right', WIDE_25_PUZZLE);
  const stage = await box(page, '.stage');
  expect(stage.width).toBeGreaterThan(1080);
  const aside = await box(page, 'aside');
  expect(aside.x).toBeGreaterThan(stage.x + stage.width);
  expect(Math.abs(aside.y - stage.y)).toBeLessThan(1);
  expect(aside.x + aside.width).toBeLessThanOrEqual(1400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1400);
});

// A Mirrorise-size puzzle: 25 × 35 letters and 140 words, too many to sit beside the grid at
// its own letter size on a 1440px screen.
const MIRRORISE_SIZE_PUZZLE = {
  ...LONG_PUZZLE,
  grids: [{ rows: Array.from({ length: 35 }, (_, r) => PUZZLE.grids[0].rows[r % 8].repeat(4).slice(0, 25)) }],
  words: [...PUZZLE.words, ...Array.from({ length: 132 }, (_, i) => ({ word: 'Something long ' + String(i + 1).padStart(3, '0'), missing: true }))]
};
const letterSize = page => page.locator('#grid .cell').first().evaluate(c => c.getBoundingClientRect().width);

test('in Right a big grid\'s words shrink to 13px, then its letters, until the words fit beside it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWords(page, 'bottom', MIRRORISE_SIZE_PUZZLE);
  const own = await letterSize(page);
  await expect(page.locator('#words li').first()).toHaveCSS('font-size', '16px');

  await layoutButton(page).click();
  await expect(page.locator('#play')).toHaveAttribute('data-sits', 'right');
  const shrunk = await letterSize(page);
  expect(shrunk).toBeLessThan(own);
  expect(shrunk).toBeGreaterThanOrEqual(26);
  await expect(page.locator('#words li').first()).toHaveCSS('font-size', '13px');
  const stage = await box(page, '.stage');
  const aside = await box(page, 'aside');
  expect(aside.x).toBeGreaterThan(stage.x + stage.width);
  expect(Math.abs(aside.y - stage.y)).toBeLessThan(1);
  expect(Math.abs(aside.height - stage.height)).toBeLessThan(1);
  expect(aside.x + aside.width).toBeLessThanOrEqual(1440);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
  for (const word of await wordBoxes(page)) expect(word.right).toBeLessThanOrEqual(aside.x + aside.width);
  expectEven(columnsOf(await wordBoxes(page)));

  await layoutButton(page).click();
  await expect(page.locator('#play')).toHaveAttribute('data-sits', 'overlay');
  expect(await letterSize(page)).toBe(own);
  await toggle(page).click();
  await expect(page.locator('#words li').first()).toHaveCSS('font-size', '16px');
});

test('in Right a list a little too wide shrinks its words, and the grid keeps its letters', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openWords(page, 'right', LONG_PUZZLE);
  const own = await letterSize(page);
  const stage = await box(page, '.stage');
  const aside = await box(page, 'aside');
  await expect(page.locator('#words li').first()).toHaveCSS('font-size', '16px');
  // A window a few pixels narrower than grid, gap and words need, with the page's 24px edges.
  const needed = aside.x + aside.width - stage.x;
  await page.setViewportSize({ width: Math.floor(needed + 48 - 4), height: 900 });
  await expect(async () => {
    const size = parseFloat(await page.locator('#words li').first().evaluate(li => getComputedStyle(li).fontSize));
    expect(size).toBeLessThan(16);
    expect(size).toBeGreaterThanOrEqual(13);
  }).toPass();
  await expect(page.locator('#play')).toHaveAttribute('data-sits', 'right');
  expect(await letterSize(page)).toBe(own);
});

test('in Right the letters shrink no smaller than 26px: a window too narrow even then has the words under the grid, its letters their own size', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await openWords(page, 'bottom', WIDE_PUZZLE);
  const own = await letterSize(page);
  await layoutButton(page).click();
  await expect(page.locator('#play')).toHaveAttribute('data-words', 'right');
  await expect(page.locator('#play')).toHaveAttribute('data-sits', 'bottom');
  expect(await letterSize(page)).toBe(own);
});

test('in Right a list that needs more room beside the grid than the window has, even at the smallest letters, drops under, and comes back beside when widened', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openWords(page, 'right', LONG_PUZZLE);
  const stage = await box(page, '.stage');
  expect((await box(page, 'aside')).x).toBeGreaterThan(stage.x + stage.width);

  await page.setViewportSize({ width: 600, height: 900 });
  await expect(async () => {
    const now = await box(page, '.stage');
    expect((await box(page, 'aside')).y).toBeGreaterThan(now.y + now.height);
  }).toPass();
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(async () => expect((await box(page, 'aside')).x).toBeGreaterThan((await box(page, '.stage')).x + stage.width)).toPass();
});

test('in Overlay a list fills the grid card\'s height before it adds a column, leaving no wasted room below', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openWords(page, 'overlay', { ...LONG_PUZZLE, words: LONG_PUZZLE.words.slice(0, 30) });
  const list = await box(page, '#words');
  const columns = columnsOf(await wordBoxes(page));
  expect(columns.length).toBeGreaterThan(1);
  // As few columns as the card's height allows: one fewer, full to the foot, couldn't hold them.
  const pitch = columns[0][1].top - columns[0][0].top;
  const rows = Math.floor((list.y + list.height - columns[0][0].top) / pitch);
  expect((columns.length - 1) * rows).toBeLessThan(30);
  expect(Math.max(...columns.map(c => c.length))).toBeLessThanOrEqual(rows);
});

test('in Overlay the list lies over the grid card at its size, and a long list scrolls down inside it to every word, never sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openWords(page, 'overlay', LONG_PUZZLE);
  const card = await box(page, '.card');
  const cover = await box(page, '#words-list');
  expect(cover).toEqual(card);
  const scroll = await page.locator('#words').evaluate(ul => ({ down: ul.scrollHeight - ul.clientHeight, across: ul.scrollWidth - ul.clientWidth }));
  expect(scroll.down).toBeGreaterThan(0);
  expect(scroll.across).toBe(0);
  for (const word of await wordBoxes(page)) {
    expect(word.left).toBeGreaterThanOrEqual(cover.x);
    expect(word.right).toBeLessThanOrEqual(cover.x + cover.width);
  }
  const last = page.locator('#words li').last();
  await expect(last).not.toBeInViewport();
  await page.locator('#words').evaluate(ul => ul.scrollTo(0, ul.scrollHeight));
  const list = await box(page, '#words');
  const lastBox = await last.boundingBox();
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(list.y + list.height + 0.5);
  expect((await box(page, '#words-list'))).toEqual(card);
});

for (const layout of ['bottom', 'right', 'overlay']) {
  test(`in ${layout}, finding, crossing off and revealing words moves no word`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await openWords(page, layout, MISSING_PUZZLE);
    const before = await wordPlaces(page);
    await [() => {}, () => toggle(page).click()][Number(layout === 'overlay')]();
    for (const ends of ALL_WORDS.slice(0, 3)) await tapAll(page, ends);
    await page.locator('#flip').click();
    await expect(goat(page)).toHaveClass(/revealed/);
    await page.locator('#flip').click();
    for (const ends of ALL_WORDS.slice(3)) await tapAll(page, ends);
    await expect(goat(page)).toHaveClass(/revealed/);
    await [() => {}, () => toggle(page).click()][Number(layout === 'overlay')]();
    await expect(page.locator('#words li.done')).toHaveCount(8);
    expect(await wordPlaces(page)).toEqual(before);
  });
}

test('a repeated word stays put as its count of copies found grows', async ({ page }) => {
  await openRepeats(page, SHEEP_PUZZLE);
  const before = await wordBoxes(page);
  for (const ends of SHEEP_ENDS.slice(0, 10)) await findSheep(page, ends);
  await expect(progress(page, 'Sheep')).toHaveText('10/45');
  const after = await wordBoxes(page);
  expect(after[0].left).toBe(before[0].left);
  expect(after[0].right).toBe(before[0].right);
});

// ---- On a phone ----

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

// ---- Print ----

// A grid twice as tall and wide as a big real one: it must still print on one page.
const BIG_PUZZLE = { ...PUZZLE, grids: [{ rows: Array.from({ length: 30 }, (_, r) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCD'.slice(r % 4) + 'WXYZ'.slice(0, r % 4)) }] };

function pdfPages(pdf) {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
}

// Plays every on-screen state print has to ignore: a found word, a red line with its circle, and the flip.
async function messUp(page) {
  await tapAll(page, [[4, 2], [2, 2], [0, 0], [0, 3]]);
  await page.locator('#flip').click();
}

async function printedBoxes(page) {
  await page.emulateMedia({ media: 'print' });
  const box = selector => page.locator(selector).boundingBox();
  return { title: await box('#title'), created: await box('#created'), type: await box('#label'),
    grid: await box('#grid'), words: await box('#words-list') };
}

test('Print in the menu opens the browser\'s print dialog and closes the menu', async ({ page }) => {
  await page.addInitScript(() => { window.printed = 0; window.print = () => { window.printed += 1; }; });
  await open(page);
  await page.locator('.site .burger').click();
  await page.locator('#site-menu > *', { hasText: 'Print' }).click();
  expect(await page.evaluate(() => window.printed)).toBe(1);
  await expect(page.locator('#site-menu')).toBeHidden();
});

for (const layout of ['bottom', 'right', 'overlay']) {
  test(`the printout is title, date and type, then the grid, then the words beneath it, from ${layout}`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await openIn(page, layout);
    const b = await printedBoxes(page);
    expect(b.created.y).toBeGreaterThanOrEqual(b.title.y + b.title.height);
    expect(b.type.y).toBeGreaterThanOrEqual(b.created.y + b.created.height);
    expect(b.grid.y).toBeGreaterThan(b.type.y + b.type.height);
    expect(b.words.y).toBeGreaterThan(b.grid.y + b.grid.height);
    await expect(page.locator('#words li')).toHaveCount(8);
    await expect(page.locator('#words li').first()).toBeVisible();
  });
}

test('the printout is the site\'s cards in black and white, with no site bar, menu, corner buttons or count', async ({ page }) => {
  await open(page);
  await page.emulateMedia({ media: 'print' });
  for (const selector of ['.site', '.burger', '#flip', '#words-layout', '#words-toggle', '#count', '#back']) {
    await expect(page.locator(selector)).toBeHidden();
  }
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(cell(page, 0, 0)).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(page.locator('#title')).toHaveCSS('color', 'rgb(0, 0, 0)');
  for (const selector of ['#front', '.words-box']) {
    await expect(page.locator(selector)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator(selector)).toHaveCSS('border-top', '2px solid rgb(0, 0, 0)');
    await expect(page.locator(selector)).toHaveCSS('border-radius', '14px');
    await expect(page.locator(selector)).toHaveCSS('box-shadow', 'rgb(0, 0, 0) 4px 4px 0px 0px');
  }
  for (const selector of ['#label', '.list-head']) {
    await expect(page.locator(selector)).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  }
  await expect(page.locator('#label')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('.list-head h2')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('html')).toHaveCSS('print-color-adjust', 'exact');
});

test('the printout marks the hidden ID small under the words card\'s right corner; the screen never shows it', async ({ page }) => {
  await open(page);
  const mark = () => page.locator('#words-list').evaluate(el => {
    const s = getComputedStyle(el, '::after');
    return { content: s.content, size: parseFloat(s.fontSize), align: s.textAlign };
  });
  expect((await mark()).content).toBe('none');
  await expect(page.locator('body')).not.toContainText('WSCH');

  await page.emulateMedia({ media: 'print' });
  const printed = await mark();
  expect(printed.content).toBe('"WSCH-0007"');
  expect(printed.align).toBe('right');
  expect(printed.size).toBeLessThan(parseFloat(await page.locator('#words li').first().evaluate(li => getComputedStyle(li).fontSize)));
});

test('the printed words read down each column, then on to the next', async ({ page }) => {
  await open(page);
  await page.emulateMedia({ media: 'print' });
  // Each word is centred in its column, so a column shares a centre line.
  const boxes = await page.locator('#words li').evaluateAll(lis => lis.map(li => {
    const r = li.getBoundingClientRect();
    return { centre: r.left + r.width / 2, top: r.top };
  }));
  expect(Math.abs(boxes[1].centre - boxes[0].centre)).toBeLessThan(1);
  expect(boxes[1].top).toBeGreaterThan(boxes[0].top);
  expect(boxes[boxes.length - 1].centre).toBeGreaterThan(boxes[0].centre + 20);
});

test('the printout is the clean puzzle whatever was found, selected or flipped on screen', async ({ page }) => {
  await open(page);
  await messUp(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#back')).toBeHidden();
  await expect(page.locator('#card')).toHaveCSS('transform', 'none');
  await expect(page.locator('#words li', { hasText: 'Cat' })).toHaveCSS('text-decoration-line', 'none');
  await expect(page.locator('#words li', { hasText: 'Cat' })).toHaveCSS('color', 'rgb(0, 0, 0)');
});

test('a finished puzzle prints without Puzzle complete or its sparkles', async ({ page }) => {
  await open(page);
  for (const ends of ALL_WORDS) await tapAll(page, ends);
  await expect(page.locator('#complete')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#complete')).toBeHidden();
  await expect(page.locator('#board .spark').first()).toBeHidden();
});

test('in Overlay with the list open, the printout still puts the words beneath the grid', async ({ page }) => {
  await open(page);
  await toggle(page).click();
  const b = await printedBoxes(page);
  expect(b.words.y).toBeGreaterThan(b.grid.y + b.grid.height);
});

test('after printing, the screen is as the player left it', async ({ page }) => {
  await open(page);
  await messUp(page);
  const before = await page.locator('#overlay').innerHTML();
  await page.emulateMedia({ media: 'print' });
  await page.emulateMedia({ media: 'screen' });
  await expect(page.locator('#card')).toHaveClass(/flipped/);
  await expect(page.locator('#flip')).toBeVisible();
  expect(await page.locator('#overlay').innerHTML()).toBe(before);
  await expect(page.locator('#words li', { hasText: 'Cat' })).toHaveClass(/done/);
  await expect(page.locator('#play')).toHaveAttribute('data-words', 'overlay');
});

for (const format of ['A4', 'Letter']) {
  for (const [name, puzzle] of [['the puzzle', PUZZLE], ['a 30×30 puzzle', BIG_PUZZLE]]) {
    test(`${name} prints on one ${format} page, its letters saved as text`, async ({ page }) => {
      // Wide enough to play the 30×30 on screen first; print sizes it to the page whatever the window.
      await page.setViewportSize({ width: 1800, height: 900 });
      await page.addInitScript(key => localStorage.setItem(key, 'right'), LAYOUT_KEY);
      await open(page, null, puzzle);
      await expect(cell(page, 0, 0)).toBeVisible();
      await messUp(page);
      const pdf = await page.pdf({ format });
      expect(pdfPages(pdf)).toBe(1);
      expect(pdf.toString('latin1')).toContain('/ToUnicode');
    });
  }
}

// ---- A puzzle of several grids ----

// The fixture as a 3-page Saga: its eight words spread over three copies of its grid, told apart
// by the bottom-right letter — R, S, T — which sits in no word.
const SAGA_PAGES = { Cat: 0, Cow: 0, Ewe: 0, Hen: 1, 'Ice cream': 1, Map: 1, Pig: 2, Piglet: 2 };
const SAGA = {
  ...PUZZLE, type: 'Saga', title: 'Farm Saga',
  words: PUZZLE.words.map(w => ({ ...w, grid: SAGA_PAGES[w.word] })),
  grids: ['R', 'S', 'T'].map(corner => ({ rows: PUZZLE.grids[0].rows.map((row, r) => (r === 7 ? row.slice(0, 7) + corner : row)) }))
};
// Each word's ends, in ALL_WORDS's order (Cat, Cow, Ewe, Hen, Ice cream, Map, Pig, Piglet), with its page.
const SAGA_ENDS = ALL_WORDS.map((ends, i) => [[0, 0, 0, 1, 1, 1, 2, 2][i], ends]);
const HEN = ALL_WORDS[3];
const tabs = page => page.locator('#tabs .tab');
const solutionTabs = page => page.locator('#solution-tabs .tab');

async function openSaga(page, layout) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout || 'bottom']);
  await open(page, null, SAGA);
}

async function findOnPage(page, number, ends) {
  await tabs(page).nth(number).click();
  await tapAll(page, ends);
}

test('a 3-page puzzle shows tabs Page 1 · Page 2 · Page 3 above the grid, Page 1 picked, and every word from all three', async ({ page }) => {
  await openSaga(page);
  await expect(tabs(page)).toHaveText(['Page 1', 'Page 2', 'Page 3']);
  await expect(tabs(page).nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 7, 7)).toHaveText('R');
  await expect(page.locator('#words li')).toHaveText(['Cat', 'Cow', 'Ewe', 'Hen', 'Ice cream', 'Map', 'Pig', 'Piglet']);
  await expect(page.locator('#count')).toHaveText('0/8');

  const band = await page.locator('#label').boundingBox();
  const row = await page.locator('#tabs').boundingBox();
  const grid = await page.locator('#grid').boundingBox();
  const card = await page.locator('#front').boundingBox();
  expect(row.y).toBeGreaterThanOrEqual(band.y + band.height);
  expect(grid.y).toBeGreaterThanOrEqual(row.y + row.height);
  expect(row.x).toBeGreaterThanOrEqual(card.x);
  expect(row.x + row.width).toBeLessThanOrEqual(card.x + card.width);
});

test('the picked tab is filled in the band\'s green, the others white, all in the Banded outline', async ({ page }) => {
  await openSaga(page);
  await expect(tabs(page).nth(0)).toHaveCSS('background-color', 'rgb(31, 111, 92)');
  await expect(tabs(page).nth(0)).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(tabs(page).nth(1)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(tabs(page).nth(1)).toHaveCSS('border-top', '2px solid rgb(15, 42, 36)');
});

test('switching tabs changes the grid and leaves the word list exactly as it was', async ({ page }) => {
  await openSaga(page);
  await tapAll(page, ALL_WORDS[0]);
  const list = await page.locator('#words-list').innerHTML();
  await tabs(page).nth(1).click();
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs(page).nth(0)).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 7, 7)).toHaveText('S');
  await tabs(page).nth(2).click();
  await expect(cell(page, 7, 7)).toHaveText('T');
  await expect(page.locator('#grid .cell')).toHaveCount(64);
  expect(await page.locator('#words-list').innerHTML()).toBe(list);
});

test('the words card takes its size from the grid card with its tabs, and switching tabs never resizes it', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await plain(page);
  await openSaga(page, 'bottom');
  await expect(tabs(page)).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  const stage = await page.locator('.stage').boundingBox();
  const tabRow = await page.locator('#tabs').boundingBox();
  expect(tabRow.y).toBeGreaterThan(stage.y);
  const under = await page.locator('aside').boundingBox();
  expect(Math.abs(under.width - stage.width)).toBeLessThan(1);
  await tabs(page).nth(2).click();
  expect(await page.locator('aside').boundingBox()).toEqual(under);

  await page.locator('#words-layout').click();
  await expect(page.locator('#play')).toHaveAttribute('data-sits', 'right');
  const beside = await page.locator('aside').boundingBox();
  expect(Math.abs(beside.y - stage.y)).toBeLessThan(1);
  expect(Math.abs(beside.height - stage.height)).toBeLessThan(1);
  await tabs(page).nth(1).click();
  expect(await page.locator('aside').boundingBox()).toEqual(beside);
});

test('a word found on Page 2 is crossed off, and its line is still on Page 2 after a trip to Page 1', async ({ page }) => {
  await openSaga(page);
  await findOnPage(page, 1, HEN);
  await expect(page.locator('#words li', { hasText: 'Hen' })).toHaveClass(/done/);
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(1);

  await tabs(page).nth(0).click();
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(0);
  await expect(page.locator('#words li', { hasText: 'Hen' })).toHaveClass(/done/);

  await tabs(page).nth(1).click();
  const line = page.locator('#overlay line.mark-found');
  await expect(line).toHaveCount(1);
  expect(await lineEnds(line)).toEqual([3.5, 6.5, 5.5, 4.5]);
  await expect(page.locator('#count')).toHaveText('1/8');
});

test('only the words placed on the grid on show can be found', async ({ page }) => {
  await openSaga(page);
  await tapAll(page, HEN);
  await expect(page.locator('#overlay line.mark-wrong')).toHaveCount(1);
  await expect(page.locator('#words li', { hasText: 'Hen' })).not.toHaveClass(/done/);
  await expect(page.locator('#count')).toHaveText('0/8');
});

test('turning the page drops an open selection', async ({ page }) => {
  await openSaga(page);
  await tapAll(page, [[0, 0], [0, 3]]);
  await tabs(page).nth(1).click();
  await tabs(page).nth(0).click();
  await expect(page.locator('#overlay > *')).toHaveCount(0);
});

test('finding every word across all three pages plays the completion sparkle, and not before', async ({ page }) => {
  await openSaga(page);
  for (const [number, ends] of SAGA_ENDS.slice(0, -1)) await findOnPage(page, number, ends);
  await expect(page.locator('#count')).toHaveText('7/8');
  await expect(page.locator('#complete')).toBeHidden();
  await findOnPage(page, ...SAGA_ENDS[SAGA_ENDS.length - 1]);
  await expect(page.locator('#count')).toHaveText('8/8');
  await expect(page.locator('#complete')).toBeVisible();
  await expect(page.locator('#board .spark')).toHaveCount(28);
});

test('flipped, each tab shows its own page\'s solution; flipping back, the finds are intact on every page', async ({ page }) => {
  await openSaga(page);
  await findOnPage(page, 0, ALL_WORDS[0]);
  await findOnPage(page, 1, HEN);
  await page.locator('#flip').click();
  await expect(page.locator('#solution-label')).toHaveText('Saga · Solution');
  await expect(solutionTabs(page)).toHaveText(['Page 1', 'Page 2', 'Page 3']);
  await expect(solutionTabs(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#solution-grid .cell').nth(63)).toHaveText('S');
  await expect(page.locator('#solution-overlay line.mark-found')).toHaveCount(3);

  for (const [number, corner, lines] of [[2, 'T', 2], [0, 'R', 3]]) {
    await solutionTabs(page).nth(number).click();
    await expect(page.locator('#card')).toHaveClass(/flipped/);
    await expect(solutionTabs(page).nth(number)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#solution-grid .cell').nth(63)).toHaveText(corner);
    await expect(page.locator('#solution-overlay line.mark-found')).toHaveCount(lines);
  }

  await page.locator('#flip').click();
  await expect(tabs(page).nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(1);
  await tabs(page).nth(1).click();
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(1);
  await expect(page.locator('#count')).toHaveText('2/8');
});

test('a Saga puzzle says Saga in the band', async ({ page }) => {
  await openSaga(page);
  await expect(page.locator('#label')).toHaveText('Saga');
});

test('a single-grid puzzle has no tabs, and its grid sits under the band as before', async ({ page }) => {
  await open(page);
  await expect(page.locator('.tab')).toHaveCount(0);
  await expect(page.locator('#tabs')).toBeHidden();
  const band = await page.locator('#label').boundingBox();
  const grid = await page.locator('#grid').boundingBox();
  expect(grid.y - (band.y + band.height)).toBeLessThan(16);
});

function wordEnd(w) {
  const step = { N: [-1, 0], NE: [-1, 1], E: [0, 1], SE: [1, 1], S: [1, 0], SW: [1, -1], W: [0, -1], NW: [-1, -1] }[w.direction];
  return [w.start.row + step[0] * (w.length - 1), w.start.col + step[1] * (w.length - 1)];
}

for (const id of ['WSCH-0001', 'WSCH-0002']) {
  const real = require(`../content/puzzles/wordsearch/${id}.json`);
  test(`${real.title}, as published, plays, flips and prints as before`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.addInitScript(key => localStorage.setItem(key, 'right'), LAYOUT_KEY);
    await page.goto(`/app/play.html?id=${id}`);
    await expect(page.locator('#title')).toHaveText(real.title);
    await expect(page.locator('#label')).toHaveText('Vanilla');
    await expect(page.locator('.tab')).toHaveCount(0);
    await expect(page.locator('#words li')).toHaveCount(new Set(real.words.map(w => w.word)).size);
    const cols = real.grids[0].rows[0].length;
    const first = real.words[0];
    for (const [r, c] of [[first.start.row, first.start.col], wordEnd(first)]) await page.locator('#grid .cell').nth(r * cols + c).click();
    await expect(page.locator('#count')).toHaveText(`1/${real.words.length}`);
    await page.locator('#flip').click();
    await expect(page.locator('#solution-overlay line.mark-found')).toHaveCount(real.words.length);
    for (const format of ['A4', 'Letter']) expect(pdfPages(await page.pdf({ format }))).toBe(1);
  });
}

// ---- Printing a puzzle of several grids ----

for (const [tab, layout] of [[0, 'bottom'], [1, 'right'], [2, 'overlay']]) {
  test(`a 3-page puzzle prints four sheets — the words, then a grid to a sheet — from Page ${tab + 1} in ${layout}, flipped and played`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await openSaga(page, layout);
    await findOnPage(page, 0, ALL_WORDS[0]);
    await findOnPage(page, tab, [[0, 0], [0, 3]]);
    await page.locator('#flip').click();
    for (const format of ['A4', 'Letter']) {
      const pdf = await page.pdf({ format });
      expect(pdfPages(pdf)).toBe(4);
      expect(pdf.toString('latin1')).toContain('/ToUnicode');
    }
  });
}

// The Saga at a real Saga's size, 15 × 25 a page, its words where they were.
const BIG_SAGA = { ...SAGA, grids: SAGA.grids.map(g => ({ rows: Array.from({ length: 25 }, (_, r) => (g.rows[r] || 'ABCDEFGH').padEnd(15, 'X')) })) };

for (const layout of ['bottom', 'right', 'overlay']) {
  test(`a real-size 3-page puzzle prints its words first, then Pages 1–3, four sheets in all, from ${layout}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout]);
    await open(page, null, BIG_SAGA);
    for (const format of ['A4', 'Letter']) expect(pdfPages(await page.pdf({ format }))).toBe(4);
    await page.emulateMedia({ media: 'print' });
    const words = await page.locator('#words-list').boundingBox();
    const grids = await page.locator('.grid-sheet').evaluateAll(s => s.map(el => el.getBoundingClientRect().top));
    expect(grids[0]).toBeGreaterThan(words.y + words.height);
    expect(grids).toEqual([...grids].sort((a, b) => a - b));
  });
}

test('the leading sheet is the title, date and words card with the hidden ID beneath, and no grid', async ({ page }) => {
  await openSaga(page, 'overlay');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#title')).toBeVisible();
  await expect(page.locator('#created')).toBeVisible();
  await expect(page.locator('#words-list')).toBeVisible();
  await expect(page.locator('#words li')).toHaveCount(8);
  await expect(page.locator('#card')).toBeHidden();
  await expect(page.locator('#tabs')).toBeHidden();
  expect(await page.locator('#words-list').evaluate(el => getComputedStyle(el, '::after').content)).toBe('"WSCH-0007"');
  const words = await page.locator('#words-list').boundingBox();
  const first = await page.locator('.grid-sheet').first().boundingBox();
  expect(first.y).toBeGreaterThan(words.y + words.height);
});

test('each grid sheet is the title and its blank grid alone, banded Saga · Page n of 3, every grid one size', async ({ page }) => {
  await openSaga(page);
  await findOnPage(page, 1, HEN);
  await page.locator('#flip').click();
  await page.emulateMedia({ media: 'print' });
  const sheets = page.locator('.grid-sheet');
  await expect(sheets).toHaveCount(3);
  await expect(sheets.locator('h1')).toHaveText(['Farm Saga', 'Farm Saga', 'Farm Saga']);
  await expect(sheets.locator('.band')).toHaveText(['Saga · Page 1 of 3', 'Saga · Page 2 of 3', 'Saga · Page 3 of 3']);
  expect(await sheets.evaluateAll(s => s.map(el => getComputedStyle(el).breakBefore))).toEqual(['page', 'page', 'page']);
  for (const [i, corner] of ['R', 'S', 'T'].entries()) {
    await expect(sheets.nth(i).locator('.cell')).toHaveCount(64);
    await expect(sheets.nth(i).locator('.cell').nth(63)).toHaveText(corner);
  }
  // Blank: no words, no found lines, no circles, no solution side.
  await expect(sheets.locator('li, svg, .created')).toHaveCount(0);
  const sizes = await sheets.locator('.grid').evaluateAll(gs => gs.map(g => [g.offsetWidth, g.offsetHeight]));
  expect(new Set(sizes.map(String)).size).toBe(1);
  expect(sizes[0][0]).toBeGreaterThan(0);
  await expect(sheets.first().locator('.band')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(sheets.first().locator('.cell').first()).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(page.locator('#words li', { hasText: 'Hen' })).toHaveCSS('text-decoration-line', 'none');
});

test('a 3-page puzzle\'s printed grids keep their ?s, on the page they sit', async ({ page }) => {
  const wild = { ...SAGA, grids: SAGA.grids.map((g, i) => ({ ...g, wildcards: [[], [{ row: 7, col: 7 }], []][i] })) };
  await open(page, null, wild);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.grid-sheet .cell', { hasText: '?' })).toHaveCount(1);
  await expect(page.locator('.grid-sheet').nth(1).locator('.cell').nth(63)).toHaveText('?');
});

test('a Saga with Cow on two of its pages prints Cow ×2 on its words sheet', async ({ page }) => {
  const cow = SAGA.words.find(w => w.word === 'Cow');
  await open(page, null, { ...SAGA, words: SAGA.words.concat([{ ...cow, grid: 1 }]) });
  await page.emulateMedia({ media: 'print' });
  expect(await printedLines(page)).toEqual(['Cat', 'Cow ×2', 'Ewe', 'Hen', 'Ice cream', 'Map', 'Pig', 'Piglet']);
  await expect(page.locator('.grid-sheet li')).toHaveCount(0);
});

test('a Saga\'s words sheet keeps every long word in its own column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, 'bottom']);
  const long = ['Carcharodontosaurus', 'Pachycephalosaurus', 'Christmas pudding', 'Ratchet and Clank'];
  await open(page, null, { ...SAGA, words: SAGA.words.map((w, i) => ({ ...w, word: long[i % 4] + ' ' + i })) });
  const fit = await printedFit(page);
  expect(fit.over).toEqual([]);
  expect(fit.want).toBeGreaterThan(88);
});

// A Saga with a Countries-size list: 30 words, the longest a single short word, so paper fits
// many columns across the page.
const LONG_LIST_SAGA = { ...SAGA, words: Array.from({ length: 30 }, (_, i) => ({ ...SAGA.words[i % 8], word: 'Word ' + i })) };
// On paper: the words list's width, and how many columns it lays the words in — as many of
// column-width as fit across it, as in printedFit.
const printedSpread = page => page.locator('#words').evaluate(ul => {
  const css = getComputedStyle(ul);
  const gap = parseFloat(css.columnGap), want = parseFloat(css.columnWidth);
  return { width: Math.round(ul.clientWidth), columns: Math.floor((ul.clientWidth + gap) / (want + gap)) };
});

test('a Saga\'s words sheet spreads its words across the page from every layout, as under the grid', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const spreads = {};
  for (const layout of ['bottom', 'right', 'overlay']) {
    await page.emulateMedia({ media: 'screen' });
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout]);
    await open(page, null, LONG_LIST_SAGA);
    await columnsSized(page);
    await page.emulateMedia({ media: 'print' });
    spreads[layout] = await printedSpread(page);
  }
  expect(spreads.bottom.columns).toBeGreaterThan(3);
  expect(spreads.right).toEqual(spreads.bottom);
  expect(spreads.overlay).toEqual(spreads.bottom);
});

test('a single-grid puzzle prints its grid and words the same from every layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const sheets = {};
  for (const layout of ['bottom', 'right', 'overlay']) {
    await page.emulateMedia({ media: 'screen' });
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout]);
    await open(page, null, PUZZLE);
    await columnsSized(page);
    await page.emulateMedia({ media: 'print' });
    const card = await page.locator('#card').boundingBox();
    sheets[layout] = { words: await printedSpread(page), card: Object.values(card).map(Math.round) };
  }
  expect(sheets.right).toEqual(sheets.bottom);
  expect(sheets.overlay).toEqual(sheets.bottom);
});

test('after printing a Saga in Overlay, the screen keeps the words over the grid', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSaga(page, 'overlay');
  const before = await page.locator('.col').boundingBox();
  await page.emulateMedia({ media: 'print' });
  await page.emulateMedia({ media: 'screen' });
  expect(await page.locator('.col').boundingBox()).toEqual(before);
});

test('a single-grid puzzle prints no sheets of its own beyond the one', async ({ page }) => {
  await open(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.grid-sheet')).toHaveCount(0);
  await expect(page.locator('#card')).toBeVisible();
});

// ---- How big the grid and its words are ----

const SIZE_KEY = 'grew-puzzles.text-size';
const sizeButton = page => page.locator('#text-size');
const sizeMenu = page => page.locator('#text-size-menu');
// On a window wide enough for the page's widest letters: each size's letters, and its words by
// the same ratio, never under 11px.
const SIZES = { Tiny: [10, 11], Small: [15, 11], Normal: [22, 16], Large: [27, 16 * 27 / 22], Huge: [32, 16 * 32 / 22] };
const fontSize = locator => locator.evaluate(e => parseFloat(getComputedStyle(e).fontSize));

async function openSized(page, layout, puzzle) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout]);
  await open(page, null, puzzle);
  await page.evaluate(() => document.fonts.ready);
}

async function pickSize(page, label) {
  await sizeButton(page).click();
  await sizeMenu(page).getByRole('menuitemradio', { name: label }).click();
}

async function centreOf(locator) {
  const b = await locator.boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
}

function expectNear(a, b) {
  expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1);
}

// Cat found, from (4, 2) up to (2, 2); the circle on (0, 0) and the red line on to (0, 3) — each
// mark centred on its letters.
async function expectMarksOnLetters(page) {
  expectNear(await centreOf(page.locator('#overlay line.mark-found')), await centreOf(cell(page, 3, 2)));
  expectNear(await centreOf(page.locator('#overlay circle.mark-wrong')), await centreOf(cell(page, 0, 0)));
  const [from, to] = [await centreOf(cell(page, 0, 0)), await centreOf(cell(page, 0, 3))];
  expectNear(await centreOf(page.locator('#overlay line.mark-wrong')), [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
}

test('a first visit opens at Normal: the grid\'s letters and the words exactly as before', async ({ page }) => {
  await openSized(page, 'bottom');
  await expect(page.locator('#play')).toHaveAttribute('data-size', 'normal');
  await expect(cell(page, 0, 0)).toHaveCSS('font-size', '22px');
  expect((await cell(page, 0, 0).boundingBox()).width).toBe(44);
  await expect(page.locator('#words li').first()).toHaveCSS('font-size', '16px');
});

test('the text-size button beside the words layout opens Tiny to Huge, each "Aa" at its letters, the current ticked; pressing outside closes it unchanged', async ({ page }) => {
  await openSized(page, 'bottom');
  const card = await box(page, '.card');
  const layout = await box(page, '#words-layout');
  const size = await box(page, '#text-size');
  const flip = await box(page, '#flip');
  expect(size.y).toBeLessThan(card.y);
  expect(size.x - (layout.x + layout.width)).toBeCloseTo(12, 0);
  expect(size.x + size.width).toBeLessThan(flip.x);
  await expect(sizeButton(page)).toHaveAttribute('aria-label', 'Text size');
  await expect(sizeMenu(page)).toBeHidden();

  await sizeButton(page).click();
  await expect(sizeMenu(page)).toBeVisible();
  await expect(sizeButton(page)).toHaveAttribute('aria-expanded', 'true');
  const choices = sizeMenu(page).getByRole('menuitemradio');
  await expect(choices.locator('span:last-child')).toHaveText(['Tiny', 'Small', 'Normal', 'Large', 'Huge']);
  await expect(choices.locator('.aa')).toHaveText(Array(5).fill('Aa'));
  expect(await choices.locator('.aa').evaluateAll(as => as.map(a => parseFloat(getComputedStyle(a).fontSize)))).toEqual([10, 15, 22, 27, 32]);
  expect(await choices.evaluateAll(cs => cs.map(c => c.getAttribute('aria-checked')))).toEqual(['false', 'false', 'true', 'false', 'false']);
  expect(await choices.locator('.tick').evaluateAll(ts => ts.map(t => getComputedStyle(t, '::before').content))).toEqual(['none', 'none', '"✓"', 'none', 'none']);
  expect((await box(page, '#text-size-menu')).y).toBeGreaterThanOrEqual(size.y + size.height);

  await page.mouse.click(5, 880);
  await expect(sizeMenu(page)).toBeHidden();
  await expect(sizeButton(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#play')).toHaveAttribute('data-size', 'normal');
  await expect(cell(page, 0, 0)).toHaveCSS('font-size', '22px');
});

test('in Overlay the text-size button sits after show/hide words, 12px apart, and back beside the words layout while the solution shows', async ({ page }) => {
  await openSized(page, 'overlay');
  const layout = await box(page, '#words-layout');
  const words = await box(page, '#words-toggle');
  const size = await box(page, '#text-size');
  expect(words.x - (layout.x + layout.width)).toBeCloseTo(12, 0);
  expect(size.x - (words.x + words.width)).toBeCloseTo(12, 0);
  expect(size.y).toBe(words.y);

  await page.locator('#flip').click();
  await expect(toggle(page)).toBeHidden();
  expect((await box(page, '#text-size')).x).toBe(words.x);
});

test('a size picked mid-puzzle resizes the letters, centred in their cells, and the grid card round them; every found line, circle and red line stays on its letters; the menu closes', async ({ page }) => {
  await openSized(page, 'bottom');
  await tapAll(page, [[4, 2], [2, 2], [0, 0], [0, 3]]);
  let before = await box(page, '#front');
  for (const label of ['Small', 'Tiny', 'Large', 'Huge', 'Normal']) {
    await pickSize(page, label);
    await expect(sizeMenu(page)).toBeHidden();
    const letters = SIZES[label][0];
    await expect(cell(page, 0, 0)).toHaveCSS('font-size', letters + 'px');
    await expect(cell(page, 0, 0)).toHaveCSS('place-items', 'center');
    expect((await cell(page, 0, 0).boundingBox()).width).toBe(letters * 2);
    expect((await box(page, '#grid')).width).toBe(letters * 2 * COLS);
    const now = await box(page, '#front');
    expect(Math.sign(now.width - before.width)).toBe(Math.sign(now.height - before.height));
    expect(now.width).not.toBe(before.width);
    before = now;
    await expect(page.locator('#count')).toHaveText('1/8');
    await expectMarksOnLetters(page);
  }
});

test('the words scale by the letters\' ratio, never under 11px', async ({ page }) => {
  await openSized(page, 'bottom');
  for (const [label, [letters, words]] of Object.entries(SIZES)) {
    await pickSize(page, label);
    await expect(cell(page, 0, 0)).toHaveCSS('font-size', letters + 'px');
    expect(await fontSize(page.locator('#words li').first())).toBeCloseTo(words, 2);
  }
});

for (const layout of ['bottom', 'right', 'overlay']) {
  test(`in ${layout}, the words card follows the grid card at every size`, async ({ page }) => {
    await plain(page);
    await openSized(page, layout);
    const follows = {
      bottom: (stage, aside) => {
        expect(aside.y).toBeGreaterThan(stage.y + stage.height);
        expect(Math.abs(aside.width - stage.width)).toBeLessThan(1);
      },
      right: (stage, aside) => {
        expect(aside.x).toBeGreaterThan(stage.x + stage.width);
        expect(Math.abs(aside.y - stage.y)).toBeLessThan(1);
        expect(Math.abs(aside.height - stage.height)).toBeLessThan(1);
      },
      overlay: async () => expect(await box(page, '#words-list')).toEqual(await box(page, '.card'))
    };
    for (const label of Object.keys(SIZES)) {
      await pickSize(page, label);
      await expect(cell(page, 0, 0)).toHaveCSS('font-size', SIZES[label][0] + 'px');
      await [() => {}, () => toggle(page).click()][Number(layout === 'overlay')]();
      await expect(page.locator('#play')).toHaveAttribute('data-sits', layout);
      const stage = await box(page, '.stage');
      const aside = await box(page, 'aside');
      await follows[layout](stage, aside);
      for (const word of await wordBoxes(page)) expect(word.right).toBeLessThanOrEqual(aside.x + aside.width);
      await [() => {}, () => toggle(page).click()][Number(layout === 'overlay')]();
    }
  });
}

test('the solution is the same size as the puzzle side, and flipping back keeps the size', async ({ page }) => {
  await openSized(page, 'bottom');
  await pickSize(page, 'Large');
  await page.locator('#flip').click();
  await expect(page.locator('#card')).toHaveClass(/flipped/);
  expect(await box(page, '#back')).toEqual(await box(page, '#front'));
  await expect(page.locator('#solution-grid .cell').first()).toHaveCSS('font-size', '27px');
  await page.locator('#flip').click();
  await expect(page.locator('#play')).toHaveAttribute('data-size', 'large');
  await expect(cell(page, 0, 0)).toHaveCSS('font-size', '27px');
});

test('the size is remembered on this device across a reload and another puzzle', async ({ page }) => {
  await openSized(page, 'bottom');
  await pickSize(page, 'Huge');
  expect(await page.evaluate(key => localStorage.getItem(key), SIZE_KEY)).toBe('huge');
  await page.reload();
  await expect(page.locator('#play')).toHaveAttribute('data-size', 'huge');
  await expect(cell(page, 0, 0)).toHaveCSS('font-size', '32px');
  await page.route('**/content/puzzles/wordsearch/WSCH-0008.json', route => route.fulfill({ json: PUZZLE }));
  await page.goto('/app/play.html?id=WSCH-0008');
  await expect(cell(page, 0, 0)).toHaveCSS('font-size', '32px');
  await sizeButton(page).click();
  await expect(sizeMenu(page).locator('[aria-checked="true"]')).toHaveAttribute('data-size', 'huge');
});

test('a page that cannot read or store the size opens at Normal and still resizes', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await expect(page.locator('#play')).toHaveAttribute('data-size', 'normal');
  await pickSize(page, 'Small');
  await expect(cell(page, 0, 0)).toHaveCSS('font-size', '15px');
  await expect(sizeMenu(page)).toBeHidden();
});

test('on a Saga every page\'s grid is at the size picked, and switching tabs never changes it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSaga(page, 'bottom');
  await pickSize(page, 'Large');
  const card = await box(page, '#front');
  for (const n of [1, 2, 0]) {
    await tabs(page).nth(n).click();
    await expect(tabs(page).nth(n)).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, 0, 0)).toHaveCSS('font-size', '27px');
    expect(await box(page, '#front')).toEqual(card);
  }
});

test('the title, the site bar, the bands\' headings, the tabs and the corner buttons stay their size at every size', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSaga(page, 'bottom');
  // The grid band's width is the card's; its heading's size is what stays.
  const sizes = () => page.evaluate(() => ['#title', '.site', '#label', '.list-head h2', '#tabs .tab', '#flip', '#words-layout', '#text-size'].map(s => {
    const e = document.querySelector(s), r = e.getBoundingClientRect();
    return [s, getComputedStyle(e).fontSize, { '#label': 0 }[s] ?? r.width, r.height];
  }));
  const normal = await sizes();
  for (const label of ['Tiny', 'Huge']) {
    await pickSize(page, label);
    await expect(cell(page, 0, 0)).toHaveCSS('font-size', SIZES[label][0] + 'px');
    expect(await sizes()).toEqual(normal);
  }
});

test('a bigger size on a phone scrolls the grid sideways in its own box, never widening the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [SIZE_KEY, 'huge']);
  await open(page, null, WIDE_PUZZLE);
  await expect(page.locator('#play')).toHaveAttribute('data-size', 'huge');
  expect((await box(page, '.stage')).width).toBeGreaterThan(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('the printout is the same at every size', async ({ page }) => {
  await openSized(page, 'bottom');
  const normal = await printedBoxes(page);
  await page.emulateMedia({ media: 'screen' });
  for (const label of ['Tiny', 'Huge']) {
    await pickSize(page, label);
    expect(await printedBoxes(page)).toEqual(normal);
    await expect(cell(page, 0, 0)).toHaveCSS('font-size', '18px');
    await expect(page.locator('#words li').first()).toHaveCSS('font-size', '13px');
    await page.emulateMedia({ media: 'screen' });
  }
});

test('a Saga prints its words and each grid\'s sheet the same at every size', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSaga(page, 'bottom');
  const printed = async () => {
    await page.emulateMedia({ media: 'print' });
    const sizes = await page.locator('.grid-sheet .grid, aside').evaluateAll(es => es.map(e => [e.offsetWidth, e.offsetHeight]));
    await page.emulateMedia({ media: 'screen' });
    return sizes;
  };
  const normal = await printed();
  expect(normal).toHaveLength(4);
  await pickSize(page, 'Huge');
  expect(await printed()).toEqual(normal);
});
