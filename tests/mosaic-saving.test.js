const { test, expect } = require('@playwright/test');
// Saved mosaic progress (the product's TASK-167): the mosaic page saves a signed-in player's squares
// once they pause in tapping, and the landing and collection pages tick a finished mosaic's tile and
// read its picture's name there, and hold a started one under Continue playing. Supabase is stood in
// for — nothing here reaches it: mosaic_squares keeps one row per player and mosaic, saved over only
// by an upsert, the database stamping tapped_at on each; on demand it cuts the connection, or slows
// or fails the next save. The other kinds' tables answer reads only. A signed-in player is a session
// already in the browser, as Supabase keeps it; signing in itself is sign-in.test.js's. The boards
// are the fixtures, served as MOSA-0001 — a 12×12 Easy — MOSA-0003, the same board again, and
// MOSA-0002, a 198×198 Hard.
const BOARD = require('./fixtures/MOSA-0001.json');
const BIG = require('./fixtures/MOSA-0002.json');
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

// A board's squares, a character a square, from the squares given: shaded 1, left blank 2, else 0.
const squaresOf = ({ shaded = [], blank = [] }, file = BOARD) => {
  const out = Array(file.width * file.height).fill('0');
  shaded.forEach(([r, c]) => { out[r * file.width + c] = '1'; });
  blank.forEach(([r, c]) => { out[r * file.width + c] = '2'; });
  return out.join('');
};
// The squares a board opens with (the product's TASK-209): every square of a 0's block left blank —
// neither fixture has a 9. Worked out here from the numbers, as the page does.
const openedBlank = (file = BOARD) => file.numbers.flatMap((line, r) => [...line].map((ch, c) => [ch, r, c])).filter(s => s[0] === '0')
  .flatMap(([, r, c]) => [-1, 0, 1].flatMap(dr => [-1, 0, 1].map(dc => [r + dr, c + dc])))
  .filter(([r, c]) => r >= 0 && r < file.height && c >= 0 && c < file.width);
// The board as the page saves it once it's played: as it opened, then the squares given — shaded,
// blank, or cleared of what it opened with.
const playedOf = ({ shaded = [], blank = [], clear = [] }, file = BOARD) => {
  const out = [...squaresOf({ blank: openedBlank(file) }, file)];
  [[shaded, '1'], [blank, '2'], [clear, '0']].forEach(([cells, ch]) => cells.forEach(([r, c]) => { out[r * file.width + c] = ch; }));
  return out.join('');
};
// A mosaic's row as the table holds it, and as the page saves it — without its time.
const row = (squares, { puzzle = 'MOSA-0001', finished = false, user = PLAYER.id, tappedAt = '2026-10-15T00:00:00+00:00' } = {}) =>
  ({ user_id: user, puzzle, squares, finished, tapped_at: tappedAt });
const saved = (squares, finished = false, puzzle = 'MOSA-0001') => ({ user_id: PLAYER.id, puzzle, squares, finished });
const mosaicsSaved = db => db.mosaics.map(({ tapped_at, ...r }) => r);

function mosaicTable({ mosaics = [] } = {}) {
  return { mosaics: [...mosaics], reads: [], saves: [], strays: [], offline: false, slowNext: 0, failNext: 0 };
}

const READ_ONLY = ['/rest/v1/progress', '/rest/v1/maze_found', '/rest/v1/maze_position', '/rest/v1/mines_marks', '/rest/v1/criss_words'];

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
    if (READ_ONLY.includes(url.pathname) && request.method() === 'GET' && token.includes('.')) return route.fulfill({ headers: CORS, json: [] });
    if (url.pathname !== '/rest/v1/mosaic_squares' || !token.includes('.')) {
      db.strays.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    if (db.offline) return route.abort('internetdisconnected');
    const player = claims(token).sub;
    if (request.method() === 'GET') return read(route, db, player, url.searchParams);
    return save(route, db, { user_id: player, ...request.postDataJSON() }, request.headers().prefer || '');
  });
}

