import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import {
  puzzleUrl, playJson,
  wordCells, playBoard, newPlay, solvedPlay, turnPage, tap, sharedCells, playMarks, listedWords, wordList, countLabel, sparkles,
  nextWordsLayout, savedWordsLayout, saveWordsLayout, wordsFit
} from '../../../core/wordsearch/play-core.js';
const require = createRequire(import.meta.url);
const PUZZLE = require('../../fixtures/WSCH-0007.json');

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
let BOARD, WORDS;
beforeEach(() => {
  BOARD = playBoard(PUZZLE);
  WORDS = BOARD.words;
});
const at = text => WORDS.findIndex(w => w.text === text);

function taps(cells, play) {
  return cells.reduce((p, cell) => tap(p, cell, WORDS), play || newPlay());
}

describe('finding the puzzle a play URL names', () => {
  it("opens the file named by the query's hidden ID", () => {
    expect(puzzleUrl('?id=WSCH-0007')).toBe('../content/puzzles/wordsearch/WSCH-0007.json');
    expect(puzzleUrl('?id=WSCH-12345')).toBe('../content/puzzles/wordsearch/WSCH-12345.json');
  });

  it('finds no puzzle for a missing ID, or anything that is not a wordsearch hidden ID', () => {
    ['', '?id=', '?id=7', '?id=WSCH-007', '?id=ABCD-0007', '?id=wsch-0007', '?id=xWSCH-0007',
      '?id=WSCH-0007x', '?id=../WSCH-0007', '?id=WSCH-0007/../x'].forEach(search => {
      expect(() => puzzleUrl(search)).toThrow('No such puzzle');
    });
  });

  it('reads a fetched file as JSON', async () => {
    await expect(playJson({ ok: true, json: () => Promise.resolve({ a: 1 }) })).resolves.toEqual({ a: 1 });
  });

  it('treats a missing file as no such puzzle', () => {
    expect(() => playJson({ ok: false, json: () => Promise.resolve({}) })).toThrow('No such puzzle');
  });
});

