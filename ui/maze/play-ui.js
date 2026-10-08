// The maze play page's DOM: loads the maze a play URL names, draws it and its solution from
// play-core's board, and wires the taps, the control pad and its keys, the zoom, the little map,
// the flip, the checklist and the completion pop. Every rule lives in core/maze/play-core.js;
// nothing here decides anything. Only the cells in a window round the view are ever drawn, so a
// maze of any size plays.
import {
  mazeUrl, mazeBoard, newMazePlay, tapMaze, padMaze, padState, padKey, trailEnd, trailDraw, keyCall, checklist,
  mazeFinished, checklistCount, trailPoints, stopMarks, zoneMarks, solutionMarks, windowDetours, wallPath, mazeFrame,
  openView, refitView, centreOn, zoomView, zoomFactor, pinchFactor, wheelFactor, zoomState, worldTransform, viewWindow,
  windowHolds, windowCells, windowMarks, minimapSize, minimapPens, minimapBox, minimapStops, minimapTrail, dragView
} from '../../core/maze/play-core.js';
import { playJson } from '../../core/wordsearch/play-core.js';
import { characterFor, isPhone } from '../../core/theme-core.js';
import { withCharacters, dressFigure } from '../theme-ui.js';
import { wireFlip, celebrate } from '../card-ui.js';

var MAZE_SVG_NS = 'http://www.w3.org/2000/svg';
// Beside the grid card, the checklist card and the gap before it; on a phone it sits underneath.
var MAZE_CHECKLIST_ROOM = { true: 0, false: 268 };
// Room under the grid card when it fills the window's height, so its shadow and edge show.
var MAZE_WINDOW_MARGIN = 24;
// On a phone the control pad sits under the grid card, the page's gap above it, and stays on
// screen with the card.
var MAZE_PAD_GAP = 28;
// The little map's longer side, px.
var MAZE_MINIMAP_SIZE = 112;
// Each kind's colour on the little map: a property of styles/maze.css's.
var MAZE_MINIMAP_INKS = { collectible: '--maze-collectible', key: '--maze-key', letter: '--maze-letter', exit: '--fg', end: '--fg' };
var MAZE_MINIMAP_FADE = { true: 0.3, false: 1 };

function mazeEl(id) {
  return document.getElementById(id);
}

function noop() {}

export function openMazePage(search) {
  Promise.resolve(search)
    .then(mazeUrl)
    .then(function (url) { return fetch(url); })
    .then(playJson)
    .then(showMaze, showMissing);
}

function showMissing() {
  document.title = 'Puzzle not found · Grew Puzzles';
  mazeEl('title').textContent = 'Puzzle not found';
  mazeEl('play').hidden = true;
  mazeEl('missing').hidden = false;
}

