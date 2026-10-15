const { test, expect } = require('@playwright/test');
// A Canaries board (the product's TASK-203 spec): it plays as a Reveal board does, plus a Canary the
// player picks apart from Open | Mark mine — a canary on a safe square opens it and survives, one on
// a mine is lost, the mine shown for good, and play goes on. The site publishes no Canaries board
// yet: the fixture is served as MINE-0905, tooling's own valid Canaries board, passing its
// minesweeper checks — 6×6, two canaries, its start square's area rows 3 to 5, cols 2 to 5:
//   1 2 2 2 * 1
//   1 * * 4 2 2
//   1 3 * 3 * 1
//   1 2 1 2 1 1
//   * 2 1 0 0 0
//   2 * 1 0 0 0
const BOARD = require('./fixtures/MINE-0905.json');
const REVEAL = require('./fixtures/MINE-0901.json');

async function open(page, id = 'MINE-0905') {
  await page.route('**/content/puzzles/minesweeper/MINE-0905.json', route => route.fulfill({ json: BOARD }));
  await page.route('**/content/puzzles/minesweeper/MINE-0901.json', route => route.fulfill({ json: REVEAL }));
  await page.goto('/app/minesweeper.html?id=' + id);
  await expect(page.locator('#play')).toBeVisible();
}

const square = (page, r, c) => page.locator('#grid .mines-square').nth(r * 6 + c);
const count = page => page.locator('#count');
const canary = page => page.locator('#tool-canary');
const isMine = (r, c) => BOARD.mines.some(m => m.row === r && m.col === c);

// Canary picked, then a tap on the square.
async function sendCanary(page, r, c) {
  await canary(page).click();
  await square(page, r, c).click();
}

