import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { minesBoard, minesMistakes, minesCount, answerSquares, keyHiddenAt } from '../../../core/minesweeper/play-core.js';
import {
  newRevealPlay, revealFinished, tapReveal, otherTool, revealTapped, undoneReveal, canUndoReveal, revealSquares, keysFound,
  marksLifted, revealCount, flagSlots, canariesLeft, canarySlots
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
const BOARD_FILE = () => ({
  hiddenId: 'MINE-0002', type: 'Reveal', created: '2026-10-14', title: 'Reveal 001', difficulty: 'Medium', width: 6, height: 6,
  numbersPerStep: 3, numbers: ['01.100', '121211', '.101.1', '231211', '.3.100', '2.2100'],
  mines: [{ row: 0, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 4 }, { row: 4, col: 0 }, { row: 4, col: 2 }, { row: 5, col: 1 }],
  start: { row: 2, col: 2 }
});
beforeEach(() => {
  BOARD = minesBoard(BOARD_FILE());
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
    // A marked mine tapped with Open never goes off.
    expect(taps([['0,2', 'mark'], ['0,2', 'open']])).toEqual({ open: newRevealPlay(BOARD).open, marks: { '0,2': 'mine' }, blown: {}, boom: '', events: [] });
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

});

// A right-click or a long press taps with the tool that isn't picked (the product's TASK-197).
describe('a right-click or a long press', () => {
  it('is the other tool: Mark mine with Open picked, Open with Mark mine picked', () => {
    expect(otherTool('open')).toBe('mark');
    expect(otherTool('mark')).toBe('open');
  });

  it('with Open picked, marks a covered square, and again clears it', () => {
    const play = taps([['0,2', otherTool('open')]]);
    expect(play).toMatchObject({ marks: { '0,2': 'mine' }, boom: '', events: [] });
    expect(taps([['0,2', otherTool('open')]], play).marks).toEqual({});
  });

  it('with Mark mine picked, opens a covered square — a mine goes off — and leaves a marked one shut', () => {
    expect(opened(taps([['0,3', otherTool('mark')]]))).toEqual([...START, '0,3'].sort());
    expect(taps([['0,2', otherTool('mark')]])).toMatchObject({ boom: '0,2', events: ['kaboom'] });
    expect(taps([['0,3', 'mark'], ['0,3', otherTool('mark')]])).toMatchObject({ marks: { '0,3': 'mine' }, boom: '' });
    expect(opened(taps([['0,3', 'mark'], ['0,3', otherTool('mark')]]))).toEqual(START);
  });

  it('on an opened number whose mines are all marked, opens the rest round it, whichever is picked', () => {
    expect(opened(taps([['0,2', 'mark'], ['1,2', otherTool('open')]]))).toEqual([...START, '0,1', '0,3'].sort());
    expect(opened(taps([['0,2', 'mark'], ['1,2', otherTool('mark')]]))).toEqual([...START, '0,1', '0,3'].sort());
  });

});

describe('the Mines card', () => {
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
    expect(tapReveal(play, [0, 0], BOARD, 'open')).toEqual({ open: play.open, marks: play.marks, blown: {}, boom: '0,2', events: [] });
    expect(tapReveal(play, [0, 4], BOARD, 'mark').marks).toEqual({ '0,3': 'mine' });
  });

  it('starting again puts the board back to its start', () => {
    expect(newRevealPlay(BOARD)).toEqual({ open: newRevealPlay(BOARD).open, marks: {}, blown: {}, boom: '', events: [] });
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
    expect(tapReveal(last, [0, 2], BOARD, 'mark').marks).toEqual(last.marks);
  });
});

// Each tap played as the page plays it, its history kept as the page keeps it.
function played(steps, board = BOARD) {
  return steps.reduce(({ play, history }, [key, tool]) => {
    const next = tapReveal(play, cell(key), board, tool);
    return { play: next, history: revealTapped(history, play, next) };
  }, { play: newRevealPlay(board), history: [] });
}

const undoAll = ({ play, history }) => (canUndoReveal(history, play, BOARD) ? undoAll(undoneReveal(history, play)) : { play, history });

