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

// The walls of the cells in a patch — { top, left, bottom, right }, every side counted in — as
// one path, counted in cells: each cell draws its north and west walls, and the bottom row and
// right column the maze's edge too, so the whole maze draws every wall once. bits is each cell's
// walls, [row][col].
export function wallPath(bits, win) {
  var last = bits.length - 1;
  return bits.slice(win.top, win.bottom + 1).map(function (row, i) {
    var r = win.top + i;
    return row.slice(win.left, win.right + 1).map(function (wall, j) {
      var c = win.left + j;
      return [
        [wall & 1, 'M' + c + ' ' + r + 'h1'],
        [wall & 8, 'M' + c + ' ' + r + 'v1'],
        [wall & 4 && r === last, 'M' + c + ' ' + (r + 1) + 'h1'],
        [wall & 2 && c === row.length - 1, 'M' + (c + 1) + ' ' + r + 'v1']
      ].filter(function (side) { return side[0]; }).map(function (side) { return side[1]; }).join('');
    }).join('');
  }).join('');
}

// Everything a player can step on and tick, each with an id the play remembers it by: guides,
// collectibles, keys and letters picked up, and the exits — or, in a maze without letters, its
// end. An exit is right when it stands on the end. The exits run ABC to CBA — their codes A to Z —
// whatever order the file lists them in.
function stopsOf(puzzle) {
  var end = at(puzzle.end);
  var pickups = function (kind, list) {
    return list.map(function (s, i) { return { id: kind + '-' + i, kind: kind, cell: at(s), label: '' }; });
  };
  var exits = puzzle.exits.slice().sort(function (a, b) { return a.code.localeCompare(b.code); })
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
  var bits = puzzle.walls.map(function (row) { return row.split('').map(function (d) { return parseInt(d, 16); }); });
  return {
    title: puzzle.title,
    created: dayLabel(puzzle.created),
    label: puzzle.type,
    solutionLabel: puzzle.type + ' · Solution',
    cols: puzzle.width,
    rows: puzzle.height,
    bits: bits,
    // Every wall: a patch to the maze's far edges and past, which the walls stop at.
    walls: wallPath(bits, { top: 0, left: 0, bottom: puzzle.height, right: puzzle.width }),
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
// A play is { trail, got, events, locked, runs }: trail the cells walked, the start first and
// where the player stands last; got the ids of every stop stepped on — kept however far the trail
// backs out; events what this move set off; locked the numbers of the keys a refused step needed;
// runs the trail's length after each move that took it on — the start's 1 first — so Back knows
// where the move before ended.

export function newMazePlay(board) {
  return { trail: [board.start], got: [], events: [], locked: [], runs: [1] };
}

// Where the player stands: the trail's end.
export function trailEnd(play) {
  return play.trail[play.trail.length - 1];
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
  return { trail: play.trail, got: play.got, events: [], locked: [], runs: play.runs };
}

// An earlier cell of the trail: the trail backs out to it, keeping every tick. The moves that
// ended past it are gone, and it ends a move of its own.
function backTo(play, index) {
  var runs = play.runs.filter(function (length) { return length <= index; }).concat([index + 1]);
  return { trail: play.trail.slice(0, index + 1), got: play.got, events: [], locked: [], runs: runs };
}

// A step on from the trail's end: refused, the zone's keys named, while a zone over the cell is
// locked; else the trail goes there and picks up whatever stands on it. Ticking the last line
// completes the maze — once.
function stepTo(play, cell, board) {
  var locked = missingKeys(board, play.got, cell);
  var fresh = board.stops.filter(function (s) { return sameCell(s.cell, cell) && !play.got.includes(s.id); });
  var got = play.got.concat(fresh.map(function (s) { return s.id; }));
  var walked = { trail: play.trail.concat([cell]), got: got, locked: [], runs: play.runs };
  walked.events = { true: ['complete'], false: [] }[mazeFinished(walked, board) && !mazeFinished(play, board)];
  var refused = { trail: play.trail, got: play.got, events: ['locked'], locked: locked, runs: play.runs };
  return { true: refused, false: walked }[locked.length > 0];
}

// A move that took the trail on ends where it stopped; one that didn't, ends nothing.
function endMove(before, after) {
  var grew = after.trail.length > before.trail.length;
  return Object.assign({}, after, { runs: { true: after.runs.concat([after.trail.length]), false: after.runs }[grew] });
}

export function tapMaze(play, cell, board) {
  var index = play.trail.findIndex(function (t) { return sameCell(t, cell); });
  var onward = {
    true: function () { return endMove(play, stepTo(play, cell, board)); },
    false: function () { return stay(play); }
  }[opens(board, trailEnd(play), cell)];
  return { true: function () { return backTo(play, index); }, false: onward }[index >= 0]();
}

// ---- The control pad ----
// Up, down, left and right run the trail on to the next stop; Back takes it back one move. The
// player makes every choice: a run never passes a junction or anything on the checklist, so it
// only saves the walking — it reads the walls in the file, and solves nothing.

function opposite(side) {
  return { N: 'S', E: 'W', S: 'N', W: 'E' }[side];
}

function stepOf(cell, side) {
  var step = sides()[side];
  return [cell[0] + step[0], cell[1] + step[1]];
}

// The sides a cell has no wall on, N, E, S, W.
function openSides(board, cell) {
  return Object.keys(sides()).filter(function (side) { return !(board.bits[cell[0]][cell[1]] & sides()[side][2]); });
}

// The side the trail came into its end by: pressing it goes back. A trail of the start alone came
// by none.
function cameFrom(play) {
  var end = trailEnd(play);
  return Object.keys(sides()).find(function (side) {
    return play.trail.slice(-2, -1).some(function (before) { return sameCell(stepOf(end, side), before); });
  });
}

// A run goes on through a corridor: a cell with one way on, besides the way it came in by, and
// nothing on the checklist. A junction, a dead end, or anything on the checklist stops it.
function wayOn(board, cell, side) {
  var onward = openSides(board, cell).filter(function (s) { return s !== opposite(side); });
  var stop = board.stops.some(function (s) { return sameCell(s.cell, cell); });
  return { on: onward.length === 1 && !stop, side: onward[0] };
}

// Step by step from the trail's end, round the corridor's bends, until it stops — or until a zone
// whose key isn't held refuses the next step, which stops it at the zone's edge.
function runFrom(play, side, board) {
  var next = stepTo(play, stepOf(trailEnd(play), side), board);
  var way = wayOn(board, trailEnd(next), side);
  var on = next.trail.length > play.trail.length && way.on;
  return { true: function () { return runFrom(next, way.side, board); }, false: function () { return next; } }[on]();
}

// Back one move, to where the move before ended; at the start, nowhere.
function backOne(play) {
  var runs = play.runs.slice(0, -1);
  var back = { trail: play.trail.slice(0, runs[runs.length - 1]), got: play.got, events: [], locked: [], runs: runs };
  return { true: back, false: stay(play) }[runs.length > 0];
}

// A press of the pad: 'N', 'E', 'S', 'W' or 'back'. The way the trail came in by is Back too; a
// way with a wall does nothing.
export function padMaze(play, press, board) {
  var run = { true: 'run', false: 'stay' }[openSides(board, trailEnd(play)).includes(press)];
  var action = { true: 'back', false: run }[press === 'back' || press === cameFrom(play)];
  return {
    back: function () { return backOne(play); },
    run: function () { return endMove(play, runFrom(play, press, board)); },
    stay: function () { return stay(play); }
  }[action]();
}

// Which of the pad's buttons do anything: each way with no wall, and Back once there's a move to
// go back on.
export function padState(play, board) {
  var open = openSides(board, trailEnd(play));
  return Object.keys(sides()).reduce(function (state, side) {
    state[side] = open.includes(side);
    return state;
  }, { back: play.runs.length > 1 });
}

// The pad's press a key makes: the arrow keys and Backspace, never with a modifier held — the
// browser's own shortcuts stay its own. Any other key presses nothing.
export function padKey(key) {
  var press = { ArrowUp: 'N', ArrowRight: 'E', ArrowDown: 'S', ArrowLeft: 'W', Backspace: 'back' }[key.key] || '';
  return { true: '', false: press }[key.altKey || key.ctrlKey || key.metaKey || key.shiftKey];
}

// How a move draws the trail: the steps already drawn, of the trail's steps all told — a trail's
// steps are a cell long each, so they're its length in cells — and how long the new ones take,
// ms. A move back has nothing new to draw. from is the dash offset the drawing starts at.
export function trailDraw(before, after) {
  var total = after.trail.length - 1;
  var done = Math.min(before.trail.length - 1, total);
  return { total: total, from: total - done, ms: Math.min(300, (total - done) * 40) };
}

// A refused step's key numbers, at the top-right corner of the cell the player stands on, in
// cells: x across, y down.
export function keyCall(play) {
  var end = trailEnd(play);
  return { x: end[1] + 0.8, y: end[0] + 0.28, text: play.locked.join(' ') };
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

// The solution side: the main path in blue as a line's points, and the exits — the right one
// dotted, the others crossed.
export function solutionMarks(board) {
  return {
    main: trailPoints(board.main),
    exits: board.stops.filter(function (s) { return s.kind === 'exit'; }).map(function (s) { return { cell: s.cell, right: s.right }; })
  };
}

// The solution side's detours in green, as a path: each step of them with a cell in the patch.
export function windowDetours(board, win) {
  return board.detours.filter(function (step) { return inWindow(win, step[0]) || inWindow(win, step[1]); })
    .map(function (step) { return 'M' + centre(step[0]) + 'L' + centre(step[1]); }).join('');
}

// ---- The view ----
// The maze card shows the maze through its frame: { fit, width, height } — the cell size that
// shows the whole maze in it, and its width and height, px. A view is { cell, x, y }: the cell
// size the player has zoomed to, px, and the maze's point at the frame's top-left, in cells. The
// zoom is only ever the player's: + and −, or a pinch. Every move keeps the player in the centre,
// and nothing else zooms.

// The frame fits the screen's height, and the page's width, with the whole maze in it. A cell is
// a whole pixel while the whole maze can be tapped — 10px, the least a cell can be tapped at, or
// more; under that every bit of room counts, and the player zooms in to tap. m: the screen's
// viewHeight, the room the card's band and edges take above and round the maze (chromeHeight,
// chromeWidth), the page's width, and the maze's rows and cols.
export function mazeFrame(m) {
  var room = Math.min((m.viewHeight - m.chromeHeight) / m.rows, (m.width - m.chromeWidth) / m.cols);
  var fit = Math.max(Math.floor(room), Math.min(room, 10));
  return { fit: fit, width: m.cols * fit, height: m.rows * fit };
}

// The zoom runs from the whole maze in the frame, to cells 48px across — or, for a maze whose
// whole fits bigger than that, stays at the whole.
function mostCell(frame) {
  return Math.max(frame.fit, 48);
}

function zoomedTo(cell, frame) {
  return Math.min(Math.max(cell, frame.fit), mostCell(frame));
}

// The view, kept on the maze: it never looks past an edge.
function onMaze(view, frame, board) {
  var across = Math.max(0, board.cols - frame.width / view.cell), down = Math.max(0, board.rows - frame.height / view.cell);
  return { cell: view.cell, x: Math.min(Math.max(view.x, 0), across), y: Math.min(Math.max(view.y, 0), down) };
}

// The view with a cell in the frame's centre, as near as the maze's edges let it.
export function centreOn(view, cell, frame, board) {
  return onMaze({
    cell: view.cell, x: cell[1] + 0.5 - frame.width / view.cell / 2, y: cell[0] + 0.5 - frame.height / view.cell / 2
  }, frame, board);
}

// A maze opens whole, unless that leaves its cells too small to tap: then zoomed in on the start,
// cells 20px across.
export function openView(frame, board) {
  var cell = { true: frame.fit, false: 20 }[frame.fit >= 10];
  return centreOn({ cell: cell, x: 0, y: 0 }, board.start, frame, board);
}

// The screen resized, from the frame before to this one: a player looking at the whole maze still
// is; any other zoom stays as it was, as far as this frame's zoom runs. The view centres on here.
export function refitView(view, before, frame, board, here) {
  var cell = { true: frame.fit, false: zoomedTo(view.cell, frame) }[view.cell === before.fit];
  return centreOn({ cell: cell, x: 0, y: 0 }, here, frame, board);
}

// Zoomed by a factor about the player, here, who stays where they are on screen — or, when the
// player has dragged the view away from them, about the middle of what's on view.
export function zoomView(view, factor, frame, board, here) {
  var cell = zoomedTo(view.cell * factor, frame);
  var shows = cellsRound(view, frame, board, 0);
  var middle = [view.y + frame.height / view.cell / 2, view.x + frame.width / view.cell / 2];
  var about = { true: [here[0] + 0.5, here[1] + 0.5], false: middle }[inWindow(shows, here)];
  return onMaze({
    cell: cell, x: about[1] - (about[1] - view.x) * view.cell / cell, y: about[0] - (about[0] - view.y) * view.cell / cell
  }, frame, board);
}

// + and −: a step in, a step back out.
export function zoomFactor(way) {
  return { in: 1.25, out: 0.8 }[way];
}

// A pinch: the two fingers' distance apart now, over what it was — each pair [{ x, y }, { x, y }].
export function pinchFactor(before, now) {
  var apart = function (pair) { return Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y); };
  return apart(now) / Math.max(apart(before), 1);
}

// A trackpad's pinch, or a wheel turned with Ctrl held: up zooms in, down out.
export function wheelFactor(deltaY) {
  return Math.exp(-deltaY / 100);
}

// What the zoom can do: zoom in, zoom out — out is zoomed in, which shows the little map — and
// whether this maze zooms at all.
export function zoomState(view, frame) {
  return { zoomIn: view.cell < mostCell(frame), zoomOut: view.cell > frame.fit, zoomable: mostCell(frame) > frame.fit };
}

// Where the maze sits behind the frame, as a CSS transform.
export function worldTransform(view) {
  return 'translate(' + (-view.x * view.cell) + 'px, ' + (-view.y * view.cell) + 'px)';
}

// ---- Drawing only what's on screen ----
// The page draws only the cells in a patch round the view — those on screen and 8 more each way,
// so a move or a drag draws nothing new until it nears the patch's edge — however big the maze.

function inWindow(win, cell) {
  return cell[0] >= win.top && cell[0] <= win.bottom && cell[1] >= win.left && cell[1] <= win.right;
}

function cellsRound(view, frame, board, spare) {
  return {
    top: Math.max(0, Math.floor(view.y) - spare),
    left: Math.max(0, Math.floor(view.x) - spare),
    bottom: Math.min(board.rows - 1, Math.ceil(view.y + frame.height / view.cell) - 1 + spare),
    right: Math.min(board.cols - 1, Math.ceil(view.x + frame.width / view.cell) - 1 + spare)
  };
}

export function viewWindow(view, frame, board) {
  return cellsRound(view, frame, board, 8);
}

// Whether a patch already drawn still holds every cell the view shows.
export function windowHolds(win, view, frame, board) {
  var shows = cellsRound(view, frame, board, 0);
  return shows.top >= win.top && shows.left >= win.left && shows.bottom <= win.bottom && shows.right <= win.right;
}

// The patch's cells, row by row: each its cell, whether it's the start, and the stop standing on
// it, if any — [] or [stop].
export function windowCells(board, win) {
  var stops = new Map(board.stops.map(function (s) { return [s.cell.join(','), s]; }));
  return Array.from({ length: win.bottom - win.top + 1 }, function (_, i) {
    return Array.from({ length: win.right - win.left + 1 }, function (_, j) {
      var cell = [win.top + i, win.left + j];
      return { cell: cell, start: sameCell(cell, board.start), stops: [stops.get(cell.join(','))].filter(Boolean) };
    });
  }).flat();
}

function overlaps(win, top, left, bottom, right) {
  return top <= win.bottom && bottom >= win.top && left <= win.right && right >= win.left;
}

// The blocks and zones over any of the patch's cells.
export function windowMarks(board, win) {
  return {
    blocks: board.blocks.filter(function (b) { return overlaps(win, b[0], b[1], b[0] + 1, b[1] + 1); }),
    zones: board.zones.filter(function (z) { return overlaps(win, z.top, z.left, z.bottom, z.right); })
  };
}

// ---- The little map ----
// While the player is zoomed in, a little map in the maze card's corner shows the whole maze: a box
// round what's on view, the trail, and every collectible, key, letter and exit — or the end — the
// ones picked up faded. Never the solution. It's drawn in cells, scaled to fit size px.

// px a cell, and the map's size, px, the maze's shape.
export function minimapSize(board, size) {
  var scale = size / Math.max(board.rows, board.cols);
  return { scale: scale, width: board.cols * scale, height: board.rows * scale };
}

// The pens, in cells, to draw lines so many px wide however small a cell is on the map.
export function minimapPens(scale) {
  return { wall: 0.6 / scale, trail: 2 / scale, box: 1.5 / scale, dot: Math.max(0.5, 2.5 / scale) };
}

// The box round what's on view.
export function minimapBox(view, frame) {
  return { x: view.x, y: view.y, width: frame.width / view.cell, height: frame.height / view.cell };
}

export function minimapStops(play, board) {
  return board.stops.filter(function (s) { return s.kind !== 'guide'; }).map(function (s) {
    return { x: s.cell[1] + 0.5, y: s.cell[0] + 0.5, kind: s.kind, got: play.got.includes(s.id) };
  });
}

// The trail as a path.
export function minimapTrail(trail) {
  return 'M' + trail.map(centre).join('L');
}

// The box dragged from one point to another, px on the map: the view goes with it.
export function dragView(view, from, to, scale, frame, board) {
  return onMaze({ cell: view.cell, x: view.x + (to.x - from.x) / scale, y: view.y + (to.y - from.y) / scale }, frame, board);
}
