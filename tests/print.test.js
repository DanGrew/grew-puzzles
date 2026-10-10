const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');
const { characters: CHARACTERS } = require('../content/characters/index.json');

// Printing themed (TASK-46): the print menus — Print page on a puzzle, Print book on a collection,
// each Colour, Black and white or Plain — and the printout and the book they dress, on the real
// characters list. Paper is the browser's print
// layout on a window a US Letter sheet wide.
const LOOK_KEY = 'grew-puzzles.look';
const url = file => `url("http://localhost:${new URL(test.info().project.use.baseURL).port}/content/characters/${file}")`;
// A 3-grid Saga of the test puzzle's grid.
const saga = hiddenId => ({
  ...PUZZLE, hiddenId, title: 'Farm Saga', type: 'Saga',
  words: PUZZLE.words.map((w, i) => ({ ...w, grid: i % 3 })),
  grids: [0, 1, 2].map(() => ({ rows: PUZZLE.grids[0].rows })),
});

const keep = (page, key, value) => page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, value]);
// The style the next play page opened is printed in, picked from its Print page menu.
const printing = (page, style) => page.addInitScript(s => { window.printStyle = s; }, style);
// Picks a style from Print page and waits for the dialog — here a stand-in that only counts, and
// tells the page it is printing, as the browser's own dialog does.
async function pick(page, style) {
  const before = await page.evaluate(() => window.printed);
  await page.locator(`#site-side #print button[data-print="${style}"]`).click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(before + 1);
}
// Math.random answers each of draws in turn, round again after the last.
const draws = (page, values) => page.addInitScript(v => { let n = 0; Math.random = () => v[n++ % v.length]; }, values);
// Math.random answers whatever the test last set, whoever else on the page asks.
const drawing = page => page.addInitScript(() => { window.draw = 0; Math.random = () => window.draw; });
const printWith = (page, draw) => page.evaluate(d => { window.draw = d; window.dispatchEvent(new Event('beforeprint')); }, draw);
const css = (locator, property) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);
const before = (locator, property) => locator.evaluate((el, p) => getComputedStyle(el, '::before').getPropertyValue(p), property);
const box = locator => locator.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height }; });
const mirrored = locator => locator.evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return m.a * m.d - m.b * m.c < 0; });

async function openPlay(page, hiddenId, file) {
  await page.route(/\/content\/puzzles\/wordsearch\/WSCH-\d+\.json$/, route => route.fulfill({ json: file || { ...PUZZLE, hiddenId } }));
  await page.addInitScript(() => { window.printed = 0; window.print = () => { window.printed++; window.dispatchEvent(new Event('beforeprint')); }; });
  await page.setViewportSize({ width: 816, height: 1056 });
  await page.goto('/app/play.html?id=' + hiddenId);
  await expect(page.locator('#grid .cell').first()).toBeAttached();
  await expect(page.locator('.print-figure[data-spot]').first()).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  const style = await page.evaluate(() => window.printStyle);
  if (style) await pick(page, style);
}

const onPaper = page => page.emulateMedia({ media: 'print' });
const figure = page => page.locator('#card .print-figure');
const scene = page => before(page.locator('body'), 'background-image');

for (const path of ['index.html', 'collection.html?slug=issue-1-remake', 'play.html?id=WSCH-0001', 'book.html?slug=issue-1-remake', 'about.html', 'feedback.html', 'privacy.html']) {
  test(`${path.split(/[.?]/)[0]} prints Plain until a print menu says otherwise, and no side bar carries a print setting of its own`, async ({ page }) => {
    await page.addInitScript(() => { window.print = () => {}; });
    await page.goto('/app/' + path);
    await expect(page.locator('html')).toHaveAttribute('data-print', 'plain');
    await expect(page.locator('#site-side .print-menu:visible button[aria-pressed]')).toHaveCount(0);
    await expect(page.locator('#site-side > *').nth(-2)).toHaveClass(/\blook\b/);
  });
}

