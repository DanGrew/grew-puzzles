const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');

// The Scorecard (app/scorecard.html): every published puzzle as a line with a box, ticked once the
// signed-in player has finished it — the same ✓ its browse tile wears — grouped By kind, By type or
// By difficulty. Supabase is stood in for, as in done.test.js: a wordsearch is finished by every one
// of its lines saved, a board by its row saying so. Every wordsearch file is the test puzzle; which
// ones are opened is counted, and so is every read of the player's progress.
const SUPABASE = 'https://vxschtygvtilsadgixec.supabase.co';
const SESSION_KEY = 'sb-vxschtygvtilsadgixec-auth-token';
const CORS = {
  'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*',
  'access-control-expose-headers': '*',
};
const PLAYER = {
  id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated',
  email: 'pat@example.com', app_metadata: { provider: 'google' },
  user_metadata: { full_name: 'Pat Player' }, created_at: '2026-10-04T00:00:00Z',
};
const LINES = PUZZLE.words.map(w => ({ page: w.grid, start_row: w.start.row, start_col: w.start.col, direction: w.direction }));
const TABLES = ['progress', 'maze_found', 'maze_position', 'mines_marks', 'criss_words', 'mosaic_squares'];

const part = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const code = (prefix, n) => `${prefix}-${String(n).padStart(4, '0')}`;

function session(user) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = [part({ alg: 'HS256', typ: 'JWT' }), part({ sub: user.id, exp: expires, role: 'authenticated' }), 'sig'];
  return { access_token: token.join('.'), token_type: 'bearer', expires_in: 3600, expires_at: expires, refresh_token: 'refresh', user };
}

// Puzzle n of a kind was saved n days into the year, so the highest is the newest.
const entry = (prefix, n, type, extra = {}) => ({
  hiddenId: code(prefix, n), type, created: new Date(Date.UTC(2026, 0, n)).toISOString().slice(0, 10), title: `${prefix} ${n}`, ...extra,
});

// Ten wordsearches, Vanilla and Missing by turns; three mazes; two boards; a criss-cross; no mosaics.
function indexes() {
  return {
    wordsearch: Array.from({ length: 10 }, (_, i) => entry('WSCH', i + 1, ['Missing', 'Vanilla'][(i + 1) % 2])),
    maze: [entry('MAZE', 1, 'Keys'), entry('MAZE', 2, 'Vanilla'), entry('MAZE', 3, 'Vanilla', { difficulty: 'Hard' })],
    minesweeper: [entry('MINE', 1, 'Vanilla', { difficulty: 'Medium' }), entry('MINE', 2, 'Reveal', { difficulty: 'Hard' })],
    crisscross: [entry('CRSS', 1, 'Vanilla')],
    mosaic: [],
  };
}

const finishedLines = puzzle => LINES.map(line => ({ puzzle, ...line, found_at: '2026-10-04T00:00:00+00:00' }));
const board = (puzzle, finished) => ({ puzzle, mines: [[0, 0]], no_mines: [], finished, tapped_at: '2026-10-04T00:00:00+00:00' });

async function site(context, { served = indexes(), rows = {}, signedIn = true, delay = 0 } = {}) {
  const db = { rows: { progress: [], maze_found: [], maze_position: [], mines_marks: [], criss_words: [], mosaic_squares: [], ...rows }, reads: [], strays: [] };
  const opened = [];
  await context.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === '/auth/v1/user') return route.fulfill({ headers: CORS, json: PLAYER });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });
    const table = url.pathname.replace('/rest/v1/', '');
    const token = (request.headers().authorization || '').replace('Bearer ', '');
    if (!TABLES.includes(table) || request.method() !== 'GET' || !token.includes('.')) {
      db.strays.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    db.reads.push(table);
    await wait(delay);
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Math.min(Number(url.searchParams.get('limit') || 1000), 1000);
    return route.fulfill({ headers: CORS, json: db.rows[table].slice(offset, offset + limit) });
  });
  // No mosaics unless a test serves some, so the site's own published ones never count.
  for (const [kind, puzzles] of Object.entries({ mosaic: [], ...served })) {
    await context.route(`**/content/puzzles/${kind}/index.json`, async r => {
      await wait(delay);
      return r.fulfill({ json: { puzzles } });
    });
  }
  await context.route('**/content/collections/index.json', r => r.fulfill({ status: 404, body: 'Not found' }));
  await context.route(/\/content\/puzzles\/wordsearch\/WSCH-\d+\.json$/, async r => {
    opened.push(r.request().url().match(/WSCH-\d+/)[0]);
    await wait(delay);
    return r.fulfill({ json: PUZZLE });
  });
  if (signedIn) await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [SESSION_KEY, JSON.stringify(session(PLAYER))]);
  return { db, opened };
}

