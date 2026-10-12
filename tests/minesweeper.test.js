const { test, expect } = require('@playwright/test');
// The site publishes no minesweeper board yet: the fixtures are served as MINE-0001 — a 10×10 Easy
// board of 15 mines — and MINE-0002, a 40×40 Hard one, too big to tap whole on any screen. Both are
// made by tooling's generator and pass its minesweeper checks.
const BOARD = require('./fixtures/MINE-0001.json');
const BIG = require('./fixtures/MINE-0002.json');

async function open(page, id) {
  await page.route('**/content/puzzles/minesweeper/MINE-0001.json', route => route.fulfill({ json: BOARD }));
  await page.route('**/content/puzzles/minesweeper/MINE-0002.json', route => route.fulfill({ json: BIG }));
  await page.goto('/app/minesweeper.html?id=' + (id || 'MINE-0001'));
  await expect(page.locator('#play')).toBeVisible();
}

// The square size the board is zoomed to.
const cellSize = page => page.locator('#play').evaluate(el => el.style.getPropertyValue('--cell'));
const square = (page, r, c, cols = 10) => page.locator('#grid .mines-square').nth(r * cols + c);
const mines = BOARD.mines.map(m => [m.row, m.col]);

async function tapAll(page, cells) {
  for (const [r, c] of cells) await square(page, r, c).click();
}

