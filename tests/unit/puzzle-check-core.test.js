import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { normaliseWord, placementCells, checkPuzzle, checkTree, formatFinding } from '../../core/puzzle-check-core.js';

const FIXTURES = path.resolve(__dirname, '../fixtures/puzzles');
const fixture = name => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));
const withRow = (puzzle, row, text) => ({ ...puzzle, grid: puzzle.grid.map((line, r) => (r === row ? text : line)) });
const word = (display, row, col, direction, length) => ({ display, start: { row, col }, direction, length });
const failuresOf = puzzle => checkPuzzle(puzzle).failures.map(f => `check ${f.check}: ${f.message}`);
const warningsOf = puzzle => checkPuzzle(puzzle).warnings.map(w => `check ${w.check}: ${w.message}`);

describe('normaliseWord — the grid form of a display word', () => {
  it('uppercases, strips every space and hyphen, and removes accents', () => {
    expect(normaliseWord('Ice cream')).toBe('ICECREAM');
    expect(normaliseWord('Jack-in-the-box')).toBe('JACKINTHEBOX');
    expect(normaliseWord('Café')).toBe('CAFE');
    expect(normaliseWord('Crème brûlée')).toBe('CREMEBRULEE');
  });
});

describe('placementCells', () => {
  it('walks each of the eight directions from the start cell', () => {
    const from = direction => placementCells(word('X', 5, 5, direction, 3));
    expect(from('N')).toEqual([[5, 5], [4, 5], [3, 5]]);
    expect(from('NE')).toEqual([[5, 5], [4, 6], [3, 7]]);
    expect(from('E')).toEqual([[5, 5], [5, 6], [5, 7]]);
    expect(from('SE')).toEqual([[5, 5], [6, 6], [7, 7]]);
    expect(from('S')).toEqual([[5, 5], [6, 5], [7, 5]]);
    expect(from('SW')).toEqual([[5, 5], [6, 4], [7, 3]]);
    expect(from('W')).toEqual([[5, 5], [5, 4], [5, 3]]);
    expect(from('NW')).toEqual([[5, 5], [4, 4], [3, 3]]);
  });
});

describe('checkPuzzle — a valid puzzle', () => {
  it('passes every check, with a palindrome (Ewe) crossing another word and no accidental repeats', () => {
    expect(checkPuzzle(fixture('valid'))).toEqual({ failures: [], warnings: [] });
  });
});

