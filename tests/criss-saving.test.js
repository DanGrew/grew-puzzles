const { test, expect } = require('@playwright/test');
// Saved criss-cross progress: the criss-cross page saves a signed-in player's words as they place
// them, and the landing and collection pages tick a finished criss-cross's tile, and hold a started
// one under Continue playing. Supabase is stood in for — nothing here reaches it: criss_words keeps
// one row per player and shape, saved over only by an upsert, the database stamping placed_at on
// each; on demand it cuts the connection, or slows or fails the next save. The wordsearch's progress
// table, the maze tables and the minesweeper table answer reads only. A signed-in player is a
// session already in the browser, as Supabase keeps it; signing in itself is sign-in.test.js's. The
// shapes are the fixtures, served as CRSS-0001 — a 17×15 Easy of 20 words, Aquarium given —
// CRSS-0003, the same shape again, and CRSS-0002, a 29×30 Hard of 60.
const SHAPE = require('./fixtures/CRSS-0001.json');
const BIG = require('./fixtures/CRSS-0002.json');
const BOARD = require('./fixtures/MINE-0001.json');
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

// A word in place as the table holds it: its slot's first square, its way and the word.
function placed(name, file = SHAPE) {
  const w = file.words.find(o => o.word === name);
  return { row: w.start.row, col: w.start.col, direction: w.direction, word: w.word };
}
// The words in place as the table holds them, slot by slot — the file's order.
const inOrder = (names, file = SHAPE) => file.words.filter(w => names.includes(w.word)).map(w => placed(w.word, file));

// A shape's row as the table holds it, and as the page saves it — without its time.
const words = (names, { puzzle = 'CRSS-0001', finished = false, user = PLAYER.id, placedAt = '2026-10-12T00:00:00+00:00' } = {}) =>
  ({ user_id: user, puzzle, words: inOrder(names), finished, placed_at: placedAt });
const saved = (names, finished = false, puzzle = 'CRSS-0001') => ({ user_id: PLAYER.id, puzzle, words: inOrder(names), finished });
const shapesSaved = db => db.shapes.map(({ placed_at, ...row }) => row);
const ALL = SHAPE.words.map(w => w.word).filter(w => w !== SHAPE.given);

// lines are the wordsearch's progress table, finds and places the maze tables, boards the
// minesweeper table, mosaics the mosaic table, all read only.
function crissTable({ shapes = [], lines = [], finds = [], places = [], boards = [] } = {}) {
  return { shapes: [...shapes], lines, finds, places, boards, mosaics: [], reads: [], saves: [], strays: [], offline: false, slowNext: 0, failNext: 0 };
}

const READ_ONLY = { '/rest/v1/progress': 'lines', '/rest/v1/maze_found': 'finds', '/rest/v1/maze_position': 'places', '/rest/v1/mines_marks': 'boards', '/rest/v1/mosaic_squares': 'mosaics' };

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
    if (url.pathname !== '/rest/v1/criss_words' || !token.includes('.')) {
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
  const rows = db.shapes.filter(r => r.user_id === player && (!puzzle || r.puzzle === puzzle))
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
  const there = db.shapes.findIndex(r => r.user_id === row.user_id && r.puzzle === row.puzzle);
  if (there >= 0 && !prefer.includes('resolution=merge-duplicates')) {
    return route.fulfill({ status: 409, headers: CORS, json: { code: '23505', message: 'duplicate key value violates unique constraint' } });
  }
  // The database stamps each save's time, whatever the page sent.
  const stamped = { ...row, placed_at: new Date().toISOString() };
  if (there >= 0) db.shapes[there] = stamped;
  else db.shapes.push(stamped);
  return route.fulfill({ status: 201, headers: CORS, body: '' });
}

async function playing(context, { signedIn = true, db = crissTable() } = {}) {
  await standInForSupabase(context, db);
  await context.addInitScript(() => localStorage.setItem('grew-puzzles.look', 'plain'));
  await context.route(/\/content\/puzzles\/crisscross\/CRSS-000[13]\.json$/, route => route.fulfill({ json: SHAPE }));
  await context.route('**/content/puzzles/crisscross/CRSS-0002.json', route => route.fulfill({ json: BIG }));
  if (signedIn) await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [SESSION_KEY, JSON.stringify(session(PLAYER))]);
  // Every text the line under the Words card shows, as it shows it.
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

