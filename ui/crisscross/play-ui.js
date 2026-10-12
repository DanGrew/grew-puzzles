// The criss-cross play page's DOM: loads the shape a play URL names, draws it and its answer from
// play-core's board, and wires the taps on squares and words, the zoom, moving round a big shape and
// its little map, the flip and the completion pop, and the print menu. Every rule lives in
// core/crisscross/play-core.js; nothing here decides anything. Saving the player's words is
// ui/crisscross/progress-ui.js; the printed sheet is ui/crisscross/sheet-ui.js.
import {
  crissUrl, crissBoard, tapSquare, tapWord, crissSquares, squareMarks, placedSquares, crissCount,
  wordGroups, pickingLine, crissStatus, answerSquares, crissFrame, minimapSquares, crissPrints
} from '../../core/crisscross/play-core.js';
import { minesOpenView, minesRefit, minesZoom, minesZoomState, minesDrag, movedFar, pressKind } from '../../core/minesweeper/play-core.js';
import { zoomFactor, pinchFactor, wheelFactor, worldTransform, minimapFit, minimapPens, minimapBox, dragView } from '../../core/maze/play-core.js';
import { playJson } from '../../core/wordsearch/play-core.js';
import { isPhone } from '../../core/theme-core.js';
import { wireFlip, celebrate, drawIdent } from '../card-ui.js';
import { joinedCriss } from '../../core/crisscross/progress-core.js';
import { withSavedCriss, wireCrissProgress, saveTap } from './progress-ui.js';
import { drawCrissSheet } from './sheet-ui.js';
import { printIn } from '../theme-ui.js';

// Beside the grid card, the Words card and the gap before it; on a phone it sits underneath.
var CRISS_SIDE_ROOM = { true: 0, false: 330 };
// Room under the grid card when it fills the window's height, so its shadow and edge show — and on
// a phone, the gap to what sits under it, the little map and the words of the slot picked, which
// stay on screen with the card.
var CRISS_WINDOW_MARGIN = 24;
var CRISS_GAP = 20;
// The little map's longer side at each size, px, as the maze's; its room, the Words card's width,
// or on a phone half the row under the card, less its padding and border either side.
var CRISS_MINIMAP_SIZES = { small: 112, medium: 168, large: 224 };
var CRISS_MINIMAP_ROOM = { true: 0.5, false: 1 };
var CRISS_MINIMAP_EDGES = 10;
// Each square's ink on the little map: a property of styles/crisscross.css's.
var CRISS_MINIMAP_INKS = { empty: '--rule', filled: '--muted', picked: '--select' };
// How long refused squares stay red.
var CRISS_CLASH_MS = 700;
// Only a shape whose squares and list fit one sheet prints: its sheet is drawn and Print page
// shows; any other has neither.
var CRISS_SHEETS = { true: showSheet, false: noop };

function crissEl(id) {
  return document.getElementById(id);
}

function noop() {}

// A signed-in player's shape waits for what they saved, so it first draws as they left it.
export function openCrissPage(search) {
  var id = new URLSearchParams(search).get('id');
  crissEl('print').querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { printIn(b.dataset.print, noPrintLoad); });
  });
  Promise.resolve(search)
    .then(crissUrl)
    .then(function (url) { return fetch(url); })
    .then(playJson)
    .then(function (puzzle) {
      var board = crissBoard(puzzle);
      withSavedCriss(id, board, function (play) { showShape(id, board, play); });
    }, showMissing);
}

// Plain paper needs nothing loaded before the dialog opens.
function noPrintLoad() {
  return Promise.resolve();
}

// The printout: always the empty shape and its starting word, whatever the player has placed.
function showSheet(board) {
  drawCrissSheet(crissEl('criss-sheet'), board);
  crissEl('print').hidden = false;
}

function showMissing() {
  document.title = 'Puzzle not found · Grew Puzzles';
  crissEl('title').textContent = 'Puzzle not found';
  crissEl('play').hidden = true;
  crissEl('missing').hidden = false;
}

