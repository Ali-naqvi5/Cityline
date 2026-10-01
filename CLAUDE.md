# Cityline — project rules

## What this is

Next.js app for Cityline Airport Transfers Ltd (TfL PHV operator **11628**):
public SEO website + booking funnel (`/book`) + magic-link manage-booking,
and later an operations admin (jobs from all sources, drivers, finance, WhatsApp).

Spec: `docs/cityline-platform-spec-v6.html` (v6.0, 20 Sep 2026) — the source of truth.
Section references below (§n) point into it.

**Start every session by reading `docs/progress.md`** — what is built, what is
not, and the seams in between. Update it before you finish.

## Stack

Next.js 16 (App Router, TypeScript, standalone build) · Payload CMS 3 (admin, added last)
PostgreSQL 17 · Tailwind 4 + shadcn/ui · Stripe · Google Places/Routes
WhatsApp Cloud API · Resend/Postmark · Twilio · Sentry
Self-hosted on ONE IONOS VPS (Ubuntu 24.04) with Docker Compose behind Caddy.
Cron on the VPS runs the worker every minute (outbox retries, reminders, backups).

## Commands

```
pnpm dev            # next dev
pnpm build          # next build (standalone)
pnpm typecheck      # next typegen && tsc --noEmit (route types first: CI has no .next)
pnpm lint           # eslint
pnpm format         # prettier --write
pnpm test           # vitest run (pricing, money, compliance, launch gate)
pnpm e2e            # playwright: booking funnel + launch gate; needs pnpm db:up && pnpm migrate
pnpm db:up          # local Postgres only (compose.local.yaml)
pnpm db:down        # stop local Postgres (keeps the volume)
pnpm worker         # run the outbox worker once, locally
pnpm check:migrations   # DATA-04 guard: migrations must only add

# Payload (admin + schema). The DB must be up: pnpm db:up
pnpm migrate:create <name>                # generate, then READ it before running
pnpm migrate                              # apply pending migrations locally
pnpm migrate:status                       # which migrations have run
pnpm exec payload generate:types          # refresh src/payload-types.ts
pnpm exec payload generate:importmap      # after adding a custom admin component
```

**Schema push is off, in dev too** (`push: false` in `payload.config.ts`). Every
database, local included, is shaped only by migrations. Changed a collection?
`pnpm migrate:create <name>` → read it → `pnpm migrate`. Until you do, dev
pages that touch that collection error. Push was turned off because it would
drop the parts of the schema that exist only in migrations: the partial unique
index on jobs (booking, leg), the source/booking check constraint and
`job_reference_seq`.

**`migrate:down`, `migrate:reset`, `migrate:refresh` and `migrate:fresh` are
blocked** (DATA-03) by `bin` scripts in `payload.config.ts` that refuse and exit

1. To undo a migration, write a new forward one. Only for deliberately wiping a
   local dev database: `ALLOW_DESTRUCTIVE_MIGRATIONS=yes` on that one command.

Deploy: push to `main` → CI builds the image → SSH deploy. **Never edit files on the server.**

## Known trap: native bindings after a dependency change

Vitest bundles with rolldown, which needs a platform-specific native binding
shipped as an optional dependency. The binding requires Node
`^20.19.0 || >=22.12.0`, and pnpm silently skips an optional dependency whose
`engines` do not match — so on **Node 22.11** (this PC as of 29 Sep 2026) every
fresh install leaves it out and vitest fails with "Cannot find native binding".
CI uses the latest Node 22 and is unaffected. A plain `pnpm install` will not
fix it — it reports "Already up to date". Upgrading local Node to the current
22.x removes the problem; until then:

    pnpm install --force

`supportedArchitectures` in pnpm-workspace.yaml declares win32/linux/darwin so
the lockfile stays valid for local dev, CI and the Docker build.

## Styling

Comes from Cityline's Figma file (read via the Figma MCP / Dev Mode exports) or Google
Stitch output. **Do NOT invent a palette or typography; ask for the file if it is missing.**
Tokens live in one theme file (`src/styles/theme.css`); components must not hard-code colours.
Until the Figma file arrives, build with neutral styling and restyle in S1.

## Non-negotiable rules

- **NEVER** use "taxi", "cab", "minicab" in copy, slugs, titles, alt text or emails (CMP-01).
  `src/domain/compliance/forbidden-words.ts` is the check — use it, and keep its tests passing.
- **NEVER promise flight tracking.** Cityline confirmed on 22 Sep 2026 that it will
  never be built — not now, not later. No page, email, WhatsApp template or alt text
  may say we monitor, track or watch a flight, or that a pickup adjusts by itself.
  What we _do_: the customer gives a flight number, **a person** checks the arrival
  time before the driver is dispatched, and free waiting runs from touchdown. Say that.
  `src/domain/compliance/unsupported-claims.ts` fails the build on the designs'
  phrasing — the supplied designs promise it on seven pages, several still unbuilt,
  so the copy will try to come back. Do not widen the allowlist to let it.
- Money = **integer pence**; percentages = **basis points** (1% = 100); timestamps
  `timestamptz` in **UTC**, displayed **Europe/London**. Never use floats for money.
- The booking funnel stays on this domain, never requires an account, and shows a price
  **before** asking for name/phone/email.
- Prices are **ALWAYS** recalculated server-side; never trust a price from the client.
- `jobs.source` is required and **immutable**; website jobs only come from checkout;
  partial unique index on `(supplier_id, supplier_ref)`; website jobs lock
  price/customer/route — changes go through the amend flow.
- Assign driver ⇒ WhatsApp template sent immediately; on failure write to `outbox`
  for retry and alert staff. **Never silent.**
