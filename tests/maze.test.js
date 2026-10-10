const { test, expect } = require('@playwright/test');
// The site publishes no maze here: the fixtures are served as MAZE-0001 — a 6×6 Keylecticodes with
// every element: a guide, two collectibles, Key 1 and its zone, A, B and C, and six exits, the right
// one CBA — and MAZE-0002, a real-size 32×40 Vanilla of guides. Both pass tooling's maze checks.
const MAZE = require('./fixtures/MAZE-0001.json');
const BIG = require('./fixtures/MAZE-0002.json');
// MAZE-0003: a 100×100 Collectibles maze, eight collectibles and six blocks, made by tooling's own
// engine and passing its checks.
const HUNDRED = require('./fixtures/MAZE-0003.json');
const WORDSEARCH = require('./fixtures/WSCH-0007.json');

// The fixture without its letters and exits: its checklist ends in End.
const NO_LETTERS = { ...MAZE, type: 'Collectibles', letters: [], exits: [] };
// The 100×100 maze set off from its middle, an open crossroads, so the view can centre on the
// player every way.
const MIDDLE = { ...HUNDRED, start: { row: 50, col: 50 } };

async function open(page, { maze, look, id } = {}) {
  await page.addInitScript(l => localStorage.setItem('grew-puzzles.look', l), look || 'plain');
  await page.route('**/content/puzzles/maze/MAZE-0001.json', route => route.fulfill({ json: maze || MAZE }));
  await page.route('**/content/puzzles/maze/MAZE-0002.json', route => route.fulfill({ json: BIG }));
  await page.route('**/content/puzzles/maze/MAZE-0003.json', route => route.fulfill({ json: maze || HUNDRED }));
  await page.goto('/app/maze.html?id=' + (id || 'MAZE-0001'));
  await expect(page.locator('#play')).toBeVisible();
}

const cell = (page, r, c, cols = 6) => page.locator('#grid .maze-cell').nth(r * cols + c);
const stop = (page, id) => page.locator(`#grid [data-stop="${id}"]`);
const line = (page, text) => page.locator('#checklist li').filter({ has: page.locator('.line-text', { hasText: new RegExp(`^${text}$`) }) });
// A line's boxes, ticked or not, left to right.
const ticks = (page, text) => line(page, text).locator('.box').evaluateAll(boxes => boxes.map(b => b.classList.contains('ticked')));

async function tapAll(page, cells) {
  for (const [r, c] of cells) await cell(page, r, c).click();
}

// The trail's cells, read back from its line's points.
async function trail(page) {
  const points = await page.locator('#trail').getAttribute('points');
  return points.split(' ').map(p => p.split(',').map(n => Number(n) - 0.5).reverse());
}

// The saved walk, tapped a cell at a time — a step back taps the cell behind.
function solutionCells() {
  const step = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
  return MAZE.solution.split('').reduce((walk, side) => {
    const here = walk[walk.length - 1];
    return walk.concat([[here[0] + step[side][0], here[1] + step[side][1]]]);
  }, [[0, 0]]).slice(1);
}

// From the right exit, back to the start and round the other exits, BCA last.
const OTHER_EXITS = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5], [2, 5], [3, 5], [4, 5], [4, 4], [3, 4],
  [4, 4], [4, 5], [3, 5], [2, 5], [1, 5], [1, 4], [2, 4]];

test.describe('a maze on the landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: {
      puzzles: [{ hiddenId: 'WSCH-0007', type: 'Vanilla', created: '2026-10-02', title: 'Farmyard' }],
    } }));
    await page.route('**/content/puzzles/maze/index.json', r => r.fulfill({ json: {
      puzzles: [{ hiddenId: 'MAZE-0001', type: 'Keylecticodes', created: '2026-10-08', title: 'Everything corner' }],
    } }));
    await page.route('**/content/collections/index.json', r => r.fulfill({ status: 404 }));
  });

  test('shows under Mazes as a tile like any other, its type under its title, in its difficulty\'s colour', async ({ page }) => {
    await page.goto('/app/?kind=maze');
    const tile = page.locator('.tile', { hasText: 'Everything corner' });
    await expect(tile).toBeVisible();
    await expect(tile.locator('.line').first()).toHaveText('Keylecticodes');
    await expect(tile).toHaveAttribute('data-tone', 'Extreme');
    await expect(page.locator('#total')).toHaveText('1 puzzle');
  });

  test('the landing page opens on the wordsearches alone; the maze waits under Mazes', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.locator('#browse-title')).toHaveText('Wordsearches');
    await expect(page.locator('.tile .name')).toHaveText(['Farmyard']);
  });

  test('its difficulty and its type each sit in the filters, saved before the pick so at its type\'s level', async ({ page }) => {
    await page.goto('/app/?kind=maze');
    await page.click('#filter-button');
    await expect(page.locator('#filters .chip.levels')).toHaveText(['Extreme']);
    await expect(page.locator('#filters .chip.types')).toHaveText(['Keylecticodes']);
  });

  test('tapping it opens its maze play page: the maze in the grid card, the checklist above it', async ({ page }) => {
    await page.route('**/content/puzzles/maze/MAZE-0001.json', route => route.fulfill({ json: MAZE }));
    await page.goto('/app/?kind=maze');
    await page.locator('.tile', { hasText: 'Everything corner' }).click();
    await expect(page).toHaveURL(/\/app\/maze\.html\?id=MAZE-0001$/);
    await expect(page.locator('#title')).toHaveText('Everything corner');
    await expect(page.locator('#label')).toHaveText('Keylecticodes');
    await expect(page.locator('#grid .maze-cell')).toHaveCount(36);
    await expect(page.locator('#checklist-card h2')).toHaveText('Checklist');
  });

  test('a wordsearch tile still opens the wordsearch play page', async ({ page }) => {
    await page.route('**/content/puzzles/wordsearch/WSCH-0007.json', route => route.fulfill({ json: WORDSEARCH }));
    await page.goto('/app/');
    await page.locator('.tile', { hasText: 'Farmyard' }).click();
    await expect(page).toHaveURL(/\/app\/play\.html\?id=WSCH-0007$/);
    await expect(page.locator('#grid .cell').first()).toBeVisible();
  });
});

