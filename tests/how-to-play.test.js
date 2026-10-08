const { test, expect } = require('@playwright/test');

// The How to play page, in the owner's words (the product's docs/CONTENT.md, How to play): one
// section per type, each beside its picture (tooling's tools/grew-puzzles-how-to-play) and at its
// own address, reached from the burger menu on every page.
const TYPES = [
  ['vanilla', 'Vanilla', 'Vanilla wordsearches', 'A nice calming wordsearch. No tricks, no challenges; just a normal puzzle: find the words in the list. Words can run in any direction, including diagonally. Of course, they can overlap, but rest assured that words within words (like \'grape\' within \'grapefruit\') appear as two separate words in the grid.', 'A Vanilla wordsearch, with the word BULLOCK found in the grid.'],
  ['missing-words', 'Missing words', 'Missing words wordsearches', 'This is the first type of challenge! The word list includes one or more words that aren\'t in the puzzle… You might have been looking so hard for a word that isn\'t actually in the puzzle! What fun!', 'A Missing words wordsearch with every word found; the leftover words in the list aren\'t in the grid.'],
  ['repeating-words', 'Repeating words', 'Repeating words wordsearches', 'The next challenge doesn\'t involve any trickery, but it does test your focus! The puzzle contains only one word… but lots of it. What starts off as a novelty might leave you seeing the word \'sheep\' in your sleep!', 'A Repeating words wordsearch where every word is SHEEP, with one copy found.'],
  ['wildcard', 'Wildcard', 'Wildcard wordsearches', 'Back to tricky stuff: wildcards are letters in the puzzle hidden behind a \'?\'. Each one stands for a single letter, which could be any letter, and each wildcard can be a different one. Basically, we\'ve just hidden letters to make it harder for you!', 'A Wildcard wordsearch with \'?\' letters in the grid, and BROOM found across one of them.'],
  ['saga', 'Saga', 'Saga wordsearches', 'No more rules, just lots of words! These puzzles have a huge list of words split across several grids. And you guessed it, you have no idea which words are in which grid!', 'A Saga wordsearch: one long word list split across several grids.'],
  ['mirrage', 'Mirra?e', 'Mirra?e wordsearches', 'The ultimate challenge: every trick at once! Two puzzle grids, a word list with words that aren\'t really there, \'?\' wildcards hiding letters, and one word hidden five times across both grids. Like any good mirage, not everything you see is real… Good luck!', 'A Mirra?e wordsearch with \'?\' letters, showing a second copy of TELESCOPE found.'],
];

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
  await context.route('https://vxschtygvtilsadgixec.supabase.co/**', route => route.abort());
});

for (const address of ['/app/', '/app/play.html?id=WSCH-0001', '/app/collection.html?slug=issue-1-remake', '/app/book.html?slug=issue-1-remake', '/app/about.html', '/app/privacy.html', '/app/how-to-play.html', '/app/saving.html']) {
  test(`on ${address}, the burger menu holds How to play, which opens the How to play page`, async ({ page, baseURL }) => {
    await page.goto(address);
    await page.locator('.site .burger').click();
    const entry = page.locator('#site-menu > a:visible', { hasText: 'How to play' });
    await expect(entry).toHaveCount(1);
    await entry.click();
    await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html`);
    await expect(page.locator('h1')).toHaveText('How to play');
  });
}

test('the How to play page shows every type in order, each worded exactly as the owner wrote it', async ({ page }) => {
  await page.goto('/app/how-to-play.html');
  await expect(page).toHaveTitle('How to play · Grew Puzzles');
  await expect(page.locator('main section')).toHaveCount(TYPES.length);
  expect(await page.locator('main section').evaluateAll(sections => sections.map(s => s.id))).toEqual(TYPES.map(([id]) => id));
  await expect(page.locator('main section h2')).toHaveText(TYPES.map(([, , heading]) => heading));
  await expect(page.locator('main section p')).toHaveText(TYPES.map(([, , , words]) => words));
});

test('each type\'s picture is its own, and its alt text names the type and what it shows', async ({ page }) => {
  await page.goto('/app/how-to-play.html');
  for (const [id, , , , alt] of TYPES) {
    const picture = page.locator(`#${id} img`);
    await expect(picture).toHaveAttribute('src', `../content/how-to-play/${id}.png`);
    await expect(picture).toHaveAttribute('alt', alt);
    expect(await picture.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }
});

test('the top of the page lists every type, and picking one goes to its section', async ({ page, baseURL }) => {
  await page.goto('/app/how-to-play.html');
  const links = page.locator('main nav a');
  await expect(links).toHaveText(TYPES.map(([, name]) => name));
  await links.filter({ hasText: 'Saga' }).click();
  await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html#saga`);
  await expect(page.locator('#saga h2')).toBeInViewport();
});

for (const [id] of TYPES) {
  test(`opening how-to-play.html#${id} lands on that type's section`, async ({ page }) => {
    await page.goto(`/app/how-to-play.html#${id}`);
    await expect(page.locator(`#${id} h2`)).toBeInViewport();
  });
}

test('on a wide screen each picture sits beside its words, alternating sides down the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app/how-to-play.html');
  const sides = [];
  for (const [id] of TYPES) {
    const picture = await page.locator(`#${id} img`).boundingBox();
    const words = await page.locator(`#${id} .type-words`).boundingBox();
    expect(picture.y).toBeLessThan(words.y + words.height);
    expect(words.y).toBeLessThan(picture.y + picture.height);
    sides.push(picture.x < words.x ? 'left' : 'right');
  }
  expect(sides).toEqual(['left', 'right', 'left', 'right', 'left', 'right']);
});

test('on a phone each picture sits above its words', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/app/how-to-play.html');
  for (const [id] of TYPES) {
    const picture = await page.locator(`#${id} img`).boundingBox();
    const words = await page.locator(`#${id} .type-words`).boundingBox();
    expect(picture.y + picture.height).toBeLessThanOrEqual(words.y);
  }
});

test('on the How to play page, How to play is the menu\'s current entry', async ({ page }) => {
  await page.goto('/app/how-to-play.html');
  await page.locator('.site .burger').click();
  await expect(page.locator('#site-menu [aria-current]')).toHaveText(['How to play']);
});

test('the How to play page wears the site bar, and its words sit on the card with a character, Themed', async ({ page }) => {
  await page.goto('/app/how-to-play.html');
  await expect(page.locator('.site .brand')).toHaveText('Grew Puzzles');
  await expect(page.locator('.page-card section')).toHaveCount(TYPES.length);
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await expect(page.locator('#theme-figure')).toBeVisible();
});

test('Plain, the How to play page shows no character', async ({ page }) => {
  await page.goto('/app/how-to-play.html');
  await page.locator('.site .burger').click();
  await page.locator('#site-menu .look button[data-look="plain"]').click();
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
  await expect(page.locator('main section')).toHaveCount(TYPES.length);
});

test('on the narrowest phone the How to play page reads without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/app/how-to-play.html');
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
