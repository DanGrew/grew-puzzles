// The minesweeper play page's DOM: loads the board a play URL names, draws it and its answer from
// play-core's board, and wires the taps, the zoom and moving round a big board, the flip and the
// completion pop, and the print menu. Every rule lives in core/minesweeper/play-core.js; nothing
// here decides anything. Saving the player's marks is ui/minesweeper/progress-ui.js; the printed
// sheet is ui/minesweeper/sheet-ui.js.
import {
  minesUrl, minesBoard, tapMines, minesSquares, squareMarks, minesCount, minesFinished, answerSquares,
  minesFrame, minesOpenView, minesRefit, minesZoom, minesZoomState, minesDrag, movedFar, pressKind, minesPrints
} from '../../core/minesweeper/play-core.js';
import { zoomFactor, pinchFactor, wheelFactor, worldTransform } from '../../core/maze/play-core.js';
import { playJson } from '../../core/wordsearch/play-core.js';
import { isPhone } from '../../core/theme-core.js';
import { wireFlip, celebrate, drawIdent } from '../card-ui.js';
import { joinedMines } from '../../core/minesweeper/progress-core.js';
import { withSavedMines, wireMinesProgress, saveTap } from './progress-ui.js';
import { drawMinesSheet } from './sheet-ui.js';
import { printIn } from '../theme-ui.js';

// Beside the grid card, the Mines card and the gap before it; on a phone it sits underneath.
var MINES_SIDE_ROOM = { true: 0, false: 330 };
// Room under the grid card when it fills the window's height, so its shadow and edge show.
var MINES_WINDOW_MARGIN = 24;
// Only a board up to 30 squares a side prints: its sheet is drawn and Print page shows; any other
// has neither.
var MINES_SHEETS = { true: showSheet, false: noop };

function minesEl(id) {
  return document.getElementById(id);
}

function noop() {}

// A signed-in player's board waits for what they saved, so it first draws as they left it.
export function openMinesPage(search) {
  var id = new URLSearchParams(search).get('id');
  minesEl('print').querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { printIn(b.dataset.print, noPrintLoad); });
  });
  Promise.resolve(search)
    .then(minesUrl)
    .then(function (url) { return fetch(url); })
    .then(playJson)
    .then(function (puzzle) {
      var board = minesBoard(puzzle);
      withSavedMines(id, board, function (play) { showBoard(id, board, play); });
    }, showMissing);
}

// Plain paper needs nothing loaded before the dialog opens.
function noPrintLoad() {
  return Promise.resolve();
}

// The printout: always the blank board, whatever the player has marked on screen.
function showSheet(board) {
  drawMinesSheet(minesEl('mines-sheet'), board);
  minesEl('print').hidden = false;
}

function showMissing() {
  document.title = 'Puzzle not found · Grew Puzzles';
  minesEl('title').textContent = 'Puzzle not found';
  minesEl('play').hidden = true;
  minesEl('missing').hidden = false;
}

