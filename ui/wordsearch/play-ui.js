// The play page's DOM: loads the puzzle a play URL names, draws it from play-core's view,
// and wires the taps, the flip, where the words sit and the completion pop. Every rule lives
// in core/wordsearch/play-core.js; nothing here decides anything.
import {
  puzzleUrl, playJson, playBoard, newPlay, solvedPlay, tap, playMarks, listedWords, wordList, countLabel, sparkles,
  nextWordsLayout, savedWordsLayout, saveWordsLayout
} from '../../core/wordsearch/play-core.js';

var PLAY_SVG_NS = 'http://www.w3.org/2000/svg';
var PLAY_FLIP_LABELS = { true: 'Back to puzzle', false: 'Show solution' };
var PLAY_LAYOUT_KEY = 'grew-puzzles.words-layout';
var PLAY_LAYOUT_LABELS = { bottom: 'Words: under the grid', right: 'Words: beside the grid', overlay: 'Words: over the grid' };
// Under and beside, the list is the page's; in Overlay it sits in the stage, over the card.
var PLAY_LAYOUT_HOMES = { bottom: 'play', right: 'play', overlay: 'stage' };
var PLAY_LIST_LABELS = { true: 'Hide words', false: 'Show words' };
var PLAY_MARK_WIDTHS = { found: 0.09, wrong: 0.09, shared: 0.06, select: 0.07 };
var PLAY_RING_RADII = { shared: 0.4, select: 0.42, wrong: 0.42 };
var PLAY_SPARKLE_COUNT = 28;
var PLAY_SPARKLE_LIFE_MS = 1700;

function playEl(id) {
  return document.getElementById(id);
}

export function openPlayPage(search) {
  playEl('print').addEventListener('click', function () { window.print(); });
  Promise.resolve(search)
    .then(puzzleUrl)
    .then(function (url) { return fetch(url); })
    .then(playJson)
    .then(function (puzzle) { return markPrintout(playEl, puzzle); })
    .then(playBoard)
    .then(showPuzzle, showMissing);
}

// The hidden ID never reaches the board on screen: only the printout carries it, small under the
// words card, to match a sheet to its puzzle (styles/play.css draws it from this attribute).
// part finds a part of the page by its id: the play page's own, or a copy of it in the book.
export function markPrintout(part, puzzle) {
  part('words-list').setAttribute('data-hidden-id', puzzle.hiddenId);
  return puzzle;
}

// The printout's side of a puzzle — its title and date, the puzzle grid under its type band, and
// its words — drawn into the parts part finds. The play page draws it into itself, each cell
// tapping onCell; the book (ui/book-ui.js) draws it into each copy of the play page it prints, so
// the printout and the book's pages are one layout.
export function drawSheet(part, board, onCell) {
  part('title').textContent = board.title;
  part('created').textContent = board.created;
  part('label').textContent = board.label;
  part('play').style.setProperty('--cols', board.cols);
  part('play').style.setProperty('--rows', board.rows);
  // The puzzle side shows a wildcard's ?, never its letter — in its label too.
  fillGrid(part('grid'), board.shown, function (r, c) {
    var cell = document.createElement('button');
    cell.type = 'button';
    cell.setAttribute('aria-label', board.shown[r][c] + ', row ' + (r + 1) + ', column ' + (c + 1));
    cell.addEventListener('click', function () { onCell([r, c]); });
    return cell;
  });
  board.wild.flat().forEach(function (wild, i) { part('grid').children[i].classList.toggle('wild', wild); });
  // One line per word, however many copies; a word's progress sits beside it, on screen only.
  listedWords(board.words).forEach(function (entry) {
    var li = document.createElement('li');
    var progress = document.createElement('span');
    li.textContent = entry.text;
    progress.className = 'progress';
    li.appendChild(progress);
    part('words').appendChild(li);
  });
  part('play').hidden = false;
}

function showMissing() {
  document.title = 'Puzzle not found · Grew Puzzles';
  playEl('title').textContent = 'Puzzle not found';
  playEl('play').hidden = true;
  playEl('missing').hidden = false;
}

function showPuzzle(board) {
  var play = newPlay();
  document.title = board.title + ' · Grew Puzzles';
  drawSheet(playEl, board, onTap);
  // The solution side, on screen only, shows every real letter.
  playEl('solution-label').textContent = board.solutionLabel;
  fillGrid(playEl('solution-grid'), board.letters, function () { return document.createElement('span'); });
  drawMarks(playEl('solution-overlay'), board, playMarks(solvedPlay(board.words), board.words));
  wireFlip(render);
  wireWords();
  render();

  function onTap(cell) {
    play = tap(play, cell, board.words);
    render();
    play.events.forEach(function (e) { PLAY_EVENTS[e](); });
  }

  function render() {
    drawMarks(playEl('overlay'), board, playMarks(play, board.words));
    wordList(play, board.words, playEl('card').classList.contains('flipped')).forEach(function (item, i) {
      playEl('words').children[i].classList.toggle('done', item.done);
      playEl('words').children[i].classList.toggle('revealed', item.revealed);
      playEl('words').children[i].querySelector('.progress').textContent = item.progress;
    });
    playEl('count').textContent = countLabel(play, board.words);
  }

  var PLAY_EVENTS = { complete: celebrate };
}

