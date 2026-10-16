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
// Wordsearches' Basics and Advanced (the product's TASK-218), as the owner marked them on the
// worksheet (its docs/RULES.md) and worded them (its docs/CONTENT.md, How to play): every basic said
// with its example, a sentence beside its picture; every advanced move in, its name, when it
// happens, then the puzzle, how it's spotted and the word found, each captioned. The pictures are
// tooling's tools/grew-puzzles-rules, drawn from the worksheet's made-up grids.
const WORDSEARCH_BASICS = [
  ['every', 'Find every word in the list. The puzzle\'s done when they\'re all found: here, CAT, DOG and HEN.', 'A small grid with CAT, DOG and HEN found, and all three crossed off the word list.'],
  ['eight', 'Words run in eight directions: across, down, diagonally, and backwards in any of them. OWL here reads up and to the left, on a diagonal and backwards.', 'A small grid with OWL found reading diagonally up and to the left.'],
  ['share', 'Words can cross, sharing a letter. COW and CAT share their C, and a shared letter gets a circle.', 'A small grid with COW running across and CAT running down from the same circled C.'],
  ['inside', 'A word inside another word doesn\'t count. The PIG inside PIGLET isn\'t the one you\'re after: PIG is hidden on its own.', 'A small grid with PIGLET found across the top, and PIG found on its own, running upwards.'],
  ['mark', 'To mark a word, tap its first letter, then its last. Tap the F, then the X. Either end works.', 'A small grid with FOX found on a diagonal, its F circled where the tap began.'],
  ['struck', 'A found word is crossed off the list. FOX is found, so it\'s crossed off.', 'A word list of FOX, HEN and OWL, with FOX crossed off.'],
];
const STEPS = ['puzzle', 'spot', 'found'];
const WORDSEARCH_MOVES = [
  ['rare', 'Hunt the rarest letter first', 'When a word has a letter the grid hardly uses, like Z, Q, X or J.', [
    ['The puzzle', 'Find WIZARD.', 'A 6 by 6 grid of letters, WIZARD hidden somewhere in it.'],
    ['Spot it', 'Z is WIZARD\'s rarest letter, and this grid has only one Z.', 'The same grid with its only Z circled.'],
    ['Found', 'WIZARD runs through the Z, corner to corner.', 'The same grid with WIZARD found, corner to corner.']]],
  ['double', 'Double letters', 'When a word has the same letter twice in a row, like the TT in KITTEN.', [
    ['The puzzle', 'Find KITTEN. There are Ts everywhere.', 'A 6 by 6 grid full of Ts, KITTEN hidden somewhere in it.'],
    ['Spot it', 'Only one pair of Ts sits side by side.', 'The same grid with its one side-by-side pair of Ts circled.'],
    ['Found', 'KITTEN runs through the pair.', 'The same grid with KITTEN found through the pair of Ts.']]],
  ['ends', 'A word\'s first and last letter together', 'When the grid is full of a word\'s letters, look for its first and last, the word\'s length apart.', [
    ['The puzzle', 'Find ROCKET. The grid is full of Rs and Ts.', 'A 6 by 6 grid full of Rs and Ts, ROCKET hidden somewhere in it.'],
    ['Spot it', 'ROCKET\'s R and T sit 6 letters apart in a line. Only one R and T do.', 'The same grid with one R and one T circled, six letters apart in a line.'],
    ['Found', 'ROCKET runs between them, upwards.', 'The same grid with ROCKET found, running upwards.']]],
  ['direction', 'One direction at a time', 'When a word just won\'t turn up. Read the grid one way only, right to left, say.', [
    ['The puzzle', 'Find TIGER.', 'A 6 by 6 grid of letters, TIGER hidden somewhere in it.'],
    ['Spot it', 'Read every row right to left, and nothing else. Row 4 gives TIGER.', 'The same grid with the fourth row circled, letter by letter.'],
    ['Found', 'TIGER, running backwards.', 'The same grid with TIGER found, running right to left.']]],
  ['long', 'A long word before a short one', 'When the list has long words and short ones. A long word has far fewer places it can fit.', [
    ['The puzzle', 'Find RAINBOW and OWL.', 'A 7 by 7 grid above a word list of RAINBOW and OWL.'],
    ['Spot it', 'RAINBOW fills a whole line of 7, edge to edge. Of the Rs on the edge, only one has a W on the far edge.', 'The same grid with an R and a W circled in opposite corners, and the other edge Rs circled in red.'],
    ['Found', 'RAINBOW is found first. Now look for OWL.', 'The same grid with RAINBOW found corner to corner, and crossed off the list.']]],
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

const loaded = img => img.evaluate(i => i.complete && i.naturalWidth > 0);

test('Wordsearches opens on Basics: each basic a sentence beside its picture, in the owner\'s words', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app/how-to-play.html?kind=wordsearch');
  await expect(shown(page)).toHaveAttribute('data-part', 'basics');
  await expect(shown(page).locator('.rule')).toHaveCount(WORDSEARCH_BASICS.length);
  await expect(shown(page).locator('.rule p')).toHaveText(WORDSEARCH_BASICS.map(([, words]) => words));
  for (const [id, , alt] of WORDSEARCH_BASICS) {
    const picture = page.locator(`#wordsearch-${id} img`);
    await expect(picture).toHaveAttribute('src', `../content/how-to-play/wordsearch-${id}.png`);
    await expect(picture).toHaveAttribute('alt', alt);
    expect(await loaded(picture)).toBe(true);
    const box = await picture.boundingBox(), words = await page.locator(`#wordsearch-${id} p`).boundingBox();
    expect(box.x + box.width).toBeLessThan(words.x);
    expect(words.y).toBeLessThan(box.y + box.height);
  }
});

