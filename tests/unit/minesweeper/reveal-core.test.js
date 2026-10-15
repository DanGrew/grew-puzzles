import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { minesBoard, minesMistakes, minesCount, answerSquares, keyHiddenAt } from '../../../core/minesweeper/play-core.js';
import {
  newRevealPlay, revealFinished, tapReveal, otherTool, revealTapped, undoneReveal, canUndoReveal, revealSquares, keysFound
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
    // A marked mine tapped with Open never goes off.
    expect(taps([['0,2', 'mark'], ['0,2', 'open']])).toEqual({ open: newRevealPlay(BOARD).open, marks: { '0,2': 'mine' }, boom: '', events: [] });
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
    expect(tapReveal(play, [0, 0], BOARD, 'open')).toEqual({ open: play.open, marks: play.marks, boom: '0,2', events: [] });
    expect(tapReveal(play, [0, 4], BOARD, 'mark').marks).toEqual({ '0,3': 'mine' });
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
    expect(tapReveal(last, [0, 2], BOARD, 'mark').marks).toEqual(last.marks);
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
    expect(at(squares, '0,2')).toMatchObject({ cover: 'open', mark: 'mine', number: '', state: 'boom', checked: '', label: 'Row 1, column 3, mine, opened' });
    expect(at(squares, '4,2')).toMatchObject({ cover: 'open', mark: 'mine', number: '', state: 'shown', checked: '', label: 'Row 5, column 3, mine' });
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
    expect(BOARD).toMatchObject({ zones: {}, keys: {}, keyed: false });
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
      expect(tapReveal(play, [5, 0], board, tool)).toEqual({ open: play.open, marks: {}, boom: '', events: ['locked'] });
      expect(tapReveal(play, [4, 4], board, tool)).toEqual({ open: play.open, marks: {}, boom: '', events: ['locked'] });
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
    expect(at(squares, '2,4')).toMatchObject({ cover: 'open', mark: 'mine', state: 'shown', zone: '1', lock: '' });
  });

  it('the answer side shows every key where it hid', () => {
    const board = keysBoard();
    const keys = answerSquares(board).filter(s => s.found !== '').map(s => [s.key, s.found]);
    expect(keys).toEqual([['0,5', '2'], ['5,0', '1']]);
    expect(answerSquares(BOARD).filter(s => s.found !== '')).toEqual([]);
  });
});
