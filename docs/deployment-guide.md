# Deploying Cityline Airport Transfers — first deployment guide

**For:** a Claude session guiding Cityline's owner through putting the site on
its production server for the first time. The owner is not a developer. They
work on Windows 10 with VS Code, Git Bash and PowerShell, and have the
repository checked out at `D:\Cityline transfers\cityline-web`.

**Written:** 29 September 2026, from the repository at that date. The repo's
`docs/runbook-vps.md` covers the same ground more briefly; where they differ,
this guide is newer.

---

## Before you start: how to guide this

- **One step at a time.** Give the owner one command or one click-path, ask
  what they see, and check it against "You should see" before moving on.
- **Never ask the owner to paste a secret into the chat** — passwords, API
  keys, private SSH keys, tokens. Tell them where to put it instead. If they
  paste one anyway, tell them to rotate it after deployment.
- **Nothing is edited on the server except `.env.production`.** Code and
  config files change in git and arrive through a deploy. If something needs a
  code change, the owner takes it back to the development session (the Claude
  Code session in VS Code that built the site); note it for them.
- **Stop and ask** before anything that deletes data. The commands in
  "Never do this" below are forbidden outright.
- Keep a list of anything that went differently from this guide. The owner
  will hand it back to the development session afterwards (see the last
  section).

---

## 1. What is being deployed

A booking website for a TfL-licensed London private-hire operator: marketing
pages, a four-step booking funnel with card payment, and a manage-booking area.
An admin panel exists (`/admin`) but is not finished.

| Part        | Technology                                                               |
| ----------- | ------------------------------------------------------------------------ |
| Web app     | Next.js 16 (React 19, TypeScript), one Docker image                      |
| CMS / admin | Payload CMS 3, inside the same app at `/admin`                           |
| Database    | PostgreSQL 17, in Docker, never exposed to the internet                  |
| Payments    | Stripe (Payment Element + Checkout Sessions), **test mode until launch** |
| Email       | Nuntly (send API)                                                        |
| Web server  | Caddy 2 — HTTPS certificates from Let's Encrypt, automatically           |
| Hosting     | One IONOS VPS, Ubuntu 24.04, running Docker Compose                      |
| Deploys     | GitHub Actions → image on GitHub Container Registry (GHCR) → SSH to VPS  |

### How a deploy works (after this first time)

```
git push origin main
   └─ GitHub Actions "Deploy" workflow
        1. Checks: types, lint, formatting, TfL wording, migrations, 334 unit
           tests, 18 browser tests. Any failure stops everything here.
        2. Build the Docker image; push to ghcr.io/ali-naqvi5/cityline-web
           tagged with the first 12 characters of the commit.
        3. SSH to the VPS and run /srv/cityline/deploy.sh, which:
             - pulls the new image
             - dumps the database to /srv/cityline/pre-deploy-*.sql.gz
             - runs database migrations (forward-only)
             - replaces only the app and worker containers
             - health-checks; rolls back to the previous image on failure
```

**There is no staging site.** The owner decided that a push to `main` goes
straight to production. That is why the checks gate the deploy.

### What runs on the server

`/srv/cityline/compose.yaml` defines six containers:

| Container | Job                                                                      |
| --------- | ------------------------------------------------------------------------ |
| `caddy`   | Public ports 80/443. HTTPS, `www` → bare domain redirect                 |
| `app`     | The website (`node server.js`, port 3000 inside Docker only)             |
| `worker`  | Background tasks, ticks every minute (nothing registered yet)            |
| `db`      | PostgreSQL 17. Data in the `pg_data` volume                              |
| `backup`  | Nightly encrypted `pg_dump` at 03:15, keeps 14 daily/8 weekly/12 monthly |

Volumes `pg_data`, `storage` (uploads) and `backups` hold everything that
matters. **They must never be deleted.**

### The launch gate

`LAUNCH_GATE=on` shows the public a "coming soon" page on every URL and marks
it `noindex`. The owner sees the real site by visiting
`https://citylineairporttransfers.com/?preview=<PREVIEW_TOKEN>` once, which
sets a cookie. `/admin`, `/api/health`, `/api/cron` and `/api/webhooks` work
through the gate. **The first deployment is with the gate on.** Going live
(gate off) is a separate, later step — section 12.

