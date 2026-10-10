const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');

// Stand-ins for a collection and its puzzles: the fixture served as WSCH-0007, a Wildcards
// variant of it, and a 30×30 grid — listed out of number order, as a published collection may be.
const WILD = { ...PUZZLE, hiddenId: 'WSCH-0008', title: 'Wild Kitchen', type: 'Wildcards', grids: [{ rows: PUZZLE.grids[0].rows, wildcards: [{ row: 0, col: 0 }] }] };
const BIG = {
  ...PUZZLE, hiddenId: 'WSCH-0009', title: 'Big Kitchen',
  grids: [{ rows: Array.from({ length: 30 }, (_, r) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCD'.slice(r % 4) + 'WXYZ'.slice(0, r % 4)) }],
};
// A 3-page Saga: the fixture's grid three times over, its words spread across them.
const SAGA = {
  ...PUZZLE, hiddenId: 'WSCH-0010', title: 'Farm Saga', type: 'Saga',
  words: PUZZLE.words.map((w, i) => ({ ...w, grid: i % 3 })),
  grids: [0, 1, 2].map(() => ({ rows: PUZZLE.grids[0].rows })),
};
// A Repeats puzzle: Cup five times among Cow and Hen.
const cup = (row, col, direction) => ({ word: 'Cup', grid: 0, start: { row, col }, direction, length: 3 });
const CUPS = {
  ...PUZZLE, hiddenId: 'WSCH-0011', type: 'Repeats', title: 'Cups',
  grids: [{ rows: ['CUPTCUPL', 'PUCHENRT', 'CTLCOWLR', 'URTLRTRL', 'PLRTCUPT', 'TRLRTLRL', 'LTRTLRTR', 'RLTLRTLR'] }],
  words: [
    { word: 'Cow', grid: 0, start: { row: 2, col: 3 }, direction: 'E', length: 3 },
    cup(0, 0, 'E'), cup(0, 4, 'E'), cup(1, 2, 'W'), cup(2, 0, 'S'), cup(4, 4, 'E'),
    { word: 'Hen', grid: 0, start: { row: 1, col: 3 }, direction: 'E', length: 3 }
  ]
};
const FILES = { 'WSCH-0007': PUZZLE, 'WSCH-0008': WILD, 'WSCH-0009': BIG, 'WSCH-0010': SAGA, 'WSCH-0011': CUPS };
const issue = {
  slug: 'issue-1', name: 'Issue #1', description: 'The first book, remade.', created: '2026-01-05',
  puzzles: [{ id: 'WSCH-0009', number: 3 }, { id: 'WSCH-0007', number: 1 }, { id: 'WSCH-0008', number: 2 }],
};
// A book holding the Saga first, then a single-grid puzzle after it.
const sagas = {
  slug: 'sagas', name: 'Sagas', description: 'A long one, then a short one.', created: '2026-10-03',
  puzzles: [{ id: 'WSCH-0010', number: 1 }, { id: 'WSCH-0007', number: 2 }],
};
// A book holding the Repeats puzzle, then a puzzle of single words.
const repeats = {
  slug: 'repeats', name: 'Repeats', description: 'Count them all.', created: '2026-10-07',
  puzzles: [{ id: 'WSCH-0011', number: 1 }, { id: 'WSCH-0007', number: 2 }],
};
const index = { puzzles: Object.values(FILES).map(p => ({ hiddenId: p.hiddenId, type: p.type, created: p.created, title: p.title })) };

// Serves the stand-ins; a puzzle named in slow answers only after the others, as a slow
// connection would.
async function serve(page, { slow = [], missing = [] } = {}) {
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: index }));
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [issue, sagas, repeats] } }));
  await page.route(/\/puzzles\/wordsearch\/WSCH-\d+\.json$/, async r => {
    const id = r.request().url().match(/(WSCH-\d+)\.json$/)[1];
    if (slow.includes(id)) await new Promise(done => setTimeout(done, 800));
    return missing.includes(id) ? r.fulfill({ status: 404 }) : r.fulfill({ json: FILES[id] });
  });
}

// Stands in for the browser's print dialog: counts each opening, and notes what each page held then.
async function catchPrint(page) {
  await page.addInitScript(() => {
    window.printed = [];
    window.print = () => window.printed.push(Array.from(document.querySelectorAll('.sheet .front-face .grid'), g => g.children.length));
  });
}

