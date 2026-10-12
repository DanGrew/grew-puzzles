const { test, expect } = require('@playwright/test');
// Saved minesweeper progress: the minesweeper page saves a signed-in player's marks as they tap, and
// the landing and collection pages tick a finished board's tile, and hold a started one under
// Continue playing. Supabase is stood in for — nothing here reaches it: mines_marks keeps one row
// per player and board, saved over only by an upsert, the database stamping tapped_at on each; on
// demand it cuts the connection, or slows or fails the next save. The wordsearch's progress table
// the maze tables and the criss-cross table answer reads only. A signed-in player is a session already in the browser, as
// Supabase keeps it; signing in itself is sign-in.test.js's. The boards are the fixtures, served as
// MINE-0001 — a 10×10 Easy of 15 mines — MINE-0003, the same board again, and MINE-0002, a 40×40
// Hard.
const BOARD = require('./fixtures/MINE-0001.json');
const BIG = require('./fixtures/MINE-0002.json');
const MAZE = require('./fixtures/MAZE-0001.json');
const WORDSEARCH = require('./fixtures/WSCH-0007.json');

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
const SOMEONE_ELSE = '00000000-0000-4000-8000-000000000002';
const HINT = 'Sign in to save your progress — or just play.';
const NOTE = 'Progress not saved — reconnecting';

const part = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function session(user) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = [part({ alg: 'HS256', typ: 'JWT' }), part({ sub: user.id, exp: expires, role: 'authenticated' }), 'sig'];
  return { access_token: token.join('.'), token_type: 'bearer', expires_in: 3600, expires_at: expires, refresh_token: 'refresh', user };
}

// A board's row as the table holds it, and as the page saves it — without its time.
const marks = (mines, noMines, { puzzle = 'MINE-0001', finished = false, user = PLAYER.id, tappedAt = '2026-10-12T00:00:00+00:00' } = {}) =>
  ({ user_id: user, puzzle, mines, no_mines: noMines, finished, tapped_at: tappedAt });
const saved = (mines, noMines, finished = false, puzzle = 'MINE-0001') => ({ user_id: PLAYER.id, puzzle, mines, no_mines: noMines, finished });
const boardsSaved = db => db.boards.map(({ tapped_at, ...row }) => row);

// lines are the wordsearch's progress table, finds and places the maze tables, shapes the
// criss-cross table, all read only.
function minesTable({ boards = [], lines = [], finds = [], places = [], shapes = [] } = {}) {
  return { boards: [...boards], lines, finds, places, shapes, reads: [], saves: [], strays: [], offline: false, slowNext: 0, failNext: 0 };
}

const READ_ONLY = { '/rest/v1/progress': 'lines', '/rest/v1/maze_found': 'finds', '/rest/v1/maze_position': 'places', '/rest/v1/criss_words': 'shapes' };

// The player is whoever the request's token names; a request with no player's token — signed out —
// or to any other table is a stray.
async function standInForSupabase(context, db) {
  await context.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === '/auth/v1/user') return route.fulfill({ headers: CORS, json: PLAYER });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });
    const token = (request.headers().authorization || '').replace('Bearer ', '');
    const other = READ_ONLY[url.pathname];
    if (other && request.method() === 'GET' && token.includes('.')) return route.fulfill({ headers: CORS, json: db[other] });
    if (url.pathname !== '/rest/v1/mines_marks' || !token.includes('.')) {
      db.strays.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    if (db.offline) return route.abort('internetdisconnected');
    const player = claims(token).sub;
    if (request.method() === 'GET') return read(route, db, player, url.searchParams);
    return save(route, db, { user_id: player, ...request.postDataJSON() }, request.headers().prefer || '');
  });
}

// A read answers with only the columns it selects, as PostgREST does.
async function read(route, db, player, params) {
  const puzzle = (params.get('puzzle') || '').replace('eq.', '');
  db.reads.push({ puzzle, order: params.get('order') });
  const columns = (params.get('select') || '').split(',').map(c => c.trim());
  const rows = db.boards.filter(r => r.user_id === player && (!puzzle || r.puzzle === puzzle))
    .map(row => Object.fromEntries(columns.filter(c => c in row).map(c => [c, row[c]])));
  return route.fulfill({ headers: CORS, json: rows });
}