test('a site with no mazes shows its wordsearches as before', async ({ page }) => {
  await page.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: {
    puzzles: [{ hiddenId: 'WSCH-0007', type: 'Vanilla', created: '2026-10-02', title: 'Farmyard' }],
  } }));
  await page.route('**/content/puzzles/maze/index.json', r => r.fulfill({ status: 404 }));
  await page.route('**/content/collections/index.json', r => r.fulfill({ status: 404 }));
  await page.goto('/app/');
  await expect(page.locator('.tile')).toHaveCount(1);
  await expect(page.locator('#total')).toHaveText('1 puzzle');
});

test('the start is highlighted, the trail sets off from it, and its difficulty and code sit under the title, no date', async ({ page }) => {
  await open(page);
  await expect(page.locator('#ident')).toHaveText('Extreme · MAZE-0001');
  await expect(page.locator('.play-head')).not.toContainText('2026');
  await expect(cell(page, 0, 0)).toHaveClass(/\bstart\b/);
  await expect(page.locator('#grid .start')).toHaveCount(1);
  expect(await trail(page)).toEqual([[0, 0]]);
});

test('a maze shows the difficulty saved with it under its title, in that difficulty\'s colour, as its tile does', async ({ page }) => {
  await open(page, { maze: { ...MAZE, difficulty: 'Hard' } });
  await expect(page.locator('#ident')).toHaveText('Hard · MAZE-0001');
  await expect(page.locator('#difficulty')).toHaveCSS('background-color', 'rgb(246, 180, 122)');
});

test('tapping the open cell next to the trail\'s end extends the trail there', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 1], [0, 2], [1, 2]]);
  expect(await trail(page)).toEqual([[0, 0], [0, 1], [0, 2]]);
  await tapAll(page, [[0, 3]]);
  expect(await trail(page)).toEqual([[0, 0], [0, 1], [0, 2], [0, 3]]);
});

test('a cell not next to the trail\'s end, or through a wall, does nothing', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 1]]);
  await tapAll(page, [[1, 1], [0, 3], [1, 2], [5, 5]]);
  expect(await trail(page)).toEqual([[0, 0], [0, 1]]);
});

test('tapping an earlier cell of the trail backs out to it', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 1], [0, 2], [0, 3], [0, 4]]);
  await tapAll(page, [[0, 1]]);
  expect(await trail(page)).toEqual([[0, 0], [0, 1]]);
});

test('stepping on a letter picks it up: it fades, its line ticks, and it stays ticked after backing out', async ({ page }) => {
  await open(page);
  await expect(stop(page, 'letter-C')).not.toHaveClass(/\bgot\b/);
  await tapAll(page, [[0, 1], [0, 2], [0, 3]]);
  await expect(stop(page, 'letter-C')).toHaveClass(/\bgot\b/);
  await expect(stop(page, 'letter-C')).toHaveCSS('opacity', '0.25');
  await expect(line(page, 'C')).toHaveClass(/\bdone\b/);
  await tapAll(page, [[0, 0]]);
  await expect(line(page, 'C')).toHaveClass(/\bdone\b/);
  await expect(stop(page, 'letter-C')).toHaveClass(/\bgot\b/);
});

test('a guide, a key and a collectible each tick a box on their lines as they\'re picked up', async ({ page }) => {
  await open(page);
  await tapAll(page, [[1, 0], [2, 0], [2, 1]]);
  await expect.poll(() => ticks(page, 'Keys')).toEqual([true]);
  await expect(line(page, 'Keys')).toHaveClass(/\bdone\b/);
  await tapAll(page, [[2, 0], [3, 0], [4, 0], [4, 1]]);
  await expect.poll(() => ticks(page, 'Guides')).toEqual([true]);
  await tapAll(page, [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5], [0, 5]]);
  await expect.poll(() => ticks(page, 'Collectibles')).toEqual([true, false]);
  await expect(line(page, 'Collectibles').locator('.boxes')).toHaveAttribute('aria-label', '1 of 2 found');
  await expect(line(page, 'Collectibles')).not.toHaveClass(/\bdone\b/);
});

