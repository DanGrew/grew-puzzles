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

  test('its type sits in the filters under its difficulty', async ({ page }) => {
    await page.goto('/app/?kind=maze');
    await page.click('#filter-button');
    await expect(page.locator('.types[data-tone="Extreme"] .chip')).toHaveText(['Keylecticodes']);
  });

  test('tapping it opens its maze play page: the maze in the grid card, the checklist beside it', async ({ page }) => {
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

test('zoomed in, the little map shows the whole maze in the card\'s corner, every collectible on it; dragging its box looks round, and my next move brings the view back', async ({ page }) => {
  await open(page, { id: 'MAZE-0003', maze: MIDDLE });
  const map = page.locator('#minimap');
  await expect(map).toBeVisible();
  const frame = await page.locator('#view').boundingBox(), box = await map.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
  expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height);
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
