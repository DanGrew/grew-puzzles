const { test, expect } = require('@playwright/test');
// The site publishes no criss-cross yet: the fixtures are served as CRSS-0001 — a 17×15 Easy shape
// of 20 words, Aquarium given — and CRSS-0002, a 29×30 Hard one of 60, too big to tap whole on a
// laptop's screen. Both are made by tooling's generator and pass its criss-cross checks. A shape of
// one answer can never be filled wrong, since every word must agree with the letters already there;
// the line for a full but wrong shape is shown on TWO, a shape of the tests' own with two answers
// — Cat and Dog cross nothing, so either fits the other's slot — which no published shape could be.
const SHAPE = require('./fixtures/CRSS-0001.json');
const BIG = require('./fixtures/CRSS-0002.json');
const TWO = {
  hiddenId: 'CRSS-0099', type: 'Vanilla', created: '2026-10-12', title: 'Two Ways', difficulty: 'Hard', width: 5, height: 6,
  wordGroups: ['holidays'], squares: ['####.', '..#..', '..###', '..#.#', '....#', '###.#'], given: 'Tent',
  words: [
    { word: 'Cat', start: { row: 5, col: 0 }, direction: 'E', length: 3 },
    { word: 'Dog', start: { row: 3, col: 4 }, direction: 'S', length: 3 },
    { word: 'Net', start: { row: 2, col: 2 }, direction: 'E', length: 3 },
    { word: 'Kite', start: { row: 0, col: 0 }, direction: 'E', length: 4 },
    { word: 'Tent', start: { row: 0, col: 2 }, direction: 'S', length: 4 }
  ]
};

async function open(page, id) {
  await page.route('**/content/puzzles/crisscross/CRSS-0001.json', route => route.fulfill({ json: SHAPE }));
  await page.route('**/content/puzzles/crisscross/CRSS-0002.json', route => route.fulfill({ json: BIG }));
  await page.route('**/content/puzzles/crisscross/CRSS-0099.json', route => route.fulfill({ json: TWO }));
  await page.goto('/app/crisscross.html?id=' + (id || 'CRSS-0001'));
  await expect(page.locator('#play')).toBeVisible();
}

const square = (page, r, c) => page.locator(`#grid [data-key="${r},${c}"]`);
const chip = (page, word) => page.locator('#groups .chip').getByText(word, { exact: true });
const cellSize = page => page.locator('#play').evaluate(el => el.style.getPropertyValue('--cell'));

// Each word's squares, from its place in the file.
function cells(w) {
  return Array.from({ length: w.length }, (_, k) => w.direction === 'E' ? [w.start.row, w.start.col + k] : [w.start.row + k, w.start.col]);
}

// A square only this word's slot runs through, so one tap picks it — or, where every square is
// another's too, as Ice's is, its first.
function ownSquare(file, w) {
  const others = new Set(file.words.filter(o => o !== w).flatMap(o => cells(o).map(c => c.join(','))));
  return cells(w).find(c => !others.has(c.join(','))) || cells(w)[0];
}

// Whether the squares picked are exactly the word's.
async function pickedIs(page, w) {
  const picked = await page.locator('#grid .picked').evaluateAll(els => els.map(el => el.dataset.key));
  return picked.sort().join(' ') === cells(w).map(c => c.join(',')).sort().join(' ');
}

function word(file, name) {
  return file.words.find(w => w.word === name);
}

// The word's slot picked — a second tap where the first picked the slot across it — then a word.
async function put(page, file, name, as) {
  const w = word(file, name);
  await square(page, ...ownSquare(file, w)).click();
  if (!await pickedIs(page, w)) await square(page, ...ownSquare(file, w)).click();
  await chip(page, as || name).click();
}

// A square in use wholly inside the frame, as the view stands.
async function onView(page) {
  const key = await page.evaluate(() => {
    const frame = document.getElementById('view').getBoundingClientRect();
    const inside = Array.from(document.querySelectorAll('#grid .criss-square')).find(el => {
      const r = el.getBoundingClientRect();
      return r.left >= frame.left && r.right <= frame.right && r.top >= frame.top && r.bottom <= frame.bottom;
    });
    return inside.dataset.key;
  });
  return key.split(',').map(Number);
}

async function letters(page, w) {
  return Promise.all(cells(w).map(c => square(page, ...c).locator('.ch').textContent()));
}

