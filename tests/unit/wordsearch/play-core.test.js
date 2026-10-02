import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import {
  puzzleUrl, playJson,
  wordCells, playBoard, newPlay, solvedPlay, tap, sharedCells, playMarks, wordList, countLabel, sparkles
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
    const wide = playBoard(Object.assign({}, PUZZLE, { grid: ['ABC', 'DEF'] }));
    expect(wide.letters).toEqual([['A', 'B', 'C'], ['D', 'E', 'F']]);
    expect(wide.rows).toBe(2);
    expect(wide.cols).toBe(3);
  });

  it('lists the words as shown, in file order, with their cells', () => {
    expect(WORDS.map(w => w.text)).toEqual(['Cat', 'Cow', 'Ewe', 'Hen', 'Ice cream', 'Map', 'Pig', 'Piglet']);
    expect(WORDS[at('Ice cream')].cells).toHaveLength(8);
  });
});

describe('tapping', () => {
  it('starts a selection on the first tap', () => {
    expect(taps([[0, 0]])).toEqual({ picked: [[0, 0]], found: [], events: [] });
  });

  it('crosses a word off when its two ends are tapped', () => {
    expect(taps([[4, 2], [2, 2]])).toEqual({ picked: [], found: [at('Cat')], events: [] });
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
    expect(taps([[0, 0], [0, 3]])).toEqual({ picked: [[0, 0], [0, 3]], found: [], events: [] });
  });

  it('extends an open selection further along its line until it spells a word', () => {
    const open = taps([[0, 0], [0, 3]]);
    expect(taps([[0, 5]], open)).toEqual({ picked: [[0, 0], [0, 5]], found: [], events: [] });
    expect(taps([[0, 5], [0, 7]], open).found).toEqual([at('Ice cream')]);
  });

  it('extends along a column and a diagonal too', () => {
    expect(taps([[1, 0], [3, 0], [6, 0]]).found).toEqual([at('Piglet')]);
    expect(taps([[3, 4], [2, 3], [1, 2]]).found).toEqual([at('Cow')]);
  });

  it('ignores a tap that is not in line with the start', () => {
    expect(taps([[0, 0], [2, 1]])).toEqual({ picked: [[0, 0]], found: [], events: [] });
  });

  it('ignores a tap off the open line, behind the start, or back between the ends', () => {
    const open = taps([[0, 1], [0, 3]]);
    expect(taps([[1, 4]], open)).toEqual(open);
    expect(taps([[0, 0]], open)).toEqual(open);
    expect(taps([[0, 2]], open)).toEqual(open);
    expect(taps([[0, 1]], open)).toEqual(open);
  });

  it('ignores a tap off a diagonal line that only matches one axis', () => {
    const open = taps([[1, 2], [2, 3]]);
    expect(taps([[3, 3]], open)).toEqual(open);
    expect(taps([[2, 4]], open)).toEqual(open);
  });

  it('clears the selection when the only letter is tapped again', () => {
    expect(taps([[0, 0], [0, 0]])).toEqual(newPlay());
  });

  it('clears the selection when the last letter is tapped again', () => {
    expect(taps([[0, 0], [0, 3], [0, 3]])).toEqual(newPlay());
  });

  it('does not find a word from a selection sharing only one of its ends', () => {
    expect(taps([[2, 2], [2, 4]])).toEqual({ picked: [[2, 2], [2, 4]], found: [], events: [] });
    expect(taps([[4, 2], [4, 4]])).toEqual({ picked: [[4, 2], [4, 4]], found: [], events: [] });
  });

  it('does not cross off PIG for P then G inside PIGLET', () => {
    expect(taps([[1, 0], [3, 0]])).toEqual({ picked: [[1, 0], [3, 0]], found: [], events: [] });
  });

  it('crosses off PIG at its own placement', () => {
    expect(taps([[7, 2], [7, 0]]).found).toEqual([at('Pig')]);
  });

  it('does not find a found word twice', () => {
    expect(taps([[4, 2], [2, 2], [4, 2], [2, 2]])).toEqual({ picked: [[4, 2], [2, 2]], found: [at('Cat')], events: [] });
  });

  it('sets off completion when the last word is found, and only then', () => {
    const allButOne = { picked: [], found: [0, 1, 2, 3, 4, 5, 6], events: [] };
    expect(taps([[1, 0], [6, 0]], allButOne)).toEqual({ picked: [], found: [0, 1, 2, 3, 4, 5, 6, 7], events: ['complete'] });
  });

  it('starts every play with nothing picked or found', () => {
    expect(newPlay()).toEqual({ picked: [], found: [], events: [] });
  });

  it('solves every word for the solution side', () => {
    expect(solvedPlay(WORDS)).toEqual({ picked: [], found: [0, 1, 2, 3, 4, 5, 6, 7], events: [] });
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
    expect(wordList(taps([[4, 2], [2, 2]]), WORDS).slice(0, 2)).toEqual([{ text: 'Cat', done: true }, { text: 'Cow', done: false }]);
  });

  it('counts found words out of all of them', () => {
    expect(countLabel(newPlay(), WORDS)).toBe('0/8');
    expect(countLabel(taps([[4, 2], [2, 2]]), WORDS)).toBe('1/8');
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
