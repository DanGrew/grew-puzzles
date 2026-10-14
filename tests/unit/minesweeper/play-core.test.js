import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import {
  minesUrl, minesFile, minesBoard, newMinesPlay, tapMines, minesFinished, minesSquares, numberState, squareMarks,
  minesCount, answerSquares, minesFrame, minesOpenView, minesRefit, minesZoom, minesZoomState, minesDrag, movedFar, pressKind,
  minesPrints, boardPrints, printedRule, minesMistakes, checkLine, newMinesHistory, tappedHistory, undoneMines, canUndo
} from '../../../core/minesweeper/play-core.js';
const require = createRequire(import.meta.url);
// core/minesweeper/play-core.js, against MINE-0001 — a real 10×10 Easy board of 15 mines made by
// tooling's generator and passing its checks — and a small board of its own, two rows of three:
//   2 . .      the 2 touches (0,1), (1,0) and (1,1); the 1 touches (0,1), (0,2) and (1,1)
//   . . 1      its mines are (0,1) and (1,0)
const BOARD_FILE = require('../../fixtures/MINE-0001.json');

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
let BOARD, SMALL;
beforeEach(() => {
  BOARD = minesBoard(structuredClone(BOARD_FILE));
  SMALL = minesBoard({
    hiddenId: 'MINE-0009', type: 'Vanilla', created: '2026-10-11', title: 'Small', difficulty: 'Hard', width: 3, height: 2,
    numbersPerStep: 1, numbers: ['2..', '..1'], mines: [{ row: 0, col: 1 }, { row: 1, col: 0 }]
  });
});

function taps(cells, board, play) {
  return cells.reduce((p, cell) => tapMines(p, cell, board), play || newMinesPlay());
}

describe('finding the board a play URL names', () => {
  it('names a board by its hidden ID, its file under the minesweeper kind', () => {
    expect(minesUrl('?id=MINE-0001')).toBe('../content/puzzles/minesweeper/MINE-0001.json');
    expect(minesUrl('?id=MINE-12345')).toBe('../content/puzzles/minesweeper/MINE-12345.json');
    expect(minesFile('MINE-0042')).toBe('../content/puzzles/minesweeper/MINE-0042.json');
  });

  it('names no board for anything else, so nothing else becomes a path', () => {
    ['', '?id=', '?id=MAZE-0001', '?id=MINE-001', '?id=MINE-0001/../x', '?id=xMINE-0001', '?id=MINE-0001x'].forEach(search => {
      expect(() => minesUrl(search)).toThrow('No such puzzle');
    });
  });
});

describe('the board', () => {
  it('holds its title, difficulty, code, bands and size', () => {
    expect(BOARD).toMatchObject({
      title: 'Garden Patch', difficulty: 'Easy', code: 'MINE-0001', label: 'Vanilla', solutionLabel: 'Vanilla · Solution',
      cols: 10, rows: 10
    });
    expect(SMALL).toMatchObject({ difficulty: 'Hard', cols: 3, rows: 2 });
  });

  it('a board saved without a difficulty is Easy', () => {
    const { difficulty, ...file } = structuredClone(BOARD_FILE);
    expect(minesBoard(file).difficulty).toBe('Easy');
  });

  it('reads its numbers by square, a 0 among them, and its mines', () => {
    expect(SMALL.numbers).toEqual({ '0,0': 2, '1,2': 1 });
    expect(SMALL.mines).toEqual(['0,1', '1,0']);
    expect(BOARD.numbers['0,8']).toBe(0);
    expect(Object.keys(BOARD.numbers)).toHaveLength(BOARD_FILE.numbers.join('').replace(/\./g, '').length);
    expect(BOARD.mines).toHaveLength(15);
  });
});

describe('marking a blank square', () => {
  it('a board starts with nothing marked and nothing set off', () => {
    expect(newMinesPlay()).toEqual({ marks: {}, events: [] });
  });

  it('cycles dot, mine, blank', () => {
    expect(taps([[1, 1]], SMALL)).toEqual({ marks: { '1,1': 'dot' }, events: [] });
    expect(taps([[1, 1], [1, 1]], SMALL)).toEqual({ marks: { '1,1': 'mine' }, events: [] });
    expect(taps([[1, 1], [1, 1], [1, 1]], SMALL)).toEqual({ marks: {}, events: [] });
  });

  it('leaves the other marks as they were, and never changes the play it was given', () => {
    const before = taps([[0, 1]], SMALL);
    const after = tapMines(before, [0, 2], SMALL);
    expect(after.marks).toEqual({ '0,1': 'dot', '0,2': 'dot' });
    expect(before.marks).toEqual({ '0,1': 'dot' });
  });
});

