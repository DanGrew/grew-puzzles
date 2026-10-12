const { test, expect } = require('@playwright/test');
// A criss-cross's printout (TASK-152): one 8.5×11 page — the title, the difficulty and code, the
// one-line rule, the empty shape with its starting word written in, and the list grouped by length
// under it, black and white, never a word placed or the answer. Only a shape at most 25 squares a
// side whose list fits under it prints. The fixtures: CRSS-0001, a real 17×15 Easy of 20 words;
// CRSS-0002, a real 29×30 Hard of 60; CRSS-0003, the tallest shape that prints with the longest
// list that does, 25×25 and 44 lines, in wide letters. LONG is it with one word more, its list too
// long to share the page — paper never checks a shape solves.
const SHAPE = require('./fixtures/CRSS-0001.json');
const BIG = require('./fixtures/CRSS-0002.json');
const TALL = require('./fixtures/CRSS-0003.json');
const LONG = { ...TALL, hiddenId: 'CRSS-0004', title: 'Long List',
  squares: TALL.squares.map((row, r) => r === 24 ? row.slice(0, 13) + '###' + row.slice(16) : row),
  words: [...TALL.words, { word: 'Wmz', start: { row: 24, col: 13 }, direction: 'E', length: 3 }] };
const FILES = { 'CRSS-0001': SHAPE, 'CRSS-0002': BIG, 'CRSS-0003': TALL, 'CRSS-0004': LONG };
const IN = 96;
const PT = 4 / 3;

async function open(page, id = 'CRSS-0001') {
  await page.addInitScript(() => {
    window.printed = 0;
    window.print = () => { window.printed += 1; };
  });
  await page.route(/\/content\/puzzles\/crisscross\/CRSS-\d+\.json$/, r => r.fulfill({ json: FILES[r.request().url().match(/(CRSS-\d+)\.json$/)[1]] }));
  await page.goto('/app/crisscross.html?id=' + id);
  await expect(page.locator('#play')).toBeVisible();
}

// Print page's pick, as the side bar makes it, the dialog stood in for.
async function printIn(page, style = 'plain') {
  await page.locator(`#site-side #print [data-print="${style}"]`).click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  await page.setViewportSize({ width: 8.5 * IN, height: 11 * IN });
  await page.emulateMedia({ media: 'print' });
}

const sheet = page => page.locator('#criss-sheet');
const paper = page => sheet(page).locator('[data-part="grid"]');
const list = page => sheet(page).locator('[data-part="words"]');

function pageSizes(pdf) {
  return [...pdf.matchAll(/\/Type\s*\/Page[^s][\s\S]*?\/MediaBox\s*\[([^\]]*)\]/g)].map(m => m[1].trim().split(/\s+/).map(Number));
}

test('a shape that prints has Print page in its side bar: Plain', async ({ page }) => {
  await open(page);
  await expect(page.locator('#site-side #print')).toBeVisible();
  await expect(page.locator('#site-side #print .print-name')).toHaveText('Print page');
  await expect(page.locator('#site-side #print button')).toHaveText(['Plain']);
});

for (const [name, id] of [['over 25 squares a side', 'CRSS-0002'], ['whose list is too long to share its page', 'CRSS-0004']]) {
  test(`a shape ${name} has no Print page, and draws no sheet`, async ({ page }) => {
    await open(page, id);
    await expect(page.locator('#print')).toBeHidden();
    await expect(page.locator('#site-side .side-own')).toBeHidden();
    await expect(paper(page).locator('*')).toHaveCount(0);
  });
}

for (const [name, id] of [['a 17×15', 'CRSS-0001'], ['the tallest, with the longest list,', 'CRSS-0003']]) {
  test(`printed, ${name} shape is one 8.5×11 page`, async ({ page }) => {
    await open(page, id);
    await printIn(page);
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
    expect(pageSizes(pdf)).toEqual([[0, 0, 612, 792]]);
  });
}

test('on paper: the title, Easy · CRSS-0001, the rule, the shape, then the list, nothing else of the page', async ({ page }) => {
  await open(page);
  await printIn(page);
  await expect(page.locator('main.play')).toBeHidden();
  await expect(page.locator('.site')).toBeHidden();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator('h1')).toHaveText('Summer Holidays');
  await expect(sheet(page).locator('.ident')).toHaveText('Easy · CRSS-0001', { useInnerText: true });
  await expect(sheet(page).locator('[data-part="rule"]')).toHaveText('Fit every word into the shape. Words cross where they share a letter.');
  const boxes = [];
  for (const part of [sheet(page).locator('h1'), sheet(page).locator('.ident'), sheet(page).locator('[data-part="rule"]'), paper(page), list(page)]) boxes.push(await part.boundingBox());
  boxes.slice(1).forEach((box, i) => expect(box.y).toBeGreaterThanOrEqual(boxes[i].y + boxes[i].height));
});