// The maze on its own play page: the maze in the grid card, its solution on the card's back, the
// control pad and the checklist where a wordsearch's words would be. Its hidden ID only picks its
// character.
function showMaze(puzzle) {
  var board = mazeBoard(puzzle);
  var play = newMazePlay(board);
  var frame = { fit: 0, width: 0, height: 0 };
  var view = { cell: 1, x: 0, y: 0 };
  // The window of cells drawn: none, until the first view.
  var shown = { top: 0, left: 0, bottom: -1, right: -1 };
  // The first frame opens the maze; every one after refits it.
  var fitView = function (v, before, next) { return openView(next, board); };
  var minimap = minimapSize(board, MAZE_MINIMAP_SIZE);
  var mapWalls = document.createElement('canvas');
  var minimapMove = noop;
  var touches = new Map();
  var pinch = { from: [], view: view };
  var WINDOW_DRAWS = { true: noop, false: drawWindow };
  var MAZE_EVENTS = { complete: celebrate, locked: flashLocked };
  var KEY_PRESSES = { true: noop, false: pressKey };
  var PINCHES = { true: pinchTo, false: noop };
  var TOUCH_MOVES = { true: touchMove, false: noop };
  var WHEELS = { true: wheelZoom, false: noop };

  document.title = board.title + ' · Grew Puzzles';
  mazeEl('title').textContent = board.title;
  mazeEl('created').textContent = board.created;
  mazeEl('label').textContent = board.label;
  mazeEl('solution-label').textContent = board.solutionLabel;
  mazeEl('play').style.setProperty('--cols', board.cols);
  mazeEl('play').style.setProperty('--rows', board.rows);
  ['lines', 'solution-lines'].forEach(function (id) { mazeEl(id).setAttribute('viewBox', '0 0 ' + board.cols + ' ' + board.rows); });
  drawSolution(mazeEl('solution-lines'), solutionMarks(board));
  checklist(play, board).forEach(function () { mazeEl('checklist').appendChild(checklistLine()); });
  mazeEl('play').hidden = false;
  dressMaze(new URLSearchParams(location.search).get('id'));
  wireFlip(function () { mazeEl('pad').inert = mazeEl('card').classList.contains('flipped'); });
  wirePad();
  wireZoom();
  wireMinimap();
  wireSize();
  render(trailDraw(play, play));

  function onTap(cell) {
    move(tapMaze(play, cell, board));
  }

  function onPress(press) {
    move(padMaze(play, press, board));
  }

  // Every move keeps the player in the centre, gliding there, at the zoom it's at.
  function move(next) {
    var draw = trailDraw(play, next);
    play = next;
    showView(centreOn(view, trailEnd(play), frame, board), true);
    render(draw);
    play.events.forEach(function (e) { MAZE_EVENTS[e](); });
  }

  // The trail — its new steps drawn on, cutting short any still drawing — where the player stands,
  // the stops picked up or stepped on, the open zones, the checklist and its count, the pad, and
  // the little map.
  function render(draw) {
    var trail = mazeEl('trail'), here = trailEnd(play), state = padState(play, board);
    trail.setAttribute('points', trailPoints(play.trail));
    trail.setAttribute('stroke-dasharray', draw.total + ' ' + draw.total);
    mazeEl('lines').style.setProperty('--from', draw.from);
    mazeEl('lines').style.setProperty('--ms', draw.ms + 'ms');
    mazeEl('here').setAttribute('cx', here[1] + 0.5);
    mazeEl('here').setAttribute('cy', here[0] + 0.5);
    restart(trail, 'drawing');
    restart(mazeEl('here'), 'drawing');
    markStops();
    checklist(play, board).forEach(function (line, i) {
      var li = mazeEl('checklist').children[i];
      li.classList.toggle('done', line.done);
      li.dataset.mark = line.mark;
      li.querySelector('.line-text').textContent = line.text;
      li.querySelector('.progress').textContent = line.progress;
      li.querySelector('.mark').textContent = line.mark;
    });
    mazeEl('count').textContent = checklistCount(play, board);
    mazeEl('complete').hidden = !mazeFinished(play, board);
    mazeEl('pad').querySelectorAll('[data-press]').forEach(function (button) { button.disabled = !state[button.dataset.press]; });
    drawMinimap();
  }

  // The stops and zones drawn just now, each as the play has it.
  function markStops() {
    var marks = new Map(stopMarks(play, board).map(function (m) { return [m.id, m]; }));
    var open = new Map(zoneMarks(play, board).map(function (z) { return [String(z.key), z.open]; }));
    mazeEl('grid').querySelectorAll('[data-stop]').forEach(function (stop) {
      stop.classList.toggle('got', marks.get(stop.dataset.stop).got);
      stop.dataset.mark = marks.get(stop.dataset.stop).mark;
    });
    mazeEl('marks').querySelectorAll('[data-key]').forEach(function (zone) { zone.classList.toggle('open', open.get(zone.dataset.key)); });
  }

  // A refused step flashes each zone whose key it needed, and calls the keys' numbers beside the
  // trail's end.
  function flashLocked() {
    var call = keyCall(play), text = mazeEl('key-call');
    play.locked.forEach(function (key) {
      mazeEl('marks').querySelectorAll('[data-key="' + key + '"]').forEach(function (zone) { restart(zone, 'flash'); });
    });
    text.textContent = call.text;
    text.setAttribute('x', call.x);
    text.setAttribute('y', call.y);
    restart(text, 'flash');
  }

  // ---- The view ----

  // The maze behind the frame, both sides of the card alike, the zoom buttons, and the little map;
  // any cells newly on view are drawn first.
  function showView(next, glide) {
    var state = zoomState(next, frame), playEl = mazeEl('play');
    view = next;
    playEl.style.setProperty('--cell', view.cell + 'px');
    playEl.dataset.zoomed = String(state.zoomOut);
    playEl.dataset.zoomable = String(state.zoomable);
    mazeEl('zoom-in').disabled = !state.zoomIn;
    mazeEl('zoom-out').disabled = !state.zoomOut;
    WINDOW_DRAWS[windowHolds(shown, view, frame, board)]();
    ['world', 'solution-world'].forEach(function (id) {
      mazeEl(id).classList.toggle('glide', glide);
      mazeEl(id).style.transform = worldTransform(view);
    });
    drawMinimap();
  }

  // The cells in a window round the view, on both sides of the card, with their blocks, zones and
  // walls, and the solution's detours.
  function drawWindow() {
    var marks;
    shown = viewWindow(view, frame, board);
    marks = windowMarks(board, shown);
    fillWindow(mazeEl('grid'), mazeEl('marks'), mazeEl('walls'), marks, tapCell);
    fillWindow(mazeEl('solution-grid'), mazeEl('solution-marks'), mazeEl('solution-walls'), marks, plainCell);
    mazeEl('detours').setAttribute('d', windowDetours(board, shown));
    markStops();
  }

  function fillWindow(grid, marksEl, walls, marks, makeCell) {
    grid.replaceChildren.apply(grid, windowCells(board, shown).map(function (at) { return mazeCell(makeCell(at.cell), at); }));
    marksEl.replaceChildren.apply(marksEl, marks.blocks.map(function (b) { return placed('block', b[0], b[1], 2, 2); })
      .concat(marks.zones.map(zoneMark)));
    walls.setAttribute('d', wallPath(board.bits, shown));
  }

  // A cell on the front is a button: a tap steps the trail.
  function tapCell(cell) {
    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Row ' + (cell[0] + 1) + ', column ' + (cell[1] + 1));
    button.addEventListener('click', function () { onTap(cell); });
    return button;
  }

  // ---- The control pad, its keys and the zoom ----

  function wirePad() {
    mazeEl('pad').querySelectorAll('[data-press]').forEach(function (button) {
      button.addEventListener('click', function () { onPress(button.dataset.press); });
    });
    document.addEventListener('keydown', function (e) {
      [padKey(e)].filter(Boolean).forEach(function (press) { KEY_PRESSES[mazeEl('pad').inert](e, press); });
    });
  }

  // While the solution shows, the pad and its keys rest.
  function pressKey(e, press) {
    e.preventDefault();
    onPress(press);
  }

  // + and −; a pinch on the maze; a trackpad's pinch, or the wheel with Ctrl held.
  function wireZoom() {
    var front = mazeEl('view');
    ['in', 'out'].forEach(function (way) {
      mazeEl('zoom-' + way).addEventListener('click', function () { showView(zoomView(view, zoomFactor(way), frame, board, trailEnd(play)), false); });
    });
    front.addEventListener('pointerdown', function (e) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pinch = { from: Array.from(touches.values()), view: view };
    });
    front.addEventListener('pointermove', function (e) { TOUCH_MOVES[touches.has(e.pointerId)](e); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      front.addEventListener(type, function (e) {
        touches.delete(e.pointerId);
        pinch = { from: Array.from(touches.values()), view: view };
      });
    });
    front.addEventListener('wheel', function (e) { WHEELS[e.ctrlKey](e); }, { passive: false });
  }

  // Two fingers down pinch; one alone does nothing here.
  function touchMove(e) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    PINCHES[pinch.from.length === 2]();
  }

  function pinchTo() {
    showView(zoomView(pinch.view, pinchFactor(pinch.from, Array.from(touches.values())), frame, board, trailEnd(play)), false);
  }

  function wheelZoom(e) {
    e.preventDefault();
    showView(zoomView(view, wheelFactor(e.deltaY), frame, board, trailEnd(play)), false);
  }

  // ---- The little map ----

  // The walls are drawn once, at the map's size, and every redraw copies them.
  function wireMinimap() {
    var canvas = mazeEl('minimap'), ratio = window.devicePixelRatio;
    var pixels = [Math.round(minimap.width * ratio), Math.round(minimap.height * ratio)];
    var walls = mapWalls.getContext('2d');
    canvas.style.width = minimap.width + 'px';
    canvas.style.height = minimap.height + 'px';
    [canvas, mapWalls].forEach(function (c) { c.width = pixels[0]; c.height = pixels[1]; });
    walls.setTransform(ratio * minimap.scale, 0, 0, ratio * minimap.scale, 0, 0);
    walls.strokeStyle = mazeInk('--line');
    walls.lineWidth = minimapPens(minimap.scale).wall;
    walls.stroke(new Path2D(board.walls));
    canvas.addEventListener('pointerdown', function (e) {
      var last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      minimapMove = function (m) {
        var to = { x: m.clientX, y: m.clientY };
        showView(dragView(view, last, to, minimap.scale, frame, board), false);
        last = to;
      };
    });
    canvas.addEventListener('pointermove', function (e) { minimapMove(e); });
    ['pointerup', 'pointercancel'].forEach(function (type) { canvas.addEventListener(type, function () { minimapMove = noop; }); });
  }

  // The whole maze, the trail, the stops — those picked up faded — and the box round the view.
  function drawMinimap() {
    var canvas = mazeEl('minimap'), map = canvas.getContext('2d'), ratio = window.devicePixelRatio;
    var pens = minimapPens(minimap.scale), box = minimapBox(view, frame);
    map.setTransform(1, 0, 0, 1, 0, 0);
    map.globalAlpha = 1;
    map.clearRect(0, 0, canvas.width, canvas.height);
    map.drawImage(mapWalls, 0, 0);
    map.setTransform(ratio * minimap.scale, 0, 0, ratio * minimap.scale, 0, 0);
    map.lineCap = 'round';
    map.lineJoin = 'round';
    map.strokeStyle = mazeInk('--select');
    map.lineWidth = pens.trail;
    map.stroke(new Path2D(minimapTrail(play.trail)));
    minimapStops(play, board).forEach(function (stop) {
      map.globalAlpha = MAZE_MINIMAP_FADE[stop.got];
      map.fillStyle = mazeInk(MAZE_MINIMAP_INKS[stop.kind]);
      map.beginPath();
      map.arc(stop.x, stop.y, pens.dot, 0, 2 * Math.PI);
      map.fill();
    });
    map.globalAlpha = 1;
    map.strokeStyle = mazeInk('--band');
    map.lineWidth = pens.box;
    map.strokeRect(box.x, box.y, box.width, box.height);
  }

  // ---- The frame ----

  // The frame fits the window's height, as big as it can be: measured once drawn, and again on
  // every resize.
  function wireSize() {
    window.addEventListener('resize', sizeMaze);
    document.fonts.ready.then(sizeMaze);
    sizeMaze();
  }

  // On a phone the pad under the card stays on screen with it. The card's edges round the frame
  // are its borders and its padding, either side.
  function sizeMaze() {
    var playEl = mazeEl('play'), face = mazeEl('front'), frameEl = mazeEl('view');
    var phone = isPhone(document.documentElement.clientWidth);
    var next = mazeFrame({
      viewHeight: window.innerHeight,
      chromeHeight: face.offsetHeight - frameEl.offsetHeight + MAZE_WINDOW_MARGIN + { true: mazeEl('pad').offsetHeight + MAZE_PAD_GAP, false: 0 }[phone],
      width: playEl.clientWidth,
      chromeWidth: face.offsetWidth - face.clientWidth + 2 * mazeEl('board').offsetLeft + MAZE_CHECKLIST_ROOM[phone],
      rows: board.rows, cols: board.cols
    });
    var fitted = fitView(view, frame, next, board, trailEnd(play));
    frame = next;
    fitView = refitView;
    playEl.style.setProperty('--frame-w', frame.width + 'px');
    playEl.style.setProperty('--frame-h', frame.height + 'px');
    showView(fitted, false);
  }
}

