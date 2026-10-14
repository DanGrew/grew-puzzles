const { test, expect } = require('@playwright/test');

// The How to play page, in the owner's words (the product's docs/CONTENT.md, How to play): one
// section per type, each beside its picture (tooling's tools/grew-puzzles-how-to-play) and at its
// own address, reached from the side bar on every page.
const WORDSEARCH_TYPES = [
  ['vanilla', 'Vanilla', 'Vanilla wordsearches', 'A nice calming wordsearch. No tricks, no challenges; just a normal puzzle: find the words in the list. Words can run in any direction, including diagonally. Of course, they can overlap, but rest assured that words within words (like \'grape\' within \'grapefruit\') appear as two separate words in the grid.', 'A Vanilla wordsearch, with the word BULLOCK found in the grid.'],
  ['missing-words', 'Missing words', 'Missing words wordsearches', 'This is the first type of challenge! The word list includes one or more words that aren\'t in the puzzle… You might have been looking so hard for a word that isn\'t actually in the puzzle! What fun!', 'A Missing words wordsearch with every word found; the leftover words in the list aren\'t in the grid.'],
  ['repeating-words', 'Repeating words', 'Repeating words wordsearches', 'The next challenge doesn\'t involve any trickery, but it does test your focus! The puzzle contains only one word… but lots of it. What starts off as a novelty might leave you seeing the word \'sheep\' in your sleep!', 'A Repeating words wordsearch where every word is SHEEP, with one copy found.'],
  ['wildcard', 'Wildcard', 'Wildcard wordsearches', 'Back to tricky stuff: wildcards are letters in the puzzle hidden behind a \'?\'. Each one stands for a single letter, which could be any letter, and each wildcard can be a different one. Basically, we\'ve just hidden letters to make it harder for you!', 'A Wildcard wordsearch with \'?\' letters in the grid, and BROOM found across one of them.'],
  ['saga', 'Saga', 'Saga wordsearches', 'No more rules, just lots of words! These puzzles have a huge list of words split across several grids. And you guessed it, you have no idea which words are in which grid!', 'A Saga wordsearch: one long word list split across several grids.'],
  ['mirrage', 'Mirra?e', 'Mirra?e wordsearches', 'The ultimate challenge: every trick at once! Two puzzle grids, a word list with words that aren\'t really there, \'?\' wildcards hiding letters, and one word hidden five times across both grids. Like any good mirage, not everything you see is real… Good luck!', 'A Mirra?e wordsearch with \'?\' letters, showing a second copy of TELESCOPE found.'],
];
// The mazes, after every wordsearch, each address ending -maze so a Vanilla maze is never a
// Vanilla wordsearch.
const MAZE_TYPES = [
  ['vanilla-maze', 'Vanilla', 'Vanilla mazes', 'A nice calming maze. Find your way from the start to the end, and pick up the guides as you go. They\'re all on the right path, so if you\'ve found one, you\'re heading the right way!', 'A Vanilla maze with a trail started from the start, passing two guides.'],
  ['collectibles-maze', 'Collectibles', 'Collectibles mazes', 'There\'s treasure off the beaten track! Collectibles are hidden down the side paths, never on the way to the end. Find every one, then make your way out.', 'A Collectibles maze with a trail started from the start, reaching its first collectible.'],
  ['code-breaker-maze', 'Code Breaker', 'Code Breaker mazes', 'Six exits, but only one is right! Find A, B and C, hidden down side paths. Follow the one true route from the start, and the order you pass their turnings is the code. That\'s your exit! Want to finish the whole maze? Find all six exits: the right one gets a ✓ and the rest get a ✗.', 'A Code Breaker maze with a trail started from the start, reaching the letter B.'],
  ['keys-maze', 'Keys', 'Keys mazes', 'Some of the maze is locked! Bump into a locked zone and it\'ll show you the number of the key it needs. That key is somewhere outside the zone. Find it and the zone opens up. Pick up every key to finish!', 'A Keys maze with a trail started from the start, reaching Key 1 and opening its zone.'],
  ['keylecticodes-maze', 'Keylecticodes', 'Keylecticodes mazes', 'Everything at once! Guides, collectibles, keys and zones, A, B and C and six exits, all in one maze. Good luck!', 'A Keylecticodes maze with a trail started from the start, passing a guide and reaching Key 1.'],
];
// Minesweeper, after the mazes: one section for the kind, its picture a board part solved.
const MINESWEEPER_TYPES = [
  ['minesweeper', 'Minesweeper', 'Minesweeper', 'No luck needed, just a little thinking! Some squares show a number. Each number counts the mines in the eight squares around it, and a square with a number is never a mine. Tap a square once to mark it safe with a dot, again to mark a mine, and again to clear it. In a hurry? Tap a number. If all its mines are marked, its other squares get dots. If its empty squares must all be mines, they\'re marked for you. Every board can be solved by logic alone, so you\'ll never have to guess. Mark every mine to finish!', 'A Minesweeper board, part solved: the squares around a 0 dotted, and a number\'s mines marked.'],
];
// Criss-cross, after Minesweeper: one section for the kind, its picture a shape with its starting
// word in place and the only word of its length placed next.
const CRISS_TYPES = [
  ['criss-cross', 'Criss-cross', 'Criss-cross', 'A list of words and an empty shape: can you fit them all in? One word is already in place to get you started. Words cross where they share a letter, so every word you place gives you letters for the next. Tap a slot, then tap a word to put it in. If it doesn\'t fit the letters already there, it won\'t go in. Changed your mind? Tap a word you\'ve placed to take it back out. Every puzzle can be solved by logic alone, so you\'ll never have to guess. Fill every slot to finish!', 'A Criss-cross puzzle with its starting word in place, and ANNIVERSARY placed beside it.'],
];
const TYPES = [...WORDSEARCH_TYPES, ...MAZE_TYPES, ...MINESWEEPER_TYPES, ...CRISS_TYPES];

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
  await context.route('https://vxschtygvtilsadgixec.supabase.co/**', route => route.abort());
});