test('tapping into a zone without its key does nothing and the zone flashes its key\'s number; with the key, the player walks in', async ({ page }) => {
  await open(page);
  const zone = page.locator('#marks .zone[data-key="1"]');
  await expect(zone).toHaveText('');
  await tapAll(page, [[0, 1], [0, 2], [1, 2]]);
  expect(await trail(page)).toEqual([[0, 0], [0, 1], [0, 2]]);
  await expect(zone).toHaveClass(/\bflash\b/);
  expect(await zone.evaluate(z => getComputedStyle(z, '::after').content)).toBe('"1"');
  await tapAll(page, [[0, 1], [0, 0], [1, 0], [2, 0], [2, 1], [2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [1, 2], [1, 3]]);
  expect((await trail(page)).slice(-2)).toEqual([[1, 2], [1, 3]]);
  await expect(zone).toHaveClass(/\bopen\b/);
  await expect.poll(() => ticks(page, 'Collectibles')).toEqual([true, false]);
});

test('the checklist reads Guides, Keys, Collectibles, A, B, C, then the six exits, all unticked', async ({ page }) => {
  await open(page);
  await expect(page.locator('#checklist .line-text')).toHaveText(['Guides', 'Keys', 'Collectibles', 'A', 'B', 'C', 'ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA']);
  await expect(page.locator('#checklist li')).toHaveText(['Guides', 'Keys1', 'Collectibles', 'A', 'B', 'C', 'ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA']);
  expect(await page.locator('#checklist li').evaluateAll(lis => lis.map(li => li.querySelectorAll('.box').length))).toEqual([1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  await expect(page.locator('#checklist .box.ticked')).toHaveCount(0);
  await expect(page.locator('#checklist li.done')).toHaveCount(0);
  await expect(page.locator('#count')).toHaveText('0/12');
});

// The fixture with twelve collectibles, and four keys listed out of order.
const TWELVE = { ...MAZE, collectibles: Array.from({ length: 12 }, (_, i) => ({ row: 5, col: i % 6 })),
  keys: [3, 1, 4, 2].map((key, i) => ({ key, row: 5 - i, col: 5 })), zones: [] };

test('a maze with 12 collectibles shows 12 empty boxes and no 0/12; its keys are boxes numbered 1 to 4', async ({ page }) => {
  await open(page, { maze: TWELVE });
  await expect.poll(() => ticks(page, 'Collectibles')).toEqual(Array(12).fill(false));
  await expect(line(page, 'Collectibles')).toHaveText('Collectibles');
  await expect(line(page, 'Keys').locator('.box')).toHaveText(['1', '2', '3', '4']);
});

// A big maze's worth of collectibles: a long line.
const SIXTY = { ...MAZE, collectibles: Array.from({ length: 60 }, () => ({ row: 5, col: 0 })) };

for (const [name, size] of [['on desktop', { width: 1280, height: 800 }], ['on a phone', { width: 390, height: 844 }]]) {
  test(`${name}, sixty collectibles' boxes wrap rather than widening the checklist`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await open(page);
    const before = await page.locator('#checklist-card').boundingBox();
    const many = await context.newPage();
    await many.setViewportSize(size);
    await open(many, { maze: SIXTY });
    const boxes = line(many, 'Collectibles').locator('.box');
    await expect(boxes).toHaveCount(60);
    const card = await many.locator('#checklist-card').boundingBox(), last = await boxes.last().boundingBox();
    expect(card.width).toBeLessThanOrEqual(before.width + 1);
    expect(last.x + last.width).toBeLessThanOrEqual(card.x + card.width);
    expect(await boxes.evaluateAll(all => new Set(all.map(b => b.getBoundingClientRect().top)).size)).toBeGreaterThan(1);
  });
}

test('each exit is marked when stepped on, at any time: a wrong one ✗, the right one ✓, in the list and in the maze', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5]]);
  await expect(line(page, 'ACB')).toHaveClass(/\bdone\b/);
  await expect(line(page, 'ACB').locator('.mark')).toHaveText('✗');
  const text = await line(page, 'ACB').locator('.line-text').boundingBox(), mark = await line(page, 'ACB').locator('.mark').boundingBox();
  expect(mark.x - (text.x + text.width)).toBeLessThan(12);
  await expect(stop(page, 'exit-ACB')).toHaveAttribute('data-mark', '✗');
  await tapAll(page, [[0, 0], ...solutionCells()]);
  await expect(line(page, 'CBA').locator('.mark')).toHaveText('✓');
  await expect(stop(page, 'exit-CBA')).toHaveAttribute('data-mark', '✓');
  await expect(page.locator('#complete')).toBeHidden();
});

test('a maze without letters lists only what it has, ending in End', async ({ page }) => {
  await open(page, { maze: NO_LETTERS });
  await expect(page.locator('#checklist .line-text')).toHaveText(['Guides', 'Keys', 'Collectibles', 'End']);
  await expect(page.locator('#grid .stop.exit')).toHaveCount(0);
  await expect(stop(page, 'end')).toBeVisible();
});

test('ticking every line pops and sparkles the maze, like a finished wordsearch', async ({ page }) => {
  await open(page);
  await tapAll(page, solutionCells());
  await tapAll(page, OTHER_EXITS.slice(0, -1));
  await expect(page.locator('#complete')).toBeHidden();
  await expect(page.locator('#count')).toHaveText('11/12');
  await tapAll(page, OTHER_EXITS.slice(-1));
  await expect(page.locator('#count')).toHaveText('12/12');
  await expect(page.locator('#complete')).toBeVisible();
  await expect(page.locator('#board')).toHaveClass(/\bpop\b/);
  await expect(page.locator('#board .spark').first()).toBeAttached();
});

test('the flip shows the solution: the main path blue, the detours green, the right exit dotted, the wrong ones crossed', async ({ page }) => {
  await open(page);
  await page.click('#flip');
  await expect(page.locator('#card')).toHaveClass(/\bflipped\b/);
  await expect(page.locator('#solution-label')).toHaveText('Keylecticodes · Solution');
  await expect(page.locator('#solution-lines .main')).toHaveCSS('stroke', 'rgb(42, 109, 245)');
  await expect(page.locator('#solution-lines .detour')).toHaveCSS('stroke', 'rgb(27, 154, 70)');
  expect(await page.locator('#solution-lines .main').getAttribute('points')).toBe(
    '0.5,0.5 0.5,1.5 0.5,2.5 0.5,3.5 0.5,4.5 1.5,4.5 2.5,4.5 3.5,4.5 3.5,5.5 4.5,5.5 5.5,5.5');
  await expect(page.locator('#solution-lines .exit-right')).toHaveCount(1);
  await expect(page.locator('#solution-lines .exit-wrong')).toHaveCount(5);
  await expect(page.locator('#solution-lines .exit-right')).toHaveAttribute('cx', '5.84');
});

