// The play page's DOM: loads the puzzle a play URL names, with a signed-in player's saved finds,
// draws it from play-core's view, and wires the taps, the flip, where the words sit and the
// completion pop. Every rule lives in core/wordsearch/play-core.js; nothing here decides anything.
// Saving the finds is ui/wordsearch/progress-ui.js.
import {
  puzzleUrl, playJson, playBoard, restoredPlay, newFinds, finished, solvedPlay, turnPage, tap, playMarks, listedWords, wordList,
  countLabel, sparkles, nextWordsLayout, savedWordsLayout, saveWordsLayout, wordsFit, textScale, textSizeMenu, savedTextSize, saveTextSize
} from '../../core/wordsearch/play-core.js';
import { mergedPlay } from '../../core/wordsearch/progress-core.js';
import { withSavedFinds, wireProgress, saveFinds } from './progress-ui.js';

var PLAY_SVG_NS = 'http://www.w3.org/2000/svg';
var PLAY_FLIP_LABELS = { true: 'Back to puzzle', false: 'Show solution' };
var PLAY_LAYOUT_KEY = 'grew-puzzles.words-layout';
var PLAY_LAYOUT_LABELS = { bottom: 'Words: under the grid', right: 'Words: beside the grid', overlay: 'Words: over the grid' };
// Under and beside, the list is the page's, in its own slot ahead of the printed grids; in
// Overlay it sits in the stage, over the card.
var PLAY_LAYOUT_HOMES = { bottom: 'words-home', right: 'words-home', overlay: 'stage' };
// The save line sits under the words card: hung from it under and beside, so the card keeps its
// size; in Overlay, where the card lies over the grid, under the grid card.
var PLAY_SAVE_LINE_HOMES = { bottom: 'words-list', right: 'words-list', overlay: 'words-home' };
var PLAY_LIST_LABELS = { true: 'Hide words', false: 'Show words' };
var PLAY_SIZE_KEY = 'grew-puzzles.text-size';
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
    .then(function (puzzle) { return { id: puzzle.hiddenId, board: playBoard(puzzle) }; })
    .then(function (opened) {
      withSavedFinds(opened.id, opened.board.words, function (found) { showPuzzle(opened, found); });
    }, showMissing);
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
// the printout and the book's pages are one layout. A puzzle of several grids prints its words
// alone first, then each grid on a sheet of its own (styles/play.css, data-paged).
export function drawSheet(part, board, onCell) {
  part('title').textContent = board.title;
  part('created').textContent = board.created;
  part('label').textContent = board.label;
  part('play').style.setProperty('--cols', board.cols);
  part('play').style.setProperty('--rows', board.rows);
  part('play').dataset.paged = String(board.sheets.length > 0);
  drawPuzzleGrid(part('grid'), board.grids[0], onCell);
  // One line per word, however many copies; a word's progress sits beside it, on screen only,
  // as wide from the first find as when every copy is found, so a find never moves a word.
  var full = wordList({ found: board.words.map(function (_, i) { return i; }) }, board.words, false);
  listedWords(board.words).forEach(function (entry, i) {
    var li = document.createElement('li');
    var progress = document.createElement('span');
    li.textContent = entry.text;
    progress.className = 'progress';
    progress.style.minWidth = full[i].progress.length + 'ch';
    li.appendChild(progress);
    part('words').appendChild(li);
  });
  board.sheets.forEach(function (label, i) {
    part('print-grids').appendChild(gridSheet(part('grid-sheet'), board, label, board.grids[i]));
  });
  part('play').hidden = false;
}

// The puzzle side of one grid. It shows a wildcard's ?, never its letter — in its label too.
function drawPuzzleGrid(grid, page, onCell) {
  grid.replaceChildren();
  fillGrid(grid, page.shown, function (r, c) {
    var cell = document.createElement('button');
    cell.type = 'button';
    cell.setAttribute('aria-label', page.shown[r][c] + ', row ' + (r + 1) + ', column ' + (c + 1));
    cell.addEventListener('click', function () { onCell([r, c]); });
    return cell;
  });
  markWild(grid, page.wild);
}

function markWild(grid, wild) {
  wild.flat().forEach(function (on, i) { grid.children[i].classList.toggle('wild', on); });
}

