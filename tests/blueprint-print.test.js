const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');
const SMALL_MAZE = require('./fixtures/MAZE-0001.json');
const MAZE = require('./fixtures/MAZE-0002.json');
const BOARD = require('./fixtures/MINE-0001.json');
const SHAPE = require('./fixtures/CRSS-0003.json');

// Blueprint on paper (TASK-184): with the look on Blueprint, Print Colour and Black and white put
// the puzzle on a Blueprint sheet in place of a character's — a faint drafting grid to the paper's
// edge, the title block, the cards ruled in navy inside a second frame, a grid card's dimension
// lines — and Black and white is that sheet in black and greys. Plain prints today's sheet, and
// Themed its character, whatever Blueprint does. Paper is the browser's print layout on a window a
// US Letter sheet wide.
const LOOK_KEY = 'grew-puzzles.look';
const NAVY = 'rgb(18, 58, 94)';
const BLACK = 'rgb(0, 0, 0)';
const WHITE = 'rgb(255, 255, 255)';
const IN = 96;

// A 3-grid Saga of the test puzzle's grid: its words sheet, then a sheet a grid.
const SAGA = {
  ...PUZZLE, hiddenId: 'WSCH-0010', title: 'Farm Saga', type: 'Saga',
  words: PUZZLE.words.map((w, i) => ({ ...w, grid: i % 3 })),
  grids: [0, 1, 2].map(() => ({ rows: PUZZLE.grids[0].rows })),
};
// The 32×40 maze wearing the 6×6's keys, zone, collectibles, letters and exits.
const EVERY = { ...MAZE, title: 'Every Thing', keys: SMALL_MAZE.keys, zones: SMALL_MAZE.zones,
  collectibles: SMALL_MAZE.collectibles, letters: SMALL_MAZE.letters, exits: SMALL_MAZE.exits };

// Each kind's page, its test puzzle, its grid's card and how many sheets it prints.
const KINDS = {
  wordsearch: { path: 'play.html', file: PUZZLE, route: /\/puzzles\/wordsearch\/WSCH-\d+\.json$/, card: '#card', sheets: 1 },
  saga: { path: 'play.html', file: SAGA, route: /\/puzzles\/wordsearch\/WSCH-\d+\.json$/, card: '.grid-sheet .print-card', sheets: 4 },
  maze: { path: 'maze.html', file: EVERY, route: /\/puzzles\/maze\/MAZE-\d+\.json$/, card: null, sheets: 1 },
  minesweeper: { path: 'minesweeper.html', file: BOARD, route: /\/puzzles\/minesweeper\/MINE-\d+\.json$/, card: '.mines-print-card', sheets: 1 },
  crisscross: { path: 'crisscross.html', file: SHAPE, route: /\/puzzles\/crisscross\/CRSS-\d+\.json$/, card: '.criss-print-card', sheets: 1 },
};

// Opens a kind's page in a look, the print dialog stood in for, noting every character image asked for.
async function open(page, kind, look) {
  const k = KINDS[kind];
  const images = [];
  page.on('request', r => { if (/\/content\/characters\/.*\.webp$/.test(r.url())) images.push(r.url()); });
  await page.addInitScript(l => {
    localStorage.setItem('grew-puzzles.look', l);
    window.printed = 0;
    window.print = () => { window.printed += 1; };
  }, look);
  await page.route(k.route, r => r.fulfill({ json: k.file }));
  await page.goto(`/app/${k.path}?id=${k.file.hiddenId}`);
  await expect(page.locator('#play')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return images;
}

// Print page's pick, as the side bar makes it, then the paper.
async function printIn(page, style) {
  await page.locator(`#site-side #print [data-print="${style}"]`).click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  await page.setViewportSize({ width: 8.5 * IN, height: 11 * IN });
  await page.emulateMedia({ media: 'print' });
}

const css = (locator, property, pseudo) => locator.evaluate((el, [p, ps]) => getComputedStyle(el, ps).getPropertyValue(p), [property, pseudo || null]);
// Saved as a PDF the way Chrome's Save as PDF makes it: at the page's own size, its colours as forced.
const savePdf = page => page.pdf({ preferCSSPageSize: true, printBackground: true });
const pdfPages = pdf => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const pageSizes = pdf => [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page[^s][\s\S]*?\/MediaBox\s*\[([^\]]*)\]/g)].map(m => m[1].trim().split(/\s+/).map(Number));