// The shape on its own play page: the shape in the grid card, its answer on the card's back, the
// Words card beside it — under it on a phone, where the words of the slot picked sit just under the
// shape too — play, as the player left it, already in place, so nothing pops in and a shape finished
// before doesn't celebrate again. It is saved under its hidden ID.
function showShape(id, board, play) {
  var frame = { fit: 0, width: 0, height: 0 };
  var view = { cell: 1, x: 0, y: 0 };
  // The first frame opens the shape; every one after refits it.
  var fitView = function (v, before, next) { return minesOpenView(next, board); };
  var squares = new Map();
  // Each word's chip in the Words card, and its twin under the shape.
  var chips = new Map(), strips = new Map();
  var mapSize = 'small';
  var minimap = { scale: 1, width: 0, height: 0 };
  var minimapMove = noop;
  // The fingers or the mouse down on the shape, and whether this press has moved it — a press that
  // has picks nothing when it lifts.
  var touches = new Map();
  var press = { from: { x: 0, y: 0 }, last: { x: 0, y: 0 }, moved: false };
  var pinch = { from: [], view: view };
  var CRISS_EVENTS = { placed: dropLetters, clash: shakeClashes, complete: celebrate };
  var PRESS_MOVES = { true: pressMove, false: noop };
  var PRESS_STEPS = { drag: dragTo, pinch: pinchTo };
  var DRAGS = { true: drag, false: noop };
  var CLICKS = { true: swallow, false: noop };
  var WHEELS = { true: wheelZoom, false: noop };
  var before = play;

  document.title = board.title + ' · Grew Puzzles';
  crissEl('title').textContent = board.title;
  drawIdent(crissEl, board);
  crissEl('label').textContent = board.label;
  crissEl('solution-label').textContent = board.solutionLabel;
  crissEl('play').style.setProperty('--cols', board.cols);
  crissEl('play').style.setProperty('--rows', board.rows);
  crissSquares(board).forEach(function (s) {
    var button = squareButton(s);
    button.addEventListener('click', function () { onTap(tapSquare(play, s.cell, board)); });
    squares.set(s.key, button);
    crissEl('grid').appendChild(button);
  });
  answerSquares(board).forEach(function (s) { crissEl('solution-grid').appendChild(answerSquare(s)); });
  CRISS_SHEETS[crissPrints(board)](board);
  wordGroups(play, board).forEach(function (g) {
    var group = groupBox(g);
    g.words.forEach(function (w) {
      chips.set(w.index, wordChip(w, group.querySelector('.chips')));
      strips.set(w.index, wordChip(w, crissEl('strip-chips')));
    });
    crissEl('groups').appendChild(group);
  });
  crissEl('play').hidden = false;
  // While the answer shows, the words rest.
  wireFlip(function () {
    var flipped = crissEl('card').classList.contains('flipped');
    ['words-card', 'dock'].forEach(function (id) { crissEl(id).inert = flipped; });
  });
  wirePress();
  wireZoom();
  wireMinimap();
  wireSize();
  wireCrissProgress(id, board, function () { return play; }, joinSaved);
  render();

  function wordChip(w, home) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = w.word;
    chip.addEventListener('click', function () { onTap(tapWord(play, w.index, board)); });
    home.appendChild(chip);
    return chip;
  }

  // Every tap that puts a word in, takes one out or moves one is saved, signed in.
  function onTap(next) {
    saveTap(id, board, play, next);
    before = play;
    play = next;
    render();
    play.events.forEach(function (e) { CRISS_EVENTS[e](); });
  }

  // Signed in mid-shape: the shape saved elsewhere joins the one on screen.
  function joinSaved(saved) {
    play = joinedCriss(play, saved, board);
    render();
  }

  // Each square as the play has it, the words crossed off and the groups dimmed, the line over the
  // words, the count, the line under the shape, and the little map.
  function render() {
    var status = crissStatus(play, board);
    squareMarks(play, board).forEach(function (m) {
      var square = squares.get(m.key);
      square.querySelector('.ch').textContent = m.letter;
      square.classList.toggle('picked', m.picked);
      square.classList.toggle('given', m.given);
      square.setAttribute('aria-label', m.label);
    });
    wordGroups(play, board).forEach(function (g, i) {
      crissEl('groups').children[i].classList.toggle('dim', g.dim);
      g.words.forEach(function (w) {
        [chips.get(w.index), strips.get(w.index)].forEach(function (chip) { markChip(chip, w); });
        strips.get(w.index).hidden = !w.picked;
      });
    });
    pickingLine(play, board).forEach(function (part, i) {
      ['picking', 'strip-picking'].forEach(function (id) { crissEl(id).children[i].textContent = part; });
    });
    crissEl('count').textContent = crissCount(play, board);
    crissEl('complete').textContent = status.text;
    crissEl('complete').dataset.state = status.state;
    drawMinimap();
  }

  // The squares of the word just placed drop their letters in.
  function dropLetters() {
    placedSquares(play, board, before).forEach(function (key) { restart(squares.get(key).querySelector('.ch'), 'drop'); });
  }

  // The squares whose letters refused a word shake red, then settle.
  function shakeClashes() {
    play.clashes.forEach(function (cell) {
      var square = squares.get(cell.join(','));
      restart(square, 'clash');
      setTimeout(function () { square.classList.remove('clash'); }, CRISS_CLASH_MS);
    });
  }

  // ---- The view ----

  // The shape behind the frame, both sides of the card alike, the zoom buttons, and the little map.
  function showView(next) {
    var state = minesZoomState(next, frame), playEl = crissEl('play');
    view = next;
    playEl.style.setProperty('--cell', view.cell + 'px');
    playEl.dataset.zoomable = String(state.zoomable);
    playEl.dataset.zoomed = String(state.zoomOut);
    crissEl('zoom-in').disabled = !state.zoomIn;
    crissEl('zoom-out').disabled = !state.zoomOut;
    ['world', 'solution-world'].forEach(function (id) { crissEl(id).style.transform = worldTransform(view); });
    drawMinimap();
  }

  // ---- Pressing, dragging and pinching ----

  // A press that moves further than a tap would drags the shape; two fingers pinch it. Either way
  // its lift picks nothing, and a key's press — no pointer — always picks.
  function wirePress() {
    var front = crissEl('view');
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

  // One finger, or the mouse, once it has moved: the shape goes with it, from where it went down.
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
      crissEl('zoom-' + way).addEventListener('click', function () { showView(minesZoom(view, zoomFactor(way), frame, board)); });
    });
    crissEl('view').addEventListener('wheel', function (e) { WHEELS[e.ctrlKey](e); }, { passive: false });
  }

  function wheelZoom(e) {
    e.preventDefault();
    showView(minesZoom(view, wheelFactor(e.deltaY), frame, board));
  }

  // ---- The little map ----

  // Its box dragged, and its sizes picked: a new size fits the shape to the window again, since on
  // a phone the map's row stays on screen with the card.
  function wireMinimap() {
    var canvas = crissEl('minimap');
    document.querySelectorAll('[data-map-size]').forEach(function (button) {
      button.addEventListener('click', function () {
        mapSize = button.dataset.mapSize;
        document.querySelectorAll('[data-map-size]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
        sizeShape();
      });
    });
    canvas.addEventListener('pointerdown', function (e) {
      var last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      minimapMove = function (m) {
        var to = { x: m.clientX, y: m.clientY };
        showView(dragView(view, last, to, minimap.scale, frame, board));
        last = to;
      };
    });
    canvas.addEventListener('pointermove', function (e) { minimapMove(e); });
    ['pointerup', 'pointercancel'].forEach(function (type) { canvas.addEventListener(type, function () { minimapMove = noop; }); });
  }

  // The map at the size picked, within its room.
  function sizeMinimap(phone) {
    var canvas = crissEl('minimap'), ratio = window.devicePixelRatio;
    var room = { true: crissEl('dock'), false: crissEl('words-card') }[phone].clientWidth * CRISS_MINIMAP_ROOM[phone] - CRISS_MINIMAP_EDGES;
    minimap = minimapFit(board, CRISS_MINIMAP_SIZES[mapSize], room);
    canvas.style.width = minimap.width + 'px';
    canvas.style.height = minimap.height + 'px';
    canvas.width = Math.round(minimap.width * ratio);
    canvas.height = Math.round(minimap.height * ratio);
  }

  // The whole shape, each square in its ink, and the box round the view.
  function drawMinimap() {
    var canvas = crissEl('minimap'), map = canvas.getContext('2d'), ratio = window.devicePixelRatio;
    var box = minimapBox(view, frame);
    map.setTransform(1, 0, 0, 1, 0, 0);
    map.clearRect(0, 0, canvas.width, canvas.height);
    map.setTransform(ratio * minimap.scale, 0, 0, ratio * minimap.scale, 0, 0);
    minimapSquares(play, board).forEach(function (s) {
      map.fillStyle = crissInk(CRISS_MINIMAP_INKS[s.ink]);
      map.fillRect(s.x + 0.06, s.y + 0.06, 0.88, 0.88);
    });
    map.strokeStyle = crissInk('--band');
    map.lineWidth = minimapPens(minimap.scale).box;
    map.strokeRect(box.x, box.y, box.width, box.height);
  }

  // ---- The frame ----

  function wireSize() {
    window.addEventListener('resize', sizeShape);
    document.fonts.ready.then(sizeShape);
    sizeShape();
  }

  // The frame fits the page's width and the window's height, as big as it can be: measured once
  // drawn, and again on every resize. The card's edges round the frame are its borders and its
  // padding, either side; beside it, wider than a phone, the Words card; under it, on a phone, the
  // little map and the words of the slot picked.
  function sizeShape() {
    var playEl = crissEl('play'), face = crissEl('front'), frameEl = crissEl('view');
    var phone = isPhone(document.documentElement.clientWidth);
    var next, fitted;
    sizeMinimap(phone);
    next = crissFrame({
      viewHeight: window.innerHeight,
      chromeHeight: face.offsetHeight - frameEl.offsetHeight + CRISS_WINDOW_MARGIN + { true: CRISS_GAP + crissEl('dock').offsetHeight, false: 0 }[phone],
      width: playEl.clientWidth,
      chromeWidth: face.offsetWidth - face.clientWidth + 2 * crissEl('board').offsetLeft + CRISS_SIDE_ROOM[phone],
      rows: board.rows, cols: board.cols
    });
    fitted = fitView(view, frame, next, board);
    frame = next;
    fitView = minesRefit;
    playEl.style.setProperty('--frame-w', frame.width + 'px');
    playEl.style.setProperty('--frame-h', frame.height + 'px');
    showView(fitted);
    // Beside the card, the map and the Words card take no more than its height.
    playEl.style.setProperty('--card-h', crissEl('stage').offsetHeight + 'px');
    playEl.style.setProperty('--map-h', crissEl('map-box').offsetHeight + 'px');
  }
}

