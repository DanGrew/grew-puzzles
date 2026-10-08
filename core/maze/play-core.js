// The maze play page's rules: which maze a play URL names, what its board holds, what a tap does
// to the trail, what the checklist reads, and what the solution side draws. Pure — the DOM work is
// ui/maze/play-ui.js. The maze file and its walk are grew-puzzles-tooling's docs/PUZZLE-FORMAT.md:
// the site only reads them — walls, stops, zones and the saved solution — and never solves or
// checks anything itself.
import { dayLabel } from '../day-core.js';

// ---- Finding the maze ----

// The play URL names a maze by its hidden ID — maze.html?id=MAZE-0001 — and its file carries that
// name. Anything else names no maze, so it never becomes a path.
export function mazeUrl(search) {
  var id = new URLSearchParams(search).get('id');
  if (!/^MAZE-[0-9]{4,}$/.test(id)) throw new Error('No such puzzle');
  return '../content/puzzles/maze/' + id + '.json';
}

// ---- The board ----

// A step to each side, and the wall bit that side's wall is written with: N 1, E 2, S 4, W 8.
function sides() {
  return { N: [-1, 0, 1], E: [0, 1, 2], S: [1, 0, 4], W: [0, -1, 8] };
}

function at(stop) {
  return [stop.row, stop.col];
}