async function openBook(page, options, slug) {
  await serve(page, options);
  await catchPrint(page);
  await page.goto('/app/book.html?slug=' + (slug || 'issue-1'));
  await expect(page.locator('#ready')).toBeVisible();
}

const sheets = page => page.locator('.sheet');

test('Print book on a collection\'s page opens the print dialog on its book, every page drawn', async ({ page }) => {
  await serve(page, { slow: ['WSCH-0009'] });
  await catchPrint(page);
  await page.goto('/app/collection.html?slug=issue-1');
  await page.locator('#site-side #book a', { hasText: 'Plain' }).click();
  await expect(page).toHaveURL(/\/app\/book\.html\?slug=issue-1&print=plain$/);
  await expect.poll(() => page.evaluate(() => window.printed)).toEqual([[64, 64, 900]]);
  await expect(page).toHaveTitle('Issue #1 · Grew Puzzles');
});

test('a maze in a collection is left out of its book, never fetched, and the rest prints', async ({ page }) => {
  const mixed = {
    slug: 'mixed', name: 'Mixed', description: 'A wordsearch and a big maze.', created: '2026-10-08',
    puzzles: [{ id: 'MAZE-0003', number: 2 }, { id: 'WSCH-0007', number: 1 }],
  };
  const asked = [];
  page.on('request', r => asked.push(r.url()));
  await serve(page);
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [mixed] } }));
  await catchPrint(page);
  await page.goto('/app/book.html?slug=mixed');
  await expect(page.locator('#ready')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.printed)).toEqual([[64]]);
  await page.emulateMedia({ media: 'print' });
  await expect(sheets(page).locator('.sheet-number')).toHaveText(['Puzzle 1']);
  expect(asked.filter(url => url.includes('MAZE'))).toEqual([]);
});

test('the book opens on a title page: the collection\'s name, with the help of the Grawrables, by Amanda Prew, its description, the site\'s address, and where the answers are', async ({ page }) => {
  await openBook(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#book-title')).toHaveText('Issue #1');
  // The owner's words (the product's docs/CONTENT.md, Title page): two lines under the title.
  await expect(page.locator('#byline')).toHaveText('with the help of the Grawrables\nby Amanda Prew', { useInnerText: true });
  const name = await page.locator('#book-title').boundingBox();
  const byline = await page.locator('#byline').boundingBox();
  const description = await page.locator('#book-description').boundingBox();
  expect(byline.y).toBeGreaterThanOrEqual(name.y + name.height);
  expect(description.y).toBeGreaterThanOrEqual(byline.y + byline.height);
  await expect(page.locator('#book-description')).toHaveText('The first book, remade.');
  await expect(page.locator('#address')).toHaveText('dangrew.github.io/grew-puzzles');
  await expect(page.locator('#answers')).toHaveText("The answers are on the site: open Issue #1 in Collections, pick the puzzle's number, and flip its grid.");
  const title = await page.locator('#title-page').boundingBox();
  const first = await sheets(page).first().boundingBox();
  expect(first.y).toBeGreaterThanOrEqual(title.y + title.height);
  for (const selector of ['.site', '.book-status']) await expect(page.locator(selector).first()).toBeHidden();
});

test('after the title page, each puzzle has its own page in number order, headed with its number', async ({ page }) => {
  await openBook(page);
  await page.emulateMedia({ media: 'print' });
  await expect(sheets(page).locator('.sheet-number')).toHaveText(['Puzzle 1', 'Puzzle 2', 'Puzzle 3']);
  await expect(sheets(page).locator('h1')).toHaveText(['Farm Kitchen', 'Wild Kitchen', 'Big Kitchen']);
  for (const i of [0, 1, 2]) {
    const number = await sheets(page).nth(i).locator('.sheet-number').boundingBox();
    const title = await sheets(page).nth(i).locator('h1').boundingBox();
    expect(number.y + number.height).toBeLessThanOrEqual(title.y);
  }
  expect(await sheets(page).evaluateAll(s => s.map(el => getComputedStyle(el).breakBefore))).toEqual(['page', 'page', 'page']);
});

// The printout's measures, from one puzzle on a printed page: what it shows and how it looks.
async function printout(page, scope) {
  const at = selector => page.locator(`${scope} ${selector}`).first();
  const style = (selector, props) => at(selector).evaluate((el, p) => p.map(k => getComputedStyle(el)[k]), props);
  const size = async selector => { const b = await at(selector).boundingBox(); return [Math.round(b.width), Math.round(b.height)]; };
  return {
    title: await at('h1').textContent(), ident: await at('.ident').textContent(), label: await at('.front-face .band').textContent(),
    letters: await page.locator(`${scope} .front-face .cell`).allTextContents(),
    // The words as printed, a line per copy or one with a box per copy, every box empty.
    words: await page.locator(`${scope} ul.words li`).evaluateAll(lis => lis.map(li => li.firstChild.textContent)),
    boxes: await page.locator(`${scope} ul.words li`).evaluateAll(lis => lis.map(li => Array.from(li.querySelectorAll('.box'), b => {
      const r = b.getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height), getComputedStyle(b).backgroundColor];
    }))),
    columns: await at('ul.words').evaluate(el => getComputedStyle(el).columnWidth),
    mark: await at('aside').evaluate(el => getComputedStyle(el, '::after').content),
    grid: await size('.front-face .grid'), card: await size('.front-face'), list: await size('.words-box'),
    cardLook: await style('.front-face', ['backgroundColor', 'borderTop', 'borderRadius', 'boxShadow']),
    bandLook: await style('.front-face .band', ['backgroundColor', 'color', 'font']),
    cellLook: await style('.front-face .cell', ['color', 'font']),
    titleLook: await style('h1', ['font', 'color']),
    difficultyLook: await style('.difficulty', ['backgroundColor', 'borderTop', 'filter']),
  };
}