// The board on its own play page: the board in the grid card, its answer on the card's back, and
// the Mines card beside it — under it on a phone — play, as the player left it, already in place,
// so nothing pops in and a board finished before doesn't celebrate again. It is saved under its
// hidden ID.
function showBoard(id, board, play) {
  var frame = { fit: 0, width: 0, height: 0 };
  var view = { cell: 1, x: 0, y: 0 };
  // The first frame opens the board; every one after refits it.
  var fitView = function (v, before, next) { return minesOpenView(next, board); };
  var squares = new Map();
  // The fingers or the mouse down on the board, and whether this press has moved it — a press
  // that has taps nothing when it lifts.
  var touches = new Map();
  var press = { from: { x: 0, y: 0 }, last: { x: 0, y: 0 }, moved: false };
  var pinch = { from: [], view: view };
  var MINES_EVENTS = { complete: celebrate };
  var PRESS_MOVES = { true: pressMove, false: noop };
  var PRESS_STEPS = { drag: dragTo, pinch: pinchTo };
  var DRAGS = { true: drag, false: noop };
  var CLICKS = { true: swallow, false: noop };
  var WHEELS = { true: wheelZoom, false: noop };

  document.title = board.title + ' · Grew Puzzles';
  minesEl('title').textContent = board.title;
  drawIdent(minesEl, board);
  minesEl('label').textContent = board.label;
  minesEl('solution-label').textContent = board.solutionLabel;
  minesEl('play').style.setProperty('--cols', board.cols);
  minesEl('play').style.setProperty('--rows', board.rows);
  minesSquares(board).forEach(function (s) {
    var button = squareButton(s);
    button.addEventListener('click', function () { onTap(s.cell); });
    squares.set(s.key, button);
    minesEl('grid').appendChild(button);
  });
  answerSquares(board).forEach(function (s) { minesEl('solution-grid').appendChild(answerSquare(s)); });
  MINES_SHEETS[minesPrints(board.cols, board.rows)](board);
  minesEl('play').hidden = false;
  wireFlip(noop);
  wirePress();
  wireZoom();
  wireSize();
  wireMinesProgress(id, board, function () { return play; }, joinSaved);
  render();

  // Every tap that changes the marks is saved, signed in.
  function onTap(cell) {
    var next = tapMines(play, cell, board);
    saveTap(id, board, play, next);
    play = next;
    render();
    play.events.forEach(function (e) { MINES_EVENTS[e](); });
  }

  // Signed in mid-board: the board saved elsewhere joins the one on screen.
  function joinSaved(saved) {
    play = joinedMines(play, saved);
    render();
  }

  // Each square as the marks have it, the Mines card's count, and the finish's line.
  function render() {
    squareMarks(play, board).forEach(function (m) {
      var square = squares.get(m.key);
      square.dataset.mark = m.mark;
      square.dataset.state = m.state;
      square.setAttribute('aria-label', m.label);
    });
    minesEl('count').textContent = minesCount(play, board);
    minesEl('complete').hidden = !minesFinished(play, board);
  }

  // ---- The view ----

  // The board behind the frame, both sides of the card alike, and the zoom buttons.
  function showView(next) {
    var state = minesZoomState(next, frame), playEl = minesEl('play');
    view = next;
    playEl.style.setProperty('--cell', view.cell + 'px');
    playEl.dataset.zoomable = String(state.zoomable);
    minesEl('zoom-in').disabled = !state.zoomIn;
    minesEl('zoom-out').disabled = !state.zoomOut;
    ['world', 'solution-world'].forEach(function (id) { minesEl(id).style.transform = worldTransform(view); });
  }

  // ---- Pressing, dragging and pinching ----

  // A press that moves further than a tap would drags the board; two fingers pinch it. Either way
  // its lift taps nothing, and a key's press — no pointer — always taps.
  function wirePress() {
    var front = minesEl('view');
    front.addEventListener('pointerdown', function (e) {
      var at = { x: e.clientX, y: e.clientY };
      touches.set(e.pointerId, at);
      press = { from: at, last: at, moved: touches.size > 1 };
      pinch = { from: Array.from(touches.values()), view: view };
    });
    front.addEventListener('pointermove', function (e) { PRESS_MOVES[touches.has(e.pointerId)](e); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      front.addEventListener(type, function (e) {
        touches.delete(e.pointerId);
        pinch = { from: Array.from(touches.values()), view: view };
      });
    });
    front.addEventListener('click', function (e) { CLICKS[[press.moved, e.detail > 0].every(Boolean)](e); }, true);
  }

  function pressMove(e) {
    var at = { x: e.clientX, y: e.clientY };
    touches.set(e.pointerId, at);
    press.moved = [press.moved, movedFar(press.from, at)].some(Boolean);
    PRESS_STEPS[pressKind(touches.size)](at);
  }

  // One finger, or the mouse, once it has moved: the board goes with it, from where it went down.
  function dragTo(at) {
    DRAGS[press.moved](at);
  }

  function drag(at) {
    showView(minesDrag(view, press.last, at, frame, board));
    press.last = at;
  }

  function pinchTo() {
    showView(minesZoom(pinch.view, pinchFactor(pinch.from, Array.from(touches.values())), frame, board));
  }

  function swallow(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  // + and −; a trackpad's pinch, or the wheel with Ctrl held.
  function wireZoom() {
    ['in', 'out'].forEach(function (way) {
      minesEl('zoom-' + way).addEventListener('click', function () { showView(minesZoom(view, zoomFactor(way), frame, board)); });
    });
    minesEl('view').addEventListener('wheel', function (e) { WHEELS[e.ctrlKey](e); }, { passive: false });
  }

  function wheelZoom(e) {
    e.preventDefault();
    showView(minesZoom(view, wheelFactor(e.deltaY), frame, board));
  }

  // ---- The frame ----

  // The frame fits the page's width and the window's height, as big as it can be: measured once
  // drawn, and again on every resize.
  function wireSize() {
    window.addEventListener('resize', sizeBoard);
    document.fonts.ready.then(sizeBoard);
    sizeBoard();
  }

  // The card's edges round the frame are its borders and its padding, either side; beside it, wider
  // than a phone, the Mines card.
  function sizeBoard() {
    var playEl = minesEl('play'), face = minesEl('front'), frameEl = minesEl('view');
    var phone = isPhone(document.documentElement.clientWidth);
    var next = minesFrame({
      viewHeight: window.innerHeight,
      chromeHeight: face.offsetHeight - frameEl.offsetHeight + MINES_WINDOW_MARGIN,
      width: playEl.clientWidth,
      chromeWidth: face.offsetWidth - face.clientWidth + 2 * minesEl('board').offsetLeft + MINES_SIDE_ROOM[phone],
      rows: board.rows, cols: board.cols
    });
    var fitted = fitView(view, frame, next, board);
    frame = next;
    fitView = minesRefit;
    playEl.style.setProperty('--frame-w', frame.width + 'px');
    playEl.style.setProperty('--frame-h', frame.height + 'px');
    showView(fitted);
  }
}

// A square on the front is a button, its number on it, or blank: a tap marks it, or fills round
// the number.
function squareButton(s) {
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'mines-square';
  button.textContent = s.number;
  button.style.gridArea = (s.cell[0] + 1) + ' / ' + (s.cell[1] + 1);
  return button;
}

// A square of the answer: its number, a mine, or nothing.
function answerSquare(s) {
  var square = document.createElement('span');
  square.className = 'mines-square';
  square.textContent = s.number;
  square.dataset.mark = { true: 'mine', false: 'blank' }[s.mine];
  square.style.gridArea = (s.cell[0] + 1) + ' / ' + (s.cell[1] + 1);
  return square;
}
