const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');
const { characters: CHARACTERS } = require('../content/characters/index.json');

// Themed or Plain (TASK-45): the owner's characters and backgrounds, on the real characters list.
// The play page is the test puzzle served under whichever hidden ID a test needs — its number
// picks its character and template.
const LOOK_KEY = 'grew-puzzles.look';
const LAYOUT_KEY = 'grew-puzzles.words-layout';
const url = file => `url("http://localhost:${new URL(test.info().project.use.baseURL).port}/content/characters/${file}")`;

async function openPlay(page, hiddenId, layout) {
  await page.route(/\/content\/puzzles\/wordsearch\/WSCH-\d+\.json$/, route => route.fulfill({ json: { ...PUZZLE, hiddenId } }));
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout || 'bottom']);
  await page.goto('/app/play.html?id=' + hiddenId);
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

const css = (locator, property) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);
const sceneOf = page => page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage);
// A card not on screen — the words over the grid, closed — has no box, and nothing covers it.
const overlaps = (a, b) => Boolean(b) && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const path of ['index.html', 'collection.html?slug=issue-1-remake', 'play.html?id=WSCH-0001', 'about.html', 'privacy.html', 'how-to-play.html', 'saving.html']) {
  test(`the side bar on ${path.split(/[.?]/)[0]} carries Themed / Plain, Themed on at a first visit, ending the side bar`, async ({ page }) => {
    await page.goto('/app/' + path);
    await expect(page.locator('html')).toHaveAttribute('data-look', 'themed');
    const look = page.locator('#site-side .look');
    await expect(look.locator('button')).toHaveText(['Themed', 'Plain']);
    await expect(look.locator('button[data-look="themed"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(look.locator('button[data-look="plain"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#site-side > *').last()).toHaveClass(/\blook\b/);
  });
}

test('a pick is kept going to another page and coming back tomorrow, and the side bar stays on it', async ({ page }) => {
  await page.goto('/app/privacy.html');
  await page.locator('#site-side .look button[data-look="plain"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-look', 'plain');
  await expect(page.locator('#site-side')).toBeVisible();
  await expect(page.locator('#site-side .look button[data-look="plain"]')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/app/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-look', 'plain');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-look', 'plain');
});

test('a page that cannot read or store the look opens Themed, and still switches', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
  });
  await page.goto('/app/privacy.html');
  await expect(page.locator('html')).toHaveAttribute('data-look', 'themed');
  await page.locator('#site-side .look button[data-look="plain"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-look', 'plain');
});

test('Themed, a puzzle wears the character its ID number lands on, background and name, the same every visit', async ({ page }) => {
  await openPlay(page, 'WSCH-0007');
  const owner = CHARACTERS[6];
  await expect(page.locator('#name-tag')).toHaveText(owner.name);
  await expect(page.locator('#name-tag')).toBeVisible();
  expect(await css(page.locator('#theme-figure'), 'background-image')).toBe(url(owner.figure));
  expect(await sceneOf(page)).toBe(url(owner.scene));
  await page.reload();
  await expect(page.locator('#name-tag')).toHaveText(owner.name);
});

test('puzzle 13 wears the first character again, round after the last', async ({ page }) => {
  await openPlay(page, 'WSCH-0013');
  await expect(page.locator('#name-tag')).toHaveText(CHARACTERS[0].name);
});

test('the three templates spread across puzzles by number: on the right, its mirror, the normal page', async ({ page }) => {
  for (const [id, template] of [['WSCH-0007', 'beside'], ['WSCH-0008', 'mirror'], ['WSCH-0009', 'normal']]) {
    await openPlay(page, id);
    await expect(page.locator('#play')).toHaveAttribute('data-template', template);
  }
});

for (const [id, side] of [['WSCH-0007', 'right'], ['WSCH-0008', 'left']]) {
  test(`under the grid, ${side === 'right' ? 'template 1' : 'its mirror'} narrows the words card to leave the character room on the ${side}`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await openPlay(page, id, 'bottom');
    const stage = await page.locator('.stage').boundingBox();
    const words = await page.locator('aside').boundingBox();
    const figure = await page.locator('#theme-figure').boundingBox();
    expect(words.width).toBeLessThan(stage.width - 50);
    const edges = { right: [words.x, stage.x], left: [words.x + words.width, stage.x + stage.width] }[side];
    expect(Math.abs(edges[0] - edges[1])).toBeLessThan(1);
    expect({ right: figure.x + figure.width / 2 > words.x + words.width, left: figure.x + figure.width / 2 < words.x }[side]).toBe(true);
  });
}

