const { test, expect } = require('@playwright/test');
// Saved maze progress: the maze page saves a signed-in player's place and finds, and the landing
// and collection pages tick a finished maze's tile. Supabase is stood in for — nothing here
// reaches it: maze_position keeps one place per player and maze, saved over only by an upsert;
// maze_found keeps each find once, refusing it a second time as Postgres does (409, 23505), and
// answers a read of them all a range at a time. On demand it cuts the connection, or slows or
// fails the next save. A signed-in player is a session already in the browser, as Supabase keeps
// it; signing in itself is sign-in.test.js's. The maze is the fixture with every element, served
// as MAZE-0001 — a guide, two collectibles, Key 1 and its zone, A, B and C, and six exits, the
// right one CBA — and MAZE-0003, a 100×100.
const MAZE = require('./fixtures/MAZE-0001.json');
const HUNDRED = require('./fixtures/MAZE-0003.json');
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

// A place, and a find, as the tables hold them — a find with the time the database stamped on it;
// moved is a place with its own. placesSaved is the places saved, without their times.
const place = (r, c, puzzle = 'MAZE-0001', user = PLAYER.id) => ({ user_id: user, puzzle, cell_row: r, cell_col: c });
const moved = (r, c, puzzle, movedAt) => ({ ...place(r, c, puzzle), moved_at: movedAt });
const find = (r, c, puzzle = 'MAZE-0001', user = PLAYER.id, foundAt = '2026-10-09T00:00:00+00:00') => ({ user_id: user, puzzle, cell_row: r, cell_col: c, found_at: foundAt });
const placesSaved = db => db.position.map(({ moved_at, ...row }) => row);

// lines are the wordsearch's progress table, read only; failPlaces refuses every read of the places,
// as a database without moved_at would.
function mazeTables({ position = [], found = [], lines = [], failPlaces = false } = {}) {
  return { position: [...position], found: [...found], lines: [...lines], failPlaces, reads: [], saves: [], strays: [], offline: false, slowNext: 0, failNext: 0, loseNext: '' };
}

const TABLES = { '/rest/v1/maze_position': 'position', '/rest/v1/maze_found': 'found' };
const sameKey = (a, b, keys) => keys.every(k => a[k] === b[k]);

// The player is whoever the request's token names; a request with no player's token — signed out —
// or to any other table is a stray. The wordsearch's progress table answers every read with the
// player's lines.
async function standInForSupabase(context, db) {
  await context.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === '/auth/v1/user') return route.fulfill({ headers: CORS, json: PLAYER });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });
    const token = (request.headers().authorization || '').replace('Bearer ', '');
    if (url.pathname === '/rest/v1/progress' && request.method() === 'GET' && token.includes('.')) return route.fulfill({ headers: CORS, json: db.lines });
    const table = TABLES[url.pathname];
    if (!table || !token.includes('.')) {
      db.strays.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    if (db.offline) return route.abort('internetdisconnected');
    const player = claims(token).sub;
    if (request.method() === 'GET') return read(route, db, table, player, url.searchParams);
    return save(route, db, table, { user_id: player, ...request.postDataJSON() }, request.headers().prefer || '');
  });
}

// A read answers with only the columns it selects, as PostgREST does.
async function read(route, db, table, player, params) {
  const puzzle = (params.get('puzzle') || '').replace('eq.', '');
  db.reads.push({ table, puzzle, order: params.get('order') });
  if (table === 'position' && db.failPlaces) {
    return route.fulfill({ status: 400, headers: CORS, json: { code: '42703', message: 'column maze_position.moved_at does not exist' } });
  }
  const offset = Number(params.get('offset') || 0);
  const limit = Math.min(Number(params.get('limit') || 1000), 1000);
  const columns = (params.get('select') || '').split(',').map(c => c.trim());
  const rows = db[table].filter(r => r.user_id === player && (!puzzle || r.puzzle === puzzle))
    .slice(offset, offset + limit).map(row => Object.fromEntries(columns.filter(c => c in row).map(c => [c, row[c]])));
  return route.fulfill({ headers: CORS, json: rows });
}

