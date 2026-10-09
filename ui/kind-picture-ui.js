// A tile's picture: its kind's illustration, the same on every tile of that kind — a maze for a
// maze, a letter grid with a word ringed for a wordsearch — between the tile's strip and its title.
// Drawn here, never read from a puzzle file, so a page of tiles loads nothing more. A collection's
// tile has none (styles/browse.css hides an empty one).
var PICTURES = {
  maze: '<svg viewBox="-3 -3 96 76"><path d="M0 0h10M10 0h10M10 0v10M20 0h10M20 0v10M30 0h10M40 0h10M50 0h10M60 0h10M60 0v10M70 0h10M80 0h10M90 0v10M0 10v10M10 10v10M20 10v10M30 10v10M40 10h10M40 10v10M50 10h10M60 10v10M70 10v10M80 10v10M90 10v10M0 20v10M10 20v10M30 20v10M50 20v10M70 20v10M80 20h10M90 20v10M0 30v10M10 30v10M20 30h10M20 30v10M30 30h10M40 30h10M40 30v10M50 30h10M60 30h10M70 30h10M90 30v10M0 40v10M10 40h10M20 40v10M30 40v10M40 40v10M50 40h10M50 40v10M60 40h10M70 40h10M80 40v10M90 40v10M0 50h10M0 50v10M10 50v10M30 50v10M40 50v10M50 50h10M60 50h10M70 50v10M90 50v10M0 60v10M0 70h10M10 60h10M10 70h10M20 60h10M20 70h10M30 70h10M40 60h10M40 70h10M50 60h10M50 70h10M60 70h10M70 60v10M70 70h10M80 60h10M80 70h10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/><circle cx="5" cy="5" r="2.6" fill="var(--accent)"/></svg>',
  wordsearch: '<svg viewBox="-3 -3 90 66"><rect x="-1.5" y="-1.5" width="87" height="63" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="12.5" y="13" width="47" height="11" rx="5.5" fill="none" stroke="var(--accent)" stroke-width="2"/><g font-family="Sora, sans-serif" font-size="9" font-weight="600" text-anchor="middle" fill="currentColor"><text x="6" y="10">K</text><text x="18" y="10">T</text><text x="30" y="10">O</text><text x="42" y="10">P</text><text x="54" y="10">A</text><text x="66" y="10">W</text><text x="78" y="10">D</text><text x="6" y="22">S</text><text x="18" y="22">G</text><text x="30" y="22">R</text><text x="42" y="22">E</text><text x="54" y="22">W</text><text x="66" y="22">L</text><text x="78" y="22">M</text><text x="6" y="34">B</text><text x="18" y="34">N</text><text x="30" y="34">Q</text><text x="42" y="34">U</text><text x="54" y="34">Z</text><text x="66" y="34">I</text><text x="78" y="34">C</text><text x="6" y="46">F</text><text x="18" y="46">H</text><text x="30" y="46">A</text><text x="42" y="46">Y</text><text x="54" y="46">E</text><text x="66" y="46">X</text><text x="78" y="46">R</text><text x="6" y="58">M</text><text x="18" y="58">D</text><text x="30" y="58">V</text><text x="42" y="58">O</text><text x="54" y="58">J</text><text x="66" y="58">N</text><text x="78" y="58">P</text></g></svg>',
  collections: '',
};

export function kindPicture(place) {
  var pic = document.createElement('span');
  pic.className = 'pic';
  pic.setAttribute('aria-hidden', 'true');
  pic.innerHTML = PICTURES[place];
  return pic;
}
