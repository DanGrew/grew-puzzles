const { test, expect } = require('@playwright/test');
// The site publishes no minesweeper board yet: the fixtures are served as MINE-0001 — a 10×10 Easy
// board of 15 mines — and MINE-0002, a 40×40 Hard one, too big to tap whole on any screen. Both are
// made by tooling's generator and pass its minesweeper checks.
const BOARD = require('./fixtures/MINE-0001.json');
const BIG = require('./fixtures/MINE-0002.json');
const MAZE = require('./fixtures/MAZE-0001.json');
const WORDSEARCH = require('./fixtures/WSCH-0007.json');

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

  test('a mine in the wrong place is never pointed out until Check is pressed, and the board isn\'t solved', async ({ page }) => {
    await tapAll(page, mines.slice(1).flatMap(m => [m, m]));
    await tapAll(page, [[0, 0], [0, 0]]);
    await expect(page.locator('#count')).toHaveText('15/15');
    await expect(page.locator('#complete')).toBeHidden();
    await expect(square(page, 0, 0)).toHaveAttribute('data-mark', 'mine');
    await expect(page.locator('#grid [data-checked="wrong"]')).toHaveCount(0);
    await expect(page.locator('#check-line')).toBeHidden();
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

// Check and Undo, under the board. On MINE-0001, (0,3) is a mine and (0,0) isn't; the 0 at (0,8)
// fills (0,9), (1,7), (1,8) and (1,9).
test.describe('Check and Undo', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  const ringed = page => page.locator('#grid [data-checked="wrong"]');
  const line = page => page.locator('#check-line');

  test('a mine marked where there is none is ringed in red, and the line under the board says 1 mistake', async ({ page }) => {
    await tapAll(page, [[0, 0], [0, 0], [5, 0]]);
    await page.click('#check');
    await expect(ringed(page)).toHaveCount(1);
    await expect(square(page, 0, 0)).toHaveAttribute('data-checked', 'wrong');
    await expect.poll(() => square(page, 0, 0).evaluate(el => getComputedStyle(el).outlineColor)).toBe('rgb(224, 71, 59)');
    await expect(line(page)).toBeVisible();
    await expect(line(page)).toHaveText('1 mistake');
    const board = await page.locator('#stage').boundingBox();
    const said = await line(page).boundingBox();
    expect(said.y).toBeGreaterThan(board.y + board.height);
  });

  test('a dot on a square that is really a mine is ringed too', async ({ page }) => {
    await tapAll(page, [[0, 3]]);
    await page.click('#check');
    await expect(square(page, 0, 3)).toHaveAttribute('data-checked', 'wrong');
    await expect(line(page)).toHaveText('1 mistake');
  });

  test('every mark right rings nothing and says No mistakes so far — and a blank square is never ringed', async ({ page }) => {
    await tapAll(page, [[0, 0], [0, 3], [0, 3]]);
    await page.click('#check');
    await expect(line(page)).toHaveText('No mistakes so far');
    await expect(ringed(page)).toHaveCount(0);
    await page.click('#check');
    await expect(ringed(page)).toHaveCount(0);
  });

  test('several mistakes are each ringed and counted', async ({ page }) => {
    // (0,0) and (0,1) marked mines, neither one; a dot on (0,3), a mine; a right dot on (5,0).
    await tapAll(page, [[0, 0], [0, 0], [0, 1], [0, 1], [0, 3], [5, 0]]);
    await page.click('#check');
    await expect(ringed(page)).toHaveCount(3);
    await expect(line(page)).toHaveText('3 mistakes');
    for (const [r, c] of [[0, 0], [0, 1], [0, 3]]) await expect(square(page, r, c)).toHaveAttribute('data-checked', 'wrong');
    await expect(square(page, 5, 0)).toHaveAttribute('data-checked', '');
  });

  test('a tap on any square after a Check takes the rings and the line away', async ({ page }) => {
    await tapAll(page, [[0, 0], [0, 0]]);
    await page.click('#check');
    await expect(ringed(page)).toHaveCount(1);
    await square(page, 9, 9).click();
    await expect(ringed(page)).toHaveCount(0);
    await expect(line(page)).toBeHidden();
  });

  test('Undo is grey until a tap, and takes a square back to how it was', async ({ page }) => {
    await expect(page.locator('#undo')).toBeDisabled();
    await tapAll(page, [[0, 0]]);
    await expect(page.locator('#undo')).toBeEnabled();
    await page.click('#undo');
    await expect(square(page, 0, 0)).toHaveAttribute('data-mark', 'blank');
    await expect(page.locator('#undo')).toBeDisabled();
  });

  test('Undo takes back a number\'s fill all at once', async ({ page }) => {
    await tapAll(page, [[0, 8]]);
    const filled = [[0, 9], [1, 7], [1, 8], [1, 9]];
    for (const [r, c] of filled) await expect(square(page, r, c)).toHaveAttribute('data-mark', 'dot');
    await page.click('#undo');
    for (const [r, c] of filled) await expect(square(page, r, c)).toHaveAttribute('data-mark', 'blank');
    await expect(page.locator('#undo')).toBeDisabled();
  });

  test('pressed again and again, Undo takes back each earlier tap in turn, the count with it, then greys out', async ({ page }) => {
    await tapAll(page, [[0, 0], [0, 3], [0, 3]]);
    await expect(page.locator('#count')).toHaveText('1/15');
    await page.click('#undo');
    await expect(square(page, 0, 3)).toHaveAttribute('data-mark', 'dot');
    await expect(page.locator('#count')).toHaveText('0/15');
    await page.click('#undo');
    await expect(square(page, 0, 3)).toHaveAttribute('data-mark', 'blank');
    await expect(square(page, 0, 0)).toHaveAttribute('data-mark', 'dot');
    await page.click('#undo');
    await expect(square(page, 0, 0)).toHaveAttribute('data-mark', 'blank');
    await expect(page.locator('#undo')).toBeDisabled();
  });

  test('Undo takes the Check rings away too', async ({ page }) => {
    await tapAll(page, [[0, 0], [0, 0], [5, 0]]);
    await page.click('#check');
    await page.click('#undo');
    await expect(ringed(page)).toHaveCount(0);
    await expect(line(page)).toBeHidden();
  });

  test('a solved board can\'t be undone, and Check finds nothing', async ({ page }) => {
    await tapAll(page, mines.flatMap(m => [m, m]));
    await expect(page.locator('#complete')).toBeVisible();
    await expect(page.locator('#undo')).toBeDisabled();
    await page.click('#check');
    await expect(line(page)).toHaveText('No mistakes so far');
  });

  test('Undo is gone on reload', async ({ page }) => {
    await tapAll(page, [[0, 0]]);
    await page.reload();
    await expect(page.locator('#play')).toBeVisible();
    await expect(page.locator('#undo')).toBeDisabled();
  });
});

test.describe('Check and Undo, Themed', () => {
  test('a ringed mine wears its character and its own ring inside Check\'s', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('grew-puzzles.look', 'themed'));
    await open(page);
    await tapAll(page, [[0, 0], [0, 0]]);
    await page.click('#check');
    const s = square(page, 0, 0);
    await expect(s).toHaveAttribute('data-checked', 'wrong');
    const look = await s.evaluate(el => ({ outline: getComputedStyle(el).outlineColor, shadow: getComputedStyle(el).boxShadow }));
    expect(look.outline).toBe('rgb(224, 71, 59)');
    expect(look.shadow).toContain('rgb(201, 96, 90)');
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

// ---- The puzzle size (TASK-187) ----
// Minesweeper starts one rung up the shared ladder, so Small is the board as it was and Normal,
// where a first visit starts, one step bigger: 15/22, 1, 27/22, 32/22 and 37/22 of the height it
// fits and of its 44px square limit, Tiny to Huge.

const SIZE_LABELS = ['Tiny', 'Small', 'Normal', 'Large', 'Huge'];
const sizeButton = page => page.locator('#puzzle-size');
const sizeMenu = page => page.locator('#puzzle-size-menu');
const sizeChoices = page => sizeMenu(page).getByRole('menuitemradio');
const ticked = page => sizeChoices(page).evaluateAll(cs => cs.map(c => c.getAttribute('aria-checked')));
const frameWidth = page => page.locator('#play').evaluate(p => parseFloat(p.style.getPropertyValue('--frame-w')));
// The puzzle size already kept on the device, as a player who picked one did.
const keepSize = (page, size) => page.addInitScript(s => localStorage.setItem('grew-puzzles.text-size', s), size);

async function pickSize(page, label) {
  await sizeButton(page).click();
  await sizeChoices(page).filter({ hasText: label }).click();
  await expect(sizeMenu(page)).toBeHidden();
}

test('on a board that zooms, the size button sits on the grid card\'s top edge after − and +, opening Tiny to Huge, each beside a square drawn at its size', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'MINE-0002');
  await expect(page.locator('#zoom-in')).toBeVisible();
  const card = await page.locator('#front').boundingBox(), plus = await page.locator('#zoom-in').boundingBox();
  const size = await sizeButton(page).boundingBox(), flip = await page.locator('#flip').boundingBox();
  expect(size.y).toBeLessThan(card.y);
  expect(Math.abs(size.y - plus.y)).toBeLessThan(1);
  expect(size.x - (plus.x + plus.width)).toBeCloseTo(12, 0);
  expect(size.x + size.width).toBeLessThan(flip.x);
  await expect(sizeButton(page)).toHaveAttribute('aria-label', 'Puzzle size');
  await expect(sizeMenu(page)).toBeHidden();

  await sizeButton(page).click();
  await expect(sizeMenu(page)).toBeVisible();
  await expect(sizeButton(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(sizeChoices(page).locator('span:last-child')).toHaveText(SIZE_LABELS);
  const squares = await sizeChoices(page).locator('.square').evaluateAll(ss => ss.map(s => parseFloat(getComputedStyle(s, '::before').width)));
  expect(squares).toEqual([15, 19, 24, 28, 31]);
  expect(await ticked(page)).toEqual(['false', 'false', 'true', 'false', 'false']);
  expect((await sizeMenu(page).boundingBox()).y).toBeGreaterThanOrEqual(size.y + size.height);

  await page.mouse.click(5, 780);
  await expect(sizeMenu(page)).toBeHidden();
  await expect(sizeButton(page)).toHaveAttribute('aria-expanded', 'false');
});

test('a board with no zoom has no − or +, so the size button takes the first corner', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await expect(page.locator('#zoom-in')).toBeHidden();
  const card = await page.locator('#front').boundingBox(), size = await sizeButton(page).boundingBox();
  expect(size.x).toBeLessThan(card.x);
  expect(size.y).toBeLessThan(card.y);
});

test('the size I last picked anywhere is ticked when I open a board', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await keepSize(page, 'large');
  await open(page);
  await sizeButton(page).click();
  expect(await ticked(page)).toEqual(['false', 'false', 'false', 'true', 'false']);
});

test('at Small a 10×10 board is as it was, 44px squares; Normal, where a first visit starts, is one step bigger', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await keepSize(page, 'small');
  await open(page);
  await expect.poll(() => cellSize(page)).toBe('44px');
  const small = await page.locator('#stage').boundingBox();
  const fresh = await context.browser().newPage({ viewport: { width: 1440, height: 900 } });
  await open(fresh);
  await sizeButton(fresh).click();
  expect(await ticked(fresh)).toEqual(['false', 'false', 'true', 'false', 'false']);
  await expect.poll(() => cellSize(fresh)).toBe('54px');
  expect((await fresh.locator('#stage').boundingBox()).width).toBeGreaterThan(small.width);
  await fresh.close();
});