for (const kind of Object.keys(KINDS)) {
  test(`Blueprint, Print Colour: the ${kind} sheet wears the drafting grid to the paper's edge and the title block, with no character, none asked for, on as many pages as ever`, async ({ page }) => {
    const images = await open(page, kind, 'blueprint');
    await printIn(page, 'colour');
    const body = page.locator('body');
    expect(await css(body, 'background-image', '::before')).toContain('linear-gradient');
    expect(await css(body, 'background-image', '::before')).not.toContain('url(');
    expect(await css(body, 'position', '::before')).toBe('fixed');
    expect(await css(body, 'opacity', '::before')).toBe('1');
    for (const figure of await page.locator('.print-figure').all()) await expect(figure).toBeHidden();
    expect(images).toEqual([]);
    // One title block a sheet: Title over the name, Grade · Drawing no. over the line under it.
    const heads = page.locator('.play-head:visible');
    await expect(heads).toHaveCount(kind === 'saga' ? 4 : 1);
    const head = heads.first();
    expect(await css(head, 'border-top-color')).toBe(NAVY);
    expect(await css(head, 'background-color')).toBe(WHITE);
    expect(await css(head.locator('h1'), 'content', '::before')).toBe('"Title"');
    expect(await css(head.locator('h1'), 'text-transform')).toBe('uppercase');
    expect(await css(head.locator('h1'), 'color')).toBe(NAVY);
    // Every sheet still fits on one page.
    expect(pdfPages(await savePdf(page))).toBe(KINDS[kind].sheets);
  });
}

for (const kind of ['wordsearch', 'saga', 'minesweeper', 'crisscross']) {
  test(`Blueprint, Print Colour: the ${kind} grid card has its dimension lines on paper — columns along its foot, rows down its left, a tick at each end`, async ({ page }) => {
    await open(page, kind, 'blueprint');
    await printIn(page, 'colour');
    const card = page.locator(KINDS[kind].card).first();
    const box = await card.boundingBox();
    expect(await css(card, 'content', '::after')).toContain('columns');
    expect(await css(card, 'content', '::before')).toContain('rows');
    expect(await css(card, 'color', '::after')).toBe(NAVY);
    // The rows' ticks are its top and bottom: its words run down it, and its sides stay open.
    expect(await css(card, 'border-top-style', '::before')).toBe('solid');
    expect(await css(card, 'border-bottom-style', '::before')).toBe('solid');
    expect(await css(card, 'border-left-style', '::before')).toBe('none');
    expect(await css(card, 'border-left-style', '::after')).toBe('solid');
    // Off the card, where they never move the sheet: the foot's under it and the left's beside it.
    const foot = await card.evaluate(el => parseFloat(getComputedStyle(el, '::after').top));
    expect(foot).toBeGreaterThan(box.height);
  });
}

test('Blueprint, Print Colour: the wordsearch\'s cards are ruled in navy, each inside a second frame, their bands navy', async ({ page }) => {
  await open(page, 'wordsearch', 'blueprint');
  await printIn(page, 'colour');
  for (const card of [page.locator('#front'), page.locator('#words-list .words-box')]) {
    expect(await css(card, 'border-top-color')).toBe(NAVY);
    expect(await css(card, 'box-shadow')).toBe('none');
    expect(await css(card, 'outline-style')).toBe('solid');
    expect(await css(card, 'outline-offset')).toBe('4px');
  }
  expect(await css(page.locator('#label'), 'background-color')).toBe(NAVY);
  expect(await css(page.locator('#label'), 'text-transform')).toBe('uppercase');
});