async function scorecard(context) {
  const page = await context.newPage();
  await page.goto('/app/scorecard.html');
  await expect(page.locator('.score-group').first()).toBeVisible();
  return page;
}

const groups = page => page.locator('.score-group');
const heads = page => page.locator('.score-group h2');
const counts = page => page.locator('.score-group .count');
const line = (page, title) => page.locator('.score-line').filter({ has: page.locator('.title', { hasText: new RegExp(`^${title}$`) }) });
const tickedTitles = page => page.locator('.score-line[data-done="true"] .title').allInnerTexts();

const FINISHED = () => ({
  progress: [...finishedLines('WSCH-0005'), ...finishedLines('WSCH-0009'), ...finishedLines('WSCH-0004').slice(0, 2)],
  mines_marks: [board('MINE-0001', true), board('MINE-0002', false)],
});

test('signed in, every finished puzzle is ticked, its title greyed, and the total counts them', async ({ context }) => {
  const { db } = await site(context, { rows: FINISHED() });
  const page = await scorecard(context);
  await expect(page.locator('#total')).toHaveText('3 of 16 finished');
  await expect.poll(() => tickedTitles(page)).toEqual(['WSCH 5', 'WSCH 9', 'MINE 1']);
  await expect(line(page, 'WSCH 4')).toHaveAttribute('data-done', 'false');
  await expect(line(page, 'WSCH 4').locator('.box')).toHaveAttribute('aria-label', 'Not finished');
  await expect(line(page, 'WSCH 9').locator('.box')).toHaveAttribute('aria-label', 'Finished');
  const grey = await line(page, 'WSCH 9').locator('.title').evaluate(el => getComputedStyle(el).color);
  const plain = await line(page, 'WSCH 4').locator('.title').evaluate(el => getComputedStyle(el).color);
  expect([grey, plain]).toEqual(['rgb(76, 102, 96)', 'rgb(15, 42, 36)']);
  await expect(page.locator('#sign-in-line')).toBeHidden();
  expect(db.strays).toEqual([]);
});

test('By kind opens picked: a group a kind in the side bar\'s order, counting finished of total, each line its type', async ({ context }) => {
  await site(context, { rows: FINISHED() });
  const page = await scorecard(context);
  await expect(page.locator('#tabs [role="tab"]')).toHaveText(['By kind', 'By type', 'By difficulty']);
  await expect(page.locator('#tabs [aria-selected="true"]')).toHaveText('By kind');
  await expect(heads(page)).toHaveText(['Wordsearches', 'Mazes', 'Minesweeper', 'Criss-cross']);
  await expect(counts(page)).toHaveText(['2 / 10', '0 / 3', '1 / 2', '0 / 1']);
  // Browse's order, eight shown: Easy Vanilla, then Hard Missing, each by title.
  await expect(groups(page).first().locator('.title')).toHaveText(['WSCH 1', 'WSCH 3', 'WSCH 5', 'WSCH 7', 'WSCH 9', 'WSCH 10', 'WSCH 2', 'WSCH 4']);
  await expect(line(page, 'MAZE 3').locator('.pill')).toHaveText('Vanilla');
  await expect(line(page, 'MAZE 3').locator('.pill')).toHaveAttribute('data-tone', 'Hard');
  await expect(line(page, 'MAZE 3').locator('.code')).toHaveText('MAZE-0003');
});

test('By type: each heading names its kind and its type, coloured by the type\'s difficulty; each line its difficulty', async ({ context }) => {
  await site(context, { rows: FINISHED() });
  const page = await scorecard(context);
  await page.getByRole('tab', { name: 'By type' }).click();
  await expect(page.locator('#tabs [aria-selected="true"]')).toHaveText('By type');
  await expect(heads(page)).toHaveText([
    'Wordsearches · Vanilla', 'Wordsearches · Missing', 'Mazes · Vanilla', 'Mazes · Keys',
    'Minesweeper · Vanilla', 'Minesweeper · Reveal', 'Criss-cross · Vanilla',
  ]);
  const tone = await groups(page).nth(1).locator('.group-head').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(tone).toBe('rgb(246, 180, 122)');
  await expect(line(page, 'MINE 2').locator('.pill')).toHaveText('Hard');
});

