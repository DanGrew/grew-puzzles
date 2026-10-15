const { test, expect } = require('@playwright/test');
// A Limited Flags board (the product's TASK-179 spec): it plays as a Reveal board does, but no more
// than its flag limit of mine marks sit on it at once — the Mines card counts the flags left, and
// with none left a new mark takes the oldest one's place. The site publishes no Limited Flags board
// yet: the fixture is served as MINE-0904, the 10×10 Reveal board MINE-0901 (mines-reveal.test.js
// draws it) with a flag limit of 5, passing tooling's minesweeper checks — its start square's area
// the six squares of rows 8 and 9, cols 6 to 8; (7,6), (8,5), (8,9), (9,9) and (6,5) mines, (7,7) a 1.
const BOARD = require('./fixtures/MINE-0904.json');
const REVEAL = require('./fixtures/MINE-0901.json');

async function open(page, id = 'MINE-0904') {
  await page.route('**/content/puzzles/minesweeper/MINE-0904.json', route => route.fulfill({ json: BOARD }));
  await page.route('**/content/puzzles/minesweeper/MINE-0901.json', route => route.fulfill({ json: REVEAL }));
  await page.goto('/app/minesweeper.html?id=' + id);
  await expect(page.locator('#play')).toBeVisible();
}

const square = (page, r, c) => page.locator('#grid .mines-square').nth(r * 10 + c);
const count = page => page.locator('#count');
const isMine = (r, c) => BOARD.mines.some(m => m.row === r && m.col === c);
const FIVE = [[7, 6], [8, 5], [8, 9], [9, 9], [6, 5]];

// A right-click: with Open picked, as each page opens, it marks.
async function mark(page, r, c) {
  await square(page, r, c).click({ button: 'right' });
}

async function markAll(page, cells) {
  for (const [r, c] of cells) await mark(page, r, c);
}

test.describe('a Limited Flags board', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  test('opens as a Reveal board, the rule line saying I can have only 5 mines marked at once, and the Mines card reading Flags left 5', async ({ page }) => {
    await expect(page.locator('#title')).toHaveText('Limited Flags 001');
    await expect(page.locator('#label')).toHaveText('Limited Flags');
    await expect(page.locator('.reveal-rule')).toBeVisible();
    await expect(page.locator('.flags-rule')).toBeVisible();
    await expect(page.locator('.flags-rule')).toHaveText('You can have only 5 mines marked at once. Mark another and your oldest mark moves to it.');
    await expect(count(page)).toHaveText('Flags left 5');
    await expect(page.locator('#grid [data-cover="covered"]')).toHaveCount(94);
    await expect(page.locator('#print')).toBeHidden();
  });

  test('marking a mine takes a flag, and taking a mark off gives it back', async ({ page }) => {
    await mark(page, 7, 6);
    await expect(count(page)).toHaveText('Flags left 4');
    await mark(page, 8, 5);
    await expect(count(page)).toHaveText('Flags left 3');
    await mark(page, 7, 6);
    await expect(square(page, 7, 6)).toHaveAttribute('data-mark', 'blank');
    await expect(count(page)).toHaveText('Flags left 4');
  });

  test('with no flags left, a new mark fades my oldest off its square and takes its place; Flags left stays at 0', async ({ page }) => {
    await markAll(page, FIVE);
    await expect(count(page)).toHaveText('Flags left 0');
    await mark(page, 4, 4);
    await expect(square(page, 4, 4)).toHaveAttribute('data-mark', 'mine');
    await expect(square(page, 7, 6)).toHaveAttribute('data-mark', 'blank');
    await expect(square(page, 7, 6)).toHaveClass(/flag-lift/);
    await expect(square(page, 7, 6)).not.toHaveClass(/flag-lift/);
    await expect(page.locator('#grid [data-mark="mine"]')).toHaveCount(5);
    await expect(count(page)).toHaveText('Flags left 0');
    // First in, first out: the next mark takes (8,5)'s place.
    await mark(page, 4, 6);
    await expect(square(page, 8, 5)).toHaveAttribute('data-mark', 'blank');
    await expect(square(page, 4, 4)).toHaveAttribute('data-mark', 'mine');
  });

  test('Undo after that takes the new mark off and puts the oldest back where it was, the oldest still', async ({ page }) => {
    await markAll(page, FIVE);
    await mark(page, 4, 4);
    await page.click('#undo');
    await expect(square(page, 4, 4)).toHaveAttribute('data-mark', 'blank');
    await expect(square(page, 7, 6)).toHaveAttribute('data-mark', 'mine');
    await expect(count(page)).toHaveText('Flags left 0');
    await mark(page, 4, 6);
    await expect(square(page, 7, 6)).toHaveAttribute('data-mark', 'blank');
    await expect(square(page, 8, 5)).toHaveAttribute('data-mark', 'mine');
  });

  test('Check rings wrong marks red, as on any Reveal board', async ({ page }) => {
    await mark(page, 7, 6);
    await mark(page, 7, 7);
    await page.click('#check');
    await expect(page.locator('#grid [data-checked="wrong"]')).toHaveCount(1);
    await expect(square(page, 7, 7)).toHaveAttribute('data-checked', 'wrong');
    await expect(page.locator('#check-line')).toHaveText('1 mistake');
  });

  test('opening every safe square sparkles and finishes it, whatever flags I used', async ({ page }) => {
    await markAll(page, FIVE);
    await mark(page, 4, 4);
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const s = square(page, r, c);
        if (!isMine(r, c) && (await s.getAttribute('data-cover')) === 'covered') await s.click();
      }
    }
    await expect(page.locator('#complete')).toHaveText('Solved — every safe square open');
    await expect(page.locator('#board')).toHaveClass(/pop/);
    expect(await page.locator('#board .spark').count()).toBeGreaterThan(0);
    await expect(page.locator('#grid [data-mark="mine"]')).toHaveCount(15);
    await expect(count(page)).toHaveText('Flags left 0');
    await page.click('#flip');
    await expect(page.locator('#solution-label')).toHaveText('Limited Flags · Solution');
  });
});

test('a Reveal board with no flag limit has no flags rule, counts mines marked, and never moves a mark', async ({ page }) => {
  await open(page, 'MINE-0901');
  await expect(page.locator('.flags-rule')).toBeHidden();
  await expect(count(page)).toHaveText('0/15');
  await markAll(page, [...FIVE, [4, 4]]);
  await expect(page.locator('#grid [data-mark="mine"]')).toHaveCount(6);
  await expect(count(page)).toHaveText('6/15');
});

test('a Limited Flags board, Themed: the mark fading off wears the character, as a marked mine does', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('grew-puzzles.look', 'themed'));
  await open(page);
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await markAll(page, FIVE);
  await mark(page, 4, 4);
  const look = async (r, c) => square(page, r, c).evaluate(el => getComputedStyle(el, '::after').backgroundImage);
  await expect(square(page, 7, 6)).toHaveClass(/flag-lift/);
  expect(await look(7, 6)).toBe(await look(4, 4));
  expect(await look(7, 6)).toMatch(/^url\(/);
});