---

## 2. Decisions and accounts needed first

| Needed                      | Notes                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------- |
| IONOS VPS                   | Not bought yet. Section 3                                                             |
| Access to the IONOS DNS     | For `citylineairporttransfers.com`. Section 5                                         |
| GitHub account `Ali-naqvi5` | Owner of the `Cityline` repository; admin rights to change settings                   |
| Stripe **test** keys        | `pk_test_…` and `sk_test_…` from the Stripe sandbox. Live keys only at launch         |
| Nuntly API key              | Already exists. The domain must be verified in Nuntly before email works (section 10) |
| A password manager          | Several new secrets are created below; each must be stored somewhere safe             |

Not needed for this deployment (they are launch-day items): the real phone
number, Stripe live keys, turning off the gate.

**Is anything live on the domain today?** Changing DNS (section 5) moves the
website to the VPS. If an old site is hosted on IONOS webspace at this domain,
it stops being served. Email is not affected.

---

## 3. Buy and prepare the VPS

### 3.1 Order it

IONOS → Servers & Cloud → VPS.

| Setting     | Value                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size        | **VPS L+** or similar — at least 4 vCPU and 8 GB RAM (the image is built by GitHub, not on the server, so this is headroom for Postgres and traffic) |
| Image       | **Ubuntu 24.04 LTS**, no Plesk / no cPanel                                                                                                           |
| Data centre | **United Kingdom** (keeps customer data in the UK)                                                                                                   |
| SSH key     | Add the owner's public key if IONOS offers it during ordering                                                                                        |

Write down the server's **IPv4** and **IPv6** addresses.

### 3.2 An SSH key for the owner (on their Windows PC)

In PowerShell:

```powershell
ssh-keygen -t ed25519 -C "cityline-owner"
```

Accept the default path (`C:\Users\<name>\.ssh\id_ed25519`) and set a
passphrase. The public half is `id_ed25519.pub` — that is the one that goes to
IONOS / the server. The private half never leaves the PC.

### 3.3 First login and hardening

```bash
ssh root@<VPS-IPv4>
```

(If IONOS gave a root password instead of taking the key, log in with it, then
add the key: `mkdir -p ~/.ssh && nano ~/.ssh/authorized_keys`, paste the
**public** key, save, `chmod 600 ~/.ssh/authorized_keys`.)

Then, as root:

```bash
# A normal user for everything from now on
adduser cityline
usermod -aG sudo cityline
rsync --archive --chown=cityline:cityline ~/.ssh /home/cityline

# Updates
apt update && apt upgrade -y
apt install -y fail2ban unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades   # answer Yes

# Firewall: SSH and web only. Postgres is never reachable from outside.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable
```

**Before disabling password and root login, open a second terminal and check
that `ssh cityline@<VPS-IPv4>` works.** Only then:

```bash
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

In the **IONOS Cloud Panel → Network → Firewall policies**, allow the same:
TCP 22, TCP 80, TCP 443, UDP 443.

You should see: `ssh cityline@<VPS-IPv4>` logs in with the key; `ssh root@…`
is refused.

### 3.4 Docker

Logged in as `cityline`:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker cityline
exit
```

Log in again (the group change needs a new session), then:

```bash
docker --version && docker compose version
docker run --rm hello-world
```

You should see: version numbers, then "Hello from Docker!".

Note: Docker opens the ports its containers publish regardless of `ufw`. Only
Caddy publishes ports (80, 443), which is what we want. Nothing else in
`compose.yaml` has a `ports:` line — never add one to `db`.

---

## 4. Put the files on the server

### 4.1 The application folder

On the server:

```bash
sudo mkdir -p /srv/cityline
sudo chown cityline:cityline /srv/cityline
```

From the owner's PC, in Git Bash, in the repository folder
(`D:\Cityline transfers\cityline-web`):

```bash
scp compose.yaml cityline@<VPS-IPv4>:/srv/cityline/
scp -r docker cityline@<VPS-IPv4>:/srv/cityline/
scp scripts/deploy.sh cityline@<VPS-IPv4>:/srv/cityline/deploy.sh
```

