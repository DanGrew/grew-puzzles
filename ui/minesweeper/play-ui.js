// The minesweeper play page's DOM: loads the board a play URL names, draws it and its answer from
// play-core's board, and wires the taps, Check and Undo, the zoom and moving round a big board, the flip and the
// completion pop, and the print menu, and dresses it Themed in its character. A board plays by its
// rule: a Vanilla board by marking, a Reveal board by opening squares (vanillaGame, revealGame).
// Every rule lives in core/minesweeper/play-core.js, core/minesweeper/reveal-core.js and
// core/theme-core.js; nothing here decides anything. Saving the player's board is ui/minesweeper/progress-ui.js; the printed
// sheet is ui/minesweeper/sheet-ui.js.
import {
  minesUrl, minesBoard, tapMines, minesSquares, squareMarks, minesCount, minesFinished, answerSquares, keyOf,
  minesMistakes, checkLine, newMinesHistory, tappedHistory, undoneMines, canUndo, minesFrame, minesOpenView, minesRefit, minesZoom, minesZoomState, minesDrag, movedFar, pressKind, boardPrints
} from '../../core/minesweeper/play-core.js';
import {
  newRevealPlay, tapReveal, otherTool, revealTapped, undoneReveal, canUndoReveal, revealSquares, revealFinished, keysFound,
  marksLifted, revealCount, flagSlots
} from '../../core/minesweeper/reveal-core.js';
import { zoomFactor, pinchFactor, wheelFactor, worldTransform } from '../../core/maze/play-core.js';
import { playJson, playReach, playMargins } from '../../core/wordsearch/play-core.js';
import { characterFor, idNumber, isPhone, boxFrom, siteDress, minesPrintFrame } from '../../core/theme-core.js';
import { wireFlip, celebrate, drawIdent } from '../card-ui.js';
import { joinedMines, joinedHistory, joinedReveal, joinedRevealHistory } from '../../core/minesweeper/progress-core.js';
import { withSavedMines, wireMinesProgress, saveTap } from './progress-ui.js';
import { drawMinesSheet, dressMinesSheet } from './sheet-ui.js';
import { withCharacters, dressScene, dressFigure, dressName, placeFigure, screenEdges, labelSize, onLook, printIn, printImages } from '../theme-ui.js';
import { sizeScale } from '../../core/size-core.js';
import { wireSizeMenu, sizeSquare } from '../size-ui.js';

// Beside the grid card, the Mines card and the gap before it; on a phone it sits underneath.
var MINES_SIDE_ROOM = { true: 0, false: 330 };
// Room under the grid card when it fills the window's height, so its shadow and edge show.
var MINES_WINDOW_MARGIN = 24;
// Only a Vanilla board up to 30 squares a side prints: its sheet is drawn and Print page shows; any
// other — a Reveal board too — has neither.
var MINES_SHEETS = { true: showSheet, false: noop };
// What the character on screen stands by: the board, its number, its character once known
// (dressMines), and how much wider the size picked has grown the card than at Small, px.
var minesFigure = { board: undefined, number: 1, character: undefined, grown: 0 };
// What printing the sheet in a style needs loaded first: nothing, until its character is known
// (dressMines).
var minesPrintLoad = function () { return Promise.resolve(); };
// How a board opens, by its rule: either waits for what a signed-in player saved, then plays by it.
var MINES_OPENS = { vanilla: openVanilla, reveal: openReveal };
// A press held this long on a Reveal board, without moving, marks the square under it, as a
// right-click does on a computer.
var REVEAL_HOLD_MS = 420;
// What a finished Reveal board says.
var REVEAL_COMPLETE = 'Solved — every safe square open';
// How long a padlock's shake, a key's pop, a padlock's drop and a moved mark's fade take to play
// out, ms (styles/minesweeper.css), before the square loses the class that plays it.
var KEYS_MOTION_MS = 1000;

function minesEl(id) {
  return document.getElementById(id);
}

function noop() {}

// A signed-in player's board waits for what they saved, so it first draws as they left it.
export function openMinesPage(search) {
  var id = new URLSearchParams(search).get('id');
  minesEl('print').querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { printIn(b.dataset.print, minesPrintLoad); });
  });
  Promise.resolve(search)
    .then(minesUrl)
    .then(function (url) { return fetch(url); })
    .then(playJson)
    .then(function (puzzle) {
      var board = minesBoard(puzzle);
      dressMines(id, board);
      MINES_OPENS[board.rule](id, board);
    }, showMissing);
}

