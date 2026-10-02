#!/usr/bin/env bash
# Checks this checkout's content/ — its puzzles/ — with the private grew-puzzles-tooling repo's checks, taken
# from its origin/main — never its working copy, so an unmerged tooling change can't pass a
# site check. The site holds no puzzle rules of its own (docs/PUZZLE-FORMAT.md in tooling).
#
# Local only: it needs the tooling clone beside the primary checkout (../grew-puzzles-tooling
# from it) — found through the shared git dir, so a worktree anywhere finds the same clone.
# Usage: scripts/check-puzzles.sh <report file>
set -euo pipefail

# Run from the pre-push hook, git exports GIT_DIR (and friends) for THIS repo, and those win
# over `git -C <tooling>` — the fetch and export below would quietly read the site's own main.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_PREFIX

report="${1:?usage: scripts/check-puzzles.sh <report file>}"
site="$(cd "$(dirname "$0")/.." && pwd)"
primary="$(dirname "$(git -C "$site" rev-parse --path-format=absolute --git-common-dir)")"
tooling="$(dirname "$primary")/grew-puzzles-tooling"

if [ ! -d "$tooling/.git" ]; then
  echo "SUMMARY: ❌ no grew-puzzles-tooling clone at $tooling" | tee "$report"
  exit 1
fi

git -C "$tooling" fetch --quiet origin main
export_dir="$(mktemp -d)"
trap 'rm -rf "$export_dir"' EXIT
git -C "$tooling" archive origin/main | tar -x -C "$export_dir"

echo "grew-puzzles-tooling origin/main @ $(git -C "$tooling" rev-parse --short origin/main)" | tee "$report"
"$export_dir/tools/grew-puzzles-checks" "$site/content" | tee -a "$report"