async function save(route, db, row, prefer) {
  db.saves.push(row);
  if (db.failNext > 0) {
    db.failNext -= 1;
    return route.abort('internetdisconnected');
  }
  const slow = db.slowNext;
  db.slowNext = 0;
  await wait(slow);
  const there = db.boards.findIndex(r => r.user_id === row.user_id && r.puzzle === row.puzzle);
  if (there >= 0 && !prefer.includes('resolution=merge-duplicates')) {
    return route.fulfill({ status: 409, headers: CORS, json: { code: '23505', message: 'duplicate key value violates unique constraint' } });
  }
  // The database stamps each save's time, whatever the page sent.
  const stamped = { ...row, tapped_at: new Date().toISOString() };
  if (there >= 0) db.boards[there] = stamped;
  else db.boards.push(stamped);
  return route.fulfill({ status: 201, headers: CORS, body: '' });
}

async function playing(context, { signedIn = true, db = minesTable() } = {}) {
  await standInForSupabase(context, db);
  await context.addInitScript(() => localStorage.setItem('grew-puzzles.look', 'plain'));
  await context.route(/\/content\/puzzles\/minesweeper\/MINE-000[13]\.json$/, route => route.fulfill({ json: BOARD }));
  await context.route('**/content/puzzles/minesweeper/MINE-0002.json', route => route.fulfill({ json: BIG }));
  if (signedIn) await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [SESSION_KEY, JSON.stringify(session(PLAYER))]);
  // Every text the line under the Mines card shows, as it shows it.
  await context.addInitScript(() => {
    window.lineShown = [];
    new MutationObserver(() => {
      const line = document.getElementById('save-line');
      const now = line && !line.hidden ? line.innerText.trim() : '';
      if (now && window.lineShown[window.lineShown.length - 1] !== now) window.lineShown.push(now);
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  return db;
}

async function open(context, id = 'MINE-0001') {
  const page = await context.newPage();
  await page.goto('/app/minesweeper.html?id=' + id);
  await expect(page.locator('#play')).toBeVisible();
  return page;
}

const square = (page, r, c, cols = 10) => page.locator('#grid .mines-square').nth(r * cols + c);
const markOf = (page, r, c, cols) => square(page, r, c, cols).getAttribute('data-mark');
const count = page => page.locator('#count');
const saveLine = page => page.locator('#save-line');
const hint = page => page.locator('#save-hint');
const note = page => page.locator('#save-note');
const MINES = BOARD.mines.map(m => [m.row, m.col]);

async function tapAll(page, cells, cols) {
  for (const [r, c] of cells) await square(page, r, c, cols).click();
}

test('signed in, every tap saves the whole board — there is no save button', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await expect(page.getByRole('button', { name: /save/i })).toHaveCount(0);
  await tapAll(page, [[0, 0]]);
  await expect.poll(() => boardsSaved(db)).toEqual([saved([], [[0, 0]])]);
  await tapAll(page, [[0, 0], [5, 0]]);
  await expect.poll(() => boardsSaved(db)).toEqual([saved([[0, 0]], [[5, 0]])]);
  await tapAll(page, [[0, 0], [0, 0]]);
  await expect.poll(() => boardsSaved(db)).toEqual([saved([], [[0, 0], [5, 0]])]);
  await expect(saveLine(page)).toBeHidden();
});

test('a number\'s fill is saved with every square it filled; a tap that changes nothing saves nothing', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  // The 1 at (0,2) touches three blank squares, (0,1), (0,3) and (1,2) — its one mine is (0,3).
  await tapAll(page, [[0, 3], [0, 3]]);
  await expect.poll(() => boardsSaved(db)).toEqual([saved([[0, 3]], [])]);
  const before = db.saves.length;
  await tapAll(page, [[0, 2]]);
  await expect.poll(() => boardsSaved(db)).toEqual([saved([[0, 3]], [[0, 1], [1, 2]])]);
  expect(db.saves.length).toBe(before + 1);
  await tapAll(page, [[0, 2]]);
  await page.waitForTimeout(300);
  expect(db.saves.length).toBe(before + 1);
});

test('reloading, my mines and dots are back where I left them, and the count with them', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, [[0, 0], [0, 3], [0, 3], [9, 6]]);
  await expect(count(page)).toHaveText('1/15');
  await expect.poll(() => boardsSaved(db)).toEqual([saved([[0, 3]], [[0, 0], [9, 6]])]);

  await page.reload();
  await expect(page.locator('#play')).toBeVisible();
  await expect(count(page)).toHaveText('1/15');
  expect([await markOf(page, 0, 0), await markOf(page, 0, 3), await markOf(page, 9, 6), await markOf(page, 5, 0)]).toEqual(['dot', 'mine', 'dot', 'blank']);
});