async function open(context, id = 'CRSS-0001') {
  const page = await context.newPage();
  await page.goto('/app/crisscross.html?id=' + id);
  await expect(page.locator('#play')).toBeVisible();
  return page;
}

const square = (page, r, c) => page.locator(`#grid [data-key="${r},${c}"]`);
const chip = (page, name) => page.locator('#groups .chip').getByText(name, { exact: true });
const count = page => page.locator('#count');
const saveLine = page => page.locator('#save-line');
const hint = page => page.locator('#save-hint');
const note = page => page.locator('#save-note');

// Each word's squares, from its place in the file.
function cells(w) {
  return Array.from({ length: w.length }, (_, k) => w.direction === 'E' ? [w.start.row, w.start.col + k] : [w.start.row + k, w.start.col]);
}

// A square only this word's slot runs through, so one tap picks it — else its first.
function ownSquare(file, w) {
  const others = new Set(file.words.filter(o => o !== w).flatMap(o => cells(o).map(c => c.join(','))));
  return cells(w).find(c => !others.has(c.join(','))) || cells(w)[0];
}

async function pickedIs(page, w) {
  const picked = await page.locator('#grid .picked').evaluateAll(els => els.map(el => el.dataset.key));
  return picked.sort().join(' ') === cells(w).map(c => c.join(',')).sort().join(' ');
}

// The word's slot picked — a second tap where the first picked the slot across it — then the word.
async function put(page, name, file = SHAPE) {
  const w = file.words.find(o => o.word === name);
  await square(page, ...ownSquare(file, w)).click();
  if (!await pickedIs(page, w)) await square(page, ...ownSquare(file, w)).click();
  await chip(page, name).click();
}

async function putAll(page, names) {
  for (const name of names) await put(page, name);
}

async function letters(page, name, file = SHAPE) {
  return (await Promise.all(cells(file.words.find(o => o.word === name)).map(c => square(page, ...c).locator('.ch').textContent()))).join('');
}

const usedChips = page => page.locator('#groups .chip.used').allInnerTexts();

test('signed in, every word placed or taken out saves the whole set — there is no save button', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await expect(page.getByRole('button', { name: /save/i })).toHaveCount(0);
  await put(page, 'Hat');
  await expect.poll(() => shapesSaved(db)).toEqual([saved(['Hat'])]);
  await put(page, 'Lantern');
  await expect.poll(() => shapesSaved(db)).toEqual([saved(['Hat', 'Lantern'])]);
  await chip(page, 'Hat').click();
  await expect.poll(() => shapesSaved(db)).toEqual([saved(['Lantern'])]);
  await expect(saveLine(page)).toBeHidden();
});

test('picking a slot, or a word refused, saves nothing', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await put(page, 'Hat');
  await expect.poll(() => db.saves.length).toBe(1);
  // Sunbathe's slot, down through Aquarium's U: Swim is too short, and Barbecue's A clashes.
  await square(page, 3, 10).click();
  await chip(page, 'Swim').click();
  await chip(page, 'Barbecue').click();
  await expect(page.locator('#grid .clash')).not.toHaveCount(0);
  await page.waitForTimeout(300);
  expect(db.saves).toHaveLength(1);
});

test('reloading, my words are back in their slots and crossed off, and the count with them', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await putAll(page, ['Hat', 'Lantern']);
  await expect(count(page)).toHaveText('3/20');
  await expect.poll(() => shapesSaved(db)).toEqual([saved(['Hat', 'Lantern'])]);

  await page.reload();
  await expect(page.locator('#play')).toBeVisible();
  await expect(count(page)).toHaveText('3/20');
  expect([await letters(page, 'Hat'), await letters(page, 'Lantern'), await letters(page, 'Swim')]).toEqual(['HAT', 'LANTERN', '']);
  expect((await usedChips(page)).sort()).toEqual(['Aquarium', 'Hat', 'Lantern']);
});

