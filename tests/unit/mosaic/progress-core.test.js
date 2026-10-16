import { describe, it, expect, beforeEach } from 'vitest';
import { mosaicBoard, newMosaicPlay, tapMosaic, givenMosaic } from '../../../core/mosaic/play-core.js';
import {
  boardSquares, squaresRow, changedRows, restoredMosaic, syncRows, joinedMosaic, joinedMosaicHistory
} from '../../../core/mosaic/progress-core.js';
// core/mosaic/progress-core.js, against a small board of two rows of three:
//   numbers  2 . .     answer  # . .
//            . . 1             . # .

let SMALL;
beforeEach(() => {
  SMALL = mosaicBoard({
    hiddenId: 'MOSA-0009', type: 'Vanilla', created: '2026-10-15', title: 'Mosaic 009', difficulty: 'Hard', width: 3, height: 2,
    numbersPerStep: 1, numbers: ['2..', '..1'], answer: ['#..', '.#.'], name: 'Barn Owl', pattern: { style: 'mirror', size: 3, seed: 1 }
  });
});

const play = marks => ({ marks, events: [] });
const tapped = cells => cells.reduce((p, cell) => tapMosaic(p, cell, SMALL, 'cycle'), newMosaicPlay());

describe('the board as the table holds it', () => {
  it('is a character a square, row by row from the top left: clear 0, shaded 1, left blank 2', () => {
    expect(boardSquares(play({ '0,1': 'shade', '1,0': 'blank', '1,2': 'shade' }), SMALL)).toBe('010201');
    expect(boardSquares(play({ '0,0': 'blank' }), SMALL)).toBe('200000');
  });

  it('is empty with nothing marked — a board whose every square was cleared too', () => {
    expect(boardSquares(newMosaicPlay(), SMALL)).toBe('');
    expect(boardSquares(tapped([[0, 0], [0, 0], [0, 0]]), SMALL)).toBe('');
  });

  it('a row is the mosaic\'s hidden ID, its squares and whether it\'s finished', () => {
    expect(squaresRow('MOSA-0009', play({ '0,0': 'shade' }), SMALL)).toEqual({ puzzle: 'MOSA-0009', squares: '100000', finished: false });
    expect(squaresRow('MOSA-0009', play({ '0,0': 'shade', '1,1': 'shade', '0,2': 'blank' }), SMALL))
      .toEqual({ puzzle: 'MOSA-0009', squares: '102010', finished: true });
  });
});

describe('what a pause saves', () => {
  const row = (squares, finished = false) => ({ puzzle: 'MOSA-0009', squares, finished });

  it('the board, if it isn\'t the one last saved', () => {
    expect(changedRows(row('100000'), row(''))).toEqual([row('100000')]);
    expect(changedRows(row(''), row('100000'))).toEqual([row('')]);
  });

  it('nothing, if the squares and the finish are as last saved', () => {
    expect(changedRows(row('100000'), row('100000'))).toEqual([]);
  });

  it('the board, if only whether it\'s finished changed', () => {
    expect(changedRows(row('100000', true), row('100000'))).toEqual([row('100000', true)]);
  });
});

describe('a saved board coming back', () => {
  it('no row, and it\'s new', () => {
    expect(restoredMosaic(SMALL, [])).toEqual(newMosaicPlay());
  });

  it('every shaded and blank square is back where it was', () => {
    expect(restoredMosaic(SMALL, [{ squares: '012000' }])).toEqual(play({ '0,1': 'shade', '0,2': 'blank' }));
    expect(restoredMosaic(SMALL, [{ squares: '000021' }])).toEqual(play({ '1,1': 'blank', '1,2': 'shade' }));
  });

  it('an empty row is a new board', () => {
    expect(restoredMosaic(SMALL, [{ squares: '' }])).toEqual(newMosaicPlay());
  });

  it('only the board\'s own squares are read, and any character but 1 and 2 marks nothing', () => {
    expect(restoredMosaic(SMALL, [{ squares: '0000001222' }])).toEqual(play({}));
    expect(restoredMosaic(SMALL, [{ squares: '1x3' }])).toEqual(play({ '0,0': 'shade' }));
  });

  it('a clear square comes back as no mark at all, so a board of clear squares is untouched on signing in', () => {
    expect(Object.keys(restoredMosaic(SMALL, [{ squares: '010000' }]).marks)).toEqual(['0,1']);
    expect(syncRows('MOSA-0009', restoredMosaic(SMALL, [{ squares: '000000' }]), SMALL)).toEqual([]);
  });

  it('only the first row counts', () => {
    expect(restoredMosaic(SMALL, [{ squares: '100000' }, { squares: '010000' }])).toEqual(play({ '0,0': 'shade' }));
  });

  it('round trips: what\'s saved is what comes back', () => {
    const before = tapped([[0, 0], [0, 0], [1, 2], [0, 1]]);
    expect(restoredMosaic(SMALL, [squaresRow('MOSA-0009', before, SMALL)])).toEqual(play(before.marks));
  });

  it('a finished board comes back finished, setting nothing off', () => {
    const back = restoredMosaic(SMALL, [{ squares: '100010' }]);
    expect(back.events).toEqual([]);
    expect(squaresRow('MOSA-0009', back, SMALL).finished).toBe(true);
  });
});

