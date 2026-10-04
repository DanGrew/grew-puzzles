// Saved progress: what a find saves, which saved finds a reopened puzzle shows, and what the line
// under the words says. A find is a line — its page, start cell and direction — never a word, so
// Repeats copies, Saga pages and every type to come restore exactly with no saving of their own
// (FEAT-48). The table, and that a player reaches only their own rows, are grew-puzzles-tooling's
// docs/DATABASE.md; finished is worked out from the puzzle, never saved. Pure — the saving itself is
// ui/wordsearch/progress-ui.js.

// What a find of a word saves: the puzzle's hidden ID and the word's line. The database fills in
// who and when.
export function findRow(puzzle, word) {
  return { puzzle: puzzle, page: word.line.page, start_row: word.line.row, start_col: word.line.col, direction: word.line.direction };
}

// The words a reopened puzzle shows found, by index: each placed word whose line was saved. A saved
// line no word sits on finds nothing.
export function restoredFinds(rows, words) {
  return words.map(function (_, i) { return i; }).filter(function (i) {
    return rows.some(function (row) { return sameLine(row, words[i].line); });
  });
}

// The saved lines a read answered with; a read that failed has none, and the puzzle opens as new —
// a find made again is refused as already saved, so nothing is lost or counted twice.
export function savedRows(answer) {
  return answer.error ? [] : answer.data;
}

function sameLine(row, line) {
  return Boolean(line) && row.page === line.page && row.start_row === line.row &&
    row.start_col === line.col && row.direction === line.direction;
}

// Whether a save's answer means the find is saved. A line already saved is refused as a duplicate
// (Postgres's 23505) — a retry of a save whose answer was lost — and that find is saved: the same
// line is one find, never two.
export function savedAnswer(answer) {
  return !answer.error || answer.error.code === '23505';
}

// ---- Finds waiting to be saved ----
// A queue of { row, failed }: each find not yet saved, and how many of its tries have failed. A
// saved find leaves; one that failed stays, to be tried again.

export function queued(queue, row) {
  return queue.concat([{ row: row, failed: 0 }]);
}

export function attempted(queue, row, saved) {
  return saved
    ? queue.filter(function (entry) { return entry.row !== row; })
    : queue.map(function (entry) { return entry.row === row ? { row: row, failed: entry.failed + 1 } : entry; });
}

// Signing out drops every find still waiting: nothing is kept for a signed-out player. A change that
// leaves the player signed in — their sign-in renewed — keeps them.
export function keptQueue(signedIn, queue) {
  return signedIn ? queue : [];
}

// The row, if it's still waiting — the one to try again — else nothing.
export function unsaved(queue, row) {
  return queue.filter(function (entry) { return entry.row === row; }).map(function (entry) { return entry.row; });
}

// The one quiet line under the words. Signed out, the invitation to sign in. Signed in, nothing —
// until a find's retry has failed too, when the note says it isn't saved yet; a first save that is
// only slow says nothing.
export function saveLine(signedIn, queue) {
  var stuck = queue.some(function (entry) { return entry.failed > 1; });
  var line = {
    true: { true: 'Progress not saved — reconnecting', false: '' }[stuck],
    false: 'Sign in to save your progress — or just play.'
  }[signedIn];
  return { text: line, shown: line !== '' };
}