describe('Undo', () => {
  it('a tap that changed a mark joins the history as the marks before it; an opening, or a tap that changed nothing, doesn\'t', () => {
    const play = newRevealPlay(BOARD);
    const marked = tapReveal(play, [0, 2], BOARD, 'mark');
    expect(revealTapped([], play, marked)).toEqual([{}]);
    expect(revealTapped([{}], marked, tapReveal(marked, [0, 3], BOARD, 'mark'))).toEqual([{}, { '0,2': 'mine' }]);
    expect(revealTapped([{}], play, tapReveal(play, [0, 3], BOARD, 'open'))).toEqual([{}]);
    expect(revealTapped([], play, tapReveal(play, [1, 2], BOARD, 'open'))).toEqual([]);
  });

  it('takes the last mark off, and puts back a mark taken off, newest first', () => {
    const two = played([['0,2', 'mark'], ['0,3', 'mark']]);
    const undone = undoneReveal(two.history, two.play);
    expect(undone.play.marks).toEqual({ '0,2': 'mine' });
    expect(undone.history).toEqual([{}]);
    const cleared = played([['0,2', 'mark'], ['0,2', 'mark']]);
    expect(undoneReveal(cleared.history, cleared.play).play.marks).toEqual({ '0,2': 'mine' });
  });

  it('puts a mark taken off back where it was in the order placed', () => {
    const { play, history } = played([['0,2', 'mark'], ['0,3', 'mark'], ['0,2', 'mark']]);
    expect(Object.keys(play.marks)).toEqual(['0,3']);
    expect(Object.keys(undoneReveal(history, play).play.marks)).toEqual(['0,2', '0,3']);
  });

  it('never undoes an opening: a square opened since is passed over', () => {
    // (0,3) marked, cleared, then opened: only (0,2)'s mark is left to take back.
    const { play, history } = played([['0,2', 'mark'], ['0,3', 'mark'], ['0,3', 'mark'], ['0,3', 'open']]);
    const undone = undoneReveal(history, play);
    expect(undone.play.marks).toEqual({});
    expect(undone.play.open['0,3']).toBe(true);
    expect(undone.history).toEqual([]);
  });

  it('passes over a mark cleared from a square opened since, to the mark placed before it', () => {
    // (0,3) and (0,4) marked, (0,3) cleared then opened: Undo takes (0,4)'s mark off, then greys.
    const { play, history } = played([['0,3', 'mark'], ['0,4', 'mark'], ['0,3', 'mark'], ['0,3', 'open']]);
    const undone = undoneReveal(history, play);
    expect(undone.play.marks).toEqual({});
    expect(undone.history).toEqual([{}]);
    expect(canUndoReveal(undone.history, undone.play, BOARD)).toBe(false);
    expect(undoAll({ play, history }).play.marks).toEqual({});
  });

  it('with nothing left to take back, the play is as it was', () => {
    const play = taps([['0,3', 'open']]);
    expect(undoneReveal([{ '0,3': 'mine' }], play)).toEqual({ play: { open: play.open, marks: {}, blown: {}, boom: '', events: [] }, history: [] });
    expect(undoneReveal([], play)).toEqual({ play: { open: play.open, marks: {}, blown: {}, boom: '', events: [] }, history: [] });
    // Undo never takes back a kaboom.
    expect(undoneReveal([{}], taps([['0,3', 'mark'], ['0,2', 'open']])).play.boom).toBe('0,2');
  });

  it('greys out with no marks left to take back, once only openings are left, and once the game is over', () => {
    const { play, history } = played([['0,3', 'mark']]);
    expect(canUndoReveal([], play, BOARD)).toBe(false);
    expect(canUndoReveal(history, play, BOARD)).toBe(true);
    const opened = played([['0,3', 'mark'], ['0,3', 'mark'], ['0,3', 'open']]);
    expect(canUndoReveal(opened.history, opened.play, BOARD)).toBe(false);
    expect(canUndoReveal(history, taps([['0,2', 'open']], play), BOARD)).toBe(false);
    expect(canUndoReveal(history, openAll(taps([['0,3', 'mark']], play)), BOARD)).toBe(false);
  });
});

