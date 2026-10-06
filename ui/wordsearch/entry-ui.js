// A word's entry on the play page: once the entries arrive, each listed word that has one is
// marked, and tapping it opens its popup beside it — Esc, its ✕ or a tap anywhere else closing it,
// and that tap never landing on the grid. Every rule lives in core/entries-core.js; nothing here
// decides anything. Reading an entry changes nothing on the board, and the printout never shows it.
import { entriesUrl, entriesJson, wordEntries, popupPlace, popupTap, popupKey, wordKey } from '../../core/entries-core.js';
import { isPhone } from '../../core/theme-core.js';

var ENTRY_MARKS = { true: markWord, false: function () {} };
var ENTRY_TAPS = { none: function () {}, dismiss: dismissEntry };
var ENTRY_KEYS = { close: closeEntry, none: function () {} };
var ENTRY_WORD_KEYS = { open: openFromKey, none: function () {} };
// The marked word whose popup is open — or was last: the popup sits beside it, and closing hands
// it back the focus.
var entryWord = null;

function entryEl(id) {
  return document.getElementById(id);
}

// groups are the puzzle's wordGroups, listed its words as the list shows them (play-core's
// listedWords). A site with no entries, or a puzzle whose groups have none, leaves the list as it is.
export function wireEntries(groups, listed) {
  wirePopup();
  return fetch(entriesUrl())
    .then(entriesJson)
    .then(function (index) { markWords(wordEntries(index, groups, listed)); }, function () {});
}

function markWords(entries) {
  var words = entryEl('words').children;
  entries.forEach(function (entry, i) { ENTRY_MARKS[entry.marked](words[i], entry); });
}

function markWord(li, entry) {
  li.classList.add('has-entry');
  li.tabIndex = 0;
  li.setAttribute('role', 'button');
  li.setAttribute('aria-haspopup', 'dialog');
  li.addEventListener('click', function () { openEntry(li, entry); });
  li.addEventListener('keydown', function (e) { ENTRY_WORD_KEYS[wordKey(e.key)](e, li, entry); });
}

function openFromKey(e, li, entry) {
  e.preventDefault();
  openEntry(li, entry);
}

// Taps are heard before anything else on the page sees them, so the one that closes the popup can
// stop there.
function wirePopup() {
  var popup = entryEl('word-popup');
  window.addEventListener('click', function (e) {
    ENTRY_TAPS[popupTap(popup.matches(':popover-open'), popup.contains(e.target), Boolean(e.target.closest('.has-entry')))](e);
  }, true);
  window.addEventListener('keydown', function (e) { ENTRY_KEYS[popupKey(popup.matches(':popover-open'), e.key)](); });
  entryEl('entry-close').addEventListener('click', closeEntry);
}

// Another marked word, tapped while one is open, swaps it in place.
function openEntry(li, entry) {
  var popup = entryEl('word-popup');
  entryWord = li;
  entryEl('entry-word').textContent = entry.word;
  entryEl('entry-definition').textContent = entry.definition;
  drawFacts(entry);
  entryEl('entry-credit').textContent = entry.credit;
  entryEl('entry-credit').hidden = !entry.hasCredit;
  entryEl('entry-link').href = entry.link;
  entryEl('entry-link').hidden = !entry.hasLink;
  popup.showPopover();
  entryEl('entry-body').scrollTop = 0;
  placeEntry();
  window.addEventListener('scroll', placeEntry, true);
  window.addEventListener('resize', placeEntry);
  entryEl('entry-close').focus({ preventScroll: true });
}

function drawFacts(entry) {
  var facts = entryEl('entry-facts');
  facts.replaceChildren();
  entry.facts.forEach(function (fact) {
    var label = document.createElement('dt'), value = document.createElement('dd');
    label.textContent = fact.label;
    value.textContent = fact.value;
    facts.append(label, value);
  });
  facts.hidden = !entry.hasFacts;
}

// Beside its word, kept there as the page or the list scrolls; on a phone, a card over the page.
function placeEntry() {
  var popup = entryEl('word-popup'), width = document.documentElement.clientWidth;
  var place = popupPlace(entryWord.getBoundingClientRect(), { width: popup.offsetWidth, height: popup.offsetHeight },
    { width: width, height: window.innerHeight }, isPhone(width));
  popup.style.left = place.left;
  popup.style.top = place.top;
}

function dismissEntry(e) {
  e.preventDefault();
  e.stopPropagation();
  closeEntry();
}

function closeEntry() {
  entryEl('word-popup').hidePopover();
  window.removeEventListener('scroll', placeEntry, true);
  window.removeEventListener('resize', placeEntry);
  entryWord.focus({ preventScroll: true });
}
