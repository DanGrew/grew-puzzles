// Themed or Plain on every page: reads the owner's characters and dresses the page's parts in one —
// the page's background, a character's figure and its name label. Every part is dressed whichever
// look is on: styles/look.css shows them only while Themed is, so Plain never loads an image and
// the site bar's switch (components/site-bar.js) changes the look without redressing anything.
// Every rule is core/theme-core.js's.
import { charactersFile, charactersOf, dressOf, sceneFile, figureFile, randomCharacter } from '../core/theme-core.js';

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

// The look on now — the site bar sets it before any page script runs — and every change of it.
export function lookNow() {
  return document.documentElement.dataset.look;
}

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

// A text page: a background and a character, each picked fresh on every load and on their own,
// so any character can stand on any background.
export function dressTextPage(random) {
  withCharacters(function (characters) {
    var figure = randomCharacter(characters, random);
    dressScene(randomCharacter(characters, random));
    dressFigure(document.getElementById('theme-figure'), figure);
    dressName(document.getElementById('name-tag'), figure);
  });
}
