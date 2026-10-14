const { test, expect } = require('@playwright/test');
// A Reveal board (the product's TASK-173 spec, after its docs/MOCKUP-MINES-REVEAL.html): covered but
// for its start square's area; Open | Mark mine under it; a kaboom on a mine with Try again; the
// finish once every safe square is open; Check and Undo; Themed mines; a big board on a phone. The
// site publishes no Reveal board yet: the fixtures are served as MINE-0901 — a 10×10 Easy of 15
// mines starting on the 0 at row 9, col 7 — and MINE-0902, a 40×40 too big to tap whole on any
// screen. Both are made by tooling's generator and pass its minesweeper checks. MINE-0901:
//   * 1 0 0 0 0 0 0 1 1
//   1 1 0 0 0 0 0 0 1 *
//   1 1 1 0 0 0 0 0 1 1
//   2 * 2 1 1 2 1 1 0 0
//   2 * 3 2 * 2 * 1 0 0
//   1 3 * 3 2 3 2 1 0 0
//   0 2 * 2 1 * 2 1 0 0
//   0 1 1 1 2 3 * 1 1 1
//   1 2 2 1 1 * 2 1 2 *
//   1 * * 1 1 1 1 0 2 *
const BOARD = require('./fixtures/MINE-0901.json');
const BIG = require('./fixtures/MINE-0902.json');
const VANILLA = require('./fixtures/MINE-0001.json');
const { characters: CHARACTERS } = require('../content/characters/index.json');

async function open(page, id) {
  await page.route('**/content/puzzles/minesweeper/MINE-0901.json', route => route.fulfill({ json: BOARD }));
  await page.route('**/content/puzzles/minesweeper/MINE-0902.json', route => route.fulfill({ json: BIG }));
  await page.route('**/content/puzzles/minesweeper/MINE-0001.json', route => route.fulfill({ json: VANILLA }));
  await page.goto('/app/minesweeper.html?id=' + (id || 'MINE-0901'));
  await expect(page.locator('#play')).toBeVisible();
}

const square = (page, r, c, cols = 10) => page.locator('#grid .mines-square').nth(r * cols + c);
const covered = page => page.locator('#grid [data-cover="covered"]');
const isMine = (r, c) => BOARD.mines.some(m => m.row === r && m.col === c);
const MINES = BOARD.mines.map(m => [m.row, m.col]);
const START = [[8, 6], [8, 7], [8, 8], [9, 6], [9, 7], [9, 8]];
const cellSize = page => page.locator('#play').evaluate(el => el.style.getPropertyValue('--cell'));

async function pick(page, tool) {
  await page.click('#tool-' + tool);
}

// A right-click: the tool that isn't picked, so with Open picked, as each page opens, it marks.
async function mark(page, r, c) {
  await square(page, r, c).click({ button: 'right' });
}

// Every safe square opened in turn, skipping any already open.
async function openAll(page) {
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const s = square(page, r, c);
      if (!isMine(r, c) && (await s.getAttribute('data-cover')) === 'covered') await s.click();
    }
  }
}