test('apart from its number, each page is exactly that puzzle\'s own printout', async ({ page, browser }) => {
  await openBook(page);
  await page.emulateMedia({ media: 'print' });
  for (const [i, puzzle] of [[0, PUZZLE], [1, WILD]]) {
    const play = await browser.newPage();
    await play.route(`**/content/puzzles/wordsearch/${puzzle.hiddenId}.json`, r => r.fulfill({ json: puzzle }));
    await play.goto(`/app/play.html?id=${puzzle.hiddenId}`);
    await expect(play.locator('#grid .cell').first()).toBeVisible();
    await expect(play.locator('#words')).toHaveAttribute('style', /--print-word-w/);
    await play.emulateMedia({ media: 'print' });
    expect(await printout(page, `.sheet:nth-child(${i + 1})`)).toEqual(await printout(play, 'body'));
    await play.close();
  }
});

test('a Repeats puzzle\'s book page carries Cup\'s five empty boxes exactly as its own printout does', async ({ page, browser }) => {
  await openBook(page, {}, 'repeats');
  await page.emulateMedia({ media: 'print' });
  const boxes = i => page.locator(`.sheet:nth-child(${i}) ul.words li`).evaluateAll(lis => lis.map(li => li.querySelectorAll('.box').length));
  expect(await boxes(1)).toEqual([0, 5, 0]);
  expect(await boxes(2)).toEqual(Array(8).fill(0));
  expect(await page.locator('.sheet:nth-child(1) ul.words li').evaluateAll(lis => lis.map(li => getComputedStyle(li, '::after').content))).toEqual(Array(3).fill('none'));
  const play = await browser.newPage();
  await play.route('**/content/puzzles/wordsearch/WSCH-0011.json', r => r.fulfill({ json: CUPS }));
  await play.goto('/app/play.html?id=WSCH-0011');
  await expect(play.locator('#grid .cell').first()).toBeVisible();
  await expect(play.locator('#words')).toHaveAttribute('style', /--print-word-w/);
  await play.emulateMedia({ media: 'print' });
  expect(await printout(page, '.sheet:nth-child(1)')).toEqual(await printout(play, 'body'));
  await play.close();
});

