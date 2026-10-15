const { test, expect } = require('@playwright/test');
// The site publishes no mosaic yet: the fixtures are served as MOSA-0001 — a 12×12 Easy board — and
// MOSA-0002, a 198×198 Hard one (asked for at 200, trimmed to its pattern), too big to tap whole on
// any screen. Both are made by tooling's generator and pass its mosaic checks 1–7.
const BOARD = require('./fixtures/MOSA-0001.json');
const BIG = require('./fixtures/MOSA-0002.json');

async function open(page, id) {
  await page.route('**/content/puzzles/mosaic/MOSA-0001.json', route => route.fulfill({ json: BOARD }));
  await page.route('**/content/puzzles/mosaic/MOSA-0002.json', route => route.fulfill({ json: BIG }));
  await page.goto('/app/mosaic.html?id=' + (id || 'MOSA-0001'));
  await expect(page.locator('#play')).toBeVisible();
  await expect(page.locator('#play')).toHaveAttribute('data-view', /./);
}

const answer = file => file.answer.flatMap((row, r) => [...row].map((ch, c) => [ch, r, c])).filter(s => s[0] === '#').map(s => [s[1], s[2]]);

// The board is drawn into a canvas: what a square looks like is read off its pixels — its fill near
// its bottom-left corner, clear of any number: ink shaded, the blank tint left blank. canvas: '#grid',
// the player's side, or '#solution-grid', the answer.
async function look(page, r, c, canvas = '#grid') {
  return page.evaluate(([r, c, id]) => {
    const grid = document.querySelector(id);
    const [cell, vx, vy] = document.getElementById('play').dataset.view.split(' ').map(Number);
    const ratio = grid.width / grid.getBoundingClientRect().width;
    const ctx = grid.getContext('2d');
    const at = (x, y) => Array.from(ctx.getImageData(Math.floor(((c - vx) * cell + x * cell) * ratio), Math.floor(((r - vy) * cell + y * cell) * ratio), 1, 1).data).slice(0, 3).join(',');
    return { fill: at(0.15, 0.85), middle: at(0.5, 0.5), edge: at(0.04, 0.5) };
  }, [r, c, canvas]);
}

const INK = '15,42,36', BLANK = '207,219,214', RED = '224,71,59', WHITE = '255,255,255';

async function markOf(page, r, c) {
  const { fill } = await look(page, r, c);
  return { [INK]: 'shade', [BLANK]: 'blank' }[fill] || 'clear';
}

const expectMark = (page, r, c, mark) => expect.poll(() => markOf(page, r, c)).toBe(mark);

// Where a square sits on the canvas at the view now, to press it.
async function spot(page, r, c) {
  const [cell, vx, vy] = (await page.locator('#play').getAttribute('data-view')).split(' ').map(Number);
  return { x: (c - vx + 0.5) * cell, y: (r - vy + 0.5) * cell };
}

async function tap(page, r, c, button = 'left') {
  await page.locator('#grid').click({ position: await spot(page, r, c), button });
}

async function tapAll(page, cells) {
  for (const [r, c] of cells) await tap(page, r, c);
}

const shade = cells => cells.flatMap(c => [c, c]);