async function save(route, db, table, row, prefer) {
  db.saves.push({ table, row });
  if (db.failNext > 0) {
    db.failNext -= 1;
    return route.abort('internetdisconnected');
  }
  const slow = db.slowNext;
  db.slowNext = 0;
  await wait(slow);
  const keys = { position: ['user_id', 'puzzle'], found: ['user_id', 'puzzle', 'cell_row', 'cell_col'] }[table];
  const there = db[table].findIndex(r => sameKey(r, row, keys));
  const over = table === 'position' && prefer.includes('resolution=merge-duplicates');
  if (there >= 0 && !over) {
    return route.fulfill({ status: 409, headers: CORS, json: { code: '23505', message: 'duplicate key value violates unique constraint' } });
  }
  // The database stamps each save's time, whatever the page sent.
  const stamped = { ...row, [table === 'found' ? 'found_at' : 'moved_at']: new Date().toISOString() };
  if (there >= 0) db[table][there] = stamped;
  else db[table].push(stamped);
  // Saved, but its answer lost on the way back.
  if (db.loseNext === table) {
    db.loseNext = '';
    return route.abort('connectionreset');
  }
  return route.fulfill({ status: 201, headers: CORS, body: '' });
}

async function playing(context, { signedIn = true, db = mazeTables() } = {}) {
  await standInForSupabase(context, db);
  await context.addInitScript(() => localStorage.setItem('grew-puzzles.look', 'plain'));
  await context.route('**/content/puzzles/maze/MAZE-0001.json', route => route.fulfill({ json: MAZE }));
  await context.route('**/content/puzzles/maze/MAZE-0003.json', route => route.fulfill({ json: HUNDRED }));
  if (signedIn) await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [SESSION_KEY, JSON.stringify(session(PLAYER))]);
  // Every text the line under the checklist shows, as it shows it.
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

async function open(context, id = 'MAZE-0001') {
  const page = await context.newPage();
  await page.goto('/app/maze.html?id=' + id);
  await expect(page.locator('#play')).toBeVisible();
  return page;
}

const cell = (page, r, c) => page.locator(`#grid [data-cell="${r},${c}"]`);
const stop = (page, id) => page.locator(`#grid [data-stop="${id}"]`);
const pad = (page, press) => page.locator(`#pad [data-press="${press}"]`);
const line = (page, text) => page.locator('#checklist li').filter({ has: page.locator('.line-text', { hasText: new RegExp(`^${text}$`) }) });
const saveLine = page => page.locator('#save-line');
const hint = page => page.locator('#save-hint');
const note = page => page.locator('#save-note');
const count = page => page.locator('#count');

async function tapAll(page, cells) {
  for (const [r, c] of cells) await cell(page, r, c).click();
}

async function press(page, ...presses) {
  for (const p of presses) await pad(page, p).click();
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

// Every cell with something on it: found, the maze is finished.
const EVERYTHING = [...MAZE.guides, ...MAZE.collectibles, ...MAZE.keys, ...MAZE.letters, ...MAZE.exits].map(s => [s.row, s.col]);

test('signed in, a run that stops saves where I am and what I found right then — there is no save button', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await expect(page.getByRole('button', { name: /save/i })).toHaveCount(0);
  await press(page, 'S');
  await expect.poll(() => placesSaved(db)).toEqual([place(2, 0)]);
  expect(db.found).toEqual([]);
  await press(page, 'S', 'E');
  await expect.poll(() => placesSaved(db)).toEqual([place(3, 1)]);
  await expect.poll(() => db.found.map(({ found_at, ...f }) => f)).toEqual([place(3, 1)]);
  await expect(saveLine(page)).toBeHidden();
});