// A Limited Flags board (the product's TASK-179): the same 6×6 Reveal board, with a flag limit of 2.
describe('a Limited Flags board', () => {
  let LIMITED;
  beforeEach(() => {
    LIMITED = minesBoard({ ...BOARD_FILE(), type: 'Limited Flags', title: 'Limited Flags 001', flagLimit: 2 });
  });
  const limitedTaps = steps => played(steps, LIMITED).play;

  it('reads its flag limit from its file; any other board has none', () => {
    expect(LIMITED).toMatchObject({ rule: 'reveal', limited: true, flagLimit: 2 });
    expect(BOARD).toMatchObject({ limited: false, flagLimit: 0 });
  });

  it('the Mines card reads the flags left: down one for each mark, back up for each taken off', () => {
    expect(revealCount(newRevealPlay(LIMITED), LIMITED)).toBe('Flags left 2');
    expect(revealCount(limitedTaps([['0,2', 'mark']]), LIMITED)).toBe('Flags left 1');
    expect(revealCount(limitedTaps([['0,2', 'mark'], ['0,3', 'mark']]), LIMITED)).toBe('Flags left 0');
    expect(revealCount(limitedTaps([['0,2', 'mark'], ['0,3', 'mark'], ['0,2', 'mark']]), LIMITED)).toBe('Flags left 1');
    // Any other Reveal board counts mines marked of its mines.
    expect(revealCount(taps([['0,2', 'mark']]), BOARD)).toBe('1/6');
  });

  it('the row of flags has a box per flag, the flags left full first, the used ones empty', () => {
    expect(flagSlots(newRevealPlay(LIMITED), LIMITED)).toEqual([true, true]);
    expect(flagSlots(limitedTaps([['0,2', 'mark']]), LIMITED)).toEqual([true, false]);
    expect(flagSlots(limitedTaps([['0,2', 'mark'], ['0,3', 'mark'], ['0,4', 'mark']]), LIMITED)).toEqual([false, false]);
    expect(flagSlots(limitedTaps([['0,2', 'mark'], ['0,3', 'mark'], ['0,2', 'mark']]), LIMITED)).toEqual([true, false]);
    // Any other Reveal board has none.
    expect(flagSlots(taps([['0,2', 'mark']]), BOARD)).toEqual([]);
  });

  it('marks up to its limit as any Reveal board does, nothing moved', () => {
    const play = limitedTaps([['0,2', 'mark'], ['0,3', 'mark']]);
    expect(play.marks).toEqual({ '0,2': 'mine', '0,3': 'mine' });
    expect(play.events).toEqual([]);
  });

  it('with no flags left, a new mark takes the oldest one\'s place, and says it moved', () => {
    const play = limitedTaps([['0,2', 'mark'], ['0,3', 'mark'], ['0,4', 'mark']]);
    expect(Object.keys(play.marks)).toEqual(['0,3', '0,4']);
    expect(play.events).toEqual(['moved']);
    expect(revealCount(play, LIMITED)).toBe('Flags left 0');
    expect(marksLifted(limitedTaps([['0,2', 'mark'], ['0,3', 'mark']]), play)).toEqual(['0,2']);
    // First in, first out: the next takes (0,3)'s.
    expect(Object.keys(limitedTaps([['0,2', 'mark'], ['0,3', 'mark'], ['0,4', 'mark'], ['0,5', 'mark']]).marks)).toEqual(['0,4', '0,5']);
  });

  it('a mark taken off and put back is the newest, so it is the last to move', () => {
    const play = limitedTaps([['0,2', 'mark'], ['0,3', 'mark'], ['0,2', 'mark'], ['0,2', 'mark'], ['0,4', 'mark']]);
    expect(Object.keys(play.marks)).toEqual(['0,2', '0,4']);
  });

  it('taking a mark off frees its flag and moves nothing', () => {
    const play = limitedTaps([['0,2', 'mark'], ['0,3', 'mark'], ['0,3', 'mark']]);
    expect(play).toMatchObject({ marks: { '0,2': 'mine' }, events: [] });
  });

  it('Undo after a move takes the new mark off and puts the oldest back where it was, the oldest still', () => {
    const moved = played([['0,2', 'mark'], ['0,3', 'mark'], ['0,4', 'mark']], LIMITED);
    const undone = undoneReveal(moved.history, moved.play);
    expect(Object.keys(undone.play.marks)).toEqual(['0,2', '0,3']);
    expect(revealCount(undone.play, LIMITED)).toBe('Flags left 0');
    expect(Object.keys(tapReveal(undone.play, [0, 5], LIMITED, 'mark').marks)).toEqual(['0,3', '0,5']);
  });

  it('the finish marks every mine, the flags left never under none', () => {
    const last = SAFE().reduce((p, key) => (p.open[key] ? p : tapReveal(p, cell(key), LIMITED, 'open')), limitedTaps([['0,2', 'mark']]));
    expect(last.events).toEqual(['complete']);
    expect(Object.keys(last.marks)).toHaveLength(6);
    expect(revealCount(last, LIMITED)).toBe('Flags left 0');
    expect(flagSlots(last, LIMITED)).toEqual([false, false]);
  });
});

