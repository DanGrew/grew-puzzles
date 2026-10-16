const { test, expect } = require('@playwright/test');
// A mosaic's printout (TASK-168): one 8.5×11 page, Plain — the title, the difficulty and code, the
// rule, and the numbers in a grid as big as the page allows, black and white, never a shaded square,
// the answer or the picture's name. Only a board up to 30 squares along both sides prints. The
// fixtures: MOSA-0001, a real 12×12 Easy; MOSA-0002, a real 198×198 Hard. EDGE is the 198×198 cut to
// 30×30, the biggest that prints, and TALL to 30×38, which doesn't — their numbers along the cut no
// longer fair, which paper never checks.
const BOARD = require('./fixtures/MOSA-0001.json');
const BIG = require('./fixtures/MOSA-0002.json');
const cut = (id, width, height) => ({
  ...BIG, hiddenId: id, title: 'Mosaic ' + id.slice(-3), width, height,
  numbers: BIG.numbers.slice(0, height).map(row => row.slice(0, width)),
  answer: BIG.answer.slice(0, height).map(row => row.slice(0, width)),
});
const EDGE = cut('MOSA-0003', 30, 30);
const TALL = cut('MOSA-0004', 30, 38);
const FILES = { 'MOSA-0001': BOARD, 'MOSA-0002': BIG, 'MOSA-0003': EDGE, 'MOSA-0004': TALL };
const IN = 96;
const PT = 4 / 3;
const RULE = 'Shade squares to reveal a picture. Each number counts the shaded squares in its 3×3 block: the square itself and the eight around it.';

async function open(page, id = 'MOSA-0001') {
  await page.addInitScript(() => {
    window.printed = 0;
    window.print = () => { window.printed += 1; };
  });
  await page.route(/\/content\/puzzles\/mosaic\/MOSA-\d+\.json$/, r => r.fulfill({ json: FILES[r.request().url().match(/(MOSA-\d+)\.json$/)[1]] }));
  await page.goto('/app/mosaic.html?id=' + id);
  await expect(page.locator('#play')).toHaveAttribute('data-view', /./);
}

// Print page's pick, as the side bar makes it, the dialog stood in for.
async function printIn(page) {
  await page.locator('#site-side #print [data-print="plain"]').click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  await page.setViewportSize({ width: 8.5 * IN, height: 11 * IN });
  await page.emulateMedia({ media: 'print' });
}

const sheet = page => page.locator('#mosaic-sheet');
const paper = page => sheet(page).locator('[data-part="grid"]');

function pageSizes(pdf) {
  return [...pdf.matchAll(/\/Type\s*\/Page[^s][\s\S]*?\/MediaBox\s*\[([^\]]*)\]/g)].map(m => m[1].trim().split(/\s+/).map(Number));
}

// Where a square sits on the canvas at the view now, to press it.
async function tap(page, r, c) {
  const [cell, vx, vy] = (await page.locator('#play').getAttribute('data-view')).split(' ').map(Number);
  await page.locator('#grid').click({ position: { x: (c - vx + 0.5) * cell, y: (r - vy + 0.5) * cell } });
}

test('a mosaic that prints has Print page in its side bar: Colour, Black and white, Plain', async ({ page }) => {
  await open(page);
  await expect(page.locator('#site-side #print')).toBeVisible();
  await expect(page.locator('#site-side #print .print-name')).toHaveText('Print page');
  await expect(page.locator('#site-side #print button')).toHaveText(['Colour', 'Black and white', 'Plain']);
});

for (const [name, id] of [['a 198×198', 'MOSA-0002'], ['a 30×38', 'MOSA-0004']]) {
  test(`${name} mosaic has no Print page, and draws no sheet`, async ({ page }) => {
    await open(page, id);
    await expect(page.locator('#print')).toBeHidden();
    await expect(page.locator('#site-side .side-own')).toBeHidden();
    await expect(paper(page).locator('*')).toHaveCount(0);
  });
}

for (const [name, id] of [['a 12×12', 'MOSA-0001'], ['a 30×30', 'MOSA-0003']]) {
  test(`printed, ${name} mosaic is one 8.5×11 page`, async ({ page }) => {
    await open(page, id);
    await printIn(page);
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
    expect(pageSizes(pdf)).toEqual([[0, 0, 612, 792]]);
  });
}

