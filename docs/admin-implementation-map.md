# Admin platform — implementation map

Written 1 Oct 2026, before any admin code, from an inspection of the
repository at `4afd543`. It maps Cityline's admin specification (the
"Functional + Visual Implementation Specification") against what exists, and
records the architecture decisions the build follows. Update it as phases
land.

## Stack as found

| Part        | Version / state                                                                  |
| ----------- | -------------------------------------------------------------------------------- |
| Next.js     | 16.3.5, App Router, `src/proxy.ts`, standalone output                            |
| React       | 19.2                                                                             |
| Payload CMS | 3.90.2, Postgres adapter, `push: false` (migrations only), admin at `/admin`     |
| Styling     | Tailwind 4 with the site's Material-3 tokens in `src/app/globals.css`, shadcn/ui |
| Tests       | Vitest (334 unit), Playwright (18 e2e, 390px + 1440px)                           |
| Email       | Nuntly (`src/lib/email.ts`)                                                      |
| Payments    | Stripe Checkout Sessions + Payment Element (`src/lib/stripe.ts`)                 |

## Existing collections (all in migrations)

| Collection       | Holds                                              | Access today                           |
| ---------------- | -------------------------------------------------- | -------------------------------------- |
| `users`          | staff; roles owner/controller/accounts/editor      | owner creates/updates; any staff reads |
| `customers`      | website customers                                  | any staff reads/updates; no create     |
| `quotes`         | priced journeys, 30-min expiry                     | read-only for staff                    |
| `bookings`       | website orders, `manageTokenHash`, `priceSnapshot` | any staff reads/updates; no create     |
| `jobs`           | the job register, every source; TfL fields present | **any staff reads/creates/updates**    |
| `job-events`     | append-only job history                            | any staff reads/creates                |
| `payments`       | Stripe payments, fee                               | read-only                              |
| `refunds`        | refund rows (no code writes them yet)              | read-only                              |
| `webhook-events` | idempotency ledger                                 | read-only                              |

Database rules that live only in migrations: partial unique `(booking_id, leg)`;
check `(source = 'website') = (booking_id IS NOT NULL)`; `job_reference_seq`.

Already on `jobs`: status (6 values), `driverPhvNo`, `vehicleReg`,
`takenByUser`/`takenAt`, `dispatchedByUser`/`dispatchedAt`,
`subcontractorName`, `customerPricePence`, `paymentMethod` (includes `cash`
for staff jobs), `paymentFeePence`, `locked`, `isTest`, notes.

## Existing server logic to reuse

- Booking creation: `domain/booking/confirm.ts` (the only place a booking is
  born), `domain/payments/fulfil-checkout.ts`.
- Job references: `domain/jobs/reference.ts` (sequence).
- Manage booking: `domain/booking/manage-booking.ts` (change and cancel with
  `job-events` rows), `manage-rules.ts` (24-hour window, refund terms),
  `manage-token.ts` (magic links).
- Emails: `domain/notifications/booking-emails.ts` +
  `send-booking-notifications.ts` (confirmation, change, cancel, manage link,
  office alerts).
- Time: `lib/time.ts` (`londonToUtc`, `londonDateAndTime`, formatters).
- Money: `domain/money.ts` (integer pence, basis points).
- Booking rules and policies: `domain/booking/rules.ts`, `lib/policies.ts`.
- Rate limits and CSP: `lib/rate-limit.ts`, `lib/csp.ts`.
- Worker with a task registry (no tasks yet): `src/worker`.

## Gaps found during inspection

1. **The site's root layout wraps the admin.** `src/app/layout.tsx` renders
   `<html>` for every route, so Payload's own `<html>` nests inside it — the
   cause of the unreadable admin forms and the React #418 hydration error.
2. **Collection access is "any logged-in staff"** on jobs, bookings,
   customers — no role separation, nothing server-side for finance.
3. **Custom admin views are not auth-guarded by Payload.** `RootPage` skips its
   login redirect for custom views (`isCustomAdminView`), so every custom view
   and server action must check the user and role itself.
4. No drivers, vehicles, documents, suppliers, staff register, audit log,
   finance tables, settings globals.
5. No refund, amendment-with-payment or payment-link code (Refunds collection
   exists, nothing writes it).
6. No two-factor authentication (Payload has none built in). Lockout after 5
   failures is Payload's default and is on.

## Architecture decisions

**One app, Payload underneath.** The operations screens are Payload custom
views under `/admin/*`, registered in `payload.config.ts`. Payload stays the
authentication, data and access-control layer; views read through the Local
API with the staff user and `overrideAccess: false`, so collection access
rules apply to every read and write.

**Our own application shell.** Custom views that are not overrides render
without Payload's template, so they use an `OpsShell` (sidebar, top bar,
mobile tab bar). The same sidebar replaces Payload's nav
(`admin.components.Nav`) so the few remaining built-in screens match.

