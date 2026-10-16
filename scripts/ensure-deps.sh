#!/usr/bin/env bash
# Installs the packages the gates need when this checkout's are missing or older than the
# lockfile. npm writes node_modules/.package-lock.json on every install, so it dates the last one.
set -euo pipefail

MARKER=node_modules/.package-lock.json

if [ -f "$MARKER" ] && [ ! package-lock.json -nt "$MARKER" ]; then
  exit 0
fi

echo "[pre-push] installing packages (npm ci)..."
npm ci --no-audit --no-fund
