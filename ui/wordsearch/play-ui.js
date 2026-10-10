// The play page's DOM: loads the puzzle a play URL names, with a signed-in player's saved finds,
// draws it from play-core's view, and wires the taps, the flip, where the words sit and the
// completion pop. Every rule lives in core/wordsearch/play-core.js; nothing here decides anything.
// Saving the finds is ui/wordsearch/progress-ui.js.
import {
  puzzleUrl, playJson, playBoard, restoredPlay, newFinds, finished, solvedPlay, turnPage, tap, playMarks, wordLines, lineMarks,
  printedPieces, printedColumnWidth, printedSpread, countLabel, nextWordsLayout, savedWordsLayout, saveWordsLayout, wordsFit, boardScale, textSizeMenu, savedTextSize, saveTextSize,
  playReach
} from '../../core/wordsearch/play-core.js';
import { mergedPlay } from '../../core/wordsearch/progress-core.js';
import {
  characterFor, templateFor, isPhone, wordsRoom, figurePlacement, figureTransform, wordsCap, dressOf, printPaper, printCardWidth, printCardTop, printDress
} from '../../core/theme-core.js';
import { withSavedFinds, wireProgress, saveFinds } from './progress-ui.js';
import { wireEntries } from './entry-ui.js';
import { withCharacters, dressScene, dressFigure, dressName, lookNow, onLook, printIn, printImages, dressPrintSheet } from '../theme-ui.js';
import { wireFlip, celebrate, drawIdent } from '../card-ui.js';

var PLAY_SVG_NS = 'http://www.w3.org/2000/svg';
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
// Each kind of line in the word list (play-core's wordLines): how it's drawn once, for the screen
// and paper alike, and how its marks (play-core's lineMarks) show as the play goes.
var PLAY_LINES = {
  word: { draw: drawWordLine, mark: markWordLine },
  copy: { draw: drawWordLine, mark: markWordLine },
  boxes: { draw: drawBoxesLine, mark: markBoxesLine }
};

// What printing the puzzle's sheet in a style needs loaded first: nothing, until its character is
// known (dressPuzzle).
var printLoad = function () { return Promise.resolve(); };

function playEl(id) {
  return document.getElementById(id);
}

export function openPlayPage(search) {
  playEl('print').querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { printIn(b.dataset.print, printLoad); });
  });
  Promise.resolve(search)
    .then(puzzleUrl)
    .then(function (url) { return fetch(url); })
    .then(playJson)
    .then(function (puzzle) { return { id: puzzle.hiddenId, board: playBoard(puzzle), groups: puzzle.wordGroups }; })
    .then(function (opened) {
      withSavedFinds(opened.id, opened.board.words, function (found) { showPuzzle(opened, found); });
    }, showMissing);
}

// The printout's side of a puzzle — its title and the line under it, the puzzle grid under its
// type band, and its words — drawn into the parts part finds: the play page's own, or a copy of
// it in the book. The play page draws it into itself,
// each cell tapping onCell; the book (ui/book-ui.js) draws it into each copy of the play page it
// prints, so the printout and the book's pages are one layout. A puzzle of several grids prints
// its words alone first, then each grid on a sheet of its own (styles/play.css, data-paged).
export function drawSheet(part, board, onCell) {
  part('title').textContent = board.title;
  drawIdent(part, board);
  part('label').textContent = board.label;
  part('play').style.setProperty('--cols', board.cols);
  part('play').style.setProperty('--rows', board.rows);
  part('play').style.setProperty('--letters', board.letters);
  part('play').dataset.paged = String(board.sheets.length > 0);
  drawPuzzleGrid(part('grid'), board.grids[0], onCell);
  wordLines(board.words, board.label).forEach(function (line) {
    part('words').appendChild(PLAY_LINES[line.kind].draw(line));
  });
  board.sheets.forEach(function (label, i) {
    part('print-grids').appendChild(gridSheet(part('grid-sheet'), board, label, board.grids[i]));
  });
  part('play').hidden = false;
}

// Paper's word columns, sized to the list's widest word: each piece a line may wrap between, and
// each whole line, is measured on an unseen line in the printout's own type
// (styles/play.css, .print-measure), carrying the puzzle's own letters — on the page itself, since
// the puzzle may not show (Overlay's closed list, the book's pages on screen) and paper's layout is
// never the screen's. On a words sheet of its own, the words then spread to fill it (play-core's
// printedSpread) — book says whether it's the book's page. Run once the fonts are in, so the type
// is the real one.
export function sizePrintedWords(list, book) {
  var line = document.createElement('span');
  line.className = 'print-measure';
  line.style.setProperty('--letters', list.closest('.play').style.getPropertyValue('--letters'));
  document.body.appendChild(line);
  var pieces = Array.from(list.children, function (li) {
    return printedPieces(li.firstChild.textContent).map(function (piece) { return measurePiece(line, piece); });
  });
  var lines = Array.from(list.children, function (li, i) {
    return { width: measurePiece(line, li.firstChild.textContent), pieces: pieces[i].length };
  });
  var column = printedColumnWidth(pieces.flat()), height = line.getBoundingClientRect().height;
  var spread = printedSpread(lines, { line: height, column: column }, book);
  line.remove();
  list.style.setProperty('--print-word-w', column + 'px');
  list.style.setProperty('--print-line', height + 'px');
  list.style.setProperty('--print-spread', spread.scale);
  list.style.setProperty('--print-spread-gap', spread.gap + 'px');
}

