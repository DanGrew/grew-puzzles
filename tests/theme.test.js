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

for (const path of ['index.html', 'collection.html?slug=issue-1-remake', 'play.html?id=WSCH-0001', 'about.html', 'feedback.html', 'privacy.html', 'how-to-play.html', 'saving.html']) {
  test(`the side bar on ${path.split(/[.?]/)[0]} carries Themed / Plain, Themed on at a first visit, just before the page's own print menu, if it has one`, async ({ page }) => {
    await page.goto('/app/' + path);
    await expect(page.locator('html')).toHaveAttribute('data-look', 'themed');
    const look = page.locator('#site-side .look');
    await expect(look.locator('button')).toHaveText(['Themed', 'Plain']);
    await expect(look.locator('button[data-look="themed"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(look.locator('button[data-look="plain"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#site-side > *').nth(-2)).toHaveClass(/\blook\b/);
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

// TASK-114: a Kids puzzle is dressed as any wordsearch is, its big grid card and all.
for (const layout of ['bottom', 'right', 'overlay']) {
  test(`Themed in ${layout}, a Kids puzzle wears the character its ID number lands on, background and name, the label clear of its bigger cards`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route(/\/content\/puzzles\/wordsearch\/WSCH-\d+\.json$/, route => route.fulfill({ json: require('./fixtures/WSCH-0012.json') }));
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout]);
    await page.goto('/app/play.html?id=WSCH-0012');
    await expect(page.locator('#name-tag')).not.toBeEmpty();
    await page.evaluate(() => document.fonts.ready);
    const owner = CHARACTERS[11];
    await expect(page.locator('#name-tag')).toHaveText(owner.name);
    expect(await css(page.locator('#theme-figure'), 'background-image')).toBe(url(owner.figure));
    expect(await sceneOf(page)).toBe(url(owner.scene));
    await expect(page.locator('#grid .cell').first()).toHaveCSS('font-size', '33px');
    const tag = await page.locator('#name-tag').boundingBox();
    expect(overlaps(tag, await page.locator('.stage').boundingBox())).toBe(false);
    expect(overlaps(tag, await page.locator('aside').boundingBox())).toBe(false);
  });
}

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

// TASK-146: the site wears the printout's four spots (core/theme-core.js), fixed by the puzzle's number.
const spotOf = page => page.locator('#theme-figure').getAttribute('data-spot');
// Mirrored left to right: the figure's drawn matrix turns over (its determinant goes negative).
const mirrored = locator => locator.evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return m.a * m.d - m.b * m.c < 0; });
// The figure's centre and height as placed, and the grid card, both from the play area's top-left.
const placed = page => page.evaluate(() => {
  const play = document.getElementById('play').getBoundingClientRect(), stage = document.getElementById('stage').getBoundingClientRect();
  const f = document.getElementById('theme-figure').style;
  return {
    x: parseFloat(f.left), y: parseFloat(f.top), height: parseFloat(f.height),
    card: { left: stage.left - play.left, top: stage.top - play.top, right: stage.right - play.left, width: stage.width }
  };
});

// A puzzle as published, its words in a layout.
async function openReal(page, id, layout) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LAYOUT_KEY, layout]);
  await page.goto('/app/play.html?id=' + id);
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await page.evaluate(() => document.fonts.ready);
}

test('Themed, the puzzle\'s number picks one of the printout\'s four spots, the same every visit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [id, spot] of [['WSCH-0001', 'right'], ['WSCH-0002', 'left'], ['WSCH-0003', 'topRight'], ['WSCH-0004', 'topLeft']]) {
    await openReal(page, id, 'bottom');
    await expect.poll(() => spotOf(page)).toBe(spot);
    await page.reload();
    await expect(page.locator('#name-tag')).not.toBeEmpty();
    await expect.poll(() => spotOf(page)).toBe(spot);
  }
});

test('a spot stands where the printout has it, the printout\'s picture at the grid card\'s size', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  // A 15 × 15 puzzle prints its grid card 396.85 + 32 px across.
  await openReal(page, 'WSCH-0001', 'bottom');
  await expect.poll(() => spotOf(page)).toBe('right');
  const right = await placed(page), scale = right.card.width / 428.85;
  expect(scale).toBeGreaterThan(1);
  expect(right.x - right.card.right).toBeCloseTo(10 * scale, 0);
  expect(right.y - right.card.top).toBeCloseTo(188 * scale, 0);
  expect(right.height).toBeCloseTo(293 * scale, 0);
  await openReal(page, 'WSCH-0004', 'bottom');
  await expect.poll(() => spotOf(page)).toBe('topLeft');
  const topLeft = await placed(page);
  expect(topLeft.x - topLeft.card.left).toBeCloseTo(49 * scale, 0);
  expect(topLeft.y - topLeft.card.top).toBeCloseTo(-14 * scale, 0);
  expect(topLeft.height).toBeCloseTo(213 * scale, 0);
});

