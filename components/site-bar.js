// The site bar every page shares: fills <header class="site" data-site-bar data-home="…"
// data-current="…">. data-home is the landing page's path from the page; data-current names
// the menu entry this page belongs to. A page that puts its own [data-menu-entry] elements
// inside the header gets those as its menu, in place of the site's sections. Collections — the
// landing page filtered to collections — starts hidden: a page that knows a collection exists
// shows it.
(function () {
  var bar = document.querySelector('[data-site-bar]');
  var home = bar.dataset.home;
  var own = Array.from(bar.querySelectorAll('[data-menu-entry]'));

  bar.innerHTML =
    '<a class="brand" data-query="">Grew Puzzles</a>' +
    '<div class="menu">' +
      '<button class="burger" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Menu">' +
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 5.5h14M3 10h14M3 14.5h14"/></svg>' +
      '</button>' +
      '<nav class="menu-panel" id="site-menu" aria-label="Site" hidden>' +
        '<a data-entry="wordsearches" data-query="">Wordsearches</a>' +
        '<a data-entry="collections" data-query="?type=Collections" hidden>Collections</a>' +
      '</nav>' +
    '</div>';

  var burger = bar.querySelector('.burger');
  var panel = bar.querySelector('.menu-panel');

  own.forEach(function (entry) {
    entry.addEventListener('click', function () { setMenu(false); });
  });
  if (own.length) panel.replaceChildren.apply(panel, own);

  bar.querySelectorAll('.brand, [data-entry]').forEach(function (a) { a.setAttribute('href', home + a.dataset.query); });
  bar.querySelectorAll('[data-entry="' + bar.dataset.current + '"]').forEach(function (a) {
    a.setAttribute('aria-current', 'page');
  });

  function setMenu(open) {
    panel.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
  }

  function closeAndFocus() {
    setMenu(false);
    burger.focus();
  }

  burger.addEventListener('click', function (e) {
    e.stopPropagation();
    setMenu(panel.hidden);
  });
  panel.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { setMenu(false); });
  document.addEventListener('keydown', function (e) {
    [closeAndFocus].filter(function () { return e.key === 'Escape'; }).forEach(function (f) { f(); });
  });
})();
