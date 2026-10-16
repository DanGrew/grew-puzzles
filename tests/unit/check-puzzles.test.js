import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, '../../scripts/check-puzzles.sh');

// A site clone with an origin/main, and the tooling clone beside it, whose stand-in checks log
// the arguments they were given — one per line — and pass.
const FAKE_CHECKS = '#!/usr/bin/env bash\nprintf \'%s\\n\' "$@" > "$CHECKS_LOG"\necho "SUMMARY: ✅ fake"\nexit "${CHECKS_EXIT:-0}"\n';

let root;
let site;
let checksLog;

const env = () => ({
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  CHECKS_LOG: checksLog,
});

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, env: env(), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}

function write(repo, file, text) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), text);
}

function makeTooling() {
  const tooling = path.join(root, 'grew-puzzles-tooling');
  git(root, 'init', '-q', '-b', 'main', tooling);
  write(tooling, 'tools/grew-puzzles-checks', FAKE_CHECKS);
  fs.chmodSync(path.join(tooling, 'tools/grew-puzzles-checks'), 0o755);
  git(tooling, 'add', '.');
  git(tooling, 'commit', '-q', '-m', 'checks');
  git(tooling, 'remote', 'add', 'origin', tooling);
}

function makeSite() {
  git(root, 'init', '-q', '--bare', '-b', 'main', path.join(root, 'site.git'));
  git(root, 'init', '-q', '-b', 'main', site);
  git(site, 'remote', 'add', 'origin', path.join(root, 'site.git'));
  write(site, 'content/puzzles/mosaic/index.json', '{"puzzles":[]}');
  write(site, 'content/puzzles/mosaic/MOS-1.json', '{"v":1}');
  write(site, 'content/puzzles/mosaic/MOS-2.json', '{"v":1}');
  write(site, 'content/puzzles/maze/MAZE-1.json', '{"v":1}');
  write(site, 'content/collections/index.json', '{"collections":[]}');
  write(site, 'app/index.html', '<p>site</p>');
  git(site, 'add', '.');
  git(site, 'commit', '-q', '-m', 'site');
  git(site, 'push', '-q', 'origin', 'main');
  write(site, 'scripts/check-puzzles.sh', fs.readFileSync(SCRIPT, 'utf8'));
}

function run() {
  const report = path.join(root, 'puzzles.txt');
  const result = spawnSync('bash', [path.join(site, 'scripts/check-puzzles.sh'), report], {
    cwd: site,
    env: env(),
    encoding: 'utf8',
  });
  return { ...result, report: fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : '' };
}

// What the checks were asked to solve: everything after --only, or null when they were asked for all.
function solved() {
  const args = fs.readFileSync(checksLog, 'utf8').trim().split('\n');
  expect(fs.realpathSync(args[0])).toBe(fs.realpathSync(path.join(site, 'content')));
  const only = args.indexOf('--only');
  return only === -1 ? null : args.slice(only + 1);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-puzzles-'));
  site = path.join(root, 'grew-puzzles');
  checksLog = path.join(root, 'checks.log');
  makeTooling();
  makeSite();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('check-puzzles — the site solves only the puzzles it changed', () => {
  it('solves none when no file in content/ changed, and says so', () => {
    write(site, 'app/index.html', '<p>changed</p>');
    git(site, 'commit', '-q', '-am', 'page');
    const result = run();
    expect(result.status).toBe(0);
    expect(solved()).toEqual([]);
    expect(result.report).toContain('no puzzle files changed');
  });

  it('solves a puzzle changed in a commit on the branch, and names it', () => {
    write(site, 'content/puzzles/mosaic/MOS-1.json', '{"v":2}');
    git(site, 'commit', '-q', '-am', 'mosaic');
    const result = run();
    expect(result.status).toBe(0);
    expect(solved()).toEqual(['puzzles/mosaic/MOS-1.json']);
    expect(result.report).toContain('puzzles/mosaic/MOS-1.json');
  });

  it('solves a staged change', () => {
    write(site, 'content/puzzles/maze/MAZE-1.json', '{"v":2}');
    git(site, 'add', 'content/puzzles/maze/MAZE-1.json');
    expect(run().status).toBe(0);
    expect(solved()).toEqual(['puzzles/maze/MAZE-1.json']);
  });

  it('solves a puzzle edited on disk but not committed', () => {
    write(site, 'content/puzzles/mosaic/MOS-2.json', '{"v":2}');
    expect(run().status).toBe(0);
    expect(solved()).toEqual(['puzzles/mosaic/MOS-2.json']);
  });

  it('solves a new puzzle not yet added to git', () => {
    write(site, 'content/puzzles/mosaic/MOS-3.json', '{"v":1}');
    expect(run().status).toBe(0);
    expect(solved()).toEqual(['puzzles/mosaic/MOS-3.json']);
  });

  it('solves every changed puzzle once, whichever way it changed', () => {
    write(site, 'content/puzzles/mosaic/MOS-1.json', '{"v":2}');
    git(site, 'commit', '-q', '-am', 'mosaic');
    write(site, 'content/puzzles/mosaic/MOS-1.json', '{"v":3}');
    write(site, 'content/puzzles/maze/MAZE-1.json', '{"v":2}');
    expect(run().status).toBe(0);
    expect(solved()).toEqual(['puzzles/maze/MAZE-1.json', 'puzzles/mosaic/MOS-1.json']);
  });

  it('solves nothing for a deleted puzzle, still checking the whole of content/', () => {
    git(site, 'rm', '-q', 'content/puzzles/mosaic/MOS-2.json');
    git(site, 'commit', '-q', '-m', 'delete');
    fs.rmSync(path.join(site, 'content/puzzles/maze/MAZE-1.json'));
    const result = run();
    expect(result.status).toBe(0);
    expect(solved()).toEqual([]);
    expect(result.report).not.toContain('no puzzle files changed');
    expect(result.report).toContain('2 deleted puzzle(s)');
    expect(result.report).toContain('puzzles/maze/MAZE-1.json');
    expect(result.report).toContain('puzzles/mosaic/MOS-2.json');
  });

  it('solves nothing for a change to an index, a collection or anything else in content/', () => {
    write(site, 'content/puzzles/mosaic/index.json', '{"puzzles":[1]}');
    write(site, 'content/collections/index.json', '{"collections":[1]}');
    expect(run().status).toBe(0);
    expect(solved()).toEqual([]);
  });

  it('fails when the checks fail', () => {
    process.env.CHECKS_EXIT = '1';
    try {
      expect(run().status).not.toBe(0);
    } finally {
      delete process.env.CHECKS_EXIT;
    }
  });

  it('fails, naming it, when there is no origin/main to compare against', () => {
    git(site, 'update-ref', '-d', 'refs/remotes/origin/main');
    const result = run();
    expect(result.status).not.toBe(0);
    expect(result.report).toContain('no origin/main');
  });
});