On the server:

```bash
cd /srv/cityline
chmod +x deploy.sh
ls -la . docker docker/pg-backup
```

You should see: `compose.yaml`, `deploy.sh`, and `docker/Caddyfile`,
`docker/Dockerfile`, `docker/pg-backup/{Dockerfile,backup.sh,entrypoint.sh,restore.sh}`.

These files are **copies of the repository**. If one changes in git later, copy
it again; never edit it on the server.

### 4.2 The secrets file: `/srv/cityline/.env.production`

Generate the random values on the server — run each and paste the result into
the file, not into the chat:

```bash
openssl rand -hex 32   # PAYLOAD_SECRET
openssl rand -hex 24   # POSTGRES_PASSWORD
openssl rand -hex 16   # PREVIEW_TOKEN
openssl rand -hex 24   # CRON_SECRET
openssl rand -hex 32   # BACKUP_ARCHIVE_PASSWORD
```

**Store every one of these in the password manager as well.** Two matter most:

- `PAYLOAD_SECRET` — every customer's manage-booking link is derived from it.
  Changing it later breaks all existing links.
- `BACKUP_ARCHIVE_PASSWORD` — backups are encrypted with it. Lose it and the
  backups cannot be opened.

Create the file:

```bash
nano /srv/cityline/.env.production
```

```ini
# --- App ---
NEXT_PUBLIC_SITE_URL=https://citylineairporttransfers.com
PAYLOAD_SECRET=<openssl rand -hex 32>
LAUNCH_GATE=on
PREVIEW_TOKEN=<openssl rand -hex 16>
CRON_SECRET=<openssl rand -hex 24>

# --- Where the image comes from (lowercase — image names must be) ---
GHCR_OWNER=ali-naqvi5
# Do NOT set APP_TAG here. Every deploy sets it.

# --- Database (the host is the container name, "db") ---
POSTGRES_USER=cityline
POSTGRES_PASSWORD=<openssl rand -hex 24>
POSTGRES_DB=cityline
DATABASE_URL=postgres://cityline:<the same POSTGRES_PASSWORD>@db:5432/cityline

# --- Stripe: TEST keys until launch ---
STRIPE_SECRET_KEY=<sk_test_… from the Stripe sandbox>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_test_…>
STRIPE_WEBHOOK_SECRET=
# ^ filled in at section 9

# --- Email (Nuntly) ---
NUNTLY_API_KEY=<the Nuntly key>
MAIL_FROM="Cityline Airport Transfers <bookings@citylineairporttransfers.com>"
OFFICE_ALERT_EMAIL=msnos1438@gmail.com
# staff-only = customer emails are redirected to the office. Keep until launch.
CUSTOMER_EMAILS=staff-only

# --- Backups ---
BACKUP_ARCHIVE_PASSWORD=<openssl rand -hex 32>
```

Every other variable in the repository's `.env.example` (Google Maps,
WhatsApp, Twilio, Turnstile, Sentry, GA4, HiDrive, B2) stays out for now; the
app does not need them.

Then:

```bash
chmod 600 .env.production
ln -s .env.production .env
```

**Why the link:** Compose substitutes values like `POSTGRES_PASSWORD` and
`GHCR_OWNER` into `compose.yaml` from a file named `.env`. The containers read
`.env.production`. The link makes them one file. Without it, every
`docker compose` command fails with `POSTGRES_PASSWORD is required`.

### 4.3 Let the server pull images from GitHub

The image is private. On GitHub (as `Ali-naqvi5`): **Settings → Developer
settings → Personal access tokens → Tokens (classic) → Generate new token**.
Scope: **`read:packages` only**. No expiry, or a long one with a reminder.

On the server, as `cityline`:

```bash
docker login ghcr.io -u Ali-naqvi5
```

Paste the token at the password prompt (it is not shown).

You should see: `Login Succeeded`.

---

## 5. DNS at IONOS

IONOS → Domains & SSL → `citylineairporttransfers.com` → DNS.

| Type | Host  | Points to |
| ---- | ----- | --------- |
| A    | `@`   | VPS IPv4  |
| A    | `www` | VPS IPv4  |
| AAAA | `@`   | VPS IPv6  |
| AAAA | `www` | VPS IPv6  |

