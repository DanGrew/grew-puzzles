const { test, expect } = require('@playwright/test');
const SHAPE = require('./fixtures/CRSS-0001.json');
const BIG = require('./fixtures/CRSS-0002.json');
const TALL_LIST = require('./fixtures/CRSS-0003.json');
const { characters: CHARACTERS } = require('../content/characters/index.json');

// A criss-cross, Themed (TASK-154), dressed exactly as a wordsearch is: the page wears its
// background and its character peering from behind the grid card at the site's spot its number
// picks, the same every visit, never over the Words card or the little map; its letters stay plain.
// Plain is the shape as it was. Printed Colour or Black and white, the sheet wears the background,
// faint, and the character peering from behind the shape's card at a spot picked at random each
// print. The fixtures: CRSS-0001, a real 17×15 Easy; CRSS-0002, a real 29×30 Hard that zooms;
// CRSS-0003, the tallest that prints, 25×25. WIDE is a 25×8 and TALL it turned on its side, 8×25 —
// shapes the risk is about, a wide one leaving little room beside the card; paper never checks a
// shape solves. Each is served under whichever hidden ID a test needs — its number picks its
// character and spot.
const LOOK_KEY = 'grew-puzzles.look';
const IN = 96;
const url = file => `url("http://localhost:${new URL(test.info().project.use.baseURL).port}/content/characters/${file}")`;
const WIDE = {
  ...SHAPE, title: 'Wide Load', width: 25, height: 8, given: 'Butterflies',
  squares: ['#'.repeat(11) + '.'.repeat(14), ...Array(3).fill('#' + '.'.repeat(24)), '#'.repeat(8) + '.'.repeat(17), ...Array(3).fill('.'.repeat(25))],
  words: [
    { word: 'Butterflies', start: { row: 0, col: 0 }, direction: 'E', length: 11 },
    { word: 'Beach', start: { row: 0, col: 0 }, direction: 'S', length: 5 },
    { word: 'Holidays', start: { row: 4, col: 0 }, direction: 'E', length: 8 },
  ],
};
const TALL = {
  ...WIDE, title: 'Tall Story', width: 8, height: 25,
  squares: Array.from({ length: 25 }, (_, c) => WIDE.squares.map(row => row[c]).join('')),
  words: WIDE.words.map(w => ({ ...w, start: { row: w.start.col, col: w.start.row }, direction: { E: 'S', S: 'E' }[w.direction] })),
};
const SHAPES = { SHAPE, BIG, TALL_LIST, WIDE, TALL };

