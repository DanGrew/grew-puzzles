// A kind's How to play page (app/how-to-play.html): the kind its address names — the first, where it
// names none the site has (core/kind-core.js rulesOf) — its name in the title, its place current in
// the side bar, and its Basics | Advanced | Variants pills, Basics picked as it opens, each showing
// only that kind's part.
import { rulesOf, partShows } from '../core/kind-core.js';
import { markPlace } from './side-bar-ui.js';

var place = rulesOf(new URLSearchParams(location.search).get('kind'));
var pills = Array.from(document.querySelectorAll('.part-pills [role="tab"]'));

document.title = 'How to play ' + place.name + ' · Grew Puzzles';
document.getElementById('page-title').textContent = 'How to play ' + place.name;
markPlace(place.kind, []);

function pick(picked) {
  pills.forEach(function (pill) { pill.setAttribute('aria-selected', String(pill.dataset.part === picked)); });
  document.querySelectorAll('.part').forEach(function (part) { part.hidden = !partShows(part.dataset, place.kind, picked); });
}

pills.forEach(function (pill) { pill.addEventListener('click', function () { pick(pill.dataset.part); }); });
pick(pills[0].dataset.part);
