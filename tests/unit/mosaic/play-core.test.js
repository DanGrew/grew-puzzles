import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import {
  mosaicUrl, mosaicFile, mosaicBoard, newMosaicPlay, tapMosaic, rightTool, mosaicFinished, mosaicMistakes, canUndoMosaic,
  mosaicCount, mosaicTitle, completeLine, squareSaid, answerPlay, cellAt, onBoard, keyAction, keyMove, cellShows, viewSpan,
  boardDrawing, squareAt, meltAt, meltLength, showing, ringWidth, numberSize, mosaicPrints, paperSquares
} from '../../../core/mosaic/play-core.js';
import { tappedHistory, undoneMines } from '../../../core/minesweeper/play-core.js';
const require = createRequire(import.meta.url);
// core/mosaic/play-core.js, against MOSA-0001 — a real 12×12 Easy board made by tooling's
// generator and passing its mosaic checks — and a small board of its own, two rows of three:
//   numbers  2 . .     answer  # . .     the 2's block is (0,0), (0,1), (1,0) and (1,1), two shaded;
//            . . 1             . # .     the 1's is (0,1), (0,2), (1,1) and (1,2), one shaded
const BOARD_FILE = require('../../fixtures/MOSA-0001.json');

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
let BOARD, SMALL;
beforeEach(() => {
  BOARD = mosaicBoard(structuredClone(BOARD_FILE));
  SMALL = mosaicBoard({
    hiddenId: 'MOSA-0009', type: 'Vanilla', created: '2026-10-15', title: 'Mosaic 009', difficulty: 'Hard', width: 3, height: 2,
    numbersPerStep: 1, numbers: ['2..', '..1'], answer: ['#..', '.#.'], name: 'Barn Owl', pattern: { style: 'mirror', size: 3, seed: 1 }
  });
});

function taps(cells, board, tool, play) {
  return cells.reduce((p, cell) => tapMosaic(p, cell, board, tool || 'cycle'), play || newMosaicPlay());
}

const shade = cell => [cell, cell];

describe('finding the board a play URL names', () => {
  it('names a board by its hidden ID, its file under the mosaic kind', () => {
    expect(mosaicUrl('?id=MOSA-0001')).toBe('../content/puzzles/mosaic/MOSA-0001.json');
    expect(mosaicUrl('?id=MOSA-12345')).toBe('../content/puzzles/mosaic/MOSA-12345.json');
    expect(mosaicFile('MOSA-0042')).toBe('../content/puzzles/mosaic/MOSA-0042.json');
  });

  it('names no board for anything else, so nothing else becomes a path', () => {
    ['', '?id=', '?id=MINE-0001', '?id=MOSA-001', '?id=MOSA-0001/../x', '?id=xMOSA-0001', '?id=MOSA-0001x'].forEach(search => {
      expect(() => mosaicUrl(search)).toThrow('No such puzzle');
    });
  });
});

describe('the board', () => {
  it('holds its title, difficulty, code, bands, name and size, and opens on its middle', () => {
    expect(BOARD).toMatchObject({
      title: 'Mosaic 001', difficulty: 'Easy', code: 'MOSA-0001', label: 'Vanilla', solutionLabel: 'Vanilla · Solution',
      name: 'Robot 20', cols: 12, rows: 12, start: ''
    });
    expect(SMALL).toMatchObject({ difficulty: 'Hard', cols: 3, rows: 2, name: 'Barn Owl' });
  });

  it('reads its numbers by square, a 0 among them, and its shaded squares', () => {
    expect(SMALL.numbers).toEqual({ '0,0': 2, '1,2': 1 });
    expect(SMALL.shaded).toEqual({ '0,0': true, '1,1': true });
    expect(BOARD.numbers['0,4']).toBe(0);
    expect(Object.keys(BOARD.numbers)).toHaveLength(BOARD_FILE.numbers.join('').replace(/\./g, '').length);
    expect(Object.keys(BOARD.shaded)).toHaveLength(BOARD_FILE.answer.join('').replace(/\./g, '').length);
  });
});