test('opening the board on another device, my mines and dots are back where I left them', async ({ browser }) => {
  const db = minesTable();
  const laptop = await browser.newContext();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await playing(laptop, { db });
  await playing(phone, { db });
  const there = await open(laptop);
  await tapAll(there, [[0, 3], [0, 3], [1, 4], [1, 4], [5, 0]]);
  await expect.poll(() => boardsSaved(db)).toEqual([saved([[0, 3], [1, 4]], [[5, 0]])]);

  const here = await open(phone);
  await expect(count(here)).toHaveText('2/15');
  expect([await markOf(here, 0, 3), await markOf(here, 1, 4), await markOf(here, 5, 0)]).toEqual(['mine', 'mine', 'dot']);
  await laptop.close();
  await phone.close();
});

test('the board waits for what was saved, and first shows with it already in place', async ({ context }) => {
  await playing(context, { db: minesTable({ boards: [marks([[0, 3], [1, 4]], [[0, 0]])] }) });
  await context.addInitScript(() => {
    new MutationObserver((_, watching) => {
      const play = document.getElementById('play');
      if (!play || play.hidden) return;
      window.firstShown = { count: document.getElementById('count').textContent, first: document.querySelector('#grid .mines-square').dataset.mark };
      watching.disconnect();
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });
  const page = await open(context);
  expect(await page.evaluate(() => window.firstShown)).toEqual({ count: '2/15', first: 'dot' });
});

test('finishing the board saves it finished; it reopens finished, takes no taps and doesn\'t celebrate again', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, MINES.flatMap(cell => [cell, cell]));
  await expect(page.locator('#complete')).toBeVisible();
  await expect.poll(() => boardsSaved(db)).toEqual([saved([...MINES].sort((a, b) => a[0] - b[0] || a[1] - b[1]), [], true)]);

  await page.reload();
  await expect(page.locator('#play')).toBeVisible();
  await expect(count(page)).toHaveText('15/15');
  await expect(page.locator('#complete')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator('#board .spark')).toHaveCount(0);
  await expect(page.locator('#board')).not.toHaveClass(/\bpop\b/);
  const before = db.saves.length;
  await tapAll(page, [[0, 0]]);
  await page.waitForTimeout(300);
  expect(await markOf(page, 0, 0)).toBe('blank');
  expect(db.saves.length).toBe(before);
});

test('a big board\'s marks come back too', async ({ context }) => {
  await playing(context, { db: minesTable({ boards: [marks([[20, 20]], [[20, 21]], { puzzle: 'MINE-0002' })] }) });
  const page = await open(context, 'MINE-0002');
  expect([await markOf(page, 20, 20, 40), await markOf(page, 20, 21, 40)]).toEqual(['mine', 'dot']);
});

test('only my own board comes back, and only this board\'s', async ({ context }) => {
  const db = minesTable({ boards: [marks([[0, 3]], [], { user: SOMEONE_ELSE }), marks([[1, 4]], [], { puzzle: 'MINE-0003' })] });
  await playing(context, { db });
  const page = await open(context);
  await expect(count(page)).toHaveText('0/15');
  expect(db.reads).toEqual([{ puzzle: 'MINE-0001', order: null }]);
});

test('tapping fast, the board saved last is the one on screen — an older save never lands over it', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.slowNext = 1500;
  const cells = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [0, 0]];
  await tapAll(page, cells);
  await expect.poll(() => boardsSaved(db), { timeout: 5000 }).toEqual([saved([[0, 0]], [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]])]);
  await page.waitForTimeout(500);
  expect(boardsSaved(db)).toEqual([saved([[0, 0]], [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]])]);
  expect(db.saves.length).toBeLessThan(cells.length);
});

test('signed out, the board plays as normal, the quiet line shows under the Mines card, and nothing is saved — Supabase never asked', async ({ context }) => {
  const db = await playing(context, { signedIn: false });
  const page = await open(context);
  await expect(hint(page)).toHaveText(HINT);
  await expect(hint(page)).toBeVisible();
  await expect(note(page)).toBeHidden();
  const card = await page.locator('#mines-card .words-box').boundingBox();
  const slip = await saveLine(page).boundingBox();
  expect(slip.y).toBeGreaterThanOrEqual(card.y + card.height);
  await tapAll(page, [[0, 3], [0, 3]]);
  await expect(count(page)).toHaveText('1/15');

  await page.reload();
  await expect(page.locator('#play')).toBeVisible();
  await expect(count(page)).toHaveText('0/15');
  expect(db).toMatchObject({ boards: [], reads: [], saves: [], strays: [] });
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'grew-puzzles.look'))).toEqual([]);
});