test('flipping back keeps the trail and the ticks', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 1], [0, 2], [0, 3]]);
  await page.click('#flip');
  await page.click('#flip');
  await expect(page.locator('#card')).not.toHaveClass(/\bflipped\b/);
  expect(await trail(page)).toEqual([[0, 0], [0, 1], [0, 2], [0, 3]]);
  await expect(line(page, 'C')).toHaveClass(/\bdone\b/);
  await tapAll(page, [[0, 4]]);
  expect((await trail(page)).at(-1)).toEqual([0, 4]);
});

// The dashed paths' steps, each [from, to], read back from their path.
async function dashed(page) {
  const d = await page.locator('#collected').getAttribute('d');
  return d.split('M').filter(Boolean).map(s => s.split('L').map(p => p.split(',').map(n => Number(n) - 0.5).reverse()));
}

const TO_KEY = [[[0, 0], [1, 0]], [[1, 0], [2, 0]], [[2, 0], [2, 1]]];

test('picking up Key 1 down a side branch and walking back out, a dashed line runs from the start to it, and my solid trail on to where I am', async ({ page }) => {
  await open(page);
  await tapAll(page, [[1, 0], [2, 0], [2, 1], [2, 0], [3, 0]]);
  expect(await trail(page)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
  expect(await dashed(page)).toEqual([[[2, 0], [2, 1]]]);
  await tapAll(page, [[0, 0]]);
  expect(await dashed(page)).toEqual(TO_KEY);
  const path = page.locator('#collected');
  await expect(path).toHaveAttribute('stroke-dasharray', '0.1 0.4');
  await expect(path).toHaveAttribute('stroke-dashoffset', '0.05');
  await expect(path).toHaveCSS('stroke-linecap', 'round');
  await expect(path).toHaveCSS('stroke', 'rgb(31, 111, 92)');
  await expect(path).toBeVisible();
});

test('with several things found, every corridor on the way to any of them is dashed once, a cell a step, so the dashes keep in step', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5], [0, 5], [0, 0], [1, 0], [2, 0], [2, 1], [0, 0]]);
  const steps = await dashed(page);
  expect(steps).toEqual([[[0, 0], [0, 1]], [[0, 1], [0, 2]], [[0, 2], [0, 3]], [[0, 3], [0, 4]], [[0, 4], [1, 4]], [[1, 4], [1, 5]],
    [[1, 5], [0, 5]], ...TO_KEY]);
  expect(new Set(steps.map(s => s[1].join(','))).size).toBe(steps.length);
  steps.forEach(([from, to]) => expect(Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1])).toBe(1));
});

test('where my trail runs along a dashed corridor, the solid line covers it: those steps aren\'t dashed, and the trail draws over the rest', async ({ page }) => {
  await open(page);
  await tapAll(page, [[1, 0], [2, 0], [2, 1], [0, 0], [1, 0]]);
  expect(await dashed(page)).toEqual(TO_KEY.slice(1));
  expect(await page.locator('#lines').evaluate(svg => Array.from(svg.children).map(c => c.id))).toEqual(['walls', 'collected', 'trail', 'here', 'key-call']);
});

test('backing out with Back or by tapping an earlier cell, the dashes to everything I found stay', async ({ page }) => {
  await open(page);
  await tapAll(page, [[1, 0], [2, 0], [2, 1]]);
  expect(await dashed(page)).toEqual([]);
  await pad(page, 'back').click();
  expect(await dashed(page)).toEqual(TO_KEY.slice(2));
  await tapAll(page, [[0, 0]]);
  expect(await dashed(page)).toEqual(TO_KEY);
});

test('a dead end I walked into and found nothing in is not dashed', async ({ page }) => {
  await open(page);
  await tapAll(page, [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [0, 0]]);
  expect(await dashed(page)).toEqual([]);
  await tapAll(page, [[1, 0], [2, 0], [2, 1], [1, 1], [0, 0]]);
  expect(await dashed(page)).toEqual(TO_KEY);
});

test('flipped to the solution, the solution shows alone, without the dashes, as it does without the trail', async ({ page }) => {
  await open(page);
  await tapAll(page, [[1, 0], [2, 0], [2, 1], [0, 0]]);
  await page.click('#flip');
  await expect(page.locator('#card')).toHaveClass(/\bflipped\b/);
  await expect(page.locator('#back .collected, #back .trail')).toHaveCount(0);
});

test('Plain: a collectible is a dot and a block a solid tile, with no character', async ({ page }) => {
  await open(page);
  const collectible = stop(page, 'collectible-1');
  await expect(collectible).toHaveCSS('background-color', 'rgb(232, 163, 23)');
  await expect(collectible).toHaveCSS('background-image', 'none');
  await expect(page.locator('#marks .block')).toHaveCSS('background-image', 'none');
});

test('Themed: collectibles and blocks show the puzzle\'s theme character', async ({ page }) => {
  await open(page, { look: 'themed' });
  const figure = /content\/characters\/[a-z]+\.webp/;
  await expect(stop(page, 'collectible-1')).toHaveCSS('background-image', figure);
  await expect(page.locator('#marks .block')).toHaveCSS('background-image', figure);
  await expect(stop(page, 'key-1')).toHaveCSS('background-image', 'none');
});