test('the normal page, and Plain, keep the words card the grid card\'s width under it', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await openPlay(page, 'WSCH-0009', 'bottom');
  const stage = await page.locator('.stage').boundingBox();
  expect(Math.abs((await page.locator('aside').boundingBox()).width - stage.width)).toBeLessThan(1);
  await lookAs(page, 'plain');
  await openPlay(page, 'WSCH-0007', 'bottom');
  expect(Math.abs((await page.locator('aside').boundingBox()).width - (await page.locator('.stage').boundingBox()).width)).toBeLessThan(1);
});

test('switching to Plain mid-puzzle gives the words back the grid card\'s width; Themed takes the room again', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await openPlay(page, 'WSCH-0007', 'bottom');
  const narrow = (await page.locator('aside').boundingBox()).width;
  await page.locator('#site-side .look button[data-look="plain"]').click();
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  await expect.poll(async () => (await page.locator('aside').boundingBox()).width).toBeCloseTo((await page.locator('.stage').boundingBox()).width, 0);
  await page.locator('#site-side .look button[data-look="themed"]').click();
  await expect.poll(async () => (await page.locator('aside').boundingBox()).width).toBeCloseTo(narrow, 0);
});

for (const id of ['WSCH-0007', 'WSCH-0008', 'WSCH-0009']) {
  for (const layout of ['bottom', 'right', 'overlay']) {
    test(`${id} in ${layout}: the name label covers neither the grid card nor the words card`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await openPlay(page, id, layout);
      const tag = await page.locator('#name-tag').boundingBox();
      expect(overlaps(tag, await page.locator('.stage').boundingBox())).toBe(false);
      expect(overlaps(tag, await page.locator('aside').boundingBox())).toBe(false);
    });
  }
}

// Mirrored left to right: the figure's drawn matrix turns over (its determinant goes negative).
const mirrored = locator => locator.evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return m.a * m.d - m.b * m.c < 0; });

for (const [id, layout, flipped] of [
  ['WSCH-0007', 'bottom', false], ['WSCH-0007', 'right', false], ['WSCH-0007', 'overlay', false],
  ['WSCH-0008', 'bottom', true], ['WSCH-0008', 'right', true], ['WSCH-0008', 'overlay', true],
  ['WSCH-0009', 'bottom', false], ['WSCH-0009', 'right', true], ['WSCH-0009', 'overlay', false]
]) {
  test(`${id} in ${layout}: the character faces ${flipped ? 'right, flipped' : 'left'}, behind the cards, and its name label reads the right way round`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPlay(page, id, layout);
    expect(await mirrored(page.locator('#theme-figure'))).toBe(flipped);
    expect(await mirrored(page.locator('#name-tag'))).toBe(false);
    expect(await css(page.locator('#theme-figure'), 'z-index')).toBe('-1');
  });
}

test('a tall grid keeps the character under it, not over its letters (Christmas, WSCH-0041)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(key => localStorage.setItem(key, 'bottom'), LAYOUT_KEY);
  await page.goto('/app/play.html?id=WSCH-0041');
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await page.evaluate(() => document.fonts.ready);
  const stage = await page.locator('.stage').boundingBox();
  const figure = await page.locator('#theme-figure').boundingBox();
  expect(stage.height).toBeGreaterThan(1000);
  expect(figure.y + figure.height / 2).toBeGreaterThan(stage.y + stage.height);
});

test('under the grid, a long word list scrolls in a words card no taller than the character; Plain keeps the whole list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(key => localStorage.setItem(key, 'bottom'), LAYOUT_KEY);
  await page.goto('/app/play.html?id=WSCH-0041');
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await page.evaluate(() => document.fonts.ready);
  const figure = await page.locator('#theme-figure').boundingBox();
  expect(Math.abs((await page.locator('.words-box').boundingBox()).height - figure.height)).toBeLessThan(2);
  expect(await page.locator('ul.words').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.locator('#site-side .look button[data-look="plain"]').click();
  await expect.poll(async () => (await page.locator('.words-box').boundingBox()).height).toBeGreaterThan(1000);
});

