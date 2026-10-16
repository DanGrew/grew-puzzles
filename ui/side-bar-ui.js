// The side bar's kinds (components/site-bar.js): Wordsearches, Mazes, Minesweeper, Criss-cross and
// Mosaic, each with its puzzle count, its book icon and its types beneath, a dot by each type (core/kind-core.js
// dotTone), then Collections' count — read from the indexes, never a puzzle file (ui/indexes-ui.js).
// The landing page's Words | Mazes | Mines | Criss-cross | Mosaic switch, shown on a phone, is filled
// from the same map. An
// entry is marked current for the page's place: the page's own data-current, or — on the landing
// page, whose place is its address — what markPlace is told. A kind with no index yet, or a site
// with no collections file, reads as none.
import { sideBar, sideMarks, markOf, rulesOf } from '../core/kind-core.js';
import { readPuzzles } from './indexes-ui.js';

var bar = document.querySelector('[data-site-bar]');
var home = bar.dataset.home;
var marks = [bar.dataset.current];

function part(tag, className, text) {
  var el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

function link(className, entry) {
  var a = part('a', className, entry.name);
  a.setAttribute('href', home + entry.query);
  a.setAttribute('data-mark', entry.mark);
  return a;
}

function typeEntry(type) {
  var a = link('type', type);
  a.dataset.tone = type.tone;
  a.prepend(part('span', 'dot', ''));
  var li = document.createElement('li');
  li.append(a);
  return li;
}

// A kind's book icon, opening its How to play page (core/kind-core.js rulesOf) — beside its name in
// the side bar, and on its play pages.
var BOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 4.5h6a4 4 0 0 1 4 4V20a3 3 0 0 0-3-3H2z"/><path d="M22 4.5h-6a4 4 0 0 0-4 4V20a3 3 0 0 1 3-3h7z"/></svg>';

function bookIcon(rules) {
  var a = part('a', 'rules', '');
  a.setAttribute('href', rules.href);
  a.setAttribute('aria-label', 'How to play ' + rules.name);
  a.setAttribute('title', 'How to play');
  a.innerHTML = BOOK;
  return a;
}

function kindEntry(kind) {
  var a = link('kind', kind);
  a.appendChild(part('small', 'count', kind.count));
  var row = part('div', 'kind-row', '');
  row.append(a, bookIcon(rulesOf(kind.mark)));
  var types = part('ul', 'types', '');
  types.append.apply(types, kind.types.map(typeEntry));
  return [row, types];
}

// The phone's switch names each kind short — Words | Mazes | Mines | Criss-cross | Mosaic — as the full names
// don't fit.
function switchEntry(kind) {
  var a = link('', { name: kind.short, query: kind.query, mark: kind.mark });
  a.appendChild(part('small', 'count', kind.count));
  return a;
}

// Where the switch scrolls sideways, it scrolls just enough to show the current kind whole; the
// page itself never moves.
function showCurrent(a) {
  var nav = a.parentElement;
  var room = nav.getBoundingClientRect();
  var box = a.getBoundingClientRect();
  nav.scrollLeft += Math.max(0, box.right - room.right) + Math.min(0, box.left - room.left);
}

function paint() {
  document.querySelectorAll('[data-mark]').forEach(function (a) { a.setAttribute('aria-current', markOf(marks, a.dataset.mark)); });
  document.querySelectorAll('.kind-switch [aria-current="page"]').forEach(showCurrent);
}

function fill([puzzles, published]) {
  var map = sideBar(puzzles, published.collections);
  document.querySelector('.side-kinds').replaceChildren.apply(document.querySelector('.side-kinds'), map.kinds.flatMap(kindEntry));
  document.querySelectorAll('.kind-switch').forEach(function (nav) { nav.replaceChildren.apply(nav, map.kinds.map(switchEntry)); });
  var collections = document.querySelector('.side-collections');
  collections.hidden = map.collections.hidden;
  collections.querySelector('.count').textContent = map.collections.count;
  paint();
}

// The landing page's place is its address: the kind it shows, and its picked types — one alone
// marks that type too.
export function markPlace(place, types) {
  marks = sideMarks(place, types);
  paint();
}

// A play page's own book icon, in its [data-rules] slot: its kind's, the page's data-current.
document.querySelectorAll('[data-rules]').forEach(function (slot) { slot.replaceChildren(bookIcon(rulesOf(bar.dataset.current))); });
paint();
export var ready = Promise.all([
  readPuzzles(),
  fetch('../content/collections/index.json').then(function (r) { return r.json(); }).catch(function () { return { collections: [] }; }),
]).then(fill);
// The switch's names widen once the site's fonts are in, so the current kind is shown again then.
ready.then(function () { return document.fonts.ready; }).then(paint);