test.describe('a mosaic', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  test('opens with its title, its difficulty and code, the Vanilla band, and the Squares card at 0 shaded with the rule', async ({ page }) => {
    await expect(page.locator('#title')).toHaveText('Mosaic 001');
    await expect(page).toHaveTitle('Mosaic 001 · Grew Puzzles');
    await expect(page.locator('#ident')).toHaveText('Easy · MOSA-0001');
    await expect(page.locator('#difficulty')).toHaveAttribute('data-tone', 'Easy');
    await expect(page.locator('#label')).toHaveText('Vanilla');
    await expect(page.locator('#mosaic-card h2')).toHaveText('Squares');
    await expect(page.locator('#count')).toHaveText('0 shaded');
    await expect(page.locator('.mosaic-rule')).toHaveText(
      'Shade squares to reveal a picture. Each number counts the shaded squares in its 3×3 block: the square itself and the eight around it.');
    await expect(page.locator('#complete')).toBeHidden();
  });

  test('the picture\'s name shows nowhere before the finish', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText(BOARD.name);
    await expect(page).not.toHaveTitle(new RegExp(BOARD.name));
    await expect(page.locator('#solution-label')).toHaveText('Vanilla · Solution');
  });

  test('the Squares card sits beside the grid card', async ({ page }) => {
    const card = await page.locator('#stage').boundingBox();
    const side = await page.locator('#mosaic-card').boundingBox();
    expect(side.x).toBeGreaterThan(card.x + card.width);
  });

  test('a blank square cycles blank, shade, clear — and only a shaded one counts', async ({ page }) => {
    await tap(page, 0, 1);
    await expectMark(page, 0, 1, 'blank');
    await expect(page.locator('#count')).toHaveText('0 shaded');
    await tap(page, 0, 1);
    await expectMark(page, 0, 1, 'shade');
    await expect(page.locator('#count')).toHaveText('1 shaded');
    await tap(page, 0, 1);
    await expectMark(page, 0, 1, 'clear');
    await expect(page.locator('#count')).toHaveText('0 shaded');
  });

  test('a numbered square cycles too, blank tinted like any other', async ({ page }) => {
    await tap(page, 5, 5);
    await expectMark(page, 5, 5, 'blank');
    await tap(page, 5, 5);
    await expectMark(page, 5, 5, 'shade');
    await tap(page, 5, 5);
    await expectMark(page, 5, 5, 'clear');
  });

  // Spotting a met number is the player's, and Check finds the mistakes (the owner, 2026-10-14).
  test('a number looks the same met as before, and with one too many: no fade, no red', async ({ page }) => {
    // The 0 at (0,4): its block is rows 0–1, columns 3–5; (0,3) is in it, (0,4) itself unmarked.
    const number = () => page.evaluate(() => {
      const grid = document.getElementById('grid');
      const [cell] = document.getElementById('play').dataset.view.split(' ').map(Number);
      const ratio = grid.width / grid.getBoundingClientRect().width;
      const x = Math.ceil((4 * cell + 2) * ratio), w = Math.floor((cell - 4) * ratio);
      return Array.from(grid.getContext('2d').getImageData(x, Math.ceil(2 * ratio), w, w).data).join(',');
    });
    const before = await number();
    await tapAll(page, [[0, 5], [1, 5]]);
    await expectMark(page, 1, 5, 'blank');
    expect(await number()).toBe(before);
    await tapAll(page, [[0, 5]]);
    await expectMark(page, 0, 5, 'shade');
    expect(await number()).toBe(before);
  });

  test('a right-click on a number whose count is met leaves the rest of its block blank, its own square too', async ({ page }) => {
    await tap(page, 0, 4, 'right');
    for (const [r, c] of [[0, 3], [0, 4], [0, 5], [1, 3], [1, 4], [1, 5]]) await expectMark(page, r, c, 'blank');
    await expectMark(page, 0, 2, 'clear');
    await expectMark(page, 2, 4, 'clear');
  });

  test('a right-click on a number whose clear squares are just what it needs shades them', async ({ page }) => {
    // The 5 at (5,5): (4,5), (4,6), (5,4) and (6,4) aren't in the picture, the rest of its block is.
    await tapAll(page, [[4, 5], [4, 6], [5, 4], [6, 4]]);
    await tap(page, 5, 5, 'right');
    for (const [r, c] of [[4, 4], [5, 5], [5, 6], [6, 5], [6, 6]]) await expectMark(page, r, c, 'shade');
    await expect(page.locator('#count')).toHaveText('5 shaded');
  });

  test('a right-click on a number its count doesn\'t settle changes nothing, and nothing flashes', async ({ page }) => {
    await tap(page, 5, 5, 'right');
    await expect(page.locator('#count')).toHaveText('0 shaded');
    for (const [r, c] of [[4, 4], [5, 5], [6, 6]]) await expectMark(page, r, c, 'clear');
    await expect(page.locator('#undo')).toBeDisabled();
    expect(await page.locator('#board').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  });

  test('with a mouse there\'s no Cycle | Fill switch — a right-click is the fill', async ({ page }) => {
    await expect(page.locator('#mosaic-switch')).toBeHidden();
  });

  test('a right-click never opens the browser\'s menu', async ({ page }) => {
    const prevented = await page.locator('#grid').evaluate(el => {
      const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 1, clientY: 1 });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(prevented).toBe(true);
  });

  test('the keys move the square in focus, and tap and fill it', async ({ page }) => {
    await page.locator('#grid').focus();
    await expect(page.locator('#said')).toHaveText('Row 7, column 7, number 5, clear');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await expectMark(page, 5, 5, 'blank');
    await expect(page.locator('#said')).toHaveText('Row 6, column 6, number 5, left blank');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('f');
    await expectMark(page, 1, 3, 'blank');
  });

  test('only the keys\' focus wears a ring — a tap never does', async ({ page }) => {
    const BAND = '31,111,92';
    await tap(page, 3, 3);
    await expectMark(page, 3, 3, 'blank');
    expect((await look(page, 3, 3)).edge).not.toBe(BAND);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await look(page, 3, 4)).edge).toBe(BAND);
  });

  test('every square right melts the numbers and lines away to the picture, and the title becomes its name', async ({ page }) => {
    const cells = answer(BOARD);
    await tapAll(page, [[1, 1]]);
    await tapAll(page, shade(cells.slice(1)));
    await expect(page.locator('#complete')).toBeHidden();
    await tapAll(page, shade(cells.slice(0, 1)));
    await expect(page.locator('#complete')).toBeVisible();
    await expect(page.locator('#complete')).toHaveText('Solved — it\'s Robot 20.');
    await expect(page.locator('#title')).toHaveText('Robot 20');
    await expect(page).toHaveTitle('Robot 20 · Grew Puzzles');
    await expect(page.locator('#play')).toHaveAttribute('data-solved', 'true');
    await expect(page.locator('#board')).toHaveClass(/pop/);
    // Melted: a numbered square, a blank one and the line between two clear squares are all plain white.
    await expect.poll(async () => (await look(page, 0, 4)).middle).toBe(WHITE);
    expect((await look(page, 0, 4)).fill).toBe(WHITE);
    expect((await look(page, 1, 1)).middle).toBe(WHITE);
    expect((await look(page, 1, 2)).edge).toBe(WHITE);
    expect((await look(page, 0, 0)).middle).toBe(INK);
    await expect(page.locator('#undo')).toBeDisabled();
    // Solved, the board takes no more taps.
    await tap(page, 1, 2);
    await expect(page.locator('#count')).toHaveText(cells.length + ' shaded');
    expect((await look(page, 1, 2)).middle).toBe(WHITE);
  });

  test('the corner button flips to the answer, and back with the player\'s squares intact', async ({ page }) => {
    await tapAll(page, [[0, 1], [0, 2], [0, 2]]);
    await page.click('#flip');
    await expect(page.locator('#card')).toHaveClass(/flipped/);
    await expect(page.locator('#flip')).toHaveAttribute('aria-label', 'Back to puzzle');
    for (const [r, c] of answer(BOARD).slice(0, 6)) expect((await look(page, r, c, '#solution-grid')).fill).toBe(INK);
    expect((await look(page, 1, 5, '#solution-grid')).fill).toBe(WHITE);
    await page.click('#flip');
    await expect(page.locator('#card')).not.toHaveClass(/flipped/);
    await expectMark(page, 0, 1, 'blank');
    await expectMark(page, 0, 2, 'shade');
  });

  test('a board that fits whole never zooms', async ({ page }) => {
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'false');
    await expect(page.locator('#zoom-in')).toBeHidden();
    await expect(page.locator('#zoom-out')).toBeHidden();
  });
});