describe('tapping a number', () => {
  it('fills its blank squares with mines when its missing mines exactly fill them', () => {
    expect(taps([[0, 1], [1, 1], [1, 2]], SMALL).marks).toEqual({ '0,1': 'dot', '1,1': 'dot', '0,2': 'mine' });
  });

  it('a dot is not blank: the fill goes round it', () => {
    expect(taps([[0, 0]], SMALL).marks).toEqual({});
    expect(taps([[1, 1], [0, 0]], SMALL).marks).toEqual({ '1,1': 'dot', '0,1': 'mine', '1,0': 'mine' });
  });

  it('fills its blank squares with dots once every mine round it is marked', () => {
    expect(taps([[0, 1], [0, 1], [1, 2]], SMALL).marks).toEqual({ '0,1': 'mine', '0,2': 'dot', '1,1': 'dot' });
  });

  it('counts only the player\'s own marks, so a wrong mark carries into the fill', () => {
    const wrong = taps([[1, 1], [1, 1]], SMALL);
    expect(tapMines(wrong, [0, 0], SMALL).marks).toEqual({ '1,1': 'mine' });
    expect(taps([[0, 1], [0, 1], [0, 0]], SMALL, wrong).marks).toEqual({ '1,1': 'mine', '0,1': 'mine', '1,0': 'dot' });
  });

  it('does nothing when its count settles nothing', () => {
    const one = taps([[0, 1], [0, 1]], SMALL);
    expect(tapMines(one, [0, 0], SMALL).marks).toEqual({ '0,1': 'mine' });
  });

  it('does nothing when it is red', () => {
    const over = taps([[0, 1], [0, 1], [1, 1], [1, 1]], SMALL);
    expect(tapMines(over, [1, 2], SMALL).marks).toEqual({ '0,1': 'mine', '1,1': 'mine' });
  });

  it('does nothing when every square round it is already marked', () => {
    const full = taps([[0, 1], [0, 1], [1, 1], [1, 0]], SMALL);
    expect(full.marks).toEqual({ '0,1': 'mine', '1,1': 'dot', '1,0': 'dot' });
    expect(tapMines(full, [0, 0], SMALL).marks).toEqual(full.marks);
  });

  it('fills only squares on the board, at every edge and corner', () => {
    expect(taps([[1, 2]], SMALL).marks).toEqual({});
    // MINE-0001's bottom-right 0, and the 2 on its left edge once its mines are marked.
    expect(taps([[9, 9]], BOARD).marks).toEqual({ '8,8': 'dot', '8,9': 'dot' });
    expect(taps([[6, 0], [6, 1], [6, 1], [7, 1], [7, 1], [6, 0]], BOARD).marks)
      .toEqual({ '6,1': 'mine', '7,1': 'mine', '5,0': 'dot', '5,1': 'dot' });
  });

  it('a number in the middle fills all eight squares round it, the corners too', () => {
    const middle = minesBoard({
      hiddenId: 'MINE-0010', type: 'Vanilla', created: '2026-10-11', title: 'Middle', width: 4, height: 3,
      numbersPerStep: 1, numbers: ['....', '.0..', '....'], mines: [{ row: 0, col: 3 }]
    });
    expect(taps([[1, 1]], middle).marks).toEqual({
      '0,0': 'dot', '0,1': 'dot', '0,2': 'dot', '1,0': 'dot', '1,2': 'dot', '2,0': 'dot', '2,1': 'dot', '2,2': 'dot'
    });
    expect(numberState({ marks: { '2,0': 'mine' } }, [1, 1], middle)).toBe('over');
  });
});

