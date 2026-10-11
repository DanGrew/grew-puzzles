// Themed or Plain on every page: reads the owner's characters and dresses the page's parts in one —
// the page's background, a character's figure and its name label. Every part is dressed whichever
// look is on: styles/look.css shows them only while Themed is, so Plain never loads an image and
// the site bar's switch (components/site-bar.js) changes the look without redressing anything.
// Every rule is core/theme-core.js's.
import { charactersFile, charactersOf, dressOf, sceneFile, figureFile, randomCharacter, isPhone, siteDress } from '../core/theme-core.js';

// The characters, in the owner's order — none when the list can't be read, which dresses nothing.
export function withCharacters(then) {
  return fetch(charactersFile())
    .then(function (r) { return r.json(); })
    .then(charactersOf)
    .catch(function () { return []; })
    .then(then);
}

export function dressScene(character) {
  document.documentElement.style.setProperty('--scene', dressOf(character).scene);
}

// The page's background in a character picked at random, settling once its image has arrived —
// or after wait ms, whichever is first, so a page waiting on it never waits long. Plain, or no
// characters, settles without loading an image.
export function dressRandomScene(random, wait) {
  return Promise.race([
    withCharacters(function (characters) { return sceneShown(randomCharacter(characters, random)); }),
    new Promise(function (done) { window.setTimeout(done, wait); }),
  ]);
}

function sceneShown(character) {
  var loads = { themed: loadImage, plain: function () {} };
  dressScene(character);
  return loads[document.documentElement.dataset.look](sceneFile(character));
}

function loadImage(file) {
  var image = document.createElement('img');
  image.src = file;
  return image.decode().catch(function () {});
}

export function dressFigure(el, character) {
  el.style.setProperty('--figure', dressOf(character).figure);
}

export function dressName(el, character) {
  el.textContent = dressOf(character).name;
}

// Every change of the look — the site bar sets it before any page script runs.
export function onLook(then) {
  document.addEventListener('grew-look', then);
}

// A print menu's pick: the page prints in its style — colour, mono or plain, on <html data-print>,
// Plain until a pick — once what that style wears is loaded (load, a promise).
export function printIn(style, load) {
  document.documentElement.dataset.print = style;
  return load().then(function () { window.print(); });
}

// Printed Colour or Black and white, a sheet's character and its background are loaded ahead, so
// the print dialog has them when it draws the paper; Plain loads neither.
export function printImages(character) {
  var both = function () { return Promise.all([sceneFile(character), figureFile(character)].map(loadImage)); };
  var loads = { plain: function () { return Promise.resolve(); }, colour: both, mono: both };
  return loads[document.documentElement.dataset.print]();
}

// One printed sheet's character, behind the card it peers from, on the spot printDress picked
// (core/theme-core.js), with no name label, and the sheet's rise on the element that starts it.
// styles/look.css shows it only on paper, and only for Colour or Black and white.
export function dressPrintSheet(card, start, character, dress) {
  var figure = card.querySelector('.print-figure');
  dressFigure(figure, character);
  figure.dataset.spot = dress.spot;
  figure.style.left = dress.left;
  figure.style.top = dress.top;
  figure.style.height = dress.height;
  figure.style.transform = dress.transform;
  start.style.setProperty('--print-rise', dress.rise);
}

// What of the window a page's character may stand in, across, from origin's left: the side bar's
// right edge, or the window's left with no side bar on show, to the window's right.
export function screenEdges(origin) {
  var side = document.getElementById('site-side').getBoundingClientRect();
  var left = [0, side.right][Number(side.width > 0)];
  return { left: left - origin, right: document.documentElement.clientWidth - origin };
}

// The name label's size, as siteDress judges a spot by it: shown first, wider than a phone, so it
// has one; on a phone it's hidden, and has none.
export function labelSize(tag, phone) {
  tag.hidden = phone;
  var box = tag.getBoundingClientRect();
  return { width: box.width, height: box.height };
}

// A character on screen, on the spot siteDress picked (core/theme-core.js): centred on it, turned,
// and its name label beside it — none on a phone.
export function placeFigure(figure, tag, dress) {
  figure.dataset.spot = dress.spot;
  figure.style.left = dress.left;
  figure.style.top = dress.top;
  figure.style.height = dress.height;
  figure.style.transform = dress.transform;
  tag.hidden = !dress.label;
  tag.style.left = dress.labelLeft;
  tag.style.top = dress.labelTop;
}

// A text page: a background and a character, each picked fresh on every load and on their own,
// so any character can stand on any background. The character peers from behind the text card at
// the printout's spot the page's place in the side bar picks, at the printout's own size — placed
// again whenever the window changes size, as a spot the window's edge cuts is skipped.
export function dressTextPage(random) {
  withCharacters(function (characters) {
    var figure = randomCharacter(characters, random);
    var place = function () { placeTextFigure(figure); };
    dressScene(randomCharacter(characters, random));
    dressFigure(document.getElementById('theme-figure'), figure);
    dressName(document.getElementById('name-tag'), figure);
    place();
    window.addEventListener('resize', place);
  });
}

// The page's number: its place among the side bar's text pages (components/site-bar.js), from 1.
function textPageNumber() {
  var marks = Array.from(document.querySelectorAll('#site-side a.page'), function (a) { return a.dataset.mark; });
  return marks.indexOf(document.querySelector('[data-site-bar]').dataset.current) + 1;
}

// The text card's spot, measured from inside its outline, where its character is placed from.
function placeTextFigure(character) {
  var el = document.querySelector('.page-card'), card = el.getBoundingClientRect(), tag = document.getElementById('name-tag');
  var phone = isPhone(document.documentElement.clientWidth);
  placeFigure(document.getElementById('theme-figure'), tag, siteDress({
    card: { left: -el.clientLeft, top: -el.clientTop, width: card.width, height: card.height }, scale: 1,
    screen: screenEdges(card.left + el.clientLeft), words: { left: 0, top: 0, width: 0, height: 0 },
    label: labelSize(tag, phone), saga: false, phone: phone
  }, character, textPageNumber()));
}