test('opening the shape on another device, my words are back in their slots and crossed off the list', async ({ browser }) => {
  const db = crissTable();
  const laptop = await browser.newContext();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await playing(laptop, { db });
  await playing(phone, { db });
  const there = await open(laptop);
  await putAll(there, ['Hat', 'Swim']);
  await expect.poll(() => shapesSaved(db)).toEqual([saved(['Hat', 'Swim'])]);

  const here = await open(phone);
  await expect(count(here)).toHaveText('3/20');
  expect([await letters(here, 'Hat'), await letters(here, 'Swim')]).toEqual(['HAT', 'SWIM']);
  expect((await usedChips(here)).sort()).toEqual(['Aquarium', 'Hat', 'Swim']);
  await laptop.close();
  await phone.close();
});

test('the shape waits for what was saved, and first shows with it already in place', async ({ context }) => {
  await playing(context, { db: crissTable({ shapes: [words(['Hat', 'Swim'])] }) });
  await context.addInitScript(() => {
    new MutationObserver((_, watching) => {
      const play = document.getElementById('play');
      if (!play || play.hidden) return;
      window.firstShown = { count: document.getElementById('count').textContent, hat: document.querySelector('#grid [data-key="0,16"] .ch').textContent };
      watching.disconnect();
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });
  const page = await open(context);
  expect(await page.evaluate(() => window.firstShown)).toEqual({ count: '3/20', hat: 'H' });
});

test('finishing the shape saves it finished; it reopens finished, takes no taps and doesn\'t celebrate again', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await putAll(page, ALL);
  await expect(page.locator('#complete')).toHaveText('Solved — every word in place');
  await expect.poll(() => shapesSaved(db)).toEqual([saved(ALL, true)]);

  await page.reload();
  await expect(page.locator('#play')).toBeVisible();
  await expect(count(page)).toHaveText('20/20');
  await expect(page.locator('#complete')).toHaveText('Solved — every word in place');
  await page.waitForTimeout(300);
  await expect(page.locator('#board .spark')).toHaveCount(0);
  await expect(page.locator('#board')).not.toHaveClass(/\bpop\b/);
  const before = db.saves.length;
  await chip(page, 'Hat').click();
  await page.waitForTimeout(300);
  expect(await letters(page, 'Hat')).toBe('HAT');
  expect(db.saves.length).toBe(before);
});

test('a big shape\'s words come back too', async ({ context }) => {
  const name = BIG.words.find(w => w.word !== BIG.given).word;
  await playing(context, { db: crissTable({ shapes: [{ ...words([]), puzzle: 'CRSS-0002', words: [placed(name, BIG)] }] }) });
  const page = await open(context, 'CRSS-0002');
  await expect(count(page)).toHaveText('2/60');
  expect(await letters(page, name, BIG)).toBe(name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase());
});

test('only my own shape comes back, and only this shape\'s', async ({ context }) => {
  const db = crissTable({ shapes: [words(['Hat'], { user: SOMEONE_ELSE }), words(['Swim'], { puzzle: 'CRSS-0003' })] });
  await playing(context, { db });
  const page = await open(context);
  await expect(count(page)).toHaveText('1/20');
  expect(db.reads).toEqual([{ puzzle: 'CRSS-0001', order: null }]);
});

test('placing fast, the words saved last are the ones on screen — an older save never lands over them', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.slowNext = 1500;
  const names = ['Hat', 'Swim', 'Lantern', 'Museum', 'Sunset'];
  await putAll(page, names);
  await expect.poll(() => shapesSaved(db), { timeout: 5000 }).toEqual([saved(names)]);
  await page.waitForTimeout(500);
  expect(shapesSaved(db)).toEqual([saved(names)]);
  expect(db.saves.length).toBeLessThan(names.length);
});

