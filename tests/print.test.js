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

// TASK-114: a Kids puzzle's grid card prints 1.5× a Vanilla's; its character peers from that card's
// own edges, as the print rules reckon it.
test('a Kids puzzle\'s character peers from its bigger grid card\'s edges, as the print rules reckon it', async ({ page }) => {
  await printing(page, 'colour');
  await drawing(page);
  await openPlay(page, 'WSCH-0012', require('./fixtures/WSCH-0012.json'));
  await onPaper(page);
  const card = await box(page.locator('#card'));
  expect(Math.round(card.width)).toBe(8 * 54 + 32);
  await printWith(page, 0);
  await expect(figure(page)).toHaveAttribute('data-spot', 'right');
  const f = await box(figure(page));
  expect(Math.round(f.x + f.width / 2 - card.x)).toBe(Math.round(card.width + 10));
});

test('a Kids grid wide enough to leave the character no room at the paper\'s sides prints it only over a top corner', async ({ page }) => {
  const kids = require('./fixtures/WSCH-0012.json');
  const wide = { ...kids, grids: [{ rows: kids.grids[0].rows.map(row => row + 'ABCD') }] };
  await printing(page, 'colour');
  await drawing(page);
  await openPlay(page, 'WSCH-0012', wide);
  await onPaper(page);
  // 1.5× a Vanilla's 36px would run past 165 mm, so each cell is 165 mm over 12.
  expect(Math.abs((await box(page.locator('#card'))).width - (623.62 + 32))).toBeLessThan(1);
  const spots = [];
  for (const draw of [0, 0.3, 0.5, 0.99]) {
    await printWith(page, draw);
    spots.push(await figure(page).getAttribute('data-spot'));
  }
  expect(spots).toEqual(['topRight', 'topRight', 'topLeft', 'topLeft']);
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

// A Saga with a real one's list: 125 words, every ninth two words too long for one line —
// Christmas's size. Its words sheet is as full as a sheet gets, so it shows the room the print rules
// reckon a words sheet has (core/wordsearch/play-core.js printedSpread) is the paper's.
const fullSaga = hiddenId => ({
  ...saga(hiddenId),
  words: Array.from({ length: 125 }, (_, i) => ({ ...PUZZLE.words[i % 8], grid: i % 3, word: ['Christmas pudding', 'Word ' + i][Number(i % 9 > 0)] }))
});
const sheetsIn = async page => Promise.all(['Letter', 'A4'].map(async format =>
  (await page.pdf({ printBackground: true, preferCSSPageSize: true, format })).toString('latin1').match(/\/Type\s*\/Page[^s]/g).length));
const wordSize = page => page.locator('#words li').first().evaluate(li => parseFloat(getComputedStyle(li).fontSize));

test('printed Colour, a Saga\'s full words sheet ends inside its half-inch edge, its words larger than paper\'s type, on one sheet of Letter or A4', async ({ page }) => {
  await printing(page, 'colour');
  await openPlay(page, 'WSCH-0012', fullSaga('WSCH-0012'));
  await onPaper(page);
  const card = await box(page.locator('aside'));
  // The card's hard shadow is 4 px under it.
  expect(card.y + card.height + 4).toBeLessThanOrEqual(1056 - 48);
  expect(await wordSize(page)).toBeGreaterThan(13);
  expect(await sheetsIn(page)).toEqual([4, 4]);
});

test('printed Plain, a Saga\'s full words sheet prints its words larger than paper\'s type, on one sheet of Letter or A4', async ({ page }) => {
  await openPlay(page, 'WSCH-0012', fullSaga('WSCH-0012'));
  await onPaper(page);
  expect(await wordSize(page)).toBeGreaterThan(13);
  expect(await sheetsIn(page)).toEqual([4, 4]);
});

// ---- The collection book ----
const SAGA = saga('WSCH-0010');
const FILES = { 'WSCH-0007': PUZZLE, 'WSCH-0008': { ...PUZZLE, hiddenId: 'WSCH-0008', title: 'Second' }, 'WSCH-0010': SAGA };
// Numbered 1, 2 and 13: the thirteenth puzzle wears the first character again.
const issue = {
  slug: 'issue-1', name: 'Issue #1', description: 'Printed themed.', created: '2026-10-09',
  puzzles: [{ id: 'WSCH-0008', number: 13 }, { id: 'WSCH-0007', number: 1 }, { id: 'WSCH-0010', number: 2 }],
};

// The book's paper, in px: printed Colour or Black and white, KDP's bleed page — an eighth of an inch
// (12 px) more past the trim on the outer side, top and foot; Plain, US Letter.
const BLEED = 12;
const PAPER = { colour: [828, 1080], mono: [828, 1080] };
const LETTER = [816, 1056];

// The book in a style, as Print book's link on the collection page opens it, on a window its paper
// wide — its puzzles FILES', or files'.
async function openBook(page, style, files) {
  const served = files || FILES;
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [issue] } }));
  await page.route(/\/puzzles\/wordsearch\/WSCH-\d+\.json$/, r => r.fulfill({ json: served[r.request().url().match(/(WSCH-\d+)\.json$/)[1]] }));
  await page.addInitScript(() => { window.printed = 0; window.print = () => { window.printed++; window.dispatchEvent(new Event('beforeprint')); }; });
  const [width, height] = PAPER[style] || LETTER;
  await page.setViewportSize({ width, height });
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
  // Each page's background, the whole of the book's 8.625 × 11.25 in bleed page; the card a bleed
  // lower than on today's 8.5 × 11 in page, where it sat 169 px down.
  expect(await before(sheets.first(), 'width')).toBe('828px');
  expect(await before(sheets.first(), 'height')).toBe('1080px');
  expect(Math.round((await box(sheets.first().locator('.card'))).y - (await box(sheets.first())).y)).toBe(169 + BLEED);
});