describe('paper', () => {
  it('prints a board up to 30 squares along both sides; a bigger one either way stays on the site', () => {
    expect(mosaicPrints(BOARD)).toBe(true);
    expect(mosaicPrints({ cols: 30, rows: 30 })).toBe(true);
    expect(mosaicPrints({ cols: 31, rows: 10 })).toBe(false);
    expect(mosaicPrints({ cols: 30, rows: 38 })).toBe(false);
    expect(mosaicPrints({ cols: 198, rows: 198 })).toBe(false);
  });

  it('prints each square\'s number, a 0 too, row by row, every other square blank', () => {
    expect(paperSquares(SMALL).map(s => s.number)).toEqual(['2', '', '', '', '', '1']);
    expect(paperSquares(BOARD).map(s => s.number).join('')).toBe(BOARD_FILE.numbers.join('').replace(/\./g, ''));
    expect(paperSquares(BOARD)[4].number).toBe('0');
  });

  it('never prints a shaded square, whatever the player shaded: only numbers and lines', () => {
    expect(Object.keys(paperSquares(BOARD)[0]).sort()).toEqual(['below', 'number', 'right']);
  });

  it('draws a heavier line after every fifth column and row, but never on the board\'s edge', () => {
    const ten = mosaicBoard({ ...structuredClone(BOARD_FILE), width: 10, height: 11,
      numbers: Array(11).fill('..........'), answer: Array(11).fill('..........') });
    const squares = paperSquares(ten);
    expect(squares).toHaveLength(110);
    expect(squares.slice(0, 10).map(s => s.right)).toEqual([false, false, false, false, true, false, false, false, false, false]);
    expect(squares.filter((_, i) => i % 10 === 0).map(s => s.below)).toEqual([false, false, false, false, true, false, false, false, false, true, false]);
    expect(paperSquares(BOARD).slice(0, 12).filter(s => s.right).length).toBe(2);
    expect(paperSquares(SMALL).some(s => s.right || s.below)).toBe(false);
  });
});

describe('marking a square', () => {
  it('a board starts with nothing marked and nothing set off', () => {
    expect(newMosaicPlay()).toEqual({ marks: {}, events: [] });
  });

  it('cycles blank, shade, clear — a blank square and a number\'s alike', () => {
    [[0, 1], [0, 0]].forEach(cell => {
      expect(taps([cell], SMALL).marks).toEqual({ [cell.join(',')]: 'blank' });
      expect(taps([cell, cell], SMALL).marks).toEqual({ [cell.join(',')]: 'shade' });
      expect(taps([cell, cell, cell], SMALL).marks).toEqual({});
    });
  });

  it('leaves the other marks as they were, and never changes the play it was given', () => {
    const before = taps([[0, 1]], SMALL);
    const after = tapMosaic(before, [0, 2], SMALL, 'cycle');
    expect(after.marks).toEqual({ '0,1': 'blank', '0,2': 'blank' });
    expect(before.marks).toEqual({ '0,1': 'blank' });
  });

  it('Fill on a square with no number cycles it too', () => {
    expect(taps([[0, 1]], SMALL, 'fill').marks).toEqual({ '0,1': 'blank' });
  });

  it('a right-click always fills', () => {
    expect(rightTool()).toBe('fill');
  });
});

describe('a number\'s fill', () => {
  it('leaves the rest of its block blank once its count is met — its own square too', () => {
    const play = taps([[1, 1], [1, 1], [0, 1], [0, 1]], SMALL);
    expect(tapMosaic(play, [0, 0], SMALL, 'fill').marks).toEqual({ '0,0': 'blank', '0,1': 'shade', '1,0': 'blank', '1,1': 'shade' });
  });

  it('shades its clear squares when they\'re exactly what it still needs, and leaves its blanks', () => {
    const play = taps([[0, 1], [1, 0]], SMALL);
    expect(tapMosaic(play, [0, 0], SMALL, 'fill').marks).toEqual({ '0,0': 'shade', '0,1': 'blank', '1,0': 'blank', '1,1': 'shade' });
  });

  it('shades a part of its block once the rest is settled', () => {
    const play = taps([[0, 1], [1, 0], ...shade([0, 0])], SMALL);
    expect(tapMosaic(play, [0, 0], SMALL, 'fill').marks).toEqual({ '0,0': 'shade', '0,1': 'blank', '1,0': 'blank', '1,1': 'shade' });
  });

  it('changes nothing while its count doesn\'t settle it', () => {
    const play = taps([[0, 1]], SMALL);
    expect(tapMosaic(play, [0, 0], SMALL, 'fill').marks).toBe(play.marks);
    expect(tapMosaic(newMosaicPlay(), [0, 0], SMALL, 'fill').marks).toEqual({});
  });

  it('changes nothing with one shaded too many', () => {
    const play = taps([...shade([0, 0]), ...shade([0, 1]), ...shade([1, 1])], SMALL);
    expect(tapMosaic(play, [0, 0], SMALL, 'fill').marks).toBe(play.marks);
  });

  it('counts only the player\'s own squares, so a wrong one carries in', () => {
    const play = taps([...shade([0, 1]), ...shade([1, 0])], SMALL);
    expect(tapMosaic(play, [0, 0], SMALL, 'fill').marks).toEqual({ '0,0': 'blank', '0,1': 'shade', '1,0': 'shade', '1,1': 'blank' });
  });

  it('with Mark picked, a number cycles as any square does', () => {
    const play = taps([[0, 1], [1, 0]], SMALL);
    expect(tapMosaic(play, [0, 0], SMALL, 'cycle').marks).toEqual({ '0,0': 'blank', '0,1': 'blank', '1,0': 'blank' });
  });
});