function openVanilla(id, board) {
  withSavedMines(id, board, function (play) {
    showBoard(id, board, function (squares) { return vanillaGame(id, board, play, squares); });
  });
}

function openReveal(id, board) {
  withSavedMines(id, board, function (play) {
    showBoard(id, board, function (squares, cells) { return revealGame(id, board, play, squares, cells); });
  });
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
// the Mines card beside it — under it on a phone — played by its rule's game, made by makeGame from
// the squares by key, and their cells by key.
function showBoard(id, board, makeGame) {
  var frame = { fit: 0, width: 0, height: 0 };
  var view = { cell: 1, x: 0, y: 0 };
  // The first frame opens the board; every one after refits it.
  var fitView = function (v, before, next) { return minesOpenView(next, board); };
  var squares = new Map(), cells = new Map(), game;
  // The puzzle's size, kept on the device for every kind (ui/size-ui.js): read before the first frame.
  var puzzleSize = 'normal';
  // The fingers or the mouse down on the board, and whether this press has moved it — a press
  // that has taps nothing when it lifts.
  var touches = new Map();
  var press = { from: { x: 0, y: 0 }, last: { x: 0, y: 0 }, moved: false };
  var pinch = { from: [], view: view };
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
  minesEl('play').dataset.rule = board.rule;
  minesEl('play').dataset.keys = String(board.keyed);
  minesSquares(board).forEach(function (s) {
    var button = squareButton(s);
    button.addEventListener('click', function () { game.tap(s.cell); });
    squares.set(s.key, button);
    cells.set(s.key, s.cell);
    minesEl('grid').appendChild(button);
  });
  answerSquares(board).forEach(function (s) { minesEl('solution-grid').appendChild(answerSquare(s)); });
  MINES_SHEETS[boardPrints(board)](board);
  minesEl('play').hidden = false;
  game = makeGame(squares, cells);
  wireFlip(noop);
  wirePress();
  wireZoom();
  wireSizeMenu(minesEl('puzzle-size'), minesEl('puzzle-size-menu'), sizeSquare, function (size) { puzzleSize = size; }, sizeBoard);
  wireSize();
  minesEl('check').addEventListener('click', function () { game.check(); });
  minesEl('undo').addEventListener('click', function () { game.undo(); });
  game.render();

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

  // The frame fits the page's width and the window's height times the size picked, as big as it can
  // be: measured once drawn, and again on every resize and every size picked.
  function wireSize() {
    window.addEventListener('resize', sizeBoard);
    document.fonts.ready.then(sizeBoard);
    sizeBoard();
  }

  // The card's edges round the frame are its borders and its padding, either side; beside it, wider
  // than a phone, the Mines card. A Reveal board's Open | Mark mine switch fits the window's height
  // with it, so it's in reach without scrolling off the board. The board may reach past the page's
  // column to the window's 24px edges, never over the side bar (play-core's playReach), and does
  // only as far as it needs (playMargins), so a board that fits sits where it always has.
  function sizeBoard() {
    var playEl = minesEl('play'), face = minesEl('front'), frameEl = minesEl('view');
    var phone = isPhone(document.documentElement.clientWidth);
    var column = playEl.parentElement.getBoundingClientRect();
    var reach = playReach(document.documentElement.clientWidth, column, minesEl('site-side').getBoundingClientRect().width);
    var chromeWidth = face.offsetWidth - face.clientWidth + 2 * minesEl('board').offsetLeft + MINES_SIDE_ROOM[phone];
    var room = {
      viewHeight: window.innerHeight,
      chromeHeight: face.offsetHeight - frameEl.offsetHeight + MINES_WINDOW_MARGIN + minesEl('mines-switch').offsetHeight,
      width: column.width - reach.left - reach.right,
      chromeWidth: chromeWidth,
      scale: sizeScale('minesweeper', puzzleSize), rows: board.rows, cols: board.cols
    };
    var margins;
    var next = minesFrame(room);
    var fitted = fitView(view, frame, next, board);
    // The character stands against the card as it is at Small, the board as it was: no size grows it.
    minesFigure.grown = next.width - minesFrame(Object.assign({}, room, { scale: 1 })).width;
    frame = next;
    fitView = minesRefit;
    margins = playMargins(reach, column.width, frame.width + chromeWidth);
    playEl.style.setProperty('--reach-left', margins.left + 'px');
    playEl.style.setProperty('--reach-right', margins.right + 'px');
    playEl.style.setProperty('--frame-w', frame.width + 'px');
    playEl.style.setProperty('--frame-h', frame.height + 'px');
    showView(fitted);
    placeMinesFigure();
  }
}

// A Vanilla board's game: play, as the player left it, already in place, so nothing pops in and a
// board finished before doesn't celebrate again. It is saved under its hidden ID. Undo's history
// is this visit's alone, held here and nowhere else.
function vanillaGame(id, board, play, squares) {
  var history = newMinesHistory();
  var MINES_EVENTS = { complete: celebrate };
  wireMinesProgress(id, board, function () { return play; }, joinSaved);
  return { tap: onTap, check: onCheck, undo: onUndo, render: render };

  // Every tap that changes the marks is saved, signed in, and kept for Undo; any tap clears Check's
  // rings.
  function onTap(cell) {
    var next = tapMines(play, cell, board);
    saveTap(id, board, play, next);
    history = tappedHistory(history, play, next);
    play = next;
    render();
    play.events.forEach(function (e) { MINES_EVENTS[e](); });
  }

  // The last tap taken back, and saved as a tap is, so the saved marks follow it.
  function onUndo() {
    var undone = undoneMines(history, play);
    saveTap(id, board, play, undone.play);
    history = undone.history;
    play = undone.play;
    render();
  }

  // Each mark the answer disagrees with ringed in red, and the line under the board says how many.
  function onCheck() {
    var mistakes = minesMistakes(play, board);
    render();
    showMistakes(squares, mistakes);
  }

  // Signed in mid-board: the board saved elsewhere joins the one on screen.
  function joinSaved(saved) {
    history = joinedHistory(play, history);
    play = joinedMines(play, saved);
    render();
  }

  // Each square as the marks have it, with no Check rings, the Mines card's count, Undo, and the
  // finish's line.
  function render() {
    squareMarks(play, board).forEach(function (m) {
      var square = squares.get(m.key);
      square.dataset.mark = m.mark;
      square.dataset.checked = '';
      square.setAttribute('aria-label', m.label);
    });
    minesEl('count').textContent = minesCount(play, board);
    minesEl('check-line').hidden = true;
    minesEl('undo').disabled = !canUndo(history, play, board);
    minesEl('complete').hidden = !minesFinished(play, board);
  }
}

// A Reveal board's game, after the product's docs/MOCKUP-MINES-REVEAL.html: covered but for its
// start square's area; a tap opens a square or marks it, as Open | Mark mine under the board picks
// — Mark mine each time the page opens — and a right-click, or a press held still, taps with the other. Opening
// a mine is a kaboom: every mine shows, and Try again puts the board back to its start. Undo takes
// back mine marks only, this visit's alone. play is the board as the player left it, already in
// place; signed in, every tap and Undo that changes it is saved under its hidden ID, and a kaboom
// saves it cleared, so it comes back at its start. A Keys board's zones wear padlocks in their
// colours until their keys turn up: a tap on one shakes its padlock, and opening a key's square pops
// the key up on it and drops its zone's padlocks (the product's TASK-177). A Limited Flags board's
// Mines card counts the flags left and says its limit, a row of flags above the switch empties a box
// for each mark, and a mark past it fades the oldest off its square (the product's TASK-179).
function revealGame(id, board, play, squares, cells) {
  var history = [], tool = 'mark';
  var hold = { timer: 0, held: false, from: { x: 0, y: 0 }, mouse: true };
  var REVEAL_EVENTS = { kaboom: kaboom, complete: celebrate, locked: shakeLock, moved: fadeMoved };
  minesEl('play').dataset.limited = String(board.limited);
  minesEl('flag-limit').textContent = board.flagLimit;
  // A finger or a pen held still taps with the other tool; the mouse does by its right button.
  var HOLDS = { true: noop, false: startHold };
  var HOLD_MOVES = { true: endHold, false: noop };
  var CONTEXT_TAPS = { true: otherTarget, false: noop };
  var HELD_CLICKS = { true: swallowClick, false: noop };
  var TARGET_TAPS = { true: otherKey, false: noop };
  minesEl('complete').textContent = REVEAL_COMPLETE;
  ['open', 'mark'].forEach(function (t) {
    minesEl('tool-' + t).addEventListener('click', function () { pickTool(t); });
  });
  minesEl('again').addEventListener('click', tryAgain);
  wireHold();
  wireMinesProgress(id, board, function () { return play; }, joinSaved);
  return { tap: onTap, check: onCheck, undo: onUndo, render: render };

  function onTap(cell) {
    step(cell, tapReveal(play, cell, board, tool));
  }

  // Every tap that changes the board is saved, signed in; one that changes a mark is kept for Undo;
  // any tap clears Check's rings.
  function step(cell, next) {
    var before = play;
    saveTap(id, board, play, next);
    history = revealTapped(history, play, next);
    play = next;
    render();
    play.events.forEach(function (e) { REVEAL_EVENTS[e](cell, before); });
    keysFound(before, play, board).forEach(popKey);
  }

  // A mark past the flag limit: the oldest fades off its square as the new one lands.
  function fadeMoved(cell, before) {
    marksLifted(before, play).forEach(function (k) { playOut(squares.get(k), 'flag-lift'); });
  }

  // A padlocked square tapped: its padlock shakes, and nothing else happens.
  function shakeLock(cell) {
    playOut(squares.get(keyOf(cell)), 'lock-shake');
  }

  // A key turned up: it pops up on its square in its zone's colour, then greys, and its zone's
  // padlocks drop away.
  function popKey(found) {
    playOut(squares.get(found.square), 'key-pop');
    found.unlocked.forEach(function (k) { playOut(squares.get(k), 'unlocking'); });
  }

  // The last mark taken back, and saved as a tap is.
  function onUndo() {
    var undone = undoneReveal(history, play);
    saveTap(id, board, play, undone.play);
    history = undone.history;
    play = undone.play;
    render();
  }

  function onCheck() {
    var mistakes = minesMistakes(play, board);
    render();
    showMistakes(squares, mistakes);
  }

  // The same board over from its start square, with nothing carried over — its save already cleared
  // by the kaboom.
  function tryAgain() {
    play = newRevealPlay(board);
    history = [];
    render();
  }

  // Signed in mid-board: the board saved elsewhere joins the one on screen.
  function joinSaved(saved) {
    history = joinedRevealHistory(play, history, board);
    play = joinedReveal(play, saved, board);
    render();
  }

  function pickTool(t) {
    tool = t;
    minesEl('tool-open').setAttribute('aria-pressed', String(t === 'open'));
    minesEl('tool-mark').setAttribute('aria-pressed', String(t === 'mark'));
  }

  // The board shakes once as the mine goes off, and the kaboom's card drops over it.
  function kaboom() {
    var boardEl = minesEl('board');
    boardEl.classList.remove('shake');
    void boardEl.offsetWidth;
    boardEl.classList.add('shake');
    minesEl('again').focus({ preventScroll: true });
  }

  // ---- The other tool, by a held press or a right-click ----

  function wireHold() {
    var view = minesEl('view');
    view.addEventListener('pointerdown', function (e) {
      clearTimeout(hold.timer);
      hold = { timer: 0, held: false, from: { x: e.clientX, y: e.clientY }, mouse: e.pointerType === 'mouse' };
      HOLDS[hold.mouse](e.target);
    });
    view.addEventListener('pointermove', function (e) { HOLD_MOVES[movedFar(hold.from, { x: e.clientX, y: e.clientY })](); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) { view.addEventListener(type, endHold); });
    view.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      CONTEXT_TAPS[hold.mouse](e.target);
    });
    // The held press lifts without tapping again.
    view.addEventListener('click', function (e) {
      HELD_CLICKS[hold.held](e);
      hold.held = false;
    }, true);
  }

  function startHold(target) {
    hold.timer = setTimeout(function () {
      hold.held = true;
      otherTarget(target);
    }, REVEAL_HOLD_MS);
  }

  function endHold() {
    clearTimeout(hold.timer);
  }

  function swallowClick(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  // Only a square takes it: a press on the frame round the board does nothing.
  function otherTarget(target) {
    TARGET_TAPS[cells.has(target.dataset.key)](target.dataset.key);
  }

  function otherKey(key) {
    step(cells.get(key), tapReveal(play, cells.get(key), board, otherTool(tool)));
  }

  // Each square as the play has it, with no Check rings beyond those a kaboom proves; the Mines
  // card's count, Undo, the finish's line and the kaboom's card.
  function render() {
    revealSquares(play, board).forEach(function (s) {
      var square = squares.get(s.key);
      square.dataset.cover = s.cover;
      square.dataset.mark = s.mark;
      square.dataset.state = s.state;
      square.dataset.checked = s.checked;
      square.dataset.zone = s.zone;
      square.dataset.lock = s.lock;
      square.dataset.found = s.found;
      square.textContent = s.number;
      square.setAttribute('aria-label', s.label);
    });
    minesEl('count').textContent = revealCount(play, board);
    renderFlags();
    minesEl('check-line').hidden = true;
    minesEl('undo').disabled = !canUndoReveal(history, play, board);
    minesEl('complete').hidden = !revealFinished(play, board);
    minesEl('kaboom').hidden = !play.boom;
  }

  // One box per flag: a flag in it while it's still to use, empty once a mark has taken it.
  function renderFlags() {
    var slots = flagSlots(play, board);
    var row = minesEl('flag-slots');
    row.replaceChildren.apply(row, slots.map(function (full) {
      var box = document.createElement('span');
      box.className = 'flag-slot';
      box.dataset.full = String(full);
      return box;
    }));
    row.setAttribute('aria-label', 'Flags left ' + slots.filter(Boolean).length + ' of ' + slots.length);
  }
}

