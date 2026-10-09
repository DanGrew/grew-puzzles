const { test, expect } = require('@playwright/test');
const PUZZLE = require('./fixtures/WSCH-0007.json');

// Delete my account, from the picture's menu. Google and Supabase are stood in for — nothing here
// reaches either. Google's button signs the player straight in; Supabase keeps a progress table and
// a delete_account() that, as the real one does, removes the player whose token calls it and every
// progress row of theirs with them, after which their old sign-in is refused (404, user_not_found).
// On demand the connection is off, or the delete is slow to answer.
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
const WARNING = 'This deletes your account and progress for good.';
const FAILED = 'Your account couldn\'t be deleted just now — try again.';
const DELETED = 'Your account is deleted.';
const HINT = 'Sign in to save your progress — or just play.';

const COLS = PUZZLE.grids[0].rows[0].length;
const CAT = [[4, 2], [2, 2]];
const COW = [[1, 2], [3, 4]];

const part = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function session(user) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = [part({ alg: 'HS256', typ: 'JWT' }), part({ sub: user.id, exp: expires, role: 'authenticated' }), 'sig'];
  return { access_token: token.join('.'), token_type: 'bearer', expires_in: 3600, expires_at: expires, refresh_token: 'refresh', user };
}

const GOOGLE = `(() => {
  let config;
  window.google = { accounts: { id: {
    initialize: c => { config = c; },
    prompt: () => {},
    renderButton: parent => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'stand-in-google';
      button.textContent = 'Sign in with Google';
      button.addEventListener('click', () => config.callback({ credential: 'header.payload.sig' }));
      parent.append(button);
    },
  } } };
})();`;

function supabase() {
  return { rows: [], deleted: [], deletes: [], strays: [], offline: false, deleteDelay: 0 };
}

const gone = (db, token) => db.deleted.includes(claims(token).sub);

async function standIn(context, db) {
  await context.route('https://accounts.google.com/**', route => route.fulfill({ contentType: 'text/javascript', body: GOOGLE }));
  await context.route('**/content/puzzles/wordsearch/WSCH-0007.json', route => route.fulfill({ json: PUZZLE }));
  await context.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === '/auth/v1/token') return route.fulfill({ headers: CORS, json: session(PLAYER) });
    const token = (request.headers().authorization || '').replace('Bearer ', '');
    if (!token.includes('.')) {
      db.strays.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    if (url.pathname === '/auth/v1/logout' && gone(db, token)) {
      return route.fulfill({ status: 404, headers: CORS, json: { code: 404, error_code: 'user_not_found', msg: 'User not found' } });
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });
    if (db.offline) return route.abort('internetdisconnected');
    if (url.pathname === '/rest/v1/rpc/delete_account') return deleteAccount(route, db, claims(token).sub);
    if (url.pathname === '/rest/v1/progress') return progress(route, db, claims(token).sub);
    // The ticks read the player's maze finds too — none here; maze-saving.test.js's.
    if (url.pathname === '/rest/v1/maze_found' && request.method() === 'GET') return route.fulfill({ headers: CORS, json: [] });
    db.strays.push(`${request.method()} ${url.pathname}`);
    return route.abort();
  });
}

async function deleteAccount(route, db, player) {
  db.deletes.push(player);
  await wait(db.deleteDelay);
  db.deleted.push(player);
  db.rows = db.rows.filter(r => r.user_id !== player);
  return route.fulfill({ status: 204, headers: CORS, body: '' });
}

function progress(route, db, player) {
  const request = route.request();
  if (request.method() === 'POST') {
    db.rows.push({ user_id: player, ...request.postDataJSON() });
    return route.fulfill({ status: 201, headers: CORS, body: '' });
  }
  // The play page reads one puzzle's lines; the landing and collection pages' ticks read them all.
  const puzzle = (new URL(request.url()).searchParams.get('puzzle') || '').replace('eq.', '');
  const rows = db.rows.filter(r => r.user_id === player && (!puzzle || r.puzzle === puzzle))
    .map(({ puzzle: p, page, start_row, start_col, direction }) => ({ puzzle: p, page, start_row, start_col, direction }));
  return route.fulfill({ headers: CORS, json: rows });
}