test('the shape is its squares in use, where the shape has them, the starting word written in and every other square blank', async ({ page }) => {
  await open(page);
  await printIn(page);
  const squares = paper(page).locator('span');
  await expect(squares).toHaveCount(SHAPE.squares.join('').split('').filter(c => c === '#').length);
  // Aquarium runs across row 4 from column 8.
  const cells = await squares.evaluateAll(spans => spans.map(s => [s.style.gridArea, s.textContent]));
  const written = cells.filter(([, letter]) => letter !== '');
  expect(written).toEqual('AQUARIUM'.split('').map((letter, k) => [`5 / ${9 + k}`, letter]));
});

test('the list is every word grouped by length, shortest first, the starting word crossed off', async ({ page }) => {
  await open(page);
  await printIn(page);
  await expect(list(page).locator('h3')).toHaveText(['3 letters', '4 letters', '5 letters', '6 letters', '7 letters', '8 letters']);
  const groups = await list(page).locator('.criss-paper-group').evaluateAll(gs => gs.map(g => [...g.querySelectorAll('p')].map(p => p.textContent)));
  expect(groups.flat()).toEqual(SHAPE.words.map(w => w.word));
  await expect(list(page).locator('p.given')).toHaveText(['Aquarium']);
  await expect(list(page).locator('p.given')).toHaveCSS('text-decoration-line', 'line-through');
});

test('the shape and the list stay inside the page\'s edges, the shape centred, its squares big enough to write in', async ({ page }) => {
  for (const id of ['CRSS-0001', 'CRSS-0003']) {
    await open(page, id);
    await printIn(page);
    const grid = await paper(page).boundingBox();
    const square = await paper(page).locator('span').first().boundingBox();
    const words = await list(page).boundingBox();
    // The last column's words, past the list's own right edge, would be a list too long for its room.
    const right = await list(page).locator('p').evaluateAll(ps => Math.max(...ps.map(p => p.getBoundingClientRect().right)));
    expect(square.width).toBeGreaterThanOrEqual(0.2 * IN);
    expect(square.width).toBeLessThanOrEqual(0.36 * IN + 1.5 * PT);
    expect(grid.x).toBeGreaterThanOrEqual(0.5 * IN);
    expect(grid.x + grid.width).toBeLessThanOrEqual(8 * IN);
    expect(grid.x + grid.width / 2).toBeCloseTo(4.25 * IN, 0);
    expect(right).toBeLessThanOrEqual(words.x + words.width);
    expect(words.y + words.height).toBeLessThan(10.3 * IN);
    await page.emulateMedia({ media: 'screen' });
  }
});

test('the lines survive cheap printing, and the starting word\'s letters print at 7 pt or more, black and white', async ({ page }) => {
  await open(page, 'CRSS-0003');
  await printIn(page);
  const squares = await paper(page).locator('span').evaluateAll(spans => spans.map(s => {
    const c = getComputedStyle(s);
    return [parseFloat(c.borderTopWidth), parseFloat(c.fontSize), c.color, c.backgroundColor, c.borderTopColor];
  }));
  expect(Math.min(...squares.map(s => s[0]))).toBeGreaterThanOrEqual(0.5 * PT);
  expect(Math.min(...squares.map(s => s[1]))).toBeGreaterThanOrEqual(7 * PT);
  expect(new Set(squares.map(s => s[2]))).toEqual(new Set(['rgb(0, 0, 0)']));
  expect(new Set(squares.map(s => s[3]))).toEqual(new Set(['rgba(0, 0, 0, 0)']));
  expect(new Set(squares.map(s => s[4]))).toEqual(new Set(['rgb(0, 0, 0)']));
  await expect(sheet(page).locator('.difficulty')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('nothing I placed prints, and there\'s no answer: the sheet is the empty shape, whatever I did', async ({ page }) => {
  await open(page);
  const before = await sheet(page).innerHTML();
  // Hat goes down from row 0, column 16; then the answer is flipped up.
  await page.locator('#grid .criss-square[data-key="0,16"]').click();
  await page.locator('#groups .chip', { hasText: 'Hat' }).click();
  await expect(page.locator('#count')).toHaveText('2/20');
  await page.locator('#flip').click();
  await printIn(page);
  expect(await sheet(page).innerHTML()).toBe(before);
  for (const id of ['grid', 'solution-grid']) await expect(page.locator('#' + id)).toBeHidden();
  await expect(paper(page).locator('span', { hasText: /./ })).toHaveCount(8);
});

test('a shape the side bar\'s look dresses Themed still prints plain: no background behind the paper', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('grew-puzzles.look', 'themed'));
  await open(page);
  await printIn(page);
  expect(await page.evaluate(() => getComputedStyle(document.body, '::before').content)).toBe('none');
  await expect(page.locator('html')).toHaveAttribute('data-print', 'plain');
});