describe('a board whose 0s and 9s open filled in', () => {
  // Two rows of three: a 0 in the top-left corner, its block (0,0), (0,1), (1,0) and (1,1).
  //   numbers  0 . .     answer  . . #
  //            . . 1             . . .
  let ZERO;
  beforeEach(() => {
    ZERO = mosaicBoard({
      hiddenId: 'MOSA-0011', type: 'Vanilla', created: '2026-10-15', title: 'Mosaic 011', difficulty: 'Easy', width: 3, height: 2,
      numbersPerStep: 1, numbers: ['0..', '..1'], answer: ['..#', '...'], name: 'Dot', pattern: { style: 'mirror', size: 3, seed: 1 }
    });
  });
  const opened = () => givenMosaic(ZERO);
  const after = cells => cells.reduce((p, cell) => tapMosaic(p, cell, ZERO, 'cycle'), opened());

  it('as it opens is no board at all, so it isn\'t started and saves nothing', () => {
    expect(boardSquares(opened(), ZERO)).toBe('');
    expect(changedRows(squaresRow('MOSA-0011', opened(), ZERO), squaresRow('MOSA-0011', opened(), ZERO))).toEqual([]);
  });

  it('once a square changes is the whole board, its filled-in squares too', () => {
    expect(boardSquares(after([[0, 2]]), ZERO)).toBe('222220');
  });

  it('cleared of everything is its clear squares, never empty, so it comes back cleared', () => {
    const cleared = after([[0, 0], [0, 0], [0, 1], [0, 1], [1, 0], [1, 0], [1, 1], [1, 1]]);
    expect(boardSquares(cleared, ZERO)).toBe('000000');
    expect(restoredMosaic(ZERO, [squaresRow('MOSA-0011', cleared, ZERO)])).toEqual(play({}));
  });

  it('comes back filled in with no row, or an empty one', () => {
    expect(restoredMosaic(ZERO, [])).toEqual(opened());
    expect(restoredMosaic(ZERO, [{ squares: '' }])).toEqual(opened());
  });

  it('comes back as saved, never filled in again over it', () => {
    expect(restoredMosaic(ZERO, [{ squares: '020001' }])).toEqual(play({ '0,1': 'blank', '1,2': 'shade' }));
  });

  it('signing in on it as it opened saves nothing and picks up the board saved elsewhere', () => {
    const saved = play({ '0,2': 'shade' });
    expect(syncRows('MOSA-0011', opened(), ZERO)).toEqual([]);
    expect(joinedMosaic(opened(), saved, ZERO)).toBe(saved);
    expect(joinedMosaicHistory(opened(), ['a tap'], ZERO)).toEqual([]);
  });

  it('signing in once a square has changed keeps the board on screen and its Undo', () => {
    const now = after([[0, 2]]);
    expect(syncRows('MOSA-0011', now, ZERO)).toEqual([{ puzzle: 'MOSA-0011', squares: '222220', finished: false }]);
    expect(joinedMosaic(now, play({}), ZERO)).toEqual({ marks: now.marks, events: [] });
    expect(joinedMosaicHistory(now, ['a tap'], ZERO)).toEqual(['a tap']);
  });
});

describe('signing in mid-board', () => {
  it('saves the board on screen if anything is marked', () => {
    expect(syncRows('MOSA-0009', play({ '1,1': 'blank' }), SMALL)).toEqual([{ puzzle: 'MOSA-0009', squares: '000020', finished: false }]);
  });

  it('saves nothing if nothing is — the board saved elsewhere is picked up instead', () => {
    expect(syncRows('MOSA-0009', newMosaicPlay(), SMALL)).toEqual([]);
  });
});