// A square's one-off motion — a Keys board's, or a Limited Flags mark fading — played from its
// start, its class gone again once it has played out.
function playOut(square, motion) {
  square.classList.remove(motion);
  void square.offsetWidth;
  square.classList.add(motion);
  setTimeout(function () { square.classList.remove(motion); }, KEYS_MOTION_MS);
}

// Check's rings on each mark the answer disagrees with, and the line under the board saying how
// many.
function showMistakes(squares, mistakes) {
  mistakes.forEach(function (k) { squares.get(k).dataset.checked = 'wrong'; });
  minesEl('check-line').textContent = checkLine(mistakes);
  minesEl('check-line').hidden = false;
}

// Themed, the board is dressed as a wordsearch is: its own character, its background behind the
// page, peering from behind the grid card at the printout's spot its number picks — the same every
// visit (placeMinesFigure) — and each mine marked, and each on the answer side, wears that
// character on a pastel red (styles/look.css). Plain shows none of it: a mine is a ringed dot.
// Printed Colour or Black and white, the sheet wears it too, its spot picked again each time it
// prints, and its images in before the dialog opens.
function dressMines(hiddenId, board) {
  minesFigure.board = board;
  minesFigure.number = idNumber(hiddenId);
  withCharacters(function (characters) {
    var character = characterFor(characters, hiddenId);
    var printout = function () { dressMinesSheet(minesEl('mines-sheet'), document.documentElement, board, character, false, Math.random); };
    minesFigure.character = character;
    dressScene(character);
    dressFigure(minesEl('play'), character);
    dressFigure(minesEl('theme-figure'), character);
    dressName(minesEl('name-tag'), character);
    printout();
    window.addEventListener('beforeprint', printout);
    minesPrintLoad = function () { return printImages(character); };
    placeMinesFigure();
    onLook(placeMinesFigure);
  });
}