test.describe('a Canaries board', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  test('opens as a Reveal board, Open | Mark mine under it, Canary a separate button beside it, and the Mines card reading Canaries 2', async ({ page }) => {
    await expect(page.locator('#title')).toHaveText('Canaries 001');
    await expect(page.locator('#label')).toHaveText('Canaries');
    await expect(page.locator('.mines-tool-pick')).toBeVisible();
    await expect(canary(page)).toBeVisible();
    await expect(page.locator('.mines-tool-pick #tool-canary')).toHaveCount(0);
    await expect(canary(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(canary(page)).toBeEnabled();
    await expect(count(page)).toHaveText('Canaries 2');
    await expect(page.locator('.canaries-rule')).toBeVisible();
    await expect(page.locator('.no-guess')).toBeHidden();
    await expect(page.locator('#grid [data-cover="covered"]')).toHaveCount(24);
    await expect(page.locator('#print')).toBeHidden();
  });

  test('picking Canary leaves Open | Mark mine as I picked it', async ({ page }) => {
    await page.click('#tool-open');
    await canary(page).click();
    await expect(canary(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tool-open')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tool-mark')).toHaveAttribute('aria-pressed', 'false');
    await canary(page).click();
    await expect(canary(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('a canary on a safe square opens it as Open would; Canaries stays at 2, and Canary lets go', async ({ page }) => {
    await sendCanary(page, 3, 1);
    await expect(square(page, 3, 1)).toHaveAttribute('data-cover', 'open');
    await expect(square(page, 3, 1)).toHaveText('2');
    await expect(count(page)).toHaveText('Canaries 2');
    await expect(canary(page)).toHaveAttribute('aria-pressed', 'false');
    // Mark mine is still picked, so the next tap marks.
    await square(page, 3, 0).click();
    await expect(square(page, 3, 0)).toHaveAttribute('data-mark', 'mine');
  });

  test('a canary on a mine blows up: the mine shows and can\'t be unmarked, Canaries drops to 1, and I play on', async ({ page }) => {
    await sendCanary(page, 4, 0);
    await expect(square(page, 4, 0)).toHaveAttribute('data-state', 'blown');
    await expect(square(page, 4, 0)).toHaveAttribute('data-mark', 'mine');
    await expect(square(page, 4, 0)).toHaveAttribute('aria-label', 'Row 5, column 1, mine, found by a canary');
    await expect(count(page)).toHaveText('Canaries 1');
    await expect(page.locator('#kaboom')).toBeHidden();
    // Mark mine picked: a tap on it changes nothing; Open picked, nor does that.
    await square(page, 4, 0).click();
    await expect(square(page, 4, 0)).toHaveAttribute('data-state', 'blown');
    await page.click('#tool-open');
    await square(page, 4, 0).click();
    await expect(page.locator('#kaboom')).toBeHidden();
    await square(page, 3, 0).click();
    await expect(square(page, 3, 0)).toHaveAttribute('data-cover', 'open');
  });

  test('with Canaries at 0, the Canary button is greyed', async ({ page }) => {
    await sendCanary(page, 4, 0);
    await expect(canary(page)).toBeEnabled();
    await sendCanary(page, 5, 1);
    await expect(count(page)).toHaveText('Canaries 0');
    await expect(canary(page)).toBeDisabled();
  });

  test('Open on a mine is Kaboom! with Try again, canaries left or not; Try again gives every canary back', async ({ page }) => {
    await sendCanary(page, 4, 0);
    await page.click('#tool-open');
    await square(page, 5, 1).click();
    await expect(page.locator('#kaboom')).toBeVisible();
    await expect(square(page, 5, 1)).toHaveAttribute('data-state', 'boom');
    await page.click('#again');
    await expect(count(page)).toHaveText('Canaries 2');
    await expect(page.locator('#grid [data-state="blown"]')).toHaveCount(0);
    await expect(canary(page)).toBeEnabled();
  });

  test('Undo takes back marks only; a canary used stays used', async ({ page }) => {
    await square(page, 3, 0).click();
    await sendCanary(page, 4, 0);
    await page.click('#undo');
    await expect(square(page, 3, 0)).toHaveAttribute('data-mark', 'blank');
    await expect(square(page, 4, 0)).toHaveAttribute('data-state', 'blown');
    await expect(count(page)).toHaveText('Canaries 1');
    await expect(page.locator('#undo')).toBeDisabled();
  });

  test('opening every safe square sparkles and flips it, however many canaries were lost', async ({ page }) => {
    await sendCanary(page, 4, 0);
    await sendCanary(page, 5, 1);
    await page.click('#tool-open');
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const s = square(page, r, c);
        if (!isMine(r, c) && (await s.getAttribute('data-cover')) === 'covered') await s.click();
      }
    }
    await expect(page.locator('#complete')).toHaveText('Solved — every safe square open');
    await expect(page.locator('#board')).toHaveClass(/pop/);
    expect(await page.locator('#board .spark').count()).toBeGreaterThan(0);
    await expect(count(page)).toHaveText('Canaries 0');
    await page.click('#flip');
    await expect(page.locator('#solution-label')).toHaveText('Canaries · Solution');
  });

  test('with Canary picked, a right-click taps with the one of Open | Mark mine not picked, and spends no canary', async ({ page }) => {
    // Mark mine picked: a right-click opens.
    await canary(page).click();
    await square(page, 3, 1).click({ button: 'right' });
    await expect(square(page, 3, 1)).toHaveAttribute('data-cover', 'open');
    await expect(count(page)).toHaveText('Canaries 2');
    await expect(canary(page)).toHaveAttribute('aria-pressed', 'true');
    // Open picked: a right-click marks, a mine too, and spends nothing.
    await page.click('#tool-open');
    await square(page, 4, 0).click({ button: 'right' });
    await expect(square(page, 4, 0)).toHaveAttribute('data-mark', 'mine');
    await expect(square(page, 4, 0)).toHaveAttribute('data-state', '');
    await expect(count(page)).toHaveText('Canaries 2');
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('with Canary picked, a press held still on a mine marks it, as with Mark mine picked it opens — no canary spent, Canary still picked', async ({ page }) => {
    await open(page);
    await page.locator('#tool-open').tap();
    await canary(page).tap();
    const s = square(page, 4, 0);
    const box = await s.boundingBox();
    const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true };
    await s.dispatchEvent('pointerdown', at);
    await page.waitForTimeout(600);
    await s.dispatchEvent('pointerup', at);
    await s.dispatchEvent('click', { detail: 1 });
    await expect(s).toHaveAttribute('data-mark', 'mine');
    await expect(s).toHaveAttribute('data-state', '');
    await expect(count(page)).toHaveText('Canaries 2');
    await expect(canary(page)).toHaveAttribute('aria-pressed', 'true');
  });
});

test('a Reveal board with no canaries has no Canary, keeps "You never need to guess", and counts mines marked', async ({ page }) => {
  await open(page, 'MINE-0901');
  await expect(canary(page)).toBeHidden();
  await expect(page.locator('.canaries-rule')).toBeHidden();
  await expect(page.locator('.reveal-rule')).toContainText('You never need to guess.');
  await expect(count(page)).toHaveText('0/15');
});

test('a Canaries board, Themed: a canary\'s mine wears the character, as a marked mine does', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('grew-puzzles.look', 'themed'));
  await open(page);
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await sendCanary(page, 4, 0);
  await square(page, 5, 1).click();
  const look = async (r, c) => square(page, r, c).evaluate(el => getComputedStyle(el, '::after').backgroundImage);
  expect(await look(4, 0)).toBe(await look(5, 1));
  expect(await look(4, 0)).toMatch(/^url\(/);
});
