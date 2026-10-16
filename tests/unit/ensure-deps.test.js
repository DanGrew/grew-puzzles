import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, '../../scripts/ensure-deps.sh');

// A checkout with a lockfile, and a stand-in npm on PATH that logs its arguments.
let repo;
let bin;
let npmLog;

function fakeNpm(exitCode) {
  const npm = path.join(bin, 'npm');
  fs.writeFileSync(npm, `#!/usr/bin/env bash\necho "$@" >> "${npmLog}"\nexit ${exitCode}\n`);
  fs.chmodSync(npm, 0o755);
}

function installedAt(seconds) {
  fs.mkdirSync(path.join(repo, 'node_modules'), { recursive: true });
  const marker = path.join(repo, 'node_modules', '.package-lock.json');
  fs.writeFileSync(marker, '{}');
  fs.utimesSync(marker, seconds, seconds);
}

function lockAt(seconds) {
  fs.utimesSync(path.join(repo, 'package-lock.json'), seconds, seconds);
}

function run() {
  return spawnSync('bash', [SCRIPT], {
    cwd: repo,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    encoding: 'utf8',
  });
}

function npmCalls() {
  return fs.existsSync(npmLog) ? fs.readFileSync(npmLog, 'utf8').trim().split('\n') : [];
}

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-deps-repo-'));
  bin = fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-deps-bin-'));
  npmLog = path.join(bin, 'npm.log');
  fs.writeFileSync(path.join(repo, 'package-lock.json'), '{}');
  fakeNpm(0);
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(bin, { recursive: true, force: true });
});

describe('ensure-deps — the pre-push hook installs packages a checkout is missing', () => {
  it('installs from the lockfile when there is no node_modules', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[pre-push] installing packages');
    expect(npmCalls()).toEqual(['ci --no-audit --no-fund']);
  });

  it('installs when node_modules has no record of an install', () => {
    fs.mkdirSync(path.join(repo, 'node_modules'));
    expect(run().status).toBe(0);
    expect(npmCalls()).toEqual(['ci --no-audit --no-fund']);
  });

  it('installs again when the lockfile changed since the last install', () => {
    installedAt(1_000_000);
    lockAt(2_000_000);
    expect(run().status).toBe(0);
    expect(npmCalls()).toEqual(['ci --no-audit --no-fund']);
  });

  it('installs nothing when the packages are up to date', () => {
    lockAt(1_000_000);
    installedAt(2_000_000);
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(npmCalls()).toEqual([]);
  });

  it('fails when the install fails', () => {
    fakeNpm(1);
    expect(run().status).not.toBe(0);
  });
});
