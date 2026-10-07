// Themed or Plain on every page: reads the owner's characters and dresses the page's parts in one —
// the page's background, a character's figure and its name label. Every part is dressed whichever
// look is on: styles/look.css shows them only while Themed is, so Plain never loads an image and
// the site bar's switch (components/site-bar.js) changes the look without redressing anything.
// Every rule is core/theme-core.js's.
import { charactersFile, charactersOf, dressOf, sceneFile, randomCharacter } from '../core/theme-core.js';

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
    new Promise(function (done) { setTimeout(done, wait); }),
  ]);
}

function sceneShown(character) {
  var loads = { themed: loadImage, plain: function () {} };
  dressScene(character);
  return loads[lookNow()](sceneFile(character));
}

function loadImage(file) {
  var image = new Image();
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
