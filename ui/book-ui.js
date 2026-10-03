// The collection book's DOM: the title page, then one copy of the play page per puzzle, each
// drawn by the play page's own printout (drawSheet), and the print dialog once every grid is
// drawn. Every rule lives in core/book-core.js; how a puzzle's page looks is styles/play.css's.
import { slugOf } from '../core/collection-core.js';
import { bookView } from '../core/book-core.js';
import { puzzleUrl, playJson, playBoard } from '../core/wordsearch/play-core.js';
import { markPrintout, drawSheet } from './wordsearch/play-ui.js';

var BOOK_SHOWS = { true: printBook, false: showMissing };

function bookEl(id) {
  return document.getElementById(id);
}

export function openBook(search) {
  bookEl('print-again').addEventListener('click', function () { window.print(); });
  Promise.all([
    fetch('../content/collections/index.json').then(function (r) { return r.json(); }),
    fetch('play.html').then(function (r) { return r.text(); }),
  ]).then(function (got) {
    var book = bookView(got[0].collections, slugOf(search));
    showTitlePage(book);
    BOOK_SHOWS[book.found](book, got[1]);
  });
}

function showTitlePage(book) {
  document.title = book.name + ' · Grew Puzzles';
  bookEl('book-title').textContent = book.name;
  bookEl('book-description').textContent = book.description;
  bookEl('answers').textContent = book.answers;
  bookEl('address').textContent = book.address;
  bookEl('back').href = book.back;
  document.querySelector('[data-entry="collections"]').hidden = !book.found;
}

function showMissing() {
  bookEl('title-page').hidden = true;
  bookEl('status').hidden = true;
  bookEl('missing').hidden = false;
}

// Every puzzle file loads and every page is drawn before the dialog opens, its fonts too, so no
// page prints blank however many puzzles the collection holds.
function printBook(book, playPage) {
  var template = sheetTemplate(playPage);
  Promise.all(book.pages.map(function (page) { return fetch(puzzleUrl(page.search)).then(playJson); }))
    .then(function (puzzles) {
      bookEl('sheets').replaceChildren.apply(bookEl('sheets'), puzzles.map(function (puzzle, i) {
        return sheet(template, book.pages[i].heading, puzzle);
      }));
      return document.fonts.ready;
    })
    .then(showReady, showFailed);
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

// A blank book page: its number, then the play page's own heading and puzzle, taken from the play
// page itself so the book never keeps a copy of its own.
function sheetTemplate(playPage) {
  var play = new DOMParser().parseFromString(playPage, 'text/html');
  var page = bookEl('sheet').content.firstElementChild.cloneNode(true);
  page.append(play.querySelector('.play-head'), play.querySelector('main.play'));
  return page;
}

// One puzzle's page, drawn exactly as the play page draws its printout — a puzzle of several grids
// runs on over a page per grid, each headed with the puzzle's number too. Each copy then drops the
// play page's ids, which belong to the play page alone.
function sheet(template, heading, puzzle) {
  var page = template.cloneNode(true);
  var part = function (id) { return page.querySelector('#' + id); };
  var number = page.querySelector('.sheet-number');
  number.textContent = heading;
  drawSheet(part, playBoard(markPrintout(part, puzzle)), function () {});
  page.querySelectorAll('.grid-sheet').forEach(function (grid) { grid.prepend(number.cloneNode(true)); });
  page.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
  return page;
}
