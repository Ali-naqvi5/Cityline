# VPS runbook — Sprint 0

Everything in this file happens on Cityline's IONOS account and the VPS. It is
the half of Sprint 0 that cannot be done from the repository.

Spec references: §10 (architecture), §11 (setup status), §12 (deployment),
§13 (data safety).

---

## 1. Order the VPS

IONOS → Servers & Cloud → VPS.

| Setting     | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Plan        | **VPS L+** (6 vCPU, 8 GB RAM, 240 GB NVMe)                            |
| Image       | **Ubuntu 24.04 LTS**, no Plesk / no cPanel                            |
| Data centre | **United Kingdom** (keeps personal data in the UK)                    |
| SSH key     | Upload your public key during ordering; do not accept a root password |

Record the IPv4 and IPv6 addresses — DNS and the Google Maps server key are
restricted to them.

## 2. Harden it, before anything else listens on port 80 (PRD-08)

```bash
ssh root@<vps-ip>

adduser cityline && usermod -aG sudo cityline
rsync --archive --chown=cityline:cityline ~/.ssh /home/cityline

# SSH: keys only, no root login
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# Firewall: only SSH and HTTP(S). Postgres is never exposed (NFR-04).
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable

apt update && apt install -y fail2ban unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

Then mirror the same rules in the **IONOS firewall** in the control panel —
belt and braces, because the IONOS firewall sits in front of the machine.

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker cityline
docker --version && docker compose version
```

## 4. Lay out the application directory

```bash
sudo mkdir -p /srv/cityline && sudo chown cityline:cityline /srv/cityline
cd /srv/cityline
```

Copy from the repository (never edit these on the server — change them in git
and redeploy):

- `compose.yaml`
- `docker/Caddyfile`
- `docker/pg-backup/`
- `scripts/deploy.sh` → `/srv/cityline/deploy.sh`, `chmod +x`

Create `/srv/cityline/.env.production` from `.env.example`, with real values.
**It never goes in git.** `chmod 600 .env.production`.

Log in to the container registry once, with a read-only token:

```bash
echo "<ghcr-read-token>" | docker login ghcr.io -u <github-user> --password-stdin
```

## 5. DNS at IONOS

Keep the domain and mailboxes where they are; point only the web records at the VPS.

| Record   | Name  | Value                                           |
| -------- | ----- | ----------------------------------------------- |
| A        | `@`   | VPS IPv4                                        |
| AAAA     | `@`   | VPS IPv6                                        |
| A / AAAA | `www` | same (Caddy 301s it to the bare domain, SEO-06) |

No `staging` record: Cityline's decision (28 Sep 2026) is that `main` deploys
straight to production. The spec's §12 assumes a staging site on the same VPS;
we do not run one.

Leave MX, SPF, DKIM and DMARC records alone — email stays with IONOS.

Caddy issues the certificates itself; the IONOS wildcard certificate stays with
the webspace.

## 6. First deploy, with the gate on

In `.env.production` set `LAUNCH_GATE=on` **before** the first `docker compose up`.
The public must never see a half-built site (PRD-02).

```bash
cd /srv/cityline
APP_TAG=<sha-from-ci> docker compose up -d
docker compose logs -f app
curl -fsS https://citylineairporttransfers.com/api/health   # → coming-soon is served, health is JSON
```

Preview as an owner: `https://citylineairporttransfers.com/?preview=<PREVIEW_TOKEN>`.

## 7. Cron every minute (§10)

```bash
crontab -e -u cityline
```

```cron
* * * * * curl -fsS -m 50 -X POST -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3000/api/cron >/dev/null 2>&1
```

The `worker` container already ticks every 60 seconds; this is the safety net,
and the tick is safe to run twice.

## 8. Backups — and a restore test the same day (DATA-07 … DATA-10)

1. Fill in `BACKUP_ARCHIVE_PASSWORD`, the HiDrive WebDAV credentials and the
   Backblaze B2 keys in `.env.production`. **Store the archive password in a
   password manager** — an encrypted dump you cannot decrypt is not a backup.
2. Turn on **IONOS Cloud Backup / snapshots** for the whole VPS in the control panel.
3. Force one run and check it lands in both remotes:
   ```bash
   docker compose run --rm backup backup.sh
   ```
4. **Restore test** into a scratch database:
   ```bash
   docker compose run --rm backup restore.sh /backups/daily/<file>.enc cityline_restore_test
   ```
   Record it in the log at the bottom of this file. Repeat monthly (DATA-09).