async function open(page, hiddenId = 'CRSS-0001', file = SHAPE) {
  await page.addInitScript(() => {
    window.printed = 0;
    window.print = () => { window.printed += 1; };
  });
  await page.route(/\/content\/puzzles\/crisscross\/CRSS-\d+\.json$/, r => r.fulfill({ json: { ...file, hiddenId } }));
  await page.goto('/app/crisscross.html?id=' + hiddenId);
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
// The box round the character's inked outline on the page, as the site judges a spot by it
// (core/theme-core.js inkBox) — its picture's clear corners may touch another card.
const inkOf = page => page.evaluate(async characters => {
  const { inkBox } = await import('/core/theme-core.js');
  const figure = document.getElementById('theme-figure'), play = document.getElementById('play').getBoundingClientRect();
  const outline = characters.find(c => c.name === document.getElementById('name-tag').textContent).outline;
  const turn = parseFloat(figure.style.transform.match(/rotate\((-?[\d.]+)deg\)/)[1]);
  const ink = inkBox(outline, parseFloat(figure.style.height), turn, figure.style.transform.includes('scaleX(-1)'));
  const x = play.left + parseFloat(figure.style.left), y = play.top + parseFloat(figure.style.top);
  return { x: x + ink.left, y: y + ink.top, width: ink.right - ink.left, height: ink.bottom - ink.top };
}, CHARACTERS);

// ---- On screen ----

test('Themed, a criss-cross wears the character its ID number lands on, background and name, at the same spot every visit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'CRSS-0002');
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

// Each shape under four numbers, so every spot it has is tried; a wide window and a narrower one.
for (const [width, height] of [[1440, 900], [1100, 760]]) {
  test(`at ${width}×${height}, the character peers from behind the grid card of a wide, a tall and a big shape, never over the Words card or the little map, and never scrolls the page sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const name of Object.keys(SHAPES)) {
      for (const n of [1, 2, 3, 4]) {
        await open(page, `CRSS-000${n}`, SHAPES[name]);
        const where = `${name} as CRSS-000${n}, at ${await spotOf(page)}`;
        expect(await css(page.locator('#theme-figure'), 'z-index'), where).toBe('-1');
        const figure = await inkOf(page);
        expect(overlaps(figure, await page.locator('.stage').boundingBox()), where).toBe(true);
        expect(overlaps(figure, await page.locator('#words-card').boundingBox()), where).toBe(false);
        const map = page.locator('#map-box');
        if (await map.isVisible()) expect(overlaps(figure, await map.boundingBox()), where).toBe(false);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), where).toBe(width);
      }
    }
  });
}

test('a wide shape\'s card leaves no room on its right for the character, whose spot there is skipped', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const seen = new Set();
  for (const n of [1, 2, 3, 4]) {
    await open(page, `CRSS-000${n}`, WIDE);
    seen.add(await spotOf(page));
  }
  expect(seen.has('right')).toBe(false);
  expect(seen.size).toBeGreaterThan(1);
});

// The puzzle size kept on the device: Small is the criss-cross page as it was before the size choice.
const keepSize = (page, size) => page.addInitScript(s => localStorage.setItem('grew-puzzles.text-size', s), size);

test('at Small, its character stands as big against the grid card as the printout\'s against the printed shape', async ({ page }) => {
  await keepSize(page, 'small');
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'CRSS-0002', SHAPE);
  const stage = await page.locator('.stage').boundingBox();
  const height = parseFloat(await page.locator('#theme-figure').evaluate(el => el.style.height));
  const spot = await spotOf(page);
  // The owner's spots: 293 px tall at the sides, 213 over a top corner, on the 17×15's printed card —
  // its 15 rows sharing 4.4 in.
  expect(height).toBeCloseTo({ right: 293, left: 293, topRight: 213, topLeft: 213 }[spot] * stage.width / (17 * 4.4 * IN / 15 + 34), 0);
});

// TASK-188: a bigger size grows the shape, never its character.
test('at every size a criss-cross\'s character stands as big as at Small, behind the card it grew', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const heights = [];
  for (const size of ['small', 'normal', 'huge']) {
    await keepSize(page, size);
    await open(page, 'CRSS-0002', SHAPE);
    const height = parseFloat(await page.locator('#theme-figure').evaluate(el => el.style.height));
    heights.push(height / { right: 293, left: 293, topRight: 213, topLeft: 213 }[await spotOf(page)]);
    expect(overlaps(await inkOf(page), await page.locator('.stage').boundingBox())).toBe(true);
  }
  heights.forEach(h => expect(h).toBeCloseTo(heights[0], 2));
});

test('on a phone the character peers over a top corner of the grid card, behind it, with no label', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['CRSS-0001', 'CRSS-0002']) {
    await open(page, id);
    expect(['topRight', 'topLeft']).toContain(await spotOf(page));
    await expect(page.locator('#name-tag')).toBeHidden();
    const stage = await page.locator('.stage').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
    expect(figure.y + figure.height / 2).toBeLessThan(stage.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  }
});

test('Themed, the letters in the squares stay plain: no square wears the character', async ({ page }) => {
  await open(page);
  const looks = await page.locator('.criss-square').evaluateAll(all => all.flatMap(s => [getComputedStyle(s).backgroundImage, getComputedStyle(s, '::after').backgroundImage]));
  expect(new Set(looks)).toEqual(new Set(['none']));
});

test('Plain, the page has no character, name or background, and asks for no character image', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await lookAs(page, 'plain');
  const asked = imageRequests(page);
  await open(page);
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  expect(await sceneOf(page)).toBe('none');
  expect(asked).toEqual([]);
});

test('switching Plain to Themed dresses the shape where it is, and back again undresses it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await lookAs(page, 'plain');
  await open(page);
  await page.locator('#site-side .look button[data-look="themed"]').click();
  await expect(page.locator('#theme-figure')).toBeVisible();
  expect(await sceneOf(page)).toBe(url(CHARACTERS[0].scene));
  await page.locator('#site-side .look button[data-look="plain"]').click();
  await expect(page.locator('#theme-figure')).toBeHidden();
  expect(await sceneOf(page)).toBe('none');
});

// ---- On paper ----

// Print page's pick, as the side bar makes it, the dialog stood in for, on Letter.
async function printIn(page, style) {
  await page.locator(`#site-side #print [data-print="${style}"]`).click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  await page.setViewportSize({ width: 8.5 * IN, height: 11 * IN });
  await page.emulateMedia({ media: 'print' });
}

const sheet = page => page.locator('#criss-sheet');
const printFigure = page => sheet(page).locator('.print-figure');

test('Print page offers Colour, Black and white and Plain', async ({ page }) => {
  await open(page);
  await expect(page.locator('#site-side #print button')).toHaveText(['Colour', 'Black and white', 'Plain']);
});

for (const look of ['themed', 'plain']) {
  test(`Look ${look} and Print Colour: the sheet wears the shape's character, no name label, its background faint to the paper's edge`, async ({ page }) => {
    await lookAs(page, look);
    await open(page, 'CRSS-0013');
    await printIn(page, 'colour');
    const owner = CHARACTERS[0];
    await expect(printFigure(page)).toBeVisible();
    expect(await css(printFigure(page), 'background-image')).toBe(url(owner.figure));
    expect(['right', 'left', 'topRight', 'topLeft']).toContain(await printFigure(page).getAttribute('data-spot'));
    expect(await css(printFigure(page), 'z-index')).toBe('-1');
    await expect(page.locator('#name-tag')).toBeHidden();
    expect(await sceneOf(page)).toBe(url(owner.scene));
    expect(await page.evaluate(() => getComputedStyle(document.body, '::before').opacity)).toBe('0.28');
    // The shape's card and the Words card stay white, in front of the character and the background.
    for (const card of ['.criss-paper-card', '.criss-paper-list']) {
      await expect(sheet(page).locator(card)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    }
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

test('the printed shape\'s card sits where the print rules reckon it, the character\'s head inside what a printer reaches, nothing past the paper\'s side', async ({ page }) => {
  for (const [id, file, squares] of [['CRSS-0001', SHAPE, 17 * 4.4 * IN / 15], ['CRSS-0003', TALL_LIST, 25 * 4.4 * IN / 25], ['CRSS-0005', WIDE, 6.9 * IN]]) {
    await open(page, id, file);
    await printIn(page, 'colour');
    const card = await sheet(page).locator('.print-card').boundingBox();
    // The half inch, then the title on its tag and the rule (core/theme-core.js crissPrintFrame).
    expect(card.y, id).toBeCloseTo(48 + 129.98, 0);
    expect(card.width, id).toBeCloseTo(squares + 34, 0);
    expect((await printFigure(page).boundingBox()).y, id).toBeGreaterThanOrEqual(IN / 4);
    // Its picture's clear edge may stand past the paper's side, judged by its inked outline: it is
    // clipped there, so no page is shrunk to fit it.
    expect(await page.evaluate(() => document.documentElement.scrollWidth), id).toBe(8.5 * IN);
    await page.emulateMedia({ media: 'screen' });
  }
});

for (const [name, id, file] of [['a 17×15', 'CRSS-0001', SHAPE], ['the tallest, with the longest list,', 'CRSS-0003', TALL_LIST]]) {
  test(`printed Colour, ${name} shape is still one 8.5×11 page`, async ({ page }) => {
    await open(page, id, file);
    await printIn(page, 'colour');
    const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
    expect([...pdf.matchAll(/\/Type\s*\/Page[^s]/g)]).toHaveLength(1);
  });
}

test('printed, a wide shape leaves Bunnosaur only a top corner; slim Catosaur may peek past either side too', async ({ page }) => {
  const spots = async () => {
    const seen = new Set();
    for (const r of [0, 0.3, 0.6, 0.99]) {
      await page.evaluate(x => { Math.random = () => x; window.dispatchEvent(new Event('beforeprint')); }, r);
      seen.add(await printFigure(page).getAttribute('data-spot'));
    }
    return [...seen].sort();
  };
  await open(page, 'CRSS-0001', WIDE);
  expect(await spots()).toEqual(['topLeft', 'topRight']);
  await open(page, 'CRSS-0002', WIDE);
  expect(await spots()).toEqual(['left', 'right', 'topLeft', 'topRight']);
});

test('Colour has the shape\'s pair of images in before the dialog opens; Plain loads none', async ({ page }) => {
  await lookAs(page, 'plain');
  const asked = imageRequests(page);
  await open(page, 'CRSS-0002', SHAPE);
  await page.locator('#site-side #print [data-print="plain"]').click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  expect(asked).toEqual([]);
  await page.locator('#site-side #print [data-print="colour"]').click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(2);
  expect(asked.map(u => u.split('/').pop()).sort()).toEqual([CHARACTERS[1].figure, CHARACTERS[1].scene].sort());
});

// ---- In the book ----

test('in a collection\'s book printed Colour, a criss-cross wears the character its number lands on, under its puzzle number', async ({ page }) => {
  const issue = { slug: 'criss', name: 'Criss', description: 'A shape.', created: '2026-10-12', puzzles: [{ id: 'CRSS-0001', number: 13 }] };
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [issue] } }));
  await page.route(/\/content\/puzzles\/crisscross\/CRSS-\d+\.json$/, r => r.fulfill({ json: SHAPE }));
  await page.addInitScript(() => { window.print = () => { window.dispatchEvent(new Event('beforeprint')); }; });
  await page.setViewportSize({ width: 828, height: 1080 });
  await page.goto('/app/book.html?slug=criss&print=colour');
  await expect(page.locator('#ready')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const page2 = page.locator('.sheets .sheet').first();
  const figure = page2.locator('.criss-sheet .print-figure');
  await expect(figure).toBeVisible();
  // Puzzle 13 wears the first character again, round after the last.
  expect(await css(figure, 'background-image')).toBe(url(CHARACTERS[0].figure));
  expect(['right', 'left', 'topRight', 'topLeft']).toContain(await figure.getAttribute('data-spot'));
  expect(await css(page2, 'background-image', '::before')).toBe(url(CHARACTERS[0].scene));
  // Its shape a bleed lower than on the 8.5 × 11 in page, under the half inch, the puzzle number,
  // the title and the rule.
  const card = await page2.locator('.print-card').boundingBox(), top = await page2.boundingBox();
  expect(card.y - top.y).toBeCloseTo(48 + 29 + 129.98 + 12, 0);
});
