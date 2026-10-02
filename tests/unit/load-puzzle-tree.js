// Reads a puzzles/ tree off disk into the shape core/puzzle-check-core.js checks:
// { index: collections.json, collections: { slug: { manifest, files: { name: puzzle } } } }.
// Test scaffolding only — the site never lists a directory.

const fs = require('fs');
const path = require('path');

const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function loadCollection(dir) {
  const names = fs.readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'manifest.json').sort();
  return {
    manifest: readJSON(path.join(dir, 'manifest.json')),
    files: Object.fromEntries(names.map(name => [name, readJSON(path.join(dir, name))])),
  };
}

function loadPuzzleTree(root) {
  const slugs = fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  return {
    index: readJSON(path.join(root, 'collections.json')),
    collections: Object.fromEntries(slugs.map(slug => [slug, loadCollection(path.join(root, slug))])),
  };
}

module.exports = { loadPuzzleTree };
