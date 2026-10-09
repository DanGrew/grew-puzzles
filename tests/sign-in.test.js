const { test, expect } = require('@playwright/test');
const { createHash } = require('crypto');
const PUZZLE = require('./fixtures/WSCH-0007.json');

// Google and Supabase, stood in for: nothing here reaches either. Google's script is replaced by
// one whose button answers at once — with a signed token carrying the fingerprint it was given
// when the player agrees, or nothing when they close Google's window — and Supabase's token
// address buys a session for PLAYER only when the word it's sent is that fingerprint's.
const SUPABASE = 'https://vxschtygvtilsadgixec.supabase.co';
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';
const GOOGLE_CLIENT_ID = '802523799766-q1aeup0ahrm6ajbmd1v6u1qmjfqk248u.apps.googleusercontent.com';
const UNAVAILABLE = 'Google sign-in isn\'t available right now';
const PICTURE = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#c33"/></svg>');
const PLAYER = {
  id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated',
  email: 'pat@example.com', app_metadata: { provider: 'google' },
  user_metadata: { full_name: 'Pat Player', avatar_url: PICTURE }, created_at: '2026-10-04T00:00:00Z',
};
const CORS = {
  'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*',
};

const part = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

function session(user) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = [part({ alg: 'HS256', typ: 'JWT' }), part({ sub: user.id, exp: expires, role: 'authenticated' }), 'sig'];
  return { access_token: token.join('.'), token_type: 'bearer', expires_in: 3600, expires_at: expires, refresh_token: 'refresh', user };
}

// Google's script as the page sees it: initialize, renderButton and prompt, each noted on
// window.googleAsked. Its button signs a token for the client and fingerprint it was given.
function googleScript(agree) {
  return `(() => {
    const asked = window.googleAsked = { config: null, options: null, prompted: 0 };
    const part = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\\+/g, '-').replace(/\\//g, '_');
    window.google = { accounts: { id: {
      initialize: config => { asked.config = config; },
      prompt: () => { asked.prompted += 1; },
      renderButton: (parent, options) => {
        asked.options = options;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'stand-in-google';
        button.textContent = 'Sign in with Google';
        button.addEventListener('click', () => ${agree} && asked.config.callback({
          credential: [part({ alg: 'RS256' }), part({ aud: asked.config.client_id, nonce: asked.config.nonce }), 'sig'].join('.'),
        }));
        parent.append(button);
      },
    } } };
  })();`;
}

async function standInForGoogle(context, { agree = true, user = PLAYER, reachable = true } = {}) {
  const asked = { google: [], tokens: [], signIns: [], signOuts: 0, other: [] };
  await context.route('https://accounts.google.com/**', route => {
    asked.google.push(route.request().url());
    return reachable
      ? route.fulfill({ contentType: 'text/javascript', body: googleScript(agree) })
      : route.abort('internetdisconnected');
  });
  await context.route(`${SUPABASE}/**`, route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === '/auth/v1/authorize') {
      asked.signIns.push(url);
      return route.abort();
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'id_token') {
      const body = request.postDataJSON();
      asked.tokens.push(body);
      const fingerprint = createHash('sha256').update(body.nonce).digest('hex');
      return claims(body.id_token).nonce === fingerprint
        ? route.fulfill({ headers: CORS, json: session(user) })
        : route.fulfill({ status: 400, headers: CORS, json: { error_code: 'bad_nonce' } });
    }
    if (url.pathname === '/auth/v1/logout') {
      asked.signOuts += 1;
      return route.fulfill({ status: 204, headers: CORS });
    }
    // A signed-in page reads the player's saved lines for its ticks — none here; done.test.js's.
    if (url.pathname === '/rest/v1/progress') return route.fulfill({ headers: CORS, json: [] });
    asked.other.push(url.href);
    return route.abort();
  });
  return asked;
}

// Every request a page makes that leaves the site itself, bar the site's font, Sora, which every
// page has always taken from Google Fonts — sign-in's business is everything else.
const FONTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
function leavingTheSite(page, baseURL) {
  const left = [];
  const away = origin => ![new URL(baseURL).origin, ...FONTS].includes(origin);
  page.on('request', r => away(new URL(r.url()).origin) && left.push(r.url()));
  return left;
}

const signIn = page => page.locator('.site .sign-in');
const card = page => page.locator('#sign-in-card');
const googleButton = page => card(page).locator('.stand-in-google');
const avatar = page => page.locator('.site .avatar');

async function signInFrom(page, address) {
  await page.goto(address);
  await signIn(page).click();
  await googleButton(page).click();
  await expect(avatar(page)).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
});

