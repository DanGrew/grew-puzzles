const { test, expect } = require('@playwright/test');

// Google and Supabase, stood in for: nothing here reaches either. Supabase's sign-in address sends
// the player straight back, as Google would once they choose — with a one-time code when they
// agree, or Google's word that they cancelled — and the code buys a session for PLAYER.
const SUPABASE = 'https://vxschtygvtilsadgixec.supabase.co';
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

function session(user) {
  const part = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = [part({ alg: 'HS256', typ: 'JWT' }), part({ sub: user.id, exp: expires, role: 'authenticated' }), 'sig'];
  return { access_token: token.join('.'), token_type: 'bearer', expires_in: 3600, expires_at: expires, refresh_token: 'refresh', user };
}

async function standInForGoogle(context, { agree = true, user = PLAYER } = {}) {
  const asked = { signIns: [], signOuts: 0, other: [] };
  await context.route(`${SUPABASE}/**`, route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === '/auth/v1/authorize') {
      asked.signIns.push(url);
      const back = new URL(url.searchParams.get('redirect_to'));
      const answer = agree ? { code: 'one-time-code' } : {
        error: 'access_denied', error_code: 'access_denied', error_description: 'The user denied access',
      };
      Object.entries(answer).forEach(([key, value]) => back.searchParams.set(key, value));
      return route.fulfill({ status: 302, headers: { location: back.href } });
    }
    if (url.pathname === '/auth/v1/token') return route.fulfill({ headers: CORS, json: session(user) });
    if (url.pathname === '/auth/v1/logout') {
      asked.signOuts += 1;
      return route.fulfill({ status: 204, headers: CORS });
    }
    asked.other.push(url.href);
    return route.abort();
  });
  return asked;
}

const signIn = page => page.locator('.site .sign-in');
const avatar = page => page.locator('.site .avatar');

async function signInFrom(page, address) {
  await page.goto(address);
  await signIn(page).click();
  await expect(avatar(page)).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
});

for (const address of ['/app/', '/app/play.html?id=WSCH-0001', '/app/collection.html?slug=issue-1-remake', '/app/book.html?slug=issue-1-remake']) {
  test(`signed out, ${address} shows Sign in beside the burger, and asks Supabase nothing`, async ({ page, context }) => {
    const asked = await standInForGoogle(context);
    await page.goto(address);
    await expect(signIn(page)).toBeVisible();
    await expect(signIn(page)).toHaveText('Sign in');
    await expect(avatar(page)).toBeHidden();
    const button = await signIn(page).boundingBox();
    const burger = await page.locator('.site .burger').boundingBox();
    expect(button.x + button.width).toBeLessThan(burger.x);
    expect(Math.abs((button.y + button.height / 2) - (burger.y + burger.height / 2))).toBeLessThan(1);
    expect(asked).toEqual({ signIns: [], signOuts: 0, other: [] });
  });
}

for (const width of [320, 360]) {
  test(`at ${width}px wide, the name, Sign in and burger still sit on one line`, async ({ page, context }) => {
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

test('Sign in goes to Google, asking which account, and back to this page', async ({ page, context, baseURL }) => {
  const asked = await standInForGoogle(context);
  await signInFrom(page, '/app/play.html?id=WSCH-0001');
  expect(asked.signIns).toHaveLength(1);
  const signingIn = asked.signIns[0].searchParams;
  expect(signingIn.get('provider')).toBe('google');
  expect(signingIn.get('prompt')).toBe('select_account');
  expect(signingIn.get('redirect_to')).toBe(`${baseURL}/app/play.html?id=WSCH-0001`);
  // No scopes asked beyond Supabase's own for Google: the player's name, email and picture.
  expect(signingIn.has('scopes')).toBe(false);
});

test('agreeing brings the player back to the page they started on, Sign in now their picture', async ({ page, context, baseURL }) => {
  await standInForGoogle(context);
  await signInFrom(page, '/app/?sort=title&dir=asc');
  await expect(page).toHaveURL(`${baseURL}/app/?sort=title&dir=asc`);
  await expect(signIn(page)).toBeHidden();
  await expect(avatar(page).locator('img')).toHaveAttribute('src', PICTURE);
  await expect(avatar(page).locator('img')).toBeVisible();
  await expect(avatar(page).locator('.initial')).toBeHidden();
  await expect(page.locator('#sort')).toHaveValue('title');
});

test('signed in on the play page, the puzzle plays as before', async ({ page, context, baseURL }) => {
  await standInForGoogle(context);
  await signInFrom(page, '/app/play.html?id=WSCH-0001');
  await expect(page).toHaveURL(`${baseURL}/app/play.html?id=WSCH-0001`);
  await expect(page.locator('#play')).toBeVisible();
  await expect(page.locator('#title')).not.toBeEmpty();
});

test('the picture opens a menu: Signed in as their email, and Sign out', async ({ page, context }) => {
  await standInForGoogle(context);
  await signInFrom(page, '/app/');
  const menu = page.locator('#account-menu');
  await expect(menu).toBeHidden();
  await expect(avatar(page)).toHaveAttribute('aria-expanded', 'false');

  await avatar(page).click();

  await expect(menu).toBeVisible();
  await expect(avatar(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.locator('.signed-in-as')).toHaveText('Signed in as pat@example.com');
  await expect(menu.locator('button')).toHaveText(['Sign out']);
});

test('the account menu closes on the picture again, a click elsewhere, Escape, or the burger', async ({ page, context }) => {
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
  await page.locator('.site .burger').click();
  await expect(menu).toBeHidden();
  await expect(page.locator('#site-menu')).toBeVisible();

  await avatar(page).click();
  await expect(page.locator('#site-menu')).toBeHidden();
  await expect(menu).toBeVisible();
});

test('Escape with the account menu closed leaves the keyboard where it was', async ({ page, context }) => {
  await standInForGoogle(context);
  await signInFrom(page, '/app/');
  await page.locator('#sort').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#sort')).toBeFocused();
});

test('closing the tab and coming back later, the player is still signed in', async ({ page, context }) => {
  const asked = await standInForGoogle(context);
  await signInFrom(page, '/app/');
  await page.close();

  const later = await context.newPage();
  await later.goto('/app/collection.html?slug=issue-1-remake');
  await expect(avatar(later)).toBeVisible();
  await expect(signIn(later)).toBeHidden();
  expect(asked.signIns).toHaveLength(1);
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
  expect(asked.signOuts).toBe(1);

  await page.reload();
  await expect(signIn(page)).toBeVisible();
  await expect(avatar(page)).toBeHidden();
});

test('cancelling on Google\'s screen comes back signed out to the starting page, with no error', async ({ page, context, baseURL }) => {
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));
  page.on('console', m => m.type() === 'error' && problems.push(m.text()));
  await standInForGoogle(context, { agree: false });
  await page.goto('/app/collection.html?slug=issue-1-remake');
  await signIn(page).click();

  await expect(page).toHaveURL(`${baseURL}/app/collection.html?slug=issue-1-remake`);
  await expect(signIn(page)).toBeVisible();
  await expect(avatar(page)).toBeHidden();
  await expect(page.locator('body')).not.toContainText(/denied|error/i);
  expect(problems).toEqual([]);
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
