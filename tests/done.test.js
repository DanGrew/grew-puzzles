const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');

// Done ticks on the landing and collection pages. Supabase is stood in for — nothing here reaches
// it: the progress table keeps each player's rows and answers a read in the order asked, at most
// 1000 rows at a time, as Supabase does. Every puzzle file is the test puzzle; which ones are
// opened is counted. A signed-in player is a session already in the browser, as Supabase keeps it.
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
const COLS = PUZZLE.grids[0].rows[0].length;
// Each word's ends in the test puzzle: Cat, Cow, Ewe, Hen, Ice cream, Map, Pig, Piglet.
const ALL_WORDS = [
  [[4, 2], [2, 2]], [[1, 2], [3, 4]], [[5, 0], [5, 2]], [[6, 3], [4, 5]],
  [[0, 0], [0, 7]], [[0, 7], [2, 7]], [[7, 2], [7, 0]], [[1, 0], [6, 0]]
];
const LINES = PUZZLE.words.map(w => ({ page: w.grid, start_row: w.start.row, start_col: w.start.col, direction: w.direction }));

const part = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
const id = n => `WSCH-${String(n).padStart(4, '0')}`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function session(user) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = [part({ alg: 'HS256', typ: 'JWT' }), part({ sub: user.id, exp: expires, role: 'authenticated' }), 'sig'];
  return { access_token: token.join('.'), token_type: 'bearer', expires_in: 3600, expires_at: expires, refresh_token: 'refresh', user };
}

// Puzzle n was saved n days into the year, so the highest is the newest. Odd ones are Vanilla, even
// ones Missing — two types to filter by.
function index(count) {
  return {
    puzzles: Array.from({ length: count }, (_, i) => ({
      hiddenId: id(i + 1), type: ['Missing', 'Vanilla'][(i + 1) % 2],
      created: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), title: `Puzzle ${i + 1}`,
    })),
  };
}

function collection(slug, ids) {
  return { slug, name: slug, description: `About ${slug}`, created: '2026-12-31', puzzles: ids.map((p, i) => ({ id: p, number: i + 1 })) };
}

// The player's rows finishing a puzzle — every one of its lines — or starting one, its first few.
const finishedRows = (puzzle, user = PLAYER.id) => LINES.map(line => ({ user_id: user, puzzle, ...line }));
const startedRows = (puzzle, n = 3) => finishedRows(puzzle).slice(0, n);

function progressTable(rows = []) {
  return { rows, reads: [], saves: [], strays: [], readDelay: 0 };
}

const ORDER = ['puzzle', 'page', 'start_row', 'start_col', 'direction'];
const inOrder = (a, b) => ORDER.map(k => (a[k] < b[k] ? -1 : Number(a[k] > b[k]))).find(c => c !== 0) ?? 0;

// The player is whoever the request's token names; a request with no player's token — signed out —
// is a stray: the site should never send one.
async function standInForSupabase(context, table) {
  await context.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === '/auth/v1/user') return route.fulfill({ headers: CORS, json: PLAYER });
    const token = (request.headers().authorization || '').replace('Bearer ', '');
    if (url.pathname !== '/rest/v1/progress' || !token.includes('.')) {
      table.strays.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    const player = claims(token).sub;
    if (request.method() === 'GET') return read(route, table, player, url.searchParams);
    const row = { user_id: player, ...request.postDataJSON() };
    table.saves.push(row);
    table.rows.push(row);
    return route.fulfill({ status: 201, headers: CORS, body: '' });
  });
}

// A read of one puzzle's lines is the play page's; a read of them all is the ticks', in the order
// asked and a range at a time — never more than 1000 rows.
async function read(route, table, player, params) {
  const puzzle = (params.get('puzzle') || '').replace('eq.', '');
  table.reads.push({ puzzle, order: params.get('order'), offset: params.get('offset'), limit: params.get('limit') });
  await wait(table.readDelay);
  const mine = table.rows.filter(r => r.user_id === player && (!puzzle || r.puzzle === puzzle)).sort(inOrder);
  const offset = Number(params.get('offset') || 0);
  const limit = Math.min(Number(params.get('limit') || 1000), 1000);
  const rows = mine.slice(offset, offset + limit).map(({ user_id, ...row }) => row);
  return route.fulfill({ headers: CORS, json: rows });
}

// The site's indexes, served in place of the real ones; every puzzle file is the test puzzle, and
// each one opened is noted.
async function site(context, { served = index(3), collections = [], table = progressTable(), signedIn = true } = {}) {
  const opened = [];
  await standInForSupabase(context, table);
  await context.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: served }));
  await context.route('**/content/collections/index.json', r => r.fulfill(
    collections.length ? { json: { collections } } : { status: 404, body: 'Not found' },
  ));
  await context.route(/\/content\/puzzles\/wordsearch\/WSCH-\d+\.json$/, r => {
    opened.push(r.request().url().match(/WSCH-\d+/)[0]);
    return r.fulfill({ json: PUZZLE });
  });
  if (signedIn) await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [SESSION_KEY, JSON.stringify(session(PLAYER))]);
  return { table, opened };
}