test.describe('a criss-cross', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  test('opens with its title, difficulty and code, the Vanilla band, the starting word in place and the Words card', async ({ page }) => {
    await expect(page.locator('#title')).toHaveText('Summer Holidays');
    await expect(page).toHaveTitle('Summer Holidays · Grew Puzzles');
    await expect(page.locator('#ident')).toHaveText('Easy · CRSS-0001');
    await expect(page.locator('#difficulty')).toHaveAttribute('data-tone', 'Easy');
    await expect(page.locator('#label')).toHaveText('Vanilla');
    await expect(page.locator('#grid .criss-square')).toHaveCount(SHAPE.squares.join('').replace(/\./g, '').length);
    expect(await letters(page, word(SHAPE, 'Aquarium'))).toEqual('AQUARIUM'.split(''));
    await expect(square(page, 4, 8)).toHaveClass(/given/);
    await expect(square(page, 0, 0)).toHaveCount(0);
    await expect(page.locator('#words-card h2')).toHaveText('Words');
    await expect(page.locator('#count')).toHaveText('1/20');
    await expect(page.locator('#groups h3')).toHaveText(['3 letters', '4 letters', '5 letters', '6 letters', '7 letters', '8 letters']);
    await expect(page.locator('#groups .group').first().locator('.chip')).toHaveText(['Hat', 'Ice', 'Map']);
    await expect(chip(page, 'Aquarium')).toHaveClass(/used/);
    await expect(chip(page, 'Aquarium')).toBeDisabled();
    await expect(chip(page, 'Hat')).not.toHaveClass(/used/);
    await expect(page.locator('#picking')).toHaveText('Tap a square to pick a slot.');
    await expect(page.locator('#complete')).toBeHidden();
  });

  test('a slot\'s first square wears its number', async ({ page }) => {
    await expect(square(page, 0, 6).locator('.num')).toHaveText('1');
    await expect(square(page, 8, 0).locator('.num')).not.toHaveText('');
    await expect(square(page, 8, 1).locator('.num')).toHaveText('');
  });

  test('the Words card sits beside the grid card', async ({ page }) => {
    const card = await page.locator('#stage').boundingBox();
    const side = await page.locator('#words-card').boundingBox();
    expect(side.x).toBeGreaterThan(card.x + card.width);
  });

  test('a tap picks the across slot, a second where two cross the down one, and other lengths dim', async ({ page }) => {
    await square(page, 8, 0).click();
    for (const c of cells(word(SHAPE, 'Barbecue'))) await expect(square(page, ...c)).toHaveClass(/picked/);
    await expect(square(page, 9, 0)).not.toHaveClass(/picked/);
    await expect(page.locator('#picking')).toContainText(' across, 8 letters');
    await expect(page.locator('#groups .group.dim')).toHaveCount(5);
    await expect(page.locator('#groups .group').last()).not.toHaveClass(/dim/);
    await square(page, 8, 0).click();
    for (const c of cells(word(SHAPE, 'Bonfire'))) await expect(square(page, ...c)).toHaveClass(/picked/);
    await expect(square(page, 8, 1)).not.toHaveClass(/picked/);
    await expect(page.locator('#picking')).toContainText(' down, 7 letters');
    await expect(page.locator('#groups .group').nth(4)).not.toHaveClass(/dim/);
  });

  test('a word that fits fills the slot and is crossed off', async ({ page }) => {
    await square(page, 8, 0).click();
    await chip(page, 'Barbecue').click();
    expect(await letters(page, word(SHAPE, 'Barbecue'))).toEqual('BARBECUE'.split(''));
    await expect(chip(page, 'Barbecue')).toHaveClass(/used/);
    await expect(page.locator('#count')).toHaveText('2/20');
    await expect(page.locator('#grid .picked')).toHaveCount(0);
    await expect(page.locator('#groups .group.dim')).toHaveCount(0);
    await expect(square(page, 8, 1)).toHaveAttribute('aria-label', 'Row 9, column 2, A');
  });

  test('a key picks and places as a tap does', async ({ page }) => {
    await square(page, 8, 1).focus();
    await page.keyboard.press('Enter');
    await expect(square(page, 8, 1)).toHaveClass(/picked/);
    await chip(page, 'Barbecue').focus();
    await page.keyboard.press('Enter');
    await expect(square(page, 8, 1).locator('.ch')).toHaveText('A');
  });

  test('a word that clashes is refused, its clashing squares shaking red', async ({ page }) => {
    await put(page, SHAPE, 'Barbecue');
    await square(page, 9, 0).click();
    await chip(page, 'Fishing').click();
    await expect(square(page, 8, 0)).toHaveClass(/clash/);
    await expect(square(page, 9, 0)).not.toHaveClass(/clash/);
    await expect(square(page, 9, 0).locator('.ch')).toHaveText('');
    await expect(chip(page, 'Fishing')).not.toHaveClass(/used/);
    await expect(page.locator('#picking')).toHaveText("Fishing doesn't fit the letters already there.");
    await expect(square(page, 8, 0)).not.toHaveClass(/clash/);
  });

  test('a word of the wrong length is refused, and a word with no slot picked asks for one', async ({ page }) => {
    await chip(page, 'Hat').click();
    await expect(page.locator('#picking')).toHaveText('Pick a slot first, then the word.');
    await square(page, 8, 1).click();
    await chip(page, 'Hat').click();
    await expect(page.locator('#picking')).toHaveText('That slot needs a 8-letter word.');
    await expect(square(page, 8, 1).locator('.ch')).toHaveText('');
  });

  test('a crossed-off word tapped comes out, letters it shares with another word staying', async ({ page }) => {
    await put(page, SHAPE, 'Barbecue');
    await put(page, SHAPE, 'Bonfire');
    await chip(page, 'Barbecue').click();
    await expect(chip(page, 'Barbecue')).not.toHaveClass(/used/);
    await expect(square(page, 8, 0).locator('.ch')).toHaveText('B');
    await expect(square(page, 8, 1).locator('.ch')).toHaveText('');
    await expect(page.locator('#count')).toHaveText('2/20');
  });

  test('every word in place pops and sparkles the shape and says so; then it takes no more taps', async ({ page }) => {
    const rest = SHAPE.words.filter(w => w.word !== SHAPE.given);
    for (const w of rest.slice(1)) await put(page, SHAPE, w.word);
    await expect(page.locator('#complete')).toBeHidden();
    await put(page, SHAPE, rest[0].word);
    await expect(page.locator('#count')).toHaveText('20/20');
    await expect(page.locator('#complete')).toBeVisible();
    await expect(page.locator('#complete')).toHaveText('Solved — every word in place');
    await expect(page.locator('#board')).toHaveClass(/pop/);
    expect(await page.locator('#board .spark').count()).toBeGreaterThan(0);
    await chip(page, rest[0].word).click();
    await expect(chip(page, rest[0].word)).toHaveClass(/used/);
  });

  test('the corner button flips to the answer, and back with the words intact', async ({ page }) => {
    await put(page, SHAPE, 'Barbecue');
    await page.click('#flip');
    await expect(page.locator('#card')).toHaveClass(/flipped/);
    await expect(page.locator('#flip')).toHaveAttribute('aria-label', 'Back to puzzle');
    await expect(page.locator('#solution-label')).toHaveText('Vanilla · Solution');
    await expect(page.locator('#solution-grid .criss-square')).toHaveCount(SHAPE.squares.join('').replace(/\./g, '').length);
    await expect(page.locator('#solution-grid [data-key="0,6"]')).toHaveText('L');
    await expect(page.locator('#solution-grid [data-key="14,8"]')).toHaveText('G');
    await page.click('#flip');
    await expect(page.locator('#card')).not.toHaveClass(/flipped/);
    expect(await letters(page, word(SHAPE, 'Barbecue'))).toEqual('BARBECUE'.split(''));
  });

  test('a shape that fits whole never zooms, and has no little map', async ({ page }) => {
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'false');
    await expect(page.locator('#zoom-in')).toBeHidden();
    await expect(page.locator('#minimap')).toBeHidden();
  });
});

