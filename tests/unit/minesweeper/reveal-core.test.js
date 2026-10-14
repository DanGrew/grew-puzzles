import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { minesBoard, minesMistakes, minesCount } from '../../../core/minesweeper/play-core.js';
import {
  newRevealPlay, revealFinished, tapReveal, markReveal, revealTapped, undoneReveal, canUndoReveal, revealSquares
} from '../../../core/minesweeper/reveal-core.js';
const require = createRequire(import.meta.url);
// core/minesweeper/reveal-core.js, against tooling's own valid Reveal board (its
// fixtures/minesweeper/reveal-valid.json), 6×6, six mines, starting on the 0 at row 2, col 2:
//   0 1 * 1 0 0
//   1 2 1 2 1 1
//   * 1 0 1 * 1
//   2 3 1 2 1 1
//   * 3 * 1 0 0
//   2 * 2 1 0 0
// — and MINE-0901, a 10×10 Reveal board made by tooling's generator and passing its checks.
const BIG_FILE = require('../../fixtures/MINE-0901.json');

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
let BOARD;
beforeEach(() => {
  BOARD = minesBoard({
    hiddenId: 'MINE-0002', type: 'Reveal', created: '2026-10-14', title: 'Reveal 001', difficulty: 'Medium', width: 6, height: 6,
    numbersPerStep: 3, numbers: ['01.100', '121211', '.101.1', '231211', '.3.100', '2.2100'],
    mines: [{ row: 0, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 4 }, { row: 4, col: 0 }, { row: 4, col: 2 }, { row: 5, col: 1 }],
    start: { row: 2, col: 2 }
  });
});

const START = ['1,1', '1,2', '1,3', '2,1', '2,2', '2,3', '3,1', '3,2', '3,3'];
const SAFE = () => ['0,0', '0,1', '0,3', '0,4', '0,5', '1,0', '1,1', '1,2', '1,3', '1,4', '1,5', '2,1', '2,2', '2,3', '2,5',
  '3,0', '3,1', '3,2', '3,3', '3,4', '3,5', '4,1', '4,3', '4,4', '4,5', '5,0', '5,2', '5,3', '5,4', '5,5'];
const cell = key => key.split(',').map(Number);
const opened = play => Object.keys(play.open).sort();

function taps(steps, play) {
  return steps.reduce((p, [key, tool]) => tapReveal(p, cell(key), BOARD, tool), play || newRevealPlay(BOARD));
}

// Every safe square opened in turn, skipping any already open.
function openAll(play) {
  return SAFE().reduce((p, key) => (p.open[key] ? p : tapReveal(p, cell(key), BOARD, 'open')), play || newRevealPlay(BOARD));
}

describe('a Reveal board', () => {
  it('plays by the Reveal rule from its start square; a board naming none plays by marking', () => {
    expect(BOARD).toMatchObject({ rule: 'reveal', start: '2,2', label: 'Reveal', cols: 6, rows: 6 });
    const { start, ...vanilla } = structuredClone(BIG_FILE);
    expect(minesBoard(vanilla)).toMatchObject({ rule: 'vanilla', start: '' });
    expect(minesBoard(structuredClone(BIG_FILE))).toMatchObject({ rule: 'reveal', start: '9,7' });
  });

  it('opens covered but for its start square, a 0, and every square it opens — nothing marked, nothing set off', () => {
    const play = newRevealPlay(BOARD);
    expect(opened(play)).toEqual(START);
    expect(play).toMatchObject({ marks: {}, boom: '', events: [] });
  });

  it('a 0 opens on and on through every 0 it reaches, and stops at the numbers round them', () => {
    expect(opened(newRevealPlay(minesBoard(structuredClone(BIG_FILE))))).toEqual(['8,6', '8,7', '8,8', '9,6', '9,7', '9,8']);
  });
});

describe('opening a square', () => {
  it('a covered number opens to show itself alone', () => {
    const play = taps([['0,3', 'open']]);
    expect(opened(play)).toEqual([...START, '0,3'].sort());
    expect(play.events).toEqual([]);
  });

  it('a covered 0 opens its neighbours, and on', () => {
    expect(opened(taps([['0,0', 'open']]))).toEqual([...START, '0,0', '0,1', '1,0'].sort());
    expect(opened(taps([['4,4', 'open']]))).toEqual([...START, '3,4', '3,5', '4,3', '4,4', '4,5', '5,3', '5,4', '5,5'].sort());
  });

  it('a marked square never opens with Open, and never opens as a 0 spreads round it', () => {
    expect(opened(taps([['0,3', 'mark'], ['0,3', 'open']]))).toEqual(START);
    const play = taps([['4,5', 'mark'], ['4,4', 'open']]);
    expect(play.open['4,5']).toBeUndefined();
    expect(play.open['5,5']).toBe(true);
    expect(play.marks).toEqual({ '4,5': 'mine' });
  });

  it('never changes the play it was given', () => {
    const before = newRevealPlay(BOARD);
    tapReveal(before, [0, 3], BOARD, 'open');
    expect(opened(before)).toEqual(START);
  });
});

