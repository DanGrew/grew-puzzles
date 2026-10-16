#!/usr/bin/env bash
# Checks this checkout's content/ — its puzzles/, collections/ and entries/ — with the private grew-puzzles-tooling repo's checks, taken
# from its origin/main — never its working copy, so an unmerged tooling change can't pass a
# site check. The site holds no puzzle rules of its own (docs/PUZZLE-FORMAT.md in tooling).
#
# Only the puzzles this checkout changes against origin/main are solved — committed, staged, edited
# on disk or new: a puzzle's verdict changes only when its file does, and tooling re-checks the site
# itself when its rules change. The checks spanning the tree — hidden IDs, indexes, collections, word
# entries — still run over all of content/, so a deleted puzzle a collection lists still fails.
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

if ! git -C "$site" rev-parse --verify --quiet origin/main >/dev/null; then
  echo "SUMMARY: ❌ no origin/main to tell which puzzles changed" | tee "$report"
  exit 1
fi

# Every puzzle file that differs from origin/main, as puzzles/<kind>/<file> — those still on disk to
# solve, and the deleted ones, which have nothing left to solve.
changed=()
deleted=()
while IFS= read -r path; do
  if [ -f "$site/$path" ]; then
    changed+=("${path#content/}")
  else
    deleted+=("${path#content/}")
  fi
done < <({
  git -C "$site" diff --name-only origin/main -- 'content/puzzles/*/*.json'
  git -C "$site" ls-files --others --exclude-standard -- 'content/puzzles/*/*.json'
} | grep -v '/index\.json$' | sort -u)

git -C "$tooling" fetch --quiet origin main
export_dir="$(mktemp -d)"
trap 'rm -rf "$export_dir"' EXIT
git -C "$tooling" archive origin/main | tar -x -C "$export_dir"

echo "grew-puzzles-tooling origin/main @ $(git -C "$tooling" rev-parse --short origin/main)" | tee "$report"
if [ "${#changed[@]}" -eq 0 ] && [ "${#deleted[@]}" -eq 0 ]; then
  echo "no puzzle files changed against origin/main — solving none" | tee -a "$report"
fi
if [ "${#changed[@]}" -gt 0 ]; then
  echo "solving ${#changed[@]} changed puzzle(s):" | tee -a "$report"
  printf '  %s\n' "${changed[@]}" | tee -a "$report"
fi
if [ "${#deleted[@]}" -gt 0 ]; then
  echo "${#deleted[@]} deleted puzzle(s), nothing to solve:" | tee -a "$report"
  printf '  %s\n' "${deleted[@]}" | tee -a "$report"
fi
"$export_dir/tools/grew-puzzles-checks" "$site/content" --only ${changed[@]+"${changed[@]}"} | tee -a "$report"