// TASK-114: a Kids puzzle's book page has its big letters and its capitals word list.
test('a Kids puzzle\'s book page is exactly its own printout: big letters and its words in capitals', async ({ page, browser }) => {
  const KIDS = require('./fixtures/WSCH-0012.json');
  const kids = { slug: 'kids', name: 'Kids', description: 'For little ones.', created: '2026-10-10', puzzles: [{ id: 'WSCH-0012', number: 1 }] };
  await serve(page);
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [kids] } }));
  await page.route('**/content/puzzles/wordsearch/WSCH-0012.json', r => r.fulfill({ json: KIDS }));
  await catchPrint(page);
  await page.goto('/app/book.html?slug=kids');
  await expect(page.locator('#ready')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const book = await printout(page, '.sheet:nth-child(1)');
  expect(book.words).toEqual(['COW', 'DUCK', 'GOAT', 'HEN', 'ICE CREAM', 'LAMB', 'PIG', 'SHEEP']);
  expect(book.grid).toEqual([8 * 54, 8 * 54]);
  const play = await browser.newPage();
  await play.route('**/content/puzzles/wordsearch/WSCH-0012.json', r => r.fulfill({ json: KIDS }));
  await play.goto('/app/play.html?id=WSCH-0012');
  await expect(play.locator('#grid .cell').first()).toBeVisible();
  await expect(play.locator('#words')).toHaveAttribute('style', /--print-word-w/);
  await play.emulateMedia({ media: 'print' });
  expect(book).toEqual(await printout(play, 'body'));
  await play.close();
});

test('a Mirra?e puzzle\'s book page lists Cup on five lines exactly as its own printout does', async ({ page, browser }) => {
  const mirrage = { ...CUPS, type: 'Mirra?e' };
  await serve(page);
  await page.route('**/content/puzzles/wordsearch/WSCH-0011.json', r => r.fulfill({ json: mirrage }));
  await catchPrint(page);
  await page.goto('/app/book.html?slug=repeats');
  await expect(page.locator('#ready')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const book = await printout(page, '.sheet:nth-child(1)');
  expect(book.words).toEqual(['Cow', 'Cup', 'Cup', 'Cup', 'Cup', 'Cup', 'Hen']);
  const play = await browser.newPage();
  await play.route('**/content/puzzles/wordsearch/WSCH-0011.json', r => r.fulfill({ json: mirrage }));
  await play.goto('/app/play.html?id=WSCH-0011');
  await expect(play.locator('#words')).toHaveAttribute('style', /--print-word-w/);
  await play.emulateMedia({ media: 'print' });
  expect(book).toEqual(await printout(play, 'body'));
  await play.close();
});

test('a Saga\'s words page in the book is its own printout\'s words sheet: its words as large, as far apart, in the same columns', async ({ page, browser }) => {
  await openBook(page, {}, 'sagas');
  await page.emulateMedia({ media: 'print' });
  const sheet = (p, scope) => p.locator(`${scope} ul.words`).first().evaluate(ul => {
    const li = getComputedStyle(ul.firstElementChild);
    return { words: Array.from(ul.children, l => l.firstChild.textContent), type: [li.fontSize, li.lineHeight, li.marginBottom], columns: getComputedStyle(ul).columnWidth };
  });
  const book = await sheet(page, '.sheet:nth-child(1)');
  const play = await browser.newPage();
  await play.route('**/content/puzzles/wordsearch/WSCH-0010.json', r => r.fulfill({ json: SAGA }));
  await play.goto('/app/play.html?id=WSCH-0010');
  await expect(play.locator('#words')).toHaveAttribute('style', /--print-word-w/);
  await play.emulateMedia({ media: 'print' });
  expect(book).toEqual(await sheet(play, 'body'));
  // Larger than paper's 13px: spread, not the one-grid page's words.
  expect(parseFloat(book.type[0])).toBeGreaterThan(13);
  await play.close();
});

// The book saved as a PDF the way Chrome's Save as PDF makes it: at the page's own size.
async function savePdf(page) {
  return (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
}

// Each page's size, in points.
function pageSizes(pdf) {
  return [...pdf.matchAll(/\/Type\s*\/Page[^s][\s\S]*?\/MediaBox\s*\[([^\]]*)\]/g)].map(m => m[1].trim().split(/\s+/).map(Number));
}

// Every font the PDF uses is in the file: a Type 3 font carries its own glyphs, and every other
// font's descriptor carries its font file. Returns the fonts left to the reader's machine.
function unembeddedFonts(pdf) {
  // Each object's dictionary: its text up to its stream, if it has one.
  const objects = new Map([...pdf.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)].map(m => [m[1], m[2].split(/\bstream\r?\n/)[0]]));
  const fonts = [...objects.values()].filter(o => /\/Type\s*\/Font\b/.test(o));
  const type3 = fonts.filter(f => /\/Subtype\s*\/Type3/.test(f));
  const ownGlyphs = new Set(type3.map(f => (f.match(/\/FontDescriptor\s+(\d+) 0 R/) || [])[1]));
  const bare = [...objects.entries()].filter(([id, o]) => /\/Type\s*\/FontDescriptor/.test(o) && !ownGlyphs.has(id) && !/\/FontFile[23]?\b/.test(o));
  return [...type3.filter(f => !/\/CharProcs/.test(f)), ...bare.map(([, o]) => o)];
}

