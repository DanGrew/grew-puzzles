const { test, expect } = require('@playwright/test');

// How to play, a page a kind (the product's TASK-212): opened only by the book icon beside each kind
// in the side bar, and on each play page; Basics | Advanced | Variants pills at the top, Basics
// picked as it opens; Variants holds the kind's types, a section each in the owner's words (the
// product's docs/CONTENT.md, How to play) beside its picture (tooling's tools/grew-puzzles-how-to-play).
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
const KINDS = [
  ['wordsearch', 'Wordsearches', WORDSEARCH_TYPES],
  ['maze', 'Mazes', MAZE_TYPES],
  ['minesweeper', 'Minesweeper', MINESWEEPER_TYPES],
  ['crisscross', 'Criss-cross', CRISS_TYPES],
  ['mosaic', 'Mosaic', []],
];
const PLAY_PAGES = [
  ['/app/play.html?id=WSCH-0001', 'wordsearch', 'Wordsearches'],
  ['/app/maze.html?id=MAZE-0001', 'maze', 'Mazes'],
  ['/app/minesweeper.html?id=MINE-0001', 'minesweeper', 'Minesweeper'],
  ['/app/crisscross.html?id=CRSS-0001', 'crisscross', 'Criss-cross'],
  ['/app/mosaic.html?id=MOSA-0001', 'mosaic', 'Mosaic'],
];

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
  await context.route('https://vxschtygvtilsadgixec.supabase.co/**', route => route.abort());
});

const side = page => page.locator('#site-side');
const shown = page => page.locator('main .part:not([hidden])');
const pill = (page, name) => page.getByRole('tab', { name });

for (const address of ['/app/', '/app/about.html', '/app/how-to-play.html?kind=maze', '/app/collection.html?slug=issue-1-remake']) {
  test(`on ${address}, each kind in the side bar has a book icon opening its How to play page; its name still browses it`, async ({ page, baseURL }) => {
    await page.goto(address);
    await expect(side(page).locator('.kind-row .rules')).toHaveCount(KINDS.length);
    for (const [kind, name] of KINDS) {
      const icon = side(page).getByRole('link', { name: `How to play ${name}` });
      await expect(icon).toHaveAttribute('href', `how-to-play.html?kind=${kind}`);
      await expect(icon.locator('svg')).toBeVisible();
    }
    await expect(side(page).locator('.kind').nth(1)).toHaveAttribute('href', 'index.html?kind=maze');
    await side(page).getByRole('link', { name: 'How to play Minesweeper' }).click();
    await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html?kind=minesweeper`);
    await expect(page.locator('h1')).toHaveText('How to play Minesweeper');
  });
}

test('each book icon sits on its kind\'s row, at its right', async ({ page }) => {
  await page.goto('/app/');
  for (const [, name] of KINDS) {
    const row = side(page).locator('.kind-row', { has: page.getByRole('link', { name: `How to play ${name}` }) });
    const kind = await row.locator('.kind').boundingBox();
    const icon = await row.locator('.rules').boundingBox();
    expect(icon.x).toBeGreaterThanOrEqual(kind.x + kind.width - 1);
    expect(Math.abs((icon.y + icon.height / 2) - (kind.y + kind.height / 2))).toBeLessThan(2);
  }
});

test('the side bar no longer lists How to play among its pages', async ({ page }) => {
  await page.goto('/app/');
  await expect(side(page).locator('.page')).toHaveText(['Saving your progress', 'About us', 'Unofficial', 'Feedback', 'Privacy']);
  await expect(side(page).locator('.page', { hasText: 'How to play' })).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the drawer\'s kinds each have their book icon, opening the kind\'s page', async ({ page, baseURL }) => {
    await page.goto('/app/');
    await page.locator('.site .burger').click();
    await expect(side(page).locator('.kind-row .rules:visible')).toHaveCount(KINDS.length);
    await side(page).getByRole('link', { name: 'How to play Mazes' }).click();
    await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html?kind=maze`);
    await expect(page.locator('h1')).toHaveText('How to play Mazes');
  });
});

for (const [kind, name, types] of KINDS) {
  test(`${name}' page opens on Basics, then Advanced, then Variants holds its types in order, worded as the owner wrote them`, async ({ page }) => {
    await page.goto(`/app/how-to-play.html?kind=${kind}`);
    await expect(page).toHaveTitle(`How to play ${name} · Grew Puzzles`);
    await expect(page.getByRole('tab')).toHaveText(['Basics', 'Advanced', 'Variants']);
    await expect(pill(page, 'Basics')).toHaveAttribute('aria-selected', 'true');
    await expect(shown(page)).toHaveCount(1);
    await expect(shown(page)).toHaveAttribute('data-part', 'basics');
    await expect(shown(page)).toHaveAttribute('data-kind', kind);
    await pill(page, 'Advanced').click();
    await expect(pill(page, 'Advanced')).toHaveAttribute('aria-selected', 'true');
    await expect(pill(page, 'Basics')).toHaveAttribute('aria-selected', 'false');
    await expect(shown(page)).toHaveAttribute('data-part', 'advanced');
    await pill(page, 'Variants').click();
    await expect(shown(page)).toHaveAttribute('data-part', 'variants');
    await expect(shown(page)).toHaveAttribute('data-kind', kind);
    await expect(page.locator('main section:visible')).toHaveCount(types.length);
    expect(await page.locator('main section:visible').evaluateAll(s => s.map(e => e.id))).toEqual(types.map(([id]) => id));
    await expect(page.locator('main section:visible h2')).toHaveText(types.map(([, , heading]) => heading));
    await expect(page.locator('main section:visible p')).toHaveText(types.map(([, , , words]) => words));
  });
}