describe('solving the board', () => {
  it('is solved once the mines marked are exactly the board\'s, and only that tap says complete', () => {
    const one = taps([[0, 1], [0, 1]], SMALL);
    expect(minesFinished(one, SMALL)).toBe(false);
    const done = taps([[1, 0], [1, 0]], SMALL, one);
    expect(done.events).toEqual(['complete']);
    expect(minesFinished(done, SMALL)).toBe(true);
  });

  it('dots don\'t matter', () => {
    expect(minesFinished(taps([[1, 1], [0, 0]], SMALL), SMALL)).toBe(true);
    expect(minesFinished({ marks: { '0,1': 'mine', '1,0': 'mine', '1,1': 'dot', '0,2': 'dot' } }, SMALL)).toBe(true);
  });

  it('a mine too many, or one in the wrong place, is not solved', () => {
    expect(minesFinished({ marks: { '0,1': 'mine', '1,0': 'mine', '1,1': 'mine' } }, SMALL)).toBe(false);
    expect(minesFinished({ marks: { '0,1': 'mine', '1,1': 'mine' } }, SMALL)).toBe(false);
    expect(minesFinished({ marks: { '0,1': 'mine', '1,0': 'dot' } }, SMALL)).toBe(false);
  });

  it('a solved board takes no more taps', () => {
    const done = taps([[1, 1], [0, 0]], SMALL);
    expect(tapMines(done, [1, 1], SMALL)).toEqual({ marks: done.marks, events: [] });
    expect(tapMines(done, [0, 2], SMALL)).toEqual({ marks: done.marks, events: [] });
  });

  it('MINE-0001 solves from its own mines', () => {
    const play = { marks: Object.fromEntries(BOARD.mines.map(k => [k, 'mine'])), events: [] };
    expect(minesFinished(play, BOARD)).toBe(true);
    expect(minesCount(play, BOARD)).toBe('15/15');
  });
});

describe('Check', () => {
  it('points at a mine marked where there is none, and a dot where there is one', () => {
    expect(minesMistakes({ marks: { '1,1': 'mine' } }, SMALL)).toEqual(['1,1']);
    expect(minesMistakes({ marks: { '0,1': 'dot' } }, SMALL)).toEqual(['0,1']);
    expect(minesMistakes({ marks: { '0,1': 'dot', '1,1': 'mine', '0,2': 'dot', '1,0': 'mine' } }, SMALL)).toEqual(['0,1', '1,1']);
  });

  it('a mark the answer agrees with is never pointed at, nor a blank square', () => {
    expect(minesMistakes({ marks: { '0,1': 'mine', '1,1': 'dot' } }, SMALL)).toEqual([]);
    expect(minesMistakes(newMinesPlay(), SMALL)).toEqual([]);
    expect(minesMistakes({ marks: Object.fromEntries(BOARD.mines.map(k => [k, 'mine'])) }, BOARD)).toEqual([]);
  });

  it('says how many, or that there are none', () => {
    expect(checkLine([])).toBe('No mistakes so far');
    expect(checkLine(['1,1'])).toBe('1 mistake');
    expect(checkLine(['0,1', '1,1'])).toBe('2 mistakes');
    expect(checkLine(Array(12).fill('0,0'))).toBe('12 mistakes');
  });
});