const LETTER = [0, 0, 612, 792];

test('saved as a PDF, every page of the book is 8.5×11 in: the title page, the copyright page, then every puzzle\'s page, in order', async ({ page }) => {
  await openBook(page);
  const pdf = await savePdf(page);
  expect(pageSizes(pdf)).toEqual([LETTER, LETTER, LETTER, LETTER, LETTER]);
  expect(pdf).toContain('/ToUnicode');
});

test('the book\'s page has no margin, so the browser has no room to print its date, address or title on any page', async ({ page }) => {
  await openBook(page);
  // The site's own stylesheets, in the order they load; the font's, from Google, is unreadable here.
  const rules = await page.evaluate(() => [...document.styleSheets].filter(s => s.href.startsWith(location.origin))
    .flatMap(s => [...s.cssRules]).filter(r => r instanceof CSSPageRule && !r.selectorText).map(r => [r.style.size, r.style.margin]));
  expect(rules.at(-1)).toEqual(['8.5in 11in', '0px']);
});

test('saved as a PDF, every font in the book is embedded, with no links, notes or bookmarks', async ({ page }) => {
  await openBook(page, {}, 'sagas');
  const pdf = await savePdf(page);
  expect(pdf).toMatch(/\/Type\s*\/Font\b/);
  expect(unembeddedFonts(pdf)).toEqual([]);
  for (const kept of ['/Annots', '/Outlines']) expect(pdf).not.toContain(kept);
});

