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
- **Dark mode** is each person's choice (Settings → Appearance, `users.opsTheme`),
  set as `data-ops-theme` on the shell. Colours are tokens with a dark block
  in `ops.css`; never hard-code a colour, use `text-on-solid` on solid
  buttons, and do not use `light-dark()` — the CSS build rewrites it so it
  resolves once, at the page root, and every colour turns transparent.
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
- **The job cycle** (Cityline, 2 Oct 2026): Unassigned → Assigned → Driver
  confirmed → DOW → DAP → POB → Completed, or DAP → PNS; Cancelled before
  POB. Forward one stage at a time, back any number (`domain/jobs/status.ts`,
  enforced by the jobs hook). Stage times are cleared when stepped back over.
- **No supplier commission and no driver pay rules** (Cityline, 2 Oct 2026):
  partners take their cut before sending a job, and a driver's pay is the
  driver price written on each booking. Drivers are independent — never
  show employment wording.
- **Reports** (`admin/reports/`, `/admin/reports/*`) are dashboards over the
  raw rows: the figures and charts first, then every row in a table and as a
  CSV from `/api/reports/<report>` (`app/api/reports/[report]/route.ts`,
  same capability as the screen; add new reports to its `REPORTS` table).
  The screen and the CSV load through one function, so they always agree.
  Test bookings are never counted. **No money outside Finance** — operational
  reports load no prices. Periods come from `reports/period.ts`, each
  compared with the one before; CSVs go through `lib/csv.ts`, which guards
  against spreadsheet formulas. Charts are in `components/ops/charts/`: one
  series colour (`viz`), a hover read-out on every mark (`data-tip-value`)
  and the numbers as a table too.
- **Driver Pay** (`/admin/driver-pay`, Owner and Accounts): what each driver
  is owed for completed and PNS bookings — the driver price on each, less
  cash a passenger paid them — up to any chosen day. A `driver-payments` row
  covers a set of bookings; its collection hook works out the lines and
  totals from the bookings (typed amounts are ignored) and refuses a booking
  already paid, unpriced or someone else's. Payments are never edited or
  deleted, only voided with a reason, which frees their bookings. Each has a
  PDF statement (`domain/finance/statement-pdf.ts`, pdf-lib, standard
  fonts) and a signed, expiring link for the driver
  (`domain/finance/statement-link.ts`, `/api/statements/<token>`), sent with
  the WhatsApp note. Not an invoice or a payslip — drivers are independent.
- **Supplier Money** (`/admin/supplier-money`, Owner and Accounts): what each
  partner owes — the booking price for completed, PNS, and cancelled
  bookings the office marks "partner pays" (`jobs.cancellationCharge`; every
  cancelled partner booking waits for that decision). Money received
  (`supplier-payments`) and invoices (`supplier-invoices`) cover chosen
  bookings; the collections work out lines and totals
  (`collections/hooks/partner-lines.ts`), one receipt and one invoice per
  booking at a time, voided never edited. Invoices are made only by hand and
  never sent by the system (Cityline, 6 Oct 2026): PDF
  (`domain/finance/invoice-pdf.ts`), full company name, no VAT (not
  registered), due on the partner's terms; the office marks them sent.
- **Payments** (`/admin/payments`, Owner and Accounts): money in from
  customers. Website card payments come from the Stripe webhook; Stripe's
  fee is read from the charge's balance transaction
  (`domain/payments/card-fee.ts`) straight after the booking, on
  `charge.updated`, or by "Get card fees from Stripe" — `feeRecordedAt` empty
  means not known yet, never £0 — and shared across the booking's journeys
  (`splitPence`). Office bookings paid by card link, bank transfer or on
  account are marked paid by hand (`customer-payments`, "CP-"; lines from the
  bookings, one payment per booking, optional card fee shared onto
  `jobs.paymentFeePence`); the unpaid ones are listed. Cash is Driver Pay's,
  partners are Supplier Money's.
- **Refunds** (`/admin/refunds`, Owner and Accounts): never issued from the
  admin — the office refunds in Stripe or by bank, then records it ("RF-")
  against the payment and per booking, never more than was paid for one; a
  Stripe `re_…` id cannot be recorded twice. The webhook does not record
  refunds (Cityline, 6 Oct 2026: by hand). Payments and refunds are voided,
  never edited or deleted; a payment with live refunds cannot be voided.
- **The three rings** on the Owner's and Accounts' dashboard
  (`domain/finance/overview.ts`), for bookings picked up in the chosen dates:
  paid to drivers of what they earned, got from partners of what they owe,
  and profit = booking prices − refunds on them − driver prices − card fees
  − expenses, its ring the margin. A cancelled booking earns nothing, so
  refunding it does not move profit.
- **Expenses** (`/admin/expenses`): Cityline's own costs only — fuel,
  repairs, insurance and licensing are the drivers' (Cityline is a middle man
  taking a commission, 6 Oct 2026). Free-form, entered one by one by the
  Controller and Accounts (`expenses.*`; the Controller's only finance
  capability): date, what for, amount, paid to, how, optional receipt as a
  private file. No categories, nothing recurring; voided, never edited.
- **Daily Run Sheet** (`/admin/reports/run-sheet`, `runSheet` capability):
  one London day, today by default, whole day or by driver; prints one
  driver to a page. The passenger's phone is on it; prices are not — a
  driver's price reaches them only in their day's WhatsApp message
  (`driverDayMessage`, sharing `jobDetailLines` with the single-job one).
- **TfL driver records** (`domain/fleet/driver-record.ts`; regs. 13 and 16
  and TfL's Operator Handbook): name, address, date of birth, National
  Insurance number, copies of the DVLA and PHV licences, a photograph, and
  the dates a driver became and stopped being available. Kept 12 months
  after they stop, so drivers and their documents are never deleted; the
  stop date is required on leaving. A driver stopped for their conduct
  driving a PHV must be reported to TfL within 14 days (form PHV/105). The NI
  number is for those who edit drivers only (field access), not Accounts.
- **Taking a driver off a booking needs a written reason** — removing or
  replacing them. The jobs hook requires it from staff (`takenOffReason`, a
  virtual field never stored on the job) and writes it to the job's history
  with the driver (`job-events.driverTakenOff`, `note`), which the Driver
  Report counts.
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
