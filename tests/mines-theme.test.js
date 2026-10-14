const { test, expect } = require('@playwright/test');
const BOARD = require('./fixtures/MINE-0001.json');
const BIG = require('./fixtures/MINE-0002.json');
const { characters: CHARACTERS } = require('../content/characters/index.json');

// A minesweeper board, Themed (TASK-140): the page wears its background and its character peering
// from the grid card at the site's spot its number picks; a marked mine, and every mine on the answer
// side, wears that character on a pastel red ringed in red; Plain is the board as it was. Printed
// Colour or Black and white, the sheet wears the background, faint, and the character peering from
// behind the board at a spot picked at random each print — the board fills the paper's width, so a
// wide character like Bunnosaur (MINE-0001) has room only over a top corner, while a slim one like
// Catosaur (MINE-0002) may peek past either side too. The fixture MINE-0001 is a real 10×10 Easy of
// 15 mines, served under whichever hidden ID a test needs — its number picks its character and spot.
const LOOK_KEY = 'grew-puzzles.look';
const IN = 96;
const PASTEL = 'rgb(251, 225, 223)';
const RING = 'rgb(201, 96, 90)';
const url = file => `url("http://localhost:${new URL(test.info().project.use.baseURL).port}/content/characters/${file}")`;
// The 30×30 cut of the 40×40, the biggest board that prints.
const EDGE = {
  ...BIG, width: 30, height: 30,
  numbers: BIG.numbers.slice(0, 30).map(row => row.slice(0, 30)),
  mines: BIG.mines.filter(m => m.row < 30 && m.col < 30),
};

async function open(page, hiddenId = 'MINE-0001', file = BOARD) {
  await page.addInitScript(() => {
    window.printed = 0;
    window.print = () => { window.printed += 1; };
  });
  await page.route(/\/content\/puzzles\/minesweeper\/MINE-\d+\.json$/, r => r.fulfill({ json: { ...file, hiddenId } }));
  await page.goto('/app/minesweeper.html?id=' + hiddenId);
  await expect(page.locator('#play')).toBeVisible();
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await page.evaluate(() => document.fonts.ready);
}

async function lookAs(page, look) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LOOK_KEY, look]);
}

// Every character image the page asks for.
function imageRequests(page) {
  const asked = [];
  page.on('request', r => { if (/\/content\/characters\/.*\.webp$/.test(r.url())) asked.push(r.url()); });
  return asked;
}

const css = (locator, property, pseudo) => locator.evaluate((el, [p, s]) => getComputedStyle(el, s).getPropertyValue(p), [property, pseudo || null]);
const sceneOf = page => page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage);
const spotOf = page => page.locator('#theme-figure').getAttribute('data-spot');
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const square = (page, [row, col], grid = '#grid') => page.locator(`${grid} .mines-square`).nth(row * BOARD.width + col);
const MINE = [BOARD.mines[0].row, BOARD.mines[0].col];
// A blank square that's no mine.
const SAFE = [0, 0];

async function markMine(page, at) {
  await square(page, at).click();
  await square(page, at).click();
}

// ---- On screen ----

test('Themed, a board wears the character its ID number lands on, background and name, at the same spot every visit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'MINE-0002');
  const owner = CHARACTERS[1];
  await expect(page.locator('#name-tag')).toHaveText(owner.name);
  expect(await css(page.locator('#theme-figure'), 'background-image')).toBe(url(owner.figure));
  expect(await sceneOf(page)).toBe(url(owner.scene));
  await expect(page.locator('#theme-figure')).toBeVisible();
  const spot = await spotOf(page);
  expect(['right', 'left', 'topRight', 'topLeft']).toContain(spot);
  await page.reload();
  await expect(page.locator('#name-tag')).toHaveText(owner.name);
  await expect.poll(() => spotOf(page)).toBe(spot);
});

test('the character peers from behind the grid card, clear of the Mines card, and never scrolls the page sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const id of ['MINE-0001', 'MINE-0002', 'MINE-0003', 'MINE-0004']) {
    await open(page, id);
    expect(await css(page.locator('#theme-figure'), 'z-index')).toBe('-1');
    const figure = await page.locator('#theme-figure').boundingBox();
    expect(overlaps(figure, await page.locator('.stage').boundingBox())).toBe(true);
    expect(overlaps(figure, await page.locator('#mines-card').boundingBox())).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
  }
});