// An animation started again from its beginning.
function restart(el, name) {
  el.classList.remove(name);
  void el.getBoundingClientRect();
  el.classList.add(name);
}

function crissInk(property) {
  return window.getComputedStyle(crissEl('play')).getPropertyValue(property).trim();
}

// A word's chip as the play has it: crossed off once in the shape, the starting word for good.
function markChip(chip, w) {
  chip.classList.toggle('used', w.used);
  chip.classList.toggle('given', w.given);
  chip.disabled = w.given;
  chip.title = w.title;
}

// A group of the Words card: its length, then its words.
function groupBox(g) {
  var group = document.createElement('div'), heading = document.createElement('h3'), list = document.createElement('div');
  group.className = 'group';
  heading.textContent = g.heading;
  list.className = 'chips';
  group.append(heading, list);
  return group;
}

// A square on the front is a button, its number in the corner and its letter in the middle: a tap
// picks a slot through it.
function squareButton(s) {
  var button = document.createElement('button'), number = document.createElement('span'), letter = document.createElement('span');
  button.type = 'button';
  button.className = 'criss-square';
  number.className = 'num';
  number.textContent = s.number;
  letter.className = 'ch';
  button.append(number, letter);
  button.dataset.key = s.key;
  button.style.gridArea = (s.cell[0] + 1) + ' / ' + (s.cell[1] + 1);
  return button;
}

// A square of the answer: its letter.
function answerSquare(s) {
  var square = document.createElement('span');
  square.className = 'criss-square';
  square.textContent = s.letter;
  square.dataset.key = s.key;
  square.style.gridArea = (s.cell[0] + 1) + ' / ' + (s.cell[1] + 1);
  return square;
}