test('a real-size maze\'s grid card and the checklist above it fit the window\'s height together, the card taking the rest', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await open(page, { id: 'MAZE-0002' });
    await expect(page.locator('#grid .maze-cell')).toHaveCount(32 * 40);
    const card = await page.locator('#front').boundingBox(), list = await page.locator('#checklist-card').boundingBox();
    expect(list.y + list.height).toBeLessThan(card.y);
    expect(card.y + card.height - list.y).toBeLessThanOrEqual(viewport.height);
    expect(card.y + card.height - list.y).toBeGreaterThan(viewport.height * 0.8);
    await expect(page.locator('#checklist .line-text')).toHaveText(['Guides', 'End']);
  }
});

test('the real-size maze can be walked by tapping', async ({ page }) => {
  await open(page, { id: 'MAZE-0002' });
  const start = [BIG.start.row, BIG.start.col];
  const sides = { N: [-1, 0, 1], E: [0, 1, 2], S: [1, 0, 4], W: [0, -1, 8] };
  const side = Object.values(sides).find(([dr, dc, bit]) => !(parseInt(BIG.walls[start[0]][start[1]], 16) & bit) && start[0] + dr >= 0 && start[1] + dc >= 0);
  const next = [start[0] + side[0], start[1] + side[1]];
  await cell(page, next[0], next[1], 32).click();
  expect(await trail(page)).toEqual([start, next]);
});

test('a hidden ID with no maze says so', async ({ page }) => {
  await page.route('**/content/puzzles/maze/MAZE-0999.json', route => route.fulfill({ status: 404 }));
  await page.goto('/app/maze.html?id=MAZE-0999');
  await expect(page.locator('#missing')).toBeVisible();
  await expect(page.locator('#title')).toHaveText('Puzzle not found');
  await expect(page.locator('#play')).toBeHidden();
});

for (const query of ['', '?id=', '?id=WSCH-0007', '?id=../MAZE-0001']) {
  test(`an address that names no maze says so, fetching nothing (${query || 'no query'})`, async ({ page }) => {
    const fetched = [];
    await page.route('**/content/puzzles/**', route => { fetched.push(route.request().url()); return route.abort(); });
    await page.goto('/app/maze.html' + query);
    await expect(page.locator('#missing')).toBeVisible();
    // Only the side bar's indexes, never a maze file.
    expect(fetched.filter(url => !/\/content\/puzzles\/\w+\/index\.json$/.test(url))).toEqual([]);
  });
}

// ---- The control pad, the view and the little map (TASK-101) ----

const pad = (page, press) => page.locator(`#pad [data-press="${press}"]`);
const at = (page, r, c) => page.locator(`#grid [data-cell="${r},${c}"]`);
const cellSize = page => page.locator('#play').evaluate(p => p.style.getPropertyValue('--cell'));
// Where the player's dot sits, against the middle of the frame, px.
async function offCentre(page) {
  const view = await page.locator('#view').boundingBox();
  const here = await page.locator('#here').boundingBox();
  return [here.x + here.width / 2 - (view.x + view.width / 2), here.y + here.height / 2 - (view.y + view.height / 2)];
}

test('every maze shows the control pad: up, down, left, right and Back', async ({ page }) => {
  for (const id of ['MAZE-0001', 'MAZE-0002', 'MAZE-0003']) {
    await open(page, { id });
    for (const press of ['N', 'S', 'W', 'E', 'back']) await expect(pad(page, press)).toBeVisible();
    await expect(pad(page, 'back')).toHaveAttribute('aria-label', 'Back');
  }
});

test('pressing right runs the trail along the corridor and stops at the next junction', async ({ page }) => {
  await open(page);
  await pad(page, 'E').click();
  expect(await trail(page)).toEqual([[0, 0], [0, 1], [0, 2]]);
});

test('a run follows the corridor round its bends', async ({ page }) => {
  await open(page);
  await pad(page, 'E').click();
  await pad(page, 'E').click();
  await pad(page, 'E').click();
  expect((await trail(page)).slice(3)).toEqual([[0, 3], [0, 4], [1, 4]]);
});

test('a run stops on anything on the checklist, picks it up and ticks it', async ({ page }) => {
  await open(page);
  await pad(page, 'E').click();
  await pad(page, 'E').click();
  expect((await trail(page)).at(-1)).toEqual([0, 3]);
  await expect(stop(page, 'letter-C')).toHaveClass(/\bgot\b/);
  await expect(line(page, 'C')).toHaveClass(/\bdone\b/);
});

test('a way with a wall is greyed out and does nothing, and so is Back before any move', async ({ page }) => {
  await open(page);
  for (const press of ['N', 'W', 'back']) await expect(pad(page, press)).toBeDisabled();
  for (const press of ['E', 'S']) await expect(pad(page, press)).toBeEnabled();
  await page.keyboard.press('ArrowUp');
  expect(await trail(page)).toEqual([[0, 0]]);
});

test('Back goes back one run, the way I came does the same, ticks stay ticked, and the branch left leaves no trace', async ({ page }) => {
  await open(page);
  await pad(page, 'E').click();
  await pad(page, 'E').click();
  await pad(page, 'back').click();
  expect(await trail(page)).toEqual([[0, 0], [0, 1], [0, 2]]);
  await expect(line(page, 'C')).toHaveClass(/\bdone\b/);
  await expect(stop(page, 'letter-C')).toHaveClass(/\bgot\b/);
  await pad(page, 'W').click();
  expect(await trail(page)).toEqual([[0, 0]]);
  await expect(page.locator('#trail')).toHaveAttribute('points', '0.5,0.5');
  await expect(line(page, 'C')).toHaveClass(/\bdone\b/);
});

