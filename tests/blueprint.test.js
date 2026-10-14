const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');
const BOARD = require('./fixtures/MINE-0001.json');
const SHAPE = require('./fixtures/CRSS-0001.json');
const MAZE = require('./fixtures/MAZE-0001.json');

// Blueprint (TASK-183): the third look, every page dressed as a technical drawing, no characters.
// The test puzzles are served under their own IDs; Plain is what Blueprint is measured against.
const LOOK_KEY = 'grew-puzzles.look';
const NAVY = 'rgb(18, 58, 94)';
const PAPER = 'rgb(245, 249, 252)';
const INK = 'rgb(230, 240, 249)';
const STAMP = 'rgb(255, 138, 128)';
const PHONE = { width: 390, height: 844 };

const ALL_WORDS = [
  [[4, 2], [2, 2]], [[1, 2], [3, 4]], [[5, 0], [5, 2]], [[6, 3], [4, 5]],
  [[0, 0], [0, 7]], [[0, 7], [2, 7]], [[7, 2], [7, 0]], [[1, 0], [6, 0]]
];
const COLS = PUZZLE.grids[0].rows[0].length;

async function lookAs(page, look) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LOOK_KEY, look]);
}

// Every character image the page asks for, and every error the page throws.
function watch(page) {
  const seen = { images: [], errors: [] };
  page.on('request', r => { if (/\/content\/characters\/.*\.webp$/.test(r.url())) seen.images.push(r.url()); });
  page.on('pageerror', e => seen.errors.push(e.message));
  return seen;
}

const css = (locator, property, pseudo) => locator.evaluate((el, [p, ps]) => getComputedStyle(el, ps).getPropertyValue(p), [property, pseudo || null]);

// The four play pages, each with its test puzzle and its size.
const KINDS = {
  wordsearch: { path: 'play.html', id: 'WSCH-0007', file: PUZZLE, cols: COLS, rows: PUZZLE.grids[0].rows.length, route: /\/content\/puzzles\/wordsearch\/WSCH-\d+\.json$/ },
  maze: { path: 'maze.html', id: 'MAZE-0901', file: MAZE, cols: MAZE.width, rows: MAZE.height, route: /\/content\/puzzles\/maze\/MAZE-\d+\.json$/ },
  minesweeper: { path: 'minesweeper.html', id: 'MINE-0001', file: BOARD, cols: BOARD.width, rows: BOARD.height, route: /\/content\/puzzles\/minesweeper\/MINE-\d+\.json$/ },
  crisscross: { path: 'crisscross.html', id: 'CRSS-0001', file: SHAPE, cols: SHAPE.width, rows: SHAPE.height, route: /\/content\/puzzles\/crisscross\/CRSS-\d+\.json$/ },
};

async function openKind(page, kind) {
  const k = KINDS[kind];
  await page.route(k.route, r => r.fulfill({ json: { ...k.file, hiddenId: k.id } }));
  await page.goto(`/app/${k.path}?id=${k.id}`);
  await expect(page.locator('#stage .grid, #stage [class$="-grid"]').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

function cell(page, r, c) {
  return page.locator('#grid .cell').nth(r * COLS + c);
}

async function tapAll(page, cells) {
  for (const [r, c] of cells) await cell(page, r, c).click();
}

const TEXT_PAGES = ['how-to-play', 'saving', 'about', 'unofficial', 'feedback', 'privacy'];

// ---- The switch ----

test('the side bar\'s Look offers Themed, Plain and Blueprint; picking Blueprint redresses the page at once and the next visit opens in it', async ({ page }) => {
  await page.goto('/app/privacy.html');
  const look = page.locator('#site-side .look');
  await expect(look.locator('option')).toHaveText(['Themed', 'Plain', 'Blueprint']);
  await look.locator('select').selectOption('blueprint');
  await expect(page.locator('html')).toHaveAttribute('data-look', 'blueprint');
  expect(await css(page.locator('body'), 'background-color')).toBe(NAVY);
  await page.goto('/app/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-look', 'blueprint');
  await expect(look.locator('select')).toHaveValue('blueprint');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-look', 'blueprint');
});

async function lookRow(page) {
  const side = await page.locator('#site-side').boundingBox();
  const name = await page.locator('#site-side .look-name').boundingBox(), pick = await page.locator('#site-side .look select').boundingBox();
  expect(Math.abs((name.y + name.height / 2) - (pick.y + pick.height / 2))).toBeLessThan(2);
  expect(pick.x + pick.width).toBeLessThanOrEqual(side.x + side.width);
  return { side, pick };
}

test('on a 1440×900 window, Look is one row — its name and the look on — at the foot of the side bar, never past its end', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/play.html?id=WSCH-0001');
  const { side, pick } = await lookRow(page);
  expect(pick.y + pick.height).toBeLessThanOrEqual(side.y + side.height);
});

test('on a phone, Look is one row inside the drawer', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/app/play.html?id=WSCH-0001');
  await page.locator('.burger').click();
  await lookRow(page);
});

