#!/usr/bin/env node
// Scans core/**/*.js and reports files with no reference in any tests/unit test.
// Data files live in assets/ and are excluded from scope.
// Exits 1 if any core file is untested.

const fs = require('fs');
const path = require('path');

// A layer that doesn't exist yet holds no files — the gate passes on empty rather
// than crashing, so it runs from the first commit.
function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const root = path.resolve(__dirname, '..');
const coreFiles = walkJs(path.join(root, 'core'))
  .map(f => path.relative(root, f).replace(/\\/g, '/'));

const testFiles = walkJs(path.join(root, 'tests', 'unit'));
const testContent = testFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const untested = coreFiles.filter(f => {
  const basename = path.basename(f);
  return !testContent.includes(basename);
});

if (untested.length === 0) {
  console.log('check:untested — all core files referenced in unit tests.');
  console.log(`\nSUMMARY: ✅ 0 / ${coreFiles.length} files`);
  process.exit(0);
}

console.log(`check:untested — ${untested.length} core file(s) with no unit test coverage:\n`);
untested.forEach(f => console.log(`  ${f}`));
console.log('\nAdd unit tests for each file listed above.');
console.log(`\nSUMMARY: ❌ ${untested.length} / ${coreFiles.length} files`);
process.exit(1);
