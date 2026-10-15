const { test, expect } = require('@playwright/test');
// A Keys board (the product's TASK-177): a Reveal board whose zones are padlocked until their hidden
// keys turn up. The site publishes no Keys board yet: the fixture is served as MINE-0903 — tooling's
// own valid Keys board, passing its minesweeper checks — 6×6, six mines, starting on the 0 at
// row 2, col 2. Zone 1 is the four 0s at the bottom right, its key hidden on (5,0); (5,0) is itself
// Zone 2, whose key hides on the 0 at (0,5), outside every zone:
//   0 1 * 1 0 0       . . . . . 2k
//   1 2 1 2 1 1       . . . . . .
//   * 1 0 1 * 1       . . . . . .
//   2 3 1 2 1 1       . . . . . .
//   * 3 * 1 0 0       . . . . 1 1
//   2 * 2 1 0 0      2/1k . . . 1 1
const BOARD = require('./fixtures/MINE-0903.json');
const REVEAL = require('./fixtures/MINE-0901.json');

// The zones' colours, the generator's own: Zone 1's, Zone 2's.
const ZONE_1 = 'rgb(228, 87, 46)';
const ZONE_2 = 'rgb(243, 167, 18)';
const ZONE_1_SQUARES = [[4, 4], [4, 5], [5, 4], [5, 5]];
const isMine = (r, c) => BOARD.mines.some(m => m.row === r && m.col === c);

async function open(page, id = 'MINE-0903') {
  await page.route('**/content/puzzles/minesweeper/MINE-0903.json', route => route.fulfill({ json: BOARD }));
  await page.route('**/content/puzzles/minesweeper/MINE-0901.json', route => route.fulfill({ json: REVEAL }));
  await page.goto('/app/minesweeper.html?id=' + id);
  await expect(page.locator('#play')).toBeVisible();
  await pickOpen(page);
}

// Mark mine is picked as each page opens; these tests play with Open picked, so a click opens and a
// right-click marks. A Vanilla board has no switch, and the pick does nothing on it.
async function pickOpen(page) {
  await page.locator('#tool-open').evaluate(button => button.click());
}

const square = (page, r, c) => page.locator('#grid .mines-square').nth(r * 6 + c);
const answer = (page, r, c) => page.locator('#solution-grid .mines-square').nth(r * 6 + c);
const padlock = s => s.evaluate(el => getComputedStyle(el, '::after').backgroundColor);
const key = s => s.evaluate(el => getComputedStyle(el, '::before').backgroundColor);
const muted = page => page.evaluate(() => {
  const probe = document.body.appendChild(document.createElement('i'));
  probe.style.background = 'var(--muted)';
  const colour = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return colour;
});

// Zone 2's key, then Zone 1's.
async function unlockBoth(page) {
  await square(page, 0, 5).click();
  await square(page, 5, 0).click();
}