// The player, already signed in when the page opens, as Supabase keeps a sign-in in the browser.
async function signedIn(page) {
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem('opened')) localStorage.setItem(key, value);
    sessionStorage.setItem('opened', 'yes');
  }, [SESSION_KEY, JSON.stringify(session(PLAYER))]);
}

function noPopUps(page) {
  const popUps = [];
  page.on('dialog', dialog => {
    popUps.push(dialog.type());
    return dialog.dismiss();
  });
  return popUps;
}

async function find(page, ...words) {
  for (const ends of words) for (const [r, c] of ends) await page.locator('#grid .cell').nth(r * COLS + c).click();
}

const avatar = page => page.locator('.site .avatar');
const signIn = page => page.locator('.site .sign-in');
const menu = page => page.locator('#account-menu');
const question = page => page.locator('#delete-card');
const note = page => page.locator('.site .deleted-note');
const count = page => page.locator('#count');

async function askToDelete(page) {
  await avatar(page).click();
  await menu(page).getByRole('button', { name: 'Delete my account' }).click();
}

async function playing(page, db) {
  await standIn(page.context(), db);
  await signedIn(page);
  await page.goto('/app/play.html?id=WSCH-0007');
  await expect(avatar(page)).toBeVisible();
  await find(page, CAT, COW);
  await expect.poll(() => db.rows.length).toBe(2);
}

