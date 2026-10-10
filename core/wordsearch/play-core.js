// The play page's rules: which puzzle a play URL names, where each word sits, what a tap
// does, and what the board shows. Pure — the DOM work is ui/wordsearch/play-ui.js. The
// puzzle file and the play URL are grew-puzzles-tooling's docs/PUZZLE-FORMAT.md. An ES module:
// the page imports it through ui/, and the unit tests import it directly.
import { puzzleDifficulty } from '../kind-core.js';
import { themeScale } from '../theme-core.js';

var PLAY_RING_KINDS = { 1: 'select', 2: 'wrong' };

// ---- Finding the puzzle ----

// The play URL names a wordsearch by its hidden ID — play.html?id=WSCH-0003 — and its file
// carries that name. Anything else names no puzzle, so it never becomes a path.
export function puzzleUrl(search) {
  var id = new URLSearchParams(search).get('id');
  if (!/^WSCH-[0-9]{4,}$/.test(id)) throw new Error('No such puzzle');
  return '../content/puzzles/wordsearch/' + id + '.json';
}

export function playJson(response) {
  if (!response.ok) throw new Error('No such puzzle');
  return response.json();
}

// ---- The board ----

export function wordCells(word) {
  var step = { N: [-1, 0], NE: [-1, 1], E: [0, 1], SE: [1, 1], S: [1, 0], SW: [1, -1], W: [0, -1], NW: [-1, -1] }[word.direction];
  return Array.from({ length: word.length }, function (_, i) {
    return [word.start.row + step[0] * i, word.start.col + step[1] * i];
  });
}

// A missing word is listed but sits in no grid, so it has no cells and no line; a placed word sits
// in the grid its own grid names, and its line — page, start cell and direction — is what a find
// of it saves (core/progress-core.js). text is the word as written, which its entry is found by;
// shown is how the list shows it — in capitals when the file asks for them (capitals), spaces and
// hyphens kept: ICE CREAM.
function boardWord(w, capitals) {
  return {
    text: w.word, shown: { true: w.word.toUpperCase(), false: w.word }[capitals], missing: Boolean(w.missing), grid: w.grid,
    cells: w.missing ? [] : wordCells(w),
    line: w.missing ? null : { page: w.grid, row: w.start.row, col: w.start.col, direction: w.direction }
  };
}

// A wildcard cell shows ? on the puzzle side only: the grid keeps its real letter, and the
// solution side shows it. wild marks those cells; a grid without wildcards has none.
function wildCells(grid, letters) {
  return letters.map(function (row, r) {
    return row.map(function (_, c) {
      return Boolean(grid.wildcards?.some(function (w) { return w.row === r && w.col === c; }));
    });
  });
}

function shownLetters(letters, wild) {
  return letters.map(function (row, r) {
    return row.map(function (letter, c) { return { true: '?', false: letter }[wild[r][c]]; });
  });
}

// One grid of the puzzle: letters are the real ones, for the solution side; shown is what the
// puzzle side shows.
function boardGrid(grid) {
  var letters = grid.rows.map(function (row) { return row.split(''); });
  var wild = wildCells(grid, letters);
  return { letters: letters, shown: shownLetters(letters, wild), wild: wild };
}

// A puzzle of several grids is played a page at a time, under tabs, and printed a grid to a
// sheet, each banded with its page; a puzzle of one grid has no tabs and no sheets of its own.
function pageNames(count, name) {
  var names = Array.from({ length: count }, function (_, i) { return name(i + 1, count); });
  return { true: names, false: [] }[count > 1];
}

// The type is the board's only label on screen: shown exactly as written, in the grid's header
// band. Under the title, its difficulty — the one its tile shows (puzzleDifficulty) — and its
// code, the hidden ID, so a player can name it. Every grid is the same size, so the first one
// sizes them all. letters is how big the grid's letters and the words are against a Vanilla's:
// 1.5× when the file asks for big letters (bigLetters), on screen at every text size and on paper.
// A page shows what the file carries — never what its type is called.
export function playBoard(puzzle) {
  var count = puzzle.grids.length;
  var capitals = Boolean(puzzle.capitals);
  return {
    letters: { true: 1.5, false: 1 }[Boolean(puzzle.bigLetters)],
    title: puzzle.title,
    difficulty: puzzleDifficulty(puzzle),
    code: puzzle.hiddenId,
    label: puzzle.type,
    solutionLabel: puzzle.type + ' · Solution',
    grids: puzzle.grids.map(boardGrid),
    tabs: pageNames(count, function (n) { return 'Page ' + n; }),
    sheets: pageNames(count, function (n, of) { return puzzle.type + ' · Page ' + n + ' of ' + of; }),
    rows: puzzle.grids[0].rows.length,
    cols: puzzle.grids[0].rows[0].length,
    words: puzzle.words.map(function (w) { return boardWord(w, capitals); })
  };
}

