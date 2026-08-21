#!/usr/bin/env bash
#
# One-time VM bootstrap for AVK Envisions on Google Compute Engine.
#
# Installs Node, Caddy (which handles HTTPS certificates automatically), creates
# the service user and the database directory, and configures swap.
#
# Run ONCE on a fresh Ubuntu 22.04 VM:
#   sudo bash setup-vm.sh yourdomain.com
#
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash setup-vm.sh yourdomain.com" >&2
  exit 1
fi

APP_USER="avk"
APP_DIR="/opt/avkvisions"
DATA_DIR="/var/lib/avkvisions"

echo "==> Updating packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg sqlite3 ufw

# --- Swap ---------------------------------------------------------------------
# `next build` peaks around 2 GB. An e2-small has exactly 2 GB, so without swap
# the build is killed by the OOM reaper partway through — which looks like a
# random failure rather than an out-of-memory error.
if [[ ! -f /swapfile ]]; then
  echo "==> Creating 2 GB swap file"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "==> Swap already present, skipping"
fi

# --- Node 22 ------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
echo "    node $(node --version), npm $(npm --version)"

# --- Caddy --------------------------------------------------------------------
# Chosen over nginx + certbot deliberately: Caddy obtains and renews TLS
# certificates by itself, with no cron job to forget and no renewal to expire.
if ! command -v caddy >/dev/null 2>&1; then
  echo "==> Installing Caddy"
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

# --- Service user -------------------------------------------------------------
# The app runs as an unprivileged user that cannot log in. If the process is
# ever compromised, it has no shell and no sudo.
if ! id "$APP_USER" >/dev/null 2>&1; then
  echo "==> Creating service user '$APP_USER'"
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi

# --- Directories --------------------------------------------------------------
echo "==> Creating directories"
mkdir -p "$APP_DIR" "$DATA_DIR" "$DATA_DIR/uploads" "$DATA_DIR/backups"

# The database lives OUTSIDE the application directory on purpose. A deploy
# replaces $APP_DIR wholesale; if the .db file lived there, every deploy would
# destroy every student's account, attempt and result.
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"
chmod 750 "$DATA_DIR"

# --- Firewall -----------------------------------------------------------------
echo "==> Configuring firewall"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
# Port 3000 is deliberately NOT opened. Node listens on localhost only and
# Caddy proxies to it, so the app is never reachable except over HTTPS.
ufw --force enable >/dev/null

# --- Caddy site ---------------------------------------------------------------
echo "==> Writing Caddy configuration for $DOMAIN"
cat > /etc/caddy/Caddyfile <<CADDY
# AVK Envisions — TLS certificates are obtained and renewed automatically.
$DOMAIN, www.$DOMAIN {
	encode zstd gzip

	reverse_proxy 127.0.0.1:3000 {
		# The app reads the client IP from these for rate limiting and audit
		# logs. Without them every request would appear to come from Caddy.
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}

	# Uploaded files are served straight off disk rather than through Node.
	handle_path /uploads/* {
		root * $DATA_DIR/uploads
		file_server
	}

	log {
		output file /var/log/caddy/avkvisions.log {
			roll_size 20mb
			roll_keep 5
		}
	}
}
CADDY

mkdir -p /var/log/caddy
chown -R caddy:caddy /var/log/caddy
systemctl reload caddy || systemctl restart caddy

# --- systemd service ----------------------------------------------------------
echo "==> Installing systemd service"
cat > /etc/systemd/system/avkvisions.service <<UNIT
[Unit]
Description=AVK Envisions
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

# Bind to localhost only. Caddy is the only thing that may reach the app.
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3000
Environment=NODE_ENV=production

# Hardening: the service can only write to the data directory.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR $APP_DIR/.next

StandardOutput=journal
StandardError=journal
SyslogIdentifier=avkvisions

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable avkvisions >/dev/null

# --- Nightly backup -----------------------------------------------------------
echo "==> Installing nightly backup"
install -m 755 -o root -g root /dev/stdin /usr/local/bin/avk-backup <<'BACKUP'
#!/usr/bin/env bash
# Nightly SQLite backup. Uses `.backup`, not `cp` — copying a live SQLite file
# can capture a half-written transaction and produce a corrupt, unusable copy.
set -euo pipefail
DATA_DIR="/var/lib/avkvisions"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$DATA_DIR/backups/avk-$STAMP.db"

sqlite3 "$DATA_DIR/production.db" ".backup '$DEST'"
gzip -f "$DEST"

# Keep 14 days locally.
find "$DATA_DIR/backups" -name 'avk-*.db.gz' -mtime +14 -delete

# Off-machine copy, if a bucket is configured. A backup that only exists on the
# same disk as the database is not a backup.
if [[ -n "${AVK_BACKUP_BUCKET:-}" ]] && command -v gcloud >/dev/null 2>&1; then
  gcloud storage cp "$DEST.gz" "gs://$AVK_BACKUP_BUCKET/" --quiet
fi
BACKUP

cat > /etc/cron.d/avk-backup <<CRON
# Nightly at 02:30 server time.
AVK_BACKUP_BUCKET=
30 2 * * * root /usr/local/bin/avk-backup >> /var/log/avk-backup.log 2>&1
CRON

echo
echo "=============================================="
echo " VM ready."
echo
echo " Next:"
echo "   1. Point $DOMAIN at this VM's IP in Hostinger DNS"
echo "   2. Upload the app to $APP_DIR"
echo "   3. Create $APP_DIR/.env  (see .env.production.example)"
echo "   4. Run: sudo bash $APP_DIR/deploy/deploy.sh"
echo
echo " Database will live at $DATA_DIR/production.db"
echo "=============================================="