- **Replace any existing A and AAAA records for `@` and `www`**, including
  IONOS's defaults. An old AAAA record left pointing at IONOS webspace sends
  IPv6 visitors — and Let's Encrypt, which prefers IPv6 — to the wrong place,
  and the certificate fails.
- If the VPS has no IPv6, delete the AAAA records for `@` and `www` instead.
- **Do not touch MX, SPF, DKIM, DMARC or any mail records.** Email stays with
  IONOS.

Check from the PC (PowerShell), until both show the VPS:

```powershell
nslookup citylineairporttransfers.com 8.8.8.8
nslookup www.citylineairporttransfers.com 8.8.8.8
```

This can take from minutes to a few hours. Caddy cannot get certificates
until it resolves.

**One thing to check first:** the site sends `Strict-Transport-Security` with
`includeSubDomains`, which makes browsers insist on HTTPS for every subdomain of
`citylineairporttransfers.com` for two years. If any subdomain is used over
plain `http://` (an old service, a control panel link), it will stop working in
browsers that visited the site. Ordinary email is unaffected.

---

## 6. GitHub settings for the deploy

### 6.1 A deploy key (GitHub Actions → server)

On the owner's PC, in PowerShell — a **separate** key, used only by GitHub:

```powershell
ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$HOME\.ssh\cityline_deploy"
```

Press Enter twice at the passphrase prompts — **no passphrase** for this key,
because GitHub Actions cannot type one. It is protected by living only in
GitHub's encrypted secrets.

Put the **public** half on the server:

```powershell
type $HOME\.ssh\cityline_deploy.pub | ssh cityline@<VPS-IPv4> "cat >> ~/.ssh/authorized_keys"
```

Get the server's host key line, for GitHub to trust it:

```powershell
ssh-keyscan -t ed25519 <VPS-IPv4>
```

(Optionally confirm it matches the server: on the server,
`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`, compare fingerprints.)

### 6.2 The `production` environment and its secrets

GitHub → the `Cityline` repository → **Settings → Environments → New
environment** → name it exactly `production`. In it, **Add environment
secret** four times:

| Secret            | Value                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `VPS_HOST`        | the VPS IPv4                                                                                                    |
| `VPS_USER`        | `cityline`                                                                                                      |
| `VPS_SSH_KEY`     | the whole content of `cityline_deploy` (the **private** file, no `.pub`), including the `BEGIN` and `END` lines |
| `VPS_KNOWN_HOSTS` | the line `ssh-keyscan` printed                                                                                  |

Open the private key file in Notepad to copy it; paste straight into GitHub.

### 6.3 Repository variables (baked into the image at build time)

**Settings → Secrets and variables → Actions → Variables tab → New repository
variable.** They must be **repository** variables — the build job has no
environment, so it cannot see environment variables.

| Variable                             | Value                                                 |
| ------------------------------------ | ----------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`               | `https://citylineairporttransfers.com`                |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | the `pk_test_…` key (publishable keys are not secret) |

