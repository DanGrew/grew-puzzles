// The maze play page's DOM: loads the maze a play URL names, draws it and its solution from
// play-core's board, and wires the taps, the flip, the checklist and the completion pop. Every
// rule lives in core/maze/play-core.js; nothing here decides anything.
import {
  mazeUrl, mazeBoard, newMazePlay, tapMaze, checklist, mazeFinished, checklistCount, trailPoints, stopMarks, zoneMarks,
  solutionMarks, mazeCellSize
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

function mazeEl(id) {
  return document.getElementById(id);
}

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

// The maze on its own play page: the maze in the grid card, its solution on the card's back, and
// the checklist where a wordsearch's words would be. Its hidden ID only picks its character.
function showMaze(puzzle) {
  var board = mazeBoard(puzzle);
  var play = newMazePlay(board);
  document.title = board.title + ' · Grew Puzzles';
  mazeEl('title').textContent = board.title;
  mazeEl('created').textContent = board.created;
  mazeEl('label').textContent = board.label;
  mazeEl('solution-label').textContent = board.solutionLabel;
  mazeEl('play').style.setProperty('--cols', board.cols);
  mazeEl('play').style.setProperty('--rows', board.rows);
  drawMaze(mazeEl('grid'), mazeEl('marks'), mazeEl('lines'), board, function (r, c) {
    var cell = document.createElement('button');
    cell.type = 'button';
    cell.setAttribute('aria-label', 'Row ' + (r + 1) + ', column ' + (c + 1));
    cell.addEventListener('click', function () { onTap([r, c]); });
    return cell;
  });
  drawMaze(mazeEl('solution-grid'), mazeEl('solution-marks'), mazeEl('solution-lines'), board, function () {
    return document.createElement('span');
  });
  drawSolution(mazeEl('solution-lines'), solutionMarks(board));
  checklist(play, board).forEach(function () { mazeEl('checklist').appendChild(checklistLine()); });
  mazeEl('play').hidden = false;
  dressMaze(new URLSearchParams(location.search).get('id'));
  wireFlip(function () {});
  wireSize();
  render();

  function onTap(cell) {
    play = tapMaze(play, cell, board);
    render();
    play.events.forEach(function (e) { MAZE_EVENTS[e](); });
  }

  // The trail, the stops picked up or stepped on, the open zones, the checklist and its count.
  function render() {
    mazeEl('trail').setAttribute('points', trailPoints(play.trail));
    var here = play.trail[play.trail.length - 1];
    mazeEl('here').setAttribute('cx', here[1] + 0.5);
    mazeEl('here').setAttribute('cy', here[0] + 0.5);
    stopMarks(play, board).forEach(function (m) {
      var stop = mazeEl('grid').querySelector('[data-stop="' + m.id + '"]');
      stop.classList.toggle('got', m.got);
      stop.dataset.mark = m.mark;
    });
    zoneMarks(play, board).forEach(function (z) {
      mazeEl('marks').querySelector('[data-key="' + z.key + '"]').classList.toggle('open', z.open);
    });
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
  }

  // A refused step flashes each zone whose key it needed, with its key's number.
  function flashLocked() {
    play.locked.forEach(function (key) {
      var zone = mazeEl('marks').querySelector('[data-key="' + key + '"]');
      zone.classList.remove('flash');
      void zone.offsetWidth;
      zone.classList.add('flash');
    });
  }

  var MAZE_EVENTS = { complete: celebrate, locked: flashLocked };
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

// The maze on one side of the card: a cell per square — each its stop, if it has one — under its
// blocks and zones, under its walls, under the trail. makeCell makes each cell: a button on the
// front, a plain square on the back.
function drawMaze(grid, marks, lines, board, makeCell) {
  var stops = new Map(board.stops.map(function (s) { return [s.cell.join(','), s]; }));
  Array.from({ length: board.rows }, function (_, r) {
    Array.from({ length: board.cols }, function (_, c) {
      var cell = makeCell(r, c);
      cell.className = 'maze-cell';
      [stops.get(r + ',' + c)].filter(Boolean).forEach(function (s) { cell.appendChild(stopMark(s)); });
      grid.appendChild(cell);
    });
  });
  grid.children[board.start[0] * board.cols + board.start[1]].classList.add('start');
  board.blocks.forEach(function (b) { marks.appendChild(placed('block', b[0], b[1], 2, 2)); });
  board.zones.forEach(function (z) {
    var zone = placed('zone', z.top, z.left, z.bottom - z.top + 1, z.right - z.left + 1);
    zone.dataset.key = z.key;
    marks.appendChild(zone);
  });
  lines.setAttribute('viewBox', '0 0 ' + board.cols + ' ' + board.rows);
  lines.appendChild(svgPart('path', { class: 'walls', d: board.walls }));
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

// The solution side: the detours in green under the main path in blue, then a dot on the right
// exit and a cross on each wrong one, at the cell's top-right corner, clear of the exit's code.
function drawSolution(lines, marks) {
  lines.appendChild(svgPart('path', { class: 'detour', d: marks.detours }));
  lines.appendChild(svgPart('polyline', { class: 'main', points: marks.main }));
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

// The grid card fits the window's height, as big as it can be: measured once drawn, and again on
// every resize.
function wireSize() {
  window.addEventListener('resize', sizeMaze);
  document.fonts.ready.then(sizeMaze);
  sizeMaze();
}

function sizeMaze() {
  var play = mazeEl('play'), face = mazeEl('front').getBoundingClientRect(), grid = mazeEl('grid').getBoundingClientRect();
  var width = document.documentElement.clientWidth;
  play.style.setProperty('--cell', mazeCellSize({
    viewHeight: window.innerHeight, chromeHeight: face.height - grid.height + MAZE_WINDOW_MARGIN,
    width: play.clientWidth, chromeWidth: face.width - grid.width + MAZE_CHECKLIST_ROOM[isPhone(width)],
    rows: Number(play.style.getPropertyValue('--rows')), cols: Number(play.style.getPropertyValue('--cols'))
  }) + 'px');
}