test('a style picked on one puzzle is that print\'s alone: the next puzzle starts Plain, and nothing is kept', async ({ page }) => {
  await openPlay(page, 'WSCH-0007');
  await pick(page, 'mono');
  await expect(page.locator('html')).toHaveAttribute('data-print', 'mono');
  await expect(page.locator('html')).toHaveAttribute('data-look', 'themed');
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('print')))).toEqual([]);
  await openPlay(page, 'WSCH-0008');
  await expect(page.locator('html')).toHaveAttribute('data-print', 'plain');
});

test('Look Themed and Print page Plain: the printout is today\'s sheet — no character, no background, the title off its tag', async ({ page }) => {
  await keep(page, LOOK_KEY, 'themed');
  await printing(page, 'plain');
  await openPlay(page, 'WSCH-0007');
  await onPaper(page);
  await expect(figure(page)).toBeHidden();
  expect(await before(page.locator('body'), 'content')).toBe('none');
  await expect(page.locator('.play-head')).toHaveCSS('box-shadow', 'none');
  await expect(page.locator('.wrap')).toHaveCSS('padding-top', '0px');
});

for (const look of ['themed', 'plain']) {
  test(`Look ${look} and Print Colour: the sheet wears the puzzle's character, with no name label, its background faint to the paper's edge`, async ({ page }) => {
    await keep(page, LOOK_KEY, look);
    await printing(page, 'colour');
    await openPlay(page, 'WSCH-0007');
    await onPaper(page);
    const owner = CHARACTERS[6];
    await expect(figure(page)).toBeVisible();
    expect(await css(figure(page), 'background-image')).toBe(url(owner.figure));
    expect(await css(figure(page), 'z-index')).toBe('-1');
    expect(await css(figure(page), 'filter')).toBe('none');
    // No name label on paper, the printout's own or the screen's.
    await expect(page.getByText(owner.name)).toBeHidden();
    expect(await scene(page)).toBe(url(owner.scene));
    expect(await before(page.locator('body'), 'position')).toBe('fixed');
    expect(await before(page.locator('body'), 'opacity')).toBe('0.28');
    // The sheet keeps its half inch inside; the title sits on its white tag.
    await expect(page.locator('.wrap')).toHaveCSS('padding-top', '48px');
    await expect(page.locator('.play-head')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    // Only the grid card's character: a puzzle of one grid has no words sheet of its own.
    await expect(page.locator('aside .print-figure')).toBeHidden();
  });
}

test('Print Black and white is the Colour sheet in greys', async ({ page }) => {
  await printing(page, 'mono');
  await openPlay(page, 'WSCH-0007');
  await onPaper(page);
  await expect(figure(page)).toBeVisible();
  expect(await css(figure(page), 'filter')).toBe('grayscale(1)');
  expect(await before(page.locator('body'), 'filter')).toBe('grayscale(1)');
});

test('the grid and words stay as legible as Plain: white cards in front of the character at every spot', async ({ page }) => {
  await printing(page, 'colour');
  await drawing(page);
  await openPlay(page, 'WSCH-0007');
  await onPaper(page);
  await expect(page.locator('.front-face')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.words-box')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  for (const draw of [0, 0.3, 0.5, 0.99]) {
    await printWith(page, draw);
    await expect(figure(page)).toHaveAttribute('data-spot', ['right', 'left', 'topRight', 'topLeft'][[0, 0.3, 0.5, 0.99].indexOf(draw)]);
    expect(await css(figure(page), 'z-index')).toBe('-1');
  }
});

test('a Saga\'s words card takes the sheet\'s whole width less its half-inch edges, as the print rules reckon it', async ({ page }) => {
  await printing(page, 'colour');
  await openPlay(page, 'WSCH-0012', saga('WSCH-0012'));
  await onPaper(page);
  expect(Math.round((await box(page.locator('aside'))).width)).toBe(816 - 96);
});

// A name label once stood past the paper's side, and the browser shrank every page to fit it, the
// background stopping short of the right and bottom edges.
test('whatever reaches past the paper\'s side is clipped there, so no page is shrunk and the background reaches every edge', async ({ page }) => {
  await printing(page, 'colour');
  await openPlay(page, 'WSCH-0007');
  await onPaper(page);
  // As if a character stood far past the right edge.
  await figure(page).evaluate(el => { el.style.left = 'calc(100% + 900px)'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(816);
});

// The grid card's stage keeps the screen's 3D flip, which once set the character in a layer of its
// own over the title: a top corner's character stood in front of it.
for (const [name, path] of [['the play page', 'play'], ['a book page', 'book']]) {
  test(`on ${name}, a character over a top corner stands behind the title, as behind the grid`, async ({ page }) => {
    await printing(page, 'colour');
    await drawing(page);
    const sheet = {
      play: async () => { await openPlay(page, 'WSCH-0007'); return page.locator('.wrap'); },
      book: async () => { await openBook(page, 'colour'); return page.locator('.sheet').first(); },
    }[path];
    const play = await sheet();
    await onPaper(page);
    await printWith(page, 0.99);
    await play.locator('.play-head').scrollIntoViewIfNeeded();
    const figureEl = play.locator('.card .print-figure');
    await expect(figureEl).toHaveAttribute('data-spot', 'topLeft');
    // A point both the figure and the title cover: the title is what's seen there.
    const title = await box(play.locator('.play-head')), f = await box(figureEl);
    const x = Math.max(title.x, f.x) + 4, y = title.y + title.height - 6;
    expect(x).toBeLessThan(Math.min(title.x + title.width, f.x + f.width));
    const top = await page.evaluate(([px, py]) => { const el = document.elementFromPoint(px, py - scrollY); return el.closest('.play-head') ? 'title' : el.className; }, [x, y]);
    expect(top).toBe('title');
  });
}

test('each print picks one of the four spots at random, and the next print can pick another', async ({ page }) => {
  await printing(page, 'colour');
  await drawing(page);
  await openPlay(page, 'WSCH-0007');
  await onPaper(page);
  const card = await box(page.locator('#card'));
  const spots = [];
  for (const draw of [0, 0.3, 0.5, 0.99]) {
    await printWith(page, draw);
    const spot = await figure(page).getAttribute('data-spot');
    const f = await box(figure(page)), centre = { x: f.x + f.width / 2, y: f.y + f.height / 2 };
    spots.push([spot, await mirrored(figure(page)), Math.round(centre.x - card.x), Math.round(centre.y - card.y)]);
  }
  // Right and top right held from the card's right edge, left and top left from its left, all from its top.
  expect(spots).toEqual([
    ['right', true, Math.round(card.width + 10), 188],
    ['left', false, -1, 171],
    ['topRight', true, Math.round(card.width - 51), -13],
    ['topLeft', false, 49, -14],
  ]);
});

test('Print page dresses the sheet again before the dialog opens', async ({ page }) => {
  await printing(page, 'colour');
  await drawing(page);
  await openPlay(page, 'WSCH-0007');
  await expect(figure(page)).toHaveAttribute('data-spot', 'right');
  await page.evaluate(() => { window.draw = 0.99; });
  await pick(page, 'colour');
  await expect(figure(page)).toHaveAttribute('data-spot', 'topLeft');
});

test('the sheet\'s card sits where the print rules reckon it, so a head is kept inside what a printer reaches', async ({ page }) => {
  await printing(page, 'colour');
  await openPlay(page, 'WSCH-0007');
  await onPaper(page);
  expect(Math.round((await box(page.locator('#card'))).y)).toBe(140);
});

test('a Saga peers only over the top corners: of its words card on the words sheet, of each grid on its own sheet', async ({ page }) => {
  await printing(page, 'colour');
  await drawing(page);
  await openPlay(page, 'WSCH-0012', saga('WSCH-0012'));
  await onPaper(page);
  const owner = CHARACTERS[11];
  await expect(figure(page)).toBeHidden();
  const words = page.locator('aside .print-figure');
  await expect(words).toBeVisible();
  expect(await css(words, 'background-image')).toBe(url(owner.figure));
  const grids = page.locator('.grid-sheet .print-figure');
  await expect(grids).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(grids.nth(i)).toBeVisible();
  const spots = await page.locator('.print-figure[data-spot]:visible').evaluateAll(els => els.map(el => el.dataset.spot));
  expect(spots).toHaveLength(4);
  expect(spots.every(spot => ['topRight', 'topLeft'].includes(spot))).toBe(true);
  await printWith(page, 0.3);
  expect(await page.locator('.print-figure[data-spot]:visible').evaluateAll(els => els.map(el => el.dataset.spot))).toEqual(['topRight', 'topRight', 'topRight', 'topRight']);
  // The words card's top right: as far in from its right edge as on the one-grid sheet.
  const aside = await box(page.locator('aside')), f = await box(words);
  expect(Math.round(f.x + f.width / 2 - aside.x)).toBe(Math.round(aside.width - 51));
  expect(Math.round((await box(page.locator('aside'))).y)).toBe(160);
});

test('a head too near a Saga grid sheet\'s top starts that sheet only as much lower as it needs', async ({ page }) => {
  // Horsosaur over the top left: its head stands 103 px over the grid card, which sits 121 px down.
  await printing(page, 'colour');
  await drawing(page);
  await openPlay(page, 'WSCH-0009', saga('WSCH-0009'));
  await onPaper(page);
  await printWith(page, 0.99);
  const sheet = page.locator('.grid-sheet').first();
  const rise = parseFloat(await css(sheet, '--print-rise'));
  expect(rise).toBeGreaterThan(5);
  expect(rise).toBeLessThan(8);
  const card = await box(sheet.locator('.print-card')), top = await box(sheet);
  expect(card.y - top.y).toBeCloseTo(121 + rise, 0);
});

// The character images the page had loaded by the time the dialog opened.
const loadedAtPrint = page => page.evaluate(() => window.loadedAtPrint.slice().sort());
const recordLoads = page => page.addInitScript(() => {
  window.addEventListener('beforeprint', () => {
    window.loadedAtPrint = performance.getEntriesByType('resource').map(e => e.name).filter(n => /\/content\/characters\/.*\.webp$/.test(n)).map(n => n.split('/').pop());
  });
});

test('Plain look and Print page Plain load no character image; Colour has the puzzle\'s pair in before the dialog opens, whatever the look', async ({ page }) => {
  await recordLoads(page);
  await keep(page, LOOK_KEY, 'plain');
  await openPlay(page, 'WSCH-0007');
  await pick(page, 'plain');
  expect(await loadedAtPrint(page)).toEqual([]);
  await pick(page, 'colour');
  expect(await loadedAtPrint(page)).toEqual([CHARACTERS[6].figure, CHARACTERS[6].scene].sort());
});

// The PDF the browser would print: how many sheets.
const sheetsOf = async page => (await page.pdf({ printBackground: true, preferCSSPageSize: true, format: 'Letter' })).toString('latin1').match(/\/Type\s*\/Page[^s]/g).length;

test('printed Colour, a puzzle of one grid still prints on one sheet, and a Saga on as many as Plain', async ({ page }) => {
  await openPlay(page, 'WSCH-0007');
  expect(await sheetsOf(page)).toBe(1);
  await pick(page, 'colour');
  expect(await sheetsOf(page)).toBe(1);
  await openPlay(page, 'WSCH-0012', saga('WSCH-0012'));
  const plain = await sheetsOf(page);
  await pick(page, 'colour');
  expect(await sheetsOf(page)).toBe(plain);
  expect(plain).toBe(4);
});

// ---- The collection book ----
const SAGA = saga('WSCH-0010');
const FILES = { 'WSCH-0007': PUZZLE, 'WSCH-0008': { ...PUZZLE, hiddenId: 'WSCH-0008', title: 'Second' }, 'WSCH-0010': SAGA };
// Numbered 1, 2 and 13: the thirteenth puzzle wears the first character again.
const issue = {
  slug: 'issue-1', name: 'Issue #1', description: 'Printed themed.', created: '2026-10-09',
  puzzles: [{ id: 'WSCH-0008', number: 13 }, { id: 'WSCH-0007', number: 1 }, { id: 'WSCH-0010', number: 2 }],
};

// The book in a style, as Print book's link on the collection page opens it.
async function openBook(page, style) {
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [issue] } }));
  await page.route(/\/puzzles\/wordsearch\/WSCH-\d+\.json$/, r => r.fulfill({ json: FILES[r.request().url().match(/(WSCH-\d+)\.json$/)[1]] }));
  await page.addInitScript(() => { window.printed = 0; window.print = () => { window.printed++; window.dispatchEvent(new Event('beforeprint')); }; });
  await page.setViewportSize({ width: 816, height: 1056 });
  await page.goto(`/app/book.html?slug=issue-1&print=${style}`);
  await expect(page.locator('#ready')).toBeVisible();
}