The workflow also passes `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `NEXT_PUBLIC_GA4_ID`; leave them unset.

### 6.4 Actions must be allowed to run

**Settings → Actions → General**: "Allow all actions and reusable workflows"
(or at least GitHub's and Docker's). The workflow asks for its own
`packages: write` permission to publish the image, so the default token
setting can stay as it is.

---

## 7. First deployment

### 7.1 Start the database

On the server:

```bash
cd /srv/cityline
docker compose up -d db
docker compose ps
```

You should see: `db` with status `healthy` (give it ~15 seconds).
If it says `POSTGRES_PASSWORD is required`, the `.env` link from 4.2 is missing.

### 7.2 Push the code

The owner's local repository has commits not yet on GitHub. Pushing `main`
starts the deploy. From the repository folder, in Git Bash:

```bash
git status          # should say "Your branch is ahead of 'origin/main' by N commits", nothing uncommitted
git push origin main
```

(The owner can also ask the development session to push.)

Then watch **GitHub → Actions → Deploy** (about 15–25 minutes):

1. **Checks** — includes the browser tests, which start their own Postgres.
2. **Build and push image** — the first real build of the image. If it fails,
   copy the error for the development session.
3. **Deploy to production** — SSH to the server, runs `deploy.sh`.

In the Deploy step's log, one line looks alarming and is harmless:
`ERROR: No migration directory found at /app/dist/migrations`. The migration
runs right after it. What matters is that the step ends with
`deployed <tag>`.

On the server, afterwards:

```bash
cat /srv/cityline/.last-good-tag      # the 12-character tag just deployed
docker compose ps                     # app and worker "healthy"/"running", db "healthy"
```

### 7.3 Start the web server and backups

```bash
cd /srv/cityline
APP_TAG=$(cat .last-good-tag) docker compose up -d caddy backup
docker compose logs caddy --tail 50
```

Always prefix manual `docker compose up` commands with
`APP_TAG=$(cat .last-good-tag)`. Without it, Compose may replace the running
app with the `latest` image.

You should see in the Caddy log: `certificate obtained successfully` for
`citylineairporttransfers.com` and `www.citylineairporttransfers.com`. If it
reports a challenge failure, DNS (section 5) or the IONOS firewall (3.3) is the
cause — fix it and run `docker compose restart caddy`.

### 7.4 Create the admin user — immediately

Open `https://citylineairporttransfers.com/admin`. Payload asks to create the
first user. **Do this straight away**: until a user exists, anyone who opens
`/admin` can create one. Use the owner's email and a long password from the
password manager.

### 7.5 Check the site

| Check                                                           | Expected                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| `https://citylineairporttransfers.com`                          | The "coming soon" page, padlock in the browser              |
| `https://www.citylineairporttransfers.com`                      | Redirects to the address without `www`                      |
| `http://citylineairporttransfers.com`                           | Redirects to `https://`                                     |
| `https://citylineairporttransfers.com/api/health`               | `{"status":"ok","database":"ok",…}`                         |
| `https://citylineairporttransfers.com/?preview=<PREVIEW_TOKEN>` | The real home page; the `?preview=` disappears from the URL |
| (after preview) click through to `/book`, choose a journey      | Prices appear; step 4 shows Stripe's card form              |

And the security headers — in Git Bash or on the server (in PowerShell 5.1,
`curl` is a different command):

```bash
curl -sI https://citylineairporttransfers.com/book | grep -i content-security
```

Expected: a line containing `'nonce-`.

---

## 8. Scheduled tick (optional today)

The `worker` container already ticks every minute; this cron line is a safety
net, and no scheduled tasks exist yet. On the server:

```bash
crontab -e
```

```cron
* * * * * curl -fsS -m 50 -X POST -H "Authorization: Bearer <CRON_SECRET>" https://citylineairporttransfers.com/api/cron >/dev/null 2>&1
```

Use the public URL: the app's port 3000 is not reachable from the server
itself, only through Caddy.

---

## 9. Stripe (test mode) on the real domain

Still **test mode** — no real money. This makes payments work on the server
the way they do on the development PC.

1. Stripe Dashboard, in the **sandbox / test mode** the test keys come from →
   **Developers → Webhooks → Add endpoint**.
   - URL: `https://citylineairporttransfers.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`
2. Copy the endpoint's **signing secret** (`whsec_…`) into
   `STRIPE_WEBHOOK_SECRET` in `/srv/cityline/.env.production`.
3. Apply it — an edited env file needs the containers recreated, not restarted:

   ```bash
   cd /srv/cityline
   APP_TAG=$(cat .last-good-tag) docker compose up -d --force-recreate app worker
   ```

4. Optional: **Settings → Payment method domains → Add**
   `citylineairporttransfers.com`, so Apple Pay and Google Pay can appear.
5. **Test booking** (with the preview cookie): make a booking two or more days
   ahead, pay with card `4242 4242 4242 4242`, any future expiry, any CVC.
   - Expected: the confirmation page with a `CL-…` reference.
   - In `/admin`, the booking exists (marked as a test booking).
   - In Stripe → Webhooks → the endpoint, the event shows `200`.
   - 3D Secure test card: `4000 0025 0000 3155`, press **Complete**.

---

## 10. Email (Nuntly)