describe('the finish', () => {
  it('a board is solved once its shaded squares are exactly the answer, blanks or not', () => {
    expect(mosaicFinished(newMosaicPlay(), SMALL)).toBe(false);
    expect(mosaicFinished(taps([...shade([0, 0])], SMALL), SMALL)).toBe(false);
    expect(mosaicFinished(taps([...shade([0, 0]), ...shade([1, 1])], SMALL), SMALL)).toBe(true);
    expect(mosaicFinished(taps([...shade([0, 0]), ...shade([1, 1]), [0, 2]], SMALL), SMALL)).toBe(true);
    expect(mosaicFinished(taps([...shade([0, 2]), ...shade([0, 0]), ...shade([1, 1])], SMALL), SMALL)).toBe(false);
    expect(mosaicFinished(taps([...shade([0, 0]), ...shade([0, 1])], SMALL), SMALL)).toBe(false);
  });

  it('the tap that solves it sets off complete, and only that one', () => {
    const almost = taps([...shade([0, 0]), [1, 1]], SMALL);
    expect(almost.events).toEqual([]);
    expect(tapMosaic(almost, [1, 1], SMALL, 'cycle').events).toEqual(['complete']);
    expect(tapMosaic(taps([[0, 1], [1, 0]], SMALL), [0, 0], SMALL, 'fill').events).toEqual(['complete']);
  });

  it('a solved board takes no more taps', () => {
    const solved = taps([...shade([0, 0]), ...shade([1, 1])], SMALL);
    const after = tapMosaic(solved, [0, 2], SMALL, 'cycle');
    expect(after).toEqual({ marks: solved.marks, events: [] });
  });

  it('solves the real board from its answer', () => {
    const cells = Object.keys(BOARD.shaded).map(k => k.split(',').map(Number));
    expect(mosaicFinished(taps(cells.flatMap(shade), BOARD), BOARD)).toBe(true);
  });

  it('the title is Mosaic 001 until it\'s solved, then the picture\'s name', () => {
    expect(mosaicTitle(newMosaicPlay(), SMALL)).toBe('Mosaic 009');
    expect(mosaicTitle(taps([...shade([0, 0]), ...shade([1, 1])], SMALL), SMALL)).toBe('Barn Owl');
    expect(completeLine(SMALL)).toBe('Solved — it\'s Barn Owl.');
  });
});

describe('Check and Undo', () => {
  it('rings a square shaded that isn\'t and a blank on one that is, never a clear square', () => {
    expect(mosaicMistakes(newMosaicPlay(), SMALL)).toEqual([]);
    expect(mosaicMistakes(taps([[0, 1], ...shade([0, 0])], SMALL), SMALL)).toEqual([]);
    expect(mosaicMistakes(taps([...shade([0, 1]), [1, 1], [1, 2]], SMALL), SMALL)).toEqual(['0,1', '1,1']);
  });

  it('Undo greys out with nothing to take back, and on a solved board', () => {
    const solved = taps([...shade([0, 0]), ...shade([1, 1])], SMALL);
    expect(canUndoMosaic([], newMosaicPlay(), SMALL)).toBe(false);
    expect(canUndoMosaic([newMosaicPlay()], taps([[0, 1]], SMALL), SMALL)).toBe(true);
    expect(canUndoMosaic([newMosaicPlay()], solved, SMALL)).toBe(false);
  });

  it('a fill is one tap to take back', () => {
    const before = taps([[0, 1], [1, 0]], SMALL);
    const after = tapMosaic(before, [0, 0], SMALL, 'fill');
    const history = tappedHistory([], before, after);
    expect(undoneMines(history, after).play.marks).toEqual(before.marks);
  });
});

