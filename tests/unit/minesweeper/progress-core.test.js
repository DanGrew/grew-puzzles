import { describe, it, expect, beforeEach } from 'vitest';
import { minesBoard, newMinesPlay, tapMines } from '../../../core/minesweeper/play-core.js';
import {
  marksRow, tapRows, restoredMines, syncRows, joinedMines, joinedHistory,
  revealRow, revealTapRows, restoredReveal, revealSyncRows, joinedReveal, joinedRevealHistory
} from '../../../core/minesweeper/progress-core.js';
import { newRevealPlay, tapReveal, revealFinished, revealSquares } from '../../../core/minesweeper/reveal-core.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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

  it('Undo keeps its history with the marks on screen, and starts over once the saved board replaces them', () => {
    const history = [{ marks: {}, events: [] }];
    expect(joinedHistory(taps([[0, 2]]), history)).toBe(history);
    expect(joinedHistory(newMinesPlay(), history)).toEqual([]);
  });
});

// A Reveal board: tooling's own valid one, 6×6, six mines, starting on the 0 at row 2, col 2 (as
// reveal-core.test.js's):
//   0 1 * 1 0 0
//   1 2 1 2 1 1
//   * 1 0 1 * 1
//   2 3 1 2 1 1
//   * 3 * 1 0 0
//   2 * 2 1 0 0
let REVEAL;
beforeEach(() => {
  REVEAL = minesBoard({
    hiddenId: 'MINE-0901', type: 'Reveal', created: '2026-10-14', title: 'Reveal 001', difficulty: 'Medium', width: 6, height: 6,
    numbersPerStep: 3, numbers: ['01.100', '121211', '.101.1', '231211', '.3.100', '2.2100'],
    mines: [{ row: 0, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 4 }, { row: 4, col: 0 }, { row: 4, col: 2 }, { row: 5, col: 1 }],
    start: { row: 2, col: 2 }
  });
});

const START_CELLS = [[1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3], [3, 1], [3, 2], [3, 3]];
const SAFE_KEYS = ['0,0', '0,1', '0,3', '0,4', '0,5', '1,0', '1,1', '1,2', '1,3', '1,4', '1,5', '2,1', '2,2', '2,3', '2,5',
  '3,0', '3,1', '3,2', '3,3', '3,4', '3,5', '4,1', '4,3', '4,4', '4,5', '5,0', '5,2', '5,3', '5,4', '5,5'];
const revealTaps = (steps, play) => steps.reduce((p, [cell, tool]) => tapReveal(p, cell, REVEAL, tool), play || newRevealPlay(REVEAL));
const revealed = (mines, noMines, finished = false) => ({ puzzle: 'MINE-0901', mines, no_mines: noMines, finished });
const openAll = () => SAFE_KEYS.reduce((p, key) => (p.open[key] ? p : tapReveal(p, key.split(',').map(Number), REVEAL, 'open')), newRevealPlay(REVEAL));

describe('a Reveal board\'s row', () => {
  it('its opened squares are its no_mines, row by row, and its mine marks its mines, in the order placed', () => {
    const play = revealTaps([[[0, 3], 'open'], [[0, 2], 'mark']]);
    expect(revealRow('MINE-0901', play, REVEAL)).toEqual(revealed([[0, 2]], [[0, 3], ...START_CELLS]));
    const later = revealTaps([[[4, 0], 'mark'], [[0, 4], 'mark'], [[2, 0], 'mark']], play);
    expect(revealRow('MINE-0901', later, REVEAL).mines).toEqual([[0, 2], [4, 0], [0, 4], [2, 0]]);
  });

  // The product's TASK-179: a Limited Flags board's oldest mark is the first saved, on any device.
  it('a saved board comes back with its marks in the order placed', () => {
    const play = restoredReveal(REVEAL, [revealed([[4, 0], [0, 2], [2, 0]], START_CELLS)]);
    expect(Object.keys(play.marks)).toEqual(['4,0', '0,2', '2,0']);
  });

  it('says finished once every safe square is open', () => {
    const row = revealRow('MINE-0901', openAll(), REVEAL);
    expect(row.finished).toBe(true);
    expect(row.no_mines).toHaveLength(30);
    expect(row.mines).toEqual([[0, 2], [2, 0], [2, 4], [4, 0], [4, 2], [5, 1]]);
  });

  it('is empty once a mine has gone off, so the board comes back at its start', () => {
    const play = revealTaps([[[0, 3], 'open'], [[0, 4], 'mark'], [[0, 2], 'open']]);
    expect(play.boom).toBe('0,2');
    expect(revealRow('MINE-0901', play, REVEAL)).toEqual(revealed([], []));
  });
});