test.describe('a minesweeper board', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  test('opens with its title, its difficulty and code, the Vanilla band, and the Mines card at 0/15 with the rule', async ({ page }) => {
    await expect(page.locator('#title')).toHaveText('Garden Patch');
    await expect(page).toHaveTitle('Garden Patch · Grew Puzzles');
    await expect(page.locator('#ident')).toHaveText('Easy · MINE-0001');
    await expect(page.locator('#difficulty')).toHaveAttribute('data-tone', 'Easy');
    await expect(page.locator('#label')).toHaveText('Vanilla');
    await expect(page.locator('#mines-card h2')).toHaveText('Mines');
    await expect(page.locator('#count')).toHaveText('0/15');
    await expect(page.locator('.mines-rule')).toHaveText(
      'Find every mine. Each number counts the mines in the eight squares around it. A numbered square is never a mine.');
    await expect(page.locator('#grid .mines-square')).toHaveCount(100);
    await expect(square(page, 0, 2)).toHaveText('1');
    await expect(square(page, 0, 8)).toHaveText('0');
    await expect(square(page, 0, 0)).toHaveText('');
    await expect(page.locator('#complete')).toBeHidden();
  });

  test('the Mines card sits beside the grid card', async ({ page }) => {
    const card = await page.locator('#stage').boundingBox();
    const side = await page.locator('#mines-card').boundingBox();
    expect(side.x).toBeGreaterThan(card.x + card.width);
  });

  test('a blank square cycles dot, mine, blank — and only a mine counts', async ({ page }) => {
    const s = square(page, 0, 0);
    await s.click();
    await expect(s).toHaveAttribute('data-mark', 'dot');
    await expect(s).toHaveAttribute('aria-label', 'Row 1, column 1, no mine');
    await expect(page.locator('#count')).toHaveText('0/15');
    await s.click();
    await expect(s).toHaveAttribute('data-mark', 'mine');
    await expect(s).toHaveAttribute('aria-label', 'Row 1, column 1, mine');
    await expect(page.locator('#count')).toHaveText('1/15');
    await s.click();
    await expect(s).toHaveAttribute('data-mark', 'blank');
    await expect(page.locator('#count')).toHaveText('0/15');
  });

  test('a key marks a square as a tap does', async ({ page }) => {
    await square(page, 0, 0).focus();
    await page.keyboard.press('Enter');
    await expect(square(page, 0, 0)).toHaveAttribute('data-mark', 'dot');
  });

  test('a number whose mines are all marked fills its blank squares with dots', async ({ page }) => {
    await square(page, 0, 8).click();
    for (const [r, c] of [[0, 9], [1, 7], [1, 8], [1, 9]]) await expect(square(page, r, c)).toHaveAttribute('data-mark', 'dot');
    await expect(square(page, 0, 4)).toHaveAttribute('data-mark', 'blank');
  });

  test('a number whose missing mines exactly fill its blank squares fills them with mines; otherwise it does nothing', async ({ page }) => {
    await square(page, 9, 8).click();
    for (const [r, c] of [[8, 8], [8, 9], [9, 7]]) await expect(square(page, r, c)).toHaveAttribute('data-mark', 'blank');
    await square(page, 9, 9).click();
    await expect(square(page, 8, 8)).toHaveAttribute('data-mark', 'dot');
    await expect(square(page, 8, 9)).toHaveAttribute('data-mark', 'dot');
    await square(page, 9, 8).click();
    await expect(square(page, 9, 7)).toHaveAttribute('data-mark', 'mine');
    await expect(page.locator('#count')).toHaveText('1/15');
  });

  test('a number fades once its mines are marked, and turns red with too many', async ({ page }) => {
    const one = square(page, 9, 8);
    await expect(one).toHaveAttribute('data-state', '');
    const ink = await one.evaluate(el => getComputedStyle(el).color);
    await tapAll(page, [[9, 7], [9, 7]]);
    await expect(one).toHaveAttribute('data-state', 'met');
    await expect.poll(() => one.evaluate(el => getComputedStyle(el).color)).not.toBe(ink);
    await tapAll(page, [[8, 8], [8, 8]]);
    await expect(one).toHaveAttribute('data-state', 'over');
    await expect.poll(() => one.evaluate(el => getComputedStyle(el).color)).toBe('rgb(224, 71, 59)');
  });

  test('marking exactly the board\'s mines pops and sparkles it, and says so — dots don\'t matter', async ({ page }) => {
    await square(page, 0, 0).click();
    await tapAll(page, mines.slice(1).flatMap(m => [m, m]));
    await expect(page.locator('#complete')).toBeHidden();
    await tapAll(page, [mines[0], mines[0]]);
    await expect(page.locator('#count')).toHaveText('15/15');
    await expect(page.locator('#complete')).toBeVisible();
    await expect(page.locator('#complete')).toHaveText('Solved — every mine found');
    await expect(page.locator('#board')).toHaveClass(/pop/);
    expect(await page.locator('#board .spark').count()).toBeGreaterThan(0);
    // Solved, the board takes no more taps.
    await square(page, 0, 1).click();
    await expect(square(page, 0, 1)).toHaveAttribute('data-mark', 'blank');
  });

  test('a mine in the wrong place is never pointed out, and the board isn\'t solved', async ({ page }) => {
    await tapAll(page, mines.slice(1).flatMap(m => [m, m]));
    await tapAll(page, [[0, 0], [0, 0]]);
    await expect(page.locator('#count')).toHaveText('15/15');
    await expect(page.locator('#complete')).toBeHidden();
    await expect(square(page, 0, 0)).toHaveAttribute('data-mark', 'mine');
  });

  test('the corner button flips to the answer with every mine shown, and back with the marks intact', async ({ page }) => {
    await tapAll(page, [[0, 0], [0, 1], [0, 1]]);
    await page.click('#flip');
    await expect(page.locator('#card')).toHaveClass(/flipped/);
    await expect(page.locator('#flip')).toHaveAttribute('aria-label', 'Back to puzzle');
    await expect(page.locator('#solution-label')).toHaveText('Vanilla · Solution');
    await expect(page.locator('#solution-grid [data-mark="mine"]')).toHaveCount(15);
    for (const [r, c] of mines) {
      await expect(page.locator('#solution-grid .mines-square').nth(r * 10 + c)).toHaveAttribute('data-mark', 'mine');
    }
    await expect(page.locator('#solution-grid .mines-square').nth(2)).toHaveText('1');
    await page.click('#flip');
    await expect(page.locator('#card')).not.toHaveClass(/flipped/);
    await expect(square(page, 0, 0)).toHaveAttribute('data-mark', 'dot');
    await expect(square(page, 0, 1)).toHaveAttribute('data-mark', 'mine');
  });

  test('a board that fits whole never zooms', async ({ page }) => {
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'false');
    await expect(page.locator('#zoom-in')).toBeHidden();
    await expect(page.locator('#zoom-out')).toBeHidden();
  });
});

