// A maze's printout: one 8.5×11 sheet, its title centred at the top, the note box of what to find at
// the top right, and the blank maze under them, 0.2 in a cell (styles/maze.css). Drawn into a
// .maze-sheet — the maze page's own, or the book's copy of it — so the printout and the book's page
// are one layout. Every shape and where it goes is core/maze/play-core.js's (printedMaze,
// printedNote); nothing here decides anything.
import { printedMaze, printedNote } from '../../core/maze/play-core.js';
import { dressOf } from '../../core/theme-core.js';
import { drawIdent } from '../card-ui.js';
import { dressFigure } from '../theme-ui.js';

var SHEET_SVG_NS = 'http://www.w3.org/2000/svg';

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
  part('maze').replaceChildren.apply(part('maze'), maze.groups.map(sheetGroup));
  part('figures').replaceChildren.apply(part('figures'), maze.figures.map(sheetFigure));
}

// Printed Colour or Black and white, the sheet wears the puzzle's character on its collectibles and
// blocks, and its background, faint, behind the paper (styles/look.css) — start is the element
// that holds it: the maze page's root, or the book's page. Both are CSS images, so neither loads
// until paper shows them. No character dresses nothing.
export function dressMazeSheet(sheet, start, character) {
  start.style.setProperty('--paper-scene', dressOf(character).scene);
  dressFigure(sheet, character);
  sheet.dataset.dressed = String(dressOf(character).figure !== 'none');
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

function sheetGroup(group) {
  var g = document.createElementNS(SHEET_SVG_NS, 'g');
  g.setAttribute('transform', group.transform);
  g.append.apply(g, group.shapes.map(sheetShape));
  return g;
}

function sheetShape(shape) {
  var el = document.createElementNS(SHEET_SVG_NS, shape.name);
  Object.keys(shape.attributes).forEach(function (a) { el.setAttribute(a, shape.attributes[a]); });
  el.textContent = shape.text;
  return el;
}

// Where the character stands in for a collectible or a block, over its cells.
function sheetFigure(figure) {
  var el = document.createElement('span');
  el.className = 'ms-figure ' + figure.kind;
  el.style.gridArea = figure.area;
  return el;
}