test('a first visit still opens Themed', async ({ page }) => {
  await page.goto('/app/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-look', 'themed');
});

// ---- The drawing ----

for (const path of ['index.html', 'collection.html?slug=issue-1-remake', ...TEXT_PAGES.map(p => p + '.html')]) {
  test(`Blueprint, ${path.split(/[.?]/)[0]} has the navy drafting grid behind it and no character, and never asks for a character image or throws`, async ({ page }) => {
    await lookAs(page, 'blueprint');
    const seen = watch(page);
    await page.goto('/app/' + path);
    await expect(page.locator('#site-side .look')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await css(page.locator('body'), 'background-color')).toBe(NAVY);
    expect(await css(page.locator('body'), 'background-image')).toContain('linear-gradient');
    await expect(page.locator('.theme-figure:visible, #name-tag:visible')).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage)).toBe('none');
    expect(seen.images).toEqual([]);
    expect(seen.errors).toEqual([]);
  });
}

async function expectDrawingPaper(card) {
  expect(await css(card, 'background-color')).toBe(PAPER);
  expect(await css(card, 'border-top-left-radius')).toBe('0px');
  expect(await css(card, 'box-shadow')).toBe('none');
  expect(await css(card, 'outline-style')).toBe('solid');
  expect(await css(card, 'outline-offset')).toBe('5px');
}

test('Blueprint, every card is pale drawing paper with square corners, no shadow and a second ruled frame round it', async ({ page }) => {
  await lookAs(page, 'blueprint');
  await page.goto('/app/index.html');
  await expect(page.locator('.tiles .tile').first()).toBeVisible();
  await expectDrawingPaper(page.locator('.tiles .tile').first());
  await expectDrawingPaper(page.locator('#site-side'));
  await openKind(page, 'wordsearch');
  await expectDrawingPaper(page.locator('#stage .face').first());
  await expectDrawingPaper(page.locator('.words-box').first());
  await page.goto('/app/about.html');
  await expectDrawingPaper(page.locator('.page-card').first());
});

// ---- The play page ----

test('Blueprint, a play page\'s title reads as a title block — Title over its name, Grade · Drawing no. over its difficulty and code, on one line', async ({ page }) => {
  await lookAs(page, 'blueprint');
  await openKind(page, 'wordsearch');
  const head = page.locator('.play-head');
  expect(await css(page.locator('#title'), 'content', '::before')).toBe('"Title"');
  expect(await css(page.locator('#ident'), 'content', '::before')).toBe('"Grade · Drawing no."');
  await expect(page.locator('#ident')).toContainText('Easy');
  await expect(page.locator('#ident')).toContainText('WSCH-0007');
  const title = await page.locator('#title').boundingBox(), ident = await page.locator('#ident').boundingBox();
  expect(ident.x).toBeGreaterThanOrEqual(title.x + title.width - 1);
  expect(Math.abs(ident.y - title.y)).toBeLessThan(2);
  expect(await css(head, 'color')).toBe(INK);
});