for (const address of ['/app/', '/app/play.html?id=WSCH-0001', '/app/collection.html?slug=issue-1-remake', '/app/book.html?slug=issue-1-remake', '/app/about.html', '/app/privacy.html', '/app/how-to-play.html']) {
  test(`signed out, ${address} shows Sign in at the site bar's right, and nothing leaves the site`, async ({ page, context, baseURL }) => {
    const asked = await standInForGoogle(context);
    const left = leavingTheSite(page, baseURL);
    await page.goto(address);
    await expect(signIn(page)).toBeVisible();
    await expect(signIn(page)).toHaveText('Sign in');
    await expect(avatar(page)).toBeHidden();
    await expect(card(page)).toBeHidden();
    const button = await signIn(page).boundingBox();
    const bar = await page.locator('.site').boundingBox();
    const brand = await page.locator('.site .brand').boundingBox();
    expect(Math.abs((button.x + button.width) - (bar.x + bar.width))).toBeLessThan(1);
    expect(Math.abs((button.y + button.height / 2) - (brand.y + brand.height / 2))).toBeLessThan(1);
    await page.waitForLoadState('networkidle');
    expect(left).toEqual([]);
    expect(asked).toEqual({ google: [], tokens: [], signIns: [], signOuts: 0, other: [] });
  });
}