// An animation started again from its beginning: a new move cuts the last one short.
function restart(el, name) {
  el.classList.remove(name);
  void el.getBoundingClientRect();
  el.classList.add(name);
}

function mazeInk(property) {
  return window.getComputedStyle(mazeEl('play')).getPropertyValue(property).trim();
}

// One line of the checklist: its name, its count, its mark.
function checklistLine() {
  var li = document.createElement('li');
  ['line-text', 'progress', 'mark'].forEach(function (name) {
    var part = document.createElement('span');
    part.className = name;
    li.appendChild(part);
  });
  return li;
}

// A cell on the back is a plain square.
function plainCell() {
  return document.createElement('span');
}

// A cell of the window in its place in the maze, the start highlighted, with its stop, if it has
// one.
function mazeCell(el, at) {
  el.className = 'maze-cell';
  el.dataset.cell = at.cell.join(',');
  el.style.gridArea = (at.cell[0] + 1) + ' / ' + (at.cell[1] + 1);
  el.classList.toggle('start', at.start);
  at.stops.forEach(function (s) { el.appendChild(stopMark(s)); });
  return el;
}

// A stop as the maze shows it: its kind's mark, and its label — a key's number, a letter, an
// exit's code, End.
function stopMark(stop) {
  var mark = document.createElement('span');
  mark.className = 'stop ' + stop.kind;
  mark.dataset.stop = stop.id;
  mark.dataset.label = stop.label;
  return mark;
}