// The words a player can find — every listed word bar the missing ones, by index.
function placedWords(words) {
  return words.map(function (_, i) { return i; }).filter(function (i) { return !words[i].missing; });
}

// The words that sit in the grid on show, by index: the only ones a tap can find or the board
// marks. A missing word sits on no page.
function pageWords(indices, words, page) {
  return indices.filter(function (i) { return words[i].grid === page; });
}

// The puzzle ends on the last placed word: the player is never asked to find a missing one.
function solved(found, words) {
  return found.length === placedWords(words).length;
}

// ---- Tapping ----
// A play is { picked, found, events, page }: picked holds the selection's start, then its end
// (0–2 cells); found the indices of the words crossed off — each copy of a repeated word is its
// own entry, so its own find; events what this tap set off; page the grid on show, from 0.
// The start stays put: each later tap in line with it only points the line at that letter.

export function newPlay() {
  return restoredPlay([]);
}

// A puzzle reopened with its saved finds: each one found again, on Page 1, and nothing set off — a
// puzzle already finished doesn't celebrate again.
export function restoredPlay(found) {
  return { picked: [], found: found, events: [], page: 0 };
}

// The finds this tap made: the indices in after's found that before's didn't have.
export function newFinds(before, after) {
  return after.found.filter(function (i) { return !before.found.includes(i); });
}

// Finished is every placed word found, however the play got there — found now or found before.
export function finished(play, words) {
  return solved(play.found, words);
}

// The solution side of one page: every placed word found.
export function solvedPlay(words, page) {
  return { picked: [], found: placedWords(words), events: [], page: page };
}

// Another tab: its grid shows, the open selection goes, every find stays where it was.
export function turnPage(play, page) {
  return { picked: [], found: play.found, events: [], page: page };
}

