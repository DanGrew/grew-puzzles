// The mosaic play page's DOM: loads the board a play URL names, draws the squares on view and its
// answer from play-core's board, and wires the taps and the phone's Cycle | Fill switch, the right-click
// fill, the keys, Check and Undo, the zoom and moving round a big board, the flip, and the finish —
// the numbers and lines melting away to the picture, and the title to its name. The board is drawn
// into a canvas, only the squares on view, so a 200×200 plays as smoothly as a 10×10 (the
// product's TASK-164 spec). Every rule lives in core/mosaic/play-core.js and
// core/minesweeper/play-core.js, whose frame and zoom it shares; nothing here decides anything.
import {
  mosaicUrl, mosaicBoard, newMosaicPlay, tapMosaic, rightTool, mosaicFinished, mosaicMistakes, canUndoMosaic, mosaicCount,
  mosaicTitle, completeLine, squareSaid, answerPlay, cellAt, onBoard, keyAction, keyMove, cellShows, boardDrawing, squareAt,
  meltAt, meltLength, showing, ringWidth, numberSize
} from '../../core/mosaic/play-core.js';
import {
  checkLine, newMinesHistory, tappedHistory, undoneMines, minesFrame, minesOpenView, minesRefit, minesZoom, minesZoomState,
  minesDrag, movedFar, pressKind
} from '../../core/minesweeper/play-core.js';
import { zoomFactor, pinchFactor, wheelFactor, centreOn } from '../../core/maze/play-core.js';
import { playJson, playReach, playMargins } from '../../core/wordsearch/play-core.js';
import { isPhone } from '../../core/theme-core.js';
import { wireFlip, celebrate, drawIdent } from '../card-ui.js';
import { sizeScale } from '../../core/size-core.js';
import { wireSizeMenu, sizeSquare } from '../size-ui.js';

// Beside the grid card, the Squares card and the gap before it; on a phone it sits underneath.
var MOSAIC_SIDE_ROOM = { true: 0, false: 330 };
// Room under the grid card when it fills the window's height, so its shadow and edge show.
var MOSAIC_WINDOW_MARGIN = 24;

function mosaicEl(id) {
  return document.getElementById(id);
}

function noop() {}

export function openMosaicPage(search) {
  Promise.resolve(search)
    .then(mosaicUrl)
    .then(function (url) { return fetch(url); })
    .then(playJson)
    .then(function (puzzle) { showBoard(mosaicBoard(puzzle)); }, showMissing);
}

function showMissing() {
  document.title = 'Puzzle not found · Grew Puzzles';
  mosaicEl('title').textContent = 'Puzzle not found';
  mosaicEl('play').hidden = true;
  mosaicEl('missing').hidden = false;
}