describe('what each square shows', () => {
  const at = (squares, key) => squares.find(s => s.key === key);

  it('covered squares show nothing, opened ones their number — a 0 nothing — and each says what it is', () => {
    const squares = revealSquares(newRevealPlay(BOARD), BOARD);
    expect(squares).toHaveLength(36);
    expect(squares[0]).toEqual({ key: '0,0', cover: 'covered', mark: 'blank', number: '', state: '', zone: '', lock: '', found: '', checked: '', label: 'Row 1, column 1, covered' });
    expect(at(squares, '1,2')).toEqual({ key: '1,2', cover: 'open', mark: 'number', number: '1', state: '', zone: '', lock: '', found: '', checked: '', label: 'Row 2, column 3, 1' });
    expect(at(squares, '2,2')).toEqual({ key: '2,2', cover: 'open', mark: 'number', number: '', state: '', zone: '', lock: '', found: '', checked: '', label: 'Row 3, column 3, 0' });
  });

  it('a marked square shows its mark', () => {
    const one = revealSquares(taps([['0,2', 'mark']]), BOARD);
    expect(at(one, '0,2')).toEqual({ key: '0,2', cover: 'covered', mark: 'mine', number: '', state: '', zone: '', lock: '', found: '', checked: '', label: 'Row 1, column 3, marked mine' });
  });

  // Spotting a met number is the player's, and Check finds the mistakes (the product's TASK-193).
  it('an opened number shows the same however many mines are marked round it — none, as many, too many', () => {
    const looks = [[], [['0,2', 'mark']], [['0,2', 'mark'], ['0,1', 'mark']]].map(steps => at(revealSquares(taps(steps), BOARD), '1,2'));
    looks.forEach(look => expect(look).toEqual({ key: '1,2', cover: 'open', mark: 'number', number: '1', state: '', zone: '', lock: '', found: '', checked: '', label: 'Row 2, column 3, 1' }));
  });

  it('after a kaboom: the mine that went off, every other mine shown, a right mark kept, and a wrong mark proved wrong', () => {
    const squares = revealSquares(taps([['2,0', 'mark'], ['0,3', 'mark'], ['0,2', 'open']]), BOARD);
    expect(at(squares, '0,2')).toMatchObject({ cover: 'open', mark: 'mine', number: '', state: 'boom', lock: '', found: '', checked: '', label: 'Row 1, column 3, mine, opened' });
    expect(at(squares, '4,2')).toMatchObject({ cover: 'open', mark: 'mine', number: '', state: 'shown', lock: '', found: '', checked: '', label: 'Row 5, column 3, mine' });
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

// ---- A Keys board (the product's TASK-177) ----
// The same board as tooling's own valid Keys board (its fixtures/minesweeper/keys-valid.json):
// Zone 1 the 0s at the bottom right, (4,4) (4,5) (5,4) (5,5), its key hidden on (5,0) — itself
// Zone 2, whose key hides on the 0 at (0,5), outside every zone. So Zone 2's key opens Zone 2,
// whose square holds Zone 1's key.
//   0 1 * 1 0 0       . . . . . 2k
//   1 2 1 2 1 1       . . . . . .
//   * 1 0 1 * 1       . . . . . .
//   2 3 1 2 1 1       . . . . . .
//   * 3 * 1 0 0       . . . . 1 1
//   2 * 2 1 0 0      2/1k . . . 1 1
function keysBoard(zones, keys) {
  return minesBoard({
    hiddenId: 'MINE-0903', type: 'Keys', created: '2026-10-14', title: 'Keys 001', difficulty: 'Easy', width: 6, height: 6,
    numbersPerStep: 3, numbers: ['01.100', '121211', '.101.1', '231211', '.3.100', '2.2100'],
    mines: [{ row: 0, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 4 }, { row: 4, col: 0 }, { row: 4, col: 2 }, { row: 5, col: 1 }],
    start: { row: 2, col: 2 },
    zones: zones || ['......', '......', '......', '......', '....11', '2...11'],
    keys: keys || [{ key: 1, row: 5, col: 0 }, { key: 2, row: 0, col: 5 }]
  });
}

function keyTaps(board, steps, play) {
  return steps.reduce((p, [key, tool]) => tapReveal(p, cell(key), board, tool), play || newRevealPlay(board));
}

describe('a Keys board', () => {
  it('reads its zones, square by square, and where each zone\'s key hides; any other board has neither', () => {
    expect(keysBoard()).toMatchObject({
      rule: 'reveal', keyed: true,
      zones: { '4,4': '1', '4,5': '1', '5,4': '1', '5,5': '1', '5,0': '2' },
      keys: { 1: '5,0', 2: '0,5' }
    });
    expect(Object.keys(keysBoard().zones)).toHaveLength(5);
    expect(BOARD.zones).toEqual({});
    expect(BOARD.keys).toEqual({});
    expect(BOARD.keyed).toBe(false);
  });

  it('knows the zone whose key hides on a square, and none on any other', () => {
    expect(keyHiddenAt('0,5', keysBoard())).toBe('2');
    expect(keyHiddenAt('5,0', keysBoard())).toBe('1');
    expect(keyHiddenAt('0,4', keysBoard())).toBe('');
    expect(keyHiddenAt('0,5', BOARD)).toBe('');
  });

  it('a padlocked square tapped, with Open or Mark mine, neither opens nor takes a mark, and says it\'s locked', () => {
    const board = keysBoard();
    const play = newRevealPlay(board);
    ['open', 'mark'].forEach(tool => {
      expect(tapReveal(play, [5, 0], board, tool)).toEqual({ open: play.open, marks: {}, blown: {}, boom: '', events: ['locked'] });
      expect(tapReveal(play, [4, 4], board, tool)).toEqual({ open: play.open, marks: {}, blown: {}, boom: '', events: ['locked'] });
    });
  });

  it('opening a key\'s square unlocks its zone, and a key inside a zone unlocks the next once that zone is open', () => {
    const board = keysBoard();
    const two = keyTaps(board, [['0,5', 'open']]);
    expect(two.open['0,5']).toBe(true);
    expect(two.events).toEqual([]);
    // Zone 2 open, Zone 1 still shut.
    expect(keyTaps(board, [['4,4', 'open']], two).events).toEqual(['locked']);
    const one = keyTaps(board, [['5,0', 'open']], two);
    expect(one).toMatchObject({ boom: '', events: [] });
    expect(one.open['5,0']).toBe(true);
    expect(opened(keyTaps(board, [['4,4', 'open']], one))).toEqual(expect.arrayContaining(['4,4', '4,5', '5,4', '5,5']));
    // Unlocked, it takes a mark as any covered square does.
    expect(keyTaps(board, [['4,4', 'mark']], one).marks).toEqual({ '4,4': 'mine' });
  });

  it('a 0 opening round it never reaches a padlocked square, and does once its zone is unlocked', () => {
    // Zone 1 is (4,5) and (5,5), its key on (0,0).
    const board = keysBoard(['......', '......', '......', '......', '.....1', '.....1'], [{ key: 1, row: 0, col: 0 }]);
    const shut = keyTaps(board, [['4,4', 'open']]);
    expect(shut.open['5,4']).toBe(true);
    expect(shut.open['4,5']).toBeUndefined();
    expect(shut.open['5,5']).toBeUndefined();
    const open = keyTaps(board, [['0,0', 'open'], ['4,4', 'open']]);
    expect(open.open['4,5']).toBe(true);
    expect(open.open['5,5']).toBe(true);
  });

  it('a key turned up by a 0 opening drops its zone\'s padlocks, but opens none of its squares', () => {
    // Zone 1 is (4,5) and (5,5), its key on the 0 at (5,4), which (4,4)'s opening reaches.
    const board = keysBoard(['......', '......', '......', '......', '.....1', '.....1'], [{ key: 1, row: 5, col: 4 }]);
    const play = keyTaps(board, [['4,4', 'open']]);
    expect(play.open['5,4']).toBe(true);
    expect(play.open['4,5']).toBeUndefined();
    expect(keyTaps(board, [['4,5', 'open']], play).open['4,5']).toBe(true);
  });

  it('a met number opens only its unlocked squares, and opens into its zone once it\'s unlocked', () => {
    const board = keysBoard();
    // (4,3) is a 1 whose mine is (4,2); (4,4) and (5,4) round it are Zone 1's.
    const shut = keyTaps(board, [['4,3', 'open'], ['4,2', 'mark'], ['4,3', 'open']]);
    expect(shut.open).toMatchObject({ '3,4': true, '5,2': true, '5,3': true });
    expect(shut.open['4,4']).toBeUndefined();
    expect(shut.open['5,4']).toBeUndefined();
    const open = keyTaps(board, [['0,5', 'open'], ['5,0', 'open'], ['4,3', 'open'], ['4,2', 'mark'], ['4,3', 'open']]);
    expect(open.open).toMatchObject({ '4,4': true, '5,4': true, '5,5': true });
  });

  it('a mine padlocked round a number met by a wrong mark never goes off', () => {
    // (1,3) is a 2, its mines (0,2) and (2,4) — (2,4) padlocked in Zone 1, its key on (0,0).
    const board = keysBoard(['......', '......', '....1.', '......', '......', '......'], [{ key: 1, row: 0, col: 0 }]);
    const play = keyTaps(board, [['0,2', 'mark'], ['0,3', 'mark'], ['1,3', 'open']]);
    expect(play).toMatchObject({ boom: '', events: [] });
    expect(play.open).toMatchObject({ '0,4': true, '1,4': true });
    expect(keyTaps(board, [['0,0', 'open'], ['0,2', 'mark'], ['0,3', 'mark'], ['1,3', 'open']])).toMatchObject({ boom: '2,4', events: ['kaboom'] });
  });

  it('finishes once every safe square is open, zones and all', () => {
    const board = keysBoard();
    const order = ['0,5', '5,0', ...SAFE()];
    const last = order.reduce((p, key) => (p.open[key] ? p : tapReveal(p, cell(key), board, 'open')), newRevealPlay(board));
    expect(revealFinished(last, board)).toBe(true);
    expect(last.events).toEqual(['complete']);
  });

  it('starting again padlocks every zone again', () => {
    const board = keysBoard();
    expect(newRevealPlay(board).open['0,5']).toBeUndefined();
    expect(keyTaps(board, [['5,0', 'open']]).events).toEqual(['locked']);
  });
});

describe('the keys a tap turns up', () => {
  it('each key whose square the tap opened, with its zone\'s squares to drop the padlocks on', () => {
    const board = keysBoard();
    const start = newRevealPlay(board);
    const two = keyTaps(board, [['0,5', 'open']]);
    expect(keysFound(start, two, board)).toEqual([{ square: '0,5', unlocked: ['5,0'] }]);
    expect(keysFound(two, keyTaps(board, [['5,0', 'open']], two), board)).toEqual([{ square: '5,0', unlocked: ['4,4', '4,5', '5,4', '5,5'] }]);
  });

  it('none on a tap that opened no key\'s square, a key found before, or a kaboom', () => {
    const board = keysBoard();
    const start = newRevealPlay(board);
    const two = keyTaps(board, [['0,5', 'open']]);
    expect(keysFound(start, keyTaps(board, [['0,3', 'open']]), board)).toEqual([]);
    expect(keysFound(two, keyTaps(board, [['0,3', 'open']], two), board)).toEqual([]);
    expect(keysFound(start, keyTaps(board, [['0,2', 'open']]), board)).toEqual([]);
    expect(keysFound(start, two, BOARD)).toEqual([]);
  });
});

describe('what a Keys board\'s squares show', () => {
  const at = (squares, key) => squares.find(s => s.key === key);

  it('a padlocked square wears its zone\'s padlock and says so; every key stays hidden until its square opens', () => {
    const board = keysBoard();
    const squares = revealSquares(newRevealPlay(board), board);
    expect(at(squares, '4,4')).toEqual({ key: '4,4', cover: 'covered', mark: 'blank', number: '', state: '', zone: '1', lock: '1', found: '', checked: '', label: 'Row 5, column 5, padlocked, zone 1' });
    expect(at(squares, '5,0')).toMatchObject({ zone: '2', lock: '2', found: '', label: 'Row 6, column 1, padlocked, zone 2' });
    expect(at(squares, '0,5')).toEqual({ key: '0,5', cover: 'covered', mark: 'blank', number: '', state: '', zone: '', lock: '', found: '', checked: '', label: 'Row 1, column 6, covered' });
    expect(squares.filter(s => s.found !== '')).toEqual([]);
  });

  it('a key found sits on its square beside its number, and its zone\'s padlocks are gone', () => {
    const board = keysBoard();
    const two = keyTaps(board, [['0,5', 'open']]);
    const squares = revealSquares(two, board);
    expect(at(squares, '0,5')).toEqual({ key: '0,5', cover: 'open', mark: 'number', number: '', state: '', zone: '', lock: '', found: '2', checked: '', label: 'Row 1, column 6, 0, key 2 found' });
    expect(at(squares, '5,0')).toMatchObject({ cover: 'covered', zone: '2', lock: '', label: 'Row 6, column 1, covered' });
    expect(at(squares, '4,4')).toMatchObject({ lock: '1' });
    const one = revealSquares(keyTaps(board, [['5,0', 'open']], two), board);
    expect(at(one, '5,0')).toMatchObject({ cover: 'open', number: '2', zone: '2', lock: '', found: '1', label: 'Row 6, column 1, 2, key 1 found' });
    expect(one.filter(s => s.lock !== '')).toEqual([]);
  });

  it('a kaboom shows a padlocked mine as a mine, its padlock gone', () => {
    const board = keysBoard(['......', '......', '....1.', '......', '......', '......'], [{ key: 1, row: 0, col: 0 }]);
    const squares = revealSquares(keyTaps(board, [['0,2', 'open']]), board);
    expect(at(squares, '2,4')).toMatchObject({ cover: 'open', mark: 'mine', state: 'shown', zone: '1', lock: '', found: '' });  });

  it('the answer side shows every key where it hid', () => {
    const board = keysBoard();
    const keys = answerSquares(board).filter(s => s.found !== '').map(s => [s.key, s.found]);
    expect(keys).toEqual([['0,5', '2'], ['5,0', '1']]);
    expect(answerSquares(BOARD).filter(s => s.found !== '')).toEqual([]);
  });
});

// ---- A Canaries board (the product's TASK-203) ----
// Tooling's own valid Canaries board (its fixtures/minesweeper/canaries-valid.json), 6×6, seven
// mines, two canaries, starting on the 0 at row 5, col 5:
//   1 2 2 2 * 1
//   1 * * 4 2 2
//   1 3 * 3 * 1
//   1 2 1 2 1 1
//   * 2 1 0 0 0
//   2 * 1 0 0 0
const CANARIES_FILE = require('../../fixtures/MINE-0905.json');

describe('a Canaries board', () => {
  let CANARIES;
  beforeEach(() => {
    CANARIES = minesBoard(structuredClone(CANARIES_FILE));
  });
  const canaryTaps = (steps, play) => steps.reduce((p, [key, tool]) => tapReveal(p, cell(key), CANARIES, tool), play || newRevealPlay(CANARIES));
  const MINES = ['0,4', '1,1', '1,2', '2,2', '2,4', '4,0', '5,1'];
  const openEvery = play => Array.from({ length: 36 }, (_, i) => Math.floor(i / 6) + ',' + (i % 6))
    .filter(key => !MINES.includes(key))
    .reduce((p, key) => (p.open[key] ? p : tapReveal(p, cell(key), CANARIES, 'open')), play);

  it('reads its canaries from its file; any other board has none', () => {
    expect(CANARIES).toMatchObject({ rule: 'reveal', canaried: true, canaries: 2, limited: false });
    expect(BOARD).toMatchObject({ canaried: false, canaries: 0 });
  });

  it('the Mines card reads the canaries left: the file\'s count to start', () => {
    expect(revealCount(newRevealPlay(CANARIES), CANARIES)).toBe('Canaries 2');
    expect(canariesLeft(newRevealPlay(CANARIES), CANARIES)).toBe(2);
  });

  it('the row of canaries has a box per canary, the canaries left full first, the lost ones empty', () => {
    expect(canarySlots(newRevealPlay(CANARIES), CANARIES)).toEqual([true, true]);
    expect(canarySlots(canaryTaps([['3,1', 'canary']]), CANARIES)).toEqual([true, true]);
    expect(canarySlots(canaryTaps([['4,0', 'canary']]), CANARIES)).toEqual([true, false]);
    expect(canarySlots(canaryTaps([['4,0', 'canary'], ['5,1', 'canary']]), CANARIES)).toEqual([false, false]);
    // Any other board has none.
    expect(canarySlots(newRevealPlay(BOARD), BOARD)).toEqual([]);
  });

  it('a canary on a safe square opens it as Open would, and survives', () => {
    const play = canaryTaps([['3,1', 'canary']]);
    expect(play.open['3,1']).toBe(true);
    expect(play).toMatchObject({ blown: {}, boom: '', events: [] });
    expect(revealCount(play, CANARIES)).toBe('Canaries 2');
    expect(play).toEqual(canaryTaps([['3,1', 'open']]));
  });

  it('a canary on a mine is lost, not the game: the mine shows, nothing opens, and play goes on', () => {
    const start = newRevealPlay(CANARIES);
    const play = canaryTaps([['4,0', 'canary']]);
    expect(play).toEqual({ open: start.open, marks: {}, blown: { '4,0': true }, boom: '', events: [] });
    expect(revealCount(play, CANARIES)).toBe('Canaries 1');
    expect(canaryTaps([['3,1', 'open']], play).open['3,1']).toBe(true);
  });

  it('with no canaries left, a canary tap does nothing', () => {
    const none = canaryTaps([['4,0', 'canary'], ['5,1', 'canary']]);
    expect(canariesLeft(none, CANARIES)).toBe(0);
    expect(revealCount(none, CANARIES)).toBe('Canaries 0');
    expect(canaryTaps([['2,2', 'canary']], none)).toEqual({ ...none, events: [] });
    expect(canaryTaps([['3,1', 'canary']], none).open['3,1']).toBeUndefined();
    // A board with no canaries never sends one.
    expect(tapReveal(newRevealPlay(BOARD), [0, 2], BOARD, 'canary')).toMatchObject({ blown: {}, boom: '' });
  });

  it('a canary never opens a marked square, nor goes where one was lost', () => {
    const marked = canaryTaps([['4,0', 'mark'], ['4,0', 'canary']]);
    expect(marked).toMatchObject({ marks: { '4,0': 'mine' }, blown: {} });
    const lost = canaryTaps([['4,0', 'canary'], ['4,0', 'canary']]);
    expect(canariesLeft(lost, CANARIES)).toBe(1);
  });

  it('a canary\'s mine can\'t be marked, unmarked or opened', () => {
    const lost = canaryTaps([['4,0', 'canary']]);
    expect(canaryTaps([['4,0', 'mark']], lost)).toEqual({ ...lost, events: [] });
    expect(canaryTaps([['4,0', 'open']], lost)).toEqual({ ...lost, events: [] });
  });

  it('Open on a mine is still Kaboom!, canaries left or not', () => {
    expect(canaryTaps([['4,0', 'open']])).toMatchObject({ boom: '4,0', events: ['kaboom'] });
    expect(canaryTaps([['4,0', 'canary'], ['5,1', 'open']])).toMatchObject({ boom: '5,1', blown: { '4,0': true }, events: ['kaboom'] });
  });

  it('a canary\'s mine counts toward a number\'s mines, and is never opened by it', () => {
    // (5,2) is a 1, its one mine (5,1): met once a canary finds it, it opens (4,1).
    expect(canaryTaps([['5,2', 'open']]).open['4,1']).toBeUndefined();
    const play = canaryTaps([['5,1', 'canary'], ['5,2', 'open']]);
    expect(play).toMatchObject({ boom: '', events: [] });
    expect(play.open['4,1']).toBe(true);
  });

  it('a canary tapped on an opened number opens round it as either tool does, and is kept', () => {
    const play = canaryTaps([['5,1', 'mark'], ['5,2', 'canary']]);
    expect(play.open['4,1']).toBe(true);
    expect(canariesLeft(play, CANARIES)).toBe(2);
  });

  it('Undo takes back marks only: a canary used stays used', () => {
    const { play, history } = played([['3,1', 'mark'], ['4,0', 'canary']], CANARIES);
    expect(history).toEqual([{}]);
    const undone = undoneReveal(history, play);
    expect(undone.play).toMatchObject({ marks: {}, blown: { '4,0': true } });
    expect(revealCount(undone.play, CANARIES)).toBe('Canaries 1');
  });

  it('opening every safe square finishes it, however many canaries were lost', () => {
    const last = openEvery(canaryTaps([['4,0', 'canary'], ['5,1', 'canary']]));
    expect(revealFinished(last, CANARIES)).toBe(true);
    expect(last.events).toEqual(['complete']);
    expect(revealCount(last, CANARIES)).toBe('Canaries 0');
  });

  it('starting again gives every canary back', () => {
    expect(revealCount(newRevealPlay(CANARIES), CANARIES)).toBe('Canaries 2');
  });

  it('a canary\'s mine shows as a mine on the board, for good, and says a canary found it', () => {
    const at = (squares, key) => squares.find(s => s.key === key);
    const lost = canaryTaps([['4,0', 'canary']]);
    expect(at(revealSquares(lost, CANARIES), '4,0')).toEqual({
      key: '4,0', cover: 'open', mark: 'mine', number: '', state: 'blown', zone: '', lock: '', found: '', checked: '', label: 'Row 5, column 1, mine, found by a canary'
    });
    expect(at(revealSquares(openEvery(lost), CANARIES), '4,0')).toMatchObject({ state: 'blown' });
    expect(at(revealSquares(canaryTaps([['5,1', 'open']], lost), CANARIES), '4,0')).toMatchObject({ state: 'blown' });
  });
});