test('signed out, the shape plays as normal, the quiet line shows under the Words card, and nothing is saved — Supabase never asked', async ({ context }) => {
  const db = await playing(context, { signedIn: false });
  const page = await open(context);
  await expect(hint(page)).toHaveText(HINT);
  await expect(hint(page)).toBeVisible();
  await expect(note(page)).toBeHidden();
  const card = await page.locator('#words-card .words-box').boundingBox();
  const slip = await saveLine(page).boundingBox();
  expect(slip.y).toBeGreaterThanOrEqual(card.y + card.height);
  await put(page, 'Hat');
  await expect(count(page)).toHaveText('2/20');

  await page.reload();
  await expect(page.locator('#play')).toBeVisible();
  await expect(count(page)).toHaveText('1/20');
  expect(db).toMatchObject({ shapes: [], reads: [], saves: [], strays: [] });
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'grew-puzzles.look'))).toEqual([]);
});

test('on a phone, signed out, the line sits under the Words card, inside the screen', async ({ browser }) => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await playing(phone, { signedIn: false });
  const page = await open(phone);
  await expect(hint(page)).toBeVisible();
  const card = await page.locator('#words-card .words-box').boundingBox();
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

test('signed in, there is no line under the Words card', async ({ context }) => {
  await playing(context);
  const page = await open(context);
  await put(page, 'Hat');
  await page.waitForTimeout(300);
  await expect(saveLine(page)).toBeHidden();
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

test('with the connection off, play carries on and a note says the shape isn\'t saved; back on, the note goes and it is', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.offline = true;
  await putAll(page, ['Hat', 'Swim']);
  await expect(count(page)).toHaveText('3/20');
  await expect(note(page)).toHaveText(NOTE);
  await expect(note(page)).toBeVisible();
  await expect(hint(page)).toBeHidden();

  db.offline = false;
  await expect(saveLine(page)).toBeHidden({ timeout: 5000 });
  await expect.poll(() => shapesSaved(db)).toEqual([saved(['Hat', 'Swim'])]);
  await page.close();
  const later = await open(context);
  await expect(count(later)).toHaveText('3/20');
});

test('a save that fails once and lands on its retry says nothing', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.failNext = 1;
  await put(page, 'Hat');
  await expect.poll(() => shapesSaved(db), { timeout: 5000 }).toEqual([saved(['Hat'])]);
  await page.waitForTimeout(300);
  expect(db.saves).toHaveLength(2);
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

test('signing in mid-shape having placed a word: my words here are kept and saved over the ones from elsewhere', async ({ context }) => {
  const db = crissTable({ shapes: [words(['Swim'])] });
  await playing(context, { signedIn: false, db });
  const page = await open(context);
  await put(page, 'Hat');
  await signIn(page);

  await expect(saveLine(page)).toBeHidden();
  await expect.poll(() => shapesSaved(db)).toEqual([saved(['Hat'])]);
  await expect(count(page)).toHaveText('2/20');
  expect([await letters(page, 'Hat'), await letters(page, 'Swim')]).toEqual(['HAT', '']);
});

test('signing in mid-shape without having placed a word picks the shape up where I left it', async ({ context }) => {
  const db = crissTable({ shapes: [words(['Hat', 'Swim'])] });
  await playing(context, { signedIn: false, db });
  const page = await open(context);
  await signIn(page);

  await expect(count(page)).toHaveText('3/20');
  await expect.poll(() => letters(page, 'Swim')).toBe('SWIM');
  await page.waitForTimeout(300);
  expect(db.saves).toEqual([]);
});

test('signing out mid-shape brings the line back, and words placed after aren\'t saved', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await put(page, 'Hat');
  await expect.poll(() => db.saves.length).toBe(1);
  await page.locator('.site .avatar').click();
  await page.locator('#account-menu .sign-out').click();
  await expect(hint(page)).toBeVisible();
  await put(page, 'Swim');
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

const SHAPES = { puzzles: [
  { hiddenId: 'CRSS-0001', type: 'Vanilla', created: '2026-10-12', title: 'Summer Holidays', difficulty: 'Easy', width: 17, height: 15, wordCount: 20 },
  { hiddenId: 'CRSS-0003', type: 'Vanilla', created: '2026-10-11', title: 'Half Placed', difficulty: 'Easy', width: 17, height: 15, wordCount: 20 },
  { hiddenId: 'CRSS-0002', type: 'Vanilla', created: '2026-10-10', title: 'Big Holiday', difficulty: 'Hard', width: 29, height: 30, wordCount: 60 },
] };

async function site(context, { db, signedIn = true, collections = [] } = {}) {
  const opened = [];
  await playing(context, { db, signedIn });
  await context.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: {
    puzzles: [{ hiddenId: 'WSCH-0007', type: 'Vanilla', created: '2026-10-02', title: 'Farmyard' }],
  } }));
  await context.route('**/content/puzzles/wordsearch/WSCH-0007.json', r => r.fulfill({ json: WORDSEARCH }));
  await context.route('**/content/puzzles/maze/index.json', r => r.fulfill({ json: { puzzles: [] } }));
  await context.route('**/content/puzzles/minesweeper/index.json', r => r.fulfill({ json: { puzzles: [
    { hiddenId: 'MINE-0001', type: 'Vanilla', created: '2026-10-11', title: 'Garden Patch', difficulty: 'Easy', width: 10, height: 10 },
  ] } }));
  await context.route('**/content/puzzles/minesweeper/MINE-0001.json', r => r.fulfill({ json: BOARD }));
  await context.route('**/content/puzzles/crisscross/index.json', r => r.fulfill({ json: SHAPES }));
  // Every shape file a landing page opens — none should be.
  await context.route(/\/content\/puzzles\/crisscross\/CRSS-\d+\.json$/, r => {
    opened.push(r.request().url().match(/CRSS-\d+/)[0]);
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
const finishedShape = (puzzle = 'CRSS-0001', placedAt) => words(ALL, { puzzle, finished: true, placedAt });

test('a finished criss-cross wears a ✓ in Criss-cross, opening no shape\'s file; a started one doesn\'t', async ({ context }) => {
  const db = crissTable({ shapes: [finishedShape(), words(['Hat'], { puzzle: 'CRSS-0003' })] });
  const opened = await site(context, { db });
  const page = await landing(context, '/app/?kind=crisscross');
  await expect(tile(page, 'Summer Holidays')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Summer Holidays']);
  await expect(tile(page, 'Half Placed')).toHaveAttribute('data-done', 'false');
  expect(opened).toEqual([]);
  expect(db.reads).toEqual([{ puzzle: '', order: 'puzzle.asc' }]);
  expect(db.strays).toEqual([]);
});

test('a finished criss-cross wears its ✓ on a collection page, and its collection\'s tile once every puzzle in it is finished', async ({ context }) => {
  const collections = [
    { slug: 'shapes', name: 'shapes', description: 'Only a criss-cross', created: '2026-12-31', puzzles: [{ id: 'CRSS-0001', number: 1 }] },
    { slug: 'mixed', name: 'mixed', description: 'A criss-cross and a wordsearch', created: '2026-12-31', puzzles: [{ id: 'CRSS-0001', number: 1 }, { id: 'WSCH-0007', number: 2 }] },
  ];
  await site(context, { db: crissTable({ shapes: [finishedShape()] }), collections });
  const page = await landing(context, '/app/collection.html?slug=mixed');
  await expect(tile(page, 'Summer Holidays')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Summer Holidays']);
  const shelf = await landing(context, '/app/?kind=collections');
  await expect(tile(shelf, 'shapes')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(shelf)).toEqual(['shapes']);
});

test('finishing a criss-cross, then going back to Criss-cross, its ✓ is there', async ({ context }) => {
  await site(context);
  const page = await landing(context, '/app/?kind=crisscross');
  await tile(page, 'Summer Holidays').click();
  await expect(page.locator('#play')).toBeVisible();
  await putAll(page, ALL);
  await expect(page.locator('#complete')).toHaveText('Solved — every word in place');
  await page.waitForTimeout(500);
  await page.goBack();
  await expect(tile(page, 'Summer Holidays')).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual(['Summer Holidays']);
});

test('placing a word and leaving, back on Criss-cross the shape sits in Continue playing', async ({ context }) => {
  const db = crissTable();
  await site(context, { db });
  const page = await landing(context, '/app/?kind=crisscross');
  await expect(page.locator('#rail')).toBeHidden();
  await tile(page, 'Half Placed').click();
  await expect(page.locator('#play')).toBeVisible();
  await put(page, 'Hat');
  await expect.poll(() => db.shapes.length).toBe(1);
  await page.goBack();
  await expect.poll(() => railTitles(page)).toEqual(['Half Placed']);
  await expect(page.locator('#rail .tile')).toHaveAttribute('href', 'crisscross.html?id=CRSS-0003');
});

test('Criss-cross\'s rail holds only criss-crosses, newest first; Collections\' holds them beside the other kinds, newest first', async ({ context }) => {
  const db = crissTable({
    shapes: [
      words(['Hat'], { puzzle: 'CRSS-0003', placedAt: '2026-10-12T09:00:00+00:00' }),
      { ...words([], { puzzle: 'CRSS-0002', placedAt: '2026-10-12T12:00:00+00:00' }), words: [placed(BIG.words.find(w => w.word !== BIG.given).word, BIG)] },
    ],
    lines: [{ user_id: PLAYER.id, puzzle: 'WSCH-0007', page: 0, start_row: 0, start_col: 0, direction: 'E', found_at: '2026-10-12T10:00:00+00:00' }],
    boards: [{ puzzle: 'MINE-0001', mines: [[0, 3]], no_mines: [], finished: false, tapped_at: '2026-10-12T11:00:00+00:00' }],
  });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=crisscross');
  await expect.poll(() => railTitles(page)).toEqual(['Big Holiday', 'Half Placed']);
  const collections = [{ slug: 'mixed', name: 'mixed', description: 'Every kind', created: '2026-12-31', puzzles: [{ id: 'CRSS-0001', number: 1 }] }];
  await context.route('**/content/collections/index.json', r => r.fulfill({ json: { collections } }));
  const shelf = await landing(context, '/app/?kind=collections');
  await expect.poll(() => railTitles(shelf)).toEqual(['Big Holiday', 'Garden Patch', 'Farmyard', 'Half Placed']);
  expect(db.strays).toEqual([]);
});

test('a criss-cross whose every word was taken out — only the starting word left — isn\'t in Continue playing', async ({ context }) => {
  const db = crissTable({ shapes: [words([], { puzzle: 'CRSS-0003' })] });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=crisscross');
  await expect.poll(() => db.reads.length).toBe(1);
  await page.waitForTimeout(300);
  await expect(page.locator('#rail')).toBeHidden();
});

test('a finished criss-cross leaves Continue playing and shows under Finished; Not finished shows the rest', async ({ context }) => {
  const db = crissTable({ shapes: [finishedShape('CRSS-0001', '2026-10-12T12:00:00+00:00'), words(['Hat'], { puzzle: 'CRSS-0003' })] });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=crisscross&finished=yes');
  await expect.poll(() => tileTitles(page)).toEqual(['Summer Holidays']);
  await expect.poll(() => railTitles(page)).toEqual(['Half Placed']);
  const rest = await landing(context, '/app/?kind=crisscross&finished=no');
  await expect.poll(() => tileTitles(rest)).toEqual(['Half Placed', 'Big Holiday']);
});

test('signed out, no criss-cross wears a ✓, there\'s no rail, and nothing is read', async ({ context }) => {
  const db = crissTable({ shapes: [finishedShape(), words(['Hat'], { puzzle: 'CRSS-0003' })] });
  const opened = await site(context, { db, signedIn: false });
  const page = await landing(context, '/app/?kind=crisscross');
  await page.waitForTimeout(500);
  expect(await tickedTitles(page)).toEqual([]);
  await expect(page.locator('#rail')).toBeHidden();
  expect(db.reads).toEqual([]);
  expect(opened).toEqual([]);
});