- Copy driver PHV number + vehicle reg onto the job at assignment (TfL record, CMP-03).
- Drivers/vehicles with expired documents cannot be assigned (CMP-10).
- Stripe webhooks: verify signature, store event ids for idempotency, treat as the
  source of truth for payment status.
- A booking is created only by `fulfilCheckoutSession` (webhook and `/book/return`
  both call it), which re-reads the Checkout Session from Stripe with the secret
  key. Never book from anything the browser reports.
- Migrations **only add**. No destructive commands outside local dev.
  `pnpm check:migrations` fails the build on DROP/TRUNCATE/RENAME in an `up`
  path. Removing a column takes two deployments: add and copy, then drop later.
  Never run `migrate:down` on the server — a rollback is redeploying the
  previous image, not undoing the schema.
  **NEVER** `docker compose down -v` or `docker volume prune` on the server (DATA-05).
- Private files (driver docs, receipts) only via signed short-lived URLs after a role check.
- Respect the launch gate and feature flags; Stripe/WhatsApp stay in test mode until
  launch; test records carry `is_test`.
- WCAG 2.2 AA; verify at 390px and 1440px; no layout shift; `next/image` everywhere.

## Next.js 16 conventions used here

- `src/proxy.ts`, not `middleware.ts` (the middleware file convention is deprecated in 16).
- `output: "standalone"` — the Docker image runs `node server.js`.
- Server Components by default; `"use client"` only where there is interaction.

## Structure

```
src/app/(public)          the public site's root layout (SiteHtml) and, inside it:
  (site)                  public pages and templates (§5)
  (booking)               4-step funnel + /book/confirmed/[ref]
  (manage)                magic-link self-service
  coming-soon             launch gate target
src/app/(payload)         Payload's own root layout; /admin and Payload's API
src/app/global-not-found  404 for unmatched URLs (two root layouts, so no shared one)
src/app/api               stripe webhook, cron, health
src/admin                 the operations screens: views, actions, data, nav, guard
src/components/ops        the operations UI kit (shell, tables, badges, states)
src/access                collection access helpers (from the permission matrix)
src/collections           Payload collections
src/components/ui         design-system components (from the designs)
src/components/site       page blocks
src/domain/*              pricing, booking, jobs, staff permissions, notifications
src/worker                outbox handlers, scheduled tasks
src/migrations            committed, reviewed migrations
docker/                   Dockerfile, Caddyfile, backup image
```

## Admin (operations screens)

See `docs/admin-implementation-map.md`. Rules that are easy to break:

- **Every custom view calls `requireStaff(props, capability, returnTo)` first;
  every server action calls `staffForAction(capability)`** (`src/admin/guard.ts`).
  Payload does _not_ redirect signed-out visitors away from custom views.
- **One permission matrix**, `src/domain/staff/permissions.ts`. Navigation,
  views, actions and collection `access` (`src/access/staff.ts`) all read it.
  Never check a role name directly.
- Admin reads and writes go through the Local API **as the user**
  (`user, overrideAccess: false`), so collection access applies.
- New or renamed views: register in `payload.config.ts` →
  `admin.components.views`, then `pnpm exec payload generate:importmap`.
- Styles: `src/app/(payload)/ops.css` — its own tokens (`text-ink-3`,
  `bg-accent-soft`, pixel sizes; Payload's root font is 13px) and no preflight.
  In ops components use `cx` from `components/ops/primitives`, **not** `cn`:
  `cn`'s merge tables drop the custom token classes as "conflicts".
- **Forms submit with `submitWithoutReset`** (`lib/form-submit.ts`) as
  `onSubmit`, keeping `action={dispatch}` for no-JS. React 19 clears a
  `<form action>` after every submission, errors included — it once wiped
  customers' details on booking step 3.
- Server-side form helpers (`zodErrors`, `payloadErrors`) are in
  `admin/form-errors.ts` (server-only); `admin/form-state.ts` stays
  client-safe. Payload's `ValidationError` is recognised by shape, not
  `instanceof` (the bundle can hold two copies of the class).
- Private uploads (licences, receipts) go to the `private-files` collection,
  stored under `STORAGE_PATH/private`; Payload serves them only after the
  collection's `read` access passes.
- Nothing is shown as working before it works: unbuilt screens are "Soon" in
  the navigation; values not recorded say so rather than showing £0.00.
- **Job rules live in the jobs collection's hooks**
  (`collections/hooks/jobs.ts`, `job-dispatch.ts`), not in screens: driver
  eligibility at the pickup time, copying the PHV number and registration,
  the status order (`domain/jobs/status.ts`), and the job's history rows for
  staff changes. Payload fills unchanged fields from the stored record before
  `beforeChange` runs — detect changes by comparing values, never by `key in
data`. To pass a value from `beforeChange` to `afterChange`, use
  `req.context`; nested Local API calls replace it, so a destructured
  `context` argument goes stale.
- WhatsApp is "click to send" (`wa.me` link with the message written) until
  the Business API is connected; the job records only what is known — that
  the message was opened — and the controller marks delivered or read.

## Definition of done (every task)

- Works locally. Tests written or updated and passing in CI.
- **There is no staging.** `main` deploys straight to production, so CI is the
  only gate — never merge to `main` to "see if it works on the server".
- Migrations only add things and have been reviewed. No destructive commands.
- Money in integer pence, times in UTC. No "taxi" or "cab" wording anywhere.
- Matches the Figma design at 390px and 1440px; keyboard-usable; no console errors.
- Deployed through CI with a database dump taken first, and checked on production afterwards.
