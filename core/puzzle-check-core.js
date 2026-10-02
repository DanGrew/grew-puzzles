// The plan's ten puzzle checks, over already-parsed puzzle JSON. Pure — no fs, no DOM.
// Shape (types, required fields, direction names) is validate-json's job against
// schemas/; this module owns what a schema can't see. Checks 1–9 fail; check 10 warns.
// The format these read is docs/PUZZLE-FORMAT.md.

const DIRECTIONS = {
  N: [-1, 0], NE: [-1, 1], E: [0, 1], SE: [1, 1],
  S: [1, 0], SW: [1, -1], W: [0, -1], NW: [-1, -1],
};

// Grid form of a display word: accents removed, spaces and hyphens stripped, uppercase.
function normaliseWord(display) {
  return display
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

function lineCells(row, col, direction, length) {
  const [dr, dc] = DIRECTIONS[direction];
  return Array.from({ length }, (_, i) => [row + dr * i, col + dc * i]);
}

function placementCells(word) {
  return lineCells(word.start.row, word.start.col, word.direction, word.length);
}

// The letter at a cell, or undefined when the cell is off the grid.
function letterAt(grid, [row, col]) {
  return (grid[row] || '')[col];
}

const cellKey = ([row, col]) => `${row},${col}`;

function onGrid(grid, cells) {
  return cells.every(cell => letterAt(grid, cell) !== undefined);
}

function sharedCells(a, b) {
  const keys = new Set(b.map(cellKey));
  return a.filter(cell => keys.has(cellKey(cell))).length;
}

function isInside(inner, outer) {
  return sharedCells(inner, outer) === inner.length;
}

const reversed = s => [...s].reverse().join('');

function pairs(n) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n - i - 1 }, (_, k) => [i, i + k + 1])).flat();
}

// Every straight-line run of cells in the grid that spells `answer`, in any of the eight
// directions. A forward and a backward read of the same cells count as one.
function occurrences(grid, answer) {
  const found = new Map();
  grid.forEach((line, row) => [...line].forEach((_, col) => Object.keys(DIRECTIONS).forEach(direction => {
    const cells = lineCells(row, col, direction, answer.length);
    const spelled = cells.map(cell => letterAt(grid, cell)).join('');
    const key = JSON.stringify(cells.map(cellKey).sort());
    if (spelled === answer && !found.has(key)) found.set(key, { row, col, direction, cells });
  })));
  return [...found.values()];
}

function checkPuzzle(puzzle) {
  const { grid, words } = puzzle;
  const failures = [];
  const warnings = [];
  const fail = (check, message) => failures.push({ check, message });
  const answers = words.map(w => normaliseWord(w.display));
  const cells = words.map(placementCells);
  const placed = cells.map(c => onGrid(grid, c));

  // 1 — every word in the list is placed in the grid.
  words.forEach((w, i) => {
    if (!placed[i]) fail(1, `"${w.display}" runs off the grid from row ${w.start.row}, col ${w.start.col} going ${w.direction}`);
  });

  // 2 — each word's letters sit in order along its solution line.
  words.forEach((w, i) => {
    const spelled = cells[i].map(cell => letterAt(grid, cell)).join('');
    if (placed[i] && spelled !== answers[i]) fail(2, `"${w.display}" reads ${spelled} along its placement, not ${answers[i]}`);
  });

  // 3 — every letter outside the words comes from the fill pool.
  const pool = new Set(puzzle.fillPool || answers.flatMap(answer => [...answer]));
  const covered = new Set(cells.flat().map(cellKey));
  grid.forEach((line, row) => [...line].forEach((letter, col) => {
    if (!covered.has(cellKey([row, col])) && !pool.has(letter)) fail(3, `filler ${letter} at row ${row}, col ${col} is not in the fill pool`);
  }));

  // 4 — every character in the grid is a capital A–Z, and the grid is a rectangle.
  grid.forEach((line, row) => {
    if (!/^[A-Z]+$/.test(line)) fail(4, `row ${row} "${line}" holds something other than capital A–Z`);
    if (line.length !== grid[0].length) fail(4, `row ${row} is ${line.length} wide, row 0 is ${grid[0].length}`);
  });

  // 5 — words overlap by one letter at most.  6 — no placement sits inside another's.
  pairs(words.length).forEach(([i, j]) => {
    const shared = sharedCells(cells[i], cells[j]);
    if (shared > 1) fail(5, `"${words[i].display}" and "${words[j].display}" share ${shared} letters`);
  });
  pairs(words.length).flatMap(([i, j]) => [[i, j], [j, i]]).forEach(([i, j]) => {
    if (isInside(cells[i], cells[j])) fail(6, `"${words[i].display}" sits inside "${words[j].display}"`);
  });

  // 7 — no word in the list is another one reversed. A palindrome is not its own reversal.
  pairs(words.length).forEach(([i, j]) => {
    if (answers[i] === reversed(answers[j])) fail(7, `"${words[i].display}" is "${words[j].display}" reversed`);
  });

  // 9 — every puzzle has a title.
  if (!puzzle.title.trim()) fail(9, 'the title is blank');

  // 10 — each word appears once. A run inside a placed word (its own, or PIG inside PIGLET)
  // is not an accident, so only runs reaching into filler count.
  words.forEach((w, i) => {
    occurrences(grid, answers[i])
      .filter(o => !cells.some(c => isInside(o.cells, c)))
      .forEach(o => warnings.push({ check: 10, message: `"${w.display}" also appears from row ${o.row}, col ${o.col} going ${o.direction}` }));
  });

  return { failures, warnings };
}