test('Wordsearches\' Advanced: each move named, when it happens, then the puzzle, how it\'s spotted and the word found in a row, each captioned', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app/how-to-play.html?kind=wordsearch');
  await pill(page, 'Advanced').click();
  await expect(shown(page).locator('.move')).toHaveCount(WORDSEARCH_MOVES.length);
  await expect(shown(page).locator('.move h2')).toHaveText(WORDSEARCH_MOVES.map(([, name]) => name));
  await expect(shown(page).locator('.move > p')).toHaveText(WORDSEARCH_MOVES.map(([, , when]) => when));
  for (const [id, , , steps] of WORDSEARCH_MOVES) {
    const figures = page.locator(`#wordsearch-${id} figure`);
    await expect(figures.locator('figcaption')).toHaveText(steps.map(([label, words]) => `${label} ${words}`));
    await expect(figures.locator('figcaption b')).toHaveText(steps.map(([label]) => label));
    const boxes = [];
    for (const [i, [, , alt]] of steps.entries()) {
      const picture = figures.nth(i).locator('img');
      await expect(picture).toHaveAttribute('src', `../content/how-to-play/wordsearch-${id}-${STEPS[i]}.png`);
      await expect(picture).toHaveAttribute('alt', alt);
      expect(await loaded(picture)).toBe(true);
      boxes.push(await picture.boundingBox());
    }
    expect(boxes.map(b => Math.round(b.y))).toEqual(boxes.map(() => Math.round(boxes[0].y)));
    expect(boxes[0].x + boxes[0].width).toBeLessThan(boxes[1].x);
    expect(boxes[1].x + boxes[1].width).toBeLessThan(boxes[2].x);
  }
});

test.describe('on a phone, Wordsearches\' rules', () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test('a move\'s three pictures stack top to bottom in order, each with its caption under it', async ({ page }) => {
    await page.goto('/app/how-to-play.html?kind=wordsearch');
    await pill(page, 'Advanced').click();
    for (const [id] of WORDSEARCH_MOVES) {
      const figures = page.locator(`#wordsearch-${id} figure`);
      let below = 0;
      for (let i = 0; i < STEPS.length; i++) {
        const picture = await figures.nth(i).locator('img').boundingBox();
        const caption = await figures.nth(i).locator('figcaption').boundingBox();
        expect(picture.y).toBeGreaterThanOrEqual(below);
        expect(caption.y).toBeGreaterThanOrEqual(picture.y + picture.height);
        below = caption.y + caption.height;
      }
    }
  });

  test('a basic\'s picture sits above its sentence', async ({ page }) => {
    await page.goto('/app/how-to-play.html?kind=wordsearch');
    for (const [id] of WORDSEARCH_BASICS) {
      const picture = await page.locator(`#wordsearch-${id} img`).boundingBox();
      const words = await page.locator(`#wordsearch-${id} p`).boundingBox();
      expect(picture.y + picture.height).toBeLessThanOrEqual(words.y);
    }
  });

  test('Basics and Advanced read without scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/app/how-to-play.html?kind=wordsearch');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await pill(page, 'Advanced').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });
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
