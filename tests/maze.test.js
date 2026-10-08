const { test, expect } = require('@playwright/test');
// The site publishes no maze here: the fixtures are served as MAZE-0001 — a 6×6 Keylecticodes with
// every element: a guide, two collectibles, Key 1 and its zone, A, B and C, and six exits, the right
// one CBA — and MAZE-0002, a real-size 32×40 Vanilla of guides. Both pass tooling's maze checks.
const MAZE = require('./fixtures/MAZE-0001.json');
const BIG = require('./fixtures/MAZE-0002.json');
const WORDSEARCH = require('./fixtures/WSCH-0007.json');

// The fixture without its letters and exits: its checklist ends in End.
const NO_LETTERS = { ...MAZE, type: 'Collectibles', letters: [], exits: [] };

async function open(page, { maze, look, id } = {}) {
  await page.addInitScript(l => localStorage.setItem('grew-puzzles.look', l), look || 'plain');
  await page.route('**/content/puzzles/maze/MAZE-0001.json', route => route.fulfill({ json: maze || MAZE }));
  await page.route('**/content/puzzles/maze/MAZE-0002.json', route => route.fulfill({ json: BIG }));
  await page.goto('/app/maze.html?id=' + (id || 'MAZE-0001'));
  await expect(page.locator('#play')).toBeVisible();
}

const cell = (page, r, c, cols = 6) => page.locator('#grid .maze-cell').nth(r * cols + c);
const stop = (page, id) => page.locator(`#grid [data-stop="${id}"]`);
const line = (page, text) => page.locator('#checklist li').filter({ has: page.locator('.line-text', { hasText: new RegExp(`^${text}$`) }) });

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

  test('shows as a tile like any other, its type under its title, in its difficulty\'s colour', async ({ page }) => {
    await page.goto('/app/');
    const tile = page.locator('.tile', { hasText: 'Everything corner' });
    await expect(tile).toBeVisible();
    await expect(tile.locator('.line').first()).toHaveText('Keylecticodes');
    await expect(tile).toHaveAttribute('data-tone', 'Extreme');
    await expect(page.locator('#total')).toHaveText('2 puzzles');
  });

  test('its type sits in the filters under its difficulty', async ({ page }) => {
    await page.goto('/app/');
    await page.click('#filter-button');
    await expect(page.locator('.types[data-tone="Extreme"] .chip')).toHaveText(['Keylecticodes']);
  });

  test('tapping it opens its maze play page: the maze in the grid card, the checklist beside it', async ({ page }) => {
    await page.route('**/content/puzzles/maze/MAZE-0001.json', route => route.fulfill({ json: MAZE }));
    await page.goto('/app/');
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

test('the start is highlighted, the trail sets off from it, and the date sits under the title', async ({ page }) => {
  await open(page);
  await expect(page.locator('#created')).toHaveText('8 Oct 2026');
  await expect(cell(page, 0, 0)).toHaveClass(/\bstart\b/);
  await expect(page.locator('#grid .start')).toHaveCount(1);
  expect(await trail(page)).toEqual([[0, 0]]);
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

test('a guide, a key and a collectible count up on their lines as they\'re picked up', async ({ page }) => {
  await open(page);
  await tapAll(page, [[1, 0], [2, 0], [2, 1]]);
  await expect(line(page, 'Keys')).toContainText('1/1');
  await expect(line(page, 'Keys')).toHaveClass(/\bdone\b/);
  await tapAll(page, [[2, 0], [3, 0], [4, 0], [4, 1]]);
  await expect(line(page, 'Guides')).toContainText('1/1');
  await tapAll(page, [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5], [0, 5]]);
  await expect(line(page, 'Collectibles')).toContainText('1/2');
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
  await expect(line(page, 'Collectibles')).toContainText('1/2');
});

test('the checklist reads Guides, Keys, Collectibles, A, B, C, then the six exits, all unticked', async ({ page }) => {
  await open(page);
  await expect(page.locator('#checklist .line-text')).toHaveText(['Guides', 'Keys', 'Collectibles', 'A', 'B', 'C', 'ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA']);
  await expect(page.locator('#checklist .progress')).toHaveText(['0/1', '0/1', '0/2', '', '', '', '', '', '', '', '', '']);
  await expect(page.locator('#checklist li.done')).toHaveCount(0);
  await expect(page.locator('#count')).toHaveText('0/12');
});

test('each exit is marked when stepped on, at any time: a wrong one ✗, the right one ✓, in the list and in the maze', async ({ page }) => {
  await open(page);
  await tapAll(page, [[0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5]]);
  await expect(line(page, 'ACB')).toHaveClass(/\bdone\b/);
  await expect(line(page, 'ACB').locator('.mark')).toHaveText('✗');
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

test('a real-size maze\'s grid card fits the window\'s height', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await open(page, { id: 'MAZE-0002' });
    await expect(page.locator('#grid .maze-cell')).toHaveCount(32 * 40);
    const card = await page.locator('#front').boundingBox();
    expect(card.height).toBeLessThanOrEqual(viewport.height);
    expect(card.height).toBeGreaterThan(viewport.height * 0.8);
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
    expect(fetched).toEqual([]);
  });
}