test('the book\'s puzzles wear their characters in number order, round again after the last, as on the collection page', async ({ page }) => {
  await openBook(page, 'colour');
  await page.emulateMedia({ media: 'print' });
  const sheets = page.locator('.sheet');
  const wearing = [CHARACTERS[0], CHARACTERS[1], CHARACTERS[0]];
  for (const i of [0, 1, 2]) {
    await expect(sheets.nth(i).locator('.sheet-number').first()).toHaveText(['Puzzle 1', 'Puzzle 2', 'Puzzle 13'][i]);
    expect(await before(sheets.nth(i), 'background-image')).toBe(url(wearing[i].scene));
    expect(await css(sheets.nth(i).locator('.print-figure:visible').first(), 'background-image')).toBe(url(wearing[i].figure));
  }
  // Each page's background, from the paper's corner, the book's 8.5 × 11 in.
  expect(await before(sheets.first(), 'width')).toBe('816px');
  expect(await before(sheets.first(), 'height')).toBe('1056px');
  expect(Math.round((await box(sheets.first().locator('.card'))).y - (await box(sheets.first())).y)).toBe(169);
});

test('each book page picks its own spot, a Saga\'s only the top corners, and printing again picks afresh', async ({ page }) => {
  await draws(page, [0, 0.3, 0.6, 0.99]);
  await openBook(page, 'colour');
  await page.emulateMedia({ media: 'print' });
  const spots = () => page.locator('.sheet .print-figure[data-spot]:visible').evaluateAll(els => els.map(el => el.dataset.spot));
  // Puzzle 1, then the Saga's words and three grids, then puzzle 13: each its own draw.
  const first = await spots();
  expect(first).toHaveLength(6);
  expect(new Set(first).size).toBeGreaterThan(1);
  expect(first.slice(1, 5).every(s => s.startsWith('top'))).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  const again = await spots();
  expect(again.slice(1, 5).every(s => s.startsWith('top'))).toBe(true);
  expect(again).not.toEqual(first);
});

