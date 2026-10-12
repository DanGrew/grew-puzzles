// The collection book's DOM: the title page, then one copy of each puzzle's own printout — a
// wordsearch the play page's, drawn by its drawSheet; a maze the maze page's sheet, drawn by its
// drawMazeSheet; a minesweeper board the minesweeper page's sheet, drawn by its drawMinesSheet —
// and the print dialog once every page is drawn. Every rule lives in core/book-core.js; how a
// puzzle's page looks is styles/play.css's, styles/maze.css's and styles/minesweeper.css's.
import { slugOf } from '../core/collection-core.js';
import { bookView, pageNumbers, printStyleOf, printedPages, leftOutNote } from '../core/book-core.js';
import { puzzleUrl, playJson, playBoard } from '../core/wordsearch/play-core.js';
import { mazeUrl, mazeBoard } from '../core/maze/play-core.js';
import { minesUrl, minesBoard } from '../core/minesweeper/play-core.js';
import { characterAt } from '../core/theme-core.js';
import { drawSheet, sizePrintedWords, dressPrintout } from './wordsearch/play-ui.js';
import { drawMazeSheet, dressMazeSheet } from './maze/sheet-ui.js';
import { drawMinesSheet } from './minesweeper/sheet-ui.js';
import { dressRandomScene, withCharacters, printImages } from './theme-ui.js';

var BOOK_SHOWS = { true: printBook, false: showMissing };
// The longest the print dialog waits on the page's background, which is the screen behind it only.
var SCENE_WAIT = 1500;
// Each kind's page: where its file is, its board, how many sheets it runs to, its page drawn, and
// that page dressed in its character. A maze and a minesweeper board are always one sheet, and a
// board's sheet stays plain until it wears its theme on paper (TASK-140).
var BOOK_KINDS = {
  wordsearch: { url: puzzleUrl, board: playBoard, sheets: function (board) { return board; }, page: wordsearchPage, dress: dressWordsearchPage },
  maze: { url: mazeUrl, board: mazeBoard, sheets: function () { return { sheets: [] }; }, page: mazePage, dress: dressMazePage },
  minesweeper: { url: minesUrl, board: minesBoard, sheets: function () { return { sheets: [] }; }, page: minesPage, dress: noop },
};

function noop() {}

function bookEl(id) {
  return document.getElementById(id);
}

function readJson(url) {
  return fetch(url).then(function (r) { return r.json(); });
}

// Themed, the page behind the print dialog wears a background, as the collection page does — the
// paper never does (styles/look.css is screen only). The book prints in the style its address
// names — Print book's pick on the collection page — every time it prints. The mazes' index tells
// which of the collection's mazes print: only 32×40. Every board is opened, and its own size tells.
export function openBook(search) {
  document.documentElement.dataset.print = printStyleOf(search);
  bookEl('print-again').addEventListener('click', function () { window.print(); });
  var scene = dressRandomScene(Math.random, SCENE_WAIT);
  Promise.all([
    readJson('../content/collections/index.json'),
    readJson('../content/puzzles/maze/index.json').catch(function () { return { puzzles: [] }; }),
    fetch('play.html').then(function (r) { return r.text(); }),
    fetch('maze.html').then(function (r) { return r.text(); }),
    fetch('minesweeper.html').then(function (r) { return r.text(); }),
  ]).then(function (got) {
    var book = bookView(got[0].collections, slugOf(search), got[1].puzzles);
    showTitlePage(book);
    BOOK_SHOWS[book.found](book, {
      wordsearch: sheetTemplate(got[2], ['.play-head', 'main.play']),
      maze: sheetTemplate(got[3], ['.maze-sheet']),
      minesweeper: sheetTemplate(got[4], ['.mines-sheet']),
    }, scene);
  });
}

function showTitlePage(book) {
  document.title = book.name + ' · Grew Puzzles';
  bookEl('book-title').textContent = book.name;
  bookEl('book-description').textContent = book.description;
  bookEl('answers').textContent = book.answers;
  bookEl('address').textContent = book.address;
  bookEl('back').href = book.back;
}

function showMissing() {
  bookEl('title-page').hidden = true;
  bookEl('status').hidden = true;
  bookEl('missing').hidden = false;
}

