// A criss-cross's printout: one 8.5×11 sheet, its title, difficulty and code, the one-line rule, the
// empty shape with its starting word written in, and the list grouped by length under it, black and
// white (styles/crisscross.css). Drawn from the shape alone into a .criss-sheet — the criss-cross
// page's own, or the book's copy of it — so the printout and the book's page are one layout, and
// nothing the player placed can reach the paper. Every rule is core/crisscross/play-core.js's: the
// shape as a fresh play shows it (squareMarks), the list as the Words card groups it (wordGroups).
import { CRISS_PRINTED_RULE, newCrissPlay, crissSquares, squareMarks, wordGroups } from '../../core/crisscross/play-core.js';
import { drawIdent } from '../card-ui.js';

// The sheet's parts are found by name, never by id, so a copy of the sheet in the book draws the
// same way.
export function drawCrissSheet(sheet, board) {
  var part = function (name) { return sheet.querySelector('[data-part="' + name + '"]'); };
  var fresh = newCrissPlay(board);
  var marks = squareMarks(fresh, board);
  part('title').textContent = board.title;
  drawIdent(part, board);
  part('rule').textContent = CRISS_PRINTED_RULE;
  sheet.style.setProperty('--cols', board.cols);
  sheet.style.setProperty('--rows', board.rows);
  part('grid').replaceChildren.apply(part('grid'), crissSquares(board).map(function (s, i) { return paperSquare(s, marks[i].letter); }));
  part('words').replaceChildren.apply(part('words'), wordGroups(fresh, board).map(paperGroup));
}

// A square on paper, where it sits in the shape: the starting word's letter, or blank for the pencil.
function paperSquare(s, letter) {
  var square = document.createElement('span');
  square.textContent = letter;
  square.style.gridArea = (s.cell[0] + 1) + ' / ' + (s.cell[1] + 1);
  return square;
}

// A group of the list: its length, then its words, the starting word crossed off.
function paperGroup(g) {
  var group = document.createElement('div'), heading = document.createElement('h3');
  group.className = 'criss-paper-group';
  heading.textContent = g.heading;
  group.append.apply(group, [heading].concat(g.words.map(function (w) {
    var word = document.createElement('p');
    word.textContent = w.word;
    word.classList.toggle('given', w.given);
    return word;
  })));
  return group;
}