const tile = (page, title) => page.locator('.tiles .tile').filter({ has: page.locator('.name', { hasText: new RegExp(`^${title}$`) }) });
const tick = locator => locator.evaluate(el => getComputedStyle(el, '::after').content);
const ticked = (page, title) => tick(tile(page, title));
const TICK = '"✓" / "Finished"';

// Every tile on show that wears a ✓, by title.
async function tickedTitles(page) {
  const tiles = await page.locator('.tiles .tile').all();
  const marks = await Promise.all(tiles.map(async t => [await t.locator('.name').innerText(), await tick(t)]));
  return marks.filter(([, mark]) => mark === TICK).map(([title]) => title);
}

async function landing(context, path = '/app/') {
  const page = await context.newPage();
  await page.goto(path);
  await expect(page.locator('.tiles .tile').first()).toBeVisible();
  return page;
}

test('signed in, a finished puzzle wears a ✓ on its landing tile; a started one and an untouched one don\'t', async ({ context }) => {
  const { table } = await site(context, { table: progressTable([...finishedRows(id(2)), ...startedRows(id(3))]) });
  const page = await landing(context);
  await expect(tile(page, 'Puzzle 2')).toHaveAttribute('data-done', 'true');
  expect(await ticked(page, 'Puzzle 2')).toBe(TICK);
  expect(await tickedTitles(page)).toEqual(['Puzzle 2']);
  await expect(tile(page, 'Puzzle 3')).toHaveAttribute('data-done', 'false');
  expect(await ticked(page, 'Puzzle 3')).toBe('none');
  expect(await ticked(page, 'Puzzle 1')).toBe('none');
  expect(table.strays).toEqual([]);
});

test('the ✓ sits in the tile\'s top-right corner, in the band\'s ink, on a disc that reads on every strip colour', async ({ context }) => {
  const served = index(5);
  served.puzzles[1].type = 'Saga';
  served.puzzles[2].type = 'Repeats';
  served.puzzles[3].type = 'Mirra?e';
  const rows = [1, 2, 3, 4, 5].flatMap(n => finishedRows(id(n)));
  await site(context, { served, collections: [collection('issue', [id(1)])], table: progressTable(rows) });
  const page = await landing(context);
  await expect.poll(() => tickedTitles(page)).toHaveLength(6);
  for (const t of await page.locator('.tiles .tile').all()) {
    const box = await t.boundingBox();
    const mark = await t.evaluate(el => {
      const s = getComputedStyle(el, '::after');
      return { color: s.color, background: s.backgroundColor, top: parseFloat(s.top), right: parseFloat(s.right), width: parseFloat(s.width) };
    });
    expect(mark).toMatchObject({ color: 'rgb(15, 42, 36)', background: 'rgb(255, 255, 255)' });
    expect(mark.top).toBeLessThan(box.height / 4);
    expect(mark.right).toBeLessThan(box.width / 4);
  }
});

test('a finished puzzle wears its ✓ on every collection page it\'s in, numbered tiles and all', async ({ context }) => {
  const collections = [collection('farm', [id(3), id(2), id(1)]), collection('garden', [id(2)])];
  await site(context, { collections, table: progressTable([...finishedRows(id(2)), ...startedRows(id(1))]) });
  for (const slug of ['farm', 'garden']) {
    const page = await landing(context, `/app/collection.html?slug=${slug}`);
    await expect(tile(page, 'Puzzle 2')).toHaveAttribute('data-done', 'true');
    expect(await tickedTitles(page)).toEqual(['Puzzle 2']);
    await page.close();
  }
});