test('Blueprint, Print Black and white is the same sheet in black and greys', async ({ page }) => {
  await open(page, 'wordsearch', 'blueprint');
  await printIn(page, 'mono');
  expect(await css(page.locator('body'), 'background-image', '::before')).toContain('rgba(0, 0, 0');
  expect(await css(page.locator('body'), 'background-image', '::before')).not.toContain('url(');
  expect(await css(page.locator('#front'), 'border-top-color')).toBe(BLACK);
  expect(await css(page.locator('#label'), 'background-color')).toBe(BLACK);
  expect(await css(page.locator('.play-head'), 'border-top-color')).toBe(BLACK);
  expect(await css(page.locator('.play-head h1'), 'content', '::before')).toBe('"Title"');
  await expect(page.locator('#card .print-figure')).toBeHidden();
});

for (const kind of ['wordsearch', 'maze', 'minesweeper', 'crisscross']) {
  test(`Blueprint, Print Plain: the ${kind} printout is today's sheet — white paper, black ink, no drafting grid, no title block`, async ({ page }) => {
    await open(page, kind, 'blueprint');
    await printIn(page, 'plain');
    expect(await css(page.locator('body'), 'background-color')).toBe(WHITE);
    expect(await css(page.locator('body'), 'content', '::before')).toBe('none');
    const head = page.locator('.play-head:visible');
    await expect(head).toHaveCount(1);
    expect(await css(head.locator('h1'), 'color')).toBe(BLACK);
    expect(await css(head.locator('h1'), 'content', '::before')).toBe('none');
    expect(await css(head, 'display')).not.toBe('grid');
  });
}

test('Blueprint, Print Plain: the wordsearch\'s cards are today\'s — black lines and bands, no second frame, no dimension lines', async ({ page }) => {
  await open(page, 'wordsearch', 'blueprint');
  await printIn(page, 'plain');
  expect(await css(page.locator('#front'), 'border-top-color')).toBe(BLACK);
  expect(await css(page.locator('#label'), 'background-color')).toBe(BLACK);
  expect(await css(page.locator('#front'), 'outline-style')).toBe('none');
  expect(await css(page.locator('#card'), 'content', '::after')).toBe('none');
});

test('Themed, Print Colour still prints the character and its background, whatever Blueprint does', async ({ page }) => {
  await open(page, 'wordsearch', 'themed');
  await printIn(page, 'colour');
  expect(await css(page.locator('body'), 'background-image', '::before')).toContain('url(');
  await expect(page.locator('#card .print-figure')).toBeVisible();
  expect(await css(page.locator('.play-head h1'), 'content', '::before')).toBe('none');
  expect(await css(page.locator('#card'), 'content', '::after')).toBe('none');
});

test('Blueprint, a sheet never starts lower to make room for a character: Themed\'s would', async ({ page }) => {
  await open(page, 'wordsearch', 'blueprint');
  await printIn(page, 'colour');
  await page.evaluate(() => document.documentElement.style.setProperty('--print-rise', '40px'));
  await expect(page.locator('.wrap')).toHaveCSS('padding-top', '48px');
  await page.evaluate(() => { document.documentElement.dataset.look = 'themed'; });
  await expect(page.locator('.wrap')).toHaveCSS('padding-top', '88px');
});

test('Blueprint, Print Colour: a maze is in the ink alone — no character on its collectibles or blocks, its dots and solid tiles navy', async ({ page }) => {
  await open(page, 'maze', 'blueprint');
  await printIn(page, 'colour');
  const sheet = page.locator('#maze-sheet');
  for (const figure of await sheet.locator('.ms-figure').all()) await expect(figure).toBeHidden();
  expect(await sheet.locator('.ms-dot').count()).toBeGreaterThan(0);
  for (const dot of await sheet.locator('.ms-dot').all()) {
    await expect(dot).toBeVisible();
    expect(await css(dot, 'fill')).toBe(NAVY);
  }
  for (const block of await sheet.locator('.ms-block').all()) expect(await css(block, 'fill')).toBe(NAVY);
  expect(await css(sheet.locator('.ms-walls'), 'stroke')).toBe(NAVY);
  expect(await css(sheet.locator('.maze-note'), 'border-top-color')).toBe(NAVY);
  // Its title block clears the note box at its right.
  const head = await sheet.locator('.play-head').boundingBox();
  const note = await sheet.locator('.maze-note').boundingBox();
  expect(head.x + head.width).toBeLessThanOrEqual(note.x);
});

