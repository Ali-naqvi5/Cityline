# Progress

Where the build actually stands. Read this before starting work; update it
before finishing.

**Last updated:** 29 September 2026

Related: [`CLAUDE.md`](../CLAUDE.md) (rules), [`design-deviations.md`](design-deviations.md)
(why the build differs from the designs), [`runbook-vps.md`](runbook-vps.md)
(the server half of Sprint 0), [`cityline-platform-spec-v6.html`](cityline-platform-spec-v6.html)
(the source of truth).

---

## At a glance

| Check                   | State                                 |
| ----------------------- | ------------------------------------- |
| `pnpm typecheck`        | passing                               |
| `pnpm lint`             | passing                               |
| `pnpm format:check`     | passing                               |
| `pnpm check:compliance` | passing — 186 files, wording + claims |
| `pnpm check:migrations` | passing — 2 migrations, additive only |
| `pnpm test`             | passing — 334 tests across 25 files   |
| `pnpm build`            | passing                               |
| `pnpm e2e`              | passing — 18 tests, 390px and 1440px  |

History is on GitHub (`Ali-naqvi5/Cityline`, branch `main`). Pushing `main`
deploys to production — there is no staging (see below).

---

## Sprint status against the plan (§15)

| Sprint | Scope                           | State                                                                            |
| ------ | ------------------------------- | -------------------------------------------------------------------------------- |
| S0     | Server, foundations, CI, gate   | **Local half done.** VPS half not started — needs the IONOS account              |
| S1     | Design → component library      | **Done** from the Stitch exports                                                 |
| S2     | Places, zones, pricing engine   | **Not started** — blocked on the launch price tables                             |
| S3     | Quote, steps 1–2                | Steps 1–2 built on placeholder fares; `/quote` and Places autocomplete not built |
| S4     | Steps 3–4, Stripe, confirmation | **Done in test mode.** Card payments through Stripe; live keys still to come     |
| S5+    | Manage booking, pages, admin    | Manage booking, emails, help and legal pages built; **admin not started**        |

The build ran ahead of S2, so **every fare on the site is a placeholder**. The
funnel has four working screens standing on invented numbers.

---

## What exists

### Routes

```
/                    home
/airports            hub for all six London airports
/airports/[airport]  6 static pages: heathrow, gatwick, stansted,
                     luton, london-city, southend
/fleet               fleet
/about               about us (links to the legal pages)
/contact             contact (form disabled until WEB-05)
/fares               how pricing works (CMP-02)
/services            hub + 7 service pages
/seaports            hub + 5 seaport pages
/terms               terms and conditions — solicitor-reviewed
/privacy             privacy policy — solicitor-reviewed
/cookies             cookie policy — solicitor-reviewed
/legal/licensing     TfL licensing, what it means for a passenger
/legal/complaints    complaints procedure — solicitor-reviewed
/faq                 every help FAQ, one FAQPage block
/info/meeting-points every airport and cruise terminal, from the place data
/info/cancellation   cancellations and refunds
/info/payment        paying for a journey
/info/lost-property  lost property
/info/waiting-time   free waiting, from policies
/info/accessibility  step-free and assistance, what we can and cannot do
/luggage-guide       capacities, straight from VEHICLE_CLASSES
/child-seats         seats and prices, straight from EXTRAS
/book                step 1 · journey
/book/vehicle        step 2 · vehicle choice
/book/details        step 3 · passenger details and extras → quotes row
/book/payment        step 4 · review and pay — Stripe Payment Element
/book/return         Stripe's return URL; fulfils, then redirects to the booking
/book/confirmed/[ref]           confirmation; needs ?t=<manage token>
/book/confirmed/[ref]/calendar  .ics download (NOT-01), same guard
/manage              "email me my link" — same reply whether or not it matched
/manage/[ref]        the booking; needs ?t=<manage token> (BK-07)
/manage/[ref]/change date, time, flight, passenger, notes — no fare changes
/manage/[ref]/cancel shows the refund, then cancels
/coming-soon         launch gate target
/api/health          deploy health check
/api/cron            worker tick, called by VPS cron
/api/webhooks/stripe Stripe events, signature-checked; creates bookings
/robots.txt
/sitemap.xml         built from the same constants as the pages; empty while gated
404                  not-found.tsx, a real 404 status
```