test.describe('a Reveal board', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  test('opens covered but for its start square\'s area, its numbers showing, with the rule to open every square that isn\'t a mine', async ({ page }) => {
    await expect(page.locator('#title')).toHaveText('Reveal 001');
    await expect(page.locator('#label')).toHaveText('Reveal');
    await expect(page.locator('#count')).toHaveText('0/15');
    await expect(page.locator('.reveal-rule')).toBeVisible();
    await expect(page.locator('.reveal-rule')).toHaveText(
      'Open every square that isn\'t a mine. Each number counts the mines in the eight squares around it. You never need to guess. Open a mine and it\'s game over.');
    await expect(page.locator('.mines-rule')).toBeHidden();
    await expect(covered(page)).toHaveCount(94);
    for (const [r, c] of START) await expect(square(page, r, c)).toHaveAttribute('data-cover', 'open');
    await expect(square(page, 8, 6)).toHaveText('2');
    await expect(square(page, 9, 7)).toHaveText('');
    await expect(square(page, 0, 1)).toHaveText('');
    await expect(square(page, 0, 1)).toHaveAttribute('aria-label', 'Row 1, column 2, covered');
    await expect(square(page, 8, 6)).toHaveAttribute('aria-label', 'Row 9, column 7, 2');
    await expect(page.locator('#kaboom')).toBeHidden();
    await expect(page.locator('#complete')).toBeHidden();
  });

  test('Open | Mark mine sits right under the board, Open picked', async ({ page }) => {
    await expect(page.locator('#tool-open')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tool-mark')).toHaveAttribute('aria-pressed', 'false');
    const stage = await page.locator('#stage').boundingBox();
    const pickBox = await page.locator('.mines-tool-pick').boundingBox();
    expect(pickBox.y).toBeGreaterThan(stage.y + stage.height);
    expect(pickBox.y).toBeLessThan(stage.y + stage.height + 40);
    expect((await page.locator('#check').boundingBox()).y).toBeGreaterThan(pickBox.y + pickBox.height);
  });

  test('with Open picked, a covered number opens to show itself', async ({ page }) => {
    await square(page, 7, 7).click();
    await expect(square(page, 7, 7)).toHaveAttribute('data-cover', 'open');
    await expect(square(page, 7, 7)).toHaveText('1');
    await expect(covered(page)).toHaveCount(93);
  });

  test('a 0 opens all its neighbours, and on, as in classic minesweeper', async ({ page }) => {
    await square(page, 0, 4).click();
    for (const [r, c] of [[0, 1], [1, 1], [3, 3], [2, 9], [3, 8], [6, 8], [7, 7]]) await expect(square(page, r, c)).toHaveAttribute('data-cover', 'open');
    await expect(square(page, 0, 1)).toHaveText('1');
    // (1,0) touches no 0, so it stays covered.
    await expect(square(page, 1, 0)).toHaveAttribute('data-cover', 'covered');
    await expect(square(page, 0, 0)).toHaveAttribute('data-cover', 'covered');
  });

  test('with Mark mine picked, a tap marks a covered square and again clears it; marked, it never opens with Open', async ({ page }) => {
    await pick(page, 'mark');
    await expect(page.locator('#tool-mark')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tool-open')).toHaveAttribute('aria-pressed', 'false');
    const s = square(page, 7, 7);
    await s.click();
    await expect(s).toHaveAttribute('data-mark', 'mine');
    await expect(s).toHaveAttribute('aria-label', 'Row 8, column 8, marked mine');
    await expect(page.locator('#count')).toHaveText('1/15');
    await s.click();
    await expect(s).toHaveAttribute('data-mark', 'blank');
    await expect(page.locator('#count')).toHaveText('0/15');
    await s.click();
    await pick(page, 'open');
    await s.click();
    await expect(s).toHaveAttribute('data-cover', 'covered');
    await expect(s).toHaveAttribute('data-mark', 'mine');
  });

  // The product's TASK-197: a right-click is the tool that isn't picked.
  test('with Open picked, a right-click marks a covered square and again clears it, and the switch stays on Open', async ({ page }) => {
    await mark(page, 7, 6);
    await expect(square(page, 7, 6)).toHaveAttribute('data-mark', 'mine');
    await expect(square(page, 7, 6)).toHaveAttribute('data-cover', 'covered');
    await mark(page, 7, 6);
    await expect(square(page, 7, 6)).toHaveAttribute('data-mark', 'blank');
    await expect(page.locator('#tool-open')).toHaveAttribute('aria-pressed', 'true');
  });

  test('with Mark mine picked, a right-click opens a covered square, never a marked one, and the switch stays on Mark mine', async ({ page }) => {
    await pick(page, 'mark');
    await mark(page, 7, 7);
    await expect(square(page, 7, 7)).toHaveAttribute('data-cover', 'open');
    await expect(square(page, 7, 7)).toHaveText('1');
    await square(page, 7, 8).click();
    await mark(page, 7, 8);
    await expect(square(page, 7, 8)).toHaveAttribute('data-cover', 'covered');
    await expect(square(page, 7, 8)).toHaveAttribute('data-mark', 'mine');
    await expect(page.locator('#tool-mark')).toHaveAttribute('aria-pressed', 'true');
  });

  test('with Mark mine picked, a right-click on a mine is Kaboom!', async ({ page }) => {
    await pick(page, 'mark');
    await mark(page, 7, 6);
    await expect(page.locator('#kaboom')).toBeVisible();
    await expect(square(page, 7, 6)).toHaveAttribute('data-state', 'boom');
  });

  test('a right-click on an opened number whose mines are all marked opens the rest round it, whichever is picked', async ({ page }) => {
    await mark(page, 7, 6);
    await mark(page, 8, 7);
    await expect(square(page, 7, 7)).toHaveAttribute('data-cover', 'open');
    await expect(square(page, 7, 8)).toHaveAttribute('data-cover', 'open');
    await open(page);
    await pick(page, 'mark');
    await square(page, 7, 6).click();
    await mark(page, 8, 7);
    await expect(square(page, 7, 7)).toHaveAttribute('data-cover', 'open');
  });

  test('a right-click opens no browser menu', async ({ page }) => {
    await page.evaluate(() => document.addEventListener('contextmenu', e => { window.menuPrevented = e.defaultPrevented; }));
    await mark(page, 7, 6);
    expect(await page.evaluate(() => window.menuPrevented)).toBe(true);
  });

  test('a key opens a square as a tap does', async ({ page }) => {
    await square(page, 7, 7).focus();
    await page.keyboard.press('Enter');
    await expect(square(page, 7, 7)).toHaveAttribute('data-cover', 'open');
  });

  test('an opened number whose mines are all marked opens its other covered squares; short of that it does nothing', async ({ page }) => {
    await square(page, 8, 7).click();
    await expect(covered(page)).toHaveCount(94);
    await mark(page, 7, 6);
    await expect(square(page, 7, 6)).toHaveAttribute('data-mark', 'mine');
    await square(page, 8, 7).click();
    await expect(square(page, 7, 7)).toHaveAttribute('data-cover', 'open');
    await expect(square(page, 7, 8)).toHaveAttribute('data-cover', 'open');
    await expect(square(page, 7, 6)).toHaveAttribute('data-cover', 'covered');
  });

  // Spotting a met number is the player's, and Check finds the mistakes (the product's TASK-193).
  test('an opened number looks the same met as before, and with a mine too many: no fade, no red', async ({ page }) => {
    await expect(page.locator('#mines-card')).not.toContainText('fade');
    const one = square(page, 8, 7);
    const look = () => one.evaluate(el => { const s = getComputedStyle(el); return [s.color, s.opacity, s.backgroundColor].join(' '); });
    await page.waitForFunction(() => document.querySelector('#board').getAnimations({ subtree: true }).length === 0);
    const before = await look();
    await mark(page, 7, 6);
    await expect(square(page, 7, 6)).toHaveAttribute('data-mark', 'mine');
    expect(await look()).toBe(before);
    await mark(page, 7, 7);
    await expect(square(page, 7, 7)).toHaveAttribute('data-mark', 'mine');
    expect(await look()).toBe(before);
  });

  test('an opened number tapped with its mines not all marked changes nothing and nothing flashes', async ({ page }) => {
    // The start square's area has finished opening first.
    await page.waitForFunction(() => document.querySelector('#board').getAnimations({ subtree: true }).length === 0);
    await square(page, 8, 7).click();
    await expect(covered(page)).toHaveCount(94);
    await expect(page.locator('#grid [data-mark="mine"]')).toHaveCount(0);
    expect(await page.locator('#board').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  });

  test('opening a mine bursts it red with Kaboom!, shows every mine and the wrong marks, and the board takes no taps', async ({ page }) => {
    await mark(page, 7, 7);
    await square(page, 7, 6).click();
    await expect(page.locator('#kaboom')).toBeVisible();
    await expect(page.locator('.kaboom-word')).toHaveText('Kaboom!');
    await expect(page.locator('#board')).toHaveClass(/shake/);
    const boom = square(page, 7, 6);
    await expect(boom).toHaveAttribute('data-state', 'boom');
    await expect.poll(() => boom.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(224, 71, 59)');
    await expect(page.locator('#grid [data-mark="mine"]')).toHaveCount(16);
    for (const [r, c] of MINES) await expect(square(page, r, c)).toHaveAttribute('data-mark', 'mine');
    await expect(square(page, 7, 7)).toHaveAttribute('data-checked', 'wrong');
    await expect(page.locator('#undo')).toBeDisabled();
    await page.locator('#tool-mark').click();
    await square(page, 0, 0).click({ force: true });
    await expect(square(page, 0, 0)).toHaveAttribute('data-state', 'shown');
    // The 15 mines shown, the wrong mark still covered.
    await expect(covered(page)).toHaveCount(79);
  });

  test('Try again puts the board back to its start, with nothing carried over', async ({ page }) => {
    await mark(page, 7, 7);
    await square(page, 0, 4).click();
    await square(page, 7, 6).click();
    await page.click('#again');
    await expect(page.locator('#kaboom')).toBeHidden();
    await expect(covered(page)).toHaveCount(94);
    await expect(page.locator('#grid [data-mark="mine"]')).toHaveCount(0);
    await expect(page.locator('#grid [data-checked="wrong"]')).toHaveCount(0);
    await expect(page.locator('#count')).toHaveText('0/15');
    await expect(page.locator('#undo')).toBeDisabled();
    await square(page, 7, 7).click();
    await expect(square(page, 7, 7)).toHaveAttribute('data-cover', 'open');
  });

  test('opening every safe square sparkles the board, marks the mines left unmarked, and says so', async ({ page }) => {
    await mark(page, 7, 6);
    await openAll(page);
    await expect(page.locator('#complete')).toBeVisible();
    await expect(page.locator('#complete')).toHaveText('Solved — every safe square open');
    await expect(page.locator('#board')).toHaveClass(/pop/);
    expect(await page.locator('#board .spark').count()).toBeGreaterThan(0);
    await expect(page.locator('#count')).toHaveText('15/15');
    for (const [r, c] of MINES) await expect(square(page, r, c)).toHaveAttribute('data-mark', 'mine');
    await expect(page.locator('#undo')).toBeDisabled();
    await expect(page.locator('#kaboom')).toBeHidden();
    // Finished, the board takes no more taps.
    await mark(page, 0, 0);
    await expect(square(page, 0, 0)).toHaveAttribute('data-mark', 'mine');
  });

  test('the corner button flips to the answer, every mine and number, and back with the board as it was', async ({ page }) => {
    await mark(page, 7, 6);
    await page.click('#flip');
    await expect(page.locator('#card')).toHaveClass(/flipped/);
    await expect(page.locator('#solution-label')).toHaveText('Reveal · Solution');
    await expect(page.locator('#solution-grid [data-mark="mine"]')).toHaveCount(15);
    await expect(page.locator('#solution-grid .mines-square').nth(1)).toHaveText('1');
    await page.click('#flip');
    await expect(square(page, 7, 6)).toHaveAttribute('data-mark', 'mine');
    await expect(covered(page)).toHaveCount(94);
  });
});

// Check and Undo: (7,6) is a mine, (7,7) and (7,8) aren't.
test.describe('Check and Undo on a Reveal board', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  const ringed = page => page.locator('#grid [data-checked="wrong"]');
  const line = page => page.locator('#check-line');

  test('Check rings every mine mark the answer disagrees with and counts them under the board; opened squares are never wrong', async ({ page }) => {
    await mark(page, 7, 6);
    await mark(page, 7, 7);
    await square(page, 0, 4).click();
    await page.click('#check');
    await expect(ringed(page)).toHaveCount(1);
    await expect(square(page, 7, 7)).toHaveAttribute('data-checked', 'wrong');
    await expect(line(page)).toHaveText('1 mistake');
    const board = await page.locator('#stage').boundingBox();
    expect((await line(page).boundingBox()).y).toBeGreaterThan(board.y + board.height);
    // (1,0) is no mine, and the 0 opened round it left it covered.
    await mark(page, 1, 0);
    await expect(ringed(page)).toHaveCount(0);
    await expect(line(page)).toBeHidden();
    await page.click('#check');
    await expect(line(page)).toHaveText('2 mistakes');
  });

  test('every mark right says No mistakes so far', async ({ page }) => {
    await page.click('#check');
    await expect(line(page)).toHaveText('No mistakes so far');
    await mark(page, 7, 6);
    await page.click('#check');
    await expect(line(page)).toHaveText('No mistakes so far');
    await expect(ringed(page)).toHaveCount(0);
  });

  test('Undo takes the last mine mark off, newest first, then greys out', async ({ page }) => {
    await expect(page.locator('#undo')).toBeDisabled();
    await mark(page, 7, 7);
    await mark(page, 7, 6);
    await expect(page.locator('#undo')).toBeEnabled();
    await page.click('#undo');
    await expect(square(page, 7, 6)).toHaveAttribute('data-mark', 'blank');
    await expect(square(page, 7, 7)).toHaveAttribute('data-mark', 'mine');
    await page.click('#undo');
    await expect(square(page, 7, 7)).toHaveAttribute('data-mark', 'blank');
    await expect(page.locator('#undo')).toBeDisabled();
  });

  test('opening a square is never undone, so Undo greys once only openings are left', async ({ page }) => {
    await square(page, 7, 7).click();
    await expect(page.locator('#undo')).toBeDisabled();
    await mark(page, 7, 8);
    await mark(page, 7, 8);
    await expect(page.locator('#undo')).toBeEnabled();
    await square(page, 7, 8).click();
    await expect(square(page, 7, 8)).toHaveAttribute('data-cover', 'open');
    await expect(page.locator('#undo')).toBeDisabled();
  });

  test('signed out, Undo is gone on reload, and so is the board\'s play — the line under the Mines card invites me to sign in', async ({ page }) => {
    await mark(page, 7, 6);
    await square(page, 7, 7).click();
    await page.reload();
    await expect(page.locator('#play')).toBeVisible();
    await expect(page.locator('#undo')).toBeDisabled();
    await expect(covered(page)).toHaveCount(94);
    await expect(page.locator('#save-hint')).toHaveText('Sign in to save your progress — or just play.');
    await expect(page.locator('#save-hint')).toBeVisible();
  });

  test('has no Print in the site menu, and draws no sheet; a Vanilla board of the same size does', async ({ page }) => {
    await expect(page.locator('#print')).toBeHidden();
    await expect(page.locator('#mines-sheet [data-part="grid"] *')).toHaveCount(0);
    await open(page, 'MINE-0001');
    await expect(page.locator('#print')).toBeVisible();
  });
});

test.describe('a Reveal board, Themed', () => {
  const PASTEL = 'rgb(251, 225, 223)';
  const figure = () => `url("http://localhost:${new URL(test.info().project.use.baseURL).port}/content/characters/${CHARACTERS[900 % CHARACTERS.length].figure}")`;
  const after = locator => locator.evaluate(el => getComputedStyle(el, '::after').backgroundImage);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('grew-puzzles.look', 'themed'));
    await open(page);
    await expect(page.locator('#name-tag')).not.toBeEmpty();
  });

  test('a marked mine wears the character on its pastel red, as on a Vanilla board', async ({ page }) => {
    await mark(page, 7, 6);
    expect(await after(square(page, 7, 6))).toBe(figure());
    await expect(square(page, 7, 6)).toHaveCSS('background-color', PASTEL);
    expect(await after(square(page, 7, 7))).toBe('none');
  });

  test('the kaboom mine wears it on the kaboom\'s red, and every other mine shown on its pastel red', async ({ page }) => {
    await square(page, 7, 6).click();
    expect(await after(square(page, 7, 6))).toBe(figure());
    await expect(square(page, 7, 6)).toHaveCSS('background-color', 'rgb(224, 71, 59)');
    expect(await after(square(page, 0, 0))).toBe(figure());
    await expect(square(page, 0, 0)).toHaveCSS('background-color', PASTEL);
  });

  test('every mine on the answer side wears it', async ({ page }) => {
    await page.click('#flip');
    const looks = await page.locator('#solution-grid [data-mark="mine"]').evaluateAll(all => all.map(m => getComputedStyle(m, '::after').backgroundImage));
    expect(looks).toHaveLength(15);
    expect(new Set(looks)).toEqual(new Set([figure()]));
  });
});