// The puzzle size kept on the device: Small is the board as it was before the size choice.
const keepSize = (page, size) => page.addInitScript(s => localStorage.setItem('grew-puzzles.text-size', s), size);

test('at Small, its character stands as big against the grid card as the printout\'s against the printed board', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await keepSize(page, 'small');
  await open(page, 'MINE-0002');
  const stage = await page.locator('.stage').boundingBox();
  const height = parseFloat(await page.locator('#theme-figure').evaluate(el => el.style.height));
  const spot = await spotOf(page);
  // The owner's spots: 293 px tall at the sides, 213 over a top corner, on the 696 px printed board.
  expect(height).toBeCloseTo({ right: 293, left: 293, topRight: 213, topLeft: 213 }[spot] * stage.width / (7.2 * IN + 5), 0);
});

// TASK-187: a bigger size grows the board, never its character.
test('at every size a board\'s character stands as big as at Small, beside the card it grew', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const heights = [];
  for (const size of ['tiny', 'small', 'normal', 'large']) {
    await keepSize(page, size);
    await open(page, 'MINE-0001');
    await expect.poll(() => spotOf(page)).toBe('left');
    heights.push(parseFloat(await page.locator('#theme-figure').evaluate(el => el.style.height)));
    const stage = await page.locator('.stage').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
    expect(figure.x + figure.width / 2).toBeLessThan(stage.x);
  }
  heights.forEach(h => expect(h).toBeCloseTo(heights[0], 0));
});

test('on a phone the character peers over a top corner of the grid card, behind it, with no label', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['MINE-0001', 'MINE-0002']) {
    await open(page, id);
    expect(['topRight', 'topLeft']).toContain(await spotOf(page));
    await expect(page.locator('#name-tag')).toBeHidden();
    const stage = await page.locator('.stage').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
    expect(figure.y + figure.height / 2).toBeLessThan(stage.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  }
});

test('a mine I mark shows the character on a pastel red ringed in red; a dot and a blank square don\'t', async ({ page }) => {
  await open(page);
  const figure = url(CHARACTERS[0].figure);
  await markMine(page, MINE);
  await square(page, SAFE).click();
  expect(await css(square(page, MINE), 'background-image', '::after')).toBe(figure);
  await expect(square(page, MINE)).toHaveCSS('background-color', PASTEL);
  expect(await css(square(page, MINE), 'box-shadow')).toContain(RING);
  expect(await css(square(page, SAFE), 'background-image', '::after')).toBe('none');
  await expect(square(page, SAFE)).not.toHaveCSS('background-color', PASTEL);
  await square(page, MINE).click();
  expect(await css(square(page, MINE), 'content', '::after')).toBe('none');
  await expect(square(page, MINE)).not.toHaveCSS('background-color', PASTEL);
});

test('a mine marked wrong wears the character all the same: the board never points it out', async ({ page }) => {
  await open(page);
  await markMine(page, SAFE);
  expect(await css(square(page, SAFE), 'background-image', '::after')).toBe(url(CHARACTERS[0].figure));
  await expect(square(page, SAFE)).toHaveCSS('background-color', PASTEL);
});

test('the Mines card\'s mine, Themed, is the character too', async ({ page }) => {
  await open(page);
  const legend = page.locator('.mines-how[data-rule="vanilla"] [data-mark="mine"]');
  expect(await css(legend, 'background-image', '::after')).toBe(url(CHARACTERS[0].figure));
  await expect(legend).toHaveCSS('background-color', PASTEL);
});

test('flipped, every mine on the answer side wears the character on its pastel red', async ({ page }) => {
  await open(page);
  await page.locator('#flip').click();
  const mines = page.locator('#solution-grid [data-mark="mine"]');
  await expect(mines).toHaveCount(BOARD.mines.length);
  const looks = await mines.evaluateAll(all => all.map(m => [getComputedStyle(m, '::after').backgroundImage, getComputedStyle(m).backgroundColor]));
  expect(new Set(looks.map(l => l.join(' ')))).toEqual(new Set([`${url(CHARACTERS[0].figure)} ${PASTEL}`]));
});