for (const kind of Object.keys(KINDS)) {
  test(`Blueprint, the ${kind} grid card has dimension lines matching its size — columns along its foot, rows down its left`, async ({ page }) => {
    await lookAs(page, 'blueprint');
    await openKind(page, kind);
    const stage = page.locator('#stage');
    expect(await css(stage, 'counter-reset', '::after')).toBe(`cols ${KINDS[kind].cols}`);
    expect(await css(stage, 'counter-reset', '::before')).toBe(`rows ${KINDS[kind].rows}`);
    expect(await css(stage, 'content', '::after')).toContain('columns');
    expect(await css(stage, 'content', '::before')).toContain('rows');
    expect(await css(stage, 'color', '::after')).toBe(INK);
  });

  test(`Plain, the ${kind} grid card has no dimension lines and no title block`, async ({ page }) => {
    await lookAs(page, 'plain');
    await openKind(page, kind);
    expect(await css(page.locator('#stage'), 'content', '::after')).toBe('none');
    expect(await css(page.locator('#title'), 'content', '::before')).toBe('none');
  });

  test(`Blueprint, the ${kind} page wears the drafting grid and the title block, and no character`, async ({ page }) => {
    await lookAs(page, 'blueprint');
    const seen = watch(page);
    await openKind(page, kind);
    expect(await css(page.locator('body'), 'background-color')).toBe(NAVY);
    expect(await css(page.locator('#title'), 'content', '::before')).toBe('"Title"');
    await expect(page.locator('#theme-figure')).toBeHidden();
    await expect(page.locator('#name-tag')).toBeHidden();
    expect(seen.images).toEqual([]);
    expect(seen.errors).toEqual([]);
  });

  test(`Blueprint on a phone, the ${kind} page's dimension lines stay inside the screen`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    await lookAs(page, 'blueprint');
    await openKind(page, kind);
    const stage = await page.locator('#stage').boundingBox();
    // The rows' line sits 7px off the card's left and is 11px wide.
    expect(stage.x - 18).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(PHONE.width);
  });
}

test('Blueprint, a found word is marked with a dashed line', async ({ page }) => {
  await lookAs(page, 'blueprint');
  await openKind(page, 'wordsearch');
  await tapAll(page, ALL_WORDS[0]);
  const line = page.locator('#overlay line.mark-found');
  await expect(line).toHaveCount(1);
  expect(await css(line, 'stroke-dasharray')).not.toBe('none');
});

test('Plain, a found word\'s line stays solid', async ({ page }) => {
  await lookAs(page, 'plain');
  await openKind(page, 'wordsearch');
  await tapAll(page, ALL_WORDS[0]);
  expect(await css(page.locator('#overlay line.mark-found'), 'stroke-dasharray')).toBe('none');
});

test('Blueprint, a finished puzzle says Puzzle complete as a red stamp', async ({ page }) => {
  await lookAs(page, 'blueprint');
  await openKind(page, 'wordsearch');
  for (const ends of ALL_WORDS) await tapAll(page, ends);
  const stamp = page.locator('#complete');
  await expect(stamp).toBeVisible();
  expect(await css(stamp, 'color')).toBe(STAMP);
  expect(await css(stamp, 'border-top-style')).toBe('double');
  expect(await css(stamp, 'transform')).not.toBe('none');
});

// ---- The text pages ----

for (const name of TEXT_PAGES) {
  test(`Blueprint, ${name} puts its words on a paper card under a light uppercase title`, async ({ page }) => {
    await lookAs(page, 'blueprint');
    await page.goto(`/app/${name}.html`);
    const title = page.locator('.page h1');
    await expect(title).toBeVisible();
    expect(await css(title, 'color')).toBe(INK);
    expect(await css(title, 'text-transform')).toBe('uppercase');
    const card = page.locator('.page-card').first();
    expect(await css(card, 'background-color')).toBe(PAPER);
    const t = await title.boundingBox(), c = await card.boundingBox();
    expect(c.y).toBeGreaterThan(t.y + t.height - 1);
  });
}