// A read answers with only the columns it selects, and only the rows its filters keep, as PostgREST
// does.
async function read(route, db, player, params) {
  const puzzle = (params.get('puzzle') || '').replace('eq.', '');
  const squares = params.get('squares');
  db.reads.push({ puzzle, order: params.get('order'), squares, select: params.get('select') });
  const columns = (params.get('select') || '').split(',').map(c => c.trim());
  const rows = db.mosaics.filter(r => r.user_id === player && (!puzzle || r.puzzle === puzzle) && (squares !== 'neq.' || r.squares !== ''))
    .map(r => Object.fromEntries(columns.filter(c => c in r).map(c => [c, r[c]])));
  return route.fulfill({ headers: CORS, json: rows });
}

async function save(route, db, r, prefer) {
  db.saves.push(r);
  if (db.failNext > 0) {
    db.failNext -= 1;
    return route.abort('internetdisconnected');
  }
  const slow = db.slowNext;
  db.slowNext = 0;
  await wait(slow);
  const there = db.mosaics.findIndex(m => m.user_id === r.user_id && m.puzzle === r.puzzle);
  if (there >= 0 && !prefer.includes('resolution=merge-duplicates')) {
    return route.fulfill({ status: 409, headers: CORS, json: { code: '23505', message: 'duplicate key value violates unique constraint' } });
  }
  // The database stamps each save's time, whatever the page sent.
  const stamped = { ...r, tapped_at: new Date().toISOString() };
  if (there >= 0) db.mosaics[there] = stamped;
  else db.mosaics.push(stamped);
  return route.fulfill({ status: 201, headers: CORS, body: '' });
}

async function playing(context, { signedIn = true, db = mosaicTable() } = {}) {
  await standInForSupabase(context, db);
  await context.addInitScript(() => localStorage.setItem('grew-puzzles.look', 'plain'));
  await context.route(/\/content\/puzzles\/mosaic\/MOSA-000[13]\.json$/, route => route.fulfill({ json: BOARD }));
  await context.route('**/content/puzzles/mosaic/MOSA-0002.json', route => route.fulfill({ json: BIG }));
  if (signedIn) await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [SESSION_KEY, JSON.stringify(session(PLAYER))]);
  // Every text the line under the Squares card shows, as it shows it.
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

async function open(context, id = 'MOSA-0001') {
  const page = await context.newPage();
  await page.goto('/app/mosaic.html?id=' + id);
  await expect(page.locator('#play')).toBeVisible();
  await expect(page.locator('#play')).toHaveAttribute('data-view', /./);
  return page;
}

// The board is drawn into a canvas: a square's mark is read off its pixels near its bottom-left
// corner, clear of any number — ink shaded, the blank tint left blank (tests/mosaic.test.js).
const INK = '15,42,36', BLANK = '207,219,214';
async function markOf(page, r, c) {
  const fill = await page.evaluate(([r, c]) => {
    const grid = document.getElementById('grid');
    const [cell, vx, vy] = document.getElementById('play').dataset.view.split(' ').map(Number);
    const ratio = grid.width / grid.getBoundingClientRect().width;
    const px = grid.getContext('2d').getImageData(Math.floor(((c - vx) * cell + 0.15 * cell) * ratio), Math.floor(((r - vy) * cell + 0.85 * cell) * ratio), 1, 1).data;
    return Array.from(px).slice(0, 3).join(',');
  }, [r, c]);
  return { [INK]: 'shade', [BLANK]: 'blank' }[fill] || 'clear';
}

async function tap(page, r, c) {
  const [cell, vx, vy] = (await page.locator('#play').getAttribute('data-view')).split(' ').map(Number);
  await page.locator('#grid').click({ position: { x: (c - vx + 0.5) * cell, y: (r - vy + 0.5) * cell } });
}

async function tapAll(page, cells) {
  for (const [r, c] of cells) await tap(page, r, c);
}

const shade = cells => cells.flatMap(c => [c, c]);
const expectBlank = (page, r, c) => expect.poll(() => markOf(page, r, c)).toBe('blank');
const count = page => page.locator('#count');
const saveLine = page => page.locator('#save-line');
const hint = page => page.locator('#save-hint');
const note = page => page.locator('#save-note');
const ANSWER = BOARD.answer.flatMap((line, r) => [...line].map((ch, c) => [ch, r, c])).filter(s => s[0] === '#').map(s => [s[1], s[2]]);