test('each size up grows a 10×10 board\'s squares and card, Huge well past 44px, and back at Small it is Small again', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await keepSize(page, 'tiny');
  await open(page);
  const cells = [], cards = [];
  for (const label of SIZE_LABELS) {
    await pickSize(page, label);
    cells.push(parseFloat(await cellSize(page)));
    cards.push((await page.locator('#stage').boundingBox()).width);
  }
  expect(cells).toEqual([30, 44, 54, 64, 74]);
  cards.slice(1).forEach((w, i) => expect(w).toBeGreaterThan(cards[i]));
  await pickSize(page, 'Small');
  await expect.poll(() => cellSize(page)).toBe('44px');
});

test('at Tiny the board and its card shrink below Small\'s', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await keepSize(page, 'small');
  await open(page);
  const small = await page.locator('#stage').boundingBox();
  await pickSize(page, 'Tiny');
  await expect.poll(() => cellSize(page)).toBe('30px');
  const tiny = await page.locator('#stage').boundingBox();
  expect(tiny.width).toBeLessThan(small.width);
  expect(tiny.height).toBeLessThan(small.height);
});

test('at Huge a 40×40 board\'s grid card runs past the window\'s height, and the page scrolls to the rest', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await keepSize(page, 'huge');
  await open(page, 'MINE-0002');
  const card = await page.locator('#front').boundingBox();
  expect(card.y + card.height).toBeGreaterThan(1080);
  await page.mouse.move(900, 500);
  await page.mouse.wheel(0, 3000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const scrolled = await page.locator('#front').boundingBox();
  expect(scrolled.y + scrolled.height).toBeLessThanOrEqual(1080);
});

