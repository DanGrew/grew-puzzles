// A minesweeper board's printout: one 8.5×11 sheet, its title, difficulty and code, the one-line
// rule with the board's mine count, and the grid as big as the page allows, black and white
// (styles/minesweeper.css) — printed Colour or Black and white, on its background with its
// character (dressMinesSheet). Drawn from the board alone into a .mines-sheet — the minesweeper
// page's own, or the book's copy of it — so the printout and the book's page are one layout, and
// nothing the player marked can reach the paper. Every rule is core/minesweeper/play-core.js's
// (minesSquares, printedRule); nothing here decides anything.
import { minesSquares, printedRule } from '../../core/minesweeper/play-core.js';
import { dressOf, minesPrintFrame, printDress } from '../../core/theme-core.js';
import { drawIdent } from '../card-ui.js';
import { dressPrintSheet } from '../theme-ui.js';

// The sheet's parts are found by name, never by id, so a copy of the sheet in the book draws the
// same way.
export function drawMinesSheet(sheet, board) {
  var part = function (name) { return sheet.querySelector('[data-part="' + name + '"]'); };
  part('title').textContent = board.title;
  drawIdent(part, board);
  part('rule').textContent = printedRule(board);
  sheet.style.setProperty('--cols', board.cols);
  sheet.style.setProperty('--rows', board.rows);
  part('grid').replaceChildren.apply(part('grid'), minesSquares(board).map(paperSquare));
}

// Printed Colour or Black and white, the sheet wears the board's background, faint, to the paper's
// edge, and its character peering from behind the board at a spot picked at random each time it
// prints (core/theme-core.js printDress, minesPrintFrame; styles/look.css) — start holds the
// background and the sheet's rise: the minesweeper page's root, or the book's page, whose sheet
// carries its puzzle number.
export function dressMinesSheet(sheet, start, board, character, numbered, random) {
  var frame = minesPrintFrame(board.cols, board.rows, numbered);
  start.style.setProperty('--paper-scene', dressOf(character).scene);
  dressPrintSheet(sheet.querySelector('.print-card'), start, character, printDress('one', frame, character, random));
}

// A square on paper: its number, or blank for the pencil.
function paperSquare(s) {
  var square = document.createElement('span');
  square.textContent = s.number;
  return square;
}