test('on paper: Mosaic 001, Easy · MOSA-0001, the rule, then the grid, nothing else of the page and never the picture\'s name', async ({ page }) => {
  await open(page);
  await printIn(page);
  await expect(page.locator('main.play')).toBeHidden();
  await expect(page.locator('.site')).toBeHidden();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator('h1')).toHaveText('Mosaic 001');
  await expect(sheet(page).locator('.ident')).toHaveText('Easy · MOSA-0001', { useInnerText: true });
  await expect(sheet(page).locator('.mosaic-sheet-rule')).toHaveText(RULE);
  await expect(sheet(page)).not.toContainText('Robot 20');
  const title = await sheet(page).locator('h1').boundingBox();
  const ident = await sheet(page).locator('.ident').boundingBox();
  const rule = await sheet(page).locator('.mosaic-sheet-rule').boundingBox();
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

test('a 30×30 fills the sheet: the grid as big as the page allows, centred, square, inside the page\'s edges, on one page', async ({ page }) => {
  for (const [id, n] of [['MOSA-0001', 12], ['MOSA-0003', 30]]) {
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
    expect(grid.y + grid.height).toBeLessThan(10.5 * IN);
    await page.emulateMedia({ media: 'screen' });
  }
});

test('the lines survive cheap printing: 0.75 pt between squares, 1.5 pt after every fifth, a 2.25 pt border round the grid', async ({ page }) => {
  await open(page);
  await printIn(page);
  const widths = await paper(page).locator('span').evaluateAll(spans => spans.map(s => [getComputedStyle(s).borderRightWidth, getComputedStyle(s).borderBottomWidth].map(parseFloat)));
  // Row 0: a heavier line after the 5th and 10th squares, never on the board's edge.
  expect(widths.slice(0, 12).map(w => w[0])).toEqual([1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1]);
  expect(widths.filter((_, i) => i % 12 === 0).map(w => w[1])).toEqual([1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1]);
  for (const w of widths.flat()) expect(w).toBeGreaterThanOrEqual(0.75 * PT);
  const inner = widths[0];
  const outer = await paper(page).evaluate(g => ['Top', 'Right', 'Bottom', 'Left'].map(side => parseFloat(getComputedStyle(g)[`border${side}Width`])));
  expect([outer[0], outer[1] + inner[0], outer[2] + inner[1], outer[3]]).toEqual(Array(4).fill(3));
  await expect(paper(page)).toHaveCSS('border-top-color', 'rgb(0, 0, 0)');
});

test('paper is black and white, and even a 30×30\'s numbers print at 7 pt or more', async ({ page }) => {
  await open(page, 'MOSA-0003');
  await printIn(page);
  const squares = await paper(page).locator('span').evaluateAll(spans => spans.map(s => {
    const c = getComputedStyle(s);
    return [parseFloat(c.fontSize), c.color, c.backgroundColor];
  }));
  expect(squares).toHaveLength(900);
  expect(Math.min(...squares.map(s => s[0]))).toBeGreaterThanOrEqual(7 * PT);
  expect(new Set(squares.map(s => s[1]))).toEqual(new Set(['rgb(0, 0, 0)']));
  expect(new Set(squares.map(s => s[2]))).toEqual(new Set(['rgba(0, 0, 0, 0)']));
  await expect(sheet(page).locator('.difficulty')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('a board I\'ve part done prints empty: no squares shaded, no answer, whatever I did', async ({ page }) => {
  await open(page);
  // The sheet's own parts.
  const drawn = () => sheet(page).locator('[data-part]').evaluateAll(parts => parts.map(p => p.outerHTML));
  const before = await drawn();
  // A square left blank, two shaded, and the answer side shown.
  await tap(page, 0, 0);
  await tap(page, 1, 1);
  await tap(page, 1, 1);
  await tap(page, 2, 2);
  await tap(page, 2, 2);
  await page.locator('#flip').click();
  await printIn(page);
  expect(await drawn()).toEqual(before);
  for (const id of ['grid', 'solution-grid']) await expect(page.locator('#' + id)).toBeHidden();
  await expect(sheet(page).locator('canvas, [data-mark], .back-face')).toHaveCount(0);
});

test('a solved board still prints as Mosaic 001: the picture\'s name never reaches the paper', async ({ page }) => {
  await open(page);
  const shaded = BOARD.answer.flatMap((row, r) => [...row].map((ch, c) => [ch, r, c])).filter(s => s[0] === '#');
  for (const [, r, c] of shaded) {
    await tap(page, r, c);
    await tap(page, r, c);
  }
  await expect(page.locator('#title')).toHaveText('Robot 20');
  await printIn(page);
  await expect(sheet(page).locator('h1')).toHaveText('Mosaic 001');
  await expect(sheet(page)).not.toContainText('Robot 20');
});