test.describe('a Keys board', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  test('opens with each zone\'s squares covered and padlocked in its colour, every key hidden, and the rule line says to find the keys', async ({ page }) => {
    await expect(page.locator('#title')).toHaveText('Keys 001');
    await expect(page.locator('#label')).toHaveText('Keys');
    await expect(page.locator('#count')).toHaveText('0/6');
    for (const [r, c] of ZONE_1_SQUARES) {
      await expect(square(page, r, c)).toHaveAttribute('data-lock', '1');
      await expect(square(page, r, c)).toHaveAttribute('data-cover', 'covered');
      expect(await padlock(square(page, r, c))).toBe(ZONE_1);
    }
    await expect(square(page, 5, 0)).toHaveAttribute('data-lock', '2');
    expect(await padlock(square(page, 5, 0))).toBe(ZONE_2);
    await expect(square(page, 4, 4)).toHaveAttribute('aria-label', 'Row 5, column 5, padlocked, zone 1');
    // The key's square looks like any other covered square.
    await expect(square(page, 0, 5)).toHaveAttribute('data-lock', '');
    await expect(square(page, 0, 5)).toHaveAttribute('aria-label', 'Row 1, column 6, covered');
    await expect(page.locator('#grid [data-lock]:not([data-lock=""])')).toHaveCount(5);
    await expect(page.locator('#grid [data-found]:not([data-found=""])')).toHaveCount(0);
    await expect(page.locator('.keys-rule')).toBeVisible();
    await expect(page.locator('.keys-rule')).toHaveText(
      'Find the hidden keys to unlock the padlocked squares. Each key hides under a square outside its zone, and opening it unlocks that zone.');
    await expect(page.locator('.reveal-rule')).toBeVisible();
    await expect(page.locator('.mines-legend .keys-only')).toHaveCount(4);
    await expect(page.locator('.mines-legend .keys-only').first()).toBeVisible();
  });

  test('a padlocked square tapped, with Open or Mark mine, or right-clicked, does nothing but shake its padlock', async ({ page }) => {
    const locked = square(page, 4, 4);
    await locked.click();
    await expect(locked).toHaveClass(/lock-shake/);
    await expect(locked).toHaveAttribute('data-cover', 'covered');
    await locked.click({ button: 'right' });
    await expect(locked).toHaveAttribute('data-mark', 'blank');
    await page.click('#tool-mark');
    await locked.click();
    await expect(locked).toHaveAttribute('data-mark', 'blank');
    await expect(locked).toHaveAttribute('data-lock', '1');
    await expect(page.locator('#count')).toHaveText('0/6');
    await expect(page.locator('#undo')).toBeDisabled();
    await expect(page.locator('#grid [data-cover="covered"]')).toHaveCount(27);
    // The shake plays out, and the padlock stays.
    await expect(locked).not.toHaveClass(/lock-shake/, { timeout: 3000 });
    expect(await padlock(locked)).toBe(ZONE_1);
  });

  test('opening the square that hides a key pops the key up in its zone\'s colour, and that zone\'s padlocks drop away', async ({ page }) => {
    const found = square(page, 0, 5);
    await found.click();
    await expect(found).toHaveAttribute('data-found', '2');
    await expect(found).toHaveClass(/key-pop/);
    await expect(found).toHaveAttribute('aria-label', 'Row 1, column 6, 0, key 2 found');
    await expect(square(page, 5, 0)).toHaveAttribute('data-lock', '');
    await expect(square(page, 5, 0)).toHaveClass(/unlocking/);
    await expect(square(page, 5, 0)).toHaveAttribute('data-cover', 'covered');
    await expect(square(page, 5, 0)).toHaveAttribute('aria-label', 'Row 6, column 1, covered');
    // Zone 1 is still padlocked.
    await expect(square(page, 4, 4)).toHaveAttribute('data-lock', '1');
    // Once it has popped, the key sits greyed on its square.
    await expect(found).not.toHaveClass(/key-pop/, { timeout: 3000 });
    expect(await key(found)).toBe(await muted(page));
  });

  test('a key found inside a zone just unlocked unlocks the next zone the same way, and stays greyed beside its number', async ({ page }) => {
    await unlockBoth(page);
    const found = square(page, 5, 0);
    await expect(found).toHaveAttribute('data-cover', 'open');
    await expect(found).toHaveText('2');
    await expect(found).toHaveAttribute('data-found', '1');
    for (const [r, c] of ZONE_1_SQUARES) await expect(square(page, r, c)).toHaveAttribute('data-lock', '');
    await expect(page.locator('#grid [data-lock]:not([data-lock=""])')).toHaveCount(0);
    await expect(found).not.toHaveClass(/key-pop/, { timeout: 3000 });
    expect(await key(found)).toBe(await muted(page));
    await expect(square(page, 0, 5)).toHaveAttribute('data-found', '2');
    // Unlocked, a square opens as any other: a 0, opening round it.
    await square(page, 4, 4).click();
    for (const [r, c] of ZONE_1_SQUARES) await expect(square(page, r, c)).toHaveAttribute('data-cover', 'open');
  });

  test('a met number beside a zone opens only its unlocked squares; once the zone is unlocked, it opens into it', async ({ page }) => {
    // (4,3) is a 1 whose mine is (4,2); (4,4) and (5,4) round it are Zone 1's.
    await square(page, 4, 3).click();
    await square(page, 4, 2).click({ button: 'right' });
    await square(page, 4, 3).click();
    for (const [r, c] of [[3, 4], [5, 2], [5, 3]]) await expect(square(page, r, c)).toHaveAttribute('data-cover', 'open');
    for (const [r, c] of [[4, 4], [5, 4]]) {
      await expect(square(page, r, c)).toHaveAttribute('data-cover', 'covered');
      await expect(square(page, r, c)).toHaveAttribute('data-lock', '1');
    }
    await unlockBoth(page);
    await square(page, 4, 3).click();
    for (const [r, c] of ZONE_1_SQUARES) await expect(square(page, r, c)).toHaveAttribute('data-cover', 'open');
  });

  test('opening every safe square sparkles the board and says so; the answer side shows every key where it hid, in its colour', async ({ page }) => {
    await unlockBoth(page);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const s = square(page, r, c);
        if (!isMine(r, c) && (await s.getAttribute('data-cover')) === 'covered') await s.click();
      }
    }
    await expect(page.locator('#complete')).toHaveText('Solved — every safe square open');
    await expect(page.locator('#complete')).toBeVisible();
    await expect(page.locator('#board')).toHaveClass(/pop/);
    await expect(page.locator('#count')).toHaveText('6/6');
    await page.click('#flip');
    await expect(page.locator('#solution-label')).toHaveText('Keys · Solution');
    await expect(page.locator('#solution-grid [data-found]:not([data-found=""])')).toHaveCount(2);
    await expect(answer(page, 0, 5)).toHaveAttribute('data-found', '2');
    await expect(answer(page, 5, 0)).toHaveAttribute('data-found', '1');
    expect(await key(answer(page, 0, 5))).toBe(ZONE_2);
    expect(await key(answer(page, 5, 0))).toBe(ZONE_1);
  });

  test('Try again after a kaboom padlocks every zone again', async ({ page }) => {
    await square(page, 0, 5).click();
    await square(page, 0, 2).click();
    await expect(page.locator('#kaboom')).toBeVisible();
    await page.click('#again');
    await expect(square(page, 0, 5)).toHaveAttribute('data-cover', 'covered');
    await expect(square(page, 0, 5)).toHaveAttribute('data-found', '');
    await expect(square(page, 5, 0)).toHaveAttribute('data-lock', '2');
  });

  test('has no Print in the site menu, and draws no sheet', async ({ page }) => {
    await expect(page.locator('#print')).toBeHidden();
    await expect(page.locator('#mines-sheet [data-part="grid"] *')).toHaveCount(0);
  });
});

test('a Reveal board has no padlocks, no keys and no keys rule line', async ({ page }) => {
  await open(page, 'MINE-0901');
  await expect(page.locator('.reveal-rule')).toBeVisible();
  await expect(page.locator('.keys-rule')).toBeHidden();
  await expect(page.locator('.mines-legend .keys-only').first()).toBeHidden();
  await expect(page.locator('#grid [data-lock]:not([data-lock=""])')).toHaveCount(0);
  await page.click('#flip');
  await expect(page.locator('#solution-grid [data-found]:not([data-found=""])')).toHaveCount(0);
});
