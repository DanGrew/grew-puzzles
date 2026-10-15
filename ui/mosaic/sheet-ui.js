// A mosaic's printout: one 8.5×11 sheet, its title — Mosaic 007, never the picture's name — its
// difficulty and code, the one-line rule, and the numbers in a grid as big as the page allows,
// black and white (styles/mosaic.css). Drawn from the board alone into a .mosaic-sheet — the mosaic
// page's own, or the book's copy of it — so the printout and the book's page are one layout, and
// nothing the player shaded can reach the paper. Every rule is core/mosaic/play-core.js's
// (paperSquares); nothing here decides anything.
import { paperSquares } from '../../core/mosaic/play-core.js';
import { drawIdent } from '../card-ui.js';

// The sheet's parts are found by name, never by id, so a copy of the sheet in the book draws the
// same way.
export function drawMosaicSheet(sheet, board) {
  var part = function (name) { return sheet.querySelector('[data-part="' + name + '"]'); };
  part('title').textContent = board.title;
  drawIdent(part, board);
  sheet.style.setProperty('--cols', board.cols);
  sheet.style.setProperty('--rows', board.rows);
  part('grid').replaceChildren.apply(part('grid'), paperSquares(board).map(paperSquare));
}

// A square on paper: its number, or blank for the pencil, and a heavier line after every fifth.
function paperSquare(s) {
  var square = document.createElement('span');
  square.textContent = s.number;
  square.dataset.right = String(s.right);
  square.dataset.below = String(s.below);
  return square;
}