describe('marking a mine', () => {
  it('with Mark mine picked, a tap marks a covered square, and again clears it', () => {
    expect(taps([['0,2', 'mark']])).toMatchObject({ marks: { '0,2': 'mine' }, events: [] });
    expect(taps([['0,2', 'mark'], ['0,2', 'mark']]).marks).toEqual({});
  });

  it('a right-click or a long press marks a covered square whichever is picked, and leaves an opened one alone', () => {
    const play = markReveal(newRevealPlay(BOARD), [0, 2], BOARD);
    expect(play).toMatchObject({ marks: { '0,2': 'mine' }, events: [] });
    expect(markReveal(play, [0, 2], BOARD).marks).toEqual({});
    expect(markReveal(play, [1, 1], BOARD).marks).toEqual({ '0,2': 'mine' });
  });

  it('counts on the Mines card, and Check finds a mark where there is no mine', () => {
    const play = taps([['0,2', 'mark'], ['0,3', 'mark']]);
    expect(minesCount(play, BOARD)).toBe('2/6');
    expect(minesMistakes(play, BOARD)).toEqual(['0,3']);
  });
});

describe('tapping an opened number', () => {
  it('opens its other covered squares once its mines are all marked, whichever is picked', () => {
    expect(opened(taps([['0,2', 'mark'], ['1,2', 'open']]))).toEqual([...START, '0,1', '0,3'].sort());
    expect(opened(taps([['0,2', 'mark'], ['1,2', 'mark']]))).toEqual([...START, '0,1', '0,3'].sort());
  });

  it('does nothing with fewer or more mines marked round it than it says', () => {
    expect(opened(taps([['1,2', 'open']]))).toEqual(START);
    expect(taps([['0,2', 'mark'], ['0,1', 'mark'], ['1,2', 'open']])).toMatchObject({ boom: '', events: [] });
    expect(opened(taps([['0,2', 'mark'], ['0,1', 'mark'], ['1,2', 'open']]))).toEqual(START);
  });

  it('carries a wrong mark in, so the mine it leaves goes off', () => {
    expect(taps([['0,1', 'mark'], ['1,2', 'open']])).toMatchObject({ boom: '0,2', events: ['kaboom'] });
  });
});

describe('opening a mine', () => {
  it('goes off: the mine is kept and nothing more opens', () => {
    const play = taps([['0,2', 'open']]);
    expect(play).toMatchObject({ boom: '0,2', events: ['kaboom'] });
    expect(opened(play)).toEqual(START);
  });

  it('the board then takes no taps, marks or openings', () => {
    const play = taps([['0,3', 'mark'], ['0,2', 'open']]);
    expect(tapReveal(play, [0, 0], BOARD, 'open')).toEqual({ open: play.open, marks: play.marks, boom: '0,2', events: [] });
    expect(tapReveal(play, [0, 4], BOARD, 'mark').marks).toEqual({ '0,3': 'mine' });
    expect(markReveal(play, [0, 4], BOARD).marks).toEqual({ '0,3': 'mine' });
  });

  it('starting again puts the board back to its start', () => {
    expect(newRevealPlay(BOARD)).toEqual({ open: newRevealPlay(BOARD).open, marks: {}, boom: '', events: [] });
  });
});

describe('the finish', () => {
  it('opening the last safe square finishes it and marks every mine left unmarked', () => {
    const last = openAll(taps([['0,2', 'mark']]));
    expect(revealFinished(last, BOARD)).toBe(true);
    expect(last.events).toEqual(['complete']);
    expect(last.marks).toEqual({ '0,2': 'mine', '2,0': 'mine', '2,4': 'mine', '4,0': 'mine', '4,2': 'mine', '5,1': 'mine' });
    expect(minesCount(last, BOARD)).toBe('6/6');
  });

  it('is not finished while a safe square is covered', () => {
    // (3,0) touches no 0, so nothing else opens it.
    const play = SAFE().filter(key => key !== '3,0').reduce((p, key) => (p.open[key] ? p : tapReveal(p, cell(key), BOARD, 'open')), newRevealPlay(BOARD));
    expect(revealFinished(play, BOARD)).toBe(false);
    expect(play.events).toEqual([]);
  });

  it('a finished board takes no taps', () => {
    const last = openAll();
    expect(tapReveal(last, [0, 2], BOARD, 'open')).toMatchObject({ boom: '', events: [] });
    expect(markReveal(last, [0, 2], BOARD).marks).toEqual(last.marks);
  });
});