test('on a phone, signed out, the line sits under the Mines card, inside the screen', async ({ browser }) => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await playing(phone, { signedIn: false });
  const page = await open(phone);
  await expect(hint(page)).toBeVisible();
  const card = await page.locator('#mines-card .words-box').boundingBox();
  const slip = await saveLine(page).boundingBox();
  expect(slip.y).toBeGreaterThanOrEqual(card.y + card.height);
  expect(slip.x).toBeGreaterThanOrEqual(0);
  expect(slip.x + slip.width).toBeLessThanOrEqual(390);
  await phone.close();
});

test('the line\'s Sign in opens the sign-in card', async ({ context }) => {
  await playing(context, { signedIn: false });
  await context.route('https://accounts.google.com/**', route => route.abort());
  const page = await open(context);
  await page.locator('#save-sign-in').click();
  await expect(page.locator('#sign-in-card')).toBeVisible();
});

test('signed in, there is no line under the Mines card', async ({ context }) => {
  await playing(context);
  const page = await open(context);
  await tapAll(page, [[0, 0]]);
  await page.waitForTimeout(300);
  await expect(saveLine(page)).toBeHidden();
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

test('with the connection off, play carries on and a note says the board isn\'t saved; back on, the note goes and it is', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.offline = true;
  await tapAll(page, [[0, 3], [0, 3], [5, 0]]);
  await expect(count(page)).toHaveText('1/15');
  await expect(note(page)).toHaveText(NOTE);
  await expect(note(page)).toBeVisible();
  await expect(hint(page)).toBeHidden();

  db.offline = false;
  await expect(saveLine(page)).toBeHidden({ timeout: 5000 });
  await expect.poll(() => boardsSaved(db)).toEqual([saved([[0, 3]], [[5, 0]])]);
  await page.close();
  const later = await open(context);
  await expect(count(later)).toHaveText('1/15');
});

test('a save that fails once and lands on its retry says nothing', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.failNext = 1;
  await tapAll(page, [[0, 0]]);
  await expect.poll(() => boardsSaved(db), { timeout: 5000 }).toEqual([saved([], [[0, 0]])]);
  await page.waitForTimeout(300);
  expect(db.saves).toHaveLength(2);
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

test('signing in mid-board having marked squares: my marks here are kept and saved over the ones from elsewhere', async ({ context }) => {
  const db = minesTable({ boards: [marks([[1, 4]], [])] });
  await playing(context, { signedIn: false, db });
  const page = await open(context);
  await tapAll(page, [[0, 3], [0, 3]]);
  await signIn(page);

  await expect(saveLine(page)).toBeHidden();
  await expect.poll(() => boardsSaved(db)).toEqual([saved([[0, 3]], [])]);
  await expect(count(page)).toHaveText('1/15');
  expect([await markOf(page, 0, 3), await markOf(page, 1, 4)]).toEqual(['mine', 'blank']);
});

test('signing in mid-board without having marked anything picks the board up where I left it', async ({ context }) => {
  const db = minesTable({ boards: [marks([[1, 4]], [[0, 0]])] });
  await playing(context, { signedIn: false, db });
  const page = await open(context);
  await signIn(page);

  await expect(count(page)).toHaveText('1/15');
  await expect.poll(() => markOf(page, 0, 0)).toBe('dot');
  await page.waitForTimeout(300);
  expect(db.saves).toEqual([]);
});

test('signing out mid-board brings the line back, and taps after aren\'t saved', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, [[0, 0]]);
  await expect.poll(() => db.saves.length).toBe(1);
  await page.locator('.site .avatar').click();
  await page.locator('#account-menu .sign-out').click();
  await expect(hint(page)).toBeVisible();
  await tapAll(page, [[0, 0], [5, 0]]);
  await page.waitForTimeout(300);
  expect(db.saves).toHaveLength(1);
  expect(db.strays).toEqual([]);
});

async function signIn(page) {
  const signedIn = session(PLAYER);
  await page.evaluate(async tokens => {
    const { client } = await import('/ui/sign-in-ui.js');
    await client.auth.setSession(tokens);
  }, { access_token: signedIn.access_token, refresh_token: signedIn.refresh_token });
}

// ---- The ✓, Continue playing and Finished ----