**Guards everywhere.** `requireStaff(capability)` for views and
`staffAction(capability)` for server actions, both reading one permission
matrix (`domain/staff/permissions.ts`). The same matrix drives navigation
visibility and collection `access` functions — the UI hides, the server
refuses.

**Styling without touching Payload's screens.** `ops.css` imports only
Tailwind's theme and utilities (no preflight), clears Tailwind's default
colour and font tokens (Payload defines `--color-blue-*`, `--font-serif`,
`--font-mono` and they would collide), and defines Cityline's own ops tokens.
Payload's CSS sits in `@layer payload-default`; ours is declared after it, so
it wins without `!important`. A scoped base under `.ops-root` replaces
preflight for our elements only. Admin theme fixed to light.

**Business rules in `src/domain`**, pure where possible, unit-tested:
status transitions, eligibility, duplicate checks, finance formulas. Hooks on
collections enforce them for any write path, not just our screens.

**Additive migrations only**, reviewed, as today.

## Screens: status

Legend: ✅ exists · 🔧 exists, needs work · ⬜ to build

| Area           | Screen                                                                        | Status                                                        |
| -------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Shell          | Sidebar, top bar, mobile tab bar, role filtering                              | ✅ 1 Oct                                                      |
| Dashboard      | Owner / Controller / Accounts / Editor                                        | ✅ 1 Oct; compliance and message alerts wait on those screens |
| Operations     | Jobs list / day / week, filters, search                                       | ✅ 1 Oct; supplier and driver filters wait on those records   |
|                | Job detail workspace + timeline                                               | ✅ 1 Oct; read-only plus resend manage link                   |
|                | Create job, return trip, duplicate checks                                     | ⬜                                                            |
|                | Dispatch board, assign driver                                                 | ⬜                                                            |
|                | Bookings, customers, quotes                                                   | 🔧 raw Payload                                                |
|                | Amend booking, refunds, payment links                                         | ⬜                                                            |
| Fleet          | Drivers, vehicles, documents, compliance, suppliers                           | ⬜                                                            |
| Messaging      | Send on WhatsApp (prefilled), passenger details                               | ⬜                                                            |
| Alerts         | Notification centre                                                           | ⬜                                                            |
| Finance        | Job finance, costs, driver pay, statements, supplier money, expenses, reports | ⬜                                                            |
| Reports        | TfL register, run sheet, jobs/driver/vehicle/supplier reports                 | ⬜                                                            |
| Administration | Staff + 2FA, audit log, booking rules, company details                        | ⬜                                                            |
|                | Prices & catalogue                                                            | ⬜ (needs real price tables)                                  |
|                | Media / content                                                               | ⬜                                                            |

## Server-side rules: status

| Rule                                                 | Status                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| Website bookings cannot be created by hand           | ✅ bookings `create: false`; ⬜ jobs `source = website` from staff |
| Job source immutable                                 | 🔧 admin read-only only; ⬜ server hook                            |
| Protected website job fields                         | ⬜                                                                 |
| Status transitions valid, timestamped, attributed    | ⬜                                                                 |
| Expired driver / vehicle / wrong class cannot assign | ⬜                                                                 |
| Supplier reference unique per supplier               | ⬜                                                                 |
| Refunds staff-only, audited                          | ⬜                                                                 |
| Role permissions server-side                         | ✅ 1 Oct — matrix on every collection, view and action             |
| Bank details owner-only                              | ⬜                                                                 |
| Test bookings out of reports / TfL export            | ✅ `isTest` exists; ⬜ in queries                                  |
| Audit record for important mutations                 | 🔧 `job-events` for customer changes; ⬜ general audit log         |

## Build order

Phase 1 (foundation) landed on 1 Oct 2026, with the jobs register and job detail from phase 2.

1. **Foundation** — root layout split; permission matrix and role-based access;
   ops styling, shell and components; guarded dashboard.
2. **Jobs** — list/day/week with server-side filters and search; job detail
   and timeline; status transitions.
3. **Fleet and compliance** — drivers, vehicles, documents (private files),
   suppliers, compliance dashboard, expiry rules.
4. **Dispatch** — create job, duplicates, return trip; assign with
   eligibility; dispatch board; Send on WhatsApp; passenger driver details.
5. **Website bookings** — bookings screens, refunds, amend with payment
   link or partial refund, resend manage link.
6. **Records** — TfL register, run sheet, audit log, alerts centre.
7. **Staff** — staff screen, 2FA, staff register (CMP-06).
8. **Finance** — job finance and costs, driver pay rules, statements,
   supplier money, expenses, reports, encrypted bank details.
9. **Settings** — booking rules, company details, then prices and catalogue
   when the real price tables arrive; media.

Not built, by decision: flight tracking, cash for website bookings, a driver
app, GPS, automatic allocation.