test('a tap saves too, and Back saves where it went back to', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, [[0, 1], [0, 2], [0, 3]]);
  await expect.poll(() => placesSaved(db)).toEqual([place(0, 3)]);
  await expect.poll(() => db.found.length).toBe(1);
  await press(page, 'back');
  await expect.poll(() => placesSaved(db)).toEqual([place(0, 2)]);
  expect(db.found).toHaveLength(1);
});

test('reloading, the trail runs from the start to exactly where I was, and everything found is ticked and faded — down a branch I backed out of too', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  // Up to C, back to the start, then down past B's corridor to the guide.
  await tapAll(page, [[0, 1], [0, 2], [0, 3], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1]]);
  const walked = await trail(page);
  expect(walked).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1]]);
  await expect(count(page)).toHaveText('2/12');
  await expect.poll(() => placesSaved(db)).toEqual([place(4, 1)]);
  await expect.poll(() => db.found.length).toBe(2);

  await page.reload();
  await expect(page.locator('#play')).toBeVisible();
  expect(await trail(page)).toEqual(walked);
  await expect(count(page)).toHaveText('2/12');
  await expect(line(page, 'C')).toHaveClass(/\bdone\b/);
  await expect(line(page, 'Guides')).toHaveClass(/\bdone\b/);
  await expect(stop(page, 'letter-C')).toHaveClass(/\bgot\b/);
  await expect(stop(page, 'guide-0')).toHaveClass(/\bgot\b/);
  await expect(stop(page, 'letter-B')).not.toHaveClass(/\bgot\b/);
  await expect(page.locator('#here')).toHaveAttribute('cx', '1.5');
  await expect(page.locator('#here')).toHaveAttribute('cy', '4.5');
});

test('coming back to a half-played maze, the boxes match what I\'d found', async ({ context }) => {
  await playing(context, { db: mazeTables({ position: [place(3, 0)], found: [find(2, 1), find(0, 5)] }) });
  const page = await open(context);
  const ticks = text => line(page, text).locator('.box').evaluateAll(boxes => boxes.map(b => b.classList.contains('ticked')));
  await expect.poll(() => ticks('Collectibles')).toEqual([true, false]);
  await expect.poll(() => ticks('Keys')).toEqual([true]);
  await expect.poll(() => ticks('Guides')).toEqual([false]);
});

test('coming back to a half-played maze, the dashes run to everything I\'d found', async ({ context }) => {
  await playing(context, { db: mazeTables({ position: [place(3, 0)], found: [find(2, 1), find(0, 3)] }) });
  const page = await open(context);
  expect(await trail(page)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
  await expect(page.locator('#collected')).toHaveAttribute('d', 'M0.5,2.5L1.5,2.5M0.5,0.5L1.5,0.5M1.5,0.5L2.5,0.5M2.5,0.5L3.5,0.5');
});

test('Back after a reload goes back a run at a time, as it did before', async ({ context }) => {
  await playing(context, { db: mazeTables({ position: [place(5, 5)] }) });
  const page = await open(context);
  expect(await trail(page)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [4, 3], [5, 3], [5, 4], [5, 5]]);
  await press(page, 'back');
  expect(await trail(page)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2]]);
  await press(page, 'back');
  expect(await trail(page)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1]]);
});

test('opening the maze on another device puts me where I was, with everything I found', async ({ browser }) => {
  const db = mazeTables();
  const laptop = await browser.newContext();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await playing(laptop, { db });
  await playing(phone, { db });
  const there = await open(laptop);
  await press(there, 'S', 'S', 'E');
  await expect.poll(() => placesSaved(db)).toEqual([place(3, 1)]);
  await expect.poll(() => db.found.length).toBe(1);

  const here = await open(phone);
  expect(await trail(here)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]]);
  await expect(line(here, 'B')).toHaveClass(/\bdone\b/);
  await laptop.close();
  await phone.close();
});

