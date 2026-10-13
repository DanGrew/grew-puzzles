const { test, expect } = require('@playwright/test');
// A maze's printout (TASK-88): one 8.5×11 page, the maze 0.2 in a cell, the title centred at the
// top and the note box of what to find at the top right. Only a 32×40 maze prints. The fixtures:
// MAZE-0002, a real-size 32×40 Vanilla of guides; MAZE-0001, a 6×6 with every element; MAZE-0003,
// a 100×100. EVERY is the 32×40 wearing the 6×6's keys, zone, collectibles, letters and exits.
const SMALL = require('./fixtures/MAZE-0001.json');
const BIG = require('./fixtures/MAZE-0002.json');
const HUNDRED = require('./fixtures/MAZE-0003.json');
const EVERY = {
  ...BIG, title: 'Every Thing', keys: SMALL.keys, zones: SMALL.zones,
  collectibles: SMALL.collectibles, letters: SMALL.letters, exits: SMALL.exits,
};
const IN = 96;
const PT = 4 / 3;

async function open(page, { maze = EVERY, id = 'MAZE-0002', look = 'plain' } = {}) {
  await page.addInitScript(l => {
    localStorage.setItem('grew-puzzles.look', l);
    window.printed = 0;
    window.print = () => { window.printed += 1; };
  }, look);
  await page.route('**/content/puzzles/maze/MAZE-0001.json', r => r.fulfill({ json: SMALL }));
  await page.route('**/content/puzzles/maze/MAZE-0002.json', r => r.fulfill({ json: maze }));
  await page.route('**/content/puzzles/maze/MAZE-0003.json', r => r.fulfill({ json: HUNDRED }));
  await page.goto('/app/maze.html?id=' + id);
  await expect(page.locator('#play')).toBeVisible();
}

// Print page's pick, as the side bar makes it, the dialog stood in for.
async function printIn(page, style) {
  await page.locator(`#site-side #print [data-print="${style}"]`).click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  await page.setViewportSize({ width: 8.5 * IN, height: 11 * IN });
  await page.emulateMedia({ media: 'print' });
}

const sheet = page => page.locator('#maze-sheet');
const paper = page => sheet(page).locator('[data-part="maze"]');
const note = page => sheet(page).locator('[data-part="note"]');

function pageSizes(pdf) {
  return [...pdf.matchAll(/\/Type\s*\/Page[^s][\s\S]*?\/MediaBox\s*\[([^\]]*)\]/g)].map(m => m[1].trim().split(/\s+/).map(Number));
}

test('a 32×40 maze has Print page in its side bar: Colour, Black and white, Plain', async ({ page }) => {
  await open(page);
  await expect(page.locator('#site-side #print')).toBeVisible();
  await expect(page.locator('#site-side #print button')).toHaveText(['Colour', 'Black and white', 'Plain']);
});

for (const [name, id] of [['a 6×6', 'MAZE-0001'], ['a 100×100', 'MAZE-0003']]) {
  test(`${name} maze has no Print page, and draws no sheet`, async ({ page }) => {
    await open(page, { id });
    await expect(page.locator('#print')).toBeHidden();
    await expect(page.locator('#site-side .side-own')).toBeHidden();
    await expect(paper(page).locator('*')).toHaveCount(0);
  });
}

test('printed, the maze is one 8.5×11 page', async ({ page }) => {
  await open(page);
  await printIn(page, 'plain');
  const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
  expect(pageSizes(pdf)).toEqual([[0, 0, 612, 792]]);
});

test('on paper the maze is 6.4 × 8 in, 0.2 in a cell, centred, 2 in from the top with the title centred above it', async ({ page }) => {
  await open(page);
  await printIn(page, 'plain');
  await expect(page.locator('main.play')).toBeHidden();
  await expect(sheet(page)).toBeVisible();
  const box = await paper(page).boundingBox();
  const top = await sheet(page).boundingBox();
  expect(box.width).toBeCloseTo(6.4 * IN, 0);
  expect(box.height).toBeCloseTo(8 * IN, 0);
  expect(box.y - top.y).toBeCloseTo(1.5 * IN, 0);
  expect(box.x + box.width / 2).toBeCloseTo(top.x + top.width / 2, 0);
  const title = await sheet(page).locator('h1').boundingBox();
  expect(title.x + title.width / 2).toBeCloseTo(top.x + top.width / 2, 0);
  expect(title.y + title.height).toBeLessThan(box.y);
  await expect(sheet(page).locator('h1')).toHaveText('Every Thing');
  await expect(sheet(page).locator('.ident')).toHaveText(/· MAZE-0002$/, { useInnerText: true });
});