// Every puzzle file loads and every page is drawn before the dialog opens, its fonts and the
// page's background too, so no page prints blank however many puzzles the collection holds — and,
// the fonts in, each page's word columns are sized as the play page sizes its own. Printed Colour
// or Black and white, each puzzle wears its character in number order, round again after the last,
// as on the collection page, each wordsearch page at a spot of its own picked again every time the
// book prints, and every character's images are in before the dialog opens. A board too big to
// print is left out once its file is in, and named on the book's page.
function printBook(book, templates, scene) {
  var fetched = book.pages.map(function (page) { return BOOK_KINDS[page.kind]; });
  Promise.all([
    Promise.all(book.pages.map(function (page, i) { return fetch(fetched[i].url(page.search)).then(playJson); })),
    withCharacters(function (characters) { return characters; }),
  ])
    .then(function (got) {
      var printed = printedPages(book.pages, got[0].map(function (puzzle, i) { return fetched[i].board(puzzle); }));
      var pages = printed.pages, boards = printed.boards;
      var kinds = pages.map(function (page) { return BOOK_KINDS[page.kind]; });
      var numbers = pageNumbers(boards.map(function (board, i) { return kinds[i].sheets(board); }));
      var wearers = pages.map(function (page) { return characterAt(got[1], page.number); });
      var sheets = boards.map(function (board, i) { return kinds[i].page(templates[pages[i].kind], pages[i].heading, board, numbers[i]); });
      var printout = function () {
        sheets.forEach(function (sheet, i) { kinds[i].dress(sheet, boards[i], wearers[i]); });
      };
      bookEl('left-out').textContent = leftOutNote(printed.left);
      bookEl('sheets').replaceChildren.apply(bookEl('sheets'), sheets);
      printout();
      window.addEventListener('beforeprint', printout);
      return Promise.all([document.fonts.ready, scene].concat(wearers.map(printImages)));
    })
    .then(sizeBookWords)
    .then(showReady, showFailed);
}

function dressWordsearchPage(page, board, character) {
  dressPrintout(page.querySelector('main.play'), page, board, character, true, Math.random);
}

function dressMazePage(page, board, character) {
  dressMazeSheet(page.querySelector('.maze-sheet'), page, character);
}

function sizeBookWords() {
  bookEl('sheets').querySelectorAll('ul.words').forEach(function (list) { sizePrintedWords(list, true); });
}

function showReady() {
  bookEl('status').hidden = true;
  bookEl('ready').hidden = false;
  window.print();
}

function showFailed() {
  bookEl('status').hidden = true;
  bookEl('failed').hidden = false;
}

// A blank book page: its number, then the parts of a kind's page that print, taken from that page
// itself so the book never keeps a copy of its own.
function sheetTemplate(html, parts) {
  var source = new DOMParser().parseFromString(html, 'text/html');
  var page = bookEl('sheet').content.firstElementChild.cloneNode(true);
  page.append.apply(page, parts.map(function (part) { return source.querySelector(part); }));
  return page;
}

// One wordsearch's page, drawn exactly as the play page draws its printout — a puzzle of several
// grids runs on over a page per grid, each headed with the puzzle's number too.
function wordsearchPage(template, heading, board, numbers) {
  var page = template.cloneNode(true);
  var part = function (id) { return page.querySelector('#' + id); };
  var number = page.querySelector('.sheet-number');
  var pageNumber = page.querySelector('.page-number');
  number.textContent = heading;
  drawSheet(part, board, function () {});
  page.querySelectorAll('.grid-sheet').forEach(function (grid) {
    grid.prepend(number.cloneNode(true));
    grid.append(pageNumber.cloneNode(true));
  });
  return numbered(page, numbers);
}

// One maze's page, drawn exactly as the maze page draws its printout, its number heading the
// sheet's top, above the title, so the maze stands where it does on the maze page's own.
function mazePage(template, heading, board, numbers) {
  var page = template.cloneNode(true);
  var number = page.querySelector('.sheet-number');
  number.textContent = heading;
  page.querySelector('.maze-sheet-top').prepend(number);
  drawMazeSheet(page.querySelector('.maze-sheet'), board);
  return numbered(page, numbers);
}

// One board's page, drawn exactly as the minesweeper page draws its printout, its number heading
// the sheet, above the title.
function minesPage(template, heading, board, numbers) {
  var page = template.cloneNode(true);
  var number = page.querySelector('.sheet-number');
  number.textContent = heading;
  page.querySelector('.mines-sheet').prepend(number);
  drawMinesSheet(page.querySelector('.mines-sheet'), board);
  return numbered(page, numbers);
}

// Every page carries its page number at the foot, on its outer side. Each copy then drops its
// page's ids, which belong to that page alone.
function numbered(page, numbers) {
  page.querySelectorAll('.page-number').forEach(function (el, i) {
    el.textContent = numbers[i].number;
    el.dataset.side = numbers[i].side;
  });
  page.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
  return page;
}