test('the maze waits for what was saved, and first shows with it already in place', async ({ context }) => {
  await playing(context, { db: mazeTables({ position: [place(3, 1)], found: [find(3, 1), find(0, 3)] }) });
  await context.addInitScript(() => {
    new MutationObserver((_, watching) => {
      const play = document.getElementById('play');
      if (!play || play.hidden) return;
      window.firstShown = { count: document.getElementById('count').textContent, trail: document.getElementById('trail').getAttribute('points') };
      watching.disconnect();
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });
  const page = await open(context);
  expect(await page.evaluate(() => window.firstShown)).toEqual({ count: '2/12', trail: '0.5,0.5 0.5,1.5 0.5,2.5 0.5,3.5 1.5,3.5' });
});

test('after a reload, a held key still opens its zone, and the exits reached still show their ✓ or ✗', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, [...solutionCells(), ...OTHER_EXITS.slice(0, 7)]);
  await expect(line(page, 'ACB').locator('.mark')).toHaveText('✗');
  await expect.poll(() => placesSaved(db)).toEqual([place(1, 5)]);
  await expect.poll(() => db.found.length).toBe(9);

  await page.reload();
  await expect(page.locator('#play')).toBeVisible();
  await expect(page.locator('#marks [data-key="1"]')).toHaveClass(/\bopen\b/);
  await expect(line(page, 'Keys')).toHaveClass(/\bdone\b/);
  await expect(stop(page, 'exit-CBA')).toHaveAttribute('data-mark', '✓');
  await expect(line(page, 'CBA').locator('.mark')).toHaveText('✓');
  await expect(stop(page, 'exit-ACB')).toHaveAttribute('data-mark', '✗');
  await expect(line(page, 'ACB').locator('.mark')).toHaveText('✗');
  await expect(stop(page, 'exit-ABC')).toHaveAttribute('data-mark', '');
  // Back through the zone: the key still opens it.
  await tapAll(page, [[0, 4], [0, 3], [0, 2], [1, 2]]);
  expect((await trail(page)).slice(-1)).toEqual([[1, 2]]);
});

test('a finished maze reopens finished, and doesn\'t celebrate again', async ({ context }) => {
  await playing(context, { db: mazeTables({ position: [place(2, 4)], found: EVERYTHING.map(([r, c]) => find(r, c)) }) });
  const page = await open(context);
  await expect(count(page)).toHaveText('12/12');
  await expect(page.locator('#complete')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator('#board .spark')).toHaveCount(0);
  await expect(page.locator('#board')).not.toHaveClass(/\bpop\b/);
});

// The middle is 167 cells' walk from the start, in the top-left corner.
test('a big maze opens zoomed in on where I was, not the start', async ({ context }) => {
  await playing(context, { db: mazeTables({ position: [place(50, 50, 'MAZE-0003')] }) });
  const page = await open(context, 'MAZE-0003');
  const walked = await trail(page);
  expect([walked.length, walked[0], walked[walked.length - 1]]).toEqual([167, [0, 0], [50, 50]]);
  const frame = await page.locator('#view').boundingBox();
  const here = await page.locator('#here').boundingBox();
  expect(Math.abs(here.x + here.width / 2 - (frame.x + frame.width / 2))).toBeLessThan(20);
  expect(Math.abs(here.y + here.height / 2 - (frame.y + frame.height / 2))).toBeLessThan(20);
});

test('only my own place and finds come back, and only this maze\'s', async ({ context }) => {
  const db = mazeTables({
    position: [place(5, 5, 'MAZE-0001', SOMEONE_ELSE), place(0, 5, 'MAZE-0002')],
    found: [find(0, 3, 'MAZE-0001', SOMEONE_ELSE), find(4, 1, 'MAZE-0002')],
  });
  await playing(context, { db });
  const page = await open(context);
  expect(await trail(page)).toEqual([[0, 0]]);
  await expect(count(page)).toHaveText('0/12');
  expect(db.reads.map(r => [r.table, r.puzzle]).sort()).toEqual([['found', 'MAZE-0001'], ['position', 'MAZE-0001']]);
});