test('signed in, my squares are saved once I pause — the whole board, there is no save button', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await expect(page.getByRole('button', { name: /save/i })).toHaveCount(0);
  await tapAll(page, [[0, 0], [1, 1], [1, 1]]);
  await expect.poll(() => mosaicsSaved(db)).toEqual([saved(playedOf({ blank: [[0, 0]], shaded: [[1, 1]] }))]);
  expect(db.saves).toHaveLength(1);
  expect(db.saves[0].squares).toHaveLength(144);
  await tapAll(page, [[0, 0]]);
  await expect.poll(() => mosaicsSaved(db)).toEqual([saved(playedOf({ shaded: [[0, 0], [1, 1]] }))]);
  await expect(saveLine(page)).toBeHidden();
});

test('taps that come back to where the board was save nothing', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, [[0, 0]]);
  await expect.poll(() => db.saves.length).toBe(1);
  await tapAll(page, [[2, 2], [2, 2], [2, 2]]);
  await page.waitForTimeout(1200);
  expect(db.saves).toHaveLength(1);
});

test('reloading, my squares are back where I left them, and the count with them', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, [[0, 0], ...shade([[1, 1]]), [3, 4]]);
  await expect(count(page)).toHaveText('1 shaded');
  await expect.poll(() => db.saves.length).toBe(1);

  await page.reload();
  await expect(page.locator('#play')).toHaveAttribute('data-view', /./);
  await expect(count(page)).toHaveText('1 shaded');
  expect([await markOf(page, 0, 0), await markOf(page, 1, 1), await markOf(page, 3, 4), await markOf(page, 5, 0)]).toEqual(['blank', 'shade', 'blank', 'clear']);
});

test('opening the board on another device, my squares are there', async ({ browser }) => {
  const db = mosaicTable();
  const laptop = await browser.newContext();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await playing(laptop, { db });
  await playing(phone, { db });
  const there = await open(laptop);
  await tapAll(there, [...shade([[2, 3]]), [4, 4]]);
  await expect.poll(() => mosaicsSaved(db)).toEqual([saved(playedOf({ shaded: [[2, 3]], blank: [[4, 4]] }))]);

  const here = await open(phone);
  await expect(count(here)).toHaveText('1 shaded');
  expect([await markOf(here, 2, 3), await markOf(here, 4, 4)]).toEqual(['shade', 'blank']);
  await laptop.close();
  await phone.close();
});

test('signed in, an Undo is saved as a tap is: another device opens the board as it stood after it — and its Undo has nothing to take back', async ({ browser }) => {
  const db = mosaicTable();
  const laptop = await browser.newContext();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await playing(laptop, { db });
  await playing(phone, { db });
  const there = await open(laptop);
  await tapAll(there, [...shade([[2, 3]]), [4, 4]]);
  await expect.poll(() => mosaicsSaved(db)).toEqual([saved(playedOf({ shaded: [[2, 3]], blank: [[4, 4]] }))]);
  await there.click('#undo');
  await expect.poll(() => mosaicsSaved(db)).toEqual([saved(playedOf({ shaded: [[2, 3]] }))]);
  await there.click('#undo');
  await expect.poll(() => mosaicsSaved(db)).toEqual([saved(playedOf({ blank: [[2, 3]] }))]);

  const here = await open(phone);
  await expect(count(here)).toHaveText('0 shaded');
  expect([await markOf(here, 2, 3), await markOf(here, 4, 4)]).toEqual(['blank', 'clear']);
  await expect(here.locator('#undo')).toBeDisabled();
  expect(await here.evaluate(() => Object.keys(localStorage).filter(k => k !== 'grew-puzzles.look' && !k.startsWith('sb-')))).toEqual([]);
  await laptop.close();
  await phone.close();
});

test('opening a mosaic and leaving it as it opened saves nothing — its filled-in squares aren\'t a start', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await expectBlank(page, 0, 4);
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await page.waitForTimeout(300);
  expect(db.saves).toEqual([]);
});

test('clearing a square the board opened with and reloading, it stays clear — never filled in again', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, [[0, 4], [0, 4]]);
  await expect.poll(() => mosaicsSaved(db)).toEqual([saved(playedOf({ clear: [[0, 4]] }))]);

  await page.reload();
  await expect(page.locator('#play')).toHaveAttribute('data-view', /./);
  await expect.poll(() => markOf(page, 0, 4)).toBe('clear');
  expect(await markOf(page, 0, 3)).toBe('blank');
});