Email is sent from `bookings@citylineairporttransfers.com`. Nuntly refuses to
send until the domain is verified: until then, every email fails quietly in
the logs, and bookings still work.

1. Nuntly dashboard → Domains → add `citylineairporttransfers.com`.
2. Nuntly shows DNS records (DKIM, and SPF/return-path). Add them in IONOS DNS
   **alongside** the existing mail records — do not replace IONOS's MX or SPF.
   If IONOS already has an SPF `TXT` record (`v=spf1 …`), there must still be
   only **one** SPF record: merge Nuntly's `include:` into it rather than
   adding a second.
3. Wait for Nuntly to show "verified".
4. Make another test booking. The office address (`msnos1438@gmail.com`)
   should receive the new-booking alert and the customer's confirmation,
   marked `[For <customer email>]` — customer emails are redirected to the
   office until launch (`CUSTOMER_EMAILS=staff-only`).

To see email errors on the server:

```bash
docker compose logs app --since 30m | grep notifications
```

---

## 11. Backups — and prove they restore

1. Run one now. `--entrypoint` matters: the backup container's normal job is
   the nightly loop, which would ignore anything else and wait for 03:15.

   ```bash
   cd /srv/cityline
   docker compose run --rm --entrypoint backup.sh backup
   ```

   Expected: `wrote /backups/daily/cityline-….sql.gz.enc`, then two
   `WARNING: … not configured — no off-server copy` lines (hidrive, b2). The
   warnings are correct: **no off-server destination exists yet** (see below).

2. Restore it into a scratch database, to prove the password and the file work:

   ```bash
   docker compose run --rm --entrypoint ls backup /backups/daily
   docker compose run --rm --entrypoint restore.sh backup /backups/daily/<file from above> cityline_restore_test
   ```

   Expected: `[restore] row counts:` with the tables listed, then
   `[restore] done`. It refuses to restore over the live `cityline` database.
   Remove the scratch copy afterwards:

   ```bash
   docker compose exec db dropdb -U cityline cityline_restore_test
   ```

   Record the date in the
   "Restore test log" table at the bottom of `docs/runbook-vps.md` (in git,
   via the development session).

3. IONOS Cloud Panel → the VPS → turn on **backups / snapshots** for the whole
   server.

**Gap to know about:** the nightly dumps live on the same server. If the VPS is
lost, they are lost with it (only the IONOS snapshot survives). The backup
scripts support HiDrive and Backblaze B2, and the owner has neither; the
development session recommended copying the dumps over SFTP to Cityline's
IONOS web space, which needs a small script change. Until that is done, do not
rely on the backups alone.

---

## 12. Later: launch day (not part of this deployment)

When the owner decides to go live:

1. Real phone number in the code (the site shows a placeholder from a range
   that cannot connect) — development session.
2. Stripe **live**: activate the account, create a restricted live key
   (`rk_live_…`) as `STRIPE_SECRET_KEY`, set the repository variable
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `pk_live_…` **and redeploy** (it is
   baked into the image — GitHub → Actions → Deploy → Run workflow), add a live
   webhook endpoint and its `whsec_…`, register the domain for Apple Pay. Full
   list: `docs/runbook-vps.md` §10.
3. In `.env.production`: `LAUNCH_GATE=off`, `CUSTOMER_EMAILS=live`, then
   `APP_TAG=$(cat .last-good-tag) docker compose up -d --force-recreate app worker`.
4. One real booking with the owner's own card; refund it from Stripe.
5. Submit `https://citylineairporttransfers.com/sitemap.xml` to Google Search
   Console; set up the Google Business Profile.
6. Rotate any keys that were ever pasted into a chat (Stripe, Nuntly).

---

## Everyday operations