test('the tiles draw at once, and the ticks arrive a moment after', async ({ context }) => {
  const { table } = await site(context, { table: progressTable(finishedRows(id(2))) });
  table.readDelay = 1500;
  const page = await context.newPage();
  const start = Date.now();
  await page.goto('/app/');
  await expect(page.locator('.tiles .tile')).toHaveCount(3);
  expect(Date.now() - start).toBeLessThan(1500);
  expect(await tickedTitles(page)).toEqual([]);
  await expect(tile(page, 'Puzzle 2')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Puzzle 2']);
});

test('only the puzzles the player has started are opened — never every puzzle on the page', async ({ context }) => {
  const rows = [...finishedRows(id(4)), ...startedRows(id(20)), ...startedRows(id(99)), ...finishedRows(id(7), SOMEONE_ELSE)];
  const { opened, table } = await site(context, { served: index(30), table: progressTable(rows) });
  const page = await landing(context);
  await expect.poll(() => opened.length).toBe(2);
  await page.waitForTimeout(300);
  expect(opened.sort()).toEqual([id(4), id(20)]);
  expect(table.reads).toEqual([{ puzzle: '', order: 'puzzle.asc,page.asc,start_row.asc,start_col.asc,direction.asc', offset: '0', limit: '1000' }]);
});

test('filtering, sorting and paging keep each ✓ on its own puzzle\'s tile', async ({ context }) => {
  await site(context, { served: index(30), table: progressTable([...finishedRows(id(3)), ...finishedRows(id(28))]) });
  const page = await landing(context);
  await expect.poll(() => tickedTitles(page)).toEqual(['Puzzle 28']);

  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.tiles .tile .name').first()).toHaveText('Puzzle 6');
  expect(await tickedTitles(page)).toEqual(['Puzzle 3']);

  await page.locator('#sort').selectOption('title');
  await expect(page.locator('.tiles .tile .name').first()).toHaveText('Puzzle 9');
  expect(await tickedTitles(page)).toEqual(['Puzzle 3', 'Puzzle 28']);
  await page.locator('#dir').click();
  await expect(page.locator('.tiles .tile .name').first()).toHaveText('Puzzle 1');
  expect(await tickedTitles(page)).toEqual(['Puzzle 28', 'Puzzle 3']);

  await page.locator('#filter-button').click();
  await page.locator('.chip', { hasText: 'Missing' }).click();
  expect(await tickedTitles(page)).toEqual(['Puzzle 28']);
  await page.locator('.chip', { hasText: 'Missing' }).click();
  await page.locator('.chip', { hasText: 'Vanilla' }).click();
  expect(await tickedTitles(page)).toEqual(['Puzzle 3']);
});

test('a collection\'s own tile wears a ✓ once every puzzle in it is finished, and none while any isn\'t', async ({ context }) => {
  const collections = [collection('done', [id(1), id(2)]), collection('half', [id(2), id(3)]), collection('fresh', [id(3)])];
  await site(context, { collections, table: progressTable([...finishedRows(id(1)), ...finishedRows(id(2)), ...startedRows(id(3))]) });
  const page = await landing(context, '/app/?type=Collections');
  await expect(tile(page, 'done')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['done']);
});

test('signed out, no tile wears a ✓, nothing is read or opened, and the tiles look as they always have', async ({ context }) => {
  const collections = [collection('farm', [id(1), id(2)])];
  const { table, opened } = await site(context, { signedIn: false, collections, table: progressTable([...finishedRows(id(1)), ...finishedRows(id(2))]) });
  const page = await landing(context);
  await page.waitForTimeout(500);
  expect(await tickedTitles(page)).toEqual([]);
  expect(table).toMatchObject({ reads: [], strays: [] });
  expect(opened).toEqual([]);
  const looks = await page.locator('.tiles .tile').evaluateAll(tiles => tiles.map(el => {
    const s = getComputedStyle(el);
    return [el.getBoundingClientRect().height, s.paddingTop, s.borderTopWidth, getComputedStyle(el, '::after').content];
  }));
  expect(new Set(looks.map(l => JSON.stringify(l))).size).toBe(1);
  expect(looks[0][3]).toBe('none');

  const collectionPage = await landing(context, '/app/collection.html?slug=farm');
  await collectionPage.waitForTimeout(500);
  expect(await tickedTitles(collectionPage)).toEqual([]);
  expect(opened).toEqual([]);
});

test('finishing a puzzle, then going back to the landing page, its ✓ is there', async ({ context }) => {
  const served = { puzzles: [...index(2).puzzles, { hiddenId: 'WSCH-0007', type: 'Vanilla', created: '2026-02-01', title: 'Farm' }] };
  const { table } = await site(context, { served });
  const page = await landing(context);
  expect(await ticked(page, 'Farm')).toBe('none');
  await tile(page, 'Farm').click();
  await expect(page.locator('#play')).toBeVisible();
  for (const ends of ALL_WORDS) for (const [r, c] of ends) await page.locator('#grid .cell').nth(r * COLS + c).click();
  await expect(page.locator('#complete')).toBeVisible();
  await expect.poll(() => table.rows.length).toBe(8);

  await page.goBack();
  await expect(tile(page, 'Farm')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Farm']);
});

test('a player with more saved lines than one read answers still has every finished puzzle ticked', async ({ context }) => {
  // 1000 lines of puzzle 1, never finished, sort before puzzle 2's: puzzle 2 is only read on a second page.
  const many = Array.from({ length: 1000 }, (_, i) => ({ user_id: PLAYER.id, puzzle: id(1), page: i, start_row: 0, start_col: 0, direction: 'E' }));
  const { table } = await site(context, { table: progressTable([...many, ...finishedRows(id(2))]) });
  const page = await landing(context);
  await expect(tile(page, 'Puzzle 2')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Puzzle 2']);
  expect(table.reads.map(r => [r.offset, r.limit])).toEqual([['0', '1000'], ['1000', '1000']]);
});

test('when the saved lines can\'t be read, no tile is ticked and the page carries on', async ({ context }) => {
  const { table } = await site(context, { table: progressTable(finishedRows(id(2))) });
  await context.route(`${SUPABASE}/rest/v1/progress**`, route => route.abort('internetdisconnected'));
  const page = await landing(context);
  await page.waitForTimeout(500);
  expect(await tickedTitles(page)).toEqual([]);
  await page.getByRole('button', { name: 'Filters' }).click();
  await expect(page.locator('#filters')).toBeVisible();
  expect(table.strays).toEqual([]);
});
