#!/usr/bin/env bash
#
# Deploys AVK Envisions on the VM. Safe to re-run for every release.
#
#   sudo bash /opt/avkvisions/deploy/deploy.sh
#
# Order matters: back up, install, migrate, build, then restart. The build runs
# BEFORE the restart so a compile failure leaves the previous version serving
# rather than taking the site down.
#
set -euo pipefail

APP_USER="avk"
APP_DIR="/opt/avkvisions"
DATA_DIR="/var/lib/avkvisions"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: $APP_DIR/.env is missing. Copy .env.production.example and fill it in." >&2
  exit 1
fi

# --- Refuse to deploy with a broken database path ----------------------------
# A relative DATABASE_URL resolves inside $APP_DIR, which this script replaces
# on every deploy. That would silently delete every student account.
DB_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' || true)"
if [[ "$DB_URL" != file:/* ]]; then
  echo "ERROR: DATABASE_URL must be an ABSOLUTE path, e.g." >&2
  echo "       DATABASE_URL=\"file:$DATA_DIR/production.db\"" >&2
  echo "       Got: $DB_URL" >&2
  exit 1
fi

# --- Back up before touching anything ----------------------------------------
if [[ -f "$DATA_DIR/production.db" ]]; then
  echo "==> Backing up the database"
  /usr/local/bin/avk-backup
fi

echo "==> Installing dependencies"
# `npm ci` not `npm install`: installs exactly what the lockfile says, so a
# transitive dependency cannot change between your machine and production.
sudo -u "$APP_USER" npm ci --omit=dev --ignore-scripts
# Prisma's postinstall is skipped by --ignore-scripts, so generate explicitly.
sudo -u "$APP_USER" npx prisma generate

# --- Stop the app before touching the schema ---------------------------------
# SQLite gives the running process a lock that blocks the exclusive lock the
# migration engine needs, so migrating against a live app fails with
# "database is locked". Stopping first costs the build's worth of downtime and
# is the only reliable order on a single-file database.
echo "==> Stopping the app for migration"
systemctl stop avkvisions || true

echo "==> Applying database migrations"
# `migrate deploy`, never `migrate dev`. The dev command can reset the database
# when it sees drift; deploy only ever applies pending migrations forward.
sudo -u "$APP_USER" npx prisma migrate deploy

echo "==> Building"
# Dev dependencies are needed to build, so install them, build, then prune.
sudo -u "$APP_USER" npm ci --ignore-scripts
sudo -u "$APP_USER" npx prisma generate
# 3072, not 2048: the build ran out of heap on the smaller setting and retried
# itself into a half-written .next, which serves a 502 with no obvious cause.
sudo -u "$APP_USER" env NODE_OPTIONS=--max-old-space-size=3072 npm run build
sudo -u "$APP_USER" npm prune --omit=dev

echo "==> Starting"
systemctl start avkvisions

# --- Health check -------------------------------------------------------------
echo "==> Waiting for the app to answer"
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:3000/ >/dev/null 2>&1; then
    echo
    echo "Deployed. The site is live."
    echo "  Logs:   sudo journalctl -u avkvisions -f"
    echo "  Status: sudo systemctl status avkvisions"
    exit 0
  fi
  sleep 2
done

echo >&2
echo "ERROR: the app did not start within 60 seconds." >&2
echo "Recent logs:" >&2
journalctl -u avkvisions -n 40 --no-pager >&2
exit 1