describe('Undo', () => {
  // Each tap played through, the history kept as the page keeps it.
  function played(cells, board) {
    return cells.reduce((at, cell) => {
      const next = tapMines(at.play, cell, board);
      return { play: next, history: tappedHistory(at.history, at.play, next) };
    }, { play: newMinesPlay(), history: newMinesHistory() });
  }

  it('a visit starts with nothing to take back', () => {
    expect(newMinesHistory()).toEqual([]);
    expect(canUndo(newMinesHistory(), newMinesPlay(), SMALL)).toBe(false);
  });

  it('takes back the last tap, the square as it was before it', () => {
    const at = played([[1, 1], [1, 1]], SMALL);
    expect(at.play.marks).toEqual({ '1,1': 'mine' });
    expect(canUndo(at.history, at.play, SMALL)).toBe(true);
    const back = undoneMines(at.history, at.play);
    expect(back.play).toEqual({ marks: { '1,1': 'dot' }, events: [] });
    expect(back.history).toHaveLength(1);
  });

  it('takes back a number\'s fill as one tap, every square it filled at once', () => {
    const at = played([[0, 1], [0, 1], [1, 2]], SMALL);
    expect(at.play.marks).toEqual({ '0,1': 'mine', '0,2': 'dot', '1,1': 'dot' });
    expect(at.history).toHaveLength(3);
    expect(undoneMines(at.history, at.play).play.marks).toEqual({ '0,1': 'mine' });
  });

  it('a tap that changed nothing isn\'t kept, so Undo never takes back nothing', () => {
    // The 1 with one blank square dotted can't settle the other two, so its tap does nothing.
    const at = played([[1, 1], [1, 2]], SMALL);
    expect(at.history).toHaveLength(1);
    expect(tappedHistory([], newMinesPlay(), { marks: {}, events: [] })).toEqual([]);
    expect(tappedHistory([], { marks: { '1,1': 'dot' } }, { marks: { '1,1': 'mine' } })).toEqual([{ marks: { '1,1': 'dot' }, events: [] }]);
    expect(tappedHistory([], { marks: { '1,1': 'dot' } }, { marks: {} })).toHaveLength(1);
    expect(tappedHistory([], { marks: {} }, { marks: { '1,1': 'dot' } })).toHaveLength(1);
  });

  it('pressed again and again, each earlier tap goes in turn, until nothing is left', () => {
    let at = played([[1, 1], [0, 2], [0, 2]], SMALL);
    const seen = [];
    while (canUndo(at.history, at.play, SMALL)) {
      at = undoneMines(at.history, at.play);
      seen.push(at.play.marks);
    }
    expect(seen).toEqual([{ '1,1': 'dot', '0,2': 'dot' }, { '1,1': 'dot' }, {}]);
    expect(at.history).toEqual([]);
  });

  it('with nothing kept, leaves the play as it is', () => {
    const play = { marks: { '1,1': 'dot' }, events: [] };
    expect(undoneMines([], play)).toEqual({ play, history: [] });
  });

  it('a solved board takes nothing back, and an undone play sets nothing off', () => {
    const at = played([[0, 1], [0, 1], [1, 0], [1, 0]], SMALL);
    expect(at.play.events).toEqual(['complete']);
    expect(canUndo(at.history, at.play, SMALL)).toBe(false);
    const before = played([[0, 1], [0, 1], [1, 0]], SMALL);
    expect(undoneMines(before.history, before.play).play.events).toEqual([]);
  });
});

describe('what the board shows', () => {
  it('every square row by row, a number as written, a blank square none', () => {
    expect(minesSquares(SMALL)).toEqual([
      { cell: [0, 0], key: '0,0', number: '2' }, { cell: [0, 1], key: '0,1', number: '' }, { cell: [0, 2], key: '0,2', number: '' },
      { cell: [1, 0], key: '1,0', number: '' }, { cell: [1, 1], key: '1,1', number: '' }, { cell: [1, 2], key: '1,2', number: '1' }
    ]);
    expect(minesSquares(BOARD)[8]).toEqual({ cell: [0, 8], key: '0,8', number: '0' });
    expect(minesSquares(BOARD)).toHaveLength(100);
  });

  it('a number fades once as many mines are marked round it as it says, and turns red past it', () => {
    expect(numberState(newMinesPlay(), [0, 0], SMALL)).toBe('');
    expect(numberState({ marks: { '0,1': 'mine' } }, [0, 0], SMALL)).toBe('');
    expect(numberState({ marks: { '0,1': 'mine', '1,1': 'mine' } }, [0, 0], SMALL)).toBe('met');
    expect(numberState({ marks: { '0,1': 'mine', '1,0': 'mine', '1,1': 'mine' } }, [0, 0], SMALL)).toBe('over');
    expect(numberState({ marks: { '0,1': 'dot', '1,0': 'dot', '1,1': 'dot' } }, [0, 0], SMALL)).toBe('');
    expect(numberState(newMinesPlay(), [0, 8], BOARD)).toBe('met');
  });

  it('each square\'s mark, state and what a screen reader hears', () => {
    expect(squareMarks(taps([[0, 1], [1, 0], [1, 0], [1, 1], [1, 1]], SMALL), SMALL)).toEqual([
      { key: '0,0', mark: 'number', state: 'met', label: 'Row 1, column 1, 2' },
      { key: '0,1', mark: 'dot', state: '', label: 'Row 1, column 2, no mine' },
      { key: '0,2', mark: 'blank', state: '', label: 'Row 1, column 3, blank' },
      { key: '1,0', mark: 'mine', state: '', label: 'Row 2, column 1, mine' },
      { key: '1,1', mark: 'mine', state: '', label: 'Row 2, column 2, mine' },
      { key: '1,2', mark: 'number', state: 'met', label: 'Row 2, column 3, 1' }
    ]);
  });

  it('counts the mines marked, never the dots, of the board\'s mines', () => {
    expect(minesCount(newMinesPlay(), BOARD)).toBe('0/15');
    expect(minesCount(taps([[0, 1], [1, 0], [1, 0]], SMALL), SMALL)).toBe('1/2');
  });

  it('the answer: each square its number, a mine, or nothing', () => {
    expect(answerSquares(SMALL)).toEqual([
      { key: '0,0', cell: [0, 0], number: '2', mine: false }, { key: '0,1', cell: [0, 1], number: '', mine: true },
      { key: '0,2', cell: [0, 2], number: '', mine: false }, { key: '1,0', cell: [1, 0], number: '', mine: true },
      { key: '1,1', cell: [1, 1], number: '', mine: false }, { key: '1,2', cell: [1, 2], number: '1', mine: false }
    ]);
  });
});

