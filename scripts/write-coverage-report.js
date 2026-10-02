#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

function buildCoverageOutcome(coverageSummaryExists, cov, changedFiles) {
  if (!coverageSummaryExists) {
    return {
      markdown: '### Unit Test Coverage\n⚠️ Coverage data missing — tests may have failed.',
      exitCode: 1,
    };
  }
  const s = cov.total;
  const row = (label, key) => `| ${label} | ${s[key].pct}% | ${s[key].covered} / ${s[key].total} |`;
  const hits = changedFiles.map(f => {
    const data = cov[process.cwd() + '/' + f];
    return data ? `- \`${f}\` — lines: ${data.lines.pct}%, functions: ${data.functions.pct}%` : null;
  }).filter(Boolean);
  const changedSection = hits.length
    ? '\n\n### Changed Files Coverage\n' + hits.join('\n')
    : '\n\n### Changed Files Coverage\n_No changed files instrumented by Vitest (ui/ and app/ files are covered by Playwright, not unit tests)_';
  const markdown = [
    '### Unit Test Coverage',
    '| Metric | % | Covered / Total |',
    '|--------|---|-----------------|',
    row('Lines', 'lines'),
    row('Statements', 'statements'),
    row('Functions', 'functions'),
    row('Branches', 'branches'),
  ].join('\n') + changedSection;
  return { markdown, exitCode: 0 };
}

function main() {
  const coverageSummaryExists = fs.existsSync('coverage/coverage-summary.json');
  if (!coverageSummaryExists) {
    const { markdown, exitCode } = buildCoverageOutcome(false, null, []);
    fs.writeFileSync('coverage-report.md', markdown);
    process.exit(exitCode);
  }
  const cov = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
  let changedFiles = [];
  try {
    changedFiles = execSync('git diff --name-only origin/main...HEAD').toString().trim().split('\n').filter(Boolean);
  } catch (e) {}
  const { markdown, exitCode } = buildCoverageOutcome(true, cov, changedFiles);
  fs.writeFileSync('coverage-report.md', markdown);
  process.exit(exitCode);
}

if (require.main === module) main();

module.exports = { buildCoverageOutcome };
