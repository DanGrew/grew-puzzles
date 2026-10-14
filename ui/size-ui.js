// The size choice every kind's page shares: its corner button opens Tiny to Huge under it, each
// beside what that size looks like, the one picked ticked. A size picked closes the menu, is kept
// on this device — under the name the wordsearch always kept it by, so a pick made before carries
// over — and is the size every kind's next page opens at. Pressing outside closes it unchanged.
// The rules are core/size-core.js.
import { sizeMenu, savedSize, saveSize, sizeSwatch } from '../core/size-core.js';

var SIZE_KEY = 'grew-puzzles.text-size';

// A size in a grid kind's menu: a square at its size, since it's the grid that grows (size-core's
// sizeSwatch).
export function sizeSquare(size) {
  var square = document.createElement('span');
  square.className = 'square';
  square.style.setProperty('--swatch', sizeSwatch(size) + 'px');
  return square;
}

// button and menu: the page's corner button and its popover. swatch(size) makes what sits beside a
// size's name; show(size) takes the size, once now with the size kept, then at every pick, and
// picked() lays the page out again after a pick.
export function wireSizeMenu(button, menu, swatch, show, picked) {
  sizeMenu('').forEach(function (item) {
    var choice = document.createElement('button'), tick = document.createElement('span'), name = document.createElement('span');
    choice.type = 'button';
    choice.setAttribute('role', 'menuitemradio');
    choice.dataset.size = item.size;
    tick.className = 'tick';
    name.textContent = item.label;
    choice.append(tick, swatch(item.size), name);
    choice.addEventListener('click', function () { pickSize(item.size); });
    menu.appendChild(choice);
  });
  menu.addEventListener('toggle', function (e) {
    button.setAttribute('aria-expanded', String(e.newState === 'open'));
    placeMenu();
  });
  window.addEventListener('scroll', placeMenu);
  window.addEventListener('resize', placeMenu);
  showSize(savedSize(function () { return localStorage.getItem(SIZE_KEY); }));

  function pickSize(size) {
    showSize(size);
    picked();
    saveSize(function (s) { localStorage.setItem(SIZE_KEY, s); }, size);
    menu.hidePopover();
  }

  function showSize(size) {
    sizeMenu(size).forEach(function (item, i) {
      menu.children[i].setAttribute('aria-checked', String(item.picked));
    });
    show(size);
  }

  // The menu opens just under its button, its left edge lined up with the button's.
  function placeMenu() {
    var at = button.getBoundingClientRect();
    menu.style.top = at.bottom + 6 + 'px';
    menu.style.left = at.left + 'px';
  }
}