for (const address of ['plain', 'gold', '']) {
  test(`a book whose address asks for ${address || 'no style'} prints Plain, today's book: no character, no background`, async ({ page }) => {
    await openBook(page, address);
    await expect(page.locator('html')).toHaveAttribute('data-print', 'plain');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.sheet .print-figure:visible')).toHaveCount(0);
    expect(await before(page.locator('.sheet').first(), 'content')).toBe('none');
  });
}

test('a book in Black and white is the Colour book in greys', async ({ page }) => {
  await openBook(page, 'mono');
  await page.emulateMedia({ media: 'print' });
  const first = page.locator('.sheet .print-figure:visible').first();
  await expect(first).toBeVisible();
  expect(await css(first, 'filter')).toBe('grayscale(1)');
});

test('a book in Colour has every character\'s pair in before the dialog opens, Plain look or not', async ({ page }) => {
  await recordLoads(page);
  await keep(page, LOOK_KEY, 'plain');
  await openBook(page, 'colour');
  expect(await loadedAtPrint(page)).toEqual([CHARACTERS[0], CHARACTERS[1]].flatMap(c => [c.figure, c.scene]).sort());
});

test('printed Colour, the book has as many sheets as Plain', async ({ page }) => {
  await openBook(page, 'plain');
  const plain = await sheetsOf(page);
  await openBook(page, 'colour');
  expect(await sheetsOf(page)).toBe(plain);
});
