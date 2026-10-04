const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');

// Saved progress on the play page. Supabase is stood in for — nothing here reaches it: the progress
// table keeps each player's rows, refuses a line saved twice as Postgres does (409, 23505), and on
// demand cuts the connection, slows a save, or saves one and loses its answer. A signed-in player is
// a session already in the browser, as Supabase keeps it; signing in itself is sign-in.test.js's.
const SUPABASE = 'https://vxschtygvtilsadgixec.supabase.co';
const SESSION_KEY = 'sb-vxschtygvtilsadgixec-auth-token';
const CORS = {
  'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*',
};
const PLAYER = {
  id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated',
  email: 'pat@example.com', app_metadata: { provider: 'google' },
  user_metadata: { full_name: 'Pat Player' }, created_at: '2026-10-04T00:00:00Z',
};
const HINT = 'Sign in to save your progress — or just play.';
const NOTE = 'Progress not saved — reconnecting';

const COLS = PUZZLE.grids[0].rows[0].length;
// Each word's ends: Cat, Cow, Ewe, Hen, Ice cream, Map, Pig, Piglet.
const ALL_WORDS = [
  [[4, 2], [2, 2]], [[1, 2], [3, 4]], [[5, 0], [5, 2]], [[6, 3], [4, 5]],
  [[0, 0], [0, 7]], [[0, 7], [2, 7]], [[7, 2], [7, 0]], [[1, 0], [6, 0]]
];
const [CAT, COW, EWE, HEN, , MAP] = ALL_WORDS;

const part = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

function session(user) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = [part({ alg: 'HS256', typ: 'JWT' }), part({ sub: user.id, exp: expires, role: 'authenticated' }), 'sig'];
  return { access_token: token.join('.'), token_type: 'bearer', expires_in: 3600, expires_at: expires, refresh_token: 'refresh', user };
}

function progressTable() {
  return { rows: [], reads: [], saves: [], strays: [], offline: false, readDelay: 0, slowNext: 0, failNext: 0, loseNext: false };
}

const sameLine = (a, b) => ['user_id', 'puzzle', 'page', 'start_row', 'start_col', 'direction'].every(k => a[k] === b[k]);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// The player is whoever the request's token names; a request with no player's token — signed out —
// is a stray: the site should never send one.
async function standInForSupabase(context, table) {
  await context.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === '/auth/v1/user') return route.fulfill({ headers: CORS, json: PLAYER });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });
    const token = (request.headers().authorization || '').replace('Bearer ', '');
    if (url.pathname !== '/rest/v1/progress' || !token.includes('.')) {
      table.strays.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    if (table.offline) return route.abort('internetdisconnected');
    const player = claims(token).sub;
    if (request.method() === 'GET') return read(route, table, player, url.searchParams.get('puzzle').replace('eq.', ''));
    return save(route, table, { user_id: player, ...request.postDataJSON() });
  });
}

async function read(route, table, player, puzzle) {
  table.reads.push(puzzle);
  await wait(table.readDelay);
  const rows = table.rows.filter(r => r.user_id === player && r.puzzle === puzzle)
    .map(({ page, start_row, start_col, direction }) => ({ page, start_row, start_col, direction }));
  return route.fulfill({ headers: CORS, json: rows });
}

async function save(route, table, row) {
  table.saves.push(row);
  if (table.failNext > 0) {
    table.failNext -= 1;
    return route.abort('internetdisconnected');
  }
  await wait(table.slowNext);
  table.slowNext = 0;
  const twice = table.rows.some(r => sameLine(r, row));
  if (!twice) table.rows.push(row);
  if (table.loseNext) {
    table.loseNext = false;
    return route.abort('connectionreset');
  }
  return twice
    ? route.fulfill({ status: 409, headers: CORS, json: { code: '23505', message: 'duplicate key value violates unique constraint "progress_pkey"' } })
    : route.fulfill({ status: 201, headers: CORS, body: '' });
}