// One printed grid of several: the title, then the blank grid under a band naming its page.
function gridSheet(template, board, label, page) {
  var sheet = template.content.firstElementChild.cloneNode(true);
  var grid = sheet.querySelector('.grid');
  sheet.querySelector('h1').textContent = board.title;
  sheet.querySelector('.band').textContent = label;
  fillGrid(grid, page.shown, function () { return document.createElement('span'); });
  markWild(grid, page.wild);
  return sheet;
}

function showMissing() {
  document.title = 'Puzzle not found · Grew Puzzles';
  playEl('title').textContent = 'Puzzle not found';
  playEl('play').hidden = true;
  playEl('missing').hidden = false;
}

// The puzzle, its saved finds already in place: the grid first draws with them, so none pops in,
// and a puzzle finished before doesn't celebrate again. Its hidden ID is for saving alone — the
// board on screen never carries it.
function showPuzzle(opened, found) {
  var board = opened.board;
  var play = restoredPlay(found);
  document.title = board.title + ' · Grew Puzzles';
  drawSheet(playEl, board, onTap);
  playEl('solution-label').textContent = board.solutionLabel;
  // The tabs sit on both sides of the card, so a page can be picked whichever way it faces.
  drawTabs(playEl('tabs'), board.tabs, showPage);
  drawTabs(playEl('solution-tabs'), board.tabs, showPage);
  wireFlip(render);
  wireTextSize();
  wireWords();
  wireWordsFit();
  wireProgress(opened.id, board.words, function () { return play.found; }, joinSaved);
  showPage(0);

  // Signed in mid-puzzle: what was saved for this puzzle elsewhere joins the board.
  function joinSaved(found) {
    play = mergedPlay(play, found);
    render();
  }

  // A page's grid on both sides — the solution side, on screen only, shows every real letter —
  // its tab picked on both, and its finds drawn. The word list never changes with it.
  function showPage(page) {
    play = turnPage(play, page);
    drawPuzzleGrid(playEl('grid'), board.grids[page], onTap);
    playEl('solution-grid').replaceChildren();
    fillGrid(playEl('solution-grid'), board.grids[page].letters, function () { return document.createElement('span'); });
    drawMarks(playEl('solution-overlay'), board, playMarks(solvedPlay(board.words, page), board.words));
    pickTab(playEl('tabs'), page);
    pickTab(playEl('solution-tabs'), page);
    render();
  }

  function onTap(cell) {
    var before = play;
    play = tap(play, cell, board.words);
    saveFinds(opened.id, board.words, newFinds(before, play));
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
    playEl('complete').hidden = !finished(play, board.words);
  }

  var PLAY_EVENTS = { complete: celebrate };
}

// One tab per page; a puzzle of one grid has none, and its empty tab row doesn't show.
function drawTabs(list, tabs, onPick) {
  tabs.forEach(function (name, i) {
    var tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tab';
    tab.setAttribute('role', 'tab');
    tab.textContent = name;
    tab.addEventListener('click', function () { onPick(i); });
    list.appendChild(tab);
  });
}

function pickTab(list, page) {
  Array.from(list.children).forEach(function (tab, i) { tab.setAttribute('aria-selected', String(i === page)); });
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
  playEl(PLAY_SAVE_LINE_HOMES[layout]).appendChild(playEl('save-line'));
  showList(false);
}