// ---- The book as a KDP bleed interior (TASK-47) ----
// Each page's size in a saved PDF, in points.
const pdfPages = async page => [...(await page.pdf({ preferCSSPageSize: true })).toString('latin1')
  .matchAll(/\/Type\s*\/Page[^s][\s\S]*?\/MediaBox\s*\[([^\]]*)\]/g)].map(m => m[1].trim().split(/\s+/).map(Number));

// Every page of the book, as the paper has them: the title page, the copyright page, then each puzzle
// page — Puzzle 1, the Saga's words and its three grids, Puzzle 13 — each with its page number's side,
// the outer one, and its trim on the paper in px: an even page's moved over by the bleed, every page's
// down by it. A Saga's words page holds only what isn't on one of its grid pages.
const bookPages = page => page.evaluate(bleed => {
  const rect = el => el.getBoundingClientRect();
  const top = el => rect(el).top + scrollY;
  const trim = (pageTop, side) => ({ left: side === 'left' ? bleed : 0, top: pageTop + bleed, right: (side === 'left' ? bleed : 0) + 816, bottom: pageTop + bleed + 1056 });
  const words = (el, selector) => [...el.querySelectorAll(selector)].filter(w => w.offsetParent !== null && (el.classList.contains('grid-sheet') || !w.closest('.grid-sheet')));
  const ink = el => words(el, '.sheet-number, .play-head, .front-face .cell, .print-face .cell, .band, ul.words li, aside, .page-number')
    .map(w => { const r = rect(w); return { what: w.className || w.tagName, left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY }; });
  const puzzlePages = [...document.querySelectorAll('.sheets .sheet, .sheets .grid-sheet')].map(el => {
    const side = el.querySelector(':scope > .page-number').dataset.side;
    return { number: el.querySelector(':scope > .page-number').textContent, side, trim: trim(top(el), side), ink: ink(el),
      scene: { left: rect(el).left + parseFloat(getComputedStyle(el, '::before').left), top: parseFloat(getComputedStyle(el, '::before').top),
        width: getComputedStyle(el, '::before').width, height: getComputedStyle(el, '::before').height } };
  });
  return puzzlePages;
}, BLEED);

for (const [style, ink] of [['colour', 'colour'], ['mono', 'black ink']]) {
  test(`a book saved ${style === 'colour' ? 'Colour' : 'Black and white'} is a KDP bleed interior for ${ink}: every page 8.625 × 11.25 in`, async ({ page }) => {
    await openBook(page, style);
    // The title and copyright pages, Puzzle 1, the Saga's four, then Puzzle 13: 8.625 × 11.25 in each,
    // as near as Chrome saves it. Chrome sizes a PDF page in 300ths of an inch, and 8.625 in falls
    // between two, so it saves 621.12 pt — 0.04 mm over, never short (the owner's call, 2026-10-10).
    expect(await pdfPages(page)).toEqual(Array(8).fill([0, 0, 621.12, 810]));
  });
}