function measurePiece(line, text) {
  line.textContent = text;
  return line.getBoundingClientRect().width;
}

// A word line, or one copy's line of a repeated word: the word, struck once found.
function drawWordLine(line) {
  var li = document.createElement('li');
  li.textContent = line.parts[0].shown;
  return li;
}

function markWordLine(li, marks) {
  var word = marks.parts[0];
  li.classList.toggle('done', word.done);
  li.classList.toggle('revealed', word.revealed);
}

// A Repeats word's line: the word, then a box per copy wrapping under it (styles/play.css), on
// screen and on paper alike; paper's are always empty.
function drawBoxesLine(line) {
  var word = line.parts[0];
  var li = document.createElement('li'), text = document.createElement('span'), boxes = document.createElement('span');
  li.className = 'boxes-line';
  text.className = 'line-text';
  text.textContent = word.shown;
  boxes.className = 'boxes';
  word.copies.forEach(function () {
    var box = document.createElement('span');
    box.className = 'box';
    boxes.appendChild(box);
  });
  li.append(text, boxes);
  return li;
}

function markBoxesLine(li, marks) {
  var word = marks.parts[0];
  markWordLine(li, marks);
  Array.from(li.querySelector('.boxes').children, function (box, i) { box.classList.toggle('ticked', i < word.ticked); });
}

// Printed Colour or Black and white, every sheet of a puzzle wears its character, peering from
// behind its card at a spot picked at random each time it prints (core/theme-core.js printDress), on
// its background, faint (styles/look.css): a puzzle of one grid from its grid card; one of several
// from its words card on the words sheet, and from each grid on its own sheet. play is the puzzle's
// main.play — the play page's own, or a copy of it in the book; start holds the first sheet's rise
// and background — the play page's root, or the book page.
export function dressPrintout(play, start, board, character, book, random) {
  start.style.setProperty('--paper-scene', dressOf(character).scene);
  var sheets = {
    false: [{ sheet: 'one', card: play.querySelector('.card'), start: start }],
    true: [{ sheet: 'words', card: play.querySelector('aside'), start: start }].concat(Array.from(play.querySelectorAll('.grid-sheet'), function (grid) {
      return { sheet: 'grid', card: grid.querySelector('.print-card'), start: grid };
    }))
  }[String(board.sheets.length > 0)];
  sheets.forEach(function (s) {
    var paper = printPaper(book);
    var frame = { paper: paper, cardWidth: printCardWidth(s.sheet, board.cols, board.rows, board.letters, paper), cardTop: printCardTop(s.sheet, book) };
    dressPrintSheet(s.card, s.start, character, printDress(s.sheet, frame, character, random));
  });
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
// and a puzzle finished before doesn't celebrate again.
function showPuzzle(opened, found) {
  var board = opened.board;
  var play = restoredPlay(found);
  document.title = board.title + ' · Grew Puzzles';
  drawSheet(playEl, board, onTap);
  dressPuzzle(opened.id, board);
  playEl('solution-label').textContent = board.solutionLabel;
  // The tabs sit on both sides of the card, so a page can be picked whichever way it faces.
  drawTabs(playEl('tabs'), board.tabs, showPage);
  drawTabs(playEl('solution-tabs'), board.tabs, showPage);
  wireFlip(render);
  wireTextSize();
  wireWords();
  wireWordsFit();
  document.fonts.ready.then(function () { sizePrintedWords(playEl('words'), false); });
  wireProgress(opened.id, board.words, function () { return play.found; }, joinSaved);
  showPage(0);
  // The words that have an entry are marked once the entries arrive; the grid never waits on them.
  wireEntries(opened.groups, wordLines(board.words, board.label));

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
    lineMarks(play, board.words, playEl('card').classList.contains('flipped'), board.label).forEach(function (marks, i) {
      PLAY_LINES[marks.kind].mark(playEl('words').children[i], marks);
    });
    playEl('count').textContent = countLabel(play, board.words);
    playEl('complete').hidden = !finished(play, board.words);
  }

  var PLAY_EVENTS = { complete: celebrate };
}

