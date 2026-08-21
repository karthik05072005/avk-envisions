# Deploying AVK Envisions to Google Cloud

A complete walkthrough: one Compute Engine VM running the app on SQLite, with a
Hostinger domain and automatic HTTPS.

Every command is meant to be copied exactly. Where you must substitute your own
value it is written in `CAPITALS`.

**Time:** about 45 minutes, plus up to a few hours waiting for DNS.
**Cost:** roughly ₹1,100–1,400 per month for the VM, plus your domain.

---

## Why a VM and not Cloud Run

Cloud Run is the usual answer for a Next.js app, and it is the wrong answer for
this one.

This app stores everything in a SQLite file on disk. Cloud Run's filesystem is
**ephemeral and per-container**: it is wiped on every restart, and each new
container gets its own blank copy. Students would lose their accounts, attempts
and results without warning, and two students hitting different containers
would see different data.

A single VM with a persistent disk keeps SQLite working exactly as it does on
your laptop. The trade is that you run one instance and manage the machine
yourself. That is a reasonable trade at launch — see
[When to move off this setup](#when-to-move-off-this-setup).

---

## Before you start

You need:

- A Google account with billing enabled
- Your Hostinger domain
- Your project code

---

## Step 1 — Install the Google Cloud CLI

**Windows:** download and run the installer from
<https://cloud.google.com/sdk/docs/install>. Tick "Run gcloud init" at the end.

**macOS:**

```bash
brew install --cask google-cloud-sdk
```

Then sign in:

```bash
gcloud auth login
```

A browser window opens. Choose your Google account and allow access.

---

## Step 2 — Create the project

```bash
gcloud projects create avk-visions --name="AVK Envisions"
gcloud config set project avk-visions
```

> If the name is taken, add digits: `avk-visions-2481`. Use that name everywhere
> below.

Link billing — find your account ID first:

```bash
gcloud billing accounts list
```

You will see something like `01A2B3-C4D5E6-F7G8H9`. Use it here:

```bash
gcloud billing projects link avk-visions --billing-account=YOUR_BILLING_ID
```

Enable the API that creates VMs:

```bash
gcloud services enable compute.googleapis.com
```

This takes a minute or two.

---

## Step 3 — Reserve a static IP

Do this **before** creating the VM. An IP that comes with a VM is ephemeral and
changes if the machine is ever stopped — which would silently break your domain.

Pick the region closest to your students. For India, `asia-south1` is Mumbai.

```bash
gcloud compute addresses create avk-ip --region=asia-south1
gcloud compute addresses describe avk-ip --region=asia-south1 --format="value(address)"
```

That last command prints your IP, for example `34.93.123.45`.

**Write it down.** You need it in Step 4 and Step 6.

---

## Step 4 — Create the VM

```bash
gcloud compute instances create avk-server \
  --zone=asia-south1-a \
  --machine-type=e2-small \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-balanced \
  --address=YOUR_STATIC_IP \
  --tags=http-server,https-server
```

What these mean:

| Flag | Why |
|---|---|
| `e2-small` | 2 vCPU, 2 GB RAM. Enough for this app; the setup script adds swap so the build does not run out of memory. |
| `30GB pd-balanced` | Room for the OS, the app, the database and two weeks of backups. |
| `--address` | Attaches the static IP from Step 3. |
| `--tags` | Lets the firewall rules below find this machine. |

Open the web ports:

```bash
gcloud compute firewall-rules create allow-http \
  --allow=tcp:80 --target-tags=http-server --description="HTTP"

gcloud compute firewall-rules create allow-https \
  --allow=tcp:443 --target-tags=https-server --description="HTTPS"
```

Port 3000 is deliberately left closed. Node listens only on localhost and Caddy
proxies to it, so the app is never reachable except over HTTPS.

---

## Step 5 — Point your Hostinger domain at the VM

Do this now, because DNS takes time to propagate while you carry on.

1. Sign in to Hostinger
2. **Domains** → your domain → **DNS / Nameservers**
3. Delete any existing `A` record for `@` or `www`
4. Add these two records:

| Type | Name | Points to | TTL |
|---|---|---|---|
| `A` | `@` | `YOUR_STATIC_IP` | 3600 |
| `A` | `www` | `YOUR_STATIC_IP` | 3600 |

Save.

Check it from your own machine:

```bash
nslookup yourdomain.com
```

When it returns your static IP, DNS is ready. This usually takes 15–30 minutes
but can take a few hours.

> **Do not skip ahead to the point where Caddy requests a certificate until this
> resolves.** Let's Encrypt verifies by connecting to your domain. If DNS is not
> ready the request fails, and repeated failures hit a rate limit that locks you
> out for an hour.

---

## Step 6 — Connect to the VM

```bash
gcloud compute ssh avk-server --zone=asia-south1-a
```

The first run generates an SSH key. Press Enter to accept the default path, and
enter a passphrase or press Enter twice for none.

You are now on the server. Your prompt changes to something like
`yourname@avk-server:~$`.

---

## Step 7 — Upload the application

**On your own machine**, in a second terminal, from the project folder:

```bash
gcloud compute scp --recurse \
  --zone=asia-south1-a \
  ./src ./prisma ./public ./deploy \
  ./package.json ./package-lock.json ./next.config.mjs \
  ./tsconfig.json ./tailwind.config.ts ./postcss.config.mjs \
  avk-server:~/upload/
```

> Do **not** upload `node_modules`, `.next`, `.env` or `prisma/dev.db`. They are
> either rebuilt on the server or contain values that belong only on your
> laptop.

**Back on the VM:**

```bash
sudo mkdir -p /opt/avkvisions
sudo cp -r ~/upload/* /opt/avkvisions/
sudo chown -R avk:avk /opt/avkvisions 2>/dev/null || true
```

*(The `chown` fails harmlessly here — the `avk` user does not exist until the
next step creates it.)*

---

## Step 8 — Run the setup script

Still on the VM:

```bash
sudo bash /opt/avkvisions/deploy/setup-vm.sh yourdomain.com
```

This installs Node 22 and Caddy, creates a 2 GB swap file, creates the
unprivileged `avk` service user, creates `/var/lib/avkvisions` for the database,
configures the firewall, writes the Caddy site config and the systemd service,
and installs a nightly backup job.

It takes about three minutes.

---

## Step 9 — Create the environment file

Generate a session secret first:

```bash
openssl rand -base64 48
```

Copy the output. Now create the file:

```bash
sudo cp /opt/avkvisions/.env.production.example /opt/avkvisions/.env
sudo nano /opt/avkvisions/.env
```

Change at minimum:

```ini
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
DATABASE_URL="file:/var/lib/avkvisions/production.db"
AUTH_SECRET="paste-the-openssl-output-here"
SEED_ADMIN_EMAIL="you@yourdomain.com"
SEED_ADMIN_PASSWORD="a-strong-password-you-choose"
REQUIRE_EMAIL_VERIFICATION=false
```

Save with `Ctrl+O`, `Enter`, then exit with `Ctrl+X`.

Lock the file down — it holds your session secret:

```bash
sudo chown avk:avk /opt/avkvisions/.env
sudo chmod 600 /opt/avkvisions/.env
```

### Why `REQUIRE_EMAIL_VERIFICATION=false`

Email is not configured yet, so `EMAIL_PROVIDER=console` writes verification
emails to the server log instead of sending them. If verification were required,
students could register but never verify, and therefore never start a test.

Set it back to `true` once you configure Resend — see
[Sending real email](#sending-real-email).

---

## Step 10 — Deploy

```bash
sudo bash /opt/avkvisions/deploy/deploy.sh
```

This installs dependencies, applies database migrations, builds the app and
starts it. The first build takes 3–6 minutes on an `e2-small`.

The script refuses to run if `DATABASE_URL` is a relative path, because a
relative path would put the database inside the directory that every deploy
replaces.

---

## Step 11 — Load your content

```bash
cd /opt/avkvisions
sudo -u avk npx prisma migrate deploy
sudo -u avk npm run db:seed
sudo -u avk npm run db:seed:kas
sudo -u avk npm run db:seed:catalogue
sudo -u avk npm run db:seed:2011
```

That creates your admin account, the KAS exam and syllabus, the four course
tracks, and the 2011 Paper I questions.

---

## Step 12 — Check it works

Open `https://yourdomain.com`.

The first request may take 10–20 seconds while Caddy obtains your TLS
certificate. After that it is instant, and renewal is automatic.

Sign in at `https://yourdomain.com/login` with the `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` from Step 9.

**Change that password immediately** in the app, then blank
`SEED_ADMIN_PASSWORD` in `.env` so the plaintext is not left sitting on disk.

---

## Running it day to day

```bash
# Live logs
sudo journalctl -u avkvisions -f

# Is it running?
sudo systemctl status avkvisions

# Restart
sudo systemctl restart avkvisions

# Deploy a new version: upload as in Step 7, then
sudo bash /opt/avkvisions/deploy/deploy.sh

# Back up right now
sudo /usr/local/bin/avk-backup

# Open the database directly
sudo -u avk sqlite3 /var/lib/avkvisions/production.db
```

---

## Backups

A nightly job at 02:30 writes a compressed snapshot to
`/var/lib/avkvisions/backups/` and keeps 14 days.

It uses SQLite's `.backup` command rather than `cp`, because copying a live
SQLite file can capture a half-written transaction and produce a corrupt copy
that looks fine until you try to restore it.

### Send backups off the machine

A backup on the same disk as the database is not a backup — it does not survive
the disk failing. Once the site is live:

```bash
gcloud storage buckets create gs://avk-backups --location=asia-south1
gcloud compute instances add-iam-policy-binding avk-server --zone=asia-south1-a 2>/dev/null || true
sudo nano /etc/cron.d/avk-backup
```

Set `AVK_BACKUP_BUCKET=avk-backups` in that file and save.

### Restoring

```bash
sudo systemctl stop avkvisions
sudo -u avk gunzip -c /var/lib/avkvisions/backups/avk-YYYYMMDD-HHMMSS.db.gz \
  > /var/lib/avkvisions/production.db
sudo systemctl start avkvisions
```

Test a restore **before** you need one. An untested backup is a guess.

---

## Sending real email

Verification and password-reset emails go nowhere until you configure a
provider.

1. Sign up at <https://resend.com> (free tier covers 3,000 emails/month)
2. Add and verify `yourdomain.com` — Resend gives you DNS records to add in
   Hostinger, exactly as in Step 5
3. Create an API key
4. On the VM:

```bash
sudo nano /opt/avkvisions/.env
```

```ini
EMAIL_PROVIDER=resend
EMAIL_API_KEY="re_your_key_here"
EMAIL_FROM="AVK Envisions <no-reply@yourdomain.com>"
REQUIRE_EMAIL_VERIFICATION=true
```

```bash
sudo systemctl restart avkvisions
```

---

## Taking payments

Leave Razorpay disabled until you are ready. While the keys are blank, checkout
is unavailable and the app says so on the pricing and subscription pages, rather
than offering a button that fails.

When ready, set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET` and `RAZORPAY_LIVE_MODE=true`.

The app **refuses to start** in live mode without the webhook secret. That is
deliberate: an unverified webhook would let anyone grant themselves free access
by posting a fake "payment succeeded" to your server.

---

## When things go wrong

**The site does not load**

```bash
sudo systemctl status avkvisions
sudo journalctl -u avkvisions -n 50
```

**Certificate errors / "not secure"**

Caddy could not verify your domain. Almost always DNS:

```bash
nslookup yourdomain.com          # must return your static IP
sudo journalctl -u caddy -n 30
```

**The build is killed partway through**

Out of memory. Confirm swap is active:

```bash
free -h                          # "Swap" should show 2.0Gi
```

If it shows zero, re-run `setup-vm.sh`.

**"Too many requests" while testing**

The rate limiter is working. Sign-in is capped at 10 attempts per 15 minutes per
IP. Wait, or restart the app — the limiter is in-process, so a restart clears it.

**A deploy failed and the site is down**

The previous build is still on disk. Roll back with:

```bash
sudo systemctl restart avkvisions
```

If the database is the problem, restore from a backup as above.

---

## What this setup does not do

Being explicit, so none of these surprise you later:

- **One instance.** No horizontal scaling. Rate limiting is per-process and the
  database is a local file, so a second instance would double-count limits and
  see different data.
- **Brief downtime on deploy.** The restart takes a few seconds.
- **You patch the OS.** Run `sudo apt update && sudo apt upgrade` monthly.
- **No CDN.** Fine for one region; add Cloud CDN if you grow beyond India.

---

## When to move off this setup

Watch for these. Any one of them means it is time for Cloud SQL Postgres:

- **Concurrent test-takers.** SQLite serialises writes. Each student autosaves
  every five seconds, so roughly 300+ students in one test window will start to
  contend. Your scheduled midnight tests are exactly this pattern.
- **You need more than one instance** — for uptime during deploys, or for
  traffic.
- **Backups feel risky.** Cloud SQL does point-in-time recovery; this does not.

The migration is smaller than it looks. The enum layer was written to be
portable: change `provider = "sqlite"` to `"postgresql"` in
`prisma/schema.prisma`, point `DATABASE_URL` at Cloud SQL, and re-run the
migrations. The application code does not change.

---

## Cost

| Item | Monthly |
|---|---|
| `e2-small` VM, `asia-south1` | ~₹950 |
| 30 GB balanced disk | ~₹130 |
| Static IP (while attached) | free |
| Egress, light traffic | ~₹0–100 |
| **Total** | **~₹1,100–1,400** |

Reduce it with a one-year committed-use discount (about 37% off) once you are
confident in the setup.

To stop paying while not in use:

```bash
gcloud compute instances stop avk-server --zone=asia-south1-a
```

The disk and static IP still bill a small amount, and your data is preserved.