const BOARDS = { puzzles: [
  { hiddenId: 'MINE-0001', type: 'Vanilla', created: '2026-10-11', title: 'Garden Patch', difficulty: 'Easy', width: 10, height: 10 },
  { hiddenId: 'MINE-0003', type: 'Vanilla', created: '2026-10-10', title: 'Half Marked', difficulty: 'Easy', width: 10, height: 10 },
  { hiddenId: 'MINE-0002', type: 'Vanilla', created: '2026-10-09', title: 'Big Field', difficulty: 'Hard', width: 40, height: 40 },
] };

async function site(context, { db, signedIn = true, collections = [] } = {}) {
  const opened = [];
  await playing(context, { db, signedIn });
  await context.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: {
    puzzles: [{ hiddenId: 'WSCH-0007', type: 'Vanilla', created: '2026-10-02', title: 'Farmyard' }],
  } }));
  await context.route('**/content/puzzles/wordsearch/WSCH-0007.json', r => r.fulfill({ json: WORDSEARCH }));
  await context.route('**/content/puzzles/maze/index.json', r => r.fulfill({ json: { puzzles: [
    { hiddenId: 'MAZE-0001', type: 'Keylecticodes', created: '2026-10-08', title: 'Everything corner' },
  ] } }));
  await context.route('**/content/puzzles/maze/MAZE-0001.json', r => r.fulfill({ json: MAZE }));
  await context.route('**/content/puzzles/minesweeper/index.json', r => r.fulfill({ json: BOARDS }));
  // Every board file a landing page opens — none should be.
  await context.route(/\/content\/puzzles\/minesweeper\/MINE-\d+\.json$/, r => {
    opened.push(r.request().url().match(/MINE-\d+/)[0]);
    return r.fallback();
  });
  await context.route('**/content/collections/index.json', r => r.fulfill(
    collections.length ? { json: { collections } } : { status: 404, body: 'Not found' },
  ));
  return opened;
}

const tile = (page, title) => page.locator('#tiles .tile').filter({ has: page.locator('.name', { hasText: new RegExp(`^${title}$`) }) });
const TICK = '"✓" / "Finished"';
async function tickedTitles(page) {
  const tiles = await page.locator('#tiles .tile').all();
  const ticks = await Promise.all(tiles.map(async t => [await t.locator('.name').innerText(), await t.evaluate(el => getComputedStyle(el, '::after').content)]));
  return ticks.filter(([, mark]) => mark === TICK).map(([title]) => title);
}

async function landing(context, path) {
  const page = await context.newPage();
  await page.goto(path);
  await expect(page.locator('#tiles .tile').first()).toBeVisible();
  return page;
}

const railTitles = page => page.locator('#rail .tile .name').allInnerTexts();
const tileTitles = page => page.locator('#tiles .tile .name').allInnerTexts();
const finishedBoard = (puzzle = 'MINE-0001', tappedAt) => marks(MINES, [], { puzzle, finished: true, tappedAt });