### Domain layer (tested, `src/domain/`)

| Module                             | Covers                                                     |
| ---------------------------------- | ---------------------------------------------------------- |
| `money.ts`                         | integer pence, basis points, £1 rounding, VAT-from-gross   |
| `compliance/forbidden-words.ts`    | CMP-01 wording rule; also runs in CI over `src/`           |
| `compliance/unsupported-claims.ts` | claims we will never support — flight tracking             |
| `booking/journey.ts`               | step 1 schema, flight numbers, timing rules (BK-01…BK-05)  |
| `booking/passenger.ts`             | step 3 schema, E.164 phone normalisation, name-board text  |
| `booking/funnel-params.ts`         | the journey in the query string: service mode, legs, party |
| `booking/reference.ts`             | `CL-XXXXXX` booking references                             |
| `booking/quote-session.ts`         | quote token, 30-minute expiry, stored request/results      |
| `booking/load-quote.ts`            | quote by token: missing / expired / ok                     |
| `booking/confirm.ts`               | **the only place a booking is born** (BK-09)               |
| `booking/load-booking.ts`          | booking by reference + magic-link token                    |
| `booking/manage-token.ts`          | magic-link token; only its SHA-256 is stored (BK-07)       |
| `booking/calendar.ts`              | RFC 5545 `.ics` builder (NOT-01)                           |
| `booking/booking-window.ts`        | BK-05 notice, horizon, blackout; the customer's wording    |
| `booking/booking-availability.ts`  | the daily cap, counted per London day, from the database   |
| `booking/manage-rules.ts`          | 24-hour online window, refund terms (BK-07)                |
| `booking/manage-booking.ts`        | change and cancel, with a `job_events` row per field       |
| `notifications/booking-emails.ts`  | every email's subject, HTML and text; escaped              |
| `jobs/reference.ts`                | `J-000001` job references, numeric ordering                |
| `booking/rules.ts`                 | booking rules; moves to the Payload global in S8           |
| `pricing/vehicle-classes.ts`       | the six classes — **placeholder fares**                    |
| `pricing/select-vehicle.ts`        | BK-01 capacity rules, disabled classes                     |
| `pricing/quote.ts`                 | the one fare calculation — **placeholder engine**          |
| `pricing/indicative.ts`            | distance "from" fares for landing pages — **placeholder**  |
| `places/airports.ts`               | the six airports, terminals, FAQs; SEO-01 quality bar      |
| `pricing/extras.ts`                | extras — **placeholder prices**                            |

Also `lib/time.ts` → `londonToUtc`: London wall time to a UTC instant, tested
across both clock-change weekends. Every pickup time goes through it.
`londonDateAndTime` is its inverse, for filling the change form.

In `src/lib/`: `csp.ts` (the two Content Security Policies), `rate-limit.ts`
(token buckets, client IP), `email.ts` (Nuntly), `zod.ts` (Zod, configured
once — import `z` from here; ESLint enforces it).

### Infrastructure

