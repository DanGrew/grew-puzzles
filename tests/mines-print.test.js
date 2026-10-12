const { test, expect } = require('@playwright/test');
// A minesweeper board's printout (TASK-138): one 8.5×11 page — the title, the difficulty and code,
// the rule with the board's mine count, and the grid as big as the page allows, black and white,
// never a mark or the answer. Only a board up to 30 squares a side prints. The fixtures: MINE-0001,
// a real 10×10 Easy of 15 mines; MINE-0002, a real 40×40 Hard. EDGE is the 40×40 cut to 30×30, the
// biggest that prints — its numbers along the cut no longer fair, which paper never checks.
const BOARD = require('./fixtures/MINE-0001.json');
const BIG = require('./fixtures/MINE-0002.json');
const EDGE = {
  ...BIG, hiddenId: 'MINE-0003', title: 'Edge Field', width: 30, height: 30,
  numbers: BIG.numbers.slice(0, 30).map(row => row.slice(0, 30)),
  mines: BIG.mines.filter(m => m.row < 30 && m.col < 30),
};
const FILES = { 'MINE-0001': BOARD, 'MINE-0002': BIG, 'MINE-0003': EDGE };
const IN = 96;
const PT = 4 / 3;

async function open(page, id = 'MINE-0001') {
  await page.addInitScript(() => {
    window.printed = 0;
    window.print = () => { window.printed += 1; };
  });
  await page.route(/\/content\/puzzles\/minesweeper\/MINE-\d+\.json$/, r => r.fulfill({ json: FILES[r.request().url().match(/(MINE-\d+)\.json$/)[1]] }));
  await page.goto('/app/minesweeper.html?id=' + id);
  await expect(page.locator('#play')).toBeVisible();
}

// Print page's pick, as the side bar makes it, the dialog stood in for.
async function printIn(page, style = 'plain') {
  await page.locator(`#site-side #print [data-print="${style}"]`).click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  await page.setViewportSize({ width: 8.5 * IN, height: 11 * IN });
  await page.emulateMedia({ media: 'print' });
}

const sheet = page => page.locator('#mines-sheet');
const paper = page => sheet(page).locator('[data-part="grid"]');

function pageSizes(pdf) {
  return [...pdf.matchAll(/\/Type\s*\/Page[^s][\s\S]*?\/MediaBox\s*\[([^\]]*)\]/g)].map(m => m[1].trim().split(/\s+/).map(Number));
}

test('a board that prints has Print page in its side bar: Plain', async ({ page }) => {
  await open(page);
  await expect(page.locator('#site-side #print')).toBeVisible();
  await expect(page.locator('#site-side #print .print-name')).toHaveText('Print page');
  await expect(page.locator('#site-side #print button')).toHaveText(['Plain']);
});

test('a board over 30 squares a side has no Print page, and draws no sheet', async ({ page }) => {
  await open(page, 'MINE-0002');
  await expect(page.locator('#print')).toBeHidden();
  await expect(page.locator('#site-side .side-own')).toBeHidden();
  await expect(paper(page).locator('*')).toHaveCount(0);
});

for (const [name, id] of [['a 10×10', 'MINE-0001'], ['a 30×30', 'MINE-0003']]) {
  test(`printed, ${name} board is one 8.5×11 page`, async ({ page }) => {
    await open(page, id);
    await printIn(page);
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
    expect(pageSizes(pdf)).toEqual([[0, 0, 612, 792]]);
  });
}

test('on paper: the title, Easy · MINE-0001, the rule with the board\'s 15 mines, then the grid, nothing else of the page', async ({ page }) => {
  await open(page);
  await printIn(page);
  await expect(page.locator('main.play')).toBeHidden();
  await expect(page.locator('.site')).toBeHidden();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator('h1')).toHaveText('Garden Patch');
  await expect(sheet(page).locator('.ident')).toHaveText('Easy · MINE-0001', { useInnerText: true });
  await expect(sheet(page).locator('[data-part="rule"]')).toHaveText(
    'Shade the 15 mines. Each number counts the mines in the eight squares around it. A numbered square is never a mine.');
  const title = await sheet(page).locator('h1').boundingBox();
  const ident = await sheet(page).locator('.ident').boundingBox();
  const rule = await sheet(page).locator('[data-part="rule"]').boundingBox();
  const grid = await paper(page).boundingBox();
  expect(ident.y).toBeGreaterThanOrEqual(title.y + title.height);
  expect(rule.y).toBeGreaterThanOrEqual(ident.y + ident.height);
  expect(grid.y).toBeGreaterThanOrEqual(rule.y + rule.height);
});