describe('checkPuzzle — each failing check, from its fixture', () => {
  it('check 1: a word that runs off the grid is not placed', () => {
    expect(failuresOf(fixture('check-1-off-grid'))).toEqual([
      'check 1: "Dog" runs off the grid from row 5, col 4 going E',
    ]);
  });

  it('check 1: a placement starting above or left of the grid is not placed either', () => {
    const puzzle = fixture('valid');
    puzzle.words[5] = word('Dog', -1, 0, 'E', 3);
    expect(failuresOf(puzzle)).toEqual(['check 1: "Dog" runs off the grid from row -1, col 0 going E']);
    puzzle.words[5] = word('Dog', 5, -1, 'E', 3);
    expect(failuresOf(puzzle)).toEqual(['check 1: "Dog" runs off the grid from row 5, col -1 going E']);
  });

  it('check 2: the letters along the placement must spell the word', () => {
    expect(failuresOf(fixture('check-2-wrong-letters'))).toEqual([
      'check 2: "Dig" reads DOG along its placement, not DIG',
    ]);
  });

  it('check 2: a length that disagrees with the word fails too', () => {
    const puzzle = fixture('valid');
    puzzle.words[5] = word('Dog', 5, 0, 'E', 4);
    expect(failuresOf(puzzle)).toEqual(['check 2: "Dog" reads DOGA along its placement, not DOG']);
  });

  it('check 3: a filler letter outside the fill pool fails', () => {
    expect(failuresOf(fixture('check-3-filler-not-in-pool'))).toEqual([
      'check 3: filler Z at row 4, col 0 is not in the fill pool',
    ]);
  });

  it('check 3: an explicit fill pool replaces the default of placed-word letters', () => {
    const withZ = fixture('check-3-filler-not-in-pool');
    expect(failuresOf({ ...withZ, fillPool: 'ZAPID' })).toEqual([]);
    expect(failuresOf({ ...withZ, fillPool: 'ZAPI' })).toEqual([
      'check 3: filler D at row 4, col 5 is not in the fill pool',
    ]);
  });

  it('check 3: letters inside words are never held to the fill pool', () => {
    expect(failuresOf({ ...fixture('valid'), fillPool: 'AIPDG' })).toEqual([]);
  });

  it('check 4: a character that is not a capital A–Z fails', () => {
    expect(failuresOf(fixture('check-4-not-a-capital'))).toEqual([
      'check 3: filler 1 at row 4, col 3 is not in the fill pool',
      'check 4: row 4 "GAP1AD" holds something other than capital A–Z',
    ]);
    expect(failuresOf(withRow(fixture('valid'), 4, 'GAPiAD'))).toEqual([
      'check 3: filler i at row 4, col 3 is not in the fill pool',
      'check 4: row 4 "GAPiAD" holds something other than capital A–Z',
    ]);
    expect(failuresOf(withRow(fixture('valid'), 4, 'GAPIA1'))).toContain('check 4: row 4 "GAPIA1" holds something other than capital A–Z');
    expect(failuresOf(withRow(fixture('valid'), 4, '1APIAD'))).toContain('check 4: row 4 "1APIAD" holds something other than capital A–Z');
  });

  it('check 4: a ragged row fails, and an empty row is not letters', () => {
    expect(failuresOf(fixture('check-4-ragged-row'))).toEqual([
      'check 4: row 4 is 5 wide, row 0 is 6',
    ]);
    expect(failuresOf(withRow(fixture('valid'), 4, ''))).toEqual([
      'check 4: row 4 "" holds something other than capital A–Z',
      'check 4: row 4 is 0 wide, row 0 is 6',
    ]);
  });

  it('check 5: two words sharing two letters fail, though neither sits inside the other', () => {
    expect(failuresOf(fixture('check-5-two-letters-shared'))).toEqual([
      'check 5: "Hen" and "End" share 2 letters',
    ]);
  });

  it('check 6: a word placed inside another word fails (and so shares too many letters)', () => {
    expect(failuresOf(fixture('check-6-word-inside-word'))).toEqual([
      'check 5: "Pig-pen" and "Pig" share 3 letters',
      'check 6: "Pig" sits inside "Pig-pen"',
    ]);
  });

  it('check 6: a one-letter word inside another fails check 6 alone', () => {
    const puzzle = fixture('valid');
    puzzle.words.push(word('P', 0, 0, 'E', 1));
    expect(failuresOf(puzzle)).toEqual(['check 6: "P" sits inside "Pig-pen"']);
  });

  it('check 7: a word that is another reversed fails, wherever each is placed', () => {
    expect(failuresOf(fixture('check-7-reversed-pair'))).toEqual([
      'check 7: "Dog" is "God" reversed',
    ]);
  });

  it('check 9: a blank title fails', () => {
    expect(failuresOf(fixture('check-9-blank-title'))).toEqual(['check 9: the title is blank']);
    expect(failuresOf({ ...fixture('valid'), title: '' })).toEqual(['check 9: the title is blank']);
  });
});