// Check and Undo, under the board, as minesweeper's. On MOSA-0001, (0,0) is in the picture and (0,1)
// isn't; the 0 at (0,4) leaves six squares blank.
test.describe('Check and Undo', () => {
  test.beforeEach(async ({ page }) => { await open(page); });

  const line = page => page.locator('#check-line');

  test('a square shaded that isn\'t in the picture, and a blank on one that is, are ringed in red, and the line says 2 mistakes', async ({ page }) => {
    await tapAll(page, [[0, 1], [0, 1], [0, 0], [0, 4]]);
    await page.click('#check');
    await expect(line(page)).toBeVisible();
    await expect(line(page)).toHaveText('2 mistakes');
    await expect.poll(async () => (await look(page, 0, 1)).edge).toBe(RED);
    expect((await look(page, 0, 0)).edge).toBe(RED);
    expect((await look(page, 0, 4)).edge).not.toBe(RED);
    expect((await look(page, 0, 2)).edge).not.toBe(RED);
    const board = await page.locator('#stage').boundingBox();
    const said = await line(page).boundingBox();
    expect(said.y).toBeGreaterThan(board.y + board.height);
  });

  test('every square right rings nothing and says No mistakes so far; the next tap clears the rings and the line', async ({ page }) => {
    await tapAll(page, [[0, 1], [0, 0], [0, 0]]);
    await page.click('#check');
    await expect(line(page)).toHaveText('No mistakes so far');
    await tapAll(page, [[0, 1]]);
    await page.click('#check');
    await expect(line(page)).toHaveText('1 mistake');
    await tap(page, 3, 3);
    await expect(line(page)).toBeHidden();
    await expect.poll(async () => (await look(page, 0, 1)).edge).not.toBe(RED);
  });

  test('Undo takes back the last tap, then the one before, and greys out at the first', async ({ page }) => {
    await expect(page.locator('#undo')).toBeDisabled();
    await tapAll(page, [[0, 1], [0, 1]]);
    await page.click('#undo');
    await expectMark(page, 0, 1, 'blank');
    await page.click('#undo');
    await expectMark(page, 0, 1, 'clear');
    await expect(page.locator('#undo')).toBeDisabled();
  });

  test('a fill is one tap to take back', async ({ page }) => {
    await tap(page, 0, 4, 'right');
    await expectMark(page, 1, 5, 'blank');
    await page.click('#undo');
    for (const [r, c] of [[0, 3], [0, 4], [1, 5]]) await expectMark(page, r, c, 'clear');
    await expect(page.locator('#undo')).toBeDisabled();
  });
});