Launch gate (`src/proxy.ts`, Next 16's `proxy.ts` convention), health and cron
endpoints, worker with a task registry, one Dockerfile serving app and worker,
Caddyfile, production and local compose, encrypted backup/restore image, CI and
deploy workflows, deploy script with pre-deploy dump and rollback.

---

## What does not exist yet

### Pages

Not built, and **dropped by Cityline** (29 Sep 2026): `/quote`, the route
pages (`/transfers/…`), terminal pages, the reviews page, the blog and the
other phase-2 pages, a cash option, flight arrival times, a cookie banner and
analytics. Do not build them without asking.

**Every link resolves.** The home page's popular routes now point at the
airport pages, and its corporate and cruise cards at the service pages.

Still to come: the admin panel, real prices (S2), address suggestions (BK-02),
Stripe live mode, and customer accounts.

### The database exists now

Payload CMS 3 with the Postgres adapter, inside this Next.js app. **18 tables**,
created by one reviewed migration (`src/migrations/`), verified from an empty
schema using the bundled runner the VPS will use.

Booking side only: `customers`, `quotes`, `bookings`, `jobs` (+ `jobs_via_stops`,
`jobs_extras`), `job_events`, `payments`, `refunds`, `webhook_events`, `users`.

**Not in the database yet, deliberately:** the catalogue — vehicle classes,
extras, places, routes, tariffs. Those stay as typed constants until S2 brings
real prices. Moving them now would turn the airport, fleet and fares pages from
static HTML into queries, and SEO-02 wants that done with revalidation rather
than as a side-effect.

Still to come from §14: drivers, vehicles, suppliers, finance (S8–S10).

---

## Seams a new session must understand

**The journey schema is written but not wired.** `journeySchema`,
`placeRefSchema` and `checkPickupTiming` are tested and imported by nothing.
The funnel carries pickup and drop-off as **free text** in the URL
(`FunnelParams`), while the domain schema expects structured places with
lat/lng. Closing that gap is BK-02 (Google Places autocomplete) and is the
first real task of S2/S3.

**The price is worked out on the server and stored, but by a placeholder
engine.** Step 3's action runs `quoteFor`, writes the result to the `quotes`
row, and step 4 charges what the row says — never anything the browser sends.
Quotes expire after 30 minutes and step 4 shows §7's expired screen. BK-08's
mechanics are met; its _numbers_ are not, until S2 brings real prices.

**Step 1 does no server-side validation.** It is a plain
`<form method="get">` with HTML5 `required` only.

**The funnel handles two service modes**, `route` and `hourly`, end to end:
quote widget → step 1 → vehicle → details → payment. A return journey carries
its own pickup, drop-off, stops, date, time and party, defaulting to the
outbound reversed, and the vehicle is sized to the busiest leg.

**Step 3 → 4 hands over through a `quotes` row.** Only an opaque 43-character
token travels in the URL (`/book/payment?q=…`); the journey, the passenger and
the price live in the row. Personal data never travels in a URL — see
deviation 17. The site sets no cookies for customers at all now, and the
privacy and cookie policies say so.

**Card payments go through Stripe (PAY-01), in test mode.** The route the
Stripe planner and best-practices skill recommend for an embedded form: the
Payment Element backed by a **Checkout Session** (`ui_mode: "elements"`),
fulfilled from a signature-checked webhook.

- Step 4 creates one Checkout Session per quote, from the stored quote only
  (`domain/payments/checkout-session.ts`), with an idempotency key and a
  deterministic expiry so a reload or a second tab gets the _same_ session. The
  session id is kept on `quotes.stripe_checkout_session_id`.
- No `payment_method_types`: which methods show (cards, Apple Pay, Google Pay,
  Link…) is Dashboard configuration.
- Stripe sends the customer to `/book/return`, which runs the same fulfilment as
  the webhook (`/api/webhooks/stripe`) — Stripe recommends both, because
  webhooks can lag. Both call `fulfilCheckoutSession`, which re-reads the
  session from Stripe with the secret key and fulfils only when
  `payment_status` is not `unpaid`.
- Pressing Back after paying lands on the booking, never on a "pay again"
  screen (`loadQuote` has a `booked` state for this).
- Verified end to end in Chrome against Stripe's sandbox, with `stripe listen`
  forwarding real events: a £136 return booking produced one booking, two jobs,
  one payment and a processed webhook, with the webhook and return page racing;
  a declined test card showed Stripe's reason and booked nothing.

**A booking is born in exactly one place: `confirmBooking`**
(`src/domain/booking/confirm.ts`), reached only through
`fulfilCheckoutSession`. It writes the payment row first inside the
transaction; the unique index on `stripe_payment_intent_id` is what makes the
webhook and the return page safe to run at the same instant — the loser rolls
back and its retry finds the booking. It no longer rejects an expired quote:
BK-08's limit is enforced before a session is created, and by the time this runs
the customer has paid.

**Job references come from a Postgres sequence** (`job_reference_seq`, second
migration). The old read-highest-then-retry could never have worked: a unique
violation aborts the Postgres transaction, so the retry failed too.

**Booking links are derived, not random.** `manageTokenFor(reference)` is an
HMAC under a key derived from `PAYLOAD_SECRET`, and the booking stores its hash.
Whichever of the webhook or the return page creates the booking, both can
produce the same link — the confirmation email will need that. Rotating
`PAYLOAD_SECRET` withdraws every link.

**The confirmation page needs the magic-link token, not just the reference.**
`CL-7K4Q2P` is read down the phone and printed on receipts, so it is not a
secret. `/book/confirmed/[ref]?t=…` checks the token against the SHA-256 on the
booking; a wrong token and an unknown reference show the same screen, so the
page cannot be used to discover which references exist. The page sends no
referrer, because the URL carries the token.

**`server-only` resolves only inside Next.** It is aliased by Next's bundler
and is not in `node_modules`, so a `tsx` script importing `confirm.ts`,
`load-quote.ts` or `load-booking.ts` fails with `ERR_MODULE_NOT_FOUND`. Map it
to an empty module with a throwaway tsconfig `paths` entry when scripting.

**Manage booking (BK-07) is online up to 24 hours before the next pickup.**
`manage-rules.ts` decides; the page, both forms and both server actions all
ask it. Inside 24 hours the page shows the phone number instead. Online
changes are only the ones that cannot change the fare — date and time, flight,
passenger name and phone, notes. **No money moves online**: cancelling shows
the refund (full at 24 hours or more; partial inside, at
`policies.lateCancellationRefundPercent`, which is `null` until Cityline sets
it) and the office makes it. Every changed field writes a `job_events` row
(`actor_type = customer`), in the same transaction as the change.

**Emails go through Nuntly** (`lib/email.ts`, REST, with an idempotency key on
every send). Confirmation (with the `.ics`), change, cancellation and "your
link" go to the customer; a copy of each goes to `OFFICE_ALERT_EMAIL`. **Until
launch, customer emails are redirected to the office** (`CUSTOMER_EMAILS`
defaults to `staff-only`; set `live` to send to customers). A failed send is
logged and never blocks the booking — and never retried, so today the office
can miss a booking if Nuntly is down. The admin panel is the real safety net.

**Booking rules (BK-05) are enforced on the server** at steps 2, 3 and 4, in
whole minutes: with 3 hours' notice, 15:00 is bookable at 12:00 and 14:59 is
not. The daily cap counts pickups per London day.

**Test bookings are tagged.** Stripe's `livemode` sets `is_test` on the booking,
its jobs, and a customer the booking created.

**Two Content Security Policies** (`lib/csp.ts`, set in `proxy.ts`). `/book`
and `/manage` get a per-request nonce with `'strict-dynamic'`; their layouts
call `connection()` so every page there renders per request, which a nonce
needs. Every other page stays static, with inline scripts allowed. Both allow
Stripe, because a customer who clicks through from the home page pays under the
home page's policy. `/admin` and `/api` get none. A new third-party script,
frame or API needs its origins added there, or the browser blocks it.

**Rate limits** (`lib/rate-limit.ts`, `lib/request-limit.ts`): quotes, payment
page views (each a Stripe call), "email me the link", and changes and
cancellations. In memory — correct for one app container only
(`runbook-vps.md` §12). Admin login is Payload's: 5 failures lock the account
for 10 minutes.

**Destructive migration commands are blocked** (`migrate:fresh`, `reset`,
`refresh`, `down`) through Payload's `bin` option. Override for a real need:
`ALLOW_DESTRUCTIVE_MIGRATIONS=yes`.

**The worker has a task registry with no tasks registered.** Handlers land in
S4, S8 and S9.

**Fares come from one function.** `quoteFor` in `src/domain/pricing/quote.ts`
is the only place that decides what a journey costs; steps 2, 3 and 4 all read
it. It is still a placeholder engine — the real one (§7) lands in S2 and
replaces its body without changing its shape. Do not reintroduce per-screen
arithmetic: that is how step 4 came to promise "this total covers both
journeys" while charging for one.

**The legal pages are solicitor-reviewed** (Cityline confirmed, 29 Sep 2026),
so the draft notices are gone. `src/content/legal.ts` carries them. Every
figure in them is read from `policies`/`company`, so they cannot drift from
what the booking pages promise — but a wording change is a change to the
customer agreement, and goes back to the solicitor.

**Date and time use shadcn/ui, not native inputs.** `src/components/ui/`
`calendar.tsx` + `date-time-picker.tsx`. Native pickers follow the _browser's_
locale, so a US-configured browser showed `mm/dd/yyyy` on a UK site — a real
risk of someone booking the wrong day. These always render `Tue, 15 Sept 2026`
and submit ISO through a hidden input, so the funnel is unchanged.

**shadcn's tokens are mapped onto ours** in `globals.css` (`--primary`,
`--popover`, `--border` …). A component pulled from the registry comes out in
brand colours with no edits. `shadcn init` had overridden the theme with grey
tokens and the Geist font; that is undone — do not re-run `init`.