// The board on its own play page: the squares on view in the grid card, its answer on the card's
// back, and the Squares card beside it — under it on a phone.
function showBoard(board) {
  var frame = { fit: 0, width: 0, height: 0 };
  var view = { cell: 1, x: 0, y: 0 };
  // The first frame opens the board; every one after refits it.
  var fitView = function (v, before, next) { return minesOpenView(next, board); };
  var play = newMosaicPlay(), answer = answerPlay(board), history = newMinesHistory();
  var tool = 'cycle', checked = [], melt = 0, meltStart = 0, length = meltLength(matchMedia('(prefers-reduced-motion: reduce)').matches);
  // The square the keys move, from the board's middle.
  var focus = [Math.floor(board.rows / 2), Math.floor(board.cols / 2)];
  var puzzleSize = 'normal';
  var drawPending = false;
  var touches = new Map();
  var press = { from: { x: 0, y: 0 }, last: { x: 0, y: 0 }, moved: false };
  var pinch = { from: [], view: view };
  var PRESS_MOVES = { true: pressMove, false: noop };
  var PRESS_STEPS = { drag: dragTo, pinch: pinchTo };
  var DRAGS = { true: drag, false: noop };
  var CLICKS = { true: swallow, false: tapClick };
  var WHEELS = { true: wheelZoom, false: noop };
  var TAPS = { true: tapCell, false: noop };
  var KEYS = { move: moveFocus, tap: keyTap, fill: keyFill, none: noop };
  var VIEW_KEEPS = { true: function () { return view; }, false: function () { return centreOn(view, focus, frame, board); } };
  var MELTS = { true: function () { requestAnimationFrame(meltStep); }, false: noop };
  var DRAW_ASKS = { false: askDraw, true: noop };
  var FOCUS_RINGS = { true: drawFocus, false: noop };
  var EVENTS = { complete: finish };

  document.title = board.title + ' · Grew Puzzles';
  drawIdent(mosaicEl, board);
  mosaicEl('label').textContent = board.label;
  mosaicEl('solution-label').textContent = board.solutionLabel;
  mosaicEl('play').hidden = false;
  wireFlip(noop);
  wirePress();
  wireTools();
  wireKeys();
  wireZoom();
  wireSizeMenu(mosaicEl('puzzle-size'), mosaicEl('puzzle-size-menu'), sizeSquare, function (size) { puzzleSize = size; }, sizeBoard);
  mosaicEl('check').addEventListener('click', onCheck);
  mosaicEl('undo').addEventListener('click', onUndo);
  wireSize();
  render();

  // ---- Playing ----

  function tapCell(cell, with_) {
    var next = tapMosaic(play, cell, board, with_);
    history = tappedHistory(history, play, next);
    play = next;
    checked = [];
    focus = cell;
    render();
    mosaicEl('said').textContent = squareSaid(play, board, cell);
    play.events.forEach(function (e) { EVENTS[e](); });
  }

  // The last tap taken back — a fill as one.
  function onUndo() {
    var undone = undoneMines(history, play);
    history = undone.history;
    play = undone.play;
    checked = [];
    render();
  }

  // Each square the answer disagrees with ringed in red, and the line under the board says how many.
  function onCheck() {
    checked = mosaicMistakes(play, board);
    render();
    mosaicEl('check-line').textContent = checkLine(checked);
    mosaicEl('check-line').hidden = false;
  }

  // Solved: it pops and sparkles, the title becomes its name, and the numbers and lines melt away.
  function finish() {
    mosaicEl('complete').textContent = completeLine(board);
    celebrate();
    meltStart = performance.now();
    requestAnimationFrame(meltStep);
  }

  function meltStep(now) {
    melt = meltAt(meltStart, now, length);
    draw();
    MELTS[melt < 1]();
  }

  // The title, the count, Undo, the finish's line, and the board.
  function render() {
    var solved = mosaicFinished(play, board);
    var title = mosaicTitle(play, board);
    document.title = title + ' · Grew Puzzles';
    mosaicEl('title').textContent = title;
    mosaicEl('play').dataset.solved = String(solved);
    mosaicEl('count').textContent = mosaicCount(play);
    mosaicEl('check-line').hidden = true;
    mosaicEl('undo').disabled = !canUndoMosaic(history, play, board);
    mosaicEl('complete').hidden = !solved;
    draw();
  }

  // ---- Tools and keys ----

  function wireTools() {
    ['cycle', 'fill'].forEach(function (t) {
      mosaicEl('tool-' + t).addEventListener('click', function () { pickTool(t); });
    });
    // A right-click fills, whichever tool is picked.
    mosaicEl('grid').addEventListener('contextmenu', function (e) {
      e.preventDefault();
      tapAt(e, rightTool());
    });
  }

  function pickTool(t) {
    tool = t;
    mosaicEl('tool-cycle').setAttribute('aria-pressed', String(t === 'cycle'));
    mosaicEl('tool-fill').setAttribute('aria-pressed', String(t === 'fill'));
  }

  // The square under a press, tapped with a tool.
  function tapAt(e, with_) {
    var cell = cellAt(view, { x: e.offsetX, y: e.offsetY });
    TAPS[onBoard(cell, board)](cell, with_);
  }

  function tapClick(e) {
    tapAt(e, tool);
  }

  function wireKeys() {
    var grid = mosaicEl('grid');
    grid.addEventListener('keydown', function (e) { KEYS[keyAction(e.key)](e); });
    grid.addEventListener('focus', function () { scheduleDraw(); mosaicEl('said').textContent = squareSaid(play, board, focus); });
    grid.addEventListener('blur', scheduleDraw);
  }

  // An arrow moves the square in focus, the view following it onto the screen.
  function moveFocus(e) {
    e.preventDefault();
    focus = keyMove(focus, e.key, board);
    showView(VIEW_KEEPS[cellShows(view, frame, focus)]());
    mosaicEl('said').textContent = squareSaid(play, board, focus);
  }

  function keyTap(e) {
    e.preventDefault();
    tapCell(focus, tool);
  }

  function keyFill(e) {
    e.preventDefault();
    tapCell(focus, 'fill');
  }

  // ---- Drawing ----

  // Many asks in one screen refresh draw once.
  function scheduleDraw() {
    DRAW_ASKS[drawPending]();
  }

  function askDraw() {
    drawPending = true;
    requestAnimationFrame(function () { drawPending = false; draw(); });
  }

  // Both sides of the card: the player's squares, Check's rings and, through the melt, less of the
  // numbers and lines; the answer, every number and line.
  function draw() {
    drawBoard(mosaicEl('grid'), play, checked, showing(melt));
    drawBoard(mosaicEl('solution-grid'), answer, [], 1);
    // Only a keyboard's focus wears the ring, never a tap's, as a button's :focus-visible does.
    FOCUS_RINGS[mosaicEl('grid').matches(':focus-visible')]();
  }

  function drawBoard(canvas, shown, rings, show) {
    var ratio = window.devicePixelRatio;
    var ctx = canvas.getContext('2d');
    var colours = getComputedStyle(mosaicEl('play'));
    var ink = colours.getPropertyValue('--ink').trim(), fg = colours.getPropertyValue('--fg').trim();
    var tone = { true: colours.getPropertyValue('--surface').trim(), false: fg };
    var d = boardDrawing(shown, board, view, frame, rings, ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colours.getPropertyValue('--surface').trim();
    ctx.fillRect(0, 0, frame.width, frame.height);
    ctx.fillStyle = ink;
    d.shaded.forEach(function (s) { ctx.fillRect(s.x, s.y, s.w, s.h); });
    ctx.globalAlpha = show;
    ctx.fillStyle = colours.getPropertyValue('--clue-bg').trim();
    d.tints.forEach(function (s) { ctx.fillRect(s.x, s.y, s.w, s.h); });
    ctx.fillStyle = colours.getPropertyValue('--blank').trim();
    d.blanks.forEach(function (s) { ctx.fillRect(s.x, s.y, s.w, s.h); });
    ctx.strokeStyle = colours.getPropertyValue('--rule').trim();
    ctx.lineWidth = 1;
    ctx.beginPath();
    d.lines.forEach(function (l) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); });
    ctx.stroke();
    ctx.font = '700 ' + numberSize(d.size) + 'px ' + colours.getPropertyValue('--font-body').trim();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    d.numbers.forEach(function (n) { ctx.fillStyle = tone[n.light]; ctx.fillText(n.text, n.x, n.y); });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colours.getPropertyValue('--wrong').trim();
    ctx.lineWidth = ringWidth(d.size);
    d.rings.forEach(function (s) { ctx.strokeRect(s.x + ctx.lineWidth / 2, s.y + ctx.lineWidth / 2, s.w - ctx.lineWidth, s.h - ctx.lineWidth); });
  }

  // The keys' ring on the square in focus.
  function drawFocus() {
    var ctx = mosaicEl('grid').getContext('2d');
    var at = squareAt(view, focus);
    ctx.strokeStyle = getComputedStyle(mosaicEl('play')).getPropertyValue('--band').trim();
    ctx.lineWidth = 3;
    ctx.strokeRect(at.x + 1.5, at.y + 1.5, at.size - 3, at.size - 3);
  }

  // ---- The view ----

  // The board behind the frame, and the zoom buttons; it draws at the next screen refresh.
  function showView(next) {
    var state = minesZoomState(next, frame), playEl = mosaicEl('play');
    view = next;
    playEl.style.setProperty('--cell', view.cell + 'px');
    playEl.dataset.zoomable = String(state.zoomable);
    playEl.dataset.view = [view.cell, view.x, view.y].join(' ');
    mosaicEl('zoom-in').disabled = !state.zoomIn;
    mosaicEl('zoom-out').disabled = !state.zoomOut;
    scheduleDraw();
  }

  // ---- Pressing, dragging and pinching ----

  // A press that moves further than a tap would drags the board; two fingers pinch it. Either way
  // its lift taps nothing.
  function wirePress() {
    var front = mosaicEl('view');
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
    mosaicEl('grid').addEventListener('click', function (e) { CLICKS[press.moved](e); });
  }

  function pressMove(e) {
    var at = { x: e.clientX, y: e.clientY };
    touches.set(e.pointerId, at);
    press.moved = [press.moved, movedFar(press.from, at)].some(Boolean);
    PRESS_STEPS[pressKind(touches.size)](at);
  }

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
      mosaicEl('zoom-' + way).addEventListener('click', function () { showView(minesZoom(view, zoomFactor(way), frame, board)); });
    });
    mosaicEl('view').addEventListener('wheel', function (e) { WHEELS[e.ctrlKey](e); }, { passive: false });
  }

  function wheelZoom(e) {
    e.preventDefault();
    showView(minesZoom(view, wheelFactor(e.deltaY), frame, board));
  }

  // ---- The frame ----

  // The frame fits the page's width and the window's height times the size picked, as big as it can
  // be: measured once drawn, and again on every resize and every size picked.
  function wireSize() {
    window.addEventListener('resize', sizeBoard);
    document.fonts.ready.then(sizeBoard);
    sizeBoard();
  }

  // As minesweeper's: the card's edges round the frame and, wider than a phone, the Squares card
  // beside it; the phone's Cycle | Fill switch fits the window's height with it. The board may reach past
  // the page's column to the window's 24px edges, never over the side bar.
  function sizeBoard() {
    var playEl = mosaicEl('play'), face = mosaicEl('front'), frameEl = mosaicEl('view');
    var phone = isPhone(document.documentElement.clientWidth);
    var column = playEl.parentElement.getBoundingClientRect();
    var reach = playReach(document.documentElement.clientWidth, column, mosaicEl('site-side').getBoundingClientRect().width);
    var chromeWidth = face.offsetWidth - face.clientWidth + 2 * mosaicEl('board').offsetLeft + MOSAIC_SIDE_ROOM[phone];
    var next = minesFrame({
      viewHeight: window.innerHeight,
      chromeHeight: face.offsetHeight - frameEl.offsetHeight + MOSAIC_WINDOW_MARGIN + mosaicEl('mosaic-switch').offsetHeight,
      width: column.width - reach.left - reach.right,
      chromeWidth: chromeWidth,
      scale: sizeScale('mosaic', puzzleSize), rows: board.rows, cols: board.cols
    });
    var fitted = fitView(view, frame, next, board);
    var margins = playMargins(reach, column.width, next.width + chromeWidth);
    frame = next;
    fitView = minesRefit;
    playEl.style.setProperty('--reach-left', margins.left + 'px');
    playEl.style.setProperty('--reach-right', margins.right + 'px');
    playEl.style.setProperty('--frame-w', frame.width + 'px');
    playEl.style.setProperty('--frame-h', frame.height + 'px');
    ['grid', 'solution-grid'].forEach(function (id) {
      mosaicEl(id).width = Math.round(frame.width * window.devicePixelRatio);
      mosaicEl(id).height = Math.round(frame.height * window.devicePixelRatio);
    });
    showView(fitted);
    draw();
  }
}
