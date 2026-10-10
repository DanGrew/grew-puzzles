// The play card every puzzle's page shares: the line under its title, the flip to its solution
// and back, and the pop and sparkle when it's finished. Each page names the parts by the same ids
// — #ident, #card, #front, #back, #flip and #board. Where each sparkle goes is
// core/wordsearch/play-core.js's sparkles.
import { sparkles } from '../core/wordsearch/play-core.js';

var CARD_FLIP_LABELS = { true: 'Back to puzzle', false: 'Show solution' };
var CARD_SPARKLE_COUNT = 28;
var CARD_SPARKLE_LIFE_MS = 1700;

function cardEl(id) {
  return document.getElementById(id);
}

// The line under a puzzle's title: its difficulty, in its colour, and its code — Easy · WSCH-0042.
// part finds a part by its id: the page's own, or a copy of the play page in the book.
export function drawIdent(part, board) {
  part('difficulty').textContent = board.difficulty;
  part('difficulty').dataset.tone = board.difficulty;
  part('code').textContent = board.code;
  part('ident').hidden = false;
}

// The grid turns over like a revolving door; what the player did on the front stays as it was.
// onFlip hears every turn.
export function wireFlip(onFlip) {
  var card = cardEl('card'), button = cardEl('flip');
  button.addEventListener('click', function () {
    var on = card.classList.toggle('flipped');
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', CARD_FLIP_LABELS[on]);
    button.title = CARD_FLIP_LABELS[on];
    cardEl('front').inert = on;
    cardEl('back').inert = !on;
    cardEl('back').setAttribute('aria-hidden', String(!on));
    onFlip();
  });
}

export function celebrate() {
  var board = cardEl('board');
  board.classList.remove('pop');
  void board.offsetWidth;
  board.classList.add('pop');
  sparkles(CARD_SPARKLE_COUNT, board.offsetWidth, board.offsetHeight, Math.random).forEach(function (s) {
    var spark = document.createElement('span');
    spark.className = 'spark';
    spark.style.left = s.x + 'px';
    spark.style.top = s.y + 'px';
    spark.style.setProperty('--dx', s.dx + 'px');
    spark.style.setProperty('--dy', s.dy + 'px');
    spark.style.animationDelay = s.delay + 's';
    board.appendChild(spark);
    setTimeout(function () { spark.remove(); }, CARD_SPARKLE_LIFE_MS);
  });
}
