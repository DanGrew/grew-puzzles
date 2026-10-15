// The side bar's kinds (components/site-bar.js): Wordsearches, Mazes, Minesweeper, Criss-cross and
// Mosaic, each with its puzzle count and its types beneath, a dot by each type (core/kind-core.js
// dotTone), then Collections' count — read from the indexes, never a puzzle file (ui/indexes-ui.js).
// The landing page's Words | Mazes | Mines | Criss-cross | Mosaic switch, shown on a phone, is filled
// from the same map. An
// entry is marked current for the page's place: the page's own data-current, or — on the landing
// page, whose place is its address — what markPlace is told. A kind with no index yet, or a site
// with no collections file, reads as none.
import { sideBar, sideMarks, markOf } from '../core/kind-core.js';
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

function kindEntry(kind) {
  var a = link('kind', kind);
  a.appendChild(part('small', 'count', kind.count));
  var types = part('ul', 'types', '');
  types.append.apply(types, kind.types.map(typeEntry));
  return [a, types];
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

paint();
export var ready = Promise.all([
  readPuzzles(),
  fetch('../content/collections/index.json').then(function (r) { return r.json(); }).catch(function () { return { collections: [] }; }),
]).then(fill);
// The switch's names widen once the site's fonts are in, so the current kind is shown again then.
ready.then(function () { return document.fonts.ready; }).then(paint);