// The character at the printout's spot the board's number picks among those that show, measured
// from the grid card as it now stands on the page, the printout's picture at the card's size against
// the board's printed card (core/theme-core.js minesPrintFrame, siteDress) — a spot the Mines card
// would cover, or the window's edge cut, skipped. Placed again whenever the card is sized, and when
// the look changes.
function placeMinesFigure() {
  var page = minesEl('play').getBoundingClientRect(), card = minesEl('stage').getBoundingClientRect();
  var title = document.querySelector('.play-head').getBoundingClientRect();
  var board = minesFigure.board, phone = isPhone(document.documentElement.clientWidth);
  placeFigure(minesEl('theme-figure'), minesEl('name-tag'), siteDress({
    card: boxFrom(card, page),
    scale: (card.width - minesFigure.grown) / minesPrintFrame(board.cols, board.rows, false).cardWidth,
    screen: screenEdges(page.left),
    covers: [boxFrom(minesEl('mines-card').getBoundingClientRect(), page)], never: [],
    title: boxFrom(title, page),
    label: labelSize(phone), saga: false, phone: phone
  }, minesFigure.character, minesFigure.number));
}

// A square on the front is a button, its number on it, or blank: a tap marks it, or fills round
// the number.
function squareButton(s) {
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'mines-square';
  button.dataset.key = s.key;
  button.textContent = s.number;
  button.style.gridArea = (s.cell[0] + 1) + ' / ' + (s.cell[1] + 1);
  return button;
}

// A square of the answer: its number, a mine, or nothing — and on a Keys board, the key hidden
// there, in its zone's colour.
function answerSquare(s) {
  var square = document.createElement('span');
  square.className = 'mines-square';
  square.textContent = s.number;
  square.dataset.mark = { true: 'mine', false: 'blank' }[s.mine];
  square.dataset.found = s.found;
  square.style.gridArea = (s.cell[0] + 1) + ' / ' + (s.cell[1] + 1);
  return square;
}
