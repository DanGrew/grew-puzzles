// A mosaic's printout: one 8.5×11 sheet, its title — Mosaic 007, never the picture's name — its
// difficulty and code, the one-line rule, and the numbers in a grid as big as the page allows,
// black and white (styles/mosaic.css) — printed Colour or Black and white, on its background with
// its character (dressMosaicSheet), its squares still black and white. Drawn from the board alone
// into a .mosaic-sheet — the mosaic page's own, or the book's copy of it — so the printout and the
// book's page are one layout, and nothing the player shaded can reach the paper. Every rule is
// core/mosaic/play-core.js's (paperSquares); nothing here decides anything.
import { paperSquares } from '../../core/mosaic/play-core.js';
import { dressOf, mosaicPrintFrame, printDress } from '../../core/theme-core.js';
import { drawIdent } from '../card-ui.js';
import { dressPrintSheet } from '../theme-ui.js';

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

// Printed Colour or Black and white, the sheet wears the board's background, faint, to the paper's
// edge, and its character peering from behind the board at a spot picked at random each time it
// prints, as a minesweeper board's does (core/theme-core.js printDress, mosaicPrintFrame;
// styles/look.css) — start holds the background and the sheet's rise: the mosaic page's root, or
// the book's page, whose sheet carries its puzzle number.
export function dressMosaicSheet(sheet, start, board, character, numbered, random) {
  var frame = mosaicPrintFrame(board.cols, board.rows, numbered);
  start.style.setProperty('--paper-scene', dressOf(character).scene);
  dressPrintSheet(sheet.querySelector('.print-card'), start, character, printDress('one', frame, character, random));
}

// A square on paper: its number, or blank for the pencil, and a heavier line after every fifth.
function paperSquare(s) {
  var square = document.createElement('span');
  square.textContent = s.number;
  square.dataset.right = String(s.right);
  square.dataset.below = String(s.below);
  return square;
}