function sameCell(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function inLine(a, b) {
  var dr = b[0] - a[0], dc = b[1] - a[1];
  return dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
}

function spans(cells, picked) {
  var first = cells[0], last = cells[cells.length - 1];
  return (sameCell(first, picked[0]) && sameCell(last, picked[1])) ||
    (sameCell(first, picked[1]) && sameCell(last, picked[0]));
}

function keep(play, picked) {
  return { picked: picked, found: play.found, events: [], page: play.page };
}

// Only a word's real placement counts — P then G inside PIGLET is not PIG — and only in the grid
// on show. A missing word has no placement, so no tap finds it.
function check(play, picked, words) {
  var hit = pageWords(placedWords(words), words, play.page).find(function (i) {
    return !play.found.includes(i) && spans(words[i].cells, picked);
  });
  if (hit === undefined) return keep(play, picked);
  var found = play.found.concat([hit]);
  return { picked: [], found: found, events: solved(found, words) ? ['complete'] : [], page: play.page };
}

function tapFirst(play, cell) {
  return keep(play, [cell]);
}

// Only the start deselects; a tap off its lines is ignored. Tapping the line's own end
// redraws the same line, so nothing changes.
function tapNext(play, cell, words) {
  var start = play.picked[0];
  if (sameCell(cell, start)) return keep(play, []);
  if (!inLine(start, cell)) return keep(play, play.picked);
  return check(play, [start, cell], words);
}

var PLAY_TAPS = [tapFirst, tapNext, tapNext];

export function tap(play, cell, words) {
  return PLAY_TAPS[play.picked.length](play, cell, words);
}

// ---- What the board shows ----

export function sharedCells(words) {
  var counts = {};
  words.forEach(function (w) {
    w.cells.forEach(function (c) {
      var k = JSON.stringify(c);
      counts[k] = (counts[k] || 0) + 1;
    });
  });
  return Object.keys(counts).filter(function (k) { return counts[k] > 1; }).map(function (k) { return JSON.parse(k); });
}

// The grid on show only. found: a line through each found word; shared: a ring on each letter
// two found words share; wrong: the red line of an open selection; rings: a ring on its start
// letter.
export function playMarks(play, words) {
  var done = pageWords(play.found, words, play.page).map(function (i) { return words[i]; });
  var start = play.picked.slice(0, 1);
  return {
    found: done.map(function (w) { return [w.cells[0], w.cells[w.cells.length - 1]]; }),
    shared: sharedCells(done),
    wrong: play.picked.slice(1).map(function (end) { return [start[0], end]; }),
    rings: start.map(function (cell) { return { cell: cell, kind: PLAY_RING_KINDS[play.picked.length] }; })
  };
}

// ---- The word list ----
// Every line of the list is described here, once: what it reads, the words it stands for, and how
// each is marked. The screen, the solution side, the printout and the book only draw it.
// A line is { kind, text, parts }: kind names how its parts are drawn (ui/wordsearch/play-ui.js);
// text is what the line reads; parts are the words it stands for, each with every copy of it in
// the file, by index, and how many of those copies found strike it. One mark per thing to find, so
// the list shows exactly what's left, on screen and on paper (the owner's call, 2026-10-10). A line
// of several words, or one marked once a page, is one more kind, its parts each marked as below.

// A word's lines sit together where it first appears — a word with several copies is listed once
// in the file per copy. A word of one copy, a missing one too, is a word line. On a Repeats puzzle a
// word of several copies is one boxes line, a box per copy; on any other type it is a copy line per
// copy, the first struck by the first copy found, whichever it is, the next by the next. type is the
// puzzle's, as its file names it. Each part's shown is the word as the list shows it (boardWord).
export function wordLines(words, type) {
  var texts = words.map(function (w) { return w.text; });
  return texts.filter(function (text, i) { return texts.indexOf(text) === i; }).flatMap(function (text) {
    var copies = texts.map(function (_, i) { return i; }).filter(function (i) { return texts[i] === text; });
    var word = { text: text, shown: words[copies[0]].shown, copies: copies };
    return { true: repeatedLines(word, type), false: [line('word', word, 1)] }[copies.length > 1];
  });
}

function repeatedLines(word, type) {
  var copyLines = word.copies.map(function (_, k) { return line('copy', word, k + 1); });
  return { true: [line('boxes', word, word.copies.length)], false: copyLines }[type === 'Repeats'];
}

function line(kind, word, strikes) {
  return { kind: kind, text: word.text, parts: [{ text: word.text, shown: word.shown, copies: word.copies, strikes: strikes }] };
}

// How every line is marked as the play stands, part by part, in the lines' order.
// done: struck, once as many of its word's copies are found as strike it; ticked: how many of its
// word's copies are found, so a boxes line ticks a box per copy, left to right in the order found;
// revealed: a missing word shown red — once every placed word is found, or while the solution shows
// (flipped); flipping back hides it again until the puzzle is done.
export function lineMarks(play, words, flipped, type) {
  var reveal = flipped || solved(play.found, words);
  return wordLines(words, type).map(function (line) {
    return { kind: line.kind, parts: line.parts.map(function (part) { return partMarks(part, play.found, words, reveal); }) };
  });
}

function partMarks(part, found, words, reveal) {
  var ticked = part.copies.filter(function (i) { return found.includes(i); }).length;
  return { done: ticked >= part.strikes, revealed: words[part.copies[0]].missing && reveal, ticked: ticked };
}

// A printed line, as the pieces it may wrap between: a line wraps only at a space, never inside a
// word.
export function printedPieces(text) {
  return text.split(' ');
}

// Paper's column, in whole pixels: as wide as the list's widest piece, so no word runs into the
// next — a longer line wraps at a space instead. styles/play.css keeps it 88px at the least.
export function printedColumnWidth(pieceWidths) {
  return Math.ceil(Math.max.apply(null, [0].concat(pieceWidths)));
}

// A words sheet of its own — a puzzle of several grids' (styles/play.css, data-paged) — fills its
// page: its words printed larger than paper's type, up to 1.5× it, and their rows spread down the
// sheet, never further apart than two lines, the owner's call 2026-10-10. A list too long for that
// shrinks back toward paper's type before it would spill onto a second sheet, never under it.
// lines is each printed line, measured in paper's own type: its width on one line, and how many
// pieces it may wrap into (printedPieces). type is that type's line height and the list's widest
// piece (printedColumnWidth). Back come the scale to print the words at and the gap under each.
// A boxes line is a Repeats puzzle's, of one grid, so it is never on a words sheet of its own.
export function printedSpread(lines, type, book) {
  var room = printedRoom(book);
  var scales = Array.from({ length: 11 }, function (_, i) { return (30 - i) / 20; });
  var spreads = scales.map(function (scale) { return spreadAt(scale, lines, type, room); });
  var spread = spreads.filter(function (s) { return s.gap >= s.least; }).concat([spreads[10]])[0];
  return { scale: spread.scale, gap: Math.floor(Math.max(spread.least, spread.gap) * 10) / 10 };
}

// The room a words sheet's list has on the paper, measured from the printout itself
// (tests/print.test.js checks it): across, inside the words card on the narrower of A4 and Letter,
// or on the book's page; down, from under the card's band to the sheet's half-inch edge, or in the
// book to above its page number — printed Colour, where the title's white tag sits the list lowest.
// A title of one line: a longer one only sits the list lower.
function printedRoom(book) {
  return [{ width: 662, height: 767 }, { width: 684, height: 703 }][Number(book)];
}

// The words at one scale, spaced as styles/play.css prints them: 14px between the columns, and
// under each line paper's 3px at least, scaled with its type. As many columns as fit across, each
// at least the widest piece, or 88px, and every line on one line where the column has room for it,
// else wrapped into its pieces. Paper balances the columns, so the tallest is at most an even share
// of the lines and gaps plus one whole line and its gap; gap is the most each line's gap can be for
// that to fit down the sheet, never more than two lines — under least, it doesn't fit.
function spreadAt(scale, lines, type, room) {
  var height = type.line * scale;
  var columns = Math.max(1, Math.floor((room.width + 14) / (Math.max(88, type.column) * scale + 14)));
  var across = (room.width - (columns - 1) * 14) / columns;
  var each = lines.map(function (line) { return [line.pieces, 1][Number(line.width * scale <= across)]; });
  var text = each.reduce(function (sum, n) { return sum + n; }, 0) * height / columns + Math.max.apply(null, each) * height;
  return { scale: scale, least: 3 * scale, gap: Math.min(2 * height, (room.height - text) / (lines.length / columns + 1)) };
}

// Out of the placed copies only: a missing word is never there to find.
export function countLabel(play, words) {
  return play.found.length + '/' + placedWords(words).length;
}

// ---- Where the words sit ----
// Under the grid, beside it, or in an overlay toggled over it — the player's choice, cycled in
// that order and kept per device. Overlay is the first-visit default.

export function nextWordsLayout(layout) {
  return { bottom: 'right', right: 'overlay', overlay: 'bottom' }[layout];
}

// read() returns the stored choice; a page that can't read it, or reads anything else, gets Overlay.
export function savedWordsLayout(read) {
  try {
    return knownWordsLayout(read());
  } catch (e) {
    return 'overlay';
  }
}

function knownWordsLayout(saved) {
  return ['bottom', 'right', 'overlay'].includes(saved) ? saved : 'overlay';
}

// Whether the choice was stored; a page that can't store it keeps it until it closes.
export function saveWordsLayout(write, layout) {
  return storeChoice(write, layout);
}

function storeChoice(write, choice) {
  try {
    write(choice);
    return true;
  } catch (e) {
    return false;
  }
}

// ---- How big the grid and its words are ----
// Five sizes, named by the grid's letters at their widest: Normal is the page as it has always
// been. The words scale with the letters, by the same ratio — one setting, so the word list
// keeps taking its size from the grid card. Kept per device, as where the words sit is.

function textSizeLetters() {
  return { tiny: 10, small: 15, normal: 22, large: 27, huge: 32 };
}

// The size's ratio to Normal: styles/play.css scales the grid's letters and the words by it.
export function textScale(size) {
  return textSizeLetters()[size] / textSizeLetters().normal;
}

// A puzzle's letters at a size: the size's ratio, times how big the puzzle's own letters are
// (playBoard's letters) — a Kids puzzle's Normal is 1.5× a Vanilla's.
export function boardScale(size, letters) {
  return textScale(size) * letters;
}

// The text-size menu, smallest first: each size, its name and whether it's the one picked.
export function textSizeMenu(picked) {
  var labels = { tiny: 'Tiny', small: 'Small', normal: 'Normal', large: 'Large', huge: 'Huge' };
  return Object.keys(textSizeLetters()).map(function (size) {
    return { size: size, label: labels[size], picked: size === picked };
  });
}

// read() returns the stored size; a page that can't read it, or reads anything else, gets Normal.
export function savedTextSize(read) {
  try {
    return knownTextSize(read());
  } catch (e) {
    return 'normal';
  }
}

function knownTextSize(saved) {
  return Object.keys(textSizeLetters()).includes(saved) ? saved : 'normal';
}

export function saveTextSize(write, size) {
  return storeChoice(write, size);
}

// How far the play area reaches past the page's column on each side, as the margins that take it
// there: to the screen's 24px edge on the right, and on the left too while there's no side bar
// beside the column — beside one, it starts where the column does, never over the side bar.
// column is the column's left and right across the screen, sideWidth the side bar's, 0 when it's
// not on show.
export function playReach(screenWidth, column, sideWidth) {
  const left = sideWidth > 0 ? column.left : 24;
  return { left: Math.min(0, left - column.left), right: Math.min(0, column.right - (screenWidth - 24)) };
}

// ---- How the words fill their card ----
// The list reads like the paper: down each column, then on to the next, no column more than one
// word longer than another. Its card takes its size from the grid card: under it, never wider and
// growing down; beside it, exactly as tall and growing into more columns, the words' text and then
// the grid's letters shrinking to leave the words room — or under it, as Bottom, when even the
// smallest leave none; over it, exactly its size, filling its height before adding columns, and
// scrolling down once no more fit across.
// m is the page measured in px: count words at the page's own wordSize text — the widest of
// wordWidths (each as revealed, so a reveal never reflows) and their rowHeight — and the list's
// colGap/rowGap; the grid's gridCols × gridRows letters at the page's own naturalCell size, and
// the grid card's band, tabs and edges round them (cardChromeWidth/cardChromeHeight); the words
// card's own chromeWidth/chromeHeight round its list; the page's pageWidth and pageGap between
// grid and list; the player's text size as its scale (boardScale); the puzzle's own letters
// (playBoard's); and room, what the words card leaves the character beside it under the grid at
// full size (theme-core's wordsRoom), 0 when there's none.
// sits is where the list goes; cell the grid's letter size, and cardWidth × cardHeight its card
// at that size; wordSize the words' text size; columns how many, wordWidth each column's, and
// places each word's [row, column], from 1; room the room left beside the words under the grid,
// shrunk with the grid card.
export function wordsFit(layout, measured) {
  var m = Object.assign({}, measured, { naturalCell: wholeCell(measured) });
  var fit = { bottom: underFit, right: besideFit, overlay: overFit }[layout](m);
  var card = gridCard(m, fit.cell);
  var words = wordsAt(m, fit.wordSize);
  var columns = fit.columns(words, card);
  return {
    sits: fit.sits, cell: fit.cell, wordSize: fit.wordSize, cardWidth: card.width, cardHeight: card.height,
    columns: columns, wordWidth: words.wordWidth, places: wordPlaces(m.count, columns), room: roomAt(m, card)
  };
}

// The page's own letter size, but big letters (m.letters over 1) shrink, in whole pixels, until
// the grid card fits the page's width — a Kids grid whole on a phone, no zooming — never below a
// Vanilla's letters at the same size, where a grid too wide still scrolls as a Vanilla's does.
function wholeCell(m) {
  var across = Math.floor((m.pageWidth - m.cardChromeWidth) / m.gridCols);
  return Math.min(m.naturalCell, Math.max(across, m.naturalCell / m.letters));
}

// The room beside the words under the grid, shrinking with the grid card as the character does.
function roomAt(m, card) {
  return m.room * themeScale(card.width);
}

// The grid card at a letter size: its letters, and its band, tabs and edges round them.
function gridCard(m, cell) {
  return { width: m.cardChromeWidth + m.gridCols * cell, height: m.cardChromeHeight + m.gridRows * cell };
}

// The page's measures with the words at a text size: they were measured at m.wordSize, and grow
// and shrink with it. A column is the widest word, rounded up to a whole pixel.
function wordsAt(m, size) {
  var scale = size / m.wordSize;
  return Object.assign({}, m, { wordWidth: Math.ceil(Math.max(...m.wordWidths) * scale), rowHeight: m.rowHeight * scale });
}

// As many columns as fit across width, never more than there are words, and always one.
function acrossColumns(w, width) {
  var across = Math.floor((width - w.chromeWidth + w.colGap) / (w.wordWidth + w.colGap));
  return Math.max(1, Math.min(w.count, across));
}

// Under: as many columns as fit across the grid card, less any room left the character beside them.
function underFit(m) {
  return { sits: 'bottom', cell: m.naturalCell, wordSize: m.wordSize, columns: function (w, card) { return acrossColumns(w, Math.min(card.width, w.pageWidth) - roomAt(w, card)); } };
}

// Over: as few columns as fill the grid card's height, never more than fit across it — a list
// longer than that scrolls down.
function overFit(m) {
  return { sits: 'overlay', cell: m.naturalCell, wordSize: m.wordSize, columns: function (w, card) { return Math.min(acrossColumns(w, card.width), besideColumns(w, card)); } };
}

// As many rows as the grid card's height holds, and always one.
function downRows(w, card) {
  return Math.max(1, Math.floor((card.height - w.chromeHeight + w.rowGap) / (w.rowHeight + w.rowGap)));
}

// As many columns as the words need, down the grid card's height.
function besideColumns(w, card) {
  return Math.ceil(w.count / downRows(w, card));
}

// The grid card and the words card beside it, end to end.
function besideWidth(w, card) {
  return card.width + w.pageGap + w.chromeWidth + besideColumns(w, card) * (w.wordWidth + w.colGap) - w.colGap;
}

// Beside: everything at the page's own size if the words fit beside the grid; else smaller words,
// a pixel at a time, down to 13px — the printout's — so the grid keeps its letters; else smaller
// letters with those words, a pixel at a time, down to 26px, the smallest the page draws at
// Normal (play.css's --cell). At another text size both floors scale with it — m.scale, the
// size's textScale — never below 11px words and 20px letters, the smallest a player can read and
// tap, and never above the page's own words. The first that leaves the words room; only when
// none does, under.
function besideFit(m) {
  var smallestWords = Math.min(m.wordSize, Math.max(11, 13 * m.scale)), smallestCell = Math.max(20, 26 * m.scale);
  var wordSteps = Math.floor(m.wordSize - smallestWords) + 1, smallWords = m.wordSize - wordSteps + 1;
  var sizes = Array.from({ length: wordSteps }, function (_, i) { return { cell: m.naturalCell, wordSize: m.wordSize - i }; })
    .concat(Array.from({ length: Math.floor(m.naturalCell - smallestCell) }, function (_, i) { return { cell: m.naturalCell - i - 1, wordSize: smallWords }; }));
  var size = sizes.find(function (s) { return besideWidth(wordsAt(m, s.wordSize), gridCard(m, s.cell)) <= m.pageWidth; });
  var beside = Object.assign({ sits: 'right', columns: besideColumns }, size);
  return { true: underFit(m), false: beside }[size === undefined];
}

// Down each column, then the next: the first count % columns columns hold one word more.
function wordPlaces(count, columns) {
  var short = Math.floor(count / columns), long = count % columns;
  var starts = Array.from({ length: columns }, function (_, c) { return c * short + Math.min(c, long); });
  return Array.from({ length: count }, function (_, i) {
    var column = starts.filter(function (start) { return start <= i; }).length;
    return [i - starts[column - 1] + 1, column];
  });
}

// Where each completion sparkle starts and drifts to, over a board width × height.
export function sparkles(count, width, height, random) {
  return Array.from({ length: count }, function () {
    var angle = random() * Math.PI * 2, distance = 30 + random() * 60;
    return {
      x: random() * width,
      y: random() * height,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      delay: random() * 0.35
    };
  });
}