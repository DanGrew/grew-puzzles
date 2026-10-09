const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');
const ENTRIES = require('./fixtures/entries.json');

// The site publishes no entries of its own yet: the fixture is served as the entries file, beside
// the fixture puzzle served as WSCH-0007 — Cat, Cow and Ice cream have entries, the rest none.
const COLS = PUZZLE.grids[0].rows[0].length;
const LAYOUT_KEY = 'grew-puzzles.words-layout';
const LOOK_KEY = 'grew-puzzles.look';
const MISSING_PUZZLE = {
  ...PUZZLE, type: 'Missing',
  words: [...PUZZLE.words.slice(0, 3), { word: 'Goat', missing: true }, ...PUZZLE.words.slice(3)]
};

// Opens the puzzle with the words under the grid, so the list is always in view, and waits for
// the entries to mark it.
async function open(page, { puzzle = PUZZLE, entries = ENTRIES, layout = 'bottom' } = {}) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout]);
  await page.route('**/content/puzzles/wordsearch/WSCH-0007.json', route => route.fulfill({ json: puzzle }));
  await page.route('**/content/entries/index.json', route => entries ? route.fulfill({ json: entries }) : route.fulfill({ status: 404, body: '' }));
  await page.goto('/app/play.html?id=WSCH-0007');
  await expect(page.locator('#play')).toHaveAttribute('data-sits', /./);
}

const word = (page, text) => page.locator('#words li', { hasText: new RegExp('^' + text + '$') });
const popup = page => page.locator('#word-popup');
const cell = (page, r, c) => page.locator('#grid .cell').nth(r * COLS + c);

async function tapAll(page, cells) {
  for (const [r, c] of cells) await cell(page, r, c).click();
}

// ---- Marked words ----

test('the words with an entry are marked with a dotted underline; the rest look as they always have', async ({ page }) => {
  await open(page);
  await expect(page.locator('#words li.has-entry')).toHaveText(['Cat', 'Cow', 'Ice cream']);
  for (const text of ['Cat', 'Cow', 'Ice cream']) {
    await expect(word(page, text)).toHaveAttribute('role', 'button');
    await expect(word(page, text)).toHaveCSS('cursor', 'pointer');
    expect(await word(page, text).evaluate(li => getComputedStyle(li).backgroundImage)).toMatch(/radial-gradient/);
  }
  for (const text of ['Ewe', 'Hen', 'Map', 'Pig', 'Piglet']) {
    await expect(word(page, text)).not.toHaveClass(/has-entry/);
    await expect(word(page, text)).not.toHaveAttribute('role', 'button');
    expect(await word(page, text).evaluate(li => getComputedStyle(li).backgroundImage)).toBe('none');
  }
});

test('a site with no entries file marks nothing, and opens nothing else', async ({ page }) => {
  const fetched = [];
  page.on('request', request => fetched.push(new URL(request.url()).pathname));
  await open(page, { entries: null });
  await expect(page.locator('#count')).toHaveText('0/8');
  await expect(page.locator('#words li.has-entry')).toHaveCount(0);
  await word(page, 'Cat').click();
  await expect(popup(page)).toBeHidden();
  // Beside the puzzle (and the look's characters, and the side bar's indexes), the one entries file, once.
  const sideBar = /^\/content\/(puzzles\/\w+|collections)\/index\.json$/;
  expect(fetched.filter(path => path.includes('/content/') && !path.includes('/content/characters/') && !sideBar.test(path)))
    .toEqual(['/content/puzzles/wordsearch/WSCH-0007.json', '/content/entries/index.json']);
});

test("a puzzle whose groups have no entries marks nothing", async ({ page }) => {
  await open(page, { puzzle: { ...PUZZLE, wordGroups: ['no-such-group'] } });
  await expect(page.locator('#words li')).toHaveCount(8);
  await expect(page.locator('#words li.has-entry')).toHaveCount(0);
});

// ---- The popup ----

test('tapping a marked word opens its popup beside it: the word, its definition, its facts, its credit and its link', async ({ page }) => {
  // Tall enough that the card, level with its word, ends inside the window.
  await page.setViewportSize({ width: 1200, height: 1400 });
  await open(page);
  await expect(popup(page)).toBeHidden();
  await word(page, 'Cat').click();
  await expect(popup(page)).toBeVisible();
  await expect(page.locator('#entry-word')).toHaveText('Cat');
  await expect(page.locator('#entry-definition')).toHaveText('A small furry animal with whiskers, kept as a pet and for catching mice.');
  await expect(page.locator('#entry-facts dt')).toHaveText(['Name', 'Habitat', 'Lifespan', 'Food', 'Size']);
  await expect(page.locator('#entry-facts dd')).toHaveText(['Domestic cat (Felis catus)', 'Homes, farms and towns', '12 to 18 years',
    'Meat, fish and mice', 'Up to 46 cm long, without the tail']);
  await expect(page.locator('#entry-credit')).toHaveText('From the Wikipedia article “Cat”, CC BY-SA 4.0');
  const link = page.locator('#entry-link');
  await expect(link).toHaveText('Read more on Wikipedia');
  await expect(link).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Cat');
  await expect(link).toHaveAttribute('target', '_blank');

  // In order, top to bottom: the word, the definition, the facts, the credit, the link.
  const tops = [];
  for (const id of ['entry-word', 'entry-definition', 'entry-facts', 'entry-credit', 'entry-link']) tops.push((await page.locator('#' + id).boundingBox()).y);
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);

  // Beside the word, level with it, inside the window.
  const at = await word(page, 'Cat').boundingBox();
  const card = await popup(page).boundingBox();
  expect(card.x >= at.x + at.width || card.x + card.width <= at.x).toBe(true);
  expect(Math.abs(card.y - at.y)).toBeLessThan(2);
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(1200);
});

test('the popup is an index card in the site\'s own style, the word in its green band', async ({ page }) => {
  await open(page);
  await word(page, 'Cat').click();
  await expect(popup(page)).toHaveCSS('border-top', '2px solid rgb(15, 42, 36)');
  await expect(popup(page)).toHaveCSS('border-radius', '14px');
  await expect(popup(page)).toHaveCSS('box-shadow', 'rgb(15, 42, 36) 5px 5px 0px 0px');
  await expect(page.locator('.entry-head')).toHaveCSS('background-color', 'rgb(31, 111, 92)');
  await expect(page.locator('#entry-word')).toHaveCSS('color', 'rgb(255, 255, 255)');
});

test('an entry with no facts, credit or link shows just its word and definition, with no gap left behind', async ({ page }) => {
  await open(page);
  await word(page, 'Cow').click();
  await expect(page.locator('#entry-word')).toHaveText('Cow');
  await expect(page.locator('#entry-definition')).toHaveText('A large farm animal kept for its milk.');
  for (const id of ['entry-facts', 'entry-credit', 'entry-link']) await expect(page.locator('#' + id)).toBeHidden();
  const body = await page.locator('#entry-body').boundingBox();
  const definition = await page.locator('#entry-definition').boundingBox();
  const padding = await page.locator('#entry-body').evaluate(el => parseFloat(getComputedStyle(el).paddingBottom));
  expect(Math.abs(body.y + body.height - padding - (definition.y + definition.height))).toBeLessThan(1);
});

test('a word with a link but no facts shows its link, and swapping from it leaves no facts behind', async ({ page }) => {
  await open(page);
  await word(page, 'Cat').click();
  await expect(page.locator('#entry-facts dt')).toHaveCount(5);
  // Cat's card lies over Ice cream, beside it: Enter on it swaps the card in place.
  await word(page, 'Ice cream').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#entry-word')).toHaveText('Ice cream');
  await expect(page.locator('#entry-facts')).toBeHidden();
  await expect(page.locator('#entry-facts dt')).toHaveCount(0);
  await expect(page.locator('#entry-link')).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Ice_cream');
  await word(page, 'Cow').click();
  await expect(page.locator('#entry-link')).toBeHidden();
  await expect(page.locator('#entry-credit')).toBeHidden();
});

test('a long definition scrolls inside the popup, which stays inside the window', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 500 });
  await open(page);
  await word(page, 'Ice cream').click();
  const card = await popup(page).boundingBox();
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.y + card.height).toBeLessThanOrEqual(500);
  const body = await page.locator('#entry-body').evaluate(el => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(body.scroll).toBeGreaterThan(body.client);
});

test('a found word opens its popup just the same', async ({ page }) => {
  await open(page);
  await tapAll(page, [[4, 2], [2, 2]]);
  await expect(word(page, 'Cat')).toHaveClass(/done/);
  expect(await word(page, 'Cat').evaluate(li => getComputedStyle(li).backgroundImage)).toMatch(/radial-gradient/);
  await word(page, 'Cat').click();
  await expect(page.locator('#entry-word')).toHaveText('Cat');
});

test('a marked word opens from the keyboard, Enter or Space', async ({ page }) => {
  await open(page);
  await word(page, 'Cow').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#entry-word')).toHaveText('Cow');
  await page.keyboard.press('Escape');
  await expect(popup(page)).toBeHidden();
  await expect(word(page, 'Cow')).toBeFocused();
  await page.keyboard.press(' ');
  await expect(popup(page)).toBeVisible();
});

// ---- Closing it ----

test('Esc closes the popup', async ({ page }) => {
  await open(page);
  await word(page, 'Cat').click();
  await page.keyboard.press('Escape');
  await expect(popup(page)).toBeHidden();
});

test('its ✕ closes the popup', async ({ page }) => {
  await open(page);
  await word(page, 'Cat').click();
  await page.locator('#entry-close').click();
  await expect(popup(page)).toBeHidden();
});

test('a tap outside the popup closes it, and lands on nothing — not even the grid', async ({ page }) => {
  await open(page);
  await word(page, 'Cat').click();
  await cell(page, 0, 0).click();
  await expect(popup(page)).toBeHidden();
  await expect(page.locator('#overlay > *')).toHaveCount(0);
  await cell(page, 0, 0).click();
  await expect(page.locator('#overlay circle.mark-select')).toHaveCount(1);
});

test('a tap inside the popup leaves it open', async ({ page }) => {
  await open(page);
  await word(page, 'Ice cream').click();
  await page.locator('#entry-definition').click();
  await page.locator('#entry-word').click();
  await expect(popup(page)).toBeVisible();
});

test('tapping another marked word swaps the popup for its own', async ({ page }) => {
  await open(page);
  await word(page, 'Cat').click();
  await word(page, 'Cow').click();
  await expect(popup(page)).toBeVisible();
  await expect(page.locator('#entry-word')).toHaveText('Cow');
  const at = await word(page, 'Cow').boundingBox();
  expect(Math.abs((await popup(page).boundingBox()).y - at.y)).toBeLessThan(2);
});

test('a word with no entry, tapped while a popup is open, only closes it', async ({ page }) => {
  await open(page);
  await word(page, 'Cat').click();
  await word(page, 'Hen').click();
  await expect(popup(page)).toBeHidden();
});

// ---- Play, untouched ----

test('reading an entry leaves the grid and the progress as they were, and never counts as a find', async ({ page }) => {
  await open(page);
  await tapAll(page, [[4, 2], [2, 2], [0, 0]]);
  const before = await page.locator('#overlay').innerHTML();
  for (const text of ['Cat', 'Cow', 'Ice cream']) {
    await word(page, text).click();
    await page.keyboard.press('Escape');
  }
  expect(await page.locator('#overlay').innerHTML()).toBe(before);
  await expect(page.locator('#count')).toHaveText('1/8');
  await expect(page.locator('#words li.done')).toHaveText(['Cat']);
  // The ring the player left is still there to finish the line from.
  await tapAll(page, [[0, 7]]);
  await expect(page.locator('#count')).toHaveText('2/8');
});

test('in Overlay, a word tapped in the list over the grid opens its popup and the grid is untouched', async ({ page }) => {
  await open(page, { layout: 'overlay' });
  await page.locator('#words-toggle').click();
  await word(page, 'Ice cream').click();
  await expect(popup(page)).toBeVisible();
  await expect(page.locator('#overlay > *')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#words-list')).toBeVisible();
});

test("a Missing puzzle's missing word is marked like any other with an entry, and opening it gives nothing away", async ({ page }) => {
  await open(page, { puzzle: MISSING_PUZZLE });
  await expect(page.locator('#words li.has-entry')).toHaveText(['Cat', 'Cow', 'Goat', 'Ice cream']);
  await word(page, 'Goat').click();
  await expect(page.locator('#entry-word')).toHaveText('Goat');
  await expect(word(page, 'Goat')).not.toHaveClass(/revealed/);
  await expect(page.locator('#count')).toHaveText('0/8');
});

// ---- The link ----

test('Read more on Wikipedia opens in a new tab, the puzzle still where the player left it', async ({ page, context }) => {
  await context.route('https://en.wikipedia.org/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Cat</title>' }));
  await open(page);
  await tapAll(page, [[4, 2], [2, 2]]);
  await word(page, 'Cat').click();
  const [tab] = await Promise.all([context.waitForEvent('page'), page.locator('#entry-link').click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toBe('https://en.wikipedia.org/wiki/Cat');
  expect(page.url()).toMatch(/\/app\/play\.html\?id=WSCH-0007$/);
  await expect(page.locator('#count')).toHaveText('1/8');
  await expect(word(page, 'Cat')).toHaveClass(/done/);
});

// ---- On a phone ----

test('on a phone the popup is a card across the foot of the screen, inside it, with a ✕ easy to tap', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await open(page);
  await word(page, 'Ice cream').tap();
  await expect(popup(page)).toBeVisible();
  const card = await popup(page).boundingBox();
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(390);
  expect(card.width).toBeGreaterThan(360);
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(Math.abs(card.y + card.height - (844 - 8))).toBeLessThan(2);
  const close = await page.locator('#entry-close').boundingBox();
  expect(close.width).toBeGreaterThanOrEqual(40);
  expect(close.height).toBeGreaterThanOrEqual(40);
  await page.locator('#entry-close').tap();
  await expect(popup(page)).toBeHidden();
  await context.close();
});

test('on a phone a tap on a word never lands on the grid, and the tap that closes the popup neither', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await open(page);
  await word(page, 'Cat').tap();
  await expect(popup(page)).toBeVisible();
  await expect(page.locator('#overlay > *')).toHaveCount(0);
  await cell(page, 0, 0).tap();
  await expect(popup(page)).toBeHidden();
  await expect(page.locator('#overlay > *')).toHaveCount(0);
  await context.close();
});

// ---- Themed ----

test('Themed, the popup sits over the character', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.addInitScript(key => localStorage.setItem(key, 'themed'), LOOK_KEY);
  await open(page);
  await word(page, 'Cat').click();
  const card = await popup(page).boundingBox();
  const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).closest('#word-popup') !== null,
    [card.x + card.width / 2, card.y + card.height / 2]);
  expect(top).toBe(true);
  await expect(popup(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

// ---- Print ----

test('the printout shows no markers and no popup, even with one open', async ({ page }) => {
  await open(page);
  await word(page, 'Cat').click();
  await page.emulateMedia({ media: 'print' });
  await expect(popup(page)).toBeHidden();
  for (const text of ['Cat', 'Cow', 'Ice cream']) {
    expect(await word(page, text).evaluate(li => getComputedStyle(li).backgroundImage)).toBe('none');
    await expect(word(page, text)).toHaveCSS('color', 'rgb(0, 0, 0)');
  }
});
