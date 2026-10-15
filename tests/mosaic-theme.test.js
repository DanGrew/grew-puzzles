const { test, expect } = require('@playwright/test');
const BOARD = require('./fixtures/MOSA-0001.json');
const BIG = require('./fixtures/MOSA-0002.json');
const { characters: CHARACTERS } = require('../content/characters/index.json');

// A mosaic, Themed (TASK-170): the page wears its background and its character peering from the
// grid card at the site's spot its number picks, the same every visit — and its squares stay black
// and white, shaded or solved: no square ever wears the character or a colour (the owner,
// 2026-10-13). Plain is the board as it was. Printed Colour or Black and white, the sheet and its
// book page wear the background, faint, and the character peering from behind the board at a spot
// picked at random each print — the board fills the paper's width, as a minesweeper board's does, so
// a wide character like Bunnosaur (MOSA-0001) has room only over a top corner, while a slim one like
// Catosaur (MOSA-0002) may peek past either side too. The fixture MOSA-0001 is a real 12×12 Easy,
// served under whichever hidden ID a test needs — its number picks its character and spot; MOSA-0002
// a real 198×198 Hard, which opens zoomed in.
const LOOK_KEY = 'grew-puzzles.look';
const IN = 96;
// A shaded square, styles/mosaic.css's --ink.
const INK = [15, 42, 36];
const url = file => `url("http://localhost:${new URL(test.info().project.use.baseURL).port}/content/characters/${file}")`;
// The 30×30 cut of the 198×198, the biggest board that prints.
const EDGE = {
  ...BIG, width: 30, height: 30,
  numbers: BIG.numbers.slice(0, 30).map(row => row.slice(0, 30)),
  answer: BIG.answer.slice(0, 30).map(row => row.slice(0, 30)),
};
const SHADED = BOARD.answer.flatMap((row, r) => [...row].map((ch, c) => [ch, r, c])).filter(s => s[0] === '#').map(s => [s[1], s[2]]);

async function open(page, hiddenId = 'MOSA-0001', file = BOARD) {
  await page.addInitScript(() => {
    window.printed = 0;
    window.print = () => { window.printed += 1; };
  });
  await page.route(/\/content\/puzzles\/mosaic\/MOSA-\d+\.json$/, r => r.fulfill({ json: { ...file, hiddenId } }));
  await page.goto('/app/mosaic.html?id=' + hiddenId);
  await expect(page.locator('#play')).toHaveAttribute('data-view', /./);
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
const viewOf = async page => (await page.locator('#play').getAttribute('data-view')).split(' ').map(Number);

// Where a square sits on the canvas at the view now, to press it.
async function tap(page, r, c) {
  const [cell, vx, vy] = await viewOf(page);
  await page.locator('#grid').click({ position: { x: (c - vx + 0.5) * cell, y: (r - vy + 0.5) * cell } });
}

async function shade(page, r, c) {
  await tap(page, r, c);
  await tap(page, r, c);
}

// The colour drawn inside a square, off its middle, where a number's figure would sit, and its lines.
const colourAt = (page, r, c, id = 'grid') => page.evaluate(([id, r, c]) => {
  const canvas = document.getElementById(id), k = canvas.width / canvas.clientWidth;
  const [cell, vx, vy] = document.getElementById('play').dataset.view.split(' ').map(Number);
  return [...canvas.getContext('2d').getImageData(Math.floor((c - vx + 0.2) * cell * k), Math.floor((r - vy + 0.2) * cell * k), 1, 1).data.slice(0, 3)];
}, [id, r, c]);

// Every colour the canvas holds that isn't the shade's ink, white, or a blend of the two where a
// square's edge falls between pixels: none, on a board in black and white.
const huesOf = (page, id) => page.evaluate(([id, ink]) => {
  const canvas = document.getElementById(id), d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4) {
    const t = (255 - d[i]) / (255 - ink[0]);
    const off = [1, 2].some(j => Math.abs(255 - t * (255 - ink[j]) - d[i + j]) > 3);
    if (off) seen.add([d[i], d[i + 1], d[i + 2]].join(','));
  }
  return [...seen];
}, [id, INK]);

// ---- On screen ----