// Themed: the puzzle wears its own character, its background behind the page, in its own
// template — the same every visit. Plain shows none of it (styles/look.css). Its printout wears the
// same character whatever the look, on a spot picked again every time it prints, its images loaded
// before the dialog opens when Print page's pick is Colour or Black and white.
function dressPuzzle(hiddenId, board) {
  playEl('play').dataset.template = templateFor(hiddenId);
  withCharacters(function (characters) {
    var character = characterFor(characters, hiddenId);
    var printout = function () { dressPrintout(playEl('play'), document.documentElement, board, character, false, Math.random); };
    dressScene(character);
    dressFigure(playEl('theme-figure'), character);
    dressName(playEl('name-tag'), character);
    printout();
    window.addEventListener('beforeprint', printout);
    printLoad = function () { return printImages(character); };
  });
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
// scales the grid's letters and the words' text (styles/play.css, --scale) from the puzzle's own
// (play-core's boardScale), its "Aa" at the letters it gives, closes the menu and is kept on this
// device. Pressing outside the menu closes it unchanged.
function wireTextSize() {
  var menu = playEl('text-size-menu');
  textSizeMenu('').forEach(function (item) {
    var choice = document.createElement('button'), tick = document.createElement('span');
    var aa = document.createElement('span'), name = document.createElement('span');
    choice.type = 'button';
    choice.setAttribute('role', 'menuitemradio');
    choice.dataset.size = item.size;
    choice.style.setProperty('--scale', boardScale(item.size, playLetters()));
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
  playEl('play').style.setProperty('--scale', boardScale(size, playLetters()));
  textSizeMenu(size).forEach(function (item, i) {
    playEl('text-size-menu').children[i].setAttribute('aria-checked', String(item.picked));
  });
}

// How big the puzzle's letters are against a Vanilla's (play-core's playBoard), as drawSheet set it.
function playLetters() {
  return Number(playEl('play').style.getPropertyValue('--letters'));
}

// The menu opens just under its button, its left edge lined up with the button's.
function placeTextSizeMenu() {
  var button = playEl('text-size').getBoundingClientRect(), menu = playEl('text-size-menu');
  menu.style.top = button.bottom + 6 + 'px';
  menu.style.left = button.left + 'px';
}

// The list is laid out again whenever the page or the grid card changes size, once the page's
// font has loaded and the words are their true width, and when the player switches the look —
// Themed may leave the character room beside the words.
function wireWordsFit() {
  new ResizeObserver(layoutWords).observe(playEl('stage'));
  window.addEventListener('resize', layoutWords);
  document.fonts.ready.then(layoutWords);
  onLook(layoutWords);
}

// The page measured for play-core's wordsFit, and its answer drawn: where the list sits, the grid
// card's size for the words card to take, the grid's letter size and the words' text size, and
// each word's column and row. The play area reaches past the page's column to the window's edges,
// never over the side bar (play-core's playReach, styles/play.css), so the page is measured once it
// does. The words are measured at the page's own text size, as revealed, the boldest they get.
function layoutWords() {
  var play = playEl('play'), list = playEl('words'), box = list.parentElement;
  var reach = playReach(document.documentElement.clientWidth, play.parentElement.getBoundingClientRect(),
    playEl('site-side').getBoundingClientRect().width);
  play.style.setProperty('--reach-left', reach.left + 'px');
  play.style.setProperty('--reach-right', reach.right + 'px');
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
    pageWidth: play.clientWidth, pageGap: parseFloat(getComputedStyle(play).columnGap),
    scale: boardScale(play.dataset.size, playLetters()), letters: playLetters(),
    room: wordsRoom(lookNow(), play.dataset.template, isPhone(document.documentElement.clientWidth))
  });
  play.dataset.sits = fit.sits;
  play.style.setProperty('--fit-cell', fit.cell + 'px');
  play.style.setProperty('--card-w', fit.cardWidth + 'px');
  play.style.setProperty('--card-h', fit.cardHeight + 'px');
  play.style.setProperty('--words-room', fit.room + 'px');
  list.style.setProperty('--word-cols', fit.columns);
  list.style.setProperty('--word-w', fit.wordWidth + 'px');
  list.style.setProperty('--word-size', fit.wordSize + 'px');
  fit.places.forEach(function (place, i) { list.children[i].style.gridArea = place[0] + ' / ' + place[1]; });
  placeFigure(fit);
}

// The character on its template's spot for where the words ended up, measured from the grid
// card as it now stands on the page, facing that spot's way, and its name label beside it, the
// words card under the grid no taller than it — on a phone, its one spot, no label and no cap.
function placeFigure(fit) {
  var page = playEl('play').getBoundingClientRect(), card = playEl('stage').getBoundingClientRect();
  var phone = isPhone(document.documentElement.clientWidth);
  var spot = figurePlacement(playEl('play').dataset.template, fit.sits,
    { width: fit.cardWidth, height: fit.cardHeight, left: card.left - page.left, top: card.top - page.top }, phone);
  var figure = playEl('theme-figure'), tag = playEl('name-tag');
  figure.style.left = spot.left + 'px';
  figure.style.top = spot.top + 'px';
  figure.style.height = spot.height + 'px';
  figure.style.transform = figureTransform(spot);
  playEl('play').style.setProperty('--words-cap', wordsCap(spot, phone));
  tag.hidden = !spot.label;
  tag.style.left = spot.labelLeft + 'px';
  tag.style.top = spot.labelTop + 'px';
}