test('a board too big for the page\'s column reaches past it toward the window\'s edge, never over the side bar; one that fits stays in it', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await keepSize(page, 'small');
  await open(page);
  const column = await page.locator('.site-main').boundingBox(), side = await page.locator('#site-side').boundingBox();
  const fits = await page.locator('#play').boundingBox();
  expect(Math.abs(fits.x - column.x)).toBeLessThan(1);
  expect(Math.abs(fits.width - column.width)).toBeLessThan(1);
  await open(page, 'MINE-0002');
  const play = await page.locator('#play').boundingBox(), mines = await page.locator('#mines-card').boundingBox();
  expect(play.x + play.width).toBeGreaterThan(column.x + column.width);
  expect(mines.x + mines.width).toBeLessThanOrEqual(1920 - 24 + 1);
  expect(play.x).toBeGreaterThanOrEqual(side.x + side.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1920);
});

test('a board too big to tap whole opens zoomed in at 36px whatever the size; the size changes only the card it\'s seen through', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const frames = [];
  for (const size of ['tiny', 'small', 'huge']) {
    await keepSize(page, size);
    await open(page, 'MINE-0002');
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'true');
    await expect.poll(() => cellSize(page)).toBe('36px');
    frames.push(await frameWidth(page));
  }
  expect(frames[2]).toBeGreaterThan(frames[0]);
});

test('a size picked on a board is the size the next maze and wordsearch open at', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await pickSize(page, 'Huge');
  await page.route('**/content/puzzles/maze/MAZE-0001.json', route => route.fulfill({ json: MAZE }));
  await page.goto('/app/maze.html?id=MAZE-0001');
  await sizeButton(page).click();
  expect(await ticked(page)).toEqual(['false', 'false', 'false', 'false', 'true']);
  await page.route('**/content/puzzles/wordsearch/WSCH-0007.json', route => route.fulfill({ json: WORDSEARCH }));
  await page.goto('/app/play.html?id=WSCH-0007');
  await expect(page.locator('#play')).toHaveAttribute('data-size', 'huge');
});

test.describe('the puzzle size on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('no size above Small makes a board wider than the screen', async ({ page }) => {
    await keepSize(page, 'small');
    for (const id of ['MINE-0001', 'MINE-0002']) {
      await open(page, id);
      for (const label of ['Normal', 'Large', 'Huge']) {
        await pickSize(page, label);
        const card = await page.locator('#front').boundingBox();
        expect(card.x).toBeGreaterThanOrEqual(0);
        expect(card.x + card.width).toBeLessThanOrEqual(375);
        expect(await page.evaluate(() => document.scrollingElement.scrollWidth)).toBeLessThanOrEqual(375);
      }
    }
  });
});
