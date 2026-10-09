// The side bar's kinds (components/site-bar.js): Wordsearches and Mazes, each with its puzzle count
// and its types beneath, a dot in each type's difficulty colour, then Collections' count — read
// from the indexes, never a puzzle file (core/kind-core.js). The landing page's Wordsearches |
// Mazes switch, shown on a phone, is filled from the same map. An entry is marked current for the
// page's place: the page's own data-current, or — on the landing page, whose place is its address —
// what markPlace is told. A site with no maze index, or no collections file, reads as none.
import { sideBar, sideMarks, markOf } from '../core/kind-core.js';

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

function switchEntry(kind) {
  var a = link('', kind);
  a.appendChild(part('small', 'count', kind.count));
  return a;
}

function paint() {
  document.querySelectorAll('[data-mark]').forEach(function (a) { a.setAttribute('aria-current', markOf(marks, a.dataset.mark)); });
}

function fill([index, mazes, published]) {
  var map = sideBar(index.puzzles.concat(mazes.puzzles), published.collections);
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
  fetch('../content/puzzles/wordsearch/index.json').then(function (r) { return r.json(); }).catch(function () { return { puzzles: [] }; }),
  fetch('../content/puzzles/maze/index.json').then(function (r) { return r.json(); }).catch(function () { return { puzzles: [] }; }),
  fetch('../content/collections/index.json').then(function (r) { return r.json(); }).catch(function () { return { collections: [] }; }),
]).then(fill);