Still outstanding after Sprint 0: **continuous WAL archiving** (DATA-06,
WAL-G or pgBackRest) for point-in-time recovery to within 15 minutes. The
nightly dumps above give a 24-hour worst case until that is in place — put it in
before the site takes real bookings in S7.

## 9. Monitoring

- **Uptime Kuma** on the VPS, monitoring `https://citylineairporttransfers.com/api/health`
  every minute, alerting to email/WhatsApp within 5 minutes (NFR-02).
- **Sentry** DSN in `.env.production`.
- Container logs are capped at 10 MB × 5 files in `compose.yaml`.

## 10. Stripe in production (PAY-01)

The integration is built and tested against Stripe's sandbox. To take real
payments:

1. **Activate the live account** in the Dashboard (business verification). Use
   `https://citylineairporttransfers.com` as the website — the sandbox's
   profile had it misspelt. Stripe may review the site during verification, so
   the terms, cancellation and contact pages need to be reachable by then.
2. **Create a restricted key** (`rk_live_…`) and use it as
   `STRIPE_SECRET_KEY`, keeping the full secret key off the server. Today the
   code only creates and reads Checkout Sessions, so start from _Checkout
   Sessions: write_; refunds will need _Refunds: write_ once they are built. Try
   the same permissions on a sandbox restricted key first — a `403` from Stripe
   names the permission that is missing. Put `pk_live_…` in
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — it is baked in at build time, so it
   must be present when the image is built.
3. **Add the webhook endpoint** — Dashboard → Developers → Webhooks → Add
   endpoint: `https://citylineairporttransfers.com/api/webhooks/stripe`, events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`. Copy its signing secret (`whsec_…`)
   into `STRIPE_WEBHOOK_SECRET`. The launch gate already lets `/api/webhooks`
   through.
4. **Register the domain for Apple Pay and Google Pay** — Dashboard → Settings →
   Payment method domains → add `citylineairporttransfers.com`. Without it the
   wallets do not appear in the payment form. Register it separately in live
   mode and in each sandbox.
5. **Check payment methods** — Settings → Payment methods. The form shows
   whatever is enabled there; nothing in the code lists them.
6. Make one real payment with your own card, confirm the booking appears, then
   refund it from the Dashboard.

Every booking link is derived from `PAYLOAD_SECRET`, so rotating that secret
withdraws every customer's manage-booking link at once. Do it only on a
suspected compromise.

## 11. Accounts to open now — they have the longest lead times (§11)

- **Stripe** — company verification takes days.
- **Meta Business + WhatsApp Cloud API** — needs a **new phone number** that has
  never been used with a WhatsApp account, plus business verification and
  template approval.
- **Google Cloud** — Places (New) and Routes, billing enabled, browser key
  restricted by domain and server key restricted to the VPS IP.
- Email provider (Resend/Postmark) with SPF, DKIM and DMARC on the domain.
- Twilio (SMS), Sentry, Backblaze B2.

## 12. Security policy and rate limits (NFR-04)

- **Content-Security-Policy** is set by `src/proxy.ts` (`src/lib/csp.ts`), not
  by Caddy. Check it after a deploy:
  `curl -sI https://citylineairporttransfers.com/book | grep -i content-security`
  shows a `'nonce-…'`; the home page shows `'unsafe-inline'` instead. Adding a
  new third-party script, frame or API (Google Maps for addresses, say) means
  adding its origins in `src/lib/csp.ts`, or the browser blocks it.
- **Rate limits** (`src/lib/rate-limit.ts`) are counted in the app's memory.
  They are only correct with **one** app container. Scaling to two would let
  each allow the full limit; move the counts to Postgres first. A restart
  resets them, which is harmless.
- They key on the client address Caddy puts last in `X-Forwarded-For`. Caddy
  trusts that header only from private networks (`docker/Caddyfile`). If
  Cloudflare or another proxy is ever put in front, `clientKey` must read that
  proxy's header instead, or every visitor shares one limit.

## Never do this on the server

- `docker compose down -v` or `docker volume prune` — destroys `pg_data` and
  `storage` (DATA-05).
- `payload migrate:down`, `migrate:reset`, `migrate:refresh` or `migrate:fresh`
  — each rolls back or wipes the database (DATA-03). They refuse to run unless
  `ALLOW_DESTRUCTIVE_MIGRATIONS=yes` is set; never set it here. The server
  image does not include the Payload CLI anyway: deploys run only the
  forward-only `dist/migrate.js`.
- Edit application files directly. Change them in git; CI redeploys.
- Run a migration that drops or renames a column in one step (DATA-04).

---

## Restore test log (DATA-09)

| Date | Dump restored | Result | Who |
| ---- | ------------- | ------ | --- |
|      |               |        |     |
