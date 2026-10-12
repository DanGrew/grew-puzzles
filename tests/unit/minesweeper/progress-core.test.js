import { describe, it, expect, beforeEach } from 'vitest';
import { minesBoard, newMinesPlay, tapMines } from '../../../core/minesweeper/play-core.js';
import { marksRow, tapRows, restoredMines, syncRows, joinedMines } from '../../../core/minesweeper/progress-core.js';
// core/minesweeper/progress-core.js, against a small board, two rows of three:
//   2 . .      the 2 touches (0,1), (1,0) and (1,1); the 1 touches (0,1), (0,2) and (1,1)
//   . . 1      its mines are (0,1) and (1,0)

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
let SMALL;
beforeEach(() => {
  SMALL = minesBoard({
    hiddenId: 'MINE-0009', type: 'Vanilla', created: '2026-10-11', title: 'Small', difficulty: 'Hard', width: 3, height: 2,
    numbersPerStep: 1, numbers: ['2..', '..1'], mines: [{ row: 0, col: 1 }, { row: 1, col: 0 }]
  });
});

const taps = (cells, play) => cells.reduce((p, cell) => tapMines(p, cell, SMALL), play || newMinesPlay());
const row = (mines, noMines, finished = false) => ({ puzzle: 'MINE-0009', mines, no_mines: noMines, finished });

describe('the board\'s row', () => {
  it('a new board is its hidden ID and no marks, unfinished', () => {
    expect(marksRow('MINE-0009', newMinesPlay(), SMALL)).toEqual(row([], []));
  });

  it('lists every mine and every dot, each row by row, whatever order they were marked in', () => {
    const play = taps([[1, 1], [1, 1], [1, 0], [1, 0], [0, 2], [0, 1]]);
    expect(marksRow('MINE-0009', play, SMALL)).toEqual(row([[1, 0], [1, 1]], [[0, 1], [0, 2]]));
    expect(marksRow('MINE-0009', taps([[1, 1], [0, 2]]), SMALL)).toEqual(row([], [[0, 2], [1, 1]]));
  });

  it('says finished once the board is', () => {
    expect(marksRow('MINE-0009', taps([[0, 1], [0, 1], [1, 0], [1, 0]]), SMALL)).toEqual(row([[0, 1], [1, 0]], [], true));
  });
});

describe('what a tap saves', () => {
  it('a tap that marks a square saves the whole board', () => {
    const before = taps([[0, 2]]);
    expect(tapRows('MINE-0009', before, taps([[1, 1]], before), SMALL)).toEqual([row([], [[0, 2], [1, 1]])]);
  });

  it('a tap that clears the last mark saves the board empty', () => {
    const before = taps([[0, 2], [0, 2]]);
    expect(tapRows('MINE-0009', before, taps([[0, 2]], before), SMALL)).toEqual([row([], [])]);
  });

  it('a number\'s fill saves every square it filled', () => {
    const before = taps([[0, 1], [0, 1]]);
    expect(tapRows('MINE-0009', before, taps([[1, 2]], before), SMALL)).toEqual([row([[0, 1]], [[0, 2], [1, 1]])]);
  });

  it('the tap that finishes the board saves it finished', () => {
    const before = taps([[0, 1], [0, 1], [1, 0]]);
    expect(tapRows('MINE-0009', before, taps([[1, 0]], before), SMALL)).toEqual([row([[0, 1], [1, 0]], [], true)]);
  });

  it('a tap that changes no mark — a number that settles nothing, or any tap on a solved board — saves nothing', () => {
    const start = newMinesPlay();
    expect(tapRows('MINE-0009', start, taps([[0, 0]], start), SMALL)).toEqual([]);
    const solved = taps([[0, 1], [0, 1], [1, 0], [1, 0]]);
    expect(tapRows('MINE-0009', solved, taps([[1, 1]], solved), SMALL)).toEqual([]);
  });
});

describe('a saved board coming back', () => {
  it('no row, and the board is new', () => {
    expect(restoredMines(SMALL, [])).toEqual({ marks: {}, events: [] });
  });

  it('its mines and dots back where they were, and nothing set off', () => {
    expect(restoredMines(SMALL, [row([[0, 1]], [[0, 2], [1, 1]])])).toEqual({ marks: { '0,1': 'mine', '0,2': 'dot', '1,1': 'dot' }, events: [] });
  });

  it('a finished board comes back finished, and takes no more taps', () => {
    const play = restoredMines(SMALL, [row([[0, 1], [1, 0]], [], true)]);
    expect(play.events).toEqual([]);
    expect(tapMines(play, [1, 1], SMALL)).toEqual({ marks: play.marks, events: [] });
  });

  it('a saved mark on a number, or off the board, marks nothing', () => {
    expect(restoredMines(SMALL, [row([[0, 0], [2, 1], [0, 3]], [[1, 2], [5, 5]])])).toEqual({ marks: {}, events: [] });
    expect(restoredMines(SMALL, [row([[1, 2]], [])]).marks).toEqual({});
  });

  it('a row missing a list reads it as empty', () => {
    expect(restoredMines(SMALL, [{ puzzle: 'MINE-0009', mines: [[0, 1]] }]).marks).toEqual({ '0,1': 'mine' });
    expect(restoredMines(SMALL, [{ puzzle: 'MINE-0009', no_mines: [[0, 1]] }]).marks).toEqual({ '0,1': 'dot' });
  });

  it('only the first row counts — there is only ever one', () => {
    expect(restoredMines(SMALL, [row([[0, 1]], []), row([[1, 0]], [])]).marks).toEqual({ '0,1': 'mine' });
  });

  it('a square saved as both reads as a mine', () => {
    expect(restoredMines(SMALL, [row([[0, 1]], [[0, 1]])]).marks).toEqual({ '0,1': 'mine' });
  });
});

describe('signing in mid-board', () => {
  it('a player who has marked anything saves the board on screen', () => {
    expect(syncRows('MINE-0009', taps([[0, 2]]), SMALL)).toEqual([row([], [[0, 2]])]);
  });

  it('a player who hasn\'t marked anything saves nothing', () => {
    expect(syncRows('MINE-0009', newMinesPlay(), SMALL)).toEqual([]);
  });

  it('marks on screen are kept over the saved board, and nothing is set off', () => {
    const play = { marks: { '0,2': 'dot' }, events: ['complete'] };
    expect(joinedMines(play, { marks: { '0,1': 'mine' }, events: [] })).toEqual({ marks: { '0,2': 'dot' }, events: [] });
  });

  it('with nothing marked on screen, the saved board comes back', () => {
    const saved = { marks: { '0,1': 'mine' }, events: [] };
    expect(joinedMines(newMinesPlay(), saved)).toBe(saved);
  });
});