test('moving fast, the place saved last is where I am — an older one never lands over it', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.slowNext = 1500;
  await press(page, 'S');
  await press(page, 'S', 'E');
  await expect.poll(() => placesSaved(db), { timeout: 5000 }).toEqual([place(3, 1)]);
  await page.waitForTimeout(500);
  expect(placesSaved(db)).toEqual([place(3, 1)]);
  expect(db.saves.filter(s => s.table === 'position').length).toBeLessThan(4);
});

test('signed out, the maze plays as normal, the quiet line shows under the checklist, and nothing is saved — Supabase never asked', async ({ context }) => {
  const db = await playing(context, { signedIn: false });
  const page = await open(context);
  await expect(hint(page)).toHaveText(HINT);
  await expect(hint(page)).toBeVisible();
  await expect(note(page)).toBeHidden();
  const list = await page.locator('#checklist-card .words-box').boundingBox();
  const slip = await saveLine(page).boundingBox();
  expect(slip.y).toBeGreaterThanOrEqual(list.y + list.height);
  await press(page, 'S', 'S', 'E');
  await expect(count(page)).toHaveText('1/12');

  await page.reload();
  await expect(page.locator('#play')).toBeVisible();
  expect(await trail(page)).toEqual([[0, 0]]);
  await expect(count(page)).toHaveText('0/12');
  expect(db).toMatchObject({ position: [], found: [], reads: [], saves: [], strays: [] });
});