test('a Vanilla board has no Open | Mark mine switch, no kaboom and its own rule', async ({ page }) => {
  await open(page, 'MINE-0001');
  await expect(page.locator('#mines-switch')).toBeHidden();
  await expect(page.locator('#kaboom')).toBeHidden();
  await expect(page.locator('.mines-rule')).toBeVisible();
  await expect(page.locator('.reveal-rule')).toBeHidden();
  await square(page, 0, 0).click({ button: 'right' });
  await expect(square(page, 0, 0)).toHaveAttribute('data-mark', 'blank');
  await expect(page.locator('#complete')).toHaveText('Solved — every mine found');
});

test.describe('a Reveal board on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('a press held still on a square marks it, and lifting it opens nothing', async ({ page }) => {
    await open(page);
    const s = square(page, 7, 7);
    const box = await s.boundingBox();
    const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true };
    await s.dispatchEvent('pointerdown', at);
    await page.waitForTimeout(600);
    await s.dispatchEvent('pointerup', at);
    await s.dispatchEvent('click', { detail: 1 });
    await expect(s).toHaveAttribute('data-mark', 'mine');
    await expect(s).toHaveAttribute('data-cover', 'covered');
    await s.tap();
    await expect(s).toHaveAttribute('data-mark', 'mine');
  });

  test('with Mark mine picked, a press held still on a square opens it instead', async ({ page }) => {
    await open(page);
    await page.locator('#tool-mark').tap();
    const s = square(page, 7, 7);
    const box = await s.boundingBox();
    const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true };
    await s.dispatchEvent('pointerdown', at);
    await page.waitForTimeout(600);
    await s.dispatchEvent('pointerup', at);
    await s.dispatchEvent('click', { detail: 1 });
    await expect(s).toHaveAttribute('data-cover', 'open');
    await expect(s).toHaveAttribute('data-mark', 'number');
    await expect(page.locator('#tool-mark')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a press that moves, or lifts quickly, marks nothing', async ({ page }) => {
    await open(page);
    const s = square(page, 7, 7);
    const box = await s.boundingBox();
    const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true };
    await s.dispatchEvent('pointerdown', at);
    await s.dispatchEvent('pointermove', { ...at, clientX: at.clientX + 20 });
    await page.waitForTimeout(600);
    await s.dispatchEvent('pointerup', at);
    await expect(s).toHaveAttribute('data-mark', 'blank');
    await s.tap();
    await expect(s).toHaveAttribute('data-cover', 'open');
  });

  test('a 10×10 board fits the width, and Open | Mark mine sits under it', async ({ page }) => {
    await open(page);
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'false');
    const stage = await page.locator('#stage').boundingBox();
    const pickBox = await page.locator('.mines-tool-pick').boundingBox();
    expect(stage.x + stage.width).toBeLessThanOrEqual(375);
    expect(pickBox.y).toBeGreaterThan(stage.y + stage.height);
    expect(pickBox.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('a big board opens zoomed in on its start square, and with the board filling the screen, Open | Mark mine is in reach under it', async ({ page }) => {
    await open(page, 'MINE-0902');
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'true');
    await expect.poll(() => cellSize(page)).toBe('36px');
    const frame = await page.locator('#view').boundingBox();
    const start = await square(page, 31, 33, 40).boundingBox();
    expect(Math.abs(start.x + start.width / 2 - (frame.x + frame.width / 2))).toBeLessThan(36);
    expect(Math.abs(start.y + start.height / 2 - (frame.y + frame.height / 2))).toBeLessThan(36);
    await page.locator('#stage').evaluate(el => el.scrollIntoView({ block: 'start' }));
    const pickBox = await page.locator('.mines-tool-pick').boundingBox();
    expect(pickBox.y + pickBox.height).toBeLessThanOrEqual(667);
    await page.locator('#tool-mark').tap();
    // (33,33), two squares under the start, is a mine.
    const mine = square(page, 33, 33, 40);
    await mine.tap();
    await expect(mine).toHaveAttribute('data-mark', 'mine');
  });
});