test('a spot whose character would rise over the title is passed over: with the words at the Right, the top right', async ({ page }) => {
  // Puzzle 3's number lands on the top right; beside its words, that corner is under the title.
  await page.setViewportSize({ width: 1920, height: 1000 });
  await openReal(page, 'WSCH-0003', 'right');
  await expect(page.locator('#play')).toHaveAttribute('data-sits', 'right');
  await expect.poll(() => spotOf(page)).not.toBe('topRight');
  const title = await page.locator('.play-head').boundingBox(), tag = await page.locator('#name-tag').boundingBox();
  // The top left's label would stand behind the side bar here, so it's left off.
  expect(tag === null || !overlaps(tag, title)).toBe(true);
  const figure = await page.locator('#theme-figure').boundingBox();
  expect(figure.x + figure.width).toBeLessThan(title.x);
});

for (const id of ['WSCH-0007', 'WSCH-0008', 'WSCH-0009', 'WSCH-0010']) {
  test(`${id}: the character faces the grid, flipped on the right, behind the cards, its name label the right way round`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPlay(page, id, 'bottom');
    expect(await mirrored(page.locator('#theme-figure'))).toBe(['right', 'topRight'].includes(await spotOf(page)));
    expect(await mirrored(page.locator('#name-tag'))).toBe(false);
    await expect(page.locator('#name-tag')).toBeVisible();
    expect(await css(page.locator('#theme-figure'), 'z-index')).toBe('-1');
  });

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

test('with the words at the Right, a spot the words card would cover is skipped, the number picking among the rest', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openPlay(page, 'WSCH-0009', 'right');
  expect(await spotOf(page)).not.toBe('right');
  const figure = await page.locator('#theme-figure').boundingBox(), words = await page.locator('aside').boundingBox();
  expect(figure.x + figure.width / 2).toBeLessThan(words.x);
});

test('a spot the window\'s edge would cut is skipped: the left side, past the side bar\'s edge', async ({ page }) => {
  // Puzzle 2's 15 × 15 grid: wide on a 1440 px window the left side shows, on 1100 px it would
  // stand behind the side bar.
  await page.addInitScript(key => localStorage.setItem(key, 'bottom'), LAYOUT_KEY);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/play.html?id=WSCH-0002');
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await expect.poll(() => spotOf(page)).toBe('left');
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect.poll(() => spotOf(page)).not.toBe('left');
  const side = await page.locator('#site-side').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
  expect(figure.x + figure.width / 2).toBeGreaterThan(side.x + side.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1100);
});

test('the words card keeps the grid card\'s width under the grid, Themed or Plain, and switching the look never moves it', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  for (const id of ['WSCH-0007', 'WSCH-0008', 'WSCH-0009', 'WSCH-0010']) {
    await openPlay(page, id, 'bottom');
    expect(Math.abs((await page.locator('aside').boundingBox()).width - (await page.locator('.stage').boundingBox()).width)).toBeLessThan(1);
  }
  // Across, that is: Themed's white title tag sits everything a little lower.
  const across = async () => { const b = await page.locator('aside').boundingBox(); return [b.x, b.width, b.height]; };
  const themed = await across();
  await page.locator('#site-side .look button[data-look="plain"]').click();
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  expect(await across()).toEqual(themed);
  await page.locator('#site-side .look button[data-look="themed"]').click();
  await expect(page.locator('#name-tag')).toBeVisible();
  expect(await across()).toEqual(themed);
});

test('under the grid, a long word list is never capped to the character\'s height (Christmas, WSCH-0041)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(key => localStorage.setItem(key, 'bottom'), LAYOUT_KEY);
  await page.goto('/app/play.html?id=WSCH-0041');
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await page.evaluate(() => document.fonts.ready);
  expect((await page.locator('.words-box').boundingBox()).height).toBeGreaterThan(1000);
  expect(await page.locator('ul.words').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(false);
});

test('a Saga\'s play page picks only from the two top corners, as its printed sheets do', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(key => localStorage.setItem(key, 'bottom'), LAYOUT_KEY);
  for (const [id, spot] of [['WSCH-0041', 'topRight'], ['WSCH-0042', 'topLeft']]) {
    await page.goto('/app/play.html?id=' + id);
    await expect(page.locator('#name-tag')).not.toBeEmpty();
    await page.evaluate(() => document.fonts.ready);
    expect(await spotOf(page)).toBe(spot);
    const stage = await page.locator('.stage').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
    expect(figure.y + figure.height / 2).toBeLessThan(stage.y);
  }
});

