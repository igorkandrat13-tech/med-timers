#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${MED_TIMERS_BASE_DIR:-/srv/med-timers}"
REPO_DIR="${MED_TIMERS_REPO_DIR:-$BASE_DIR/repo}"
BRANCH="${MED_TIMERS_BRANCH:-main}"
RELEASES_DIR="$BASE_DIR/releases"
CURRENT_LINK="$BASE_DIR/current"
DATA_DIR="${DATA_DIR:-$BASE_DIR/shared}"

MODE="${1:-apply}"

if [[ "$MODE" == "check" ]]; then
  git -C "$REPO_DIR" fetch
  git -C "$REPO_DIR" rev-list "HEAD...origin/$BRANCH" --count
  exit 0
fi

git -C "$REPO_DIR" fetch
CURRENT_HASH="$(git -C "$REPO_DIR" rev-parse HEAD)"
TARGET_HASH="$(git -C "$REPO_DIR" rev-parse "origin/$BRANCH")"

if [[ "$CURRENT_HASH" == "$TARGET_HASH" ]]; then
  echo "0"
  exit 0
fi

RELEASE_NAME="${TARGET_HASH:0:12}"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"

mkdir -p "$RELEASES_DIR" "$RELEASE_DIR" "$DATA_DIR"

git -C "$REPO_DIR" archive --format=tar "origin/$BRANCH" | tar -x -C "$RELEASE_DIR"

if [[ -f "$RELEASE_DIR/package-lock.json" ]]; then
  (cd "$RELEASE_DIR" && npm ci --omit=dev)
else
  (cd "$RELEASE_DIR" && npm install --omit=dev)
fi

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
git -C "$REPO_DIR" reset --hard "origin/$BRANCH"

echo "$RELEASE_NAME"