test('Themed, a mosaic wears the character its ID number lands on, background and name, at the same spot every visit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'MOSA-0002');
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

test('the character peers from behind the grid card, clear of the Squares card, and never scrolls the page sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const id of ['MOSA-0001', 'MOSA-0002', 'MOSA-0003', 'MOSA-0004']) {
    await open(page, id);
    expect(await css(page.locator('#theme-figure'), 'z-index')).toBe('-1');
    const figure = await page.locator('#theme-figure').boundingBox();
    expect(overlaps(figure, await page.locator('.stage').boundingBox())).toBe(true);
    expect(overlaps(figure, await page.locator('#mosaic-card').boundingBox())).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
  }
});

// The puzzle size kept on the device: Small is the board as it was before the size choice.
const keepSize = (page, size) => page.addInitScript(s => localStorage.setItem('grew-puzzles.text-size', s), size);

test('at Small, its character stands as big against the grid card as the printout\'s against the printed board', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await keepSize(page, 'small');
  await open(page, 'MOSA-0002', BOARD);
  const stage = await page.locator('.stage').boundingBox();
  const height = parseFloat(await page.locator('#theme-figure').evaluate(el => el.style.height));
  const spot = await spotOf(page);
  // The owner's spots: 293 px tall at the sides, 213 over a top corner, on the 696 px printed board.
  expect(height).toBeCloseTo({ right: 293, left: 293, topRight: 213, topLeft: 213 }[spot] * stage.width / (7.2 * IN + 5), 0);
});

// A bigger size may leave a side spot no room on the screen, so a top corner is picked, drawn
// shorter as the owner placed it; measured against its own spot's height, it's the same size.
test('at every size a mosaic\'s character stands as big as at Small, beside the card it grew', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const scales = [];
  for (const size of ['tiny', 'small', 'normal', 'large']) {
    await keepSize(page, size);
    await open(page);
    const spot = await spotOf(page);
    const height = parseFloat(await page.locator('#theme-figure').evaluate(el => el.style.height));
    scales.push(height / { right: 293, left: 293, topRight: 213, topLeft: 213 }[spot]);
  }
  scales.forEach(s => expect(s).toBeCloseTo(scales[0], 3));
});

test('on a big board zoomed in, the character stays at the card\'s edge, behind it, never over a square being played', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'MOSA-0002', BIG);
  await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'true');
  const before = await page.locator('#theme-figure').boundingBox();
  const stage = await page.locator('.stage').boundingBox();
  // Wherever the character and the card meet, the board is what's under the pointer.
  const meet = {
    left: Math.max(before.x, stage.x), right: Math.min(before.x + before.width, stage.x + stage.width),
    top: Math.max(before.y, stage.y), bottom: Math.min(before.y + before.height, stage.y + stage.height),
  };
  expect(meet.left < meet.right && meet.top < meet.bottom).toBe(true);
  const under = await page.evaluate(m => [0.1, 0.5, 0.9].flatMap(fx => [0.1, 0.5, 0.9].map(fy =>
    document.elementFromPoint(m.left + (m.right - m.left) * fx, m.top + (m.bottom - m.top) * fy).closest('.stage, #theme-figure').className)), meet);
  expect(new Set(under)).toEqual(new Set(['stage']));
  // Zoomed further in and dragged round, it hasn't moved.
  await page.locator('#zoom-in').click();
  const box = await page.locator('#view').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 - 80, { steps: 6 });
  await page.mouse.up();
  expect(await page.locator('#theme-figure').boundingBox()).toEqual(before);
});

test('on a phone the character peers over a top corner of the grid card, behind it, with no label', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['MOSA-0001', 'MOSA-0002']) {
    await open(page, id);
    expect(['topRight', 'topLeft']).toContain(await spotOf(page));
    await expect(page.locator('#name-tag')).toBeHidden();
    const stage = await page.locator('.stage').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
    expect(figure.y + figure.height / 2).toBeLessThan(stage.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  }
});

test('a square I shade Themed is still black — no character, no colour — on the board and in the Squares card', async ({ page }) => {
  await open(page);
  const [r, c] = SHADED[0];
  await shade(page, r, c);
  expect(await colourAt(page, r, c)).toEqual(INK);
  const legend = page.locator('.mosaic-legend [data-mark="shade"]');
  await expect(legend).toHaveCSS('background-color', `rgb(${INK.join(', ')})`);
  expect(await css(legend, 'background-image')).toBe('none');
  expect(await css(page.locator('#play'), '--figure')).toBe('');
});