test('a finished board wears a ✓ in Minesweeper, opening no board\'s file; a started one doesn\'t', async ({ context }) => {
  const db = minesTable({ boards: [finishedBoard(), marks([[0, 3]], [], { puzzle: 'MINE-0003' })] });
  const opened = await site(context, { db });
  const page = await landing(context, '/app/?kind=minesweeper');
  await expect(tile(page, 'Garden Patch')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Garden Patch']);
  await expect(tile(page, 'Half Marked')).toHaveAttribute('data-done', 'false');
  expect(opened).toEqual([]);
  expect(db.reads).toEqual([{ puzzle: '', order: 'puzzle.asc' }]);
  expect(db.strays).toEqual([]);
});

test('a finished board wears its ✓ on a collection page, and its collection\'s tile once every puzzle in it is finished', async ({ context }) => {
  const collections = [
    { slug: 'boards', name: 'boards', description: 'Only a board', created: '2026-12-31', puzzles: [{ id: 'MINE-0001', number: 1 }] },
    { slug: 'mixed', name: 'mixed', description: 'A board and a wordsearch', created: '2026-12-31', puzzles: [{ id: 'MINE-0001', number: 1 }, { id: 'WSCH-0007', number: 2 }] },
  ];
  await site(context, { db: minesTable({ boards: [finishedBoard()] }), collections });
  const page = await landing(context, '/app/collection.html?slug=mixed');
  await expect(tile(page, 'Garden Patch')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Garden Patch']);
  const shelf = await landing(context, '/app/?kind=collections');
  await expect(tile(shelf, 'boards')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(shelf)).toEqual(['boards']);
});

test('finishing a board, then going back to Minesweeper, its ✓ is there', async ({ context }) => {
  await site(context);
  const page = await landing(context, '/app/?kind=minesweeper');
  await tile(page, 'Garden Patch').click();
  await expect(page.locator('#play')).toBeVisible();
  await tapAll(page, MINES.flatMap(cell => [cell, cell]));
  await expect(page.locator('#complete')).toBeVisible();
  await page.waitForTimeout(500);
  await page.goBack();
  await expect(tile(page, 'Garden Patch')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Garden Patch']);
});

test('marking a square and leaving, back on Minesweeper the board sits in Continue playing', async ({ context }) => {
  const db = minesTable();
  await site(context, { db });
  const page = await landing(context, '/app/?kind=minesweeper');
  await expect(page.locator('#rail')).toBeHidden();
  await tile(page, 'Half Marked').click();
  await expect(page.locator('#play')).toBeVisible();
  await tapAll(page, [[0, 0]]);
  await expect.poll(() => db.boards.length).toBe(1);
  await page.goBack();
  await expect.poll(() => railTitles(page)).toEqual(['Half Marked']);
  await expect(page.locator('#rail .tile')).toHaveAttribute('href', 'minesweeper.html?id=MINE-0003');
});

test('Minesweeper\'s rail holds only boards, newest first; Collections\' holds them beside wordsearches and mazes, newest first', async ({ context }) => {
  const db = minesTable({
    boards: [
      marks([], [[0, 0]], { puzzle: 'MINE-0003', tappedAt: '2026-10-12T09:00:00+00:00' }),
      marks([[20, 20]], [], { puzzle: 'MINE-0002', tappedAt: '2026-10-12T12:00:00+00:00' }),
    ],
    lines: [{ user_id: PLAYER.id, puzzle: 'WSCH-0007', page: 0, start_row: 0, start_col: 0, direction: 'E', found_at: '2026-10-12T10:00:00+00:00' }],
    places: [{ puzzle: 'MAZE-0001', cell_row: 3, cell_col: 1, moved_at: '2026-10-12T11:00:00+00:00' }],
  });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=minesweeper');
  await expect.poll(() => railTitles(page)).toEqual(['Big Field', 'Half Marked']);
  const collections = [{ slug: 'mixed', name: 'mixed', description: 'Every kind', created: '2026-12-31', puzzles: [{ id: 'MINE-0001', number: 1 }] }];
  await context.route('**/content/collections/index.json', r => r.fulfill({ json: { collections } }));
  const shelf = await landing(context, '/app/?kind=collections');
  await expect.poll(() => railTitles(shelf)).toEqual(['Big Field', 'Everything corner', 'Farmyard', 'Half Marked']);
  expect(db.strays).toEqual([]);
});

test('a board whose every mark was cleared isn\'t in Continue playing', async ({ context }) => {
  const db = minesTable({ boards: [marks([], [], { puzzle: 'MINE-0003' })] });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=minesweeper');
  await expect.poll(() => db.reads.length).toBe(1);
  await page.waitForTimeout(300);
  await expect(page.locator('#rail')).toBeHidden();
});

test('a finished board leaves Continue playing and shows under Finished; Not finished shows the rest', async ({ context }) => {
  const db = minesTable({ boards: [finishedBoard('MINE-0001', '2026-10-12T12:00:00+00:00'), marks([[0, 3]], [], { puzzle: 'MINE-0003' })] });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=minesweeper&finished=yes');
  await expect.poll(() => tileTitles(page)).toEqual(['Garden Patch']);
  await expect.poll(() => railTitles(page)).toEqual(['Half Marked']);
  const rest = await landing(context, '/app/?kind=minesweeper&finished=no');
  await expect.poll(() => tileTitles(rest)).toEqual(['Half Marked', 'Big Field']);
});

test('signed out, no board wears a ✓, there\'s no rail, and nothing is read', async ({ context }) => {
  const db = minesTable({ boards: [finishedBoard(), marks([[0, 3]], [], { puzzle: 'MINE-0003' })] });
  const opened = await site(context, { db, signedIn: false });
  const page = await landing(context, '/app/?kind=minesweeper');
  await page.waitForTimeout(500);
  expect(await tickedTitles(page)).toEqual([]);
  await expect(page.locator('#rail')).toBeHidden();
  expect(db.reads).toEqual([]);
  expect(opened).toEqual([]);
});