describe('paper', () => {
  it('a board prints while its longer side is at most 30 squares, whichever way it lies', () => {
    expect(minesPrints(10, 10)).toBe(true);
    expect(minesPrints(30, 30)).toBe(true);
    expect(minesPrints(1, 30)).toBe(true);
    expect(minesPrints(31, 10)).toBe(false);
    expect(minesPrints(10, 31)).toBe(false);
    expect(minesPrints(40, 40)).toBe(false);
  });

  it('a Vanilla board prints by its size; a Reveal board never does, whatever its size', () => {
    expect(boardPrints({ rule: 'vanilla', cols: 30, rows: 10 })).toBe(true);
    expect(boardPrints({ rule: 'vanilla', cols: 31, rows: 10 })).toBe(false);
    expect(boardPrints({ rule: 'reveal', cols: 10, rows: 10 })).toBe(false);
  });

  it('the sheet\'s rule says to shade the board\'s own mines', () => {
    expect(printedRule(BOARD)).toBe('Shade the 15 mines. Each number counts the mines in the eight squares around it. A numbered square is never a mine.');
    expect(printedRule(SMALL)).toMatch(/^Shade the 2 mines\. /);
    expect(printedRule({ ...SMALL, mines: ['0,1'] })).toMatch(/^Shade the 1 mine\. /);
  });
});

describe('the frame', () => {
  const room = (width, height, rows, cols) => ({ viewHeight: height + 100, chromeHeight: 100, width: width + 40, chromeWidth: 40, rows, cols });

  it('fits the board to the narrower of the page\'s width and the window\'s height, in whole pixels', () => {
    expect(minesFrame(room(297, 900, 10, 10))).toEqual({ fit: 29, width: 290, height: 290 });
    expect(minesFrame(room(900, 297, 10, 10))).toEqual({ fit: 29, width: 290, height: 290 });
    expect(minesFrame(room(300, 900, 10, 20))).toEqual({ fit: 15, width: 300, height: 150 });
    expect(minesFrame(room(105, 900, 1, 10))).toEqual({ fit: 10, width: 100, height: 10 });
  });

  it('never bigger than 44px a square', () => {
    expect(minesFrame(room(2000, 2000, 10, 10))).toEqual({ fit: 44, width: 440, height: 440 });
  });

  it('under 10px a square, every bit of room counts', () => {
    expect(minesFrame(room(300, 900, 40, 40))).toEqual({ fit: 7.5, width: 300, height: 300 });
  });
});