describe('checkPuzzle — check 10 warns, never fails', () => {
  it('a word the filler spells a second time is a warning', () => {
    const puzzle = fixture('check-10-word-twice');
    expect(failuresOf(puzzle)).toEqual([]);
    expect(warningsOf(puzzle)).toEqual(['check 10: "Dog" also appears from row 4, col 0 going E']);
  });

  it('an accidental palindrome is one appearance, not a forward and a backward one', () => {
    const puzzle = withRow(fixture('valid'), 4, 'EWEIAD');
    expect(warningsOf(puzzle)).toEqual(['check 10: "Ewe" also appears from row 4, col 0 going E']);
  });

  it('a word read inside another placed word is not an accident (PIG inside PIG-PEN)', () => {
    const puzzle = withRow(fixture('valid'), 4, 'PIGIAD');
    puzzle.words.push(word('Pig', 4, 0, 'E', 3));
    expect(checkPuzzle(puzzle)).toEqual({ failures: [], warnings: [] });
  });
});

// A tree in the shape loadPuzzleTree reads, built from the valid fixture.
function puzzleAs(publicId, hiddenId, overrides = {}) {
  return { ...fixture('valid'), publicId, hiddenId, title: `Farm ${publicId}`, ...overrides };
}

function treeOf(puzzles, { slug = 'vanilla', manifest } = {}) {
  const files = Object.fromEntries(puzzles.map(p => [`${String(p.publicId).padStart(4, '0')}.json`, p]));
  const entries = Object.entries(files).map(([file, p]) => ({ publicId: p.publicId, title: p.title, file }));
  return {
    index: { collections: [slug] },
    collections: { [slug]: { manifest: { collection: slug, name: 'Vanilla', puzzles: entries, ...manifest }, files } },
  };
}

const findingsOf = tree => checkTree(tree).failures.map(formatFinding);

describe('checkTree — the collection index, manifests and IDs', () => {
  it('a gap-free collection whose manifest matches its files passes', () => {
    expect(checkTree(treeOf([puzzleAs(1, 'WSCH-0001'), puzzleAs(2, 'WSCH-0002')]))).toEqual({ failures: [], warnings: [] });
  });

  it('an empty collection passes', () => {
    expect(checkTree(treeOf([]))).toEqual({ failures: [], warnings: [] });
  });

  it('check 8: a gap in a collection\'s public IDs fails', () => {
    expect(findingsOf(treeOf([puzzleAs(1, 'WSCH-0001'), puzzleAs(4, 'WSCH-0004')]))).toEqual([
      'puzzles/vanilla/ — check 8: public IDs skip 2 (they must run 1–4 with no gaps)',
      'puzzles/vanilla/ — check 8: public IDs skip 3 (they must run 1–4 with no gaps)',
    ]);
  });

  it('check 8: public IDs must start at 1', () => {
    expect(findingsOf(treeOf([puzzleAs(2, 'WSCH-0002')]))).toEqual([
      'puzzles/vanilla/ — check 8: public IDs skip 1 (they must run 1–2 with no gaps)',
    ]);
  });

  it('check 8: a duplicate public ID in a collection fails', () => {
    const tree = treeOf([puzzleAs(1, 'WSCH-0001'), puzzleAs(2, 'WSCH-0002')]);
    tree.collections.vanilla.files['0002.json'].publicId = 1;
    tree.collections.vanilla.manifest.puzzles[1].publicId = 1;
    expect(findingsOf(tree)).toEqual(['puzzles/vanilla/ — check 8: public ID 1 is used more than once']);
  });

  it('check 8: a hidden ID reused anywhere in the tree fails, naming every puzzle using it', () => {
    const tree = treeOf([puzzleAs(1, 'WSCH-0001'), puzzleAs(2, 'WSCH-0001')]);
    tree.index.collections.push('new-a');
    tree.collections['new-a'] = treeOf([puzzleAs(1, 'WSCH-0002', { collection: 'new-a' }), puzzleAs(2, 'WSCH-0001', { collection: 'new-a' })], { slug: 'new-a' }).collections['new-a'];
    expect(findingsOf(tree)).toEqual([
      'puzzles/vanilla/0001.json, puzzles/vanilla/0002.json, puzzles/new-a/0002.json — check 8: hidden ID WSCH-0001 is used by 3 puzzles',
    ]);
  });

  it('collections are independent runs: each starts at 1', () => {
    const tree = treeOf([puzzleAs(1, 'WSCH-0001')]);
    tree.index.collections.push('new-a');
    tree.collections['new-a'] = treeOf([puzzleAs(1, 'WSCH-0002', { collection: 'new-a' })], { slug: 'new-a' }).collections['new-a'];
    expect(findingsOf(tree)).toEqual([]);
  });
});