test('solved Themed, the picture stands in black and white alone, on the front and on the answer side', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  for (const [r, c] of SHADED) await shade(page, r, c);
  await expect(page.locator('#title')).toHaveText(BOARD.name);
  for (const [r, c] of SHADED) expect(await colourAt(page, r, c)).toEqual(INK);
  expect(await colourAt(page, 0, 1)).toEqual([255, 255, 255]);
  expect(await huesOf(page, 'grid')).toEqual([]);
  await page.locator('#flip').click();
  for (const [r, c] of SHADED) expect(await colourAt(page, r, c, 'solution-grid')).toEqual(INK);
});

test('Plain, the board is as it was: the same squares drawn as Themed, and no character, name or background, and no character image asked for', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await lookAs(page, 'plain');
  const asked = imageRequests(page);
  await open(page);
  for (const [r, c] of SHADED.slice(0, 3)) await shade(page, r, c);
  await tap(page, 0, 0);
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  expect(await sceneOf(page)).toBe('none');
  expect(asked).toEqual([]);
  const plain = await page.locator('#grid').evaluate(c => c.toDataURL());
  // The same squares, Themed, in a page of its own.
  const themed = await browser.newPage();
  await themed.setViewportSize({ width: 1440, height: 900 });
  await open(themed);
  for (const [r, c] of SHADED.slice(0, 3)) await shade(themed, r, c);
  await tap(themed, 0, 0);
  expect(await themed.locator('#grid').evaluate(c => c.toDataURL())).toBe(plain);
  await themed.close();
});

test('switching Plain to Themed dresses the board where it is, and back again undresses it, the squares untouched', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await lookAs(page, 'plain');
  await open(page);
  const [r, c] = SHADED[0];
  await shade(page, r, c);
  await page.locator('#site-side .look select').selectOption('themed');
  await expect(page.locator('#theme-figure')).toBeVisible();
  expect(await colourAt(page, r, c)).toEqual(INK);
  await page.locator('#site-side .look select').selectOption('plain');
  await expect(page.locator('#theme-figure')).toBeHidden();
  expect(await colourAt(page, r, c)).toEqual(INK);
});

// ---- On paper ----

// Print page's pick, as the side bar makes it, the dialog stood in for, on Letter.
async function printIn(page, style) {
  await page.locator(`#site-side #print [data-print="${style}"]`).click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  await page.setViewportSize({ width: 8.5 * IN, height: 11 * IN });
  await page.emulateMedia({ media: 'print' });
}

const sheet = page => page.locator('#mosaic-sheet');
const printFigure = page => sheet(page).locator('.print-figure');

test('Print page offers Colour, Black and white and Plain', async ({ page }) => {
  await open(page);
  await expect(page.locator('#site-side #print button')).toHaveText(['Colour', 'Black and white', 'Plain']);
});

for (const look of ['themed', 'plain']) {
  test(`Look ${look} and Print Colour: the sheet wears the board's character, no name label, its background faint to the paper's edge, its squares black on white`, async ({ page }) => {
    await lookAs(page, look);
    await open(page, 'MOSA-0013');
    await printIn(page, 'colour');
    const owner = CHARACTERS[0];
    await expect(printFigure(page)).toBeVisible();
    expect(await css(printFigure(page), 'background-image')).toBe(url(owner.figure));
    expect(['topRight', 'topLeft']).toContain(await printFigure(page).getAttribute('data-spot'));
    expect(await css(printFigure(page), 'z-index')).toBe('-1');
    await expect(page.locator('#name-tag')).toBeHidden();
    expect(await sceneOf(page)).toBe(url(owner.scene));
    expect(await page.evaluate(() => getComputedStyle(document.body, '::before').opacity)).toBe('0.28');
    // The board's squares on white, in front of the character, their numbers and lines black.
    await expect(sheet(page).locator('[data-part="grid"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    const squares = await sheet(page).locator('[data-part="grid"] span').evaluateAll(spans => spans.map(s => {
      const c = getComputedStyle(s);
      return [c.color, c.backgroundColor, c.borderRightColor].join(' ');
    }));
    expect(new Set(squares)).toEqual(new Set(['rgb(0, 0, 0) rgba(0, 0, 0, 0) rgb(0, 0, 0)']));
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
  for (const [id, file] of [['MOSA-0001', BOARD], ['MOSA-0003', EDGE]]) {
    await open(page, id, file);
    await printIn(page, 'colour');
    const card = await sheet(page).locator('.print-card').boundingBox();
    // The half inch, then the title on its tag and the rule (core/theme-core.js mosaicPrintFrame).
    expect(card.y).toBeCloseTo(48 + 162.66, 0);
    expect(card.width).toBeCloseTo(7.2 * IN + 5, 0);
    const figure = await printFigure(page).boundingBox();
    expect(figure.y).toBeGreaterThanOrEqual(IN / 4);
    expect(figure.x).toBeGreaterThanOrEqual(0);
    expect(figure.x + figure.width).toBeLessThanOrEqual(8.5 * IN);
    await page.emulateMedia({ media: 'screen' });
  }
});

