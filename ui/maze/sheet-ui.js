// A maze's printout: one 8.5×11 sheet, its title centred at the top, the note box of what to find at
// the top right, and the blank maze under them, 0.2 in a cell (styles/maze.css). Drawn into a
// .maze-sheet — the maze page's own, or the book's copy of it — so the printout and the book's page
// are one layout. What it draws is core/maze/play-core.js's (printedMaze, printedNote); nothing
// here decides anything.
import { printedMaze, printedNote } from '../../core/maze/play-core.js';
import { dressOf, figureFile } from '../../core/theme-core.js';
import { drawIdent } from '../card-ui.js';

var SHEET_SVG_NS = 'http://www.w3.org/2000/svg';

// Each stop as paper draws it, in its cell from the cell's top-left corner: a guide a small dot, a
// collectible a dot — or Colour and Black and white, the puzzle's character — a key a box reading
// KEY and its number, a letter a disc, an exit or the end a pill with its letter order or End.
var SHEET_STOPS = {
  guide: function () { return [sheetPart('circle', { class: 'ms-guide', cx: 0.5, cy: 0.5, r: 0.16 })]; },
  collectible: function () {
    return [sheetPart('circle', { class: 'ms-dot', cx: 0.5, cy: 0.5, r: 0.24 }), sheetFigure(0.04, 0.92)];
  },
  key: function (stop) {
    return [sheetPart('rect', { class: 'ms-key', x: 0.05, y: 0.18, width: 0.9, height: 0.64, rx: 0.12 }), sheetText('ms-key-text', 0.5, 0.5, stop.label)];
  },
  letter: function (stop) {
    return [sheetPart('circle', { class: 'ms-letter', cx: 0.5, cy: 0.5, r: 0.4 }), sheetText('ms-letter-text', 0.5, 0.52, stop.label)];
  },
  exit: function (stop) {
    return [sheetPart('rect', { class: 'ms-exit', x: 0.03, y: 0.24, width: 0.94, height: 0.52, rx: 0.26 }), sheetText('ms-exit-text', 0.5, 0.51, stop.label)];
  },
  end: function (stop) {
    return [sheetPart('rect', { class: 'ms-end', x: 0.03, y: 0.24, width: 0.94, height: 0.52, rx: 0.26 }), sheetText('ms-end-text', 0.5, 0.51, stop.label)];
  }
};

// The sheet's parts are found by name, never by id, so a copy of the sheet in the book draws the
// same way.
export function drawMazeSheet(sheet, board) {
  var part = function (name) { return sheet.querySelector('[data-part="' + name + '"]'); };
  var maze = printedMaze(board);
  part('title').textContent = board.title;
  drawIdent(part, board);
  sheet.style.setProperty('--cols', board.cols);
  sheet.style.setProperty('--rows', board.rows);
  part('note').replaceChildren.apply(part('note'), printedNote(board).map(noteLine));
  part('maze').setAttribute('viewBox', maze.viewBox);
  part('maze').replaceChildren.apply(part('maze'), [sheetAt(maze.start, [sheetPart('rect', { class: 'ms-start', width: 1, height: 1 })])]
    .concat(maze.zones.map(sheetZone))
    .concat([sheetPart('path', { class: 'ms-walls', d: maze.walls })])
    .concat(maze.blocks.map(sheetBlock))
    .concat(maze.stops.map(function (stop) { return sheetAt(stop, SHEET_STOPS[stop.kind](stop)); })));
}

// Printed Colour or Black and white, the sheet wears the puzzle's character on its collectibles and
// blocks, and its background, faint, behind the paper (styles/look.css) — start is the element
// that holds it: the maze page's root, or the book's page. No character dresses nothing.
export function dressMazeSheet(sheet, start, character) {
  start.style.setProperty('--paper-scene', dressOf(character).scene);
  sheet.querySelectorAll('.ms-figure').forEach(function (figure) { figure.setAttribute('href', figureFile(character)); });
  sheet.dataset.dressed = String(figureFile(character) !== '');
}

// A line of the note box: the group's name, then a box for each thing — empty, or labelled with a
// key's number, a letter or an exit's letter order.
function noteLine(line) {
  var li = document.createElement('div');
  var name = document.createElement('span');
  var boxes = document.createElement('span');
  li.className = 'note-line';
  name.className = 'note-name';
  name.textContent = line.name;
  boxes.className = 'note-boxes';
  line.boxes.forEach(function (label) {
    var box = document.createElement('span');
    box.className = 'note-box';
    box.dataset.long = String(label.length > 1);
    box.textContent = label;
    boxes.appendChild(box);
  });
  li.append(name, boxes);
  return li;
}

function sheetZone(zone) {
  return sheetAt(zone, [
    sheetPart('rect', { class: 'ms-zone', width: zone.width, height: zone.height }),
    sheetText('ms-zone-text', 0.14, 0.42, zone.label)
  ]);
}

// A block lies over two cells each way, and over the walls, so none crosses it: solid on Plain,
// the character on a white tile otherwise.
function sheetBlock(block) {
  return sheetAt(block, [sheetPart('rect', { class: 'ms-block', x: 0.08, y: 0.08, width: 1.84, height: 1.84, rx: 0.15 }), sheetFigure(0.18, 1.64)]);
}

// The character's figure, from a corner inset in its cell or block, so many cells square — its
// image set once the character is known (dressMazeSheet).
function sheetFigure(inset, size) {
  return sheetPart('image', { class: 'ms-figure', x: inset, y: inset, width: size, height: size, preserveAspectRatio: 'xMidYMid meet' });
}

function sheetAt(at, parts) {
  var group = sheetPart('g', { transform: 'translate(' + at.x + ' ' + at.y + ')' });
  group.append.apply(group, parts);
  return group;
}

function sheetText(className, x, y, text) {
  var label = sheetPart('text', { class: className, x: x, y: y });
  label.textContent = text;
  return label;
}

function sheetPart(name, attributes) {
  var part = document.createElementNS(SHEET_SVG_NS, name);
  Object.keys(attributes).forEach(function (a) { part.setAttribute(a, attributes[a]); });
  return part;
}
