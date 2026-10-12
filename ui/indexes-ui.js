// Every kind's puzzles, read from its index (core/kind-core.js indexFiles) and put together as one
// list, in the side bar's order — never a puzzle file. A kind not yet published has no index, as
// tooling's Save starts a kind, and reads as none.
import { indexFiles } from '../core/kind-core.js';

function readIndex(file) {
  return fetch(file).then(function (r) { return r.json(); }).catch(function () { return { puzzles: [] }; });
}

export function readPuzzles() {
  return Promise.all(indexFiles().map(readIndex)).then(function (indexes) {
    return indexes.flatMap(function (index) { return index.puzzles; });
  });
}