for (const [name, id, file] of [['a 12×12', 'MOSA-0001', BOARD], ['a 30×30', 'MOSA-0003', EDGE]]) {
  test(`printed Colour, ${name} mosaic is still one 8.5×11 page`, async ({ page }) => {
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
  await open(page, 'MOSA-0001');
  expect(await spots()).toEqual(['topLeft', 'topRight']);
  await open(page, 'MOSA-0002', BOARD);
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
  await open(page, 'MOSA-0002', BOARD);
  await page.locator('#site-side #print [data-print="plain"]').click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(1);
  expect(asked).toEqual([]);
  await page.locator('#site-side #print [data-print="colour"]').click();
  await expect.poll(() => page.evaluate(() => window.printed)).toBe(2);
  expect(asked.map(u => u.split('/').pop()).sort()).toEqual([CHARACTERS[1].figure, CHARACTERS[1].scene].sort());
});

test('a board I\'ve shaded prints Colour as the blank board: nothing shaded reaches the paper', async ({ page }) => {
  await open(page);
  const drawn = () => sheet(page).locator('[data-part]').evaluateAll(parts => parts.map(p => p.outerHTML));
  const before = await drawn();
  for (const [r, c] of SHADED.slice(0, 4)) await shade(page, r, c);
  await printIn(page, 'colour');
  expect(await drawn()).toEqual(before);
  await expect(sheet(page).locator('canvas, [data-mark]')).toHaveCount(0);
});

// ---- In the book ----

test('in a collection\'s book printed Colour, a mosaic wears the character its number lands on, over a top corner, under its puzzle number', async ({ page }) => {
  const issue = { slug: 'mosaics', name: 'Mosaics', description: 'A mosaic.', created: '2026-10-15', puzzles: [{ id: 'MOSA-0001', number: 13 }] };
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [issue] } }));
  await page.route(/\/content\/puzzles\/mosaic\/MOSA-\d+\.json$/, r => r.fulfill({ json: BOARD }));
  await page.addInitScript(() => { window.print = () => { window.dispatchEvent(new Event('beforeprint')); }; });
  await page.setViewportSize({ width: 828, height: 1080 });
  await page.goto('/app/book.html?slug=mosaics&print=colour');
  await expect(page.locator('#ready')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const page2 = page.locator('.sheets .sheet').first();
  const figure = page2.locator('.mosaic-sheet .print-figure');
  await expect(figure).toBeVisible();
  // Puzzle 13 wears the first character again, round after the last.
  expect(await css(figure, 'background-image')).toBe(url(CHARACTERS[0].figure));
  expect(['topRight', 'topLeft']).toContain(await figure.getAttribute('data-spot'));
  expect(await css(page2, 'background-image', '::before')).toBe(url(CHARACTERS[0].scene));
  await expect(page2.locator('.mosaic-paper')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  // Its board a bleed lower than on the 8.5 × 11 in page, under the half inch, the puzzle number,
  // the title and the rule.
  const card = await page2.locator('.print-card').boundingBox(), top = await page2.boundingBox();
  expect(card.y - top.y).toBeCloseTo(48 + 29 + 162.66 + 12, 0);
});