function duplicates(values) {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
}

// One collection directory against its manifest, and check 8's public-ID run.
function checkCollection(slug, { manifest, files }, fail) {
  const at = `puzzles/${slug}/manifest.json`;
  const entries = manifest.puzzles;
  const listed = entries.map(e => e.file);

  if (manifest.collection !== slug) fail(at, 'manifest', `names collection "${manifest.collection}", but sits in puzzles/${slug}/`);
  duplicates(listed).forEach(file => fail(at, 'manifest', `lists ${file} more than once`));
  listed.filter(file => !(file in files)).forEach(file => fail(at, 'manifest', `lists ${file}, which does not exist`));
  Object.keys(files).filter(file => !listed.includes(file)).forEach(file => fail(`puzzles/${slug}/${file}`, 'manifest', 'is not listed in the manifest'));

  entries.filter(e => e.file in files).forEach(e => {
    const puzzle = files[e.file];
    if (e.publicId !== puzzle.publicId) fail(at, 'manifest', `gives ${e.file} public ID ${e.publicId}, the file says ${puzzle.publicId}`);
    if (e.title !== puzzle.title) fail(at, 'manifest', `gives ${e.file} the title "${e.title}", the file says "${puzzle.title}"`);
  });

  Object.entries(files).forEach(([file, puzzle]) => {
    if (puzzle.collection !== slug) fail(`puzzles/${slug}/${file}`, 'manifest', `says collection "${puzzle.collection}", but sits in puzzles/${slug}/`);
  });

  const ids = Object.values(files).map(p => p.publicId);
  duplicates(ids).forEach(id => fail(`puzzles/${slug}/`, 8, `public ID ${id} is used more than once`));
  const top = Math.max(0, ...ids);
  Array.from({ length: top }, (_, i) => i + 1)
    .filter(id => !ids.includes(id))
    .forEach(id => fail(`puzzles/${slug}/`, 8, `public IDs skip ${id} (they must run 1–${top} with no gaps)`));
}

// The whole puzzles/ tree: { index: collections.json, collections: { slug: { manifest, files } } }.
// Returns every failure and warning, each naming the file it is about.
function checkTree(tree) {
  const failures = [];
  const warnings = [];
  const fail = (where, check, message) => failures.push({ where, check, message });
  const slugs = Object.keys(tree.collections);
  const indexed = tree.index.collections;

  indexed.filter(slug => !slugs.includes(slug)).forEach(slug => fail('puzzles/collections.json', 'manifest', `lists "${slug}", but there is no puzzles/${slug}/`));
  slugs.filter(slug => !indexed.includes(slug)).forEach(slug => fail(`puzzles/${slug}/`, 'manifest', 'is not listed in puzzles/collections.json'));

  slugs.forEach(slug => checkCollection(slug, tree.collections[slug], fail));

  const all = slugs.flatMap(slug => Object.entries(tree.collections[slug].files).map(([file, puzzle]) => [`puzzles/${slug}/${file}`, puzzle]));
  duplicates(all.map(([, p]) => p.hiddenId)).forEach(id => {
    const users = all.filter(([, p]) => p.hiddenId === id).map(([where]) => where);
    fail(users.join(', '), 8, `hidden ID ${id} is used by ${users.length} puzzles`);
  });

  all.forEach(([where, puzzle]) => {
    const result = checkPuzzle(puzzle);
    result.failures.forEach(f => failures.push({ where, ...f }));
    result.warnings.forEach(w => warnings.push({ where, ...w }));
  });

  return { failures, warnings };
}

function formatFinding({ where, check, message }) {
  const label = check === 'manifest' ? 'manifest' : `check ${check}`;
  return `${where} — ${label}: ${message}`;
}

module.exports = { normaliseWord, placementCells, checkPuzzle, checkTree, formatFinding };