test('undoing every tap saves the board empty, so it comes back new', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, [[0, 0]]);
  await expect.poll(() => db.saves.length).toBe(1);
  await page.click('#undo');
  await expect.poll(() => mosaicsSaved(db)).toEqual([saved('')]);
});

test('the board waits for what was saved, and first shows with it already in place', async ({ context }) => {
  await playing(context, { db: mosaicTable({ mosaics: [row(squaresOf({ shaded: [[0, 0], [1, 1]] }))] }) });
  await context.addInitScript(() => {
    new MutationObserver((_, watching) => {
      const play = document.getElementById('play');
      if (!play || play.hidden) return;
      window.firstShown = document.getElementById('count').textContent;
      watching.disconnect();
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });
  const page = await open(context);
  expect(await page.evaluate(() => window.firstShown)).toBe('2 shaded');
});

// Hiding or leaving the page saves at once, in a request the browser keeps going once the page is
// gone. Chrome sends one made as a page is torn down from outside the page, where no stand-in can see
// it, so these hide and leave the page by its own events instead — and every other test waits for
// its saves before leaving, so none reaches the real project.
test('hiding the page before the pause saves what I tapped at once', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, [[0, 0]]);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => db.saves.map(r => r.squares), { timeout: 400 }).toEqual([playedOf({ blank: [[0, 0]] })]);
});

test('leaving the page before the pause saves what I tapped at once, in a request the browser keeps going', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await page.evaluate(() => {
    const sent = window.fetch;
    window.kept = [];
    window.fetch = (url, init) => { window.kept.push(Boolean(init && init.keepalive)); return sent(url, init); };
  });
  await tapAll(page, [[0, 0]]);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect.poll(() => db.saves.map(r => r.squares), { timeout: 400 }).toEqual([playedOf({ blank: [[0, 0]] })]);
  expect(await page.evaluate(() => window.kept)).toEqual([true]);
});

test('finishing the mosaic saves it finished; it reopens as its picture under its name, takes no taps and doesn\'t celebrate again', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, shade(ANSWER));
  await expect(page.locator('#complete')).toBeVisible();
  await expect.poll(() => mosaicsSaved(db)).toEqual([saved(playedOf({ shaded: ANSWER }), true)]);

  await page.reload();
  await expect(page.locator('#play')).toHaveAttribute('data-view', /./);
  await expect(page.locator('#title')).toHaveText(BOARD.name);
  await expect(page.locator('#complete')).toHaveText(`Solved — it's ${BOARD.name}.`);
  await expect(page.locator('#play')).toHaveAttribute('data-solved', 'true');
  await page.waitForTimeout(300);
  await expect(page.locator('#board .spark')).toHaveCount(0);
  await expect(page.locator('#board')).not.toHaveClass(/\bpop\b/);
  const before = db.saves.length;
  await tapAll(page, [[0, 0]]);
  await page.waitForTimeout(1200);
  expect(db.saves.length).toBe(before);
});

test('only my own board comes back, and only this board\'s', async ({ context }) => {
  const db = mosaicTable({ mosaics: [row(squaresOf({ shaded: [[0, 0]] }), { user: SOMEONE_ELSE }), row(squaresOf({ shaded: [[1, 1]] }), { puzzle: 'MOSA-0003' })] });
  await playing(context, { db });
  const page = await open(context);
  await expect(count(page)).toHaveText('0 shaded');
  expect(db.reads.map(r => r.puzzle)).toEqual(['MOSA-0001']);
});

test('tapping fast, the board saved last is the one on screen — an older save never lands over it', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.slowNext = 1500;
  await tapAll(page, [[0, 0]]);
  await expect.poll(() => db.saves.length).toBe(1);
  await tapAll(page, [[1, 0], [2, 0], [0, 0]]);
  await expect.poll(() => mosaicsSaved(db), { timeout: 5000 }).toEqual([saved(playedOf({ shaded: [[0, 0]], blank: [[1, 0], [2, 0]] }))]);
  await page.waitForTimeout(800);
  expect(mosaicsSaved(db)).toEqual([saved(playedOf({ shaded: [[0, 0]], blank: [[1, 0], [2, 0]] }))]);
  expect(db.saves).toHaveLength(2);
});