| Task                                  | How                                                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy a code change                  | Push to `main`. Nothing else                                                                                                                                |
| Redeploy without a code change        | GitHub → Actions → Deploy → **Run workflow** (needed after changing a repository variable)                                                                  |
| Change a setting in `.env.production` | Edit it, then `APP_TAG=$(cat .last-good-tag) docker compose up -d --force-recreate app worker`                                                              |
| See what is running                   | `docker compose ps`                                                                                                                                         |
| Read the app's log                    | `docker compose logs app --since 1h`                                                                                                                        |
| Roll back to an earlier version       | `APP_TAG=<older 12-char tag> docker compose up -d app worker` — tags are in GitHub's Deploy runs. The database is not rolled back; migrations only ever add |
| Restore the database before a deploy  | Each deploy leaves `/srv/cityline/pre-deploy-<date>.sql.gz` (last 10 kept). Ask the development session before restoring                                    |
| Server updates                        | Security updates install themselves (unattended-upgrades). Reboot occasionally: `sudo reboot`; every container restarts on its own                          |

## Never do this

- `docker compose down -v`, `docker volume rm …`, `docker volume prune`,
  `docker system prune --volumes` — deletes the database and uploads.
- `payload migrate:down`, `migrate:reset`, `migrate:refresh`, `migrate:fresh`
  — roll back or wipe the database. They are blocked unless
  `ALLOW_DESTRUCTIVE_MIGRATIONS=yes`; never set it.
- Add `ports:` to the `db` service, or open port 5432 in any firewall.
- Edit application files on the server. Change them in git; the deploy brings
  them.
- Commit `.env.production`, or any key, to git.
- Change `PAYLOAD_SECRET` without a reason — it breaks every customer's
  booking link.

## Troubleshooting

| Symptom                                            | Likely cause and fix                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checks fail in **Booking flow (Playwright)**       | That job runs on GitHub for the first time with this push. Nothing was deployed. Copy the failing test's log (and the `playwright-report` artifact) for the development session |
| `POSTGRES_PASSWORD is required`                    | The `.env` → `.env.production` link is missing (4.2)                                                                                                                            |
| Deploy job: `Permission denied (publickey)`        | `VPS_SSH_KEY` is not the private half of the key in `~/.ssh/authorized_keys`, or `VPS_USER` is wrong                                                                            |
| Deploy job: `Host key verification failed`         | `VPS_KNOWN_HOSTS` missing or from a different address — rerun `ssh-keyscan`                                                                                                     |
| `pull access denied` / `unauthorized` when pulling | `docker login ghcr.io` not done as `cityline`, or the token lacks `read:packages` (4.3)                                                                                         |
| `manifest unknown` when pulling                    | The image tag does not exist — the Build step failed or `GHCR_OWNER` is wrong (must be `ali-naqvi5`)                                                                            |
| Build step: `repository name must be lowercase`    | The workflow fix for this is in the repository from 29 Sep 2026 — make sure it was pushed                                                                                       |
| Caddy: certificate or challenge errors             | DNS not pointing at the VPS yet (check A **and** AAAA), or ports 80/443 closed in the IONOS firewall                                                                            |
| `/api/health` says `"database":"unreachable"`      | `DATABASE_URL` wrong: host must be `db`, password must equal `POSTGRES_PASSWORD`                                                                                                |
| Only "coming soon" is shown                        | Expected — the gate is on. Use `/?preview=<PREVIEW_TOKEN>`                                                                                                                      |
| Step 4 has no card form, says "not connected"      | `STRIPE_SECRET_KEY` missing in `.env.production`, or the `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` variable was not set when the image was built (set it, then Run workflow)         |
| Payment works but no booking appears               | The return page also creates the booking, so look for errors: `docker compose logs app --since 30m`; check the webhook's responses in Stripe                                    |
| No emails arrive                                   | Nuntly domain not verified (section 10); see `docker compose logs app \| grep notifications`                                                                                    |
| Deploy says `rolling back to …`                    | The new version failed its health check and the old one is serving. Copy the Deploy log for the development session                                                             |

---

## Handing back to the development session

When the deployment is done, the owner reports back to the development session
(the Claude Code session in VS Code). Give them this to paste:

- The deployed tag (`cat /srv/cityline/.last-good-tag`) and the date.
- Which sections were completed, and which were skipped or postponed.
- Everything that went differently from this guide, with the exact error text
  and what fixed it.
- Any change made to files in the repository, or to the server beyond
  `.env.production` (there should be none).
- Whether the test booking (section 9) and the restore test (section 11)
  succeeded.
- Whether the Nuntly domain is verified.
- **No secrets** — not the contents of `.env.production`, not keys, not tokens.