test('By difficulty: Easy, Medium, Hard in their colours, each line its kind and type', async ({ context }) => {
  await site(context, { rows: FINISHED() });
  const page = await scorecard(context);
  await page.getByRole('tab', { name: 'By difficulty' }).click();
  await expect(heads(page)).toHaveText(['Easy', 'Medium', 'Hard']);
  await expect(counts(page)).toHaveText(['2 / 7', '1 / 1', '0 / 8']);
  await expect(line(page, 'MAZE 1').locator('.pill')).toHaveText('Maze · Keys');
  const easy = await groups(page).first().locator('.group-head').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(easy).toBe('rgb(159, 216, 174)');
});

test('a group every puzzle of which is finished turns its count white, with a ✓', async ({ context }) => {
  await site(context, { rows: { mines_marks: [board('MINE-0001', true), board('MINE-0002', true)] } });
  const page = await scorecard(context);
  const mines = counts(page).nth(2);
  await expect(mines).toHaveText('2 / 2');
  await expect(mines).toHaveAttribute('data-all', 'true');
  expect(await mines.evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el, '::before').content]))
    .toEqual(['rgb(255, 255, 255)', '"✓ "']);
  await expect(counts(page).first()).toHaveAttribute('data-all', 'false');
});

test('a group longer than eight shows eight and Show all; Show all shows the rest, then Show fewer', async ({ context }) => {
  await site(context);
  const page = await scorecard(context);
  const words = groups(page).first();
  await expect(words.locator('.score-line')).toHaveCount(8);
  await expect(words.locator('.more')).toHaveText('Show all 10');
  await expect(groups(page).nth(1).locator('.more')).toBeHidden();
  await words.locator('.more').click();
  await expect(words.locator('.score-line')).toHaveCount(10);
  await expect(words.locator('.more')).toHaveText('Show fewer');
  await expect(words.locator('.more')).toBeFocused();
  await words.locator('.more').click();
  await expect(words.locator('.score-line')).toHaveCount(8);
});

test('tapping a title opens its play page', async ({ context }) => {
  await site(context);
  const page = await scorecard(context);
  await expect(line(page, 'MAZE 1')).toHaveAttribute('href', 'maze.html?id=MAZE-0001');
  await expect(line(page, 'MINE 1')).toHaveAttribute('href', 'minesweeper.html?id=MINE-0001');
  await expect(line(page, 'CRSS 1')).toHaveAttribute('href', 'crisscross.html?id=CRSS-0001');
  await line(page, 'WSCH 10').locator('.title').click();
  await expect(page).toHaveURL(/\/app\/play\.html\?id=WSCH-0010$/);
});

test('signed out: the total is the number of puzzles, every box empty, and a line to sign in', async ({ context }) => {
  const { db } = await site(context, { rows: FINISHED(), signedIn: false });
  const page = await scorecard(context);
  await expect(page.locator('#sign-in-line')).toBeVisible();
  await expect(page.locator('#sign-in-line')).toHaveText('Sign in to tick off what you finish.');
  await expect(page.locator('#total')).toHaveText('16 puzzles');
  await expect(counts(page)).toHaveText(['10', '3', '2', '1']);
  expect(await tickedTitles(page)).toEqual([]);
  await page.locator('#score-sign-in').click();
  await expect(page.locator('.sign-in-card')).toBeVisible();
  expect(db.reads).toEqual([]);
  expect(db.strays).toEqual([]);
});

test('a puzzle is ticked here exactly when its browse tile wears a ✓', async ({ context }) => {
  await site(context, { rows: FINISHED() });
  const page = await scorecard(context);
  await expect.poll(() => tickedTitles(page)).toHaveLength(3);
  const ticked = (await tickedTitles(page)).filter(t => t.startsWith('WSCH'));
  await page.goto('/app/');
  await expect(page.locator('#tiles .tile[data-done="true"]')).toHaveCount(ticked.length);
  expect((await page.locator('#tiles .tile[data-done="true"] .name').allInnerTexts()).sort()).toEqual(ticked.sort());
});