**Place guides are one template, not eleven pages.** `PlaceGuidePage` renders
any `PlaceGuide` — the six airports and five seaports today, stations and areas
later. Adding a place is a data file; adding a _kind_ of place is a few lines
of config. `meetsQualityBar` in `domain/places/types.ts` enforces SEO-01 on
every one of them at render time.

**Station transfers is one page, not nine.** §5 makes the same call for areas
("one page, not nine near-identical ones"). Nine pages differing only by a
station name is the thin-content pattern the spec names as the main SEO risk
in this plan. A test guards it.

**Flight tracking is banned permanently, and enforced.** Cityline confirmed on
22 Sep 2026 that it will never be built. `/info/flight-monitoring` is gone from
the navigation, and `domain/compliance/unsupported-claims.ts` now fails the
build on the designs' phrasing ("we monitor your flight via live radar",
"arrival time adjusts automatically", "Flight Delay Protection"). The guard
exists because seven design pages promise it and several are still to be
ported. Denials are allowed — the site can say it does _not_ do this.

**The navbar is Home · Services · Fleet · Fares · Contact us · About us.**
"Airports" was removed as a top-level entry — every airport is reachable
through Services → Airport transfers, and a second route to the same six pages
only split the click. `airportsNav` and `seaportsNav` are now their own exports
in `lib/navigation.ts`, because the footer columns read them directly and would
otherwise have broken when the header entry went.

