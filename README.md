# Cityline Airport Transfers — web platform

Direct-booking website and operations admin for **Cityline Airport Transfers
Limited**, TfL private hire operator licence **11628**.

One Next.js 16 application, self-hosted on a single IONOS VPS with PostgreSQL,
Caddy and a background worker in Docker. Public site and booking funnel first,
operations admin last.

- **Specification:** [`docs/cityline-platform-spec-v6.html`](docs/cityline-platform-spec-v6.html) (v6.0, 20 Sep 2026) — the source of truth.
- **Where the build stands:** [`docs/progress.md`](docs/progress.md) — read this first
- **Project rules for agents and developers:** [`CLAUDE.md`](CLAUDE.md)
- **Server setup:** [`docs/runbook-vps.md`](docs/runbook-vps.md)

## Getting started

```bash
pnpm install
cp .env.example .env.local        # fill in what you need
pnpm db:up                        # local Postgres on :5432
pnpm dev                          # http://localhost:3000
```

With `LAUNCH_GATE=on` the site serves the coming-soon page; reach the real pages
with `?preview=<PREVIEW_TOKEN>`.

## Commands

| Command                       | Does                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                    | Development server                                                                                             |
| `pnpm build`                  | Production build (standalone output)                                                                           |
| `pnpm build:worker`           | Bundle the worker to `dist/worker.js`                                                                          |
| `pnpm typecheck`              | `tsc --noEmit`                                                                                                 |
| `pnpm lint` / `pnpm format`   | ESLint / Prettier                                                                                              |
| `pnpm test`                   | Vitest — pricing, money, compliance rules, launch gate                                                         |
| `pnpm e2e`                    | Playwright at 390px and 1440px — **switches on in S3** with the booking funnel; browsers are not installed yet |
| `pnpm worker`                 | Run one worker tick locally                                                                                    |
| `pnpm db:up` / `pnpm db:down` | Local Postgres container                                                                                       |

## Where things are

```
src/app/(site)        public pages and templates
src/app/(booking)     /quote + the four booking steps
src/app/(manage)      magic-link self-service
src/app/(payload)     operations admin (built last)
src/app/api           health, cron, webhooks
src/domain/*          pricing, booking, jobs, finance, messaging, compliance, seo
src/worker            outbox retries, reminders, alerts
docker/               Dockerfile, Caddyfile, backup image
docs/                 specification and runbooks
```

## Build order

| Sprint | Scope                                                 |
| ------ | ----------------------------------------------------- |
| S0     | Server, foundations, CI, launch gate, worker, backups |
| S1     | Design → component library                            |
| S2     | Places, zones, routes, pricing engine                 |
| S3–S4  | Quote, booking steps 1–4, Stripe                      |
| S5     | Manage booking: amend, cancel, refund                 |
| S6     | Phase-1 pages and SEO                                 |
| S7     | Launch prep — _milestone A_, gate comes off           |
| S8–S10 | Admin: jobs, dispatch, finance — _milestone B_        |
| S11+   | Phase 2: route pages at scale, accounts, blog         |

Current state of each lives in [`docs/progress.md`](docs/progress.md), so it is
recorded in one place only.

## Non-negotiables

Money is integer pence. Times are UTC, displayed Europe/London. Prices are
always recalculated server-side. The words "taxi", "cab" and "minicab" appear
nowhere in customer-facing output — it is a TfL licence condition, and
`src/domain/compliance/forbidden-words.ts` enforces it.

See [`CLAUDE.md`](CLAUDE.md) for the full list.