// Every text the line under the words shows, as it shows it — to tell a note that never came from
// one that came and went.
function watchTheLine(context) {
  return context.addInitScript(() => {
    window.lineShown = [];
    new MutationObserver(() => {
      const line = document.getElementById('save-line');
      const now = line && !line.hidden ? line.innerText.trim() : '';
      if (now && window.lineShown[window.lineShown.length - 1] !== now) window.lineShown.push(now);
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  });
}

async function playing(context, { signedIn = true, puzzle = PUZZLE, table = progressTable(), layout } = {}) {
  await standInForSupabase(context, table);
  await context.route('**/content/puzzles/wordsearch/WSCH-0007.json', route => route.fulfill({ json: puzzle }));
  if (signedIn) await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [SESSION_KEY, JSON.stringify(session(PLAYER))]);
  if (layout) await context.addInitScript(value => localStorage.setItem('grew-puzzles.words-layout', value), layout);
  await watchTheLine(context);
  return table;
}

async function open(context) {
  const page = await context.newPage();
  await page.goto('/app/play.html?id=WSCH-0007');
  await expect(page.locator('#play')).toBeVisible();
  return page;
}

function cell(page, r, c) {
  return page.locator('#grid .cell').nth(r * COLS + c);
}

async function find(page, ...words) {
  for (const ends of words) for (const [r, c] of ends) await cell(page, r, c).click();
}

const count = page => page.locator('#count');
const line = page => page.locator('#save-line');
const hint = page => page.locator('#save-hint');
const note = page => page.locator('#save-note');
const foundLines = page => page.locator('#overlay line.mark-found');
const crossedOff = page => page.locator('#words li.done');
const tab = (page, n) => page.locator('#tabs .tab').nth(n);

test('signed in, three words found come back exactly once the tab is closed and reopened: lined through, crossed off, 3/8', async ({ context }) => {
  const table = await playing(context);
  const page = await open(context);
  await find(page, CAT, COW, EWE);
  await expect(count(page)).toHaveText('3/8');
  const drawn = await page.locator('#overlay').innerHTML();
  await expect.poll(() => table.rows.length).toBe(3);
  expect(table.rows).toEqual([
    { user_id: PLAYER.id, puzzle: 'WSCH-0007', page: 0, start_row: 4, start_col: 2, direction: 'N' },
    { user_id: PLAYER.id, puzzle: 'WSCH-0007', page: 0, start_row: 1, start_col: 2, direction: 'SE' },
    { user_id: PLAYER.id, puzzle: 'WSCH-0007', page: 0, start_row: 5, start_col: 0, direction: 'E' },
  ]);
  await page.close();

  const later = await open(context);
  await expect(count(later)).toHaveText('3/8');
  await expect(foundLines(later)).toHaveCount(3);
  expect(await later.locator('#overlay').innerHTML()).toBe(drawn);
  await expect(crossedOff(later)).toHaveText(['Cat', 'Cow', 'Ewe']);
  expect(table.saves).toHaveLength(3);
});

test('the grid waits for the saved finds, and first shows with them already in place', async ({ context }) => {
  const table = await playing(context);
  await find(await open(context), CAT, COW);
  await expect.poll(() => table.rows.length).toBe(2);
  table.readDelay = 600;
  await context.addInitScript(() => {
    new MutationObserver((_, watching) => {
      const play = document.getElementById('play');
      if (!play || play.hidden) return;
      window.firstShown = { count: document.getElementById('count').textContent, lines: document.querySelectorAll('#overlay line.mark-found').length };
      watching.disconnect();
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });

  const page = await open(context);
  expect(await page.evaluate(() => window.firstShown)).toEqual({ count: '2/8', lines: 2 });
});

test('two words found on one device are found when the same player opens the puzzle on another', async ({ browser }) => {
  const table = progressTable();
  const laptop = await browser.newContext();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await playing(laptop, { table });
  await playing(phone, { table });
  await find(await open(laptop), HEN, MAP);
  await expect.poll(() => table.rows.length).toBe(2);

  const there = await open(phone);
  await expect(count(there)).toHaveText('2/8');
  await expect(crossedOff(there)).toHaveText(['Hen', 'Map']);
  await expect(foundLines(there)).toHaveCount(2);
  await laptop.close();
  await phone.close();
});

// Cup five times among Cow and Hen — the play page's own Repeats puzzle.
const cup = (row, col, direction) => ({ word: 'Cup', grid: 0, start: { row, col }, direction, length: 3 });
const REPEATS = {
  ...PUZZLE, type: 'Repeats', title: 'Cups',
  words: [
    { word: 'Cow', grid: 0, start: { row: 2, col: 3 }, direction: 'E', length: 3 },
    cup(0, 0, 'E'), cup(0, 4, 'E'), cup(1, 2, 'W'), cup(2, 0, 'S'), cup(4, 4, 'E'),
    { word: 'Hen', grid: 0, start: { row: 1, col: 3 }, direction: 'E', length: 3 }
  ],
  grids: [{ rows: ['CUPTCUPL', 'PUCHENRT', 'CTLCOWLR', 'URTLRTRL', 'PLRTCUPT', 'TRLRTLRL', 'LTRTLRTR', 'RLTLRTLR'] }]
};

test('in a Repeats puzzle, the two copies found of five come back — those two lined through, and 2/5', async ({ context }) => {
  const table = await playing(context, { puzzle: REPEATS });
  const page = await open(context);
  await find(page, [[1, 2], [1, 0]], [[4, 4], [4, 6]]);
  await expect(page.locator('#words li').nth(1).locator('.progress')).toHaveText('2/5');
  const drawn = await page.locator('#overlay').innerHTML();
  await expect.poll(() => table.rows.length).toBe(2);
  await page.close();

  const later = await open(context);
  await expect(later.locator('#words li').nth(1).locator('.progress')).toHaveText('2/5');
  await expect(later.locator('#words li').nth(1)).not.toHaveClass(/done/);
  await expect(count(later)).toHaveText('2/7');
  expect(await later.locator('#overlay').innerHTML()).toBe(drawn);
});

// The fixture as a 3-page Saga — the play page's own, told apart by the bottom-right letter.
const SAGA_PAGES = { Cat: 0, Cow: 0, Ewe: 0, Hen: 1, 'Ice cream': 1, Map: 1, Pig: 2, Piglet: 2 };
const SAGA = {
  ...PUZZLE, type: 'Saga', title: 'Farm Saga',
  words: PUZZLE.words.map(w => ({ ...w, grid: SAGA_PAGES[w.word] })),
  grids: ['R', 'S', 'T'].map(corner => ({ rows: PUZZLE.grids[0].rows.map((row, r) => (r === 7 ? row.slice(0, 7) + corner : row)) }))
};

test('in a Saga, words found on Page 2 come back on Page 2, and Page 1 is untouched', async ({ context }) => {
  const table = await playing(context, { puzzle: SAGA });
  const page = await open(context);
  await tab(page, 1).click();
  await find(page, HEN, MAP);
  await expect.poll(() => table.rows.length).toBe(2);
  expect(table.rows.map(r => r.page)).toEqual([1, 1]);
  await page.close();

  const later = await open(context);
  await expect(count(later)).toHaveText('2/8');
  await expect(foundLines(later)).toHaveCount(0);
  await tab(later, 1).click();
  await expect(foundLines(later)).toHaveCount(2);
  await tab(later, 2).click();
  await expect(foundLines(later)).toHaveCount(0);
  await expect(crossedOff(later)).toHaveText(['Hen', 'Map']);
});

test('a finished puzzle reopens finished — every word found, Puzzle complete — and doesn\'t celebrate again', async ({ context }) => {
  const table = await playing(context);
  const page = await open(context);
  await find(page, ...ALL_WORDS);
  await expect(page.locator('#board .spark').first()).toBeAttached();
  await expect.poll(() => table.rows.length).toBe(8);
  await page.close();

  const later = await open(context);
  await expect(count(later)).toHaveText('8/8');
  await expect(crossedOff(later)).toHaveCount(8);
  await expect(foundLines(later)).toHaveCount(8);
  await expect(later.locator('#complete')).toBeVisible();
  await later.waitForTimeout(300);
  await expect(later.locator('#board .spark')).toHaveCount(0);
  await expect(later.locator('#board')).not.toHaveClass(/pop/);
});

test('signed out, one quiet line invites the player to sign in, finds work as ever, and a reload forgets them — Supabase never asked', async ({ context }) => {
  const table = await playing(context, { signedIn: false });
  const page = await open(context);
  await expect(hint(page)).toHaveText(HINT);
  await expect(hint(page)).toBeVisible();
  await expect(note(page)).toBeHidden();
  await find(page, CAT);
  await expect(count(page)).toHaveText('1/8');
  await expect(crossedOff(page)).toHaveText(['Cat']);

  await page.reload();
  await expect(count(page)).toHaveText('0/8');
  await expect(foundLines(page)).toHaveCount(0);
  expect(table).toMatchObject({ rows: [], reads: [], saves: [], strays: [] });
});

// Under and beside, the line hangs under the words card, which ends where it always did; in Overlay,
// where the words lie over the grid, it sits under the grid card.
for (const [layout, under] of [['bottom', 'aside'], ['right', 'aside'], ['overlay', '.stage']]) {
  test(`signed out in ${layout}, the line sits centred under the words`, async ({ context }) => {
    await playing(context, { signedIn: false, layout });
    const page = await open(context);
    await expect(line(page)).toBeVisible();
    const panel = await page.locator(under).boundingBox();
    const box = await line(page).boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(panel.y + panel.height);
    expect(Math.abs(box.x + box.width / 2 - (panel.x + panel.width / 2))).toBeLessThan(2);
  });
}

for (const layout of ['bottom', 'right']) {
  test(`in ${layout}, the line leaves the words card its own size`, async ({ context }) => {
    await playing(context, { signedIn: false, layout });
    const page = await open(context);
    await expect(line(page)).toBeVisible();
    const panel = await page.locator('aside').boundingBox();
    const card = await page.locator('.words-box').boundingBox();
    expect(Math.abs(panel.y + panel.height - (card.y + card.height))).toBeLessThan(1);
  });
}

test('signed in, there is no line under the words', async ({ context }) => {
  await playing(context);
  const page = await open(context);
  await find(page, CAT);
  await expect(line(page)).toBeHidden();
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

test('signed in with the connection off, play carries on and a note says the finds aren\'t saved; back on, the note goes and they are', async ({ context }) => {
  const table = await playing(context);
  const page = await open(context);
  table.offline = true;
  await find(page, CAT);
  await expect(count(page)).toHaveText('1/8');
  await expect(note(page)).toHaveText(NOTE);
  await expect(note(page)).toBeVisible();
  await expect(hint(page)).toBeHidden();
  await find(page, COW);
  await expect(count(page)).toHaveText('2/8');
  await expect(crossedOff(page)).toHaveText(['Cat', 'Cow']);

  table.offline = false;
  await expect(line(page)).toBeHidden();
  await expect.poll(() => table.rows.length).toBe(2);
  await page.close();
  await expect(count(await open(context))).toHaveText('2/8');
});

test('a first save that is only slow says nothing, and lands', async ({ context }) => {
  const table = await playing(context);
  const page = await open(context);
  table.slowNext = 3000;
  await find(page, CAT);
  await page.waitForTimeout(2500);
  await expect(line(page)).toBeHidden();
  await expect.poll(() => table.rows.length, { timeout: 5000 }).toBe(1);
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

test('a save that fails once and lands on its retry says nothing', async ({ context }) => {
  const table = await playing(context);
  const page = await open(context);
  table.failNext = 1;
  await find(page, CAT);
  await expect.poll(() => table.rows.length).toBe(1);
  await page.waitForTimeout(300);
  expect(table.saves).toHaveLength(2);
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

test('a save whose answer is lost is tried again, refused as already saved, and counts once', async ({ context }) => {
  const table = await playing(context);
  const page = await open(context);
  table.loseNext = true;
  await find(page, CAT);
  await expect.poll(() => table.saves.length).toBe(2);
  await page.waitForTimeout(300);
  expect(table.rows).toHaveLength(1);
  await expect(count(page)).toHaveText('1/8');
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
  await page.close();
  await expect(count(await open(context))).toHaveText('1/8');
});

test('flipping to the solution and back leaves the saved finds as they were', async ({ context }) => {
  const table = await playing(context);
  const page = await open(context);
  await find(page, CAT, HEN);
  await expect.poll(() => table.rows.length).toBe(2);
  const drawn = await page.locator('#overlay').innerHTML();
  await page.locator('#flip').click();
  await page.locator('#flip').click();
  expect(await page.locator('#overlay').innerHTML()).toBe(drawn);
  await expect(count(page)).toHaveText('2/8');
  await page.waitForTimeout(300);
  expect(table.saves).toHaveLength(2);
  await page.close();
  await expect(count(await open(context))).toHaveText('2/8');
});

// Hen was saved on another device; Cat is found here before signing in.
test('signing in mid-puzzle syncs the whole puzzle: the finds on screen are saved, and those saved elsewhere join the board', async ({ context }) => {
  const table = progressTable();
  table.rows.push({ user_id: PLAYER.id, puzzle: 'WSCH-0007', page: 0, start_row: 6, start_col: 3, direction: 'NE' });
  table.rows.push({ user_id: PLAYER.id, puzzle: 'WSCH-0001', page: 0, start_row: 0, start_col: 0, direction: 'E' });
  await playing(context, { signedIn: false, table });
  const page = await open(context);
  await find(page, CAT);
  await expect(count(page)).toHaveText('1/8');
  const signedIn = session(PLAYER);
  await page.evaluate(async tokens => {
    const { client } = await import('/ui/sign-in-ui.js');
    await client.auth.setSession(tokens);
  }, { access_token: signedIn.access_token, refresh_token: signedIn.refresh_token });

  await expect(line(page)).toBeHidden();
  await expect(count(page)).toHaveText('2/8');
  await expect(crossedOff(page)).toHaveText(['Cat', 'Hen']);
  await expect(foundLines(page)).toHaveCount(2);
  await expect.poll(() => table.rows.filter(r => r.puzzle === 'WSCH-0007').length).toBe(2);
  expect(table.reads).toEqual(['WSCH-0007']);
  await find(page, COW);
  await expect(count(page)).toHaveText('3/8');
  await expect.poll(() => table.rows.filter(r => r.puzzle === 'WSCH-0007').length).toBe(3);
  await page.close();

  const later = await open(context);
  await expect(count(later)).toHaveText('3/8');
  await expect(crossedOff(later)).toHaveText(['Cat', 'Cow', 'Hen']);
});

test('the line\'s Sign in opens the sign-in card', async ({ context }) => {
  await playing(context, { signedIn: false });
  await context.route('https://accounts.google.com/**', route => route.abort());
  const page = await open(context);
  await expect(page.locator('#sign-in-card')).toBeHidden();
  await page.locator('#save-sign-in').click();
  await expect(page.locator('#sign-in-card')).toBeVisible();
  await expect(page.locator('.site .sign-in')).toHaveAttribute('aria-expanded', 'true');
});

test('signing out mid-puzzle brings the line back, and finds after aren\'t saved', async ({ context }) => {
  const table = await playing(context);
  const page = await open(context);
  await find(page, CAT);
  await expect.poll(() => table.rows.length).toBe(1);
  await page.locator('.site .avatar').click();
  await page.locator('#account-menu .sign-out').click();
  await expect(hint(page)).toHaveText(HINT);
  await expect(hint(page)).toBeVisible();
  await find(page, COW);
  await expect(count(page)).toHaveText('2/8');
  await page.waitForTimeout(300);
  expect(table.saves).toHaveLength(1);
  expect(table.strays).toEqual([]);
});