test('a full shape with a word in the wrong place says so quietly, never which', async ({ page }) => {
  await open(page, 'CRSS-0099');
  await put(page, TWO, 'Cat', 'Dog');
  await put(page, TWO, 'Dog', 'Cat');
  await put(page, TWO, 'Net');
  await put(page, TWO, 'Kite');
  await expect(page.locator('#count')).toHaveText('5/5');
  await expect(page.locator('#complete')).toHaveText('Every word is in, but some are in the wrong place.');
  await expect(page.locator('#complete')).toHaveAttribute('data-state', 'wrong');
  await expect(page.locator('#board')).not.toHaveClass(/pop/);
  await expect(page.locator('#grid .clash')).toHaveCount(0);
});

test('an address naming no shape says so', async ({ page }) => {
  await page.goto('/app/crisscross.html?id=../maze/MAZE-0001');
  await expect(page.locator('#title')).toHaveText('Puzzle not found');
  await expect(page.locator('#missing')).toBeVisible();
  await expect(page.locator('#play')).toBeHidden();
});

test.describe('a shape too big for the screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('opens zoomed in, zooms out to the whole shape and in to 48px, the little map showing while zoomed in', async ({ page }) => {
    await open(page, 'CRSS-0002');
    await expect(page.locator('#title')).toHaveText('Long Summer');
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'true');
    await expect.poll(() => cellSize(page)).toBe('36px');
    await expect(page.locator('#minimap')).toBeVisible();
    const frame = await page.locator('#view').boundingBox();
    while (await page.locator('#zoom-out').isEnabled()) await page.click('#zoom-out');
    const whole = await page.locator('#world').boundingBox();
    expect(Math.round(whole.height)).toBe(Math.round(frame.height));
    await expect(page.locator('#minimap')).toBeHidden();
    while (await page.locator('#zoom-in').isEnabled()) await page.click('#zoom-in');
    await expect.poll(() => cellSize(page)).toBe('48px');
    await expect(page.locator('#minimap')).toBeVisible();
  });

  test('the little map sits over the Words card, and dragging its box looks round the shape', async ({ page }) => {
    await open(page, 'CRSS-0002');
    const map = await page.locator('#minimap').boundingBox();
    const words = await page.locator('.words-box').boundingBox();
    expect(map.y + map.height).toBeLessThanOrEqual(words.y);
    const world = page.locator('#world');
    const before = await world.evaluate(el => el.style.transform);
    await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
    await page.mouse.down();
    await page.mouse.move(map.x + map.width / 2 + 20, map.y + map.height / 2 + 20, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => world.evaluate(el => el.style.transform)).not.toBe(before);
  });

  test('dragging the shape moves round it and picks nothing; a tap still picks', async ({ page }) => {
    await open(page, 'CRSS-0002');
    const world = page.locator('#world');
    const before = await world.evaluate(el => el.style.transform);
    const frame = await page.locator('#view').boundingBox();
    const at = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 60, at.y + 40, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => world.evaluate(el => el.style.transform)).not.toBe(before);
    await expect(page.locator('#grid .picked')).toHaveCount(0);
    await square(page, ...await onView(page)).click();
    await expect(page.locator('#grid .picked')).not.toHaveCount(0);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('picking a slot shows that length\'s words just under the shape, on screen, and one placed from there goes in', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth)).toBeLessThanOrEqual(375);
    await expect(page.locator('#strip-picking')).toHaveText('Tap a square to pick a slot.');
    await expect(page.locator('#strip-chips .chip:visible')).toHaveCount(0);
    while (await page.locator('#zoom-out').isEnabled()) await page.click('#zoom-out');
    const target = word(SHAPE, 'Hat');
    await square(page, ...ownSquare(SHAPE, target)).tap();
    await expect(page.locator('#strip-chips .chip:visible')).toHaveText(['Hat', 'Ice', 'Map']);
    await expect(page.locator('#strip-picking')).toContainText(' down, 3 letters');
    const strip = await page.locator('#strip').boundingBox();
    const card = await page.locator('#stage').boundingBox();
    expect(strip.y).toBeGreaterThan(card.y + card.height);
    // The card and what's under it fit the window's height together, the title scrolled away.
    expect(strip.y + strip.height - card.y).toBeLessThanOrEqual(667);
    await page.locator('#strip-chips .chip').getByText('Hat', { exact: true }).tap();
    expect(await letters(page, target)).toEqual(['H', 'A', 'T']);
    await expect(page.locator('#strip-chips .chip:visible')).toHaveCount(0);
    await expect(chip(page, 'Hat')).toHaveClass(/used/);
  });

  test('a shape too wide to tap whole opens zoomed in, and a tap still picks', async ({ page }) => {
    await open(page);
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'true');
    await expect.poll(() => cellSize(page)).toBe('36px');
    await square(page, ...await onView(page)).tap();
    await expect(page.locator('#grid .picked')).not.toHaveCount(0);
  });

  test('the Words card sits under the shape and the row under it', async ({ page }) => {
    await open(page);
    const dock = await page.locator('#dock').boundingBox();
    const side = await page.locator('#words-card').boundingBox();
    expect(side.y).toBeGreaterThanOrEqual(dock.y + dock.height);
  });

  test('a big shape zooms, its little map under it on screen with the card', async ({ page }) => {
    await open(page, 'CRSS-0002');
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'true');
    await expect.poll(() => cellSize(page)).toBe('36px');
    await expect(page.locator('#minimap')).toBeVisible();
    const map = await page.locator('#minimap').boundingBox();
    const card = await page.locator('#stage').boundingBox();
    expect(map.y).toBeGreaterThan(card.y + card.height);
    expect(map.y + map.height - card.y).toBeLessThanOrEqual(667);
  });
});