test('Plain, a mine is the ringed dot again, on the answer side too, with no character, name or background, and no character image asked for', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await lookAs(page, 'plain');
  const asked = imageRequests(page);
  await open(page);
  await markMine(page, MINE);
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  expect(await sceneOf(page)).toBe('none');
  for (const mine of [square(page, MINE), page.locator('#solution-grid [data-mark="mine"]').first()]) {
    expect(await css(mine, 'background-image', '::after')).toBe('none');
    expect(await css(mine, 'border-radius', '::after')).toBe('50%');
    await expect(mine).not.toHaveCSS('background-color', PASTEL);
  }
  expect(asked).toEqual([]);
});

test('switching Plain to Themed dresses the board where it is, and back again undresses it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await lookAs(page, 'plain');
  await open(page);
  await markMine(page, MINE);
  await page.locator('#site-side .look button[data-look="themed"]').click();
  await expect(page.locator('#theme-figure')).toBeVisible();
  expect(await css(square(page, MINE), 'background-image', '::after')).toBe(url(CHARACTERS[0].figure));
  await page.locator('#site-side .look button[data-look="plain"]').click();
  await expect(page.locator('#theme-figure')).toBeHidden();
  expect(await css(square(page, MINE), 'background-image', '::after')).toBe('none');
});

// ---- On paper ----

// Print page's pick, as the side bar makes it, the dialog stood in for, on Letter.
async function printIn(page, style) {
  await page.locator(`#site-side #print [data-print="${style}"]`).click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  await page.setViewportSize({ width: 8.5 * IN, height: 11 * IN });
  await page.emulateMedia({ media: 'print' });
}

const sheet = page => page.locator('#mines-sheet');
const printFigure = page => sheet(page).locator('.print-figure');

test('Print page offers Colour, Black and white and Plain', async ({ page }) => {
  await open(page);
  await expect(page.locator('#site-side #print button')).toHaveText(['Colour', 'Black and white', 'Plain']);
});