test('finishing a puzzle and coming back to the list ticks it and moves its counts and the total', async ({ context }) => {
  const rows = FINISHED();
  await site(context, { rows });
  const page = await scorecard(context);
  await expect(page.locator('#total')).toHaveText('3 of 16 finished');
  rows.progress.push(...finishedLines('WSCH-0004').slice(2));
  await page.goto('/app/scorecard.html');
  await expect(page.locator('#total')).toHaveText('4 of 16 finished');
  await expect(line(page, 'WSCH 4')).toHaveAttribute('data-done', 'true');
  await expect(counts(page).first()).toHaveText('3 / 10');
});

test('the side bar holds Scorecard under Collections, with no score, current on the page itself', async ({ context }) => {
  await site(context, { rows: FINISHED() });
  const page = await scorecard(context);
  const entry = page.locator('#site-side .side-scorecard');
  await expect(entry).toHaveText('Scorecard');
  await expect(entry).toHaveAttribute('href', 'scorecard.html');
  await expect(entry).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#site-side [aria-current="page"]')).toHaveText(['Scorecard']);
  await page.goto('/app/');
  await expect(page.locator('#site-side .side-scorecard')).toHaveAttribute('aria-current', 'false');
  await page.locator('#site-side .side-scorecard').click();
  await expect(page).toHaveURL(/\/app\/scorecard\.html$/);
});

test('on a desktop each line shows its code; the page never scrolls sideways', async ({ context }) => {
  await site(context);
  const page = await scorecard(context);
  await expect(line(page, 'WSCH 10').locator('.code')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the code is dropped, the side bar sits behind the burger, and nothing runs past the screen', async ({ context }) => {
    await site(context);
    const page = await scorecard(context);
    await expect(line(page, 'WSCH 10').locator('.code')).toBeHidden();
    await expect(page.locator('#site-side')).toBeHidden();
    await expect(page.locator('.site .burger')).toBeVisible();
    await page.getByRole('tab', { name: 'By difficulty' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const tabs = await page.locator('#tabs').boundingBox();
    expect(tabs.x + tabs.width).toBeLessThanOrEqual(390);
  });
});

// The spec's risk: the list reads every puzzle and all of the player's progress at once. Over a few
// hundred puzzles it opens without a visible wait, and the player's progress is read once, a table
// at a time — never once per puzzle. 600 puzzles, 450 of them finished: 150 wordsearches by their
// lines, whose files are the only ones opened, and 300 boards by their rows; every index, read and
// file 150 ms away, as over a slow connection.
test('600 puzzles, 450 finished: the list draws at once, the ticks follow quickly, and progress is read once a table', async ({ context }) => {
  const served = {
    wordsearch: Array.from({ length: 200 }, (_, i) => entry('WSCH', i + 1, ['Missing', 'Vanilla'][(i + 1) % 2])),
    maze: Array.from({ length: 50 }, (_, i) => entry('MAZE', i + 1, 'Vanilla')),
    minesweeper: Array.from({ length: 300 }, (_, i) => entry('MINE', i + 1, 'Vanilla', { difficulty: 'Easy' })),
    crisscross: Array.from({ length: 50 }, (_, i) => entry('CRSS', i + 1, 'Vanilla')),
    mosaic: [],
  };
  const rows = {
    progress: Array.from({ length: 150 }, (_, i) => finishedLines(code('WSCH', i + 1))).flat(),
    mines_marks: Array.from({ length: 300 }, (_, i) => board(code('MINE', i + 1), true)),
  };
  const { db, opened } = await site(context, { served, rows, delay: 150 });
  const page = await context.newPage();
  const start = Date.now();
  await page.goto('/app/scorecard.html');
  await expect(page.locator('.score-group').first()).toBeVisible();
  const drawn = Date.now() - start;
  await expect(page.locator('#total')).toHaveText('450 of 600 finished');
  const ticked = Date.now() - start;
  console.log(`Scorecard, 600 puzzles: list drawn in ${drawn} ms, 450 ticks in ${ticked} ms`);
  expect(drawn).toBeLessThan(1500);
  expect(ticked).toBeLessThan(3000);
  // Each table read once — 1200 wordsearch lines is two pages of 1000 — and only the started wordsearches' files opened.
  expect(db.reads.sort()).toEqual(['criss_words', 'maze_found', 'maze_position', 'mines_marks', 'mosaic_squares', 'progress', 'progress']);
  expect(opened).toHaveLength(150);
  // Long groups still draw eight lines each until Show all.
  await expect(page.locator('.score-line')).toHaveCount(32);
  await page.getByRole('tab', { name: 'By difficulty' }).click();
  await expect(counts(page)).toHaveText(['375 / 500', '75 / 100']);
});