function fillGrid(grid, letters, makeCell) {
  letters.forEach(function (row, r) {
    row.forEach(function (letter, c) {
      var cell = makeCell(r, c);
      cell.className = 'cell';
      cell.textContent = letter;
      grid.appendChild(cell);
    });
  });
}

function drawMarks(svg, board, marks) {
  svg.setAttribute('viewBox', '0 0 ' + board.cols + ' ' + board.rows);
  svg.innerHTML = '';
  marks.found.forEach(function (ends) { drawLine(svg, ends, 'found'); });
  marks.shared.forEach(function (cell) { drawRing(svg, cell, 'shared'); });
  marks.wrong.forEach(function (ends) { drawLine(svg, ends, 'wrong'); });
  marks.rings.forEach(function (ring) { drawRing(svg, ring.cell, ring.kind); });
}

function drawLine(svg, ends, kind) {
  var line = document.createElementNS(PLAY_SVG_NS, 'line');
  line.setAttribute('class', 'mark-' + kind);
  line.setAttribute('x1', ends[0][1] + 0.5);
  line.setAttribute('y1', ends[0][0] + 0.5);
  line.setAttribute('x2', ends[1][1] + 0.5);
  line.setAttribute('y2', ends[1][0] + 0.5);
  line.setAttribute('stroke-width', PLAY_MARK_WIDTHS[kind]);
  svg.appendChild(line);
}

function drawRing(svg, cell, kind) {
  var ring = document.createElementNS(PLAY_SVG_NS, 'circle');
  ring.setAttribute('class', 'mark-' + kind);
  ring.setAttribute('cx', cell[1] + 0.5);
  ring.setAttribute('cy', cell[0] + 0.5);
  ring.setAttribute('r', PLAY_RING_RADII[kind]);
  ring.setAttribute('stroke-width', PLAY_MARK_WIDTHS[kind]);
  svg.appendChild(ring);
}

// The grid turns over like a revolving door; the found words on the front stay as they were.
// onFlip redraws the list, which shows a missing word red only while the solution shows.
function wireFlip(onFlip) {
  var card = playEl('card'), button = playEl('flip');
  button.addEventListener('click', function () {
    var on = card.classList.toggle('flipped');
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', PLAY_FLIP_LABELS[on]);
    button.title = PLAY_FLIP_LABELS[on];
    playEl('front').inert = on;
    playEl('back').inert = !on;
    playEl('back').setAttribute('aria-hidden', String(!on));
    onFlip();
  });
}

// The corner button cycles where the words sit; in Overlay its neighbour lays the list over
// the grid and lifts it off again, leaving the grid as it was.
function wireWords() {
  showLayout(savedWordsLayout(function () { return localStorage.getItem(PLAY_LAYOUT_KEY); }));
  playEl('words-layout').addEventListener('click', function () {
    var layout = nextWordsLayout(playEl('play').dataset.words);
    showLayout(layout);
    saveWordsLayout(function (l) { localStorage.setItem(PLAY_LAYOUT_KEY, l); }, layout);
  });
  playEl('words-toggle').addEventListener('click', function () {
    showList(playEl('play').dataset.list === 'false');
  });
}

function showLayout(layout) {
  var button = playEl('words-layout');
  playEl('play').dataset.words = layout;
  button.setAttribute('aria-label', PLAY_LAYOUT_LABELS[layout]);
  button.title = PLAY_LAYOUT_LABELS[layout];
  playEl(PLAY_LAYOUT_HOMES[layout]).appendChild(playEl('words-list'));
  showList(false);
}

function showList(open) {
  var toggle = playEl('words-toggle');
  playEl('play').dataset.list = String(open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', PLAY_LIST_LABELS[open]);
  toggle.title = PLAY_LIST_LABELS[open];
  playEl('grid').inert = open;
}

function celebrate() {
  var board = playEl('board');
  playEl('complete').hidden = false;
  board.classList.remove('pop');
  void board.offsetWidth;
  board.classList.add('pop');
  sparkles(PLAY_SPARKLE_COUNT, board.offsetWidth, board.offsetHeight, Math.random).forEach(function (s) {
    var spark = document.createElement('span');
    spark.className = 'spark';
    spark.style.left = s.x + 'px';
    spark.style.top = s.y + 'px';
    spark.style.setProperty('--dx', s.dx + 'px');
    spark.style.setProperty('--dy', s.dy + 'px');
    spark.style.animationDelay = s.delay + 's';
    board.appendChild(spark);
    setTimeout(function () { spark.remove(); }, PLAY_SPARKLE_LIFE_MS);
  });
}