describe('checkTree — the manifest and the puzzle files must agree', () => {
  const two = () => treeOf([puzzleAs(1, 'WSCH-0001'), puzzleAs(2, 'WSCH-0002')]);

  it('a manifest entry for a file that does not exist fails', () => {
    const tree = two();
    tree.collections.vanilla.manifest.puzzles.push({ publicId: 3, title: 'Farm 3', file: '0003.json' });
    expect(findingsOf(tree)).toEqual(['puzzles/vanilla/manifest.json — manifest: lists 0003.json, which does not exist']);
  });

  it('a puzzle file the manifest does not list fails', () => {
    const tree = two();
    tree.collections.vanilla.manifest.puzzles.pop();
    expect(findingsOf(tree)).toEqual(['puzzles/vanilla/0002.json — manifest: is not listed in the manifest']);
  });

  it('a file listed twice fails', () => {
    const tree = two();
    tree.collections.vanilla.manifest.puzzles.push({ publicId: 2, title: 'Farm 2', file: '0002.json' });
    expect(findingsOf(tree)).toEqual(['puzzles/vanilla/manifest.json — manifest: lists 0002.json more than once']);
  });

  it('a public ID or title that disagrees with the file fails', () => {
    const tree = two();
    tree.collections.vanilla.manifest.puzzles[1] = { publicId: 7, title: 'Barnyard', file: '0002.json' };
    expect(findingsOf(tree)).toEqual([
      'puzzles/vanilla/manifest.json — manifest: gives 0002.json public ID 7, the file says 2',
      'puzzles/vanilla/manifest.json — manifest: gives 0002.json the title "Barnyard", the file says "Farm 2"',
    ]);
  });

  it('a manifest naming the wrong collection fails', () => {
    expect(findingsOf(treeOf([puzzleAs(1, 'WSCH-0001')], { manifest: { collection: 'new-a' } }))).toEqual([
      'puzzles/vanilla/manifest.json — manifest: names collection "new-a", but sits in puzzles/vanilla/',
    ]);
  });

  it('a puzzle naming the wrong collection fails', () => {
    expect(findingsOf(treeOf([puzzleAs(1, 'WSCH-0001', { collection: 'new-a' })]))).toEqual([
      'puzzles/vanilla/0001.json — manifest: says collection "new-a", but sits in puzzles/vanilla/',
    ]);
  });

  it('collections.json and the collection directories must name the same collections', () => {
    const tree = two();
    tree.index.collections = ['new-a'];
    expect(findingsOf(tree)).toEqual([
      'puzzles/collections.json — manifest: lists "new-a", but there is no puzzles/new-a/',
      'puzzles/vanilla/ — manifest: is not listed in puzzles/collections.json',
    ]);
  });
});

describe('checkTree — every puzzle\'s own checks, named by file', () => {
  it('reports a failing puzzle\'s checks and warnings against its path', () => {
    const tree = treeOf([puzzleAs(1, 'WSCH-0001'), { ...fixture('check-10-word-twice'), publicId: 2, hiddenId: 'WSCH-0002', title: '' }]);
    tree.collections.vanilla.manifest.puzzles[1].title = '';
    const { failures, warnings } = checkTree(tree);
    expect(failures.map(formatFinding)).toEqual(['puzzles/vanilla/0002.json — check 9: the title is blank']);
    expect(warnings.map(formatFinding)).toEqual(['puzzles/vanilla/0002.json — check 10: "Dog" also appears from row 4, col 0 going E']);
  });
});