describe('what a Reveal tap saves', () => {
  it('an opening, a mark and a mark taken off each save the whole board', () => {
    const opened = revealTaps([[[0, 3], 'open']]);
    expect(revealTapRows('MINE-0901', newRevealPlay(REVEAL), opened, REVEAL)).toEqual([revealed([], [[0, 3], ...START_CELLS])]);
    const marked = revealTaps([[[0, 2], 'mark']], opened);
    expect(revealTapRows('MINE-0901', opened, marked, REVEAL)).toEqual([revealed([[0, 2]], [[0, 3], ...START_CELLS])]);
    expect(revealTapRows('MINE-0901', marked, opened, REVEAL)).toEqual([revealed([], [[0, 3], ...START_CELLS])]);
  });

  it('the kaboom saves the board cleared', () => {
    const before = revealTaps([[[0, 3], 'open']]);
    expect(revealTapRows('MINE-0901', before, revealTaps([[[0, 2], 'open']], before), REVEAL)).toEqual([revealed([], [])]);
  });

  it('a tap that changes nothing saves nothing', () => {
    const play = newRevealPlay(REVEAL);
    expect(revealTapRows('MINE-0901', play, revealTaps([[[1, 2], 'open']], play), REVEAL)).toEqual([]);
  });
});

describe('a saved Reveal board coming back', () => {
  it('no row, or an empty one, and it is at its start', () => {
    expect(restoredReveal(REVEAL, [])).toEqual(newRevealPlay(REVEAL));
    expect(restoredReveal(REVEAL, [revealed([], [])])).toEqual(newRevealPlay(REVEAL));
  });

  it('its opened squares and mine marks back where they were, and nothing set off', () => {
    const play = restoredReveal(REVEAL, [revealed([[0, 2]], [[0, 3], ...START_CELLS])]);
    expect(play).toEqual(revealTaps([[[0, 3], 'open'], [[0, 2], 'mark']]));
    expect(play.events).toEqual([]);
  });

  it('a saved open mine, or a square off the board, opens nothing; a mark on an open square, or off the board, marks nothing', () => {
    const play = restoredReveal(REVEAL, [revealed([[1, 1], [6, 0], [0, 6], [0, 4]], [[0, 2], [6, 0], [0, 6]])]);
    expect(play.open).toEqual(newRevealPlay(REVEAL).open);
    expect(play.marks).toEqual({ '0,4': 'mine' });
    // A board with no canaries never reads a saved mine as one a canary found.
    expect(play.blown).toEqual({});
  });

  it('a finished board comes back finished, every mine marked, and nothing set off', () => {
    const play = restoredReveal(REVEAL, [revealRow('MINE-0901', openAll(), REVEAL)]);
    expect(revealFinished(play, REVEAL)).toBe(true);
    expect(play.marks).toEqual(openAll().marks);
    expect(play).toMatchObject({ boom: '', events: [] });
  });

  it('only the first row counts — there is only ever one', () => {
    expect(restoredReveal(REVEAL, [revealed([], []), revealed([[0, 2]], [])]).marks).toEqual({});
  });

  // The product's TASK-177: a Keys board saves nothing new — a zone is unlocked once its key's
  // square is open, and opened squares are saved. Zone 1 is (4,4) (4,5) (5,4) (5,5), its key on
  // (5,0) in Zone 2, whose key is on (0,5).
  it('a Keys board comes back with the zones it had unlocked still unlocked, and their keys found', () => {
    const keys = minesBoard({
      hiddenId: 'MINE-0903', type: 'Keys', created: '2026-10-14', title: 'Keys 001', difficulty: 'Easy', width: 6, height: 6,
      numbersPerStep: 3, numbers: ['01.100', '121211', '.101.1', '231211', '.3.100', '2.2100'],
      mines: [{ row: 0, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 4 }, { row: 4, col: 0 }, { row: 4, col: 2 }, { row: 5, col: 1 }],
      start: { row: 2, col: 2 },
      zones: ['......', '......', '......', '......', '....11', '2...11'],
      keys: [{ key: 1, row: 5, col: 0 }, { key: 2, row: 0, col: 5 }]
    });
    const left = ['0,5', '5,0'].reduce((p, key) => tapReveal(p, key.split(',').map(Number), keys, 'open'), newRevealPlay(keys));
    const play = restoredReveal(keys, [revealRow('MINE-0903', left, keys)]);
    expect(play).toEqual({ ...left, events: [] });
    expect(revealSquares(play, keys).filter(s => s.found !== '').map(s => s.key)).toEqual(['0,5', '5,0']);
    expect(revealSquares(play, keys).filter(s => s.lock !== '')).toEqual([]);
    expect(tapReveal(play, [4, 4], keys, 'open').open['4,4']).toBe(true);
  });
});

