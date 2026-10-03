const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');

// Stand-ins for a collection and its puzzles: the fixture served as WSCH-0007, a Wildcards
// variant of it, and a 30×30 grid — listed out of number order, as a published collection may be.
const WILD = { ...PUZZLE, hiddenId: 'WSCH-0008', title: 'Wild Kitchen', type: 'Wildcards', wildcards: [{ row: 0, col: 0 }] };
const BIG = {
  ...PUZZLE, hiddenId: 'WSCH-0009', title: 'Big Kitchen',
  grid: Array.from({ length: 30 }, (_, r) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCD'.slice(r % 4) + 'WXYZ'.slice(0, r % 4)),
};
const FILES = { 'WSCH-0007': PUZZLE, 'WSCH-0008': WILD, 'WSCH-0009': BIG };
const issue = {
  slug: 'issue-1', name: 'Issue #1', description: 'The first book, remade.', created: '2026-01-05',
  puzzles: [{ id: 'WSCH-0009', number: 3 }, { id: 'WSCH-0007', number: 1 }, { id: 'WSCH-0008', number: 2 }],
};
const index = { puzzles: Object.values(FILES).map(p => ({ hiddenId: p.hiddenId, type: p.type, created: p.created, title: p.title })) };

// Serves the stand-ins; a puzzle named in slow answers only after the others, as a slow
// connection would.
async function serve(page, { slow = [], missing = [] } = {}) {
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: index }));
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [issue] } }));
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

async function openBook(page, options) {
  await serve(page, options);
  await catchPrint(page);
  await page.goto('/app/book.html?slug=issue-1');
  await expect(page.locator('#ready')).toBeVisible();
}

const sheets = page => page.locator('.sheet');

test('Print book on a collection\'s page opens the print dialog on its book, every page drawn', async ({ page }) => {
  await serve(page, { slow: ['WSCH-0009'] });
  await catchPrint(page);
  await page.goto('/app/collection.html?slug=issue-1');
  await page.locator('#print-book').click();
  await expect(page).toHaveURL(/\/app\/book\.html\?slug=issue-1$/);
  await expect.poll(() => page.evaluate(() => window.printed)).toEqual([[64, 64, 900]]);
  await expect(page).toHaveTitle('Issue #1 · Grew Puzzles');
});

test('the book opens on a title page: the collection\'s name and description, the site\'s address, and where the answers are', async ({ page }) => {
  await openBook(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#book-title')).toHaveText('Issue #1');
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
    title: await at('h1').textContent(), created: await at('.created').textContent(), label: await at('.front-face .band').textContent(),
    letters: await page.locator(`${scope} .front-face .cell`).allTextContents(),
    words: await page.locator(`${scope} ul.words li`).allTextContents(),
    mark: await at('aside').evaluate(el => getComputedStyle(el, '::after').content),
    grid: await size('.front-face .grid'), card: await size('.front-face'), list: await size('.words-box'),
    cardLook: await style('.front-face', ['backgroundColor', 'borderTop', 'borderRadius', 'boxShadow']),
    bandLook: await style('.front-face .band', ['backgroundColor', 'color', 'font']),
    cellLook: await style('.front-face .cell', ['color', 'font']),
    titleLook: await style('h1', ['font', 'color']),
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
    await play.emulateMedia({ media: 'print' });
    expect(await printout(page, `.sheet:nth-child(${i + 1})`)).toEqual(await printout(play, 'body'));
    await play.close();
  }
});

for (const format of ['A4', 'Letter']) {
  test(`saved as a PDF, the book is one ${format} file with the title page then every puzzle\'s page, in order`, async ({ page }) => {
    await openBook(page);
    const pdf = (await page.pdf({ format })).toString('latin1');
    expect((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(4);
    expect(pdf).toContain('/ToUnicode');
  });
}

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

test('on screen the book shows its title page, Print book again and the way back; the puzzle pages are paper only', async ({ page }) => {
  await openBook(page);
  await expect(page.locator('#title-page')).toBeVisible();
  await expect(page.locator('#sheets')).toBeHidden();
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
  await expect(page).toHaveURL(/\/app\/index\.html\?type=Collections$/);
});

test('the real collections each make a book', async ({ page }) => {
  await catchPrint(page);
  await page.goto('/app/?type=Collections');
  await page.locator('.tiles .tile.collection').first().click();
  await page.locator('#print-book').click();
  await expect(page.locator('#ready')).toBeVisible();
  await expect(sheets(page).first().locator('.sheet-number')).toHaveText('Puzzle 1');
  expect(await page.evaluate(() => window.printed.length)).toBe(1);
});