describe('the board', () => {
  it('walks each of the eight directions from the start cell', () => {
    const cells = dir => wordCells({ start: { row: 4, col: 4 }, direction: dir, length: 2 })[1];
    expect(cells('N')).toEqual([3, 4]);
    expect(cells('NE')).toEqual([3, 5]);
    expect(cells('E')).toEqual([4, 5]);
    expect(cells('SE')).toEqual([5, 5]);
    expect(cells('S')).toEqual([5, 4]);
    expect(cells('SW')).toEqual([5, 3]);
    expect(cells('W')).toEqual([4, 3]);
    expect(cells('NW')).toEqual([3, 3]);
  });

  it('gives a word one cell per letter, starting at its start', () => {
    expect(wordCells(PUZZLE.words[0])).toEqual([[4, 2], [3, 2], [2, 2]]);
  });

  it('heads the board with its title and created date, and labels it with the type alone', () => {
    expect(BOARD.title).toBe('Farm Kitchen');
    expect(BOARD.created).toBe('2 Oct 2026');
    expect(BOARD.label).toBe('Vanilla');
    expect(BOARD.solutionLabel).toBe('Vanilla · Solution');
    expect(JSON.stringify(BOARD)).not.toContain('WSCH');
  });

  it('shows a type name exactly as written', () => {
    const odd = playBoard(Object.assign({}, PUZZLE, { type: 'Mirra?e' }));
    expect(odd.label).toBe('Mirra?e');
    expect(odd.solutionLabel).toBe('Mirra?e · Solution');
  });

  it('splits the grid into letters, rows by columns', () => {
    const wide = playBoard(Object.assign({}, PUZZLE, { grids: [{ rows: ['ABC', 'DEF'] }] }));
    expect(wide.grids).toHaveLength(1);
    expect(wide.grids[0].letters).toEqual([['A', 'B', 'C'], ['D', 'E', 'F']]);
    expect(wide.rows).toBe(2);
    expect(wide.cols).toBe(3);
  });

  it('has no tabs and no sheets of its own for a puzzle of one grid', () => {
    expect(BOARD.tabs).toEqual([]);
    expect(BOARD.sheets).toEqual([]);
  });

  it('keeps which grid each word sits in', () => {
    expect(WORDS.map(w => w.grid)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('lists the words as shown, in file order, with their cells', () => {
    expect(WORDS.map(w => w.text)).toEqual(['Cat', 'Cow', 'Ewe', 'Hen', 'Ice cream', 'Map', 'Pig', 'Piglet']);
    expect(WORDS[at('Ice cream')].cells).toHaveLength(8);
  });
});

describe('tapping', () => {
  it('starts a selection on the first tap', () => {
    expect(taps([[0, 0]])).toEqual({ picked: [[0, 0]], found: [], events: [], page: 0 });
  });

  it('crosses a word off when its two ends are tapped', () => {
    expect(taps([[4, 2], [2, 2]])).toEqual({ picked: [], found: [at('Cat')], events: [], page: 0 });
  });

  it('crosses a word off from either end', () => {
    expect(taps([[2, 2], [4, 2]]).found).toEqual([at('Cat')]);
  });

  it('finds words across, down and diagonally', () => {
    expect(taps([[0, 0], [0, 7]]).found).toEqual([at('Ice cream')]);
    expect(taps([[1, 0], [6, 0]]).found).toEqual([at('Piglet')]);
    expect(taps([[1, 2], [3, 4]]).found).toEqual([at('Cow')]);
    expect(taps([[4, 5], [6, 3]]).found).toEqual([at('Hen')]);
  });

  it('keeps a non-word selection open, as a red line', () => {
    expect(taps([[0, 0], [0, 3]])).toEqual({ picked: [[0, 0], [0, 3]], found: [], events: [], page: 0 });
  });

  it('points an open red line at any other in-line letter: nearer, further, or another way', () => {
    const open = taps([[0, 2], [0, 5]]);
    expect(taps([[0, 3]], open)).toEqual({ picked: [[0, 2], [0, 3]], found: [], events: [], page: 0 });
    expect(taps([[0, 6]], open)).toEqual({ picked: [[0, 2], [0, 6]], found: [], events: [], page: 0 });
    expect(taps([[0, 0]], open)).toEqual({ picked: [[0, 2], [0, 0]], found: [], events: [], page: 0 });
    expect(taps([[3, 2]], open)).toEqual({ picked: [[0, 2], [3, 2]], found: [], events: [], page: 0 });
    expect(taps([[2, 4]], open)).toEqual({ picked: [[0, 2], [2, 4]], found: [], events: [], page: 0 });
    expect(taps([[2, 0]], open)).toEqual({ picked: [[0, 2], [2, 0]], found: [], events: [], page: 0 });
  });

  it('crosses a word off when a redrawn line spans it, from either end', () => {
    expect(taps([[0, 0], [0, 3], [0, 7]]).found).toEqual([at('Ice cream')]);
    expect(taps([[0, 7], [0, 5], [0, 0]]).found).toEqual([at('Ice cream')]);
    expect(taps([[4, 2], [4, 4], [2, 2]])).toEqual({ picked: [], found: [at('Cat')], events: [], page: 0 });
    expect(taps([[3, 4], [3, 2], [1, 2]]).found).toEqual([at('Cow')]);
  });

  it('ignores a tap that is not in line with the start', () => {
    expect(taps([[0, 0], [2, 1]])).toEqual({ picked: [[0, 0]], found: [], events: [], page: 0 });
  });

  it('ignores a tap off every line through the start while a red line shows', () => {
    const open = taps([[0, 1], [0, 3]]);
    expect(taps([[1, 4]], open)).toEqual(open);
    expect(taps([[2, 2]], open)).toEqual(open);
  });

  it('ignores a tap that only matches the start on one axis of a diagonal', () => {
    const open = taps([[1, 2], [2, 3]]);
    expect(taps([[3, 3]], open)).toEqual(open);
    expect(taps([[2, 4]], open)).toEqual(open);
  });

  it("changes nothing when the red line's end is tapped", () => {
    const open = taps([[0, 0], [0, 3]]);
    expect(taps([[0, 3]], open)).toEqual(open);
    expect(taps([[0, 3], [0, 3]], open)).toEqual(open);
  });

  it('clears the circle when the circled letter is tapped again', () => {
    expect(taps([[0, 0], [0, 0]])).toEqual(newPlay());
  });

  it('clears the circle and the red line when the circled letter is tapped', () => {
    expect(taps([[0, 0], [0, 3], [0, 0]])).toEqual(newPlay());
  });

  it('crosses off PIGLET when its T is tapped after the red P-to-G line', () => {
    expect(taps([[1, 0], [3, 0], [6, 0]])).toEqual({ picked: [], found: [at('Piglet')], events: [], page: 0 });
  });

  it('does not find a word from a selection sharing only one of its ends', () => {
    expect(taps([[2, 2], [2, 4]])).toEqual({ picked: [[2, 2], [2, 4]], found: [], events: [], page: 0 });
    expect(taps([[4, 2], [4, 4]])).toEqual({ picked: [[4, 2], [4, 4]], found: [], events: [], page: 0 });
  });

  it('does not cross off PIG for P then G inside PIGLET', () => {
    expect(taps([[1, 0], [3, 0]])).toEqual({ picked: [[1, 0], [3, 0]], found: [], events: [], page: 0 });
  });

  it('crosses off PIG at its own placement', () => {
    expect(taps([[7, 2], [7, 0]]).found).toEqual([at('Pig')]);
  });

  it('does not find a found word twice', () => {
    expect(taps([[4, 2], [2, 2], [4, 2], [2, 2]])).toEqual({ picked: [[4, 2], [2, 2]], found: [at('Cat')], events: [], page: 0 });
  });

  it('sets off completion when the last word is found, and only then', () => {
    const allButOne = { picked: [], found: [0, 1, 2, 3, 4, 5, 6], events: [], page: 0 };
    expect(taps([[1, 0], [6, 0]], allButOne)).toEqual({ picked: [], found: [0, 1, 2, 3, 4, 5, 6, 7], events: ['complete'], page: 0 });
  });

  it('starts every play with nothing picked or found', () => {
    expect(newPlay()).toEqual({ picked: [], found: [], events: [], page: 0 });
  });

  it('solves every word for the solution side', () => {
    expect(solvedPlay(WORDS, 0)).toEqual({ picked: [], found: [0, 1, 2, 3, 4, 5, 6, 7], events: [], page: 0 });
  });
});

describe('what the board shows', () => {
  it('shows nothing before a tap', () => {
    expect(playMarks(newPlay(), WORDS)).toEqual({ found: [], shared: [], wrong: [], rings: [] });
  });

  it('rings the start letter of a fresh selection', () => {
    expect(playMarks(taps([[0, 0]]), WORDS)).toEqual({ found: [], shared: [], wrong: [], rings: [{ cell: [0, 0], kind: 'select' }] });
  });

  it('draws an open selection as a red line with a red ring on its start', () => {
    expect(playMarks(taps([[0, 0], [0, 3]]), WORDS)).toEqual({
      found: [], shared: [], wrong: [[[0, 0], [0, 3]]], rings: [{ cell: [0, 0], kind: 'wrong' }]
    });
  });

  it('draws a line end to end through each found word', () => {
    expect(playMarks(taps([[2, 2], [4, 2]]), WORDS).found).toEqual([[[4, 2], [2, 2]]]);
  });

  it('rings a letter two found words share, once both are found', () => {
    const piglet = taps([[1, 0], [6, 0]]);
    expect(playMarks(piglet, WORDS).shared).toEqual([]);
    expect(playMarks(taps([[5, 0], [5, 2]], piglet), WORDS).shared).toEqual([[5, 0]]);
  });

  it('finds every shared cell, and only those', () => {
    const a = { cells: [[0, 0], [0, 1]] }, b = { cells: [[0, 1], [1, 1]] }, c = { cells: [[1, 1], [2, 2]] };
    expect(sharedCells([a, b, c])).toEqual([[0, 1], [1, 1]]);
    expect(sharedCells([a])).toEqual([]);
  });

  it('crosses off found words in the list', () => {
    expect(wordList(taps([[4, 2], [2, 2]]), WORDS, false).slice(0, 2)).toEqual([
      { text: 'Cat', done: true, revealed: false, progress: '' }, { text: 'Cow', done: false, revealed: false, progress: '' }
    ]);
  });

  it('lists each word once, with no progress, when every word has one copy', () => {
    expect(listedWords(WORDS).map(entry => entry.copies)).toEqual([[0], [1], [2], [3], [4], [5], [6], [7]]);
    expect(wordList(newPlay(), WORDS, false).map(item => item.text)).toEqual(WORDS.map(w => w.text));
    expect(wordList(solvedPlay(WORDS, 0), WORDS, false).filter(item => item.progress !== '')).toEqual([]);
  });

  it('shows no word red in a puzzle with none missing, solved or flipped', () => {
    expect(wordList(solvedPlay(WORDS, 0), WORDS, true).filter(item => item.revealed)).toEqual([]);
  });

  it('counts found words out of all of them', () => {
    expect(countLabel(newPlay(), WORDS)).toBe('0/8');
    expect(countLabel(taps([[4, 2], [2, 2]]), WORDS)).toBe('1/8');
  });
});

describe('a puzzle with a missing word', () => {
  // The fixture with Goat listed but nowhere in the grid, sorted in among the rest.
  let MISSING;
  beforeEach(() => {
    const words = PUZZLE.words.slice();
    words.splice(3, 0, { word: 'Goat', missing: true });
    MISSING = playBoard(Object.assign({}, PUZZLE, { type: 'Missing', words: words })).words;
  });
  const goat = () => MISSING.findIndex(w => w.text === 'Goat');
  const placed = () => MISSING.map((_, i) => i).filter(i => i !== goat());
  const allBut = last => ({ picked: [], found: placed().filter(i => i !== last), events: [], page: 0 });

  it('lists the missing word among the rest, with no cells', () => {
    expect(MISSING.map(w => w.text)).toEqual(['Cat', 'Cow', 'Ewe', 'Goat', 'Hen', 'Ice cream', 'Map', 'Pig', 'Piglet']);
    expect(MISSING[goat()]).toEqual({ text: 'Goat', missing: true, cells: [] });
    expect(MISSING[0].missing).toBe(false);
  });

  it('counts only the placed words', () => {
    expect(countLabel(newPlay(), MISSING)).toBe('0/8');
    expect(countLabel(solvedPlay(MISSING, 0), MISSING)).toBe('8/8');
  });

  it('shows every word unmarked at the start, the missing one too', () => {
    expect(wordList(newPlay(), MISSING, false).filter(item => item.done || item.revealed)).toEqual([]);
  });

  it('sets off completion on the last placed word', () => {
    const piglet = MISSING.findIndex(w => w.text === 'Piglet');
    const done = tap(tap(allBut(piglet), [1, 0], MISSING), [6, 0], MISSING);
    expect(done.events).toEqual(['complete']);
    expect(done.found).toHaveLength(8);
  });

  it('does not set off completion one word short', () => {
    const piglet = MISSING.findIndex(w => w.text === 'Piglet');
    const cat = MISSING.findIndex(w => w.text === 'Cat');
    const short = { picked: [], found: placed().filter(i => i !== piglet && i !== cat), events: [], page: 0 };
    expect(tap(tap(short, [1, 0], MISSING), [6, 0], MISSING).events).toEqual([]);
  });

  it('turns the missing word red once every placed word is found', () => {
    const list = wordList(solvedPlay(MISSING, 0), MISSING, false);
    expect(list[goat()]).toEqual({ text: 'Goat', done: false, revealed: true, progress: '' });
    expect(list.filter(item => item.revealed)).toHaveLength(1);
  });

  it('turns the missing word red while the solution shows, and back once it does not', () => {
    expect(wordList(newPlay(), MISSING, true)[goat()].revealed).toBe(true);
    expect(wordList(newPlay(), MISSING, false)[goat()].revealed).toBe(false);
  });

  it('keeps the missing word unmarked one word short of the end', () => {
    expect(wordList(allBut(0), MISSING, false)[goat()].revealed).toBe(false);
  });

  it('solves only the placed words for the solution side', () => {
    expect(solvedPlay(MISSING, 0).found).toEqual(placed());
  });

  it('never lines through or rings the missing word', () => {
    const marks = playMarks(solvedPlay(MISSING, 0), MISSING);
    expect(marks.found).toHaveLength(8);
    expect(marks.shared).toEqual(playMarks(solvedPlay(WORDS, 0), WORDS).shared);
  });

  it('a tap never finds the missing word', () => {
    expect(taps([[4, 2], [2, 2]]).found).toEqual([at('Cat')]);
    expect(tap(tap(newPlay(), [3, 0], MISSING), [7, 0], MISSING).found).toEqual([]);
  });
});

describe('a puzzle with wildcards', () => {
  // The fixture as a Wildcards puzzle: Cat's A (row 3, col 2) and Ice cream's second C (row 0, col 3) show ?.
  let WILD;
  beforeEach(() => {
    WILD = playBoard(Object.assign({}, PUZZLE, {
      type: 'Wildcards', grids: [{ rows: PUZZLE.grids[0].rows, wildcards: [{ row: 3, col: 2 }, { row: 0, col: 3 }] }]
    }));
  });

  it('shows ? on the puzzle side at each wildcard, and only there', () => {
    expect(WILD.grids[0].shown[3][2]).toBe('?');
    expect(WILD.grids[0].shown[0][3]).toBe('?');
    expect(WILD.grids[0].shown.flat().filter(l => l === '?')).toHaveLength(2);
    expect(WILD.grids[0].shown[0]).toEqual(['I', 'C', 'E', '?', 'R', 'E', 'A', 'M']);
  });

  it('marks each wildcard cell, and only those', () => {
    expect(WILD.grids[0].wild[3][2]).toBe(true);
    expect(WILD.grids[0].wild[0][3]).toBe(true);
    expect(WILD.grids[0].wild.flat().filter(Boolean)).toHaveLength(2);
    expect(WILD.grids[0].wild[2][3]).toBe(false);
    expect(WILD.grids[0].wild[3][0]).toBe(false);
  });

  it('keeps every real letter for the solution side', () => {
    expect(WILD.grids[0].letters).toEqual(PUZZLE.grids[0].rows.map(row => row.split('')));
    expect(WILD.grids[0].letters[3][2]).toBe('A');
  });

  it('says Wildcards in the band', () => {
    expect(WILD.label).toBe('Wildcards');
    expect(WILD.solutionLabel).toBe('Wildcards · Solution');
  });

  it('finds a word through a ? at its real placement', () => {
    const play = tap(tap(newPlay(), [4, 2], WILD.words), [2, 2], WILD.words);
    expect(play.found).toEqual([WILD.words.findIndex(w => w.text === 'Cat')]);
  });

  it('shows every real letter, and marks none, in a puzzle with no wildcards', () => {
    expect(BOARD.grids[0].shown).toEqual(BOARD.grids[0].letters);
    expect(BOARD.grids[0].wild.flat().some(Boolean)).toBe(false);
    expect(BOARD.grids[0].wild).toHaveLength(8);
    expect(BOARD.grids[0].wild[0]).toHaveLength(8);
  });
});

describe('a puzzle with repeated words', () => {
  // Cup five times among Cow and Hen, each copy listed once in the file at its own placement.
  let REPEATS;
  beforeEach(() => {
    const cup = (row, col, direction) => ({ word: 'Cup', grid: 0, start: { row: row, col: col }, direction: direction, length: 3 });
    REPEATS = playBoard({
      hiddenId: 'WSCH-0009', type: 'Repeats', created: '2026-10-03', title: 'Cups',
      words: [
        { word: 'Cow', grid: 0, start: { row: 2, col: 3 }, direction: 'E', length: 3 },
        cup(0, 0, 'E'), cup(0, 4, 'E'), cup(1, 2, 'W'), cup(2, 0, 'S'), cup(4, 4, 'E'),
        { word: 'Hen', grid: 0, start: { row: 1, col: 3 }, direction: 'E', length: 3 }
      ],
      grids: [{ rows: ['CUPTCUPL', 'PUCHENRT', 'CTLCOWLR', 'URTLRTRL', 'PLRTCUPT', 'TRLRTLRL', 'LTRTLRTR', 'RLTLRTLR'] }]
    }).words;
  });
  const find = (cells, play) => cells.reduce((p, cell) => tap(p, cell, REPEATS), play || newPlay());
  const cups = () => [1, 2, 3, 4, 5];

  it('lists a repeated word once, where it first appears, holding every copy', () => {
    expect(listedWords(REPEATS)).toEqual([
      { text: 'Cow', copies: [0] }, { text: 'Cup', copies: [1, 2, 3, 4, 5] }, { text: 'Hen', copies: [6] }
    ]);
  });

  it('shows 0/5 beside Cup at the start, and the other words as before', () => {
    expect(wordList(newPlay(), REPEATS, false)).toEqual([
      { text: 'Cow', done: false, revealed: false, progress: '' },
      { text: 'Cup', done: false, revealed: false, progress: '0/5' },
      { text: 'Hen', done: false, revealed: false, progress: '' }
    ]);
  });

  it('finds each copy at its own placement, and only that copy', () => {
    expect(find([[1, 2], [1, 0]]).found).toEqual([3]);
    expect(find([[2, 0], [4, 0]]).found).toEqual([4]);
    expect(find([[0, 4], [0, 6], [0, 0], [0, 2]]).found).toEqual([2, 1]);
  });

  it('reads 1/5 after one copy, and finding that same copy again changes nothing', () => {
    const one = find([[0, 0], [0, 2]]);
    expect(wordList(one, REPEATS, false)[1]).toEqual({ text: 'Cup', done: false, revealed: false, progress: '1/5' });
    const again = find([[0, 0], [0, 2]], one);
    expect(again.found).toEqual([1]);
    expect(again.events).toEqual([]);
    expect(countLabel(again, REPEATS)).toBe('1/7');
  });

  it('crosses Cup off only once every copy is found', () => {
    const four = { picked: [], found: [1, 2, 3, 4], events: [], page: 0 };
    expect(wordList(four, REPEATS, false)[1]).toEqual({ text: 'Cup', done: false, revealed: false, progress: '4/5' });
    const all = find([[4, 4], [4, 6]], four);
    expect(wordList(all, REPEATS, false)[1]).toEqual({ text: 'Cup', done: true, revealed: false, progress: '5/5' });
  });

  it('counts every copy in the overall count', () => {
    expect(countLabel(newPlay(), REPEATS)).toBe('0/7');
    expect(countLabel({ picked: [], found: cups(), events: [], page: 0 }, REPEATS)).toBe('5/7');
  });

  it('sets off completion on the last copy, and not before', () => {
    const allButOne = { picked: [], found: [0, 1, 2, 3, 4, 6], events: [], page: 0 };
    expect(find([[4, 4], [4, 6]], allButOne).events).toEqual(['complete']);
    expect(find([[4, 4], [4, 6]], { picked: [], found: [0, 1, 2, 3, 4], events: [], page: 0 }).events).toEqual([]);
  });

  it('lines through every copy on the solution side', () => {
    expect(playMarks(solvedPlay(REPEATS, 0), REPEATS).found).toHaveLength(7);
  });
});

describe('a puzzle of several grids', () => {
  // A 3-page Saga: Cat on page 1 and Dog on page 2 sit on the same cells of their own grids, Cow
  // shares page 2, Hen is page 3's with a ? in its corner, and Goat is missing from every page.
  let SAGA;
  beforeEach(() => {
    const word = (text, grid, row) => ({ word: text, grid: grid, start: { row: row, col: 0 }, direction: 'E', length: 3 });
    SAGA = playBoard({
      hiddenId: 'WSCH-0010', type: 'Saga', created: '2026-10-03', title: 'Farm Saga',
      words: [word('Cat', 0, 0), word('Cow', 1, 1), word('Dog', 1, 0), { word: 'Goat', missing: true }, word('Hen', 2, 0)],
      grids: [
        { rows: ['CATX', 'XXXX', 'XXXX', 'XXXX'] },
        { rows: ['DOGX', 'COWX', 'XXXX', 'XXXX'] },
        { rows: ['HENX', 'XXXX', 'XXXX', 'XXXZ'], wildcards: [{ row: 3, col: 3 }] }
      ]
    });
  });
  const words = () => SAGA.words;
  const at = text => SAGA.words.findIndex(w => w.text === text);
  const find = (cells, play) => cells.reduce((p, cell) => tap(p, cell, words()), play || newPlay());

  it('names a tab for each page, and bands each printed sheet with its page out of all of them', () => {
    expect(SAGA.tabs).toEqual(['Page 1', 'Page 2', 'Page 3']);
    expect(SAGA.sheets).toEqual(['Saga · Page 1 of 3', 'Saga · Page 2 of 3', 'Saga · Page 3 of 3']);
    expect(SAGA.label).toBe('Saga');
    expect(SAGA.solutionLabel).toBe('Saga · Solution');
  });

  it('keeps each grid its own letters and its own wildcards, all one size', () => {
    expect(SAGA.grids.map(g => g.letters[0].join(''))).toEqual(['CATX', 'DOGX', 'HENX']);
    expect(SAGA.grids[2].shown[3]).toEqual(['X', 'X', 'X', '?']);
    expect(SAGA.grids[2].letters[3][3]).toBe('Z');
    expect(SAGA.grids.map(g => g.wild.flat().filter(Boolean).length)).toEqual([0, 0, 1]);
    expect([SAGA.rows, SAGA.cols]).toEqual([4, 4]);
  });

  it('opens on page 1', () => {
    expect(newPlay().page).toBe(0);
  });

  it('finds only the words placed on the grid on show', () => {
    expect(find([[0, 0], [0, 2]]).found).toEqual([at('Cat')]);
    expect(find([[0, 0], [0, 2]], turnPage(newPlay(), 1)).found).toEqual([at('Dog')]);
    expect(find([[1, 0], [1, 2]], turnPage(newPlay(), 2))).toEqual({ picked: [[1, 0], [1, 2]], found: [], events: [], page: 2 });
  });

  it('turning the page keeps every find and drops the open selection', () => {
    const open = find([[0, 0], [0, 2], [1, 1], [2, 1]]);
    expect(turnPage(open, 2)).toEqual({ picked: [], found: [at('Cat')], events: [], page: 2 });
  });

  it('marks only the finds on the grid on show, so each page keeps its own lines', () => {
    const both = find([[0, 0], [0, 2]], turnPage(find([[0, 0], [0, 2]]), 1));
    expect(both.found).toEqual([at('Cat'), at('Dog')]);
    expect(playMarks(turnPage(both, 0), words()).found).toEqual([[[0, 0], [0, 2]]]);
    expect(playMarks(turnPage(both, 1), words()).found).toEqual([[[0, 0], [0, 2]]]);
    expect(playMarks(turnPage(both, 2), words()).found).toEqual([]);
  });

  it('rings a letter shared only by found words on the grid on show', () => {
    // Dog and Ox share page 2's O; Cat sits on page 1's same cells as Dog.
    const pair = playBoard({
      hiddenId: 'WSCH-0011', type: 'Saga', created: '2026-10-03', title: 'Pair',
      words: [
        { word: 'Cat', grid: 0, start: { row: 0, col: 0 }, direction: 'E', length: 3 },
        { word: 'Dog', grid: 1, start: { row: 0, col: 0 }, direction: 'E', length: 3 },
        { word: 'Ox', grid: 1, start: { row: 0, col: 1 }, direction: 'S', length: 2 }
      ],
      grids: [{ rows: ['CAT', 'XXX'] }, { rows: ['DOG', 'XXX'] }]
    }).words;
    const play = { picked: [], found: [0, 1, 2], events: [], page: 1 };
    expect(playMarks(play, pair).shared).toEqual([[0, 1]]);
    expect(playMarks(turnPage(play, 0), pair).shared).toEqual([]);
  });

  it('solves each page on its own for the solution side', () => {
    expect(playMarks(solvedPlay(words(), 1), words()).found).toHaveLength(2);
    expect(playMarks(solvedPlay(words(), 2), words()).found).toEqual([[[0, 0], [0, 2]]]);
    expect(solvedPlay(words(), 2).page).toBe(2);
  });

  it('lists every word from every page, whichever page shows', () => {
    const play = find([[0, 0], [0, 2]]);
    expect(wordList(play, words(), false).map(item => item.text)).toEqual(['Cat', 'Cow', 'Dog', 'Goat', 'Hen']);
    expect(wordList(turnPage(play, 2), words(), false)).toEqual(wordList(play, words(), false));
    expect(countLabel(turnPage(play, 1), words())).toBe('1/4');
  });

  it('sets off completion only once every word on every page is found', () => {
    const allButHen = { picked: [], found: [at('Cat'), at('Cow'), at('Dog')], events: [], page: 2 };
    expect(find([[0, 0], [0, 2]], allButHen).events).toEqual(['complete']);
    const allButCat = { picked: [], found: [at('Cow'), at('Dog')], events: [], page: 2 };
    expect(find([[0, 0], [0, 2]], allButCat).events).toEqual([]);
  });
});

describe('where the words sit', () => {
  it('cycles Bottom → Right → Overlay → Bottom', () => {
    expect(nextWordsLayout('bottom')).toBe('right');
    expect(nextWordsLayout('right')).toBe('overlay');
    expect(nextWordsLayout('overlay')).toBe('bottom');
  });

  it('uses the choice last stored on this device', () => {
    ['bottom', 'right', 'overlay'].forEach(layout => {
      expect(savedWordsLayout(() => layout)).toBe(layout);
    });
  });

  it('starts in Overlay on a first visit, or when the stored choice is unknown', () => {
    [null, '', 'left', 'Bottom'].forEach(saved => {
      expect(savedWordsLayout(() => saved)).toBe('overlay');
    });
  });

  it('falls back to Overlay when the page cannot read the stored choice', () => {
    expect(savedWordsLayout(() => { throw new Error('blocked'); })).toBe('overlay');
  });

  it('stores the choice', () => {
    const stored = [];
    expect(saveWordsLayout(layout => stored.push(layout), 'right')).toBe(true);
    expect(stored).toEqual(['right']);
  });

  it('carries on when the page cannot store the choice', () => {
    expect(saveWordsLayout(() => { throw new Error('blocked'); }, 'right')).toBe(false);
  });
});

describe('how the words fill their card', () => {
  // Ten words, the widest 99.2px wide (a column of 100px), 20px rows; 116px a column with its gap,
  // 27px a row with its. The grid card is 400 × 300; the words card's band and edges take 36 × 60.
  const page = over => ({
    count: 10, wordWidths: [80, 99.2, 60], rowHeight: 20, colGap: 16, rowGap: 7,
    cardWidth: 400, cardHeight: 300, chromeWidth: 36, chromeHeight: 60, pageWidth: 1000, pageGap: 28, ...over
  });
  const columnsOf = fit => fit.places.reduce((lengths, [, c]) => ({ ...lengths, [c]: (lengths[c] || 0) + 1 }), {});

  it('makes every column as wide as the widest word, rounded up to a whole pixel', () => {
    expect(wordsFit('bottom', page()).wordWidth).toBe(100);
    expect(wordsFit('right', page()).wordWidth).toBe(100);
  });

  it('in Bottom fits as many columns as the grid card is wide, with their gaps', () => {
    expect(wordsFit('bottom', page()).columns).toBe(3);
    expect(wordsFit('bottom', page({ cardWidth: 483 })).columns).toBe(3);
    expect(wordsFit('bottom', page({ cardWidth: 484 }))).toMatchObject({ sits: 'bottom', columns: 4 });
  });

  it('in Bottom is never wider than the page, when the grid card is', () => {
    expect(wordsFit('bottom', page({ cardWidth: 484, pageWidth: 483 })).columns).toBe(3);
    expect(wordsFit('bottom', page({ cardWidth: 484, pageWidth: 484 })).columns).toBe(4);
  });

  it('in Overlay fills the grid card\'s height before adding a column', () => {
    // 300 tall holds nine 27px rows: ten words take two columns, though three fit across.
    expect(wordsFit('overlay', page())).toMatchObject({ sits: 'overlay', columns: 2 });
    expect(wordsFit('overlay', page({ cardHeight: 323 })).columns).toBe(1);
    expect(wordsFit('overlay', page({ count: 19, cardHeight: 322 })).columns).toBe(3);
  });

  it('in Overlay fits no more columns than the grid card is wide, whatever the page, and scrolls the rest', () => {
    // 87 tall holds one row: every word wants its own column, and the width caps them.
    expect(wordsFit('overlay', page({ cardHeight: 87, cardWidth: 483 })).columns).toBe(3);
    expect(wordsFit('overlay', page({ cardHeight: 87, cardWidth: 484, pageWidth: 300 }))).toMatchObject({ sits: 'overlay', columns: 4 });
  });

  it('never has more columns than words, nor fewer than one', () => {
    expect(wordsFit('bottom', page({ count: 2, wordWidths: [10] })).columns).toBe(2);
    expect(wordsFit('overlay', page({ count: 2, wordWidths: [10], cardHeight: 87 })).columns).toBe(2);
    expect(wordsFit('bottom', page({ cardWidth: 50 })).columns).toBe(1);
    expect(wordsFit('overlay', page({ cardWidth: 50, cardHeight: 87 })).columns).toBe(1);
  });

  it('in Right fills as many rows as the grid card is tall, then adds columns', () => {
    expect(wordsFit('right', page({ cardHeight: 323 }))).toMatchObject({ sits: 'right', columns: 1 });
    expect(wordsFit('right', page({ cardHeight: 322 }))).toMatchObject({ sits: 'right', columns: 2 });
    expect(wordsFit('right', page({ count: 19, cardHeight: 322 })).columns).toBe(3);
  });

  it('in Right gives each word a row of its own, however short the grid card', () => {
    expect(wordsFit('right', page({ cardHeight: 0, pageWidth: 2000 }))).toMatchObject({ sits: 'right', columns: 10 });
  });

  it('in Right drops under the grid as Bottom when the page has no room beside it for the columns', () => {
    // 400 grid card + 28 gap + 36 edges + two 100px columns and the 16px gap between them = 680.
    expect(wordsFit('right', page({ pageWidth: 680 }))).toMatchObject({ sits: 'right', columns: 2 });
    expect(wordsFit('right', page({ pageWidth: 679 }))).toMatchObject({ sits: 'bottom', columns: 3 });
  });

  it('reads down each column, then on to the next, the longer columns first', () => {
    expect(wordsFit('bottom', page({ count: 7 })).places).toEqual([[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [1, 3], [2, 3]]);
  });

  it('keeps every column within one word of the others, whatever the count and columns', () => {
    for (let count = 1; count <= 40; count++) {
      for (let columns = 1; columns <= count; columns++) {
        const fit = wordsFit('right', page({ count, cardHeight: 60 + 27 * Math.ceil(count / columns) - 7, pageWidth: 1e6 }));
        const lengths = Object.values(columnsOf(fit));
        expect(lengths).toHaveLength(fit.columns);
        expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
        const order = fit.places.map(([r, c]) => c * 1000 + r);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(fit.places.filter(([r]) => r === 1)).toHaveLength(fit.columns);
      }
    }
  });
});

describe('completion sparkles', () => {
  it('places each sparkle on the board and sends it out from there', () => {
    const rolls = [0.25, 0.5, 0.5, 0.25, 1];
    const random = () => rolls.shift();
    const [s] = sparkles(1, 200, 100, random);
    expect(s.x).toBeCloseTo(100);
    expect(s.y).toBeCloseTo(25);
    expect(s.dx).toBeCloseTo(0);
    expect(s.dy).toBeCloseTo(60);
    expect(s.delay).toBeCloseTo(0.35);
  });

  it('makes as many sparkles as asked', () => {
    expect(sparkles(3, 10, 10, () => 0)).toHaveLength(3);
  });

  it('starts the drift at 30px when the roll is zero', () => {
    const [s] = sparkles(1, 10, 10, () => 0);
    expect(s.dx).toBeCloseTo(30);
    expect(s.dy).toBeCloseTo(0);
  });
});