test('an address naming no board says so', async ({ page }) => {
  await page.goto('/app/minesweeper.html?id=../maze/MAZE-0001');
  await expect(page.locator('#title')).toHaveText('Puzzle not found');
  await expect(page.locator('#missing')).toBeVisible();
  await expect(page.locator('#play')).toBeHidden();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('a 10×10 board fits the width, every square tappable without zooming', async ({ page }) => {
    await open(page);
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'false');
    const frame = await page.locator('#view').boundingBox();
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.width).toBeLessThanOrEqual(375);
    const size = await square(page, 9, 9).boundingBox();
    expect(size.width).toBeGreaterThanOrEqual(24);
    expect(size.x + size.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth)).toBeLessThanOrEqual(375);
    await square(page, 9, 0).tap();
    await expect(square(page, 9, 0)).toHaveAttribute('data-mark', 'dot');
  });

  test('the Mines card sits under the grid card', async ({ page }) => {
    await open(page);
    const card = await page.locator('#stage').boundingBox();
    const side = await page.locator('#mines-card').boundingBox();
    expect(side.y).toBeGreaterThan(card.y + card.height);
  });

  test('a board too big for the screen opens zoomed in, and taps still mark', async ({ page }) => {
    await open(page, 'MINE-0002');
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'true');
    await expect.poll(() => cellSize(page)).toBe('36px');
    const middle = square(page, 20, 20, 40);
    await middle.tap();
    await expect(middle).toHaveAttribute('data-mark', 'dot');
  });
});

test.describe('a board too big for the screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('opens zoomed in on its middle, and zooms out to the whole board and back in to 48px', async ({ page }) => {
    await open(page, 'MINE-0002');
    await expect(page.locator('#title')).toHaveText('Big Field');
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'true');
    await expect.poll(() => cellSize(page)).toBe('36px');
    await expect(page.locator('#zoom-in')).toBeVisible();
    const frame = await page.locator('#view').boundingBox();
    const middle = await square(page, 20, 20, 40).boundingBox();
    expect(Math.abs(middle.x + middle.width / 2 - (frame.x + frame.width / 2))).toBeLessThan(36);
    while (await page.locator('#zoom-out').isEnabled()) await page.click('#zoom-out');
    await expect(page.locator('#zoom-out')).toBeDisabled();
    const whole = await page.locator('#world').boundingBox();
    expect(Math.round(whole.width)).toBe(Math.round(frame.width));
    while (await page.locator('#zoom-in').isEnabled()) await page.click('#zoom-in');
    await expect(page.locator('#zoom-in')).toBeDisabled();
    await expect.poll(() => cellSize(page)).toBe('48px');
  });

  test('Ctrl and the wheel zoom it', async ({ page }) => {
    await open(page, 'MINE-0002');
    const frame = await page.locator('#view').boundingBox();
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    await expect.poll(() => cellSize(page)).not.toBe('36px');
  });

  test('dragging moves round it and marks nothing; a tap still marks', async ({ page }) => {
    await open(page, 'MINE-0002');
    const world = page.locator('#world');
    const before = await world.evaluate(el => el.style.transform);
    const box = await square(page, 20, 20, 40).boundingBox();
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 60, at.y + 40, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => world.evaluate(el => el.style.transform)).not.toBe(before);
    await expect(page.locator('#grid [data-mark="dot"], #grid [data-mark="mine"]')).toHaveCount(0);
    const moved = await square(page, 20, 20, 40).boundingBox();
    expect(Math.round(moved.x - box.x)).toBe(60);
    expect(Math.round(moved.y - box.y)).toBe(40);
    await square(page, 20, 20, 40).click();
    await expect(square(page, 20, 20, 40)).toHaveAttribute('data-mark', 'dot');
  });

  test('the answer side moves with the board', async ({ page }) => {
    await open(page, 'MINE-0002');
    await page.click('#zoom-in');
    const front = await page.locator('#world').evaluate(el => el.style.transform);
    await expect(page.locator('#solution-world')).toHaveAttribute('style', new RegExp(front.replace(/[()]/g, '\\$&')));
  });
});