for (const look of ['themed', 'plain']) {
  test(`Look ${look} and Print Colour: the sheet wears the board's character, no name label, its background faint to the paper's edge`, async ({ page }) => {
    await lookAs(page, look);
    await open(page, 'MINE-0013');
    await printIn(page, 'colour');
    const owner = CHARACTERS[0];
    await expect(printFigure(page)).toBeVisible();
    expect(await css(printFigure(page), 'background-image')).toBe(url(owner.figure));
    expect(['topRight', 'topLeft']).toContain(await printFigure(page).getAttribute('data-spot'));
    expect(await css(printFigure(page), 'z-index')).toBe('-1');
    await expect(page.locator('#name-tag')).toBeHidden();
    expect(await sceneOf(page)).toBe(url(owner.scene));
    expect(await page.evaluate(() => getComputedStyle(document.body, '::before').opacity)).toBe('0.28');
    // The board's squares on white, in front of the character.
    await expect(sheet(page).locator('[data-part="grid"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });
}

test('Print Black and white is the Colour sheet in greys', async ({ page }) => {
  await open(page);
  await printIn(page, 'mono');
  await expect(printFigure(page)).toBeVisible();
  expect(await css(printFigure(page), 'filter')).toBe('grayscale(1)');
  expect(await page.evaluate(() => getComputedStyle(document.body, '::before').filter)).toBe('grayscale(1)');
});

test('Print Plain, Themed on screen, is today\'s sheet: no character, no background', async ({ page }) => {
  await open(page);
  await printIn(page, 'plain');
  await expect(printFigure(page)).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.body, '::before').content)).toBe('none');
});

test('the printed board sits where the print rules reckon it, and the character\'s head stays inside what a printer reaches', async ({ page }) => {
  for (const [id, file] of [['MINE-0001', BOARD], ['MINE-0003', EDGE]]) {
    await open(page, id, file);
    await printIn(page, 'colour');
    const card = await sheet(page).locator('.print-card').boundingBox();
    // The half inch, then the title on its tag and the rule (core/theme-core.js minesPrintFrame).
    expect(card.y).toBeCloseTo(48 + 162.66, 0);
    expect(card.width).toBeCloseTo(7.2 * IN + 5, 0);
    const figure = await printFigure(page).boundingBox();
    expect(figure.y).toBeGreaterThanOrEqual(IN / 4);
    expect(figure.x).toBeGreaterThanOrEqual(0);
    expect(figure.x + figure.width).toBeLessThanOrEqual(8.5 * IN);
    await page.emulateMedia({ media: 'screen' });
  }
});

for (const [name, id, file] of [['a 10×10', 'MINE-0001', BOARD], ['a 30×30', 'MINE-0003', EDGE]]) {
  test(`printed Colour, ${name} board is still one 8.5×11 page`, async ({ page }) => {
    await open(page, id, file);
    await printIn(page, 'colour');
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
    expect([...pdf.matchAll(/\/Type\s*\/Page[^s]/g)]).toHaveLength(1);
  });
}

test('a wide character prints only over a top corner; a slim one may peek past either side of the board too', async ({ page }) => {
  const spots = async () => {
    const seen = new Set();
    for (const r of [0, 0.3, 0.6, 0.99]) {
      await page.evaluate(x => { Math.random = () => x; window.dispatchEvent(new Event('beforeprint')); }, r);
      seen.add(await printFigure(page).getAttribute('data-spot'));
    }
    return [...seen].sort();
  };
  await open(page, 'MINE-0001');
  expect(await spots()).toEqual(['topLeft', 'topRight']);
  await open(page, 'MINE-0002');
  expect(await spots()).toEqual(['left', 'right', 'topLeft', 'topRight']);
});

test('each print picks one of the top corners at random, and the next print can pick the other', async ({ page }) => {
  await open(page);
  const printWith = random => page.evaluate(r => { Math.random = () => r; window.dispatchEvent(new Event('beforeprint')); }, random);
  await printWith(0);
  await expect(printFigure(page)).toHaveAttribute('data-spot', 'topRight');
  await printWith(0.99);
  await expect(printFigure(page)).toHaveAttribute('data-spot', 'topLeft');
});

test('Colour has the board\'s pair of images in before the dialog opens; Plain loads none', async ({ page }) => {
  await lookAs(page, 'plain');
  const asked = imageRequests(page);
  await open(page, 'MINE-0002');
  await page.locator('#site-side #print [data-print="plain"]').click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  expect(asked).toEqual([]);
  await page.locator('#site-side #print [data-print="colour"]').click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(2);
  expect(asked.map(u => u.split('/').pop()).sort()).toEqual([CHARACTERS[1].figure, CHARACTERS[1].scene].sort());
});

// ---- In the book ----

test('in a collection\'s book printed Colour, a board wears the character its number lands on, over a top corner, under its puzzle number', async ({ page }) => {
  const issue = { slug: 'mines', name: 'Mines', description: 'A board.', created: '2026-10-12', puzzles: [{ id: 'MINE-0001', number: 13 }] };
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [issue] } }));
  await page.route(/\/content\/puzzles\/minesweeper\/MINE-\d+\.json$/, r => r.fulfill({ json: BOARD }));
  await page.addInitScript(() => { window.print = () => { window.dispatchEvent(new Event('beforeprint')); }; });
  await page.setViewportSize({ width: 828, height: 1080 });
  await page.goto('/app/book.html?slug=mines&print=colour');
  await expect(page.locator('#ready')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const page2 = page.locator('.sheets .sheet').first();
  const figure = page2.locator('.mines-sheet .print-figure');
  await expect(figure).toBeVisible();
  // Puzzle 13 wears the first character again, round after the last.
  expect(await css(figure, 'background-image')).toBe(url(CHARACTERS[0].figure));
  expect(['topRight', 'topLeft']).toContain(await figure.getAttribute('data-spot'));
  expect(await css(page2, 'background-image', '::before')).toBe(url(CHARACTERS[0].scene));
  // Its board a bleed lower than on the 8.5 × 11 in page, under the half inch, the puzzle number,
  // the title and the rule.
  const card = await page2.locator('.print-card').boundingBox(), top = await page2.boundingBox();
  expect(card.y - top.y).toBeCloseTo(48 + 29 + 162.66 + 12, 0);
});
