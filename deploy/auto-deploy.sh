#!/usr/bin/env bash
#
# Deploys whatever is on origin/main, if it has moved since the last run.
#
# Runs unattended from a systemd timer every minute, so the answer to "how do I
# get this change onto the site" is: push it. Nobody opens a terminal on the VM.
#
# Cheap when idle: a `git fetch` against GitHub and a hash comparison. The
# expensive part — npm ci and a Next build, several minutes — only happens when
# the commit actually changed.
#
set -euo pipefail

APP_USER="avk"
APP_DIR="/opt/avkvisions"
BRANCH="main"
STATE="/var/lib/avkvisions/.last-deployed"
LOCK="/var/lock/avk-auto-deploy.lock"

cd "$APP_DIR"

# --- One at a time -----------------------------------------------------------
# A deploy takes minutes and the timer fires every minute, so without this the
# second run would start `npm ci` while the first was mid-build, and they would
# fight over node_modules. `flock -n` makes an overlapping run exit at once
# rather than queue up behind it.
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "A deploy is already running; skipping this tick."
  exit 0
fi

sudo -u "$APP_USER" git fetch --quiet origin "$BRANCH"

REMOTE="$(git rev-parse "origin/$BRANCH")"
CURRENT="$(cat "$STATE" 2>/dev/null || echo none)"

if [[ "$REMOTE" == "$CURRENT" ]]; then
  exit 0
fi

echo "==> origin/$BRANCH moved to ${REMOTE:0:8} (was ${CURRENT:0:8}); deploying"

# Reset rather than pull. A pull can stop on a merge conflict and wait for a
# human, which is precisely what this exists to avoid; the VM is not somewhere
# anyone edits files, so origin is always right.
sudo -u "$APP_USER" git reset --hard "origin/$BRANCH"

# --- The deploy itself -------------------------------------------------------
# If it fails, the state file is NOT written, so the next tick tries the same
# commit again — a transient npm registry blip fixes itself. deploy.sh builds
# before it restarts, so a broken commit leaves the old version serving.
if bash "$APP_DIR/deploy/deploy.sh"; then
  echo "$REMOTE" > "$STATE"
  echo "==> Deployed ${REMOTE:0:8}"
else
  echo "!! Deploy of ${REMOTE:0:8} failed; will retry on the next tick." >&2
  exit 1
fi