**Second-level menus reveal on hover and navigate on click.** "Airport
transfers" is one link, not a link plus a chevron button. Hover or focus opens
the flyout; clicking goes to the service page. Hover does not exist on touch,
which is fine because this menu only renders at `lg` and above — `MobileNav`
lists all three levels inline below that.

**"Help" was removed from the navigation.** It pointed at `/faq`, a second
place to ask the same question Contact answers, and SEO-07 wants exactly one
canonical contact page.

**There is no staging environment.** Cityline's decision (28 Sep 2026):
pushing to `main` deploys straight to production, departing from the spec's
PRD-01. Because of that, `deploy.yml` now _calls_ `ci.yml` as a reusable
workflow and will not build or deploy unless every check passes — with no
staging, CI is the only thing between a bad commit and the live site. The
staging site block is gone from the Caddyfile, compose and the DNS table.

**Help pages read their facts from data, never from typed-in copy.** Luggage is
`VEHICLE_CLASSES`, child seats are `EXTRAS`, meeting points are each terminal's
`meetingPoint`, and every time limit or percentage is `policies`. The FAQs live
in `src/content/help-faqs.ts` so `/faq` and each help page show the same answer.
Complaint timings and record retention moved into `policies` too, and the terms
now read them.

**The sitemap applies SEO-01 itself.** Airport and seaport guides that fail the
quality bar are left out, using the same `placeInternalLinkCount` helper the
pages use, so the page's `noindex` and the sitemap cannot disagree.

---

## Conventions in force

- Money is integer pence; percentages basis points; times UTC, shown Europe/London.
- Tokens live in `src/app/globals.css`, using Stitch's Material 3 token names so
  markup copied from the exports translates one-to-one. No component hard-codes
  a colour.
- Icons are `lucide-react`, not Material Symbols (deviation 8).
- Inter is self-hosted by `next/font` — no runtime request to Google (CMP-11).
- `design/` is tracked in git on purpose: it is the source of truth for how the
  site looks, and the deviations doc can only be audited against it. It is
  excluded from the Docker build context instead.

---

## Known issues and traps

**Native binding after a dependency change.** `pnpm add`/`remove` can drop
vitest's platform binding, and `pnpm install` will report "Already up to date".
Fix: `pnpm install --force`. Documented in `CLAUDE.md`; it has cost an hour
twice.

