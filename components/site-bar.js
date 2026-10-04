// The site bar every page shares: fills <header class="site" data-site-bar data-home="…"
// data-current="…">. data-home is the landing page's path from the page; data-current names
// the menu entry this page belongs to. A page that puts its own [data-menu-entry] elements
// inside the header gets those as its menu, in place of the site's sections. Collections — the
// landing page filtered to collections — starts hidden: a page that knows a collection exists
// shows it. Privacy ends every menu, a page's own included — every page sits in app/, beside it.
// Above Privacy, on every menu, the look: Themed or Plain, Themed until the player picks Plain,
// kept in this browser. It sits on the page as <html data-look>, set here before any page script
// runs; picking one tells the page with a grew-look event (styles/look.css, ui/theme-ui.js).
(function () {
  var LOOK_KEY = 'grew-puzzles.look';
  var root = document.documentElement;
  var bar = document.querySelector('[data-site-bar]');
  var home = bar.dataset.home;
  var own = Array.from(bar.querySelectorAll('[data-menu-entry]'));

  function storedLook() {
    try { return localStorage.getItem(LOOK_KEY); } catch (e) { return null; }
  }
  root.dataset.look = { plain: 'plain' }[storedLook()] || 'themed';

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
  var privacy = document.createElement('a');
  privacy.dataset.entry = 'privacy';
  privacy.href = 'privacy.html';
  privacy.textContent = 'Privacy';
  var look = document.createElement('div');
  look.className = 'look';
  look.setAttribute('role', 'group');
  look.setAttribute('aria-label', 'Look');
  look.innerHTML = '<span class="look-name">Look</span>' +
    '<button type="button" data-look="themed">Themed</button>' +
    '<button type="button" data-look="plain">Plain</button>';

  own.forEach(function (entry) {
    entry.addEventListener('click', function () { setMenu(false); });
  });
  if (own.length) panel.replaceChildren.apply(panel, own);
  panel.append(look, privacy);

  // The menu stays open on a pick, so the player sees the page change under it.
  function showLook() {
    look.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.look === root.dataset.look)); });
  }
  look.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () {
      root.dataset.look = b.dataset.look;
      try { localStorage.setItem(LOOK_KEY, b.dataset.look); } catch (e) { /* kept until the page closes */ }
      showLook();
      document.dispatchEvent(new Event('grew-look'));
    });
  });
  showLook();

  bar.querySelectorAll('.brand, [data-query]').forEach(function (a) { a.setAttribute('href', home + a.dataset.query); });
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
  // Escape is the menu's only while it is open — closed, the key belongs to the rest of the page.
  document.addEventListener('keydown', function (e) {
    [closeAndFocus].filter(function () { return e.key === 'Escape' && !panel.hidden; }).forEach(function (f) { f(); });
  });
})();