test('tapping quickly across a 198×198, every tap shows at once and the board is saved whole, once, after the pause', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context, 'MOSA-0002');
  await page.evaluate(() => {
    window.longest = 0;
    new PerformanceObserver(list => list.getEntries().forEach(e => { window.longest = Math.max(window.longest, e.duration); })).observe({ type: 'longtask' });
  });
  const [cell, vx, vy] = (await page.locator('#play').getAttribute('data-view')).split(' ').map(Number);
  // Twelve squares on view that the board opened clear, so a tap leaves each blank.
  const opened = new Set(openedBlank(BIG).map(([r, c]) => r + ',' + c));
  const cells = Array.from({ length: 144 }, (_, i) => [Math.ceil(vy) + 1 + (i % 12), Math.ceil(vx) + 1 + Math.floor(i / 12)])
    .filter(([r, c]) => !opened.has(r + ',' + c)).slice(0, 12);
  expect(cells).toHaveLength(12);
  for (const [r, c] of cells) await page.locator('#grid').click({ position: { x: (c - vx + 0.5) * cell, y: (r - vy + 0.5) * cell } });
  await expect(count(page)).toHaveText('0 shaded');
  for (const [r, c] of cells) expect(await markOf(page, r, c)).toBe('blank');
  await expect.poll(() => db.saves.length).toBe(1);
  expect(db.saves[0].squares).toBe(playedOf({ blank: cells }, BIG));
  expect(db.saves[0].squares).toHaveLength(198 * 198);
  await page.waitForTimeout(1200);
  expect(db.saves).toHaveLength(1);
  expect(await page.evaluate(() => window.longest)).toBeLessThan(100);
});

test('signed out, the board plays as normal, the quiet line shows under the Squares card, and nothing is saved — Supabase never asked', async ({ context }) => {
  const db = await playing(context, { signedIn: false });
  const page = await open(context);
  await expect(hint(page)).toHaveText(HINT);
  await expect(hint(page)).toBeVisible();
  await expect(note(page)).toBeHidden();
  const card = await page.locator('#mosaic-card .words-box').boundingBox();
  const slip = await saveLine(page).boundingBox();
  expect(slip.y).toBeGreaterThanOrEqual(card.y + card.height);
  await tapAll(page, shade([[0, 0]]));
  await expect(count(page)).toHaveText('1 shaded');
  await page.waitForTimeout(1200);

  await page.reload();
  await expect(page.locator('#play')).toBeVisible();
  await expect(count(page)).toHaveText('0 shaded');
  expect(db).toMatchObject({ mosaics: [], reads: [], saves: [], strays: [] });
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'grew-puzzles.look'))).toEqual([]);
});

