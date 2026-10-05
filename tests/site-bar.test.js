const { test, expect } = require('@playwright/test');

test('the site address lands on the page with the Grew Puzzles site bar', async ({ page }) => {
  await page.goto('/grew-puzzles/');
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.locator('.site .brand')).toHaveText('Grew Puzzles');
  await expect(page.locator('.site .burger')).toBeVisible();
});

test('the site bar is set in Sora', async ({ page }) => {
  await page.goto('/app/');
  const font = await page.locator('.site .brand').evaluate(el => getComputedStyle(el).fontFamily);
  expect(font.split(',')[0]).toBe('Sora');
});

test('the brand returns to the landing page', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('.site .brand')).toHaveAttribute('href', 'index.html');
});

test('the burger opens a menu holding Wordsearches, About us and Privacy, while the site has no collections', async ({ page }) => {
  await page.route('**/content/collections/index.json', r => r.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/app/');
  const burger = page.locator('.site .burger');
  const panel = page.locator('#site-menu');
  await expect(panel).toBeHidden();
  await expect(burger).toHaveAttribute('aria-expanded', 'false');

  await burger.click();

  await expect(panel).toBeVisible();
  await expect(burger).toHaveAttribute('aria-expanded', 'true');
  const entries = panel.locator('a:visible');
  await expect(entries).toHaveText(['Wordsearches', 'About us', 'Privacy']);
  await expect(entries.first()).toHaveAttribute('href', 'index.html');
  await expect(entries.first()).toHaveAttribute('aria-current', 'page');
  await expect(entries.last()).toHaveAttribute('href', 'privacy.html');
  await expect(entries.last()).not.toHaveAttribute('aria-current');
});

test('the burger closes the menu again', async ({ page }) => {
  await page.goto('/app/');
  const burger = page.locator('.site .burger');
  await burger.click();
  await burger.click();
  await expect(page.locator('#site-menu')).toBeHidden();
  await expect(burger).toHaveAttribute('aria-expanded', 'false');
});

test('clicking inside the open menu keeps it open', async ({ page }) => {
  await page.goto('/app/');
  await page.locator('.site .burger').click();
  await page.locator('#site-menu').dispatchEvent('click');
  await expect(page.locator('#site-menu')).toBeVisible();
});

test('clicking elsewhere closes the menu', async ({ page }) => {
  await page.goto('/app/');
  await page.locator('.site .burger').click();
  await page.mouse.click(10, 400);
  await expect(page.locator('#site-menu')).toBeHidden();
});

test('Escape closes the menu and returns focus to the burger', async ({ page }) => {
  await page.goto('/app/');
  const burger = page.locator('.site .burger');
  await burger.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#site-menu')).toBeHidden();
  await expect(burger).toBeFocused();
});

test('Escape with the menu closed leaves the keyboard where it was', async ({ page }) => {
  await page.goto('/app/');
  await page.locator('#sort').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#sort')).toBeFocused();
});

test('other keys leave the menu open', async ({ page }) => {
  await page.goto('/app/');
  await page.locator('.site .burger').click();
  await page.keyboard.press('a');
  await expect(page.locator('#site-menu')).toBeVisible();
});
