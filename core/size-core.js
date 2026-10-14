// How big a puzzle shows: one choice, Tiny to Huge, kept on the device and read by every kind's
// page, so a pick made on one kind is the size the next puzzle of any kind opens at.

// The ladder: the wordsearch's letter steps, 10 to 32px against its Normal's 22, run on by 5px twice
// more. The wordsearch takes the first five rungs; the maze starts two up, so its Tiny is the
// maze page as it was before the choice came to it (the owner's call, 2026-10-14).
function sizeRungs() {
  return [10, 15, 22, 27, 32, 37, 42];
}

function sizeOrder() {
  return ['tiny', 'small', 'normal', 'large', 'huge'];
}

function kindShift() {
  return { wordsearch: 0, maze: 2 };
}

// A size's ratio to the wordsearch's Normal, on a kind: what that kind's page multiplies by.
export function sizeScale(kind, size) {
  return sizeRungs()[sizeOrder().indexOf(size) + kindShift()[kind]] / sizeRungs()[2];
}

// The size menu, smallest first: each size, its name and whether it's the one picked.
export function sizeMenu(picked) {
  var labels = { tiny: 'Tiny', small: 'Small', normal: 'Normal', large: 'Large', huge: 'Huge' };
  return sizeOrder().map(function (size) {
    return { size: size, label: labels[size], picked: size === picked };
  });
}

// The little square beside a size in a grid kind's menu, px a side: it grows by the size's step.
export function sizeSwatch(size) {
  return Math.round(8 + 16 * sizeScale('wordsearch', size));
}

// read() returns the stored size; a page that can't read it, or reads anything else, gets Normal.
export function savedSize(read) {
  try {
    return knownSize(read());
  } catch (e) {
    return 'normal';
  }
}

function knownSize(saved) {
  return sizeOrder().includes(saved) ? saved : 'normal';
}

// write(size) stores it; a page that can't still shows the size picked.
export function saveSize(write, size) {
  try {
    write(size);
    return true;
  } catch (e) {
    return false;
  }
}