describe('the view', () => {
  const BIG = { rows: 40, cols: 40 };
  const SMALL_FRAME = { fit: 10, width: 400, height: 400 };

  it('a board that fits at a comfortable tap size opens whole', () => {
    expect(minesOpenView({ fit: 29, width: 290, height: 290 }, { rows: 10, cols: 10 })).toEqual({ cell: 29, x: 0, y: 0 });
    expect(minesOpenView({ fit: 24, width: 240, height: 240 }, { rows: 10, cols: 10 })).toEqual({ cell: 24, x: 0, y: 0 });
  });

  it('any other opens zoomed in on its middle, 36px a square', () => {
    const view = minesOpenView(SMALL_FRAME, BIG);
    expect(view.cell).toBe(36);
    expect(view.x).toBeCloseTo(20 - 400 / 36 / 2);
    expect(view.y).toBeCloseTo(20 - 400 / 36 / 2);
    expect(minesOpenView({ fit: 23, width: 920, height: 920 }, BIG).cell).toBe(36);
  });

  it('a Reveal board opens zoomed in on its start square instead, where its opened squares are', () => {
    const view = minesOpenView(SMALL_FRAME, { rows: 40, cols: 40, start: '10,30' });
    expect(view.cell).toBe(36);
    expect(view.x).toBeCloseTo(30.5 - 400 / 36 / 2);
    expect(view.y).toBeCloseTo(10.5 - 400 / 36 / 2);
    // A Vanilla board's start is '': its middle, as ever.
    expect(minesOpenView(SMALL_FRAME, { rows: 40, cols: 40, start: '' })).toEqual(minesOpenView(SMALL_FRAME, BIG));
  });

  it('only a board too small to tap whole zooms, from the whole to 48px', () => {
    expect(minesZoomState({ cell: 10 }, SMALL_FRAME)).toEqual({ zoomIn: true, zoomOut: false, zoomable: true });
    expect(minesZoomState({ cell: 30 }, SMALL_FRAME)).toEqual({ zoomIn: true, zoomOut: true, zoomable: true });
    expect(minesZoomState({ cell: 48 }, SMALL_FRAME)).toEqual({ zoomIn: false, zoomOut: true, zoomable: true });
    expect(minesZoomState({ cell: 24 }, { fit: 24, width: 240, height: 240 })).toEqual({ zoomIn: false, zoomOut: false, zoomable: false });
    expect(minesZoomState({ cell: 23 }, { fit: 23, width: 920, height: 920 })).toEqual({ zoomIn: true, zoomOut: false, zoomable: true });
  });

  it('zooms about the middle of what\'s on view, as far as the zoom runs', () => {
    const view = { cell: 20, x: 10, y: 10 };
    expect(minesZoom(view, 1.25, SMALL_FRAME, BIG)).toEqual({ cell: 25, x: 12, y: 12 });
    const most = minesZoom(view, 10, SMALL_FRAME, BIG);
    expect(most.cell).toBe(48);
    expect(most.x).toBeCloseTo(20 - 400 / 48 / 2);
    expect(minesZoom(view, 0.1, SMALL_FRAME, BIG)).toEqual({ cell: 10, x: 0, y: 0 });
    expect(minesZoom({ cell: 29, x: 0, y: 0 }, 2, { fit: 29, width: 290, height: 290 }, { rows: 10, cols: 10 })).toEqual({ cell: 29, x: 0, y: 0 });
  });

  it('goes with the finger dragging it, never past an edge', () => {
    const view = { cell: 20, x: 10, y: 10 };
    expect(minesDrag(view, { x: 100, y: 100 }, { x: 140, y: 80 }, SMALL_FRAME, BIG)).toEqual({ cell: 20, x: 8, y: 11 });
    expect(minesDrag(view, { x: 0, y: 0 }, { x: 1000, y: -1000 }, SMALL_FRAME, BIG)).toEqual({ cell: 20, x: 0, y: 20 });
  });

  it('a resize keeps the whole board whole, and any other zoom, about the same middle', () => {
    expect(minesRefit({ cell: 10, x: 0, y: 0 }, SMALL_FRAME, { fit: 8, width: 320, height: 320 }, BIG)).toEqual({ cell: 8, x: 0, y: 0 });
    expect(minesRefit({ cell: 20, x: 10, y: 10 }, SMALL_FRAME, { fit: 8, width: 320, height: 320 }, BIG)).toEqual({ cell: 20, x: 12, y: 12 });
    expect(minesRefit({ cell: 30, x: 0, y: 0 }, SMALL_FRAME, { fit: 40, width: 400, height: 400 }, { rows: 10, cols: 10 }))
      .toEqual({ cell: 40, x: 0, y: 0 });
  });
});

describe('pressing the board', () => {
  it('a press that moves more than 8px is moving the board, not tapping it', () => {
    expect(movedFar({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(false);
    expect(movedFar({ x: 10, y: 10 }, { x: 18, y: 10 })).toBe(false);
    expect(movedFar({ x: 10, y: 10 }, { x: 10, y: 18.1 })).toBe(true);
    expect(movedFar({ x: 10, y: 10 }, { x: 16, y: 16 })).toBe(true);
    expect(movedFar({ x: 16, y: 16 }, { x: 10, y: 10 })).toBe(true);
  });

  it('one finger drags, two or more pinch', () => {
    expect(pressKind(1)).toBe('drag');
    expect(pressKind(2)).toBe('pinch');
    expect(pressKind(3)).toBe('pinch');
  });
});