test('Delete my account asks once, on the site\'s own card, in plain words — Cancel where the keyboard lands', async ({ page }) => {
  const popUps = noPopUps(page);
  const db = supabase();
  await playing(page, db);

  await askToDelete(page);

  await expect(menu(page)).toBeHidden();
  await expect(question(page)).toBeVisible();
  await expect(question(page)).toHaveAttribute('role', 'alertdialog');
  await expect(question(page).locator('#delete-warning')).toHaveText(WARNING);
  await expect(question(page).locator('.delete-failed')).toBeHidden();
  await expect(question(page).locator('button')).toHaveText(['Cancel', 'Delete my account']);
  await expect(question(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
  const picture = await avatar(page).boundingBox();
  expect((await question(page).boundingBox()).y).toBeGreaterThanOrEqual(picture.y + picture.height);
  expect(popUps).toEqual([]);
  expect(db.deletes).toEqual([]);
});

const cancels = {
  'Cancel': page => question(page).getByRole('button', { name: 'Cancel' }).click(),
  'Escape': page => page.keyboard.press('Escape'),
  'a click elsewhere': page => page.mouse.click(10, 600),
  'the picture again': page => avatar(page).click(),
};

for (const [how, cancel] of Object.entries(cancels)) {
  test(`cancelling with ${how} changes nothing: still signed in, every find still saved`, async ({ page }) => {
    const db = supabase();
    await playing(page, db);
    await askToDelete(page);

    await cancel(page);

    await expect(question(page)).toBeHidden();
    await expect(avatar(page)).toBeVisible();
    await expect(signIn(page)).toBeHidden();
    await expect(note(page)).toBeHidden();
    await expect(count(page)).toHaveText('2/8');
    await page.waitForTimeout(300);
    expect(db.deletes).toEqual([]);
    expect(db.rows).toHaveLength(2);
  });
}

test('Cancel and Escape hand the keyboard back to the picture', async ({ page }) => {
  const db = supabase();
  await playing(page, db);
  await askToDelete(page);
  await question(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(avatar(page)).toBeFocused();
  await askToDelete(page);
  await page.keyboard.press('Escape');
  await expect(avatar(page)).toBeFocused();
});

test('confirming deletes the account with the player\'s own sign-in, and signs them out on the page they were on, with a note', async ({ page, baseURL }) => {
  const db = supabase();
  await playing(page, db);
  await page.evaluate(() => { window.stillThisPage = true; });
  await askToDelete(page);

  await question(page).getByRole('button', { name: 'Delete my account' }).click();

  await expect(note(page)).toHaveText(DELETED);
  await expect(note(page)).toBeVisible();
  await expect(question(page)).toBeHidden();
  await expect(signIn(page)).toBeVisible();
  await expect(avatar(page)).toBeHidden();
  await expect(page.locator('#save-hint')).toHaveText(HINT);
  await expect(page.locator('#save-hint')).toBeVisible();
  await expect(page).toHaveURL(`${baseURL}/app/play.html?id=WSCH-0007`);
  expect(await page.evaluate(() => window.stillThisPage)).toBe(true);
  expect(db.deletes).toEqual([PLAYER.id]);
  expect(db.rows).toEqual([]);
  expect(await page.evaluate(key => localStorage.getItem(key), SESSION_KEY)).toBeNull();
  expect(db.strays).toEqual([]);

  await page.reload();
  await expect(signIn(page)).toBeVisible();
  await expect(avatar(page)).toBeHidden();
  await expect(note(page)).toBeHidden();
  await expect(count(page)).toHaveText('0/8');
});

test('the note goes at the next click, or Escape', async ({ page }) => {
  const db = supabase();
  await playing(page, db);
  await askToDelete(page);
  await question(page).getByRole('button', { name: 'Delete my account' }).click();
  await expect(note(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(note(page)).toBeHidden();
});

test('signing in again with the same Google account starts fresh — no puzzle shows the old finds', async ({ page }) => {
  const db = supabase();
  await playing(page, db);
  await askToDelete(page);
  await question(page).getByRole('button', { name: 'Delete my account' }).click();
  await expect(note(page)).toBeVisible();

  await page.goto('/app/');
  await signIn(page).click();
  await page.locator('#sign-in-card .stand-in-google').click();
  await expect(avatar(page)).toBeVisible();
  await page.goto('/app/play.html?id=WSCH-0007');

  await expect(page.locator('#play')).toBeVisible();
  await expect(avatar(page)).toBeVisible();
  await expect(count(page)).toHaveText('0/8');
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(0);
  await expect(page.locator('#words li.done')).toHaveCount(0);
});

test('with the connection off, nothing is deleted, the card says so, and Delete works once it\'s back', async ({ page }) => {
  const db = supabase();
  await playing(page, db);
  await askToDelete(page);
  db.offline = true;

  await question(page).getByRole('button', { name: 'Delete my account' }).click();

  await expect(question(page).locator('.delete-failed')).toHaveText(FAILED);
  await expect(question(page).locator('.delete-failed')).toBeVisible();
  await expect(question(page)).toBeVisible();
  await expect(avatar(page)).toBeVisible();
  await expect(note(page)).toBeHidden();
  expect(db.rows).toHaveLength(2);

  db.offline = false;
  await question(page).getByRole('button', { name: 'Delete my account' }).click();
  await expect(note(page)).toHaveText(DELETED);
  expect(db.deletes).toEqual([PLAYER.id]);
  expect(db.rows).toEqual([]);
});

test('closing the card after a failure and asking again starts afresh', async ({ page }) => {
  const db = supabase();
  await playing(page, db);
  await askToDelete(page);
  db.offline = true;
  await question(page).getByRole('button', { name: 'Delete my account' }).click();
  await expect(question(page).locator('.delete-failed')).toBeVisible();
  await page.keyboard.press('Escape');
  await askToDelete(page);
  await expect(question(page).locator('.delete-failed')).toBeHidden();
  await expect(question(page).getByRole('button', { name: 'Delete my account' })).toBeEnabled();
});

test('while the delete is on its way, Delete waits, so it\'s asked only once', async ({ page }) => {
  const db = supabase();
  await playing(page, db);
  db.deleteDelay = 800;
  await askToDelete(page);
  const confirm = question(page).getByRole('button', { name: 'Delete my account' });

  await confirm.click();

  await expect(confirm).toBeDisabled();
  await expect(note(page)).toBeVisible();
  expect(db.deletes).toEqual([PLAYER.id]);
});

for (const width of [320, 390]) {
  test(`at ${width}px wide, the question and the note sit wholly on screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    const db = supabase();
    await standIn(page.context(), db);
    await signedIn(page);
    await page.goto('/app/');
    await askToDelete(page);
    const box = await question(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    for (const button of await question(page).locator('button').all()) {
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }

    await question(page).getByRole('button', { name: 'Delete my account' }).click();
    await expect(note(page)).toBeVisible();
    const said = await note(page).boundingBox();
    expect(said.x).toBeGreaterThanOrEqual(0);
    expect(said.x + said.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