test('the note box sits at the top right, its right edge on the maze\'s, above it and clear of the title, never under 7 pt', async ({ page }) => {
  await open(page);
  await printIn(page, 'plain');
  const box = await note(page).boundingBox();
  const maze = await paper(page).boundingBox();
  // The title's words, not its line, which runs the sheet's width.
  const titleRight = await sheet(page).locator('h1').evaluate(h => { const r = document.createRange(); r.selectNodeContents(h); return r.getBoundingClientRect().right; });
  expect(box.x + box.width).toBeCloseTo(maze.x + maze.width, 0);
  expect(box.y + box.height).toBeLessThan(maze.y);
  expect(box.x).toBeGreaterThan(titleRight);
  const sizes = await note(page).locator('.note-name, .note-box').evaluateAll(els => els.map(el => parseFloat(getComputedStyle(el).fontSize)));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(7 * PT - 0.01);
});

test('the note box lists what the maze has, a line a group, every box empty: Guides, Keys, Collectibles, Letters, Exits', async ({ page }) => {
  await open(page);
  await printIn(page, 'plain');
  await expect(note(page).locator('.note-name')).toHaveText(['Guides', 'Keys', 'Collectibles', 'Letters', 'Exits']);
  const boxes = name => note(page).locator('.note-line').filter({ has: page.locator('.note-name', { hasText: new RegExp(`^${name}$`) }) }).locator('.note-box');
  await expect(boxes('Guides')).toHaveCount(BIG.guides.length);
  await expect(boxes('Guides')).toHaveText(BIG.guides.map(() => ''));
  await expect(boxes('Keys')).toHaveText(['1']);
  await expect(boxes('Collectibles')).toHaveText(['', '']);
  await expect(boxes('Letters')).toHaveText(['A', 'B', 'C']);
  await expect(boxes('Exits')).toHaveText(['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA']);
});

test('a maze of guides alone lists Guides and End, nothing else', async ({ page }) => {
  await open(page, { maze: BIG });
  await printIn(page, 'plain');
  await expect(note(page).locator('.note-name')).toHaveText(['Guides', 'End']);
});

test('on paper zones are shaded and read ZONE 1, keys their number, and each exit its letter order', async ({ page }) => {
  await open(page);
  await printIn(page, 'plain');
  await expect(paper(page).locator('.ms-zone')).toHaveCount(1);
  await expect(paper(page).locator('.ms-zone-text')).toHaveText(['ZONE 1']);
  await expect(paper(page).locator('.ms-key-text')).toHaveText(['1']);
  await expect(paper(page).locator('.ms-letter-text')).toHaveText(['A', 'B', 'C']);
  await expect(paper(page).locator('.ms-exit-text')).toHaveText(['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA']);
  expect(Number(await paper(page).locator('.ms-zone').evaluate(z => getComputedStyle(z).fillOpacity))).toBeGreaterThan(0);
  await expect(paper(page).locator('.ms-start')).toHaveCount(1);
});

// The owner's pick, 2026-10-13 (TASK-105, option 2): at 7 pt a key reads its number alone, and an
// exit's or the end's pill is 1.2 cells wide, over the middle of the walls beside it.
test('at 7 pt every key number, exit order and End sits inside its own box or pill', async ({ page }) => {
  for (const maze of [EVERY, BIG]) {
    await open(page, { maze });
    await printIn(page, 'plain');
    const spills = await paper(page).evaluate(svg => [...svg.querySelectorAll('.ms-key-text, .ms-exit-text, .ms-end-text')].map(t => {
      const [text, box] = [t.getBoundingClientRect(), t.previousElementSibling.getBoundingClientRect()];
      return { label: t.textContent, left: text.left - box.left, right: box.right - text.right };
    }).filter(s => s.left < 0 || s.right < 0));
    expect(spills).toEqual([]);
    await page.emulateMedia({ media: 'screen' });
  }
});