test('a book saved Plain is today\'s KDP book: every page 8.5 × 11 in, no bleed', async ({ page }) => {
  await openBook(page, 'plain');
  expect(await pdfPages(page)).toEqual(Array(8).fill([0, 0, 612, 792]));
});

for (const style of ['colour', 'plain']) {
  test(`a book saved ${style === 'colour' ? 'Colour' : 'Plain'}: a Saga's full words page ends above its page number, its words larger than paper's type, the book its eight pages`, async ({ page }) => {
    await openBook(page, style, { ...FILES, 'WSCH-0010': fullSaga('WSCH-0010') });
    expect(await pdfPages(page)).toHaveLength(8);
    await page.emulateMedia({ media: 'print' });
    // Puzzle 2, the Saga: its words page.
    const words = page.locator('.sheet').nth(1);
    const card = await box(words.locator('aside'));
    expect(card.y + card.height + 4).toBeLessThan((await box(words.locator(':scope > .page-number'))).y);
    expect(await words.locator('ul.words li').first().evaluate(li => parseFloat(getComputedStyle(li).fontSize))).toBeGreaterThan(13);
  });
}

test('printed Colour, each puzzle page\'s background runs over the whole page, past the trim on its outer side, top and foot', async ({ page }) => {
  await openBook(page, 'colour');
  await onPaper(page);
  const pages = await bookPages(page);
  expect(pages.map(p => [p.number, p.side])).toEqual([['3', 'right'], ['4', 'left'], ['5', 'right'], ['6', 'left'], ['7', 'right'], ['8', 'left']]);
  // From the paper's top-left corner to its far edges — on an odd page the bleed is its right, on an
  // even one its left: the background covers both, so no white rim at either.
  for (const p of pages) expect(p.scene).toEqual({ left: 0, top: 0, width: '828px', height: '1080px' });
});

for (const style of ['colour', 'mono']) {
  test(`printed ${style}, every letter, word, number and hidden ID on a puzzle page sits 0.375 in inside the trim at its outer side, top and foot, and 0.5 in from the spine`, async ({ page }) => {
    await openBook(page, style);
    await onPaper(page);
    const pages = await bookPages(page);
    const safe = 0.375 * 96, spine = 0.5 * 96;
    for (const p of pages) {
      expect(p.ink.length).toBeGreaterThan(0);
      for (const w of p.ink) {
        const outer = p.side === 'left' ? w.left - p.trim.left : p.trim.right - w.right;
        const inner = p.side === 'left' ? p.trim.right - w.right : w.left - p.trim.left;
        expect({ page: p.number, what: w.what, outer: outer >= safe, spine: inner >= spine, top: w.top - p.trim.top >= safe, foot: p.trim.bottom - w.bottom >= safe })
          .toEqual({ page: p.number, what: w.what, outer: true, spine: true, top: true, foot: true });
      }
    }
  });
}

// Where the title and copyright pages' words sit on their page's trim, and what they wear.
async function frontPages(page, style) {
  await openBook(page, style);
  await onPaper(page);
  const bleed = PAPER[style] ? BLEED : 0;
  return page.evaluate(b => {
    const at = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY }; };
    const copyright = document.getElementById('copyright-page');
    const words = [...document.querySelectorAll('#title-page h1, #title-page p, #copyright-page p')].map(el => {
      // The title page is page 1, odd: its trim from the paper's corner, down by the bleed. The copyright
      // page is page 2, even, starting a page of its own: its trim from that page's top, and over by the bleed too.
      const p = at(el);
      return copyright.contains(el) ? [p.x - b, p.y - at(copyright).y - b] : [p.x, p.y - b];
    });
    const dressed = [...document.querySelectorAll('#title-page, #copyright-page, #title-page *, #copyright-page *')]
      .filter(el => el.matches('.print-figure') || getComputedStyle(el, '::before').backgroundImage !== 'none');
    return { words: words.map(([x, y]) => [Math.round(x), Math.round(y)]), dressed: dressed.length };
  }, bleed);
}

test('printed Colour or Black and white, the title and copyright pages are today\'s — white, no background, no character, their words where they sit — only on the bigger page', async ({ page, browser }) => {
  const plain = await frontPages(page, 'plain');
  expect(plain.dressed).toBe(0);
  for (const style of ['colour', 'mono']) {
    const fresh = await browser.newPage();
    expect(await frontPages(fresh, style)).toEqual(plain);
    await fresh.close();
  }
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