function showList(open) {
  var toggle = playEl('words-toggle');
  playEl('play').dataset.list = String(open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', PLAY_LIST_LABELS[open]);
  toggle.title = PLAY_LIST_LABELS[open];
  playEl('grid').inert = open;
  layoutWords();
}

// The corner button beside the words layout opens the text-size menu under it: a size picked
// scales the grid's letters and the words' text (styles/play.css, --scale), closes the menu and
// is kept on this device. Pressing outside the menu closes it unchanged.
function wireTextSize() {
  var menu = playEl('text-size-menu');
  textSizeMenu('').forEach(function (item) {
    var choice = document.createElement('button'), tick = document.createElement('span');
    var aa = document.createElement('span'), name = document.createElement('span');
    choice.type = 'button';
    choice.setAttribute('role', 'menuitemradio');
    choice.dataset.size = item.size;
    choice.style.setProperty('--scale', item.scale);
    tick.className = 'tick';
    aa.className = 'aa';
    aa.textContent = 'Aa';
    name.textContent = item.label;
    choice.append(tick, aa, name);
    choice.addEventListener('click', function () { pickTextSize(item.size); });
    menu.appendChild(choice);
  });
  menu.addEventListener('toggle', function (e) {
    playEl('text-size').setAttribute('aria-expanded', String(e.newState === 'open'));
    placeTextSizeMenu();
  });
  window.addEventListener('scroll', placeTextSizeMenu);
  window.addEventListener('resize', placeTextSizeMenu);
  showTextSize(savedTextSize(function () { return localStorage.getItem(PLAY_SIZE_KEY); }));
}

function pickTextSize(size) {
  showTextSize(size);
  layoutWords();
  saveTextSize(function (s) { localStorage.setItem(PLAY_SIZE_KEY, s); }, size);
  playEl('text-size-menu').hidePopover();
}

function showTextSize(size) {
  playEl('play').dataset.size = size;
  playEl('play').style.setProperty('--scale', textScale(size));
  textSizeMenu(size).forEach(function (item, i) {
    playEl('text-size-menu').children[i].setAttribute('aria-checked', String(item.picked));
  });
}

// The menu opens just under its button, its left edge lined up with the button's.
function placeTextSizeMenu() {
  var button = playEl('text-size').getBoundingClientRect(), menu = playEl('text-size-menu');
  menu.style.top = button.bottom + 6 + 'px';
  menu.style.left = button.left + 'px';
}

// The list is laid out again whenever the page or the grid card changes size, and once the
// page's font has loaded and the words are their true width.
function wireWordsFit() {
  new ResizeObserver(layoutWords).observe(playEl('stage'));
  window.addEventListener('resize', layoutWords);
  document.fonts.ready.then(layoutWords);
}

// The page measured for play-core's wordsFit, and its answer drawn: where the list sits, the grid
// card's size for the words card to take, the grid's letter size and the words' text size, and
// each word's column and row. The play area is the window wide (styles/play.css), so the page is
// measured once it is. The words are measured at the page's own text size, as revealed, the
// boldest they get.
function layoutWords() {
  var play = playEl('play'), list = playEl('words'), box = list.parentElement;
  play.style.setProperty('--view-w', document.documentElement.clientWidth + 'px');
  var card = playEl('stage').getBoundingClientRect(), cell = playEl('grid').firstElementChild.getBoundingClientRect().width;
  var cols = Number(play.style.getPropertyValue('--cols')), rows = Number(play.style.getPropertyValue('--rows'));
  list.classList.add('measuring');
  var widths = Array.from(list.children).map(function (li) { return li.getBoundingClientRect().width; });
  var word = { size: parseFloat(getComputedStyle(list.firstElementChild).fontSize), height: list.firstElementChild.getBoundingClientRect().height };
  list.classList.remove('measuring');
  var fit = wordsFit(play.dataset.words, {
    count: list.children.length, wordWidths: widths, wordSize: word.size, rowHeight: word.height,
    colGap: parseFloat(getComputedStyle(list).columnGap), rowGap: parseFloat(getComputedStyle(list).rowGap),
    gridCols: cols, gridRows: rows, naturalCell: playEl('cell-size').getBoundingClientRect().width,
    cardChromeWidth: card.width - cols * cell, cardChromeHeight: card.height - rows * cell,
    chromeWidth: box.getBoundingClientRect().width - list.clientWidth,
    chromeHeight: box.getBoundingClientRect().height - list.getBoundingClientRect().height,
    pageWidth: play.clientWidth, pageGap: parseFloat(getComputedStyle(play).columnGap), scale: textScale(play.dataset.size)
  });
  play.dataset.sits = fit.sits;
  play.style.setProperty('--fit-cell', fit.cell + 'px');
  play.style.setProperty('--card-w', fit.cardWidth + 'px');
  play.style.setProperty('--card-h', fit.cardHeight + 'px');
  list.style.setProperty('--word-cols', fit.columns);
  list.style.setProperty('--word-w', fit.wordWidth + 'px');
  list.style.setProperty('--word-size', fit.wordSize + 'px');
  fit.places.forEach(function (place, i) { list.children[i].style.gridArea = place[0] + ' / ' + place[1]; });
}

function celebrate() {
  var board = playEl('board');
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
