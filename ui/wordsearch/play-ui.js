// The play page's DOM: loads the puzzle a play URL names, draws it from play-core's view,
// and wires the taps, the flip, where the words sit and the completion pop. Every rule lives
// in core/wordsearch/play-core.js; nothing here decides anything.
import {
  puzzleUrl, playJson, playBoard, newPlay, solvedPlay, tap, playMarks, wordList, countLabel, sparkles,
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
  Promise.resolve(search)
    .then(puzzleUrl)
    .then(function (url) { return fetch(url); })
    .then(playJson)
    .then(playBoard)
    .then(showPuzzle, showMissing);
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
  playEl('title').textContent = board.title;
  playEl('created').textContent = board.created;
  playEl('label').textContent = board.label;
  playEl('solution-label').textContent = board.solutionLabel;
  playEl('play').style.setProperty('--cols', board.cols);
  fillGrid(playEl('grid'), board, function (r, c) {
    var cell = document.createElement('button');
    cell.type = 'button';
    cell.setAttribute('aria-label', board.letters[r][c] + ', row ' + (r + 1) + ', column ' + (c + 1));
    cell.addEventListener('click', function () { onTap([r, c]); });
    return cell;
  });
  fillGrid(playEl('solution-grid'), board, function () { return document.createElement('span'); });
  board.words.forEach(function (w) {
    var li = document.createElement('li');
    li.textContent = w.text;
    playEl('words').appendChild(li);
  });
  drawMarks(playEl('solution-overlay'), board, playMarks(solvedPlay(board.words), board.words));
  wireFlip();
  wireWords();
  render();
  playEl('play').hidden = false;

  function onTap(cell) {
    play = tap(play, cell, board.words);
    render();
    play.events.forEach(function (e) { PLAY_EVENTS[e](); });
  }

  function render() {
    drawMarks(playEl('overlay'), board, playMarks(play, board.words));
    wordList(play, board.words).forEach(function (item, i) {
      playEl('words').children[i].classList.toggle('done', item.done);
    });
    playEl('count').textContent = countLabel(play, board.words);
  }

  var PLAY_EVENTS = { complete: celebrate };
}

function fillGrid(grid, board, makeCell) {
  board.letters.forEach(function (row, r) {
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
function wireFlip() {
  var card = playEl('card'), button = playEl('flip');
  button.addEventListener('click', function () {
    var on = card.classList.toggle('flipped');
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', PLAY_FLIP_LABELS[on]);
    button.title = PLAY_FLIP_LABELS[on];
    playEl('front').inert = on;
    playEl('back').inert = !on;
    playEl('back').setAttribute('aria-hidden', String(!on));
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