**Content-Security-Policy** is in place — see `src/lib/csp.ts` and the
29 Sep 2026 entry below. The `Permissions-Policy` in `next.config.ts` names
Stripe's origins for `payment` — without that, Apple Pay and Google Pay never
appear in Stripe's iframe.

**Testing payments locally** needs Docker (Postgres), a production build
(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is baked in at build time) and
`stripe listen --forward-to localhost:3000/api/webhooks/stripe`, whose printed
`whsec_…` goes in `.env.local`. Test card `4242 4242 4242 4242`.

**`next dev` is safe against the local database** now that schema push is off
(`push: false`, 29 Sep 2026). Payload's docs suggest keeping push on against a
throwaway sandbox database instead. That was checked and rejected: three parts
of the schema exist only in migrations (the partial unique index, the check
constraint, `job_reference_seq`), Payload's schema hooks cannot declare a
sequence, and declaring the index there would make the next generated
migration re-create it. So every database is migration-only; after changing a
collection, `pnpm migrate:create <name>` then `pnpm migrate`.

**Playwright clicks mid-scroll miss.** The site scrolls smoothly, so a click
issued while Playwright scrolls a button into view lands where the button was.
Scroll first, wait, then click. Not a customer-facing problem.

**Stripe.js sees the step 4 URL**, including the `?q=` quote token, as part of
Stripe's fraud signals. Stripe is the payment processor, so this is expected,
but the token is a bearer credential for that quote.

**Nuntly will not send until `citylineairporttransfers.com` is verified** in
the Nuntly dashboard (DNS records). Until then every send fails with
"domain … is not verified"; bookings are unaffected. Nuntly also answers a
_repeat_ of a failed send (same idempotency key, within 24 hours) with
422 "The response is invalid" rather than retrying it.

**Stripe's Payment Element resists automation** (Stripe says so, and loads an
invisible hCaptcha). `pnpm e2e` stops at the payment page; take a test payment
by hand before a release: card `4242 4242 4242 4242`, and
`4000 0025 0000 3155` for 3D Secure.

**Dates in the funnel's summaries are ISO** (`2026-10-01 at 10:30`) at steps 2
to 4, where every other page reads `Thu, 1 Oct 2026`.

**The admin shows a React hydration error (#418)** in the browser console.
Payload's own screen, not ours; to look at with the admin work.

**`design/brand/Loader.json`** is a Lottie file, but not a vector one: three
720×405 raster frames at 15fps, 0.2s total, no loop. As delivered it would
flash once and stop. Its intended use has not been confirmed.

---

## Waiting on Cityline

| Needed for | Item                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| S2         | **Launch price tables** — fixed fares per class, per-mile tariff, surcharges, extras. The main blocker      |
| S3         | Google Maps keys (Places autocomplete, BK-02)                                                               |
| Launch     | Stripe live activation, restricted live key, live webhook endpoint, Apple Pay domain — `runbook-vps.md` §10 |
| Launch     | Fix the website on the Stripe profile: it reads `citylineariporttransfers.com`                              |
| S4–S6      | Company number, VAT status (decides how prices display)                                                     |
| S6         | Page copy for the phase-1 pages, meeting point text per terminal                                            |
| Launch     | Verify `citylineairporttransfers.com` in Nuntly, or name another verified sending address                   |
| Launch     | The late-cancellation refund percentage (`policies.lateCancellationRefundPercent`)                          |
| S6         | Whether to show the operator licence number: hidden on request, but CMP-09 expects it (`/legal/licensing`)  |
| S0 (VPS)   | IONOS VPS purchase — see `runbook-vps.md`                                                                   |
| S9         | Meta Business + a new phone number for WhatsApp — long lead time                                            |

Placeholders currently in the build are listed in `design-deviations.md` §11.

---

## Suggested next steps

1. **The admin panel** — bookings and jobs for the office, refunds, dispatch.
   The emails and manage booking are waiting on it to be the safety net.
2. **Verify the Nuntly domain**, then set `CUSTOMER_EMAILS=live` at launch.
3. S2 proper, once the price tables land; BK-02 address suggestions with the
   Google keys.
4. Stripe live mode — `runbook-vps.md` §10.