test('a run into a zone whose key I don\'t hold stops at its edge, the zone flashing and its key\'s number beside the trail\'s end', async ({ page }) => {
  await open(page);
  await pad(page, 'E').click();
  await pad(page, 'S').click();
  expect(await trail(page)).toEqual([[0, 0], [0, 1], [0, 2]]);
  await expect(page.locator('#marks .zone[data-key="1"]')).toHaveClass(/\bflash\b/);
  const call = page.locator('#key-call');
  await expect(call).toHaveText('1');
  await expect(call).toHaveClass(/\bflash\b/);
  expect([await call.getAttribute('x'), await call.getAttribute('y')]).toEqual(['2.8', '0.28']);
});

test('on a keyboard, the arrow keys and Backspace do what the pad does — and rest while the solution shows', async ({ page }) => {
  await open(page);
  await page.keyboard.press('ArrowRight');
  expect(await trail(page)).toEqual([[0, 0], [0, 1], [0, 2]]);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#marks .zone[data-key="1"]')).toHaveClass(/\bflash\b/);
  await page.keyboard.press('Backspace');
  expect(await trail(page)).toEqual([[0, 0]]);
  await page.keyboard.press('ArrowDown');
  expect(await trail(page)).toEqual([[0, 0], [1, 0], [2, 0]]);
  await page.click('#flip');
  await page.keyboard.press('Backspace');
  await page.click('#flip');
  expect(await trail(page)).toEqual([[0, 0], [1, 0], [2, 0]]);
});

test('Back pressed ten times quickly goes back ten runs, with no lag', async ({ page }) => {
  await open(page, { id: 'MAZE-0003' });
  // Ten runs along the main path, the one route from the start to the end, so none dead-ends:
  // the saved walk with every step back the way it came undone.
  const step = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
  const main = HUNDRED.solution.split('').reduce((path, side) => {
    const here = path.at(-1), next = [here[0] + step[side][0], here[1] + step[side][1]];
    const back = path.length > 1 && path.at(-2)[0] === next[0] && path.at(-2)[1] === next[1];
    return back ? path.slice(0, -1) : path.concat([next]);
  }, [[0, 0]]);
  const ends = [];
  for (let i = 0; i < 10; i++) {
    const here = (await trail(page)).at(-1);
    const next = main[main.findIndex(c => c[0] === here[0] && c[1] === here[1]) + 1];
    const way = Object.keys(step).find(w => here[0] + step[w][0] === next[0] && here[1] + step[w][1] === next[1]);
    await page.keyboard.press({ N: 'ArrowUp', E: 'ArrowRight', S: 'ArrowDown', W: 'ArrowLeft' }[way]);
    ends.push((await trail(page)).length);
  }
  expect(new Set(ends).size).toBe(10);
  const ms = await page.evaluate(() => {
    const begun = performance.now();
    for (let i = 0; i < 10; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    return performance.now() - begun;
  });
  expect(await trail(page)).toEqual([[0, 0]]);
  expect(ms).toBeLessThan(250);
});

test('a press cuts short any run still drawing: the next draws only its own steps', async ({ page }) => {
  await open(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  expect(await trail(page)).toEqual([[0, 0], [1, 0], [2, 0], [2, 1]]);
  expect(await page.locator('#lines').evaluate(l => l.style.getPropertyValue('--from'))).toBe('1');
  await expect(page.locator('#trail')).toHaveAttribute('stroke-dasharray', '3 3');
  await page.keyboard.press('Backspace');
  expect(await page.locator('#lines').evaluate(l => l.style.getPropertyValue('--from'))).toBe('0');
});

test('the view keeps the end of my trail in the centre of the maze card as I move', async ({ page }) => {
  await open(page, { id: 'MAZE-0003', maze: MIDDLE });
  expect((await offCentre(page)).map(Math.round)).toEqual([0, 0]);
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(400);
    const [x, y] = await offCentre(page);
    expect(Math.abs(x)).toBeLessThan(2);
    expect(Math.abs(y)).toBeLessThan(2);
  }
});

test('a 100×100 maze opens zoomed in on the start; + and − zoom in and out, from the whole maze to its closest', async ({ page }) => {
  await open(page, { id: 'MAZE-0003' });
  await expect(page.locator('#play')).toHaveAttribute('data-zoomed', 'true');
  expect(await cellSize(page)).toBe('20px');
  await expect(at(page, 0, 0)).toHaveClass(/\bstart\b/);
  await page.click('#zoom-in');
  expect(await cellSize(page)).toBe('25px');
  for (let i = 0; i < 3; i++) await page.click('#zoom-in');
  expect(await cellSize(page)).toBe('48px');
  await expect(page.locator('#zoom-in')).toBeDisabled();
  while (await page.locator('#zoom-out').isEnabled()) await page.click('#zoom-out');
  await expect(page.locator('#play')).toHaveAttribute('data-zoomed', 'false');
  const frame = await page.locator('#view').boundingBox();
  expect(parseFloat(await cellSize(page)) * 100).toBeCloseTo(frame.width, 0);
});

test('a small maze shows whole and has no zoom', async ({ page }) => {
  await open(page);
  await expect(page.locator('#zoom-in')).toBeHidden();
  await expect(page.locator('#zoom-out')).toBeHidden();
  await expect(page.locator('#minimap')).toBeHidden();
});

test('a pinch on the maze zooms it', async ({ page }) => {
  await open(page, { id: 'MAZE-0003', maze: MIDDLE });
  await page.locator('#view').evaluate(view => {
    const box = view.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    const touch = (type, id, dx) => view.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x + dx, clientY: y, bubbles: true, pointerType: 'touch' }));
    touch('pointerdown', 1, -20);
    touch('pointerdown', 2, 20);
    touch('pointermove', 1, -30);
    touch('pointermove', 2, 30);
    touch('pointerup', 1, -30);
    touch('pointerup', 2, 30);
  });
  expect(await cellSize(page)).toBe('30px');
});