for (const address of ['/app/', '/app/play.html?id=WSCH-0001', '/app/collection.html?slug=issue-1-remake', '/app/book.html?slug=issue-1-remake', '/app/about.html', '/app/privacy.html', '/app/how-to-play.html', '/app/saving.html', '/app/feedback.html']) {
  test(`on ${address}, the side bar holds How to play, which opens the How to play page`, async ({ page, baseURL }) => {
    await page.goto(address);
    const entry = page.locator('#site-side .page', { hasText: 'How to play' });
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

test('the list at the top has four groups, Wordsearches, Mazes, Minesweeper then Criss-cross, each holding its own kind\'s types', async ({ page }) => {
  await page.goto('/app/how-to-play.html');
  await expect(page.locator('main nav .group-name')).toHaveText(['Wordsearches', 'Mazes', 'Minesweeper', 'Criss-cross']);
  await expect(page.getByRole('list', { name: 'Wordsearches' }).locator('a')).toHaveText(WORDSEARCH_TYPES.map(([, name]) => name));
  await expect(page.getByRole('list', { name: 'Mazes' }).locator('a')).toHaveText(MAZE_TYPES.map(([, name]) => name));
  await expect(page.getByRole('list', { name: 'Minesweeper' }).locator('a')).toHaveText(MINESWEEPER_TYPES.map(([, name]) => name));
  await expect(page.getByRole('list', { name: 'Criss-cross' }).locator('a')).toHaveText(CRISS_TYPES.map(([, name]) => name));
});

test('tapping Minesweeper in the list jumps to its section, after the mazes', async ({ page, baseURL }) => {
  await page.goto('/app/how-to-play.html');
  await page.getByRole('list', { name: 'Minesweeper' }).getByRole('link', { name: 'Minesweeper' }).click();
  await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html#minesweeper`);
  await expect(page.locator('#minesweeper h2')).toBeInViewport();
});

test('tapping Criss-cross in the list jumps to its section, after Minesweeper', async ({ page, baseURL }) => {
  await page.goto('/app/how-to-play.html');
  await page.getByRole('list', { name: 'Criss-cross' }).getByRole('link', { name: 'Criss-cross' }).click();
  await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html#criss-cross`);
  await expect(page.locator('#criss-cross h2')).toBeInViewport();
});

test('tapping a maze type in the list jumps to its section, not the wordsearch of the same name', async ({ page, baseURL }) => {
  await page.goto('/app/how-to-play.html');
  await page.getByRole('list', { name: 'Mazes' }).getByRole('link', { name: 'Vanilla' }).click();
  await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html#vanilla-maze`);
  await expect(page.locator('#vanilla-maze h2')).toHaveText('Vanilla mazes');
  await expect(page.locator('#vanilla-maze h2')).toBeInViewport();
  await page.getByRole('list', { name: 'Wordsearches' }).getByRole('link', { name: 'Vanilla' }).click();
  await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html#vanilla`);
  await expect(page.locator('#vanilla h2')).toHaveText('Vanilla wordsearches');
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
  expect(sides).toEqual(TYPES.map((_, i) => (i % 2 ? 'right' : 'left')));
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

test('on the How to play page, How to play is the side bar\'s current entry', async ({ page }) => {
  await page.goto('/app/how-to-play.html');
  await expect(page.locator('#site-side [aria-current="page"]')).toHaveText(['How to play']);
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
  await page.locator('#site-side .look button[data-look="plain"]').click();
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