test('on a phone the character peers over a top corner of the grid card, behind it, with no label and no room taken from the words', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['WSCH-0007', 'WSCH-0008', 'WSCH-0009', 'WSCH-0010']) {
    await openPlay(page, id, 'bottom');
    expect(['topRight', 'topLeft']).toContain(await spotOf(page));
    await expect(page.locator('#name-tag')).toBeHidden();
    expect(await css(page.locator('#theme-figure'), 'z-index')).toBe('-1');
    const stage = await page.locator('.stage').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
    expect(figure.y + figure.height / 2).toBeLessThan(stage.y);
    expect(Math.abs((await page.locator('aside').boundingBox()).width - Math.min(stage.width, 358))).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  }
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

test('Themed on screen, the printout stays plain while Print is Plain', async ({ page }) => {
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
  await expect(page.locator('#name-tag')).toBeVisible();
});

// Each text page's place in the side bar picks its spot, round the four, the same every visit. The
// character, picked at random, held to one whose ink and name label every spot holds — another's may
// not fit a spot, which is then rightly skipped.
for (const [path, spot] of [['how-to-play', 'right'], ['saving', 'left'], ['about', 'topRight'], ['feedback', 'topLeft'], ['privacy', 'right']]) {
  test(`${path} wears its character peering from behind the text card at its own spot, ${spot}, at the printout's size`, async ({ page }) => {
    await page.addInitScript(() => { Math.random = () => 0.5; });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/app/${path}.html`);
    await expect(page.locator('#name-tag')).not.toBeEmpty();
    await expect.poll(() => spotOf(page)).toBe(spot);
    expect(await css(page.locator('#theme-figure'), 'z-index')).toBe('-1');
    expect(parseFloat(await page.locator('#theme-figure').evaluate(el => el.style.height))).toBe({ right: 293, left: 293, topRight: 213, topLeft: 213 }[spot]);
    await expect(page.locator('#name-tag')).toBeVisible();
    await page.reload();
    await expect(page.locator('#name-tag')).not.toBeEmpty();
    await expect.poll(() => spotOf(page)).toBe(spot);
  });
}

test('a text page whose name label the window\'s edge would cut keeps its character and leaves the label off', async ({ page }) => {
  // Bunnosaur, the first, whose label no spot holds on a 1200 px window.
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/app/privacy.html');
  await expect.poll(() => spotOf(page)).not.toBeNull();
  await expect(page.locator('#name-tag')).toBeHidden();
  await expect(page.locator('#theme-figure')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1200);
});

test('on a phone a text page\'s character peers over a top corner of the text card, behind it, with no label', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/privacy.html');
  await expect.poll(() => spotOf(page)).not.toBeNull();
  expect(['topRight', 'topLeft']).toContain(await spotOf(page));
  await expect(page.locator('#name-tag')).toBeHidden();
  expect(await css(page.locator('#theme-figure'), 'z-index')).toBe('-1');
  const card = await page.locator('.page-card').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
  expect(figure.y + figure.height / 2).toBeLessThan(card.y);
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

// TASK-104: a maze is dressed as a wordsearch is — the published mazes, on the real characters list.
async function openMaze(page, id) {
  await page.goto('/app/maze.html?id=' + id);
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await page.evaluate(() => document.fonts.ready);
}

test('Themed, a maze wears the character its ID number lands on, background and name, the same every visit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openMaze(page, 'MAZE-0002');
  const owner = CHARACTERS[1];
  await expect(page.locator('#name-tag')).toHaveText(owner.name);
  expect(await css(page.locator('#theme-figure'), 'background-image')).toBe(url(owner.figure));
  expect(await sceneOf(page)).toBe(url(owner.scene));
  await expect(page.locator('#theme-figure')).toBeVisible();
  await page.reload();
  await expect(page.locator('#name-tag')).toHaveText(owner.name);
  await expect.poll(() => spotOf(page)).toBe('left');
});

test('a maze\'s character peers from behind the left of its card, clear of the checklist above it and the control pad beside it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const id of ['MAZE-0001', 'MAZE-0002', 'MAZE-0003', 'MAZE-0004', 'MAZE-0006', 'MAZE-0024']) {
    await openMaze(page, id);
    await expect.poll(() => spotOf(page)).toBe('left');
    expect(await css(page.locator('#theme-figure'), 'z-index')).toBe('-1');
    const stage = await page.locator('.stage').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
    expect(figure.x + figure.width / 2).toBeLessThan(stage.x);
    expect(overlaps(figure, await page.locator('#checklist-card').boundingBox())).toBe(false);
    expect(overlaps(figure, await page.locator('#controls').boundingBox())).toBe(false);
    // Its name label, where it has room for one, as clear.
    for (const tag of [await page.locator('#name-tag').boundingBox()].filter(Boolean)) {
      for (const card of ['.stage', '#checklist-card', '#controls']) expect(overlaps(tag, await page.locator(card).boundingBox())).toBe(false);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
  }
});

test('where no spot shows, a maze\'s character still never stands behind the control pad: it peeks past the side bar on the left', async ({ page }) => {
  // Bunnosaur on a 1920 px window: the left side's ears reach behind the side bar.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openMaze(page, 'MAZE-0001');
  await expect.poll(() => spotOf(page)).toBe('left');
  await expect(page.locator('#name-tag')).toBeHidden();
  const figure = await page.locator('#theme-figure').boundingBox(), side = await page.locator('#site-side').boundingBox();
  expect(figure.x).toBeLessThan(side.x + side.width);
  expect(overlaps(figure, await page.locator('#controls').boundingBox())).toBe(false);
});

test('a maze\'s character stands as big against its card as the printout\'s against its own, and shrinks with the card on a shorter window', async ({ page }) => {
  const measure = async () => {
    const stage = await page.locator('.stage').boundingBox();
    const height = parseFloat(await page.locator('#theme-figure').evaluate(el => el.style.height));
    return { stage, height };
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await openMaze(page, 'MAZE-0002');
  await expect.poll(() => spotOf(page)).toBe('left');
  const tall = await measure();
  expect(tall.height).toBeCloseTo(293 * Math.min(tall.stage.width / 429, tall.stage.height / 472), 0);
  await page.setViewportSize({ width: 1440, height: 700 });
  await expect.poll(async () => (await measure()).height).toBeLessThan(tall.height);
  const short = await measure();
  expect(short.stage.height).toBeLessThan(tall.stage.height);
  expect(short.height).toBeCloseTo(293 * Math.min(short.stage.width / 429, short.stage.height / 472), 0);
});

test('on a phone a maze\'s character peers over a top corner of its card, behind it, with no label', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [id, spot] of [['MAZE-0001', 'topRight'], ['MAZE-0002', 'topLeft']]) {
    await openMaze(page, id);
    await expect.poll(() => spotOf(page)).toBe(spot);
    await expect(page.locator('#name-tag')).toBeHidden();
    expect(await css(page.locator('#theme-figure'), 'z-index')).toBe('-1');
    const stage = await page.locator('.stage').boundingBox(), figure = await page.locator('#theme-figure').boundingBox();
    expect(figure.y + figure.height / 2).toBeLessThan(stage.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  }
});

test('Plain, a maze shows no character, name or background, and never asks for a character image; switching to Themed dresses it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await lookAs(page, 'plain');
  const asked = imageRequests(page);
  await openMaze(page, 'MAZE-0010');
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  expect(await sceneOf(page)).toBe('none');
  await expect(page.locator('#grid .stop.collectible').first()).toHaveCSS('background-image', 'none');
  expect(asked).toEqual([]);
  await page.locator('#site-side .look button[data-look="themed"]').click();
  await expect(page.locator('#theme-figure')).toBeVisible();
  await expect(page.locator('#name-tag')).toBeVisible();
  expect(await spotOf(page)).toBe('left');
});

test('in a collection, its mazes wear the characters in its order, round again after the last, as its wordsearches do', async ({ page }) => {
  const puzzles = [['WSCH-0001', 1], ['MAZE-0001', 2], ['MAZE-0002', 3], ['WSCH-0002', 4], ['MAZE-0003', 13]].map(([id, number]) => ({ id, number }));
  await page.route('**/content/collections/index.json', r => r.fulfill({ json: { collections: [
    { slug: 'mixed', name: 'Mixed', description: 'Both kinds.', created: '2026-10-11', puzzles }
  ] } }));
  await page.goto('/app/collection.html?slug=mixed');
  const tiles = page.locator('.tiles .tile');
  await expect(tiles).toHaveCount(5);
  for (const [i, number] of [1, 2, 3, 4, 13].entries()) {
    expect(await css(tiles.nth(i).locator('.theme-figure'), 'background-image')).toBe(url(CHARACTERS[(number - 1) % CHARACTERS.length].figure));
  }
  await expect(tiles.nth(1)).toHaveAttribute('href', /maze\.html\?id=MAZE-0001/);
});