describe('Undo', () => {
  it('a tap that changed a mark joins the history; an opening, or a tap that changed nothing, doesn\'t', () => {
    const play = newRevealPlay(BOARD);
    const marked = tapReveal(play, [0, 2], BOARD, 'mark');
    expect(revealTapped([], play, marked, [0, 2])).toEqual(['0,2']);
    expect(revealTapped(['1,0'], play, tapReveal(play, [0, 3], BOARD, 'open'), [0, 3])).toEqual(['1,0']);
    expect(revealTapped([], play, tapReveal(play, [1, 2], BOARD, 'open'), [1, 2])).toEqual([]);
  });

  it('takes the last mark off, and puts back a mark taken off, newest first', () => {
    const one = taps([['0,2', 'mark']]);
    const two = taps([['0,3', 'mark']], one);
    const undone = undoneReveal(['0,2', '0,3'], two);
    expect(undone.play.marks).toEqual({ '0,2': 'mine' });
    expect(undone.history).toEqual(['0,2']);
    const cleared = taps([['0,2', 'mark']], one);
    expect(undoneReveal(['0,2', '0,2'], cleared).play.marks).toEqual({ '0,2': 'mine' });
  });

  it('never undoes an opening: a square opened since is passed over', () => {
    // (0,3) marked, cleared, then opened: only (0,2)'s mark is left to take back.
    const play = taps([['0,2', 'mark'], ['0,3', 'mark'], ['0,3', 'mark'], ['0,3', 'open']]);
    const undone = undoneReveal(['0,2', '0,3', '0,3'], play);
    expect(undone.play.marks).toEqual({});
    expect(undone.play.open['0,3']).toBe(true);
    expect(undone.history).toEqual([]);
  });

  it('with nothing left to take back, the play is as it was', () => {
    const play = taps([['0,3', 'open']]);
    expect(undoneReveal(['0,3'], play)).toEqual({ play: { open: play.open, marks: {}, boom: '', events: [] }, history: [] });
  });

  it('greys out with no marks left to take back, once only openings are left, and once the game is over', () => {
    const play = taps([['0,3', 'mark']]);
    expect(canUndoReveal([], play, BOARD)).toBe(false);
    expect(canUndoReveal(['0,3'], play, BOARD)).toBe(true);
    expect(canUndoReveal(['0,3'], taps([['0,3', 'mark'], ['0,3', 'open']], play), BOARD)).toBe(false);
    expect(canUndoReveal(['0,3'], taps([['0,2', 'open']], play), BOARD)).toBe(false);
    expect(canUndoReveal(['0,3'], openAll(taps([['0,3', 'mark']], play)), BOARD)).toBe(false);
  });
});

describe('what each square shows', () => {
  const at = (squares, key) => squares.find(s => s.key === key);

  it('covered squares show nothing, opened ones their number — a 0 nothing — and each says what it is', () => {
    const squares = revealSquares(newRevealPlay(BOARD), BOARD);
    expect(squares).toHaveLength(36);
    expect(squares[0]).toEqual({ key: '0,0', cover: 'covered', mark: 'blank', number: '', state: '', checked: '', label: 'Row 1, column 1, covered' });
    expect(at(squares, '1,2')).toEqual({ key: '1,2', cover: 'open', mark: 'number', number: '1', state: '', checked: '', label: 'Row 2, column 3, 1' });
    expect(at(squares, '2,2')).toEqual({ key: '2,2', cover: 'open', mark: 'number', number: '', state: '', checked: '', label: 'Row 3, column 3, 0' });
  });

  it('a marked square shows its mark, and a number fades once its mines are marked and turns red past it', () => {
    const one = revealSquares(taps([['0,2', 'mark']]), BOARD);
    expect(at(one, '0,2')).toMatchObject({ cover: 'covered', mark: 'mine', number: '', state: '', label: 'Row 1, column 3, marked mine' });
    expect(at(one, '1,2').state).toBe('met');
    expect(at(revealSquares(taps([['0,2', 'mark'], ['0,1', 'mark']]), BOARD), '1,2').state).toBe('over');
  });

  it('after a kaboom: the mine that went off, every other mine shown, a right mark kept, and a wrong mark proved wrong', () => {
    const squares = revealSquares(taps([['2,0', 'mark'], ['0,3', 'mark'], ['0,2', 'open']]), BOARD);
    expect(at(squares, '0,2')).toMatchObject({ cover: 'open', mark: 'mine', state: 'boom', checked: '', label: 'Row 1, column 3, mine, opened' });
    expect(at(squares, '4,2')).toMatchObject({ cover: 'open', mark: 'mine', state: 'shown', checked: '', label: 'Row 5, column 3, mine' });
    expect(at(squares, '2,0')).toMatchObject({ cover: 'covered', mark: 'mine', state: '', checked: '' });
    expect(at(squares, '0,3')).toMatchObject({ cover: 'covered', mark: 'mine', checked: 'wrong' });
    expect(at(squares, '0,0')).toMatchObject({ cover: 'covered', mark: 'blank', checked: '' });
    expect(squares.filter(s => s.mark === 'mine')).toHaveLength(7);
  });

  it('no mark is proved wrong, nor a mine shown, before a kaboom', () => {
    const squares = revealSquares(taps([['0,3', 'mark']]), BOARD);
    expect(squares.filter(s => s.checked === 'wrong')).toEqual([]);
    expect(squares.filter(s => s.mark === 'mine').map(s => s.key)).toEqual(['0,3']);
  });

  it('finished, every mine shows marked', () => {
    const squares = revealSquares(openAll(), BOARD);
    expect(squares.filter(s => s.mark === 'mine').map(s => s.key)).toEqual(BOARD.mines);
    expect(squares.filter(s => s.cover === 'covered')).toHaveLength(6);
  });
});