describe('what the page says', () => {
  it('counts the shaded squares', () => {
    expect(mosaicCount(newMosaicPlay())).toBe('0 shaded');
    expect(mosaicCount(taps([[0, 1], ...shade([0, 0]), ...shade([1, 2])], SMALL))).toBe('2 shaded');
  });

  it('says where a square is, its number and its mark', () => {
    const play = taps([[0, 1], ...shade([0, 0])], SMALL);
    expect(squareSaid(play, SMALL, [0, 0])).toBe('Row 1, column 1, number 2, shaded');
    expect(squareSaid(play, SMALL, [0, 1])).toBe('Row 1, column 2, left blank');
    expect(squareSaid(play, SMALL, [1, 2])).toBe('Row 2, column 3, number 1, clear');
  });

  it('the answer is every square of the picture shaded', () => {
    expect(answerPlay(SMALL)).toEqual({ marks: { '0,0': 'shade', '1,1': 'shade' }, events: [] });
  });
});

describe('pointing at a square', () => {
  it('finds the square under a point, at the zoom and from where the view starts', () => {
    expect(cellAt({ cell: 20, x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([0, 0]);
    expect(cellAt({ cell: 20, x: 0, y: 0 }, { x: 39.9, y: 20 })).toEqual([1, 1]);
    expect(cellAt({ cell: 10, x: 2.5, y: 4 }, { x: 5, y: 9 })).toEqual([4, 3]);
  });

  it('a square is on the board inside its edges only', () => {
    expect(onBoard([0, 0], SMALL)).toBe(true);
    expect(onBoard([1, 2], SMALL)).toBe(true);
    [[-1, 0], [0, -1], [2, 0], [0, 3]].forEach(c => expect(onBoard(c, SMALL)).toBe(false));
  });

  it('arrows move, Enter and Space tap, F fills, and any other key does nothing', () => {
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(k => expect(keyAction(k)).toBe('move'));
    expect(keyAction('Enter')).toBe('tap');
    expect(keyAction(' ')).toBe('tap');
    expect(keyAction('f')).toBe('fill');
    expect(keyAction('F')).toBe('fill');
    expect(keyAction('x')).toBe('none');
  });

  it('an arrow moves the square a step, never off the board', () => {
    expect(keyMove([0, 1], 'ArrowRight', SMALL)).toEqual([0, 2]);
    expect(keyMove([0, 2], 'ArrowRight', SMALL)).toEqual([0, 2]);
    expect(keyMove([0, 1], 'ArrowLeft', SMALL)).toEqual([0, 0]);
    expect(keyMove([0, 0], 'ArrowLeft', SMALL)).toEqual([0, 0]);
    expect(keyMove([0, 1], 'ArrowDown', SMALL)).toEqual([1, 1]);
    expect(keyMove([1, 1], 'ArrowDown', SMALL)).toEqual([1, 1]);
    expect(keyMove([1, 1], 'ArrowUp', SMALL)).toEqual([0, 1]);
    expect(keyMove([0, 1], 'ArrowUp', SMALL)).toEqual([0, 1]);
    expect(keyMove([1, 1], 'Enter', SMALL)).toEqual([1, 1]);
  });

  it('a square shows while all of it is on view', () => {
    const view = { cell: 10, x: 2, y: 3 }, frame = { width: 50, height: 40 };
    expect(cellShows(view, frame, [3, 2])).toBe(true);
    expect(cellShows(view, frame, [6, 6])).toBe(true);
    [[2, 2], [3, 1], [7, 2], [3, 7]].forEach(c => expect(cellShows(view, frame, c)).toBe(false));
    expect(cellShows({ cell: 10, x: 2.5, y: 3 }, frame, [3, 2])).toBe(false);
    expect(cellShows({ cell: 10, x: 2, y: 3.5 }, frame, [3, 2])).toBe(false);
  });

  it('the square in focus is drawn where it is on view', () => {
    expect(squareAt({ cell: 10, x: 2, y: 3 }, [4, 5])).toEqual({ x: 30, y: 10, size: 10 });
  });
});

describe('what the board on view draws', () => {
  const whole = { cell: 30, x: 0, y: 0 };
  const frame = { width: 90, height: 60 };

  it('spans the squares on view, whole rows and columns from the one an edge cuts, never past the board', () => {
    expect(viewSpan(whole, frame, SMALL)).toEqual({ top: 0, left: 0, bottom: 1, right: 2 });
    expect(viewSpan({ cell: 10, x: 2.5, y: 3.5 }, { width: 50, height: 40 }, BOARD)).toEqual({ top: 3, left: 2, bottom: 7, right: 7 });
    expect(viewSpan({ cell: 10, x: -1, y: -1 }, { width: 500, height: 500 }, SMALL)).toEqual({ top: 0, left: 0, bottom: 1, right: 2 });
  });

  it('draws the shaded squares, a number\'s tint while it\'s clear, and the blank squares', () => {
    const play = taps([...shade([0, 0]), [0, 1]], SMALL);
    const d = boardDrawing(play, SMALL, whole, frame, [], 1);
    expect(d.size).toBe(30);
    expect(d.shaded).toEqual([{ x: 0, y: 0, w: 30, h: 30 }]);
    expect(d.tints).toEqual([{ x: 60, y: 30, w: 30, h: 30 }]);
    expect(d.blanks).toEqual([{ x: 30, y: 0, w: 30, h: 30 }]);
  });

  it('draws a blank number in the blank tint, not its own', () => {
    const d = boardDrawing(taps([[0, 0], [1, 2]], SMALL), SMALL, whole, frame, [], 1);
    expect(d.tints).toEqual([]);
    expect(d.blanks).toEqual([{ x: 0, y: 0, w: 30, h: 30 }, { x: 60, y: 30, w: 30, h: 30 }]);
  });

  it('draws each number in the middle of its square, light on a shaded one', () => {
    const d = boardDrawing(taps([...shade([0, 0])], SMALL), SMALL, whole, frame, [], 1);
    expect(d.numbers).toEqual([{ x: 15, y: 15, text: '2', light: true }, { x: 75, y: 45, text: '1', light: false }]);
  });

  it('rings the squares Check names', () => {
    const d = boardDrawing(newMosaicPlay(), SMALL, whole, frame, ['0,1', '1,2'], 1);
    expect(d.rings).toEqual([{ x: 30, y: 0, w: 30, h: 30 }, { x: 60, y: 30, w: 30, h: 30 }]);
  });

  it('draws a line after every column and row on view but the last', () => {
    expect(boardDrawing(newMosaicPlay(), SMALL, whole, frame, [], 1).lines).toEqual([
      { x1: 30, y1: 0, x2: 30, y2: 60 }, { x1: 60, y1: 0, x2: 60, y2: 60 }, { x1: 0, y1: 30, x2: 90, y2: 30 }
    ]);
  });

  it('draws only the squares on view, placed from where the view starts', () => {
    const play = taps([...shade([3, 2]), ...shade([0, 0])], BOARD);
    const d = boardDrawing(play, BOARD, { cell: 10, x: 2, y: 3 }, { width: 20, height: 20 }, [], 1);
    expect(d.shaded).toEqual([{ x: 0, y: 0, w: 10, h: 10 }]);
    expect(d.numbers.map(n => n.text)).toEqual(['4', '2']);
    expect(d.lines).toEqual([{ x1: 10, y1: 0, x2: 10, y2: 20 }, { x1: 0, y1: 10, x2: 20, y2: 10 }]);
  });

  it('snaps each square to the screen\'s pixels, so squares side by side meet', () => {
    const play = taps([...shade([0, 0]), ...shade([0, 1])], SMALL);
    const d = boardDrawing(play, SMALL, { cell: 10.3, x: 0.25, y: 0 }, { width: 30, height: 20 }, [], 2);
    expect(d.shaded).toEqual([{ x: -2.5, y: 0, w: 10, h: 10.5 }, { x: 7.5, y: 0, w: 10.5, h: 10.5 }]);
  });

  it('draws numbers from 10px squares, and lines from 6px', () => {
    const at = cell => boardDrawing(newMosaicPlay(), SMALL, { cell, x: 0, y: 0 }, { width: cell * 3, height: cell * 2 }, [], 1);
    expect(at(10).numbers).toHaveLength(2);
    expect(at(9.9).numbers).toEqual([]);
    expect(at(6).lines).toHaveLength(3);
    expect(at(5.9).lines).toEqual([]);
    expect(at(5.9).tints).toHaveLength(2);
  });
});

describe('the melt, the ring and the type', () => {
  it('runs from 0 to 1 over its length, and stays at 1', () => {
    expect(meltAt(100, 100, 900)).toBe(0);
    expect(meltAt(100, 550, 900)).toBe(0.5);
    expect(meltAt(100, 1000, 900)).toBe(1);
    expect(meltAt(100, 5000, 900)).toBe(1);
    expect(meltAt(100, 50, 900)).toBe(0);
  });

  it('is over at once for a player who asks for less motion', () => {
    expect(meltLength(true)).toBe(0);
    expect(meltLength(false)).toBe(900);
    expect(meltAt(100, 100, 0)).toBe(1);
  });

  it('shows less of the numbers and lines as it goes', () => {
    expect(showing(0)).toBe(1);
    expect(showing(0.25)).toBe(0.75);
    expect(showing(1)).toBe(0);
  });

  it('a ring is a ninth of a square, never under 3px; a number half a square', () => {
    expect(ringWidth(100)).toBe(11);
    expect(ringWidth(10)).toBe(3);
    expect(numberSize(36)).toBe(18);
  });
});