test('Variants\' pictures are each type\'s own, its alt text naming the type and what it shows', async ({ page }) => {
  for (const [kind, , types] of KINDS) {
    await page.goto(`/app/how-to-play.html?kind=${kind}`);
    await pill(page, 'Variants').click();
    for (const [id, , , , alt] of types) {
      const picture = page.locator(`#${id} img`);
      await expect(picture).toHaveAttribute('src', `../content/how-to-play/${id}.png`);
      await expect(picture).toHaveAttribute('alt', alt);
      expect(await picture.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    }
  }
});

test('a part with nothing written yet is still a pill, and shows empty — no heading, no coming soon', async ({ page }) => {
  await page.goto('/app/how-to-play.html?kind=mosaic');
  for (const name of ['Basics', 'Advanced', 'Variants']) {
    await pill(page, name).click();
    await expect(shown(page)).toHaveCount(1);
    await expect(shown(page)).toBeEmpty();
  }
  await expect(page.locator('main .page-card')).not.toContainText(/coming soon/i);
});

test('an address naming no kind the site has opens Wordsearches\' page', async ({ page }) => {
  for (const address of ['/app/how-to-play.html', '/app/how-to-play.html?kind=nope']) {
    await page.goto(address);
    await expect(page.locator('h1')).toHaveText('How to play Wordsearches');
    await expect(shown(page)).toHaveAttribute('data-kind', 'wordsearch');
  }
});

test('on a kind\'s How to play page, that kind is the side bar\'s current entry', async ({ page }) => {
  await page.goto('/app/how-to-play.html?kind=maze');
  await expect(side(page).locator('.kind[aria-current="page"]')).toHaveCount(1);
  await expect(side(page).locator('.kind[aria-current="page"]')).toContainText('Mazes');
});

for (const [address, kind, name] of PLAY_PAGES) {
  test(`${address} wears its kind's book icon, opening its How to play page on Basics`, async ({ page, baseURL }) => {
    await page.goto(address);
    const icon = page.locator('.play-rules').getByRole('link', { name: `How to play ${name}` });
    await expect(icon).toBeVisible();
    await icon.click();
    await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html?kind=${kind}`);
    await expect(pill(page, 'Basics')).toHaveAttribute('aria-selected', 'true');
  });
}

for (const [width, height] of [[1440, 900], [320, 640]]) {
  test(`at ${width}px wide a play page's book icon sits at its title's right, never over it`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const [address] of PLAY_PAGES) {
      await page.goto(address);
      await expect(page.locator('.play-rules + .play-head h1')).not.toBeEmpty();
      const icon = await page.locator('.play-rules .rules').boundingBox();
      const title = await page.locator('.play-rules + .play-head h1').boundingBox();
      expect(icon.x).toBeGreaterThanOrEqual(title.x + title.width);
      expect(icon.y).toBeLessThan(title.y + title.height);
    }
  });
}

test('a play page\'s book icon never prints', async ({ page }) => {
  await page.goto('/app/play.html?id=WSCH-0001');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.play-rules')).toBeHidden();
});

test('on a wide screen each Variants picture sits beside its words, alternating sides down the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app/how-to-play.html?kind=maze');
  await pill(page, 'Variants').click();
  const sides = [];
  for (const [id] of MAZE_TYPES) {
    const picture = await page.locator(`#${id} img`).boundingBox();
    const words = await page.locator(`#${id} .type-words`).boundingBox();
    expect(picture.y).toBeLessThan(words.y + words.height);
    expect(words.y).toBeLessThan(picture.y + picture.height);
    sides.push(picture.x < words.x ? 'left' : 'right');
  }
  expect(sides).toEqual(MAZE_TYPES.map((_, i) => (i % 2 ? 'right' : 'left')));
});

test('on a phone each Variants picture sits above its words', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/app/how-to-play.html?kind=wordsearch');
  await pill(page, 'Variants').click();
  for (const [id] of WORDSEARCH_TYPES) {
    const picture = await page.locator(`#${id} img`).boundingBox();
    const words = await page.locator(`#${id} .type-words`).boundingBox();
    expect(picture.y + picture.height).toBeLessThanOrEqual(words.y);
  }
});

test('the How to play page wears the site bar, and its words sit on the card with a character, Themed', async ({ page }) => {
  await page.goto('/app/how-to-play.html?kind=wordsearch');
  await expect(page.locator('.site .brand')).toHaveText('Grew Puzzles');
  await pill(page, 'Variants').click();
  await expect(page.locator('.page-card section:visible')).toHaveCount(WORDSEARCH_TYPES.length);
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await expect(page.locator('#theme-figure')).toBeVisible();
});

test('Plain, the How to play page shows no character', async ({ page }) => {
  await page.goto('/app/how-to-play.html?kind=wordsearch');
  await page.locator('#site-side .look select').selectOption('plain');
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
});

test('on the narrowest phone the How to play page and its pills read without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/app/how-to-play.html?kind=crisscross');
  await expect(page.locator('h1')).toBeVisible();
  await expect(pill(page, 'Variants')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