test.describe('a 198×198 mosaic', () => {
  test('opens zoomed in on its middle, its squares 36px, and zooms out to the whole board', async ({ page }) => {
    await open(page, 'MOSA-0002');
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'true');
    const [cell, vx, vy] = (await page.locator('#play').getAttribute('data-view')).split(' ').map(Number);
    expect(cell).toBe(36);
    expect(vx).toBeGreaterThan(80);
    expect(vy).toBeGreaterThan(80);
    await expect(page.locator('#zoom-out')).toBeEnabled();
    while (await page.locator('#zoom-out').isEnabled()) await page.click('#zoom-out');
    const whole = Number((await page.locator('#play').getAttribute('data-view')).split(' ')[0]);
    const frame = await page.locator('#view').boundingBox();
    expect(whole * 198).toBeCloseTo(frame.width, 0);
  });

  test('a drag moves round it and marks nothing; a tap after marks the square under it', async ({ page }) => {
    await open(page, 'MOSA-0002');
    const before = await page.locator('#play').getAttribute('data-view');
    const box = await page.locator('#grid').boundingBox();
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 120, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('#play')).not.toHaveAttribute('data-view', before);
    await expect(page.locator('#count')).toHaveText('0 shaded');
    await expect(page.locator('#undo')).toBeDisabled();
    const [, vx, vy] = (await page.locator('#play').getAttribute('data-view')).split(' ').map(Number);
    const r = Math.ceil(vy) + 2, c = Math.ceil(vx) + 2;
    await tapAll(page, [[r, c], [r, c]]);
    await expectMark(page, r, c, 'shade');
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the Squares card sits under the board, and Cycle | Fill right under it', async ({ page }) => {
    await open(page);
    const card = await page.locator('#stage').boundingBox();
    const tools = await page.locator('#mosaic-switch').boundingBox();
    const side = await page.locator('#mosaic-card').boundingBox();
    expect(tools.y).toBeGreaterThan(card.y + card.height - 1);
    expect(side.y).toBeGreaterThan(tools.y);
    expect(card.x + card.width).toBeLessThanOrEqual(390);
  });

  test('with Fill picked, a tap on a number fills, and on any other square cycles', async ({ page }) => {
    await open(page);
    const tapAt = async (r, c) => page.locator('#grid').tap({ position: await spot(page, r, c) });
    await expect(page.locator('#tool-cycle')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#tool-fill').tap();
    await expect(page.locator('#tool-fill')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tool-cycle')).toHaveAttribute('aria-pressed', 'false');
    await tapAt(0, 4);
    for (const [r, c] of [[0, 3], [1, 5]]) await expectMark(page, r, c, 'blank');
    await tapAt(3, 1);
    await expectMark(page, 3, 1, 'blank');
    await page.locator('#tool-cycle').tap();
    await tapAt(0, 4);
    await expectMark(page, 0, 4, 'shade');
  });

  test('a 198×198 opens zoomed, inside the screen', async ({ page }) => {
    await open(page, 'MOSA-0002');
    await expect(page.locator('#play')).toHaveAttribute('data-zoomable', 'true');
    const frame = await page.locator('#view').boundingBox();
    expect(frame.width).toBeLessThanOrEqual(390);
  });
});

test('an address naming no mosaic says so', async ({ page }) => {
  await page.goto('/app/mosaic.html?id=MOSA-001');
  await expect(page.locator('#title')).toHaveText('Puzzle not found');
  await expect(page.locator('#missing')).toBeVisible();
  await expect(page.locator('#play')).toBeHidden();
});