describe('signing in mid-way through a Reveal board', () => {
  it('a player who has opened or marked anything saves the board on screen', () => {
    const opened = revealTaps([[[0, 3], 'open']]);
    expect(revealSyncRows('MINE-0901', opened, REVEAL)).toEqual([revealRow('MINE-0901', opened, REVEAL)]);
    const marked = revealTaps([[[0, 2], 'mark']]);
    expect(revealSyncRows('MINE-0901', marked, REVEAL)).toEqual([revealRow('MINE-0901', marked, REVEAL)]);
  });

  it('a player at the start, or just blown up, saves nothing', () => {
    expect(revealSyncRows('MINE-0901', newRevealPlay(REVEAL), REVEAL)).toEqual([]);
    expect(revealSyncRows('MINE-0901', revealTaps([[[0, 3], 'open'], [[0, 2], 'open']]), REVEAL)).toEqual([]);
  });

  it('the board on screen is kept over the saved one once played, and nothing is set off', () => {
    const play = revealTaps([[[0, 3], 'open']]);
    const saved = restoredReveal(REVEAL, [revealed([[0, 2]], START_CELLS)]);
    expect(joinedReveal(play, saved, REVEAL)).toEqual({ open: play.open, marks: {}, blown: {}, boom: '', events: [] });
    expect(joinedRevealHistory(play, ['0,4'], REVEAL)).toEqual(['0,4']);
  });

  it('at the start, the saved board comes back, and Undo starts over', () => {
    const saved = restoredReveal(REVEAL, [revealed([[0, 2]], START_CELLS)]);
    expect(joinedReveal(newRevealPlay(REVEAL), saved, REVEAL)).toBe(saved);
    expect(joinedRevealHistory(newRevealPlay(REVEAL), ['0,4'], REVEAL)).toEqual([]);
  });
});

// ---- A Canaries board (the product's TASK-203) ----
// Tooling's own valid Canaries board, two canaries, its mines (0,4) (1,1) (1,2) (2,2) (2,4) (4,0)
// (5,1); its start square's area rows 3 to 5, cols 2 to 5. A mine a canary found is saved in
// no_mines, where no other mine ever is.
describe('a Canaries board\'s row', () => {
  let CANARIES;
  beforeEach(() => {
    CANARIES = minesBoard(structuredClone(require('../../fixtures/MINE-0905.json')));
  });
  const canaryTaps = (steps, play) => steps.reduce((p, [cell, tool]) => tapReveal(p, cell, CANARIES, tool), play || newRevealPlay(CANARIES));
  const CANARY_START = [[3, 2], [3, 3], [3, 4], [3, 5], [4, 2], [4, 3], [4, 4], [4, 5], [5, 2], [5, 3], [5, 4], [5, 5]];
  const canaryRow = (mines, noMines, finished = false) => ({ puzzle: 'MINE-0905', mines, no_mines: noMines, finished });

  it('a mine a canary found is saved among its opened squares, row by row', () => {
    const play = canaryTaps([[[5, 1], 'canary'], [[3, 1], 'mark']]);
    expect(revealRow('MINE-0905', play, CANARIES)).toEqual(canaryRow([[3, 1]], [...CANARY_START.slice(0, 4), ...CANARY_START.slice(4, 8), [5, 1], ...CANARY_START.slice(8)]));
  });

  it('a canary lost saves the board; a kaboom saves it cleared, every canary back', () => {
    const start = newRevealPlay(CANARIES);
    const lost = canaryTaps([[[4, 0], 'canary']]);
    expect(revealTapRows('MINE-0905', start, lost, CANARIES)).toEqual([canaryRow([], [...CANARY_START.slice(0, 4), [4, 0], ...CANARY_START.slice(4)])]);
    expect(revealRow('MINE-0905', canaryTaps([[[5, 1], 'open']], lost), CANARIES)).toEqual(canaryRow([], []));
  });

  it('comes back with its canaries\' mines shown and its canaries left as they were', () => {
    const left = canaryTaps([[[4, 0], 'canary'], [[3, 1], 'open'], [[5, 1], 'mark']]);
    const play = restoredReveal(CANARIES, [revealRow('MINE-0905', left, CANARIES)]);
    expect(play).toEqual({ ...left, events: [] });
    expect(revealSquares(play, CANARIES).find(s => s.key === '4,0')).toMatchObject({ state: 'blown' });
  });

  it('a saved mine never comes back as more canaries lost than the board gives, nor as a mark too', () => {
    const play = restoredReveal(CANARIES, [canaryRow([[4, 0], [0, 4]], [[4, 0], [5, 1], [2, 2], ...CANARY_START])]);
    expect(play.blown).toEqual({ '4,0': true, '5,1': true });
    expect(play.marks).toEqual({ '0,4': 'mine' });
  });

  it('signing in mid-board, a canary lost is played: the board on screen is kept and saved', () => {
    const lost = canaryTaps([[[4, 0], 'canary']]);
    expect(revealSyncRows('MINE-0905', lost, CANARIES)).toEqual([revealRow('MINE-0905', lost, CANARIES)]);
    const saved = restoredReveal(CANARIES, [canaryRow([[3, 1]], CANARY_START)]);
    expect(joinedReveal(lost, saved, CANARIES)).toEqual({ ...lost, events: [] });
  });
});