test('the zoom is only ever mine: moves, taps and pickups never zoom, nor do finishing the maze or flipping to the solution', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 450 });
  await open(page, { id: 'MAZE-0002' });
  await page.click('#zoom-in');
  const zoom = await cellSize(page);
  expect(zoom).toBe('25px');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Backspace');
  const step = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
  let here = [BIG.start.row, BIG.start.col];
  for (const side of BIG.solution) {
    here = [here[0] + step[side][0], here[1] + step[side][1]];
    // A tap on the cell itself, wherever the little map sits.
    await at(page, here[0], here[1]).dispatchEvent('click');
  }
  await expect(page.locator('#complete')).toBeVisible();
  expect(await cellSize(page)).toBe(zoom);
  await page.click('#flip');
  expect(await cellSize(page)).toBe(zoom);
  await page.click('#flip');
  expect(await cellSize(page)).toBe(zoom);
});

// ---- The little map beside the control pad (TASK-125) ----

const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('zoomed in, the little map shows the whole maze above the control pad, the two in one column, off the maze, every collectible on it; dragging its box looks round, and my next move brings the view back', async ({ page }) => {
  await open(page, { id: 'MAZE-0003', maze: MIDDLE });
  const map = page.locator('#minimap');
  await expect(map).toBeVisible();
  const card = await page.locator('#stage').boundingBox(), box = await map.boundingBox(), padBox = await page.locator('#pad').boundingBox();
  expect(overlaps(box, card)).toBe(false);
  expect(box.y + box.height).toBeLessThanOrEqual(padBox.y);
  expect(Math.abs(box.x + box.width / 2 - (padBox.x + padBox.width / 2))).toBeLessThan(2);
  const ink = await map.evaluate((canvas, c) => {
    const scale = canvas.width / 100;
    return Array.from(canvas.getContext('2d').getImageData(Math.floor((c.col + 0.5) * scale), Math.floor((c.row + 0.5) * scale), 1, 1).data.slice(0, 3));
  }, HUNDRED.collectibles[0]);
  expect(ink[0]).toBeGreaterThan(200);
  expect(ink[2]).toBeLessThan(100);
  const before = await page.locator('#world').evaluate(w => w.style.transform);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + 20, { steps: 4 });
  await page.mouse.up();
  expect(await page.locator('#world').evaluate(w => w.style.transform)).not.toBe(before);
  expect(Math.abs((await offCentre(page))[0])).toBeGreaterThan(50);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(400);
  expect(Math.abs((await offCentre(page))[0])).toBeLessThan(2);
});

for (const width of [390, 360]) {
  test(`on a phone ${width}px wide, the pad sits on the right half of the row under the maze, and zoomed in the little map on its left half, every key a comfortable tap`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page, { id: 'MAZE-0003', maze: MIDDLE });
    const map = page.locator('#minimap');
    await expect(map).toBeVisible();
    const row = await page.locator('#controls').boundingBox(), card = await page.locator('#stage').boundingBox();
    const box = await map.boundingBox(), padBox = await page.locator('#pad').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(row.x);
    expect(box.x + box.width).toBeLessThanOrEqual(row.x + row.width / 2);
    expect(padBox.x).toBeGreaterThanOrEqual(row.x + row.width / 2);
    expect(padBox.x + padBox.width).toBeLessThanOrEqual(Math.min(row.x + row.width, width));
    expect(overlaps(box, padBox)).toBe(false);
    expect(box.y < padBox.y + padBox.height && padBox.y < box.y + box.height).toBe(true);
    expect(overlaps(box, card)).toBe(false);
    expect(padBox.y).toBeGreaterThanOrEqual(card.y + card.height);
    for (const press of ['N', 'S', 'W', 'E', 'back']) {
      const key = await pad(page, press).boundingBox();
      expect(Math.min(key.width, key.height)).toBeGreaterThanOrEqual(44);
    }
  });
}

for (const [where, size] of [['on desktop', { width: 1280, height: 720 }], ['on a phone', { width: 390, height: 844 }]]) {
  test(`${where}, zooming out to the whole maze hides the little map and the pad stays exactly where it was`, async ({ page }) => {
    await page.setViewportSize(size);
    await open(page, { id: 'MAZE-0003', maze: MIDDLE });
    await expect(page.locator('#minimap')).toBeVisible();
    const before = await page.locator('#pad').boundingBox();
    while (await page.locator('#zoom-out').isEnabled()) await page.click('#zoom-out');
    await expect(page.locator('#play')).toHaveAttribute('data-zoomed', 'false');
    await expect(page.locator('#minimap')).toBeHidden();
    expect(await page.locator('#pad').boundingBox()).toEqual(before);
    await page.click('#zoom-in');
    await expect(page.locator('#minimap')).toBeVisible();
    expect(await page.locator('#pad').boundingBox()).toEqual(before);
  });
}

test('on desktop the checklist sits above the maze, and the controls beside it', async ({ page }) => {
  await open(page, { id: 'MAZE-0003', maze: MIDDLE });
  const list = await page.locator('#checklist-card').boundingBox(), card = await page.locator('#stage').boundingBox();
  const controls = await page.locator('#controls').boundingBox();
  expect(list.y + list.height).toBeLessThan(card.y);
  expect(Math.abs(list.x - card.x)).toBeLessThan(2);
  expect(controls.x).toBeGreaterThan(card.x + card.width);
  expect(controls.y).toBeGreaterThanOrEqual(card.y - 1);
});