function sameCell(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

// The walls as one path, counted in cells: each cell draws its north and west walls, and the
// bottom row and right column the maze's edge too — every wall once.
export function wallPath(walls) {
  var last = walls.length - 1;
  return walls.map(function (row, r) {
    return row.split('').map(function (digit, c) {
      var bits = parseInt(digit, 16);
      return [
        [bits & 1, 'M' + c + ' ' + r + 'h1'],
        [bits & 8, 'M' + c + ' ' + r + 'v1'],
        [bits & 4 && r === last, 'M' + c + ' ' + (r + 1) + 'h1'],
        [bits & 2 && c === row.length - 1, 'M' + (c + 1) + ' ' + r + 'v1']
      ].filter(function (wall) { return wall[0]; }).map(function (wall) { return wall[1]; }).join('');
    }).join('');
  }).join('');
}

// The six orders of A, B and C: the exits' lines on the checklist, in this order.
function orders() {
  return ['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA'];
}

// Everything a player can step on and tick, each with an id the play remembers it by: guides,
// collectibles, keys and letters picked up, and the exits — or, in a maze without letters, its
// end. An exit is right when it stands on the end.
function stopsOf(puzzle) {
  var end = at(puzzle.end);
  var pickups = function (kind, list) {
    return list.map(function (s, i) { return { id: kind + '-' + i, kind: kind, cell: at(s), label: '' }; });
  };
  var exits = puzzle.exits.slice().sort(function (a, b) { return orders().indexOf(a.code) - orders().indexOf(b.code); })
    .map(function (e) { return { id: 'exit-' + e.code, kind: 'exit', cell: at(e), label: e.code, right: sameCell(at(e), end) }; });
  var finish = { true: exits, false: [{ id: 'end', kind: 'end', cell: end, label: 'End', right: true }] }[exits.length > 0];
  return pickups('guide', puzzle.guides)
    .concat(pickups('collectible', puzzle.collectibles))
    .concat(puzzle.keys.map(function (k) { return { id: 'key-' + k.key, kind: 'key', cell: at(k), label: String(k.key) }; }))
    .concat(puzzle.letters.map(function (l) { return { id: 'letter-' + l.letter, kind: 'letter', cell: at(l), label: l.letter }; }))
    .concat(finish);
}

// The walk the file saves, as the cells it stands on, the start first.
function walkCells(puzzle) {
  return puzzle.solution.split('').reduce(function (cells, side) {
    var here = cells[cells.length - 1], step = sides()[side];
    return cells.concat([[here[0] + step[0], here[1] + step[1]]]);
  }, [at(puzzle.start)]);
}

// The main path, read off the saved walk: in a perfect maze every step back the way the walk
// came undoes the step before it, so what's left is the one route from the start to the end.
function mainPath(walk) {
  return walk.reduce(function (path, cell) {
    var back = path.length > 1 && sameCell(path[path.length - 2], cell);
    return { true: path.slice(0, -1), false: path.concat([cell]) }[back];
  }, []);
}

// The maze's type is the board's only label on screen, as a wordsearch's is.
export function mazeBoard(puzzle) {
  var walk = walkCells(puzzle), main = mainPath(walk);
  var onMain = function (cell) { return main.some(function (m) { return sameCell(m, cell); }); };
  return {
    title: puzzle.title,
    created: dayLabel(puzzle.created),
    label: puzzle.type,
    solutionLabel: puzzle.type + ' · Solution',
    cols: puzzle.width,
    rows: puzzle.height,
    bits: puzzle.walls.map(function (row) { return row.split('').map(function (d) { return parseInt(d, 16); }); }),
    walls: wallPath(puzzle.walls),
    blocks: puzzle.blocks.map(at),
    start: at(puzzle.start),
    stops: stopsOf(puzzle),
    zones: puzzle.zones.map(function (z) { return { key: z.key, top: z.top, left: z.left, bottom: z.bottom, right: z.right }; }),
    main: main,
    detours: walk.slice(1).map(function (cell, i) { return [walk[i], cell]; }).filter(function (step) {
      return !(onMain(step[0]) && onMain(step[1]));
    })
  };
}

// ---- Tapping ----
// A play is { trail, got, events, locked }: trail the cells walked, the start first and where the
// player stands last; got the ids of every stop stepped on — kept however far the trail backs
// out; events what this tap set off; locked the numbers of the keys a refused step needed.

export function newMazePlay(board) {
  return { trail: [board.start], got: [], events: [], locked: [] };
}

// Whether a step from one cell to the next is open: the two side by side with no wall between.
function opens(board, from, to) {
  var side = Object.values(sides()).find(function (s) { return s[0] === to[0] - from[0] && s[1] === to[1] - from[1]; });
  return side !== undefined && !(board.bits[from[0]][from[1]] & side[2]);
}

function inZone(zone, cell) {
  return cell[0] >= zone.top && cell[0] <= zone.bottom && cell[1] >= zone.left && cell[1] <= zone.right;
}

// The keys a cell needs and the player doesn't hold: one for each zone over it whose key they
// haven't picked up.
function missingKeys(board, got, cell) {
  return board.zones
    .filter(function (z) { return inZone(z, cell) && !got.includes('key-' + z.key); })
    .map(function (z) { return z.key; });
}

function stay(play) {
  return { trail: play.trail, got: play.got, events: [], locked: [] };
}

// An earlier cell of the trail: the trail backs out to it, keeping every tick.
function backTo(play, index) {
  return { trail: play.trail.slice(0, index + 1), got: play.got, events: [], locked: [] };
}

// A step on from the trail's end: refused, the zone's keys named, while a zone over the cell is
// locked; else the trail goes there and picks up whatever stands on it. Ticking the last line
// completes the maze — once.
function stepTo(play, cell, board) {
  var locked = missingKeys(board, play.got, cell);
  var fresh = board.stops.filter(function (s) { return sameCell(s.cell, cell) && !play.got.includes(s.id); });
  var got = play.got.concat(fresh.map(function (s) { return s.id; }));
  var walked = { trail: play.trail.concat([cell]), got: got, events: [], locked: [] };
  walked.events = { true: ['complete'], false: [] }[mazeFinished(walked, board) && !mazeFinished(play, board)];
  var refused = { trail: play.trail, got: play.got, events: ['locked'], locked: locked };
  return { true: refused, false: walked }[locked.length > 0];
}

export function tapMaze(play, cell, board) {
  var index = play.trail.findIndex(function (t) { return sameCell(t, cell); });
  var end = play.trail[play.trail.length - 1];
  var onward = { true: function () { return stepTo(play, cell, board); }, false: function () { return stay(play); } }[opens(board, end, cell)];
  return { true: function () { return backTo(play, index); }, false: onward }[index >= 0]();
}

// ---- The checklist ----
// A line for each element the maze has: Guides, Keys and Collectibles counted, then A, B and C,
// then the six exits — or End, in a maze without letters. Each line is done once stepped on; an
// exit's mark says whether it's the right one, ✓, or not, ✗.

function counted(play, stops, name) {
  var got = stops.filter(function (s) { return play.got.includes(s.id); }).length;
  return { true: [{ text: name, progress: got + '/' + stops.length, mark: '', done: got === stops.length }], false: [] }[stops.length > 0];
}

function exitMark(stop, got) {
  return { true: { true: '✓', false: '✗' }[stop.right], false: '' }[got];
}

export function checklist(play, board) {
  var kind = function (k) { return board.stops.filter(function (s) { return s.kind === k; }); };
  var each = kind('letter').concat(kind('exit'), kind('end')).map(function (s) {
    var got = play.got.includes(s.id);
    return { text: s.label, progress: '', mark: exitMark(s, got && s.kind !== 'letter'), done: got };
  });
  return counted(play, kind('guide'), 'Guides').concat(counted(play, kind('key'), 'Keys'), counted(play, kind('collectible'), 'Collectibles'), each);
}

// Finished is every line ticked.
export function mazeFinished(play, board) {
  return checklist(play, board).every(function (line) { return line.done; });
}

// The checklist's head: lines ticked out of all of them.
export function checklistCount(play, board) {
  var lines = checklist(play, board);
  return lines.filter(function (line) { return line.done; }).length + '/' + lines.length;
}

// ---- What the board shows ----

// A cell's centre, in cells, for the board's lines: x across, then y down.
function centre(cell) {
  return (cell[1] + 0.5) + ',' + (cell[0] + 0.5);
}

// The trail as a line's points.
export function trailPoints(trail) {
  return trail.map(centre).join(' ');
}

// Each stop as the board draws it: picked up, it fades; an exit or the end stepped on wears its
// mark.
export function stopMarks(play, board) {
  return board.stops.map(function (s) {
    var got = play.got.includes(s.id);
    return { id: s.id, got: got, mark: exitMark(s, got && ['exit', 'end'].includes(s.kind)) };
  });
}

// Each zone, open once its key is held.
export function zoneMarks(play, board) {
  return board.zones.map(function (z) { return { key: z.key, open: play.got.includes('key-' + z.key) }; });
}

// The solution side: the main path in blue as a line's points, each detour step in green as a
// path, and the exits — the right one dotted, the others crossed.
export function solutionMarks(board) {
  return {
    main: trailPoints(board.main),
    detours: board.detours.map(function (step) { return 'M' + centre(step[0]) + 'L' + centre(step[1]); }).join(''),
    exits: board.stops.filter(function (s) { return s.kind === 'exit'; }).map(function (s) { return { cell: s.cell, right: s.right }; })
  };
}

// ---- How big the maze is ----
// The grid card fits the screen's height, and the page's width, at the largest whole cell that
// does — never smaller than 10px, the least a cell can be tapped at. m: the screen's viewHeight,
// the room the page's head and the card's band and edges take above and round the cells
// (chromeHeight, chromeWidth), the page's width, and the maze's rows and cols.
export function mazeCellSize(m) {
  return Math.max(10, Math.floor(Math.min((m.viewHeight - m.chromeHeight) / m.rows, (m.width - m.chromeWidth) / m.cols)));
}