test('my trail, my ticks and the solution never print: the sheet is the blank maze, whatever I did', async ({ page }) => {
  await open(page);
  const before = await sheet(page).innerHTML();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.locator('#flip').click();
  await printIn(page, 'plain');
  expect(await sheet(page).innerHTML()).toBe(before);
  await expect(page.locator('#trail, #main, #checklist')).toHaveCount(3);
  for (const id of ['trail', 'main', 'checklist']) await expect(page.locator('#' + id)).toBeHidden();
  await expect(paper(page).locator('polyline, .ms-trail')).toHaveCount(0);
});

test('Plain prints dots and solid tiles, no character and no background, whatever the look', async ({ page }) => {
  await open(page, { look: 'themed' });
  await printIn(page, 'plain');
  await expect(paper(page).locator('.ms-dot').first()).toBeVisible();
  await expect(sheet(page).locator('.ms-figure').first()).toBeHidden();
  await expect(paper(page).locator('.ms-block').first()).toHaveCSS('fill', 'rgb(85, 85, 85)');
  expect(await page.evaluate(() => getComputedStyle(document.body, '::before').content)).toBe('none');
});

for (const look of ['plain', 'themed']) {
  test(`Look ${look} and Print Colour: collectibles and blocks wear the maze's character, its background faint behind`, async ({ page }) => {
    await open(page, { look });
    await printIn(page, 'colour');
    const figures = sheet(page).locator('.ms-figure');
    await expect(figures).toHaveCount(EVERY.collectibles.length + EVERY.blocks.length);
    await expect(figures.first()).toBeVisible();
    expect(await figures.first().evaluate(f => getComputedStyle(f).backgroundImage)).toMatch(/\/content\/characters\/\w+\.webp"?\)$/);
    // Each collectible's figure stands on its own cell: 0.2 in square, less its edge.
    const [col, row] = (await paper(page).locator('.ms-dot').first().evaluate(d => d.parentNode.getAttribute('transform'))).match(/[\d.]+/g).map(Number);
    const maze = await paper(page).boundingBox();
    const fig = await figures.first().boundingBox();
    expect(fig.x + fig.width / 2).toBeCloseTo(maze.x + (col + 0.5) * 0.2 * IN, 0);
    expect(fig.y + fig.height / 2).toBeCloseTo(maze.y + (row + 0.5) * 0.2 * IN, 0);
    await expect(paper(page).locator('.ms-dot').first()).toBeHidden();
    await expect(paper(page).locator('.ms-block').first()).toHaveCSS('fill', 'rgb(255, 255, 255)');
    expect(await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage)).toMatch(/-bg\.webp/);
  });
}

test('Print Black and white is the Colour sheet in greys', async ({ page }) => {
  await open(page);
  await printIn(page, 'mono');
  await expect(sheet(page).locator('.ms-figure').first()).toBeVisible();
  await expect(paper(page)).toHaveCSS('filter', 'grayscale(1)');
  await expect(sheet(page).locator('[data-part="figures"]')).toHaveCSS('filter', 'grayscale(1)');
});

test('every real 32×40 maze on the site prints on one page, its note box above the maze', async ({ page }) => {
  test.setTimeout(120000);
  const index = require('../content/puzzles/maze/index.json').puzzles.filter(m => m.width === 32 && m.height === 40);
  expect(index.length).toBeGreaterThan(0);
  await page.addInitScript(() => { window.print = () => {}; });
  for (const { hiddenId } of index) {
    await page.goto('/app/maze.html?id=' + hiddenId);
    await expect(page.locator('#play')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    const box = await note(page).boundingBox();
    const maze = await paper(page).boundingBox();
    expect(box.y + box.height, hiddenId).toBeLessThan(maze.y);
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
    expect(pageSizes(pdf), hiddenId).toEqual([[0, 0, 612, 792]]);
    await page.emulateMedia({ media: 'screen' });
  }
});
