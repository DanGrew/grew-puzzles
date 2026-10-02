#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const outputFile = process.argv[2];
if (!outputFile) {
  console.error('Usage: node validate-schemas.js <outputFile>');
  process.exit(1);
}

const ROOT = process.cwd();
const ajv = new Ajv({ allErrors: true });
const lines = [];

function log(line) {
  lines.push(line);
  console.log(line);
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function findFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findFiles(full, predicate));
    else if (predicate(entry.name, full)) results.push(full);
  }
  return results;
}

// One entry per content type: { label, schema, searchDir, match }. Empty until the
// puzzle format lands (TASK-4-PUZZLE-FORMAT adds the puzzle and manifest schemas) —
// the gate runs from the first commit and passes on zero files.
const MAPPINGS = [];

let totalErrors = 0;
let totalChecked = 0;

for (const { label, schema, searchDir, match } of MAPPINGS) {
  const schemaObj = readJSON(path.join(ROOT, schema));
  const validate = ajv.compile(schemaObj);
  const files = findFiles(path.join(ROOT, searchDir), match);

  let groupErrors = 0;
  for (const file of files) {
    totalChecked++;
    const data = readJSON(file);
    if (!validate(data)) {
      groupErrors++;
      totalErrors++;
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      for (const err of validate.errors) {
        log(`✗ ${rel}: ${err.instancePath || '(root)'} ${err.message}`);
      }
    }
  }

  log(`${groupErrors === 0 ? '✓' : '✗'} ${label} — ${files.length} file(s), ${groupErrors} error(s)`);
}

log('');
if (totalErrors > 0) {
  log(`FAIL: ${totalErrors} validation error(s) across ${totalChecked} files`);
} else {
  log(`PASS: ${totalChecked} files validated against schema`);
}
log(`SUMMARY: ${totalErrors === 0 ? '✅' : '❌'} ${totalErrors} / ${totalChecked} files`);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, lines.join('\n') + '\n');

if (totalErrors > 0) process.exit(1);