for (const width of [320, 360]) {
  test(`at ${width}px wide, the burger, the name and Sign in still sit on one line`, async ({ page, context }) => {
    await standInForGoogle(context);
    await page.setViewportSize({ width, height: 600 });
    await page.goto('/app/');
    await expect(signIn(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    const brand = await page.locator('.site .brand').evaluate(el => el.getClientRects().length);
    expect(brand).toBe(1);
    const button = await signIn(page).boundingBox();
    expect(button.height).toBe(44);
  });
}

test('on the narrowest phones Sign in is a figure the burger\'s size, and at 360px its words', async ({ page, context }) => {
  await standInForGoogle(context);
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto('/app/');
  await expect(signIn(page).locator('svg')).toBeVisible();
  await expect(signIn(page).locator('span')).toBeHidden();
  expect((await signIn(page).boundingBox()).width).toBe(44);
  await page.setViewportSize({ width: 360, height: 600 });
  await expect(signIn(page).locator('svg')).toBeHidden();
  await expect(signIn(page).locator('span')).toHaveText('Sign in');
});

test('Sign in opens a card under it holding Google\'s button, and only then is Google asked for its script', async ({ page, context }) => {
  const asked = await standInForGoogle(context);
  await page.goto('/app/');
  await expect(signIn(page)).toHaveAttribute('aria-expanded', 'false');

  await signIn(page).click();

  await expect(card(page)).toBeVisible();
  await expect(signIn(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(googleButton(page)).toHaveText('Sign in with Google');
  const button = await signIn(page).boundingBox();
  const under = await card(page).boundingBox();
  expect(under.y).toBeGreaterThanOrEqual(button.y + button.height);
  expect(asked.google).toEqual([GOOGLE_SCRIPT]);
  await expect(card(page).locator('.unavailable')).toBeHidden();
});

test('Google is set up for the site\'s own client, its standard button, and no One Tap prompt', async ({ page, context }) => {
  await standInForGoogle(context);
  await page.goto('/app/');
  await signIn(page).click();
  await expect(googleButton(page)).toBeVisible();
  const google = await page.evaluate(() => window.googleAsked);
  expect(google.config.client_id).toBe(GOOGLE_CLIENT_ID);
  expect(google.config.auto_select).toBe(false);
  expect(google.config.nonce).toMatch(/^[0-9a-f]{64}$/);
  expect(google.options).toEqual({ type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular' });
  expect(google.prompted).toBe(0);
});

test('closing the card and opening it again asks Google for its script only once', async ({ page, context }) => {
  const asked = await standInForGoogle(context);
  await page.goto('/app/');
  await signIn(page).click();
  await expect(googleButton(page)).toBeVisible();
  await signIn(page).click();
  await expect(card(page)).toBeHidden();
  await signIn(page).click();
  await expect(googleButton(page)).toHaveCount(1);
  expect(asked.google).toEqual([GOOGLE_SCRIPT]);
});

test('Supabase is given Google\'s token and the one-time word whose fingerprint Google was given', async ({ page, context }) => {
  const asked = await standInForGoogle(context);
  await signInFrom(page, '/app/');
  const google = await page.evaluate(() => window.googleAsked);
  expect(asked.tokens).toHaveLength(1);
  const [sent] = asked.tokens;
  expect(sent.provider).toBe('google');
  expect(claims(sent.id_token).aud).toBe(GOOGLE_CLIENT_ID);
  expect(sent.nonce).not.toBe(google.config.nonce);
  expect(createHash('sha256').update(sent.nonce).digest('hex')).toBe(google.config.nonce);
  // The old way round — off the page to Supabase's own address — is gone.
  expect(asked.signIns).toEqual([]);
});

test('choosing an account signs the player in where they are: no reload, the puzzle exactly as they left it', async ({ page, context, baseURL }) => {
  await standInForGoogle(context);
  await page.route('**/content/puzzles/wordsearch/WSCH-0007.json', route => route.fulfill({ json: PUZZLE }));
  await page.goto('/app/play.html?id=WSCH-0007');
  const cols = PUZZLE.grids[0].rows[0].length;
  await page.locator('#grid .cell').nth(4 * cols + 2).click();
  await page.locator('#grid .cell').nth(2 * cols + 2).click();
  await page.locator('#grid .cell').nth(0).click();
  await expect(page.locator('#count')).toHaveText('1/8');
  await page.evaluate(() => { window.stillThisPage = true; });

  await signIn(page).click();
  await googleButton(page).click();

  await expect(avatar(page)).toBeVisible();
  await expect(signIn(page)).toBeHidden();
  await expect(card(page)).toBeHidden();
  await expect(avatar(page).locator('img')).toHaveAttribute('src', PICTURE);
  await expect(avatar(page).locator('.initial')).toBeHidden();
  expect(await page.evaluate(() => window.stillThisPage)).toBe(true);
  await expect(page).toHaveURL(`${baseURL}/app/play.html?id=WSCH-0007`);
  await expect(page.locator('#count')).toHaveText('1/8');
  await expect(page.locator('#overlay line.mark-found')).toHaveCount(1);
  await expect(page.locator('#overlay circle.mark-select')).toHaveCount(1);
});

test('closing Google\'s window leaves the player signed out on the same page, nothing lost, no error', async ({ page, context, baseURL }) => {
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));
  page.on('console', m => m.type() === 'error' && problems.push(m.text()));
  const asked = await standInForGoogle(context, { agree: false });
  await page.goto('/app/?sort=title&dir=asc');
  await page.evaluate(() => { window.stillThisPage = true; });
  await signIn(page).click();
  await googleButton(page).click();

  await expect(page).toHaveURL(`${baseURL}/app/?sort=title&dir=asc`);
  await expect(signIn(page)).toBeVisible();
  await expect(avatar(page)).toBeHidden();
  await expect(page.locator('#sort')).toHaveValue('title');
  expect(await page.evaluate(() => window.stillThisPage)).toBe(true);
  await expect(card(page).locator('.unavailable')).toBeHidden();
  expect(await page.locator('body').innerText()).not.toMatch(/denied|error|isn't available/i);
  expect(asked.tokens).toEqual([]);
  expect(problems).toEqual([]);
});

test('with Google out of reach, the card says so and the puzzle plays as normal', async ({ page, context }) => {
  await standInForGoogle(context, { reachable: false });
  await page.route('**/content/puzzles/wordsearch/WSCH-0007.json', route => route.fulfill({ json: PUZZLE }));
  await page.goto('/app/play.html?id=WSCH-0007');
  await signIn(page).click();

  await expect(card(page).locator('.unavailable')).toHaveText(UNAVAILABLE);
  await expect(card(page).locator('.unavailable')).toBeVisible();
  await expect(googleButton(page)).toHaveCount(0);

  await page.keyboard.press('Escape');
  const cols = PUZZLE.grids[0].rows[0].length;
  await page.locator('#grid .cell').nth(4 * cols + 2).click();
  await page.locator('#grid .cell').nth(2 * cols + 2).click();
  await expect(page.locator('#count')).toHaveText('1/8');
});

test('the card closes on Sign in again, a click elsewhere, Escape, or a press in the side bar', async ({ page, context }) => {
  await standInForGoogle(context);
  await page.goto('/app/');

  await signIn(page).click();
  await signIn(page).click();
  await expect(card(page)).toBeHidden();
  await expect(signIn(page)).toHaveAttribute('aria-expanded', 'false');

  await signIn(page).click();
  await card(page).click({ position: { x: 4, y: 4 } });
  await expect(card(page)).toBeVisible();
  await page.mouse.click(10, 400);
  await expect(card(page)).toBeHidden();

  await signIn(page).click();
  await page.keyboard.press('Escape');
  await expect(card(page)).toBeHidden();
  await expect(signIn(page)).toBeFocused();

  await signIn(page).click();
  await page.locator('#site-side .look-name').click();
  await expect(card(page)).toBeHidden();
  await expect(page.locator('#site-side')).toBeVisible();
});

test('the picture opens a menu: Signed in as their email, Sign out, and Delete my account', async ({ page, context }) => {
  await standInForGoogle(context);
  await signInFrom(page, '/app/');
  const menu = page.locator('#account-menu');
  await expect(menu).toBeHidden();
  await expect(avatar(page)).toHaveAttribute('aria-expanded', 'false');

  await avatar(page).click();

  await expect(menu).toBeVisible();
  await expect(avatar(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.locator('.signed-in-as')).toHaveText('Signed in as pat@example.com');
  await expect(menu.locator('button')).toHaveText(['Sign out', 'Delete my account']);
});

test('the account menu closes on the picture again, a click elsewhere, Escape, or a press in the side bar', async ({ page, context }) => {
  await standInForGoogle(context);
  await signInFrom(page, '/app/');
  const menu = page.locator('#account-menu');

  await avatar(page).click();
  await avatar(page).click();
  await expect(menu).toBeHidden();

  await avatar(page).click();
  await menu.locator('.signed-in-as').click();
  await expect(menu).toBeVisible();
  await page.mouse.click(10, 400);
  await expect(menu).toBeHidden();

  await avatar(page).click();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(avatar(page)).toBeFocused();

  await avatar(page).click();
  await page.locator('#site-side .look-name').click();
  await expect(menu).toBeHidden();
  await expect(page.locator('#site-side')).toBeVisible();
});

test('on a phone, a tap on the picture while the drawer is open only closes the drawer; the next opens its menu', async ({ page, context }) => {
  await standInForGoogle(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInFrom(page, '/app/');
  const menu = page.locator('#account-menu');
  await page.locator('.site .burger').click();
  await expect(page.locator('#site-side')).toBeVisible();
  const picture = await avatar(page).boundingBox();
  await page.mouse.click(picture.x + picture.width / 2, picture.y + picture.height / 2);
  await expect(page.locator('#site-side')).toBeHidden();
  await expect(menu).toBeHidden();
  await avatar(page).click();
  await expect(menu).toBeVisible();
});

test('Escape with the card and menu closed leaves the keyboard where it was', async ({ page, context }) => {
  await standInForGoogle(context);
  await page.goto('/app/');
  await page.locator('#sort').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#sort')).toBeFocused();

  await signInFrom(page, '/app/');
  await page.locator('#sort').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#sort')).toBeFocused();
});

test('closing the tab and coming back later, the player is still signed in, without Google', async ({ page, context }) => {
  const asked = await standInForGoogle(context);
  await signInFrom(page, '/app/');
  await page.close();

  const later = await context.newPage();
  await later.goto('/app/collection.html?slug=issue-1-remake');
  await expect(avatar(later)).toBeVisible();
  await expect(signIn(later)).toBeHidden();
  expect(asked.google).toEqual([GOOGLE_SCRIPT]);
  expect(asked.tokens).toHaveLength(1);
  expect(asked.other).toEqual([]);
});

test('Sign out puts back the Sign in button, and it stays on reload', async ({ page, context }) => {
  const asked = await standInForGoogle(context);
  await signInFrom(page, '/app/');
  await avatar(page).click();
  await page.locator('#account-menu .sign-out').click();

  await expect(signIn(page)).toBeVisible();
  await expect(avatar(page)).toBeHidden();
  await expect(page.locator('#account-menu')).toBeHidden();
  await expect(card(page)).toBeHidden();
  expect(asked.signOuts).toBe(1);

  await page.reload();
  await expect(signIn(page)).toBeVisible();
  await expect(avatar(page)).toBeHidden();
});

test('with no picture from Google, the player\'s initial stands in, in a circle', async ({ page, context }) => {
  await standInForGoogle(context, { user: { ...PLAYER, user_metadata: { full_name: 'Pat Player' } } });
  await signInFrom(page, '/app/');
  await expect(avatar(page).locator('img')).toBeHidden();
  await expect(avatar(page).locator('.initial')).toHaveText('P');
  await expect(avatar(page)).toHaveCSS('border-radius', '50%');
});

test('a picture that won\'t load gives way to the initial', async ({ page, context }) => {
  const broken = 'https://pictures.invalid/pat.png';
  await context.route(broken, r => r.fulfill({ status: 404, body: '' }));
  await standInForGoogle(context, { user: { ...PLAYER, user_metadata: { full_name: 'Pat Player', avatar_url: broken } } });
  await signInFrom(page, '/app/');
  await expect(avatar(page).locator('img')).toBeHidden();
  await expect(avatar(page).locator('.initial')).toHaveText('P');
});