test('the copyright page follows the title page, on a page of its own, in the owner\'s words', async ({ page }) => {
  await openBook(page);
  await page.emulateMedia({ media: 'print' });
  const copyright = page.locator('#copyright-page');
  await expect(copyright).toBeVisible();
  await expect(copyright.locator('p')).toHaveText([
    '© 2026 Amanda Prew All rights reserved.',
    'No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher, except in the case of brief quotations used in reviews or educational settings.',
    "This book is for personal use only, and you're welcome to print it for yourself. It may not be used for commercial purposes or resale.",
  ], { useInnerText: true });
  await expect(copyright).toHaveCSS('break-before', 'page');
  const title = await page.locator('#title-page').boundingBox();
  const box = await copyright.boundingBox();
  const first = await sheets(page).first().boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(title.y + title.height);
  expect(first.y).toBeGreaterThanOrEqual(box.y + box.height);
  expect(parseFloat(await copyright.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(7 * 4 / 3);
});

test('puzzle pages are numbered on from the copyright page, even on the left and odd on the right, at each page\'s foot', async ({ page }) => {
  await openBook(page, {}, 'sagas');
  await page.emulateMedia({ media: 'print' });
  const numbers = page.locator('.sheet .page-number');
  await expect(numbers).toHaveText(['3', '4', '5', '6', '7']);
  expect(await numbers.evaluateAll(n => n.map(el => el.dataset.side))).toEqual(['right', 'left', 'right', 'left', 'right']);
  // Each number sits inside its own page — the puzzle's first page or one of its grid pages —
  // 0.5 in in from the outer edge, below everything else on it.
  for (const [i, side] of [[0, 'right'], [1, 'left'], [4, 'right']]) {
    const number = numbers.nth(i);
    await expect(number).toHaveCSS(side, '0px');
    await expect(number).toHaveCSS('position', 'absolute');
    expect(parseFloat(await number.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(7 * 4 / 3);
  }
  await expect(page.locator('.title-page .page-number, .copyright-page .page-number')).toHaveCount(0);
});

test('on every puzzle page, even the biggest grid\'s letters print at 7 pt or more, and the grid stays inside the page\'s edges', async ({ page }) => {
  await openBook(page);
  await page.emulateMedia({ media: 'print' });
  const smallest = await page.locator('.sheet .front-face .cell').evaluateAll(cells => Math.min(...cells.map(c => parseFloat(getComputedStyle(c).fontSize))));
  expect(smallest).toBeGreaterThanOrEqual(7 * 4 / 3 - 0.01);
  // The 30×30 grid, at the floor, keeps within the page's 7.5 in between its 0.5 in edges.
  const big = await sheets(page).nth(2).locator('.front-face .grid').boundingBox();
  expect(big.width).toBeLessThanOrEqual(7.5 * 96);
});

test('a grid too wide to print at 7 pt keeps the page\'s edges, its letters as big as the page allows', async ({ page }) => {
  await openBook(page);
  await page.emulateMedia({ media: 'print' });
  // The 30×30's grid told it has 60 columns: at 7 pt it would be 11.7 in wide.
  const grid = sheets(page).nth(2).locator('.front-face .grid');
  await sheets(page).nth(2).locator('main.play').evaluate(el => el.style.setProperty('--cols', '60'));
  expect((await grid.boundingBox()).width).toBeCloseTo(7.5 * 96, 0);
});

test('a Saga fills four book pages — its words, then Pages 1–3 — each headed with its number, and the next puzzle starts on a fresh page', async ({ page }) => {
  await openBook(page, {}, 'sagas');
  await page.emulateMedia({ media: 'print' });
  const saga = sheets(page).nth(0);
  await expect(saga.locator('.sheet-number')).toHaveText(['Puzzle 1', 'Puzzle 1', 'Puzzle 1', 'Puzzle 1']);
  await expect(saga.locator('aside')).toBeVisible();
  await expect(saga.locator('.front-face')).toBeHidden();
  await expect(saga.locator('.grid-sheet .band')).toHaveText(['Saga · Page 1 of 3', 'Saga · Page 2 of 3', 'Saga · Page 3 of 3']);
  for (const i of [0, 1, 2]) {
    const sheet = saga.locator('.grid-sheet').nth(i);
    const number = await sheet.locator('.sheet-number').boundingBox();
    const title = await sheet.locator('h1').boundingBox();
    expect(number.y + number.height).toBeLessThanOrEqual(title.y);
    await expect(sheet.locator('.cell')).toHaveCount(64);
  }
  await expect(sheets(page).nth(1).locator('.sheet-number')).toHaveText('Puzzle 2');
  await expect(sheets(page).nth(1).locator('.grid-sheet')).toHaveCount(0);
  expect(await page.locator('.sheet, .grid-sheet').evaluateAll(s => s.map(el => getComputedStyle(el).breakBefore))).toEqual(['page', 'page', 'page', 'page', 'page']);
  // The title and copyright pages, the Saga's four, then the single-grid puzzle's one.
  expect(pageSizes(await savePdf(page))).toHaveLength(7);
});

test('nothing the book adds shows an answer or a hidden ID', async ({ page }) => {
  await openBook(page);
  await page.emulateMedia({ media: 'print' });
  const added = [await page.locator('#title-page').innerText(), ...await sheets(page).locator('.sheet-number').allInnerTexts()].join('\n');
  expect(added).not.toContain('WSCH');
  // No solution side and no found lines anywhere in the book; a wildcard stays a ?.
  await expect(page.locator('.sheet .back-face .cell')).toHaveCount(0);
  await expect(page.locator('.sheet svg line, .sheet svg circle')).toHaveCount(0);
  await expect(sheets(page).nth(1).locator('.front-face .cell').first()).toHaveText('?');
});

test('each puzzle page reads its difficulty and code under its title, once, and the book shows no date anywhere', async ({ page }) => {
  await openBook(page);
  await page.emulateMedia({ media: 'print' });
  await expect(sheets(page).locator('.ident')).toHaveText(['Easy · WSCH-0007', 'Medium · WSCH-0008', 'Easy · WSCH-0009']);
  for (const i of [0, 1, 2]) {
    const title = await sheets(page).nth(i).locator('h1').boundingBox();
    const ident = await sheets(page).nth(i).locator('.ident').boundingBox();
    expect(ident.y).toBeGreaterThanOrEqual(title.y + title.height);
    expect((await sheets(page).nth(i).innerText()).match(/WSCH-\d+/g)).toHaveLength(1);
  }
  await expect(page.locator('#sheets')).not.toContainText(/2026|Jan|Oct/);
});

test('on screen the book shows its title page, Print book again, the hint for saving it as a PDF and the way back; the rest is paper only', async ({ page }) => {
  await openBook(page);
  await expect(page.locator('#title-page')).toBeVisible();
  await expect(page.locator('#hint')).toHaveText('To save it as a PDF, print from Chrome, pick Save as PDF and keep the default settings.');
  await expect(page.locator('#hint')).toBeVisible();
  for (const paper of ['#sheets', '#copyright-page']) await expect(page.locator(paper)).toBeHidden();
  await expect(page.locator('#status')).toBeHidden();
  await expect(page.locator('#back')).toHaveAttribute('href', 'collection.html?slug=issue-1');
  await page.locator('#print-again').click();
  expect(await page.evaluate(() => window.printed.length)).toBe(2);
  await page.locator('#back').click();
  await expect(page).toHaveURL(/\/app\/collection\.html\?slug=issue-1$/);
});

test('a book whose puzzles won\'t load says so, and never opens the print dialog', async ({ page }) => {
  await serve(page, { missing: ['WSCH-0008'] });
  await catchPrint(page);
  await page.goto('/app/book.html?slug=issue-1');
  await expect(page.locator('#failed')).toBeVisible();
  await expect(page.locator('#ready')).toBeHidden();
  expect(await page.evaluate(() => window.printed)).toEqual([]);
});

test('an address naming no collection says so, leads back to the collections, and prints nothing', async ({ page }) => {
  await serve(page);
  await catchPrint(page);
  await page.goto('/app/book.html?slug=nope');
  await expect(page.locator('#missing')).toBeVisible();
  await expect(page.locator('#title-page')).toBeHidden();
  await expect(page.locator('#status')).toBeHidden();
  expect(await page.evaluate(() => window.printed)).toEqual([]);
  await page.locator('#missing a').click();
  await expect(page).toHaveURL(/\/app\/index\.html\?kind=collections$/);
});

// Themed or Plain (BUG-73): the page behind the print dialog wears the look the player picked, as
// the collection page it came from does; the paper never does.
const LOOK_KEY = 'grew-puzzles.look';
const sceneOf = page => page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage);
const lookOf = (locator, props) => locator.evaluate((el, p) => p.map(k => getComputedStyle(el)[k]), props);
const TAG = ['backgroundColor', 'boxShadow'];

// Every character image the page asks for.
function imageRequests(page) {
  const asked = [];
  page.on('request', r => { if (/\/content\/characters\/.*\.webp$/.test(r.url())) asked.push(r.url()); });
  return asked;
}

// Notes, at each opening of the print dialog, whether the page's background had arrived by then.
async function catchPrintScene(page) {
  await page.addInitScript(() => {
    window.printed = [];
    window.print = () => window.printed.push(performance.getEntriesByType('resource').some(e => /-bg\.webp$/.test(e.name) && e.responseEnd > 0));
  });
}

test('Themed, the book page wears a character\'s background, the site\'s name on its white tag, and its words readable over it', async ({ page }) => {
  await openBook(page);
  expect(await sceneOf(page)).toMatch(/content\/characters\/[a-z]+-bg\.webp/);
  const [white, shadow] = await lookOf(page.locator('.site .brand'), TAG);
  expect(white).toBe('rgb(255, 255, 255)');
  expect(shadow).not.toBe('none');
  for (const selector of ['#title-page', '#ready']) {
    const [bg, sh] = await lookOf(page.locator(selector), TAG);
    expect(bg).toBe('rgb(255, 255, 255)');
    expect(sh).not.toBe('none');
  }
  await page.locator('#print-again').click();
  expect(await page.evaluate(() => window.printed.length)).toBe(2);
});

test('Themed, the print dialog waits for the book page\'s background to arrive', async ({ page }) => {
  await serve(page);
  await page.route(/-bg\.webp$/, async r => { await new Promise(done => setTimeout(done, 600)); return r.continue(); });
  await catchPrintScene(page);
  await page.goto('/app/book.html?slug=issue-1');
  await expect.poll(() => page.evaluate(() => window.printed)).toEqual([true]);
});

test('Themed, a background that never arrives holds the print dialog back only briefly', async ({ page }) => {
  await serve(page);
  await page.route(/-bg\.webp$/, () => {});
  await catchPrint(page);
  const start = Date.now();
  // The stalled background holds the page's load event back too, so the test doesn't wait for it.
  await page.goto('/app/book.html?slug=issue-1', { waitUntil: 'commit' });
  await expect.poll(() => page.evaluate(() => window.printed.length), { timeout: 4000 }).toBe(1);
  expect(Date.now() - start).toBeLessThan(4000);
});

test('Themed, a list of characters that cannot be read leaves the book page plain grey, and the book still prints', async ({ page }) => {
  await page.route('**/content/characters/index.json', r => r.fulfill({ status: 404, body: 'Not found' }));
  await openBook(page);
  expect(await sceneOf(page)).toBe('none');
  expect(await page.evaluate(() => window.printed.length)).toBe(1);
});

test('Plain, the book page is as it was: no background, no tags, and no character image asked for', async ({ page }) => {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LOOK_KEY, 'plain']);
  const asked = imageRequests(page);
  await openBook(page);
  expect(await sceneOf(page)).toBe('none');
  expect((await lookOf(page.locator('.site .brand'), TAG))[1]).toBe('none');
  expect((await lookOf(page.locator('#ready'), TAG))[1]).toBe('none');
  expect(asked).toEqual([]);
});

test('Themed, the printed book has no background and no character on any page', async ({ page }) => {
  await openBook(page);
  await page.emulateMedia({ media: 'print' });
  expect(await sceneOf(page)).toBe('none');
  // Each page is a copy of the play page, its character's empty spots and all: none shows.
  await expect(page.locator('.theme-figure:visible, .name-tag:visible')).toHaveCount(0);
});

test('the real collections each make a book', async ({ page }) => {
  await catchPrint(page);
  await page.goto('/app/?kind=collections');
  await page.locator('.tiles .tile.collection').first().click();
  await page.locator('#site-side #book a', { hasText: 'Colour' }).click();
  await expect(page.locator('#ready')).toBeVisible();
  await expect(sheets(page).first().locator('.sheet-number')).toHaveText('Puzzle 1');
  expect(await page.evaluate(() => window.printed.length)).toBe(1);
});

// Laid out as on paper — 8.5 in wide — how far down its page each puzzle page's content runs, and
// where its page number sits, in inches from the page's top. A page is a puzzle's first page or
// one of its grid pages; each starts a fresh sheet of paper.
function pageDepths() {
  const IN = 96;
  // The page an element is on: its grid page if it has one, else its puzzle's first page. An
  // element holding grid pages spans several pages, so it is on none of them.
  const pageOf = el => el.querySelector('.grid-sheet') ? null : el.closest('.grid-sheet') || el.closest('.sheet');
  return [...document.querySelectorAll('.sheet, .sheet .grid-sheet')].map(root => {
    const top = root.getBoundingClientRect().top;
    const own = [...root.querySelectorAll('*')].filter(el => pageOf(el) === root && !el.closest('.page-number'));
    const number = [...root.children].find(el => el.matches('.page-number')).getBoundingClientRect();
    return { content: (Math.max(...own.map(el => el.getBoundingClientRect().bottom)) - top) / IN,
      numberTop: (number.top - top) / IN, numberBottom: (number.bottom - top) / IN };
  });
}

test('every real collection\'s book fits its pages: each page\'s puzzle ends above its page number, which keeps clear of the foot; saved as a PDF, it is the title and copyright pages plus each puzzle\'s own, all 8.5×11 in', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 816, height: 1056 });
  await catchPrint(page);
  const { collections } = await (await page.request.get('/content/collections/index.json')).json();
  for (const { slug } of collections) {
    await page.goto('/app/book.html?slug=' + slug);
    await expect(page.locator('#ready')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    for (const depth of await page.evaluate(pageDepths)) {
      expect(depth.content).toBeLessThan(depth.numberTop);
      expect(depth.numberBottom).toBeLessThanOrEqual(11 - 0.25);
    }
    // A page that still ran over would push the book a page longer than its page numbers.
    const pages = await page.locator('.sheet .page-number').count();
    await expect(page.locator('.sheet .page-number').last()).toHaveText(String(pages + 2));
    expect(pageSizes(await savePdf(page))).toEqual(Array(pages + 2).fill(LETTER));
  }
});
