// The site bar every page shares: fills <header class="site" data-site-bar data-home="…"
// data-current="…">, and puts the side bar — the map of the site — down the page's left, the rest
// of the page beside it. data-home is the landing page's path from the page; data-current names
// the side bar entry this page belongs to — a kind (wordsearch, maze), collections, or a text
// page. The kinds, each with its types, and Collections' count are filled from the indexes by
// ui/side-bar-ui.js; Collections starts hidden until a collection is found. How to play, Saving
// your progress, About us, Feedback and Privacy follow — every page sits in app/, beside them. After them,
// the look: Themed or Plain, Themed until the player picks Plain, kept in this browser. It sits on
// the page as <html data-look>, set here before any page script runs; picking one tells the page
// with a grew-look event (styles/look.css, ui/theme-ui.js). A page that puts its own
// [data-menu-entry] elements inside the header gets those last, ending the side bar — a page that
// prints, its print menu: the play page's Print page, the collection page's Print book. Every page
// starts printing Plain (<html data-print>), until its print menu says otherwise. On a phone the
// side bar is a drawer, opened by the burger at the bar's left (styles/site-bar.css).
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
  root.dataset.print = 'plain';

  bar.innerHTML =
    '<button class="burger" type="button" aria-expanded="false" aria-controls="site-side" aria-label="Menu">' +
      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 5.5h14M3 10h14M3 14.5h14"/></svg>' +
    '</button>' +
    '<a class="brand" data-query="">Grew Puzzles</a>';

  var side = document.createElement('nav');
  side.className = 'side';
  side.id = 'site-side';
  side.setAttribute('aria-label', 'Site');
  side.innerHTML =
    '<div class="side-kinds"></div>' +
    '<a class="kind side-collections" data-mark="collections" data-query="?kind=collections" hidden>Collections<small class="count"></small></a>' +
    '<hr>' +
    '<a class="page" data-mark="how-to-play" href="how-to-play.html">How to play</a>' +
    '<a class="page" data-mark="saving" href="saving.html">Saving your progress</a>' +
    '<a class="page" data-mark="about" href="about.html">About us</a>' +
    '<a class="page" data-mark="feedback" href="feedback.html">Feedback</a>' +
    '<a class="page" data-mark="privacy" href="privacy.html">Privacy</a>' +
    '<div class="look" role="group" aria-label="Look">' +
      '<span class="look-name">Look</span>' +
      '<button type="button" data-look="themed">Themed</button>' +
      '<button type="button" data-look="plain">Plain</button>' +
    '</div>' +
    '<div class="side-own"></div>';
  var ownSlot = side.querySelector('.side-own');
  var look = side.querySelector('.look');
  var burger = bar.querySelector('.burger');
  own.forEach(function (entry) {
    entry.addEventListener('click', function () { setSide(false); });
  });
  ownSlot.append.apply(ownSlot, own);
  ownSlot.hidden = own.length === 0;

  // The side bar, then the page beside it: everything the page put after its site bar.
  var scrim = document.createElement('div');
  scrim.className = 'side-scrim';
  var body = document.createElement('div');
  body.className = 'site-body';
  var main = document.createElement('div');
  main.className = 'site-main';
  var rest = [];
  for (var next = bar.nextSibling; next; next = next.nextSibling) rest.push(next);
  main.append.apply(main, rest);
  body.append(side, scrim, main);
  bar.after(body);

  // The look stays as picked, so the player sees the page change beside it.
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

  bar.querySelectorAll('.brand').forEach(function (a) { a.setAttribute('href', home + a.dataset.query); });
  side.querySelectorAll('[data-query]').forEach(function (a) { a.setAttribute('href', home + a.dataset.query); });

  // The drawer, on a phone: the burger opens and closes it; a press outside it, or Escape, closes it.
  function setSide(open) {
    side.toggleAttribute('data-open', open);
    burger.setAttribute('aria-expanded', String(open));
  }

  function closeAndFocus() {
    setSide(false);
    burger.focus();
  }

  burger.addEventListener('click', function (e) {
    e.stopPropagation();
    setSide(!side.hasAttribute('data-open'));
  });
  // A link pressed in the drawer closes it — on the landing page a place or a type draws where the
  // player is, with no new page to close it.
  side.addEventListener('click', function (e) {
    e.stopPropagation();
    [setSide].filter(function () { return e.target.closest('a'); }).forEach(function (f) { f(false); });
  });
  document.addEventListener('click', function () { setSide(false); });
  // Escape is the drawer's only while it is open — closed, the key belongs to the rest of the page.
  document.addEventListener('keydown', function (e) {
    [closeAndFocus].filter(function () { return e.key === 'Escape' && side.hasAttribute('data-open'); }).forEach(function (f) { f(); });
  });
})();