test('Blueprint, Print Colour: a minesweeper board and a criss-cross are ruled in navy', async ({ page, browser }) => {
  await open(page, 'minesweeper', 'blueprint');
  await printIn(page, 'colour');
  expect(await css(page.locator('#mines-sheet .mines-paper'), 'border-top-color')).toBe(NAVY);
  expect(await css(page.locator('#mines-sheet .mines-paper > span').first(), 'border-right-color')).toBe(NAVY);
  const criss = await browser.newPage();
  await open(criss, 'crisscross', 'blueprint');
  await printIn(criss, 'colour');
  expect(await css(criss.locator('#criss-sheet .criss-paper > span').first(), 'border-top-color')).toBe(NAVY);
  expect(await css(criss.locator('#criss-sheet .criss-paper-card'), 'border-top-color')).toBe(NAVY);
  await criss.close();
});

// A book of a wordsearch, a Saga and a 32×40 maze, its puzzles served as the site's files are.
const drawings = { slug: 'drawings', name: 'Drawings', description: 'Three to draw.', created: '2026-10-14',
  puzzles: [{ id: 'WSCH-0007', number: 1 }, { id: 'WSCH-0010', number: 2 }, { id: 'MAZE-0002', number: 3 }] };

async function openBook(page, look) {
  const images = [];
  page.on('request', r => { if (/\/content\/characters\/.*\.webp$/.test(r.url())) images.push(r.url()); });
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [drawings] } }));
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: { puzzles: [PUZZLE, SAGA].map(p => ({ hiddenId: p.hiddenId, type: p.type, created: p.created, title: p.title })) } }));
  await page.route('**/content/puzzles/maze/index.json', r => r.fulfill({ json: { puzzles: [{ hiddenId: MAZE.hiddenId, width: MAZE.width, height: MAZE.height }] } }));
  await page.route(/\/puzzles\/wordsearch\/WSCH-\d+\.json$/, r => r.fulfill({ json: { 'WSCH-0007': PUZZLE, 'WSCH-0010': SAGA }[r.request().url().match(/(WSCH-\d+)\.json$/)[1]] }));
  await page.route('**/content/puzzles/maze/MAZE-0002.json', r => r.fulfill({ json: MAZE }));
  await page.addInitScript(l => {
    localStorage.setItem('grew-puzzles.look', l);
    window.printed = 0;
    window.print = () => { window.printed += 1; };
  }, look);
  await page.goto('/app/book.html?slug=drawings&print=colour');
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  return images;
}

test('Blueprint, a book printed Colour: every puzzle page is a Blueprint sheet, its grid reaching past the trim as the background does', async ({ page, browser }) => {
  const images = await openBook(page, 'blueprint');
  await page.emulateMedia({ media: 'print' });
  const sheets = page.locator('.sheets :is(.sheet, .grid-sheet)');
  // The wordsearch's, the Saga's words and its three grids, and the maze's.
  expect(await sheets.count()).toBe(6);
  for (const sheet of await sheets.all()) {
    expect(await css(sheet, 'background-image', '::before')).toContain('linear-gradient');
    expect(await css(sheet, 'background-image', '::before')).not.toContain('url(');
    // From the paper's corner over the trim and the bleed, as the background's is.
    expect(await css(sheet, 'width', '::before')).toBe(`${8.625 * IN}px`);
    expect(await css(sheet, 'height', '::before')).toBe(`${11.25 * IN}px`);
  }
  for (const figure of await page.locator('.sheets .print-figure').all()) await expect(figure).toBeHidden();
  expect(images).toEqual([]);
  // The KDP bleed interior, page for page as the Themed book prints.
  const blueprint = await savePdf(page);
  const themed = await browser.newPage();
  await openBook(themed, 'themed');
  const theirs = await savePdf(themed);
  expect(pageSizes(blueprint)).toEqual(pageSizes(theirs));
  expect(pdfPages(blueprint)).toBe(8);
  await themed.close();
});
