const { test, expect } = require('@playwright/test');
// Printing on a phone (BUG-226): Print page sits in the burger's drawer, and the paper is the puzzle
// alone — the drawer is shut before the print starts, and paper never shows it, open or not.
// The dialog is stood in for by one that notes, as the print starts, whether the drawer is open.
const FILES = {
  wordsearch: require('./fixtures/WSCH-0007.json'),
  maze: require('./fixtures/MAZE-0002.json'),
  minesweeper: require('./fixtures/MINE-0001.json'),
  crisscross: require('./fixtures/CRSS-0001.json'),
  mosaic: require('./fixtures/MOSA-0001.json'),
};
const PAGES = { wordsearch: 'play', maze: 'maze', minesweeper: 'minesweeper', crisscross: 'crisscross', mosaic: 'mosaic' };

test.use({ viewport: { width: 390, height: 844 } });

async function open(page, kind, look = 'themed') {
  await page.addInitScript(l => {
    localStorage.setItem('grew-puzzles.look', l);
    window.printed = [];
    window.print = () => { window.printed.push(document.getElementById('site-side').hasAttribute('data-open')); };
  }, look);
  await page.route(new RegExp(`/content/puzzles/${kind}/[A-Z]+-\\d+\\.json$`), r => r.fulfill({ json: FILES[kind] }));
  await page.goto(`/app/${PAGES[kind]}.html?id=${FILES[kind].hiddenId}`);
  await expect(page.locator('#site-side #print')).toBeAttached();
}

async function pickInDrawer(page, style) {
  await page.locator('.site .burger').click();
  await page.locator(`#site-side #print [data-print="${style}"]`).click();
  await expect.poll(() => page.evaluate(() => window.printed)).toEqual([false]);
}

for (const kind of Object.keys(FILES)) {
  test(`on a phone, a ${kind}'s Print page Plain shuts the drawer before the print starts`, async ({ page }) => {
    await open(page, kind);
    await pickInDrawer(page, 'plain');
  });
}

for (const style of ['colour', 'mono']) {
  test(`on a phone with Blueprint on, Print page ${style} shuts the drawer before the print starts`, async ({ page }) => {
    await open(page, 'wordsearch', 'blueprint');
    await pickInDrawer(page, style);
  });
}

test('on a phone, the drawer left open never prints: the browser\'s own Print shows the puzzle alone', async ({ page }) => {
  await open(page, 'wordsearch');
  await page.locator('.site .burger').click();
  await expect(page.locator('#site-side')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  for (const part of ['#site-side', '.side-scrim', '.site .burger']) await expect(page.locator(part)).toBeHidden();
  await expect(page.locator('#grid')).toBeVisible();
});

test('on a phone, after Print page the drawer is shut on screen', async ({ page }) => {
  await open(page, 'wordsearch');
  await pickInDrawer(page, 'plain');
  await expect(page.locator('#site-side')).toBeHidden();
  await expect(page.locator('.site .burger')).toHaveAttribute('aria-expanded', 'false');
});