test('on a phone the character stands at the grid card\'s top-right, behind it, facing left, with no label and no room taken from the words', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPlay(page, 'WSCH-0008', 'bottom');
  expect(await mirrored(page.locator('#theme-figure'))).toBe(false);
  await expect(page.locator('#name-tag')).toBeHidden();
  expect(await css(page.locator('#theme-figure'), 'z-index')).toBe('-1');
  const stage = await page.locator('.stage').boundingBox();
  const figure = await page.locator('#theme-figure').boundingBox();
  expect(figure.height).toBeCloseTo(140 * Math.min(1, stage.width / 422), 0);
  expect(Math.abs((await page.locator('aside').boundingBox()).width - Math.min(stage.width, 358))).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('Plain shows no character, name or background, and never asks for a character image', async ({ page }) => {
  await lookAs(page, 'plain');
  const asked = imageRequests(page);
  await openPlay(page, 'WSCH-0007');
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  expect(await sceneOf(page)).toBe('none');
  await expect(page.locator('.play-head')).toHaveCSS('box-shadow', 'none');
  await page.goto('/app/index.html');
  await expect(page.locator('.tiles .tile').first()).toBeVisible();
  await expect(page.locator('.tile .theme-figure').first()).toBeHidden();
  await page.goto('/app/privacy.html');
  await expect(page.locator('#theme-figure')).toBeHidden();
  expect(asked).toEqual([]);
});

test('Themed loads only the pair on screen', async ({ page }) => {
  const asked = imageRequests(page);
  await openPlay(page, 'WSCH-0007');
  await expect.poll(() => asked.length).toBe(2);
  expect(asked.map(u => u.split('/').pop()).sort()).toEqual([CHARACTERS[6].scene, CHARACTERS[6].figure].sort());
});

test('the printout stays plain, Themed or not', async ({ page }) => {
  await openPlay(page, 'WSCH-0007');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  expect(await sceneOf(page)).toBe('none');
});

test('each landing tile wears its puzzle\'s character in the corner, a collection its first, on a background', async ({ page }) => {
  await page.goto('/app/index.html?type=Vanilla');
  const tile = page.locator('.tiles .tile').first();
  await expect(tile).toBeVisible();
  const id = (await tile.getAttribute('href')).match(/WSCH-(\d+)/)[1];
  const figure = tile.locator('.theme-figure');
  expect(await css(figure, 'background-image')).toBe(url(CHARACTERS[(Number(id) - 1) % CHARACTERS.length].figure));
  const t = await tile.boundingBox(), f = await figure.boundingBox();
  expect(f.x + f.width / 2).toBeCloseTo(t.x + 0.88 * t.width, -1);
  expect(f.height).toBeCloseTo(0.29 * t.height, -1);
  expect(await sceneOf(page)).toMatch(/content\/characters\/[a-z]+-bg\.webp/);
  await expect(page.locator('.tiles .tile .name-tag')).toHaveCount(0);

  await page.goto('/app/index.html?kind=collections');
  expect(await css(page.locator('.tiles .tile').first().locator('.theme-figure'), 'background-image')).toBe(url(CHARACTERS[0].figure));
});

test('on a collection page puzzle 1 wears the first character, puzzle 2 the second', async ({ page }) => {
  await page.goto('/app/collection.html?slug=issue-1-remake');
  const figures = page.locator('.tiles .tile .theme-figure');
  await expect(figures.first()).toBeAttached();
  const count = Math.min(await figures.count(), CHARACTERS.length + 1);
  for (let i = 0; i < count; i++) {
    expect(await css(figures.nth(i), 'background-image')).toBe(url(CHARACTERS[i % CHARACTERS.length].figure));
  }
});

test('a text page picks its character and its background each at random, on their own, with the name beside it', async ({ page }) => {
  // Every draw alternates first and last, so the character and the background — two picks, one
  // after the other — land on different ones whichever comes first.
  await page.addInitScript(() => { let n = 0; Math.random = () => [0, 0.99][n++ % 2]; });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/app/privacy.html');
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  const name = await page.locator('#name-tag').textContent();
  const character = CHARACTERS.find(c => c.name === name);
  expect([CHARACTERS[0], CHARACTERS[11]]).toContain(character);
  expect(await css(page.locator('#theme-figure'), 'background-image')).toBe(url(character.figure));
  const other = { [CHARACTERS[0].name]: CHARACTERS[11], [CHARACTERS[11].name]: CHARACTERS[0] }[name];
  expect(await sceneOf(page)).toBe(url(other.scene));
  const card = await page.locator('.page-card').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
  expect(figure.x + figure.width / 2 - card.x).toBeCloseTo(818, -1);
  expect(figure.height).toBeCloseTo(230, 0);
});

test('on a narrow window the text page\'s character shrinks over the card\'s top edge, in front', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/privacy.html');
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  const card = await page.locator('.page-card').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
  expect(figure.height).toBeCloseTo(120, 0);
  // Placed from inside the card's 2px outline.
  expect(figure.y + figure.height / 2 - card.y).toBeCloseTo(-68, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('a list of characters that cannot be read dresses nothing, and every page still works', async ({ page }) => {
  await page.route('**/content/characters/index.json', r => r.fulfill({ status: 404, body: 'Not found' }));
  await page.route(/\/content\/puzzles\/wordsearch\/WSCH-\d+\.json$/, route => route.fulfill({ json: PUZZLE }));
  await page.goto('/app/play.html?id=WSCH-0007');
  await expect(page.locator('#grid .cell')).toHaveCount(64);
  await expect(page.locator('#name-tag')).toBeHidden();
  await page.goto('/app/index.html');
  await expect(page.locator('.tiles .tile').first()).toBeVisible();
  await page.goto('/app/privacy.html');
  await expect(page.locator('#name-tag')).toBeHidden();
});