test('on a phone, signed out, the line sits under the Squares card, inside the screen', async ({ browser }) => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await playing(phone, { signedIn: false });
  const page = await open(phone);
  await expect(hint(page)).toBeVisible();
  const card = await page.locator('#mosaic-card .words-box').boundingBox();
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

test('signed in, there is no line under the Squares card', async ({ context }) => {
  await playing(context);
  const page = await open(context);
  await tapAll(page, [[0, 0]]);
  await page.waitForTimeout(1200);
  await expect(saveLine(page)).toBeHidden();
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

test('with the connection off, play carries on and a note says the board isn\'t saved; back on, the note goes and it is', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.offline = true;
  await tapAll(page, [...shade([[0, 0]]), [5, 0]]);
  await expect(count(page)).toHaveText('1 shaded');
  await expect(note(page)).toHaveText(NOTE, { timeout: 8000 });
  await expect(note(page)).toBeVisible();
  await expect(hint(page)).toBeHidden();

  db.offline = false;
  await expect(saveLine(page)).toBeHidden({ timeout: 5000 });
  await expect.poll(() => mosaicsSaved(db)).toEqual([saved(playedOf({ shaded: [[0, 0]], blank: [[5, 0]] }))]);
  await page.close();
  const later = await open(context);
  await expect(count(later)).toHaveText('1 shaded');
});

test('a save that fails once and lands on its retry says nothing', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  db.failNext = 1;
  await tapAll(page, [[0, 0]]);
  await expect.poll(() => mosaicsSaved(db), { timeout: 5000 }).toEqual([saved(playedOf({ blank: [[0, 0]] }))]);
  await page.waitForTimeout(300);
  expect(db.saves).toHaveLength(2);
  expect(await page.evaluate(() => window.lineShown)).toEqual([]);
});

async function signIn(page) {
  const signedIn = session(PLAYER);
  await page.evaluate(async tokens => {
    const { client } = await import('/ui/sign-in-ui.js');
    await client.auth.setSession(tokens);
  }, { access_token: signedIn.access_token, refresh_token: signedIn.refresh_token });
}

test('signing in mid-board having marked squares: my squares here are kept and saved over the ones from elsewhere', async ({ context }) => {
  const db = mosaicTable({ mosaics: [row(squaresOf({ shaded: [[1, 1]] }))] });
  await playing(context, { signedIn: false, db });
  const page = await open(context);
  await tapAll(page, shade([[0, 0]]));
  await signIn(page);

  await expect(saveLine(page)).toBeHidden();
  await expect.poll(() => mosaicsSaved(db)).toEqual([saved(playedOf({ shaded: [[0, 0]] }))]);
  await expect(count(page)).toHaveText('1 shaded');
  expect([await markOf(page, 0, 0), await markOf(page, 1, 1)]).toEqual(['shade', 'clear']);
});

test('signing in mid-board without having marked anything picks the board up where I left it', async ({ context }) => {
  const db = mosaicTable({ mosaics: [row(squaresOf({ shaded: [[1, 1]], blank: [[0, 0]] }))] });
  await playing(context, { signedIn: false, db });
  const page = await open(context);
  await signIn(page);

  await expect(count(page)).toHaveText('1 shaded');
  await expect.poll(() => markOf(page, 0, 0)).toBe('blank');
  await page.waitForTimeout(1200);
  expect(db.saves).toEqual([]);
});

test('signing out mid-board brings the line back, and taps after — and before, still waiting — aren\'t saved', async ({ context }) => {
  const db = await playing(context);
  const page = await open(context);
  await tapAll(page, [[0, 0]]);
  await expect.poll(() => db.saves.length).toBe(1);
  await tapAll(page, [[0, 0]]);
  await page.locator('.site .avatar').click();
  await page.locator('#account-menu .sign-out').click();
  await expect(hint(page)).toBeVisible();
  await tapAll(page, [[5, 0]]);
  await page.waitForTimeout(1200);
  expect(db.saves).toHaveLength(1);
  expect(db.strays).toEqual([]);
});

// ---- The ✓, the name, Continue playing and Finished ----

const MOSAICS = { puzzles: [
  { hiddenId: 'MOSA-0001', type: 'Vanilla', created: '2026-10-15', title: 'Mosaic 001', difficulty: 'Easy', width: 12, height: 12 },
  { hiddenId: 'MOSA-0003', type: 'Vanilla', created: '2026-10-14', title: 'Mosaic 003', difficulty: 'Easy', width: 12, height: 12 },
  { hiddenId: 'MOSA-0002', type: 'Vanilla', created: '2026-10-13', title: 'Mosaic 002', difficulty: 'Hard', width: 198, height: 198 },
] };

async function site(context, { db, signedIn = true, collections = [] } = {}) {
  const opened = [];
  await playing(context, { db, signedIn });
  await context.route('**/content/puzzles/wordsearch/index.json', r => r.fulfill({ json: {
    puzzles: [{ hiddenId: 'WSCH-0007', type: 'Vanilla', created: '2026-10-02', title: 'Farmyard' }],
  } }));
  await context.route('**/content/puzzles/wordsearch/WSCH-0007.json', r => r.fulfill({ json: WORDSEARCH }));
  await context.route('**/content/puzzles/mosaic/index.json', r => r.fulfill({ json: MOSAICS }));
  // Every mosaic file a landing page opens — a finished one's alone, for its name.
  await context.route(/\/content\/puzzles\/mosaic\/MOSA-\d+\.json$/, r => {
    opened.push(r.request().url().match(/MOSA-\d+/)[0]);
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
const finishedMosaic = (puzzle = 'MOSA-0001', tappedAt) => row(squaresOf({ shaded: ANSWER }), { puzzle, finished: true, tappedAt });

test('a finished mosaic wears a ✓ in Mosaic and reads its name in place of its title, opening its file alone; a started one doesn\'t', async ({ context }) => {
  const db = mosaicTable({ mosaics: [finishedMosaic(), row(squaresOf({ shaded: [[0, 0]] }), { puzzle: 'MOSA-0003' })] });
  const opened = await site(context, { db });
  const page = await landing(context, '/app/?kind=mosaic');
  await expect(tile(page, BOARD.name)).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual([BOARD.name]);
  await expect(tile(page, 'Mosaic 001')).toHaveCount(0);
  await expect(tile(page, 'Mosaic 003')).toHaveAttribute('data-done', 'false');
  expect(opened).toEqual(['MOSA-0001']);
  // The squares are never read for the ticks — only the started rows' finish and time.
  expect(db.reads).toEqual([{ puzzle: '', order: 'puzzle.asc', squares: 'neq.', select: 'puzzle,finished,tapped_at' }]);
  expect(db.strays).toEqual([]);
});

test('a mosaic someone else finished reads its title for me; signed out, every mosaic does', async ({ browser }) => {
  const db = mosaicTable({ mosaics: [finishedMosaic('MOSA-0001'), row(squaresOf({ shaded: ANSWER }), { user: SOMEONE_ELSE, puzzle: 'MOSA-0003', finished: true })] });
  const me = await browser.newContext();
  await site(me, { db });
  const mine = await landing(me, '/app/?kind=mosaic');
  await expect.poll(() => tileTitles(mine)).toEqual([BOARD.name, 'Mosaic 003', 'Mosaic 002']);
  const nobody = await browser.newContext();
  const opened = await site(nobody, { db, signedIn: false });
  const page = await landing(nobody, '/app/?kind=mosaic');
  await page.waitForTimeout(500);
  expect(await tileTitles(page)).toEqual(['Mosaic 001', 'Mosaic 003', 'Mosaic 002']);
  expect(opened).toEqual([]);
  await me.close();
  await nobody.close();
});

test('signing out takes a finished mosaic\'s name off its tile again', async ({ context }) => {
  await site(context, { db: mosaicTable({ mosaics: [finishedMosaic()] }) });
  const page = await landing(context, '/app/?kind=mosaic');
  await expect(tile(page, BOARD.name)).toHaveAttribute('data-done', 'true');
  await page.locator('.site .avatar').click();
  await page.locator('#account-menu .sign-out').click();
  await expect.poll(() => tileTitles(page)).toEqual(['Mosaic 001', 'Mosaic 003', 'Mosaic 002']);
  expect(await tickedTitles(page)).toEqual([]);
});

test('a finished mosaic wears its ✓ and its name on a collection page; its collection keeps its own name', async ({ context }) => {
  const collections = [
    { slug: 'pictures', name: 'Pictures', description: 'A mosaic and a wordsearch', created: '2026-12-31', puzzles: [{ id: 'MOSA-0001', number: 1 }, { id: 'WSCH-0007', number: 2 }] },
    { slug: 'one', name: 'One picture', description: 'Only a mosaic', created: '2026-12-31', puzzles: [{ id: 'MOSA-0001', number: 1 }] },
  ];
  await site(context, { db: mosaicTable({ mosaics: [finishedMosaic()] }), collections });
  const page = await landing(context, '/app/collection.html?slug=pictures');
  await expect(tile(page, BOARD.name)).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual([BOARD.name]);
  const shelf = await landing(context, '/app/?kind=collections');
  await expect(tile(shelf, 'One picture')).toHaveAttribute('data-done', 'true');
  expect(await tileTitles(shelf)).toEqual(expect.arrayContaining(['Pictures', 'One picture']));
});

test('finishing a mosaic, then going back to Mosaic, its ✓ and name are there', async ({ context }) => {
  const db = mosaicTable();
  await site(context, { db });
  const page = await landing(context, '/app/?kind=mosaic');
  await tile(page, 'Mosaic 001').click();
  await expect(page.locator('#play')).toHaveAttribute('data-view', /./);
  await tapAll(page, shade(ANSWER));
  await expect(page.locator('#complete')).toBeVisible();
  await expect.poll(() => db.mosaics.map(r => r.finished)).toEqual([true]);
  await page.goBack();
  await expect(tile(page, BOARD.name)).toHaveAttribute('data-done', 'true');
  expect(await tickedTitles(page)).toEqual([BOARD.name]);
});

test('shading a square and leaving, back on Mosaic the mosaic sits in Continue playing', async ({ context }) => {
  const db = mosaicTable();
  await site(context, { db });
  const page = await landing(context, '/app/?kind=mosaic');
  await expect(page.locator('#rail')).toBeHidden();
  await tile(page, 'Mosaic 003').click();
  await expect(page.locator('#play')).toHaveAttribute('data-view', /./);
  await tapAll(page, [[0, 0]]);
  await expect.poll(() => db.mosaics.length).toBe(1);
  await page.goBack();
  await expect.poll(() => railTitles(page)).toEqual(['Mosaic 003']);
  await expect(page.locator('#rail .tile')).toHaveAttribute('href', 'mosaic.html?id=MOSA-0003');
});

test('Mosaic\'s rail holds only mosaics, newest first; Collections\' holds them beside the other kinds', async ({ context }) => {
  const db = mosaicTable({ mosaics: [
    row(squaresOf({ blank: [[0, 0]] }), { puzzle: 'MOSA-0003', tappedAt: '2026-10-15T09:00:00+00:00' }),
    row(squaresOf({ shaded: [[20, 20]] }, BIG), { puzzle: 'MOSA-0002', tappedAt: '2026-10-15T12:00:00+00:00' }),
  ] });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=mosaic');
  await expect.poll(() => railTitles(page)).toEqual(['Mosaic 002', 'Mosaic 003']);
  const collections = [{ slug: 'mixed', name: 'mixed', description: 'Every kind', created: '2026-12-31', puzzles: [{ id: 'MOSA-0001', number: 1 }] }];
  await context.route('**/content/collections/index.json', r => r.fulfill({ json: { collections } }));
  const shelf = await landing(context, '/app/?kind=collections');
  await expect.poll(() => railTitles(shelf)).toEqual(['Mosaic 002', 'Mosaic 003']);
  expect(db.strays).toEqual([]);
});

test('a mosaic back as it opened isn\'t in Continue playing', async ({ context }) => {
  const db = mosaicTable({ mosaics: [row('', { puzzle: 'MOSA-0003' })] });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=mosaic');
  await expect.poll(() => db.reads.length).toBe(1);
  await page.waitForTimeout(300);
  await expect(page.locator('#rail')).toBeHidden();
});

test('a finished mosaic leaves Continue playing and shows under Finished; Not finished shows the rest', async ({ context }) => {
  const db = mosaicTable({ mosaics: [finishedMosaic('MOSA-0001', '2026-10-15T12:00:00+00:00'), row(squaresOf({ shaded: [[0, 0]] }), { puzzle: 'MOSA-0003' })] });
  await site(context, { db });
  const page = await landing(context, '/app/?kind=mosaic&finished=yes');
  await expect.poll(() => tileTitles(page)).toEqual([BOARD.name]);
  await expect.poll(() => railTitles(page)).toEqual(['Mosaic 003']);
  const rest = await landing(context, '/app/?kind=mosaic&finished=no');
  await expect.poll(() => tileTitles(rest)).toEqual(['Mosaic 003', 'Mosaic 002']);
});

test('signed out, no mosaic wears a ✓, there\'s no rail, and nothing is read', async ({ context }) => {
  const db = mosaicTable({ mosaics: [finishedMosaic(), row(squaresOf({ shaded: [[0, 0]] }), { puzzle: 'MOSA-0003' })] });
  const opened = await site(context, { db, signedIn: false });
  const page = await landing(context, '/app/?kind=mosaic');
  await page.waitForTimeout(500);
  expect(await tickedTitles(page)).toEqual([]);
  await expect(page.locator('#rail')).toBeHidden();
  expect(db.reads).toEqual([]);
  expect(opened).toEqual([]);
});