// ---- The phone ----

test('Blueprint on a phone, the drawer side bar is paper and the page never scrolls sideways', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await lookAs(page, 'blueprint');
  await page.goto('/app/index.html');
  await page.locator('.burger').click();
  const side = page.locator('#site-side');
  await expect(side).toBeVisible();
  expect(await css(side, 'background-color')).toBe(PAPER);
  await expect(side.locator('.look select')).toHaveValue('blueprint');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(PHONE.width);
});

test('Blueprint on a phone, the title block stacks — a one-word title never runs under its grade', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await lookAs(page, 'blueprint');
  await page.route(KINDS.wordsearch.route, r => r.fulfill({ json: { ...PUZZLE, title: 'Birthdays' } }));
  await page.goto('/app/play.html?id=WSCH-0007');
  await page.evaluate(() => document.fonts.ready);
  const title = await page.locator('#title').boundingBox(), ident = await page.locator('#ident').boundingBox();
  expect(ident.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
  const head = await page.locator('.play-head').boundingBox();
  expect(title.x + title.width).toBeLessThanOrEqual(head.x + head.width + 1);
});

// ---- Nothing crowds the drawing ----

const REVEAL = require('./fixtures/MINE-0901.json');

for (const [name, file, under] of [['a board', BOARD, '.mines-tools'], ['a Reveal board', REVEAL, '.mines-tool-pick']]) {
  for (const [size, viewport] of [['wider than a phone', null], ['on a phone', PHONE]]) {
    test(`Blueprint ${size}, what sits under ${name} clears its columns' line`, async ({ page }) => {
      if (viewport) await page.setViewportSize(viewport);
      await lookAs(page, 'blueprint');
      await page.route(KINDS.minesweeper.route, r => r.fulfill({ json: file }));
      await page.goto('/app/minesweeper.html?id=' + file.hiddenId);
      await expect(page.locator(under)).toBeVisible();
      const stage = await page.locator('#stage').boundingBox(), next = await page.locator(under).boundingBox();
      // The columns' line runs 7px to 18px under the card.
      expect(next.y).toBeGreaterThanOrEqual(stage.y + stage.height + 18);
    });
  }
}

test('Blueprint, a Reveal board\'s switch still fits the window under the board', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await lookAs(page, 'blueprint');
  await page.route(KINDS.minesweeper.route, r => r.fulfill({ json: REVEAL }));
  await page.goto('/app/minesweeper.html?id=' + REVEAL.hiddenId);
  await expect(page.locator('.mines-tool-pick')).toBeInViewport({ ratio: 1 });
});

test('Blueprint, the words that sit straight on the drawing read in the light ink — the criss-cross help and the book\'s link and hint', async ({ page }) => {
  await lookAs(page, 'blueprint');
  await openKind(page, 'crisscross');
  expect(await css(page.locator('.criss .help'), 'color')).toBe('rgba(230, 240, 249, 0.7)');
  await page.addInitScript(() => { window.print = () => {}; });
  await page.goto('/app/book.html?slug=issue-1-remake&print=plain');
  await expect(page.locator('#hint')).toBeVisible();
  expect(await css(page.locator('#hint'), 'color')).toBe('rgba(230, 240, 249, 0.7)');
  expect(await css(page.locator('#back'), 'color')).toBe('rgba(230, 240, 249, 0.7)');
});

// ---- Its own markings stay Plain's ----

test('Blueprint, a marked mine is Plain\'s ringed dot, never a character', async ({ page }) => {
  await lookAs(page, 'blueprint');
  await openKind(page, 'minesweeper');
  const square = page.locator('.mines-square:not([data-number])').first();
  await square.click();
  await square.click();
  await expect(square).toHaveAttribute('data-mark', 'mine');
  expect(await css(square, 'background-image')).toBe('none');
});