test('the grid is the board\'s numbers, square by square, every other square blank', async ({ page }) => {
  await open(page);
  await printIn(page);
  await expect(paper(page).locator('span')).toHaveText(BOARD.numbers.join('').split('').map(d => d === '.' ? '' : d));
});

test('the grid is as big as the page allows, centred, square, inside the page\'s edges', async ({ page }) => {
  for (const [id, n] of [['MINE-0001', 10], ['MINE-0003', 30]]) {
    await open(page, id);
    await printIn(page);
    const grid = await paper(page).boundingBox();
    const square = await paper(page).locator('span').first().boundingBox();
    // The longer side 7.2 in, its border round it; 7.5 in between the page's half-inch edges.
    expect(square.width).toBeCloseTo(7.2 * IN / n, 0);
    expect(square.height).toBeCloseTo(square.width, 1);
    expect(grid.width).toBeCloseTo(7.2 * IN + 5, 0);
    expect(grid.x).toBeGreaterThanOrEqual(0.5 * IN);
    expect(grid.x + grid.width).toBeLessThanOrEqual(8 * IN);
    expect(grid.x + grid.width / 2).toBeCloseTo(4.25 * IN, 0);
    expect(grid.y + grid.height).toBeLessThan(10.3 * IN);
    await page.emulateMedia({ media: 'screen' });
  }
});

test('the lines survive cheap printing: at least 0.5 pt between squares, a 2 pt border round the grid', async ({ page }) => {
  await open(page);
  await printIn(page);
  const inner = await paper(page).locator('span').first().evaluate(s => [getComputedStyle(s).borderRightWidth, getComputedStyle(s).borderBottomWidth].map(parseFloat));
  for (const w of inner) expect(w).toBeGreaterThanOrEqual(0.5 * PT);
  // Each edge is the grid's border, and on the right and foot the last squares' lines too.
  const outer = await paper(page).evaluate(g => ['Top', 'Right', 'Bottom', 'Left'].map(side => parseFloat(getComputedStyle(g)[`border${side}Width`])));
  expect([outer[0], outer[1] + inner[0], outer[2] + inner[1], outer[3]]).toEqual(Array(4).fill(3));
  expect(Math.min(...outer.map((w, i) => w + [0, inner[0], inner[1], 0][i]))).toBeGreaterThanOrEqual(2 * PT);
  await expect(paper(page)).toHaveCSS('border-top-color', 'rgb(0, 0, 0)');
});

test('paper is black and white, and even a 30×30 board\'s numbers print at 7 pt or more', async ({ page }) => {
  await open(page, 'MINE-0003');
  await printIn(page);
  const squares = await paper(page).locator('span').evaluateAll(spans => spans.map(s => {
    const c = getComputedStyle(s);
    return [parseFloat(c.fontSize), c.color, c.backgroundColor];
  }));
  expect(Math.min(...squares.map(s => s[0]))).toBeGreaterThanOrEqual(7 * PT);
  expect(new Set(squares.map(s => s[1]))).toEqual(new Set(['rgb(0, 0, 0)']));
  expect(new Set(squares.map(s => s[2]))).toEqual(new Set(['rgba(0, 0, 0, 0)']));
  await expect(sheet(page).locator('.difficulty')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('nothing I marked prints, and there\'s no answer: the sheet is the blank board, whatever I did', async ({ page }) => {
  await open(page);
  const before = await sheet(page).innerHTML();
  const squares = page.locator('#grid .mines-square');
  // A dot, a mine, and a number tapped.
  await squares.nth(0).click();
  await squares.nth(1).click();
  await squares.nth(1).click();
  await squares.nth(2).click();
  await page.locator('#flip').click();
  await printIn(page);
  expect(await sheet(page).innerHTML()).toBe(before);
  await expect(page.locator('#grid, #solution-grid')).toHaveCount(2);
  for (const id of ['grid', 'solution-grid']) await expect(page.locator('#' + id)).toBeHidden();
  await expect(sheet(page).locator('[data-mark], .back-face')).toHaveCount(0);
  expect(await paper(page).locator('span').evaluateAll(spans => spans.map(s => getComputedStyle(s, '::after').content))).toEqual(Array(100).fill('none'));
});

test('a board the side bar\'s look dresses Themed still prints plain: no background behind the paper', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('grew-puzzles.look', 'themed'));
  await open(page);
  await printIn(page);
  expect(await page.evaluate(() => getComputedStyle(document.body, '::before').content)).toBe('none');
  await expect(page.locator('html')).toHaveAttribute('data-print', 'plain');
});