function zoneMark(z) {
  var zone = placed('zone', z.top, z.left, z.bottom - z.top + 1, z.right - z.left + 1);
  zone.setAttribute('data-key', z.key);
  return zone;
}

// Something laid over the maze's cells, from a top-left cell, so many rows down and columns across.
function placed(kind, row, col, rows, cols) {
  var part = document.createElement('span');
  part.className = kind;
  part.style.gridArea = (row + 1) + ' / ' + (col + 1) + ' / span ' + rows + ' / span ' + cols;
  return part;
}

function svgPart(name, attributes) {
  var part = document.createElementNS(MAZE_SVG_NS, name);
  Object.keys(attributes).forEach(function (a) { part.setAttribute(a, attributes[a]); });
  return part;
}

// The solution side: the main path in blue over the detours (drawn with each window), then a dot
// on the right exit and a cross on each wrong one, at the cell's top-right corner, clear of the
// exit's code.
function drawSolution(lines, marks) {
  mazeEl('main').setAttribute('points', marks.main);
  marks.exits.forEach(function (e) {
    var x = e.cell[1] + 0.84, y = e.cell[0] + 0.1;
    var shapes = {
      true: function () { return svgPart('circle', { class: 'exit-right', cx: x, cy: y, r: 0.14 }); },
      false: function () { return svgPart('path', { class: 'exit-wrong', d: 'M' + (x - 0.13) + ' ' + (y - 0.13) + 'l.26 .26m0 -.26l-.26 .26' }); }
    };
    lines.appendChild(shapes[e.right]());
  });
}

// Themed, the maze's collectibles and blocks wear its theme character — the same one every visit;
// Plain, a collectible is a dot and a block a solid tile (styles/look.css).
function dressMaze(hiddenId) {
  withCharacters(function (characters) { dressFigure(mazeEl('play'), characterFor(characters, hiddenId)); });
}