test('on a phone the checklist sits under the controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, { id: 'MAZE-0003', maze: MIDDLE });
  const list = await page.locator('#checklist-card').boundingBox(), controls = await page.locator('#controls').boundingBox();
  expect(list.y).toBeGreaterThanOrEqual(controls.y + controls.height);
});

const mapSize = (page, size) => page.locator(`[data-map-size="${size}"]`);

test('the little map comes Small, Medium or Large, Small to start, each bigger than the last, its box still dragged to look round', async ({ page }) => {
  await open(page, { id: 'MAZE-0003', maze: MIDDLE });
  const map = page.locator('#minimap');
  await expect(mapSize(page, 'small')).toHaveAttribute('aria-pressed', 'true');
  const widths = [];
  for (const size of ['small', 'medium', 'large']) {
    await mapSize(page, size).click();
    await expect(mapSize(page, size)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-map-size][aria-pressed="true"]')).toHaveCount(1);
    widths.push(Math.round(await map.evaluate(c => c.getBoundingClientRect().width)));
  }
  expect(widths).toEqual([122, 178, 234]);
  const box = await map.boundingBox(), card = await page.locator('#stage').boundingBox();
  expect(overlaps(box, card)).toBe(false);
  const before = await page.locator('#world').evaluate(w => w.style.transform);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + 20, { steps: 4 });
  await page.mouse.up();
  expect(await page.locator('#world').evaluate(w => w.style.transform)).not.toBe(before);
});

test('on a phone, a Large map stays in its half of the row, and the pad and the maze stay on screen together', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page, { id: 'MAZE-0003', maze: MIDDLE });
  await mapSize(page, 'large').click();
  const row = await page.locator('#controls').boundingBox(), box = await page.locator('#map-box').boundingBox();
  const padBox = await page.locator('#pad').boundingBox(), card = await page.locator('#front').boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(row.x + row.width / 2);
  expect(padBox.x).toBeGreaterThanOrEqual(row.x + row.width / 2);
  expect(row.y + row.height - card.y).toBeLessThanOrEqual(780);
  for (const size of ['small', 'medium', 'large']) {
    const button = await mapSize(page, size).boundingBox();
    expect(Math.min(button.width, button.height)).toBeGreaterThanOrEqual(44);
  }
});

test('the map\'s sizes hide with it when I zoom out to the whole maze', async ({ page }) => {
  await open(page, { id: 'MAZE-0003', maze: MIDDLE });
  await expect(mapSize(page, 'large')).toBeVisible();
  while (await page.locator('#zoom-out').isEnabled()) await page.click('#zoom-out');
  await expect(mapSize(page, 'large')).toBeHidden();
});

test('off the card, the little map hides while the solution shows, and comes back with the maze', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 450 });
  await open(page, { id: 'MAZE-0002' });
  await page.click('#zoom-in');
  const map = page.locator('#minimap');
  await expect(map).toBeVisible();
  await page.click('#flip');
  await expect(map).toBeHidden();
  await page.click('#flip');
  await expect(map).toBeVisible();
});

test('the little map shows the dashed paths too', async ({ page }) => {
  await open(page, { id: 'MAZE-0003', maze: MIDDLE });
  // The route from the start to the collectible nearest it, by the page's own rules.
  const route = await page.evaluate(async maze => {
    const core = await import('/core/maze/play-core.js');
    const board = core.mazeBoard(maze);
    return board.stops.filter(s => s.kind === 'collectible')
      .map(s => core.resumedMaze(board, s.cell, []).trail)
      .sort((a, b) => a.length - b.length)[0];
  }, MIDDLE);
  const middle = route[Math.floor(route.length / 2)];
  const map = page.locator('#minimap');
  const inkAt = () => map.evaluate((canvas, c) => {
    const scale = canvas.width / 100, x = Math.floor((c[1] + 0.5) * scale), y = Math.floor((c[0] + 0.5) * scale);
    return Array.from(canvas.getContext('2d').getImageData(x - 1, y - 1, 3, 3).data);
  }, middle);
  const before = await inkAt();
  // Walked there a tap a cell, then all the way back with Backspace.
  await page.evaluate(cells => {
    cells.forEach(([r, c]) => document.querySelector(`#grid [data-cell="${r},${c}"]`).click());
    cells.forEach(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' })));
  }, route.slice(1));
  expect(await trail(page)).toEqual([[50, 50]]);
  expect(await dashed(page)).toHaveLength(route.length - 1);
  const after = await inkAt();
  expect(after.reduce((sum, v, i) => sum + Math.abs(v - before[i]), 0)).toBeGreaterThan(30);
});

test('a maze that isn\'t 32×40 has no Print button', async ({ page }) => {
  await open(page, { id: 'MAZE-0003' });
  await expect(page.locator('[data-menu-entry]')).toHaveCount(0);
  await expect(page.locator('#print')).toHaveCount(0);
});

test('on a phone, a 100×100 maze plays with the pad on screen under it, drawing only the cells round the view, and moves without lag', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, { id: 'MAZE-0003', maze: MIDDLE });
  const card = await page.locator('#front').boundingBox(), down = await pad(page, 'S').boundingBox();
  expect(card.x + card.width).toBeLessThanOrEqual(390);
  expect(down.y + down.height - card.y).toBeLessThanOrEqual(844);
  expect(await page.locator('#grid .maze-cell').count()).toBeLessThan(1500);
  const ms = await page.evaluate(() => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'], begun = performance.now();
    for (let i = 0; i < 20; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: keys[i % 4] }));
    return performance.now() - begun;
  });
  expect(ms).toBeLessThan(500);
  expect(await page.locator('#grid .maze-cell').count()).toBeLessThan(1500);
});