test('on a phone, signed out, the line sits under the checklist, at the foot of the page', async ({ browser }) => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await playing(phone, { signedIn: false });
  const page = await open(phone);
  await expect(hint(page)).toBeVisible();
  const list = await page.locator('#checklist-card .words-box').boundingBox();
  const slip = await saveLine(page).boundingBox();
  expect(slip.y).toBeGreaterThanOrEqual(list.y + list.height);
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

test('signed in, there is no line under the checklist', async ({ context }) => {
  await playing(context);
  const page = await open(context);
  await press(page, 'S', 'S', 'E');
  await page.waitForTimeout(300);
  await expect(saveLine(page)).toBeHidden();
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

test('with the connection off, play carries on and a note says the maze isn\'t saved; back on, the note goes and it is', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.offline = true;
  await press(page, 'S', 'S', 'E');
  await expect(count(page)).toHaveText('1/12');
  await expect(note(page)).toHaveText(NOTE);
  await expect(note(page)).toBeVisible();
  await expect(hint(page)).toBeHidden();
  await press(page, 'back');
  expect(await trail(page)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);

  db.offline = false;
  await expect(saveLine(page)).toBeHidden({ timeout: 5000 });
  await expect.poll(() => placesSaved(db)).toEqual([place(3, 0)]);
  await expect.poll(() => db.found.length).toBe(1);
  await page.close();
  const later = await open(context);
  expect(await trail(later)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
  await expect(line(later, 'B')).toHaveClass(/\bdone\b/);
});

test('a save that fails once and lands on its retry says nothing', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.failNext = 1;
  await press(page, 'S');
  await expect.poll(() => placesSaved(db), { timeout: 5000 }).toEqual([place(2, 0)]);
  await page.waitForTimeout(300);
  expect(db.saves).toHaveLength(2);
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

test('a find whose answer is lost is tried again, refused as already saved, and counts once', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.loseNext = 'found';
  await press(page, 'S', 'S', 'E');
  await expect.poll(() => db.saves.filter(s => s.table === 'found').length, { timeout: 5000 }).toBe(2);
  await page.waitForTimeout(300);
  expect(db.found).toHaveLength(1);
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

test('something found before, walked over again, is never saved twice', async ({ context }) => {
  const db = await playing(context, { db: mazeTables({ found: [find(0, 3)] }) });
  const page = await open(context);
  await tapAll(page, [[0, 1], [0, 2], [0, 3], [0, 0]]);
  await tapAll(page, [[0, 1], [0, 2], [0, 3]]);
  await expect.poll(() => placesSaved(db)).toEqual([place(0, 3)]);
  await page.waitForTimeout(300);
  expect(db.found).toHaveLength(1);
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

// B was found on another device, and the place saved there was by it.
test('signing in mid-maze: having moved, my place here is kept and saved, and what I found elsewhere joins it', async ({ context }) => {
  const db = mazeTables({ position: [place(3, 1)], found: [find(3, 1)] });
  await playing(context, { signedIn: false, db });
  const page = await open(context);
  await tapAll(page, [[0, 1], [0, 2], [0, 3]]);
  await signIn(page);

  await expect(saveLine(page)).toBeHidden();
  await expect(count(page)).toHaveText('2/12');
  await expect(line(page, 'B')).toHaveClass(/\bdone\b/);
  expect(await trail(page)).toEqual([[0, 0], [0, 1], [0, 2], [0, 3]]);
  await expect.poll(() => placesSaved(db)).toEqual([place(0, 3)]);
  await expect.poll(() => db.found.length).toBe(2);
});

test('signing in mid-maze without having moved picks the maze up where I left it', async ({ context }) => {
  const db = mazeTables({ position: [place(3, 1)], found: [find(3, 1), find(0, 3)] });
  await playing(context, { signedIn: false, db });
  const page = await open(context);
  await signIn(page);

  await expect(count(page)).toHaveText('2/12');
  await expect.poll(() => trail(page)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]]);
  await page.waitForTimeout(300);
  expect(placesSaved(db)).toEqual([place(3, 1)]);
  expect(db.saves).toEqual([]);
});

test('signing out mid-maze brings the line back, and moves after aren\'t saved', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await press(page, 'S');
  await expect.poll(() => placesSaved(db)).toEqual([place(2, 0)]);
  await page.locator('.site .avatar').click();
  await page.locator('#account-menu .sign-out').click();
  await expect(hint(page)).toBeVisible();
  await press(page, 'S', 'E');
  await expect(count(page)).toHaveText('1/12');
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

// ---- The ✓ on a finished maze's tile ----

const MAZES = { puzzles: [
  { hiddenId: 'MAZE-0001', type: 'Keylecticodes', created: '2026-10-08', title: 'Everything corner' },
  { hiddenId: 'MAZE-0002', type: 'Keylecticodes', created: '2026-10-07', title: 'Half done' },
  { hiddenId: 'MAZE-0004', type: 'Keylecticodes', created: '2026-10-06', title: 'Untouched' },
] };

async function site(context, { db, signedIn = true, collections = [] } = {}) {
  const opened = [];
  await playing(context, { db, signedIn });
  await context.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: {
    puzzles: [{ hiddenId: 'WSCH-0007', type: 'Vanilla', created: '2026-10-02', title: 'Farmyard' }],
  } }));
  await context.route('**/content/puzzles/wordsearch/WSCH-0007.json', r => r.fulfill({ json: WORDSEARCH }));
  await context.route('**/content/puzzles/maze/index.json', r => r.fulfill({ json: MAZES }));
  await context.route(/\/content\/puzzles\/maze\/MAZE-000[124]\.json$/, r => {
    opened.push(r.request().url().match(/MAZE-\d+/)[0]);
    return r.fulfill({ json: MAZE });
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
  const marks = await Promise.all(tiles.map(async t => [await t.locator('.name').innerText(), await t.evaluate(el => getComputedStyle(el, '::after').content)]));
  return marks.filter(([, mark]) => mark === TICK).map(([title]) => title);
}

async function landing(context, path) {
  const page = await context.newPage();
  await page.goto(path);
  await expect(page.locator('#tiles .tile').first()).toBeVisible();
  return page;
}

const finishedRows = (puzzle, cells = EVERYTHING) => cells.map(([r, c]) => find(r, c, puzzle));

test('a maze with everything found, all six exits included, wears a ✓ in Mazes; one short of an exit doesn\'t', async ({ context }) => {
  const allButBCA = EVERYTHING.filter(([r, c]) => !(r === 2 && c === 4));
  const db = mazeTables({ found: [...finishedRows('MAZE-0001'), ...finishedRows('MAZE-0002', allButBCA)] });
  const opened = await site(context, { db });
  const page = await landing(context, '/app/?kind=maze');
  await expect(tile(page, 'Everything corner')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Everything corner']);
  await expect(tile(page, 'Half done')).toHaveAttribute('data-done', 'false');
  expect(opened.sort()).toEqual(['MAZE-0001', 'MAZE-0002']);
  expect(db.reads.filter(r => r.table === 'found')).toEqual([{ table: 'found', puzzle: '', order: 'puzzle.asc,cell_row.asc,cell_col.asc' }]);
  expect(db.strays).toEqual([]);
});

test('a finished maze wears its ✓ on a collection page, and its collection\'s tile once every puzzle in it is finished', async ({ context }) => {
  const collections = [
    { slug: 'mazes', name: 'mazes', description: 'Only mazes', created: '2026-12-31', puzzles: [{ id: 'MAZE-0001', number: 1 }] },
    { slug: 'mixed', name: 'mixed', description: 'A maze and a wordsearch', created: '2026-12-31', puzzles: [{ id: 'MAZE-0001', number: 1 }, { id: 'WSCH-0007', number: 2 }] },
  ];
  await site(context, { db: mazeTables({ found: finishedRows('MAZE-0001') }), collections });
  const page = await landing(context, '/app/collection.html?slug=mixed');
  await expect(tile(page, 'Everything corner')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Everything corner']);
  const shelf = await landing(context, '/app/?kind=collections');
  await expect(tile(shelf, 'mazes')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(shelf)).toEqual(['mazes']);
});

test('finishing a maze, then going back to Mazes, its ✓ is there', async ({ context }) => {
  await site(context);
  const page = await landing(context, '/app/?kind=maze');
  await tile(page, 'Everything corner').click();
  await expect(page.locator('#play')).toBeVisible();
  await tapAll(page, [...solutionCells(), ...OTHER_EXITS]);
  await expect(page.locator('#complete')).toBeVisible();
  await page.waitForTimeout(500);
  await page.goBack();
  await expect(tile(page, 'Everything corner')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Everything corner']);
});

test('signed out, no maze tile wears a ✓ and nothing is read', async ({ context }) => {
  const db = mazeTables({ found: finishedRows('MAZE-0001') });
  const opened = await site(context, { db, signedIn: false });
  const page = await landing(context, '/app/?kind=maze');
  await page.waitForTimeout(500);
  expect(await tickedTitles(page)).toEqual([]);
  expect(db.reads).toEqual([]);
  expect(opened).toEqual([]);
});

// ---- Continue playing and Finished ----

const railTitles = page => page.locator('#rail .tile .name').allInnerTexts();
const tileTitles = page => page.locator('#tiles .tile .name').allInnerTexts();
// A wordsearch line, as the progress table holds it — started, nowhere near finished.
const wordLine = foundAt => ({ user_id: PLAYER.id, puzzle: 'WSCH-0007', page: 0, start_row: 0, start_col: 0, direction: 'E', found_at: foundAt });

test('signed in, moving off a maze\'s start and leaving, back on Mazes it sits in Continue playing', async ({ context }) => {
  const db = mazeTables();
  await site(context, { db });
  const page = await landing(context, '/app/?kind=maze');
  await expect(page.locator('#rail')).toBeHidden();
  await tile(page, 'Half done').click();
  await expect(page.locator('#play')).toBeVisible();
  await tapAll(page, solutionCells().slice(0, 1));
  await expect.poll(() => db.position.length).toBe(1);
  await page.goBack();
  await expect.poll(() => railTitles(page)).toEqual(['Half done']);
  await expect(page.locator('#rail .tile')).toHaveAttribute('href', 'maze.html?id=MAZE-0002');
});

test('each kind\'s rail holds only its own, the one played most recently first — a maze by the later of its last move and last find; Collections\' holds both', async ({ context }) => {
  const db = mazeTables({
    lines: [wordLine('2026-10-09T10:00:00+00:00')],
    // Half done: moved in last, nothing found — the newest of all. Untouched: back on its start,
    // but something found since — played at its find.
    position: [moved(3, 1, 'MAZE-0002', '2026-10-09T12:00:00+00:00'), moved(0, 0, 'MAZE-0004', '2026-10-09T08:00:00+00:00')],
    found: [find(0, 1, 'MAZE-0004', PLAYER.id, '2026-10-09T11:00:00+00:00')],
  });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=maze');
  await expect.poll(() => railTitles(page)).toEqual(['Half done', 'Untouched']);
  expect(db.reads.filter(r => r.table === 'position')).toEqual([{ table: 'position', puzzle: '', order: 'puzzle.asc' }]);
  const wordsearches = await landing(context, '/app/');
  await expect.poll(() => railTitles(wordsearches)).toEqual(['Farmyard']);
  const collections = [{ slug: 'mixed', name: 'mixed', description: 'Both kinds', created: '2026-12-31', puzzles: [{ id: 'MAZE-0001', number: 1 }] }];
  await context.route('**/content/collections/index.json', r => r.fulfill({ json: { collections } }));
  const shelf = await landing(context, '/app/?kind=collections');
  await expect.poll(() => railTitles(shelf)).toEqual(['Half done', 'Untouched', 'Farmyard']);
  expect(db.strays).toEqual([]);
});

test('a maze only opened, its place still the start and nothing found, isn\'t in Continue playing', async ({ context }) => {
  const db = mazeTables({ position: [moved(0, 0, 'MAZE-0002', '2026-10-09T12:00:00+00:00')] });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=maze');
  await expect.poll(() => db.reads.length).toBe(2);
  await page.waitForTimeout(300);
  await expect(page.locator('#rail')).toBeHidden();
});

test('a finished maze, all six exits included, leaves Continue playing and shows under Finished; Not finished shows the rest', async ({ context }) => {
  const db = mazeTables({
    position: [moved(2, 4, 'MAZE-0001', '2026-10-09T12:00:00+00:00'), moved(3, 1, 'MAZE-0002', '2026-10-09T11:00:00+00:00')],
    found: finishedRows('MAZE-0001'),
  });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=maze&finished=yes');
  await expect.poll(() => tileTitles(page)).toEqual(['Everything corner']);
  await expect.poll(() => railTitles(page)).toEqual(['Half done']);
  const rest = await landing(context, '/app/?kind=maze&finished=no');
  await expect.poll(() => tileTitles(rest)).toEqual(['Half done', 'Untouched']);
});

test('when the places can\'t be read, mazes with finds still show in Continue playing and the ticks still come', async ({ context }) => {
  const allButBCA = EVERYTHING.filter(([r, c]) => !(r === 2 && c === 4));
  const db = mazeTables({
    failPlaces: true,
    position: [moved(3, 1, 'MAZE-0004', '2026-10-09T12:00:00+00:00')],
    found: [...finishedRows('MAZE-0001'), ...finishedRows('MAZE-0002', allButBCA)],
  });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=maze');
  await expect.poll(() => railTitles(page)).toEqual(['Half done']);
  await expect(tile(page, 'Everything corner')).toHaveAttribute('data-done', 'true');
});

test('signed out, there\'s no rail and no maze place is read', async ({ context }) => {
  const db = mazeTables({ position: [moved(3, 1, 'MAZE-0002', '2026-10-09T12:00:00+00:00')] });
  await site(context, { db, signedIn: false });
  const page = await landing(context, '/app/?kind=maze');
  await page.waitForTimeout(500);
  await expect(page.locator('#rail')).toBeHidden();
  expect(db.reads).toEqual([]);
});
