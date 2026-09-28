# Progress

Where the build actually stands. Read this before starting work; update it
before finishing.

**Last updated:** 28 September 2026

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
| `pnpm check:compliance` | passing — 92 files, wording + claims  |
| `pnpm test`             | passing — 210 tests across 14 files   |
| `pnpm build`            | passing                               |
| `pnpm e2e`              | off until S3 (browsers not installed) |

**Nothing is committed yet.** The only commit is the Create Next App scaffold.
Everything described below lives in the working tree.

---

## Sprint status against the plan (§15)

| Sprint | Scope                           | State                                                                            |
| ------ | ------------------------------- | -------------------------------------------------------------------------------- |
| S0     | Server, foundations, CI, gate   | **Local half done.** VPS half not started — needs the IONOS account              |
| S1     | Design → component library      | **Done** from the Stitch exports                                                 |
| S2     | Places, zones, pricing engine   | **Not started** — blocked on the launch price tables                             |
| S3     | Quote, steps 1–2                | Steps 1–2 built on placeholder fares; `/quote` and Places autocomplete not built |
| S4     | Steps 3–4, Stripe, confirmation | Steps 3–4 built; Stripe not wired; confirmation page not built                   |
| S5+    | Manage booking, pages, admin    | Not started                                                                      |

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
/terms               terms and conditions — DRAFT, unreviewed
/privacy             privacy policy — DRAFT, unreviewed
/book                step 1 · journey
/book/vehicle        step 2 · vehicle choice
/book/details        step 3 · passenger details and extras
/book/payment        step 4 · review and pay (no Stripe yet)
/coming-soon         launch gate target
/api/health          deploy health check
/api/cron            worker tick, called by VPS cron
/robots.txt
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
| `booking/rules.ts`                 | booking rules; moves to the Payload global in S8           |
| `pricing/vehicle-classes.ts`       | the six classes — **placeholder fares**                    |
| `pricing/select-vehicle.ts`        | BK-01 capacity rules, disabled classes                     |
| `pricing/quote.ts`                 | the one fare calculation — **placeholder engine**          |
| `pricing/indicative.ts`            | distance "from" fares for landing pages — **placeholder**  |
| `places/airports.ts`               | the six airports, terminals, FAQs; SEO-01 quality bar      |
| `pricing/extras.ts`                | extras — **placeholder prices**                            |

### Infrastructure

Launch gate (`src/proxy.ts`, Next 16's `proxy.ts` convention), health and cron
endpoints, worker with a task registry, one Dockerfile serving app and worker,
Caddyfile, production and local compose, encrypted backup/restore image, CI and
deploy workflows, deploy script with pre-deploy dump and rollback.

---

## What does not exist yet

### Pages — 16 of 22 designs built, plus 13 not in the design set

Built: home, fleet, booking steps 1–4, airports hub + 6 airports, about,
terms, privacy, fares, contact, services hub + 7 services, seaports hub +
5 seaports.

Not built: **confirmation** (closes the funnel), manage-booking lookup and
detail, the route page, reviews, help centre, help article, meeting points,
blog index, article.

Also missing: `not-found.tsx`, `sitemap.ts`, `/quote`.

**21 of the 47 link targets in the header, footer and home page are 404s**
(was 35). What remains is the footer's help and information pages
(`/info/*`, `/luggage-guide`, `/child-seats`, `/faq`), the phase-2 pages
(`/blog`, `/reviews`, `/drive-with-us`), two legal pages, and the six
`/transfers/*` route pages the home page links to.

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

**No server-side price recalculation exists**, because there is no pricing
engine. BK-08 is unmet. Nothing may go live until it is.

**Step 1 does no server-side validation.** It is a plain
`<form method="get">` with HTML5 `required` only.

**The funnel handles two service modes**, `route` and `hourly`, end to end:
quote widget → step 1 → vehicle → details → payment. A return journey carries
its own pickup, drop-off, stops, date, time and party, defaulting to the
outbound reversed, and the vehicle is sized to the busiest leg.

**Step 3 → 4 hands over through an httpOnly cookie** scoped to `/book`, holding
the passenger details. Interim: it becomes a quote token once the `quotes`
table exists. Personal data deliberately never travels in the URL — see
deviation 17.

**The worker has a task registry with no tasks registered.** Handlers land in
S4, S8 and S9.

**Fares come from one function.** `quoteFor` in `src/domain/pricing/quote.ts`
is the only place that decides what a journey costs; steps 2, 3 and 4 all read
it. It is still a placeholder engine — the real one (§7) lands in S2 and
replaces its body without changing its shape. Do not reintroduce per-screen
arithmetic: that is how step 4 came to promise "this total covers both
journeys" while charging for one.

**The terms and privacy policy are unreviewed drafts.** `src/content/legal.ts`
carries both, and each page shows a visible "Draft — awaiting solicitor review"
notice. §4 and S7 both require a UK solicitor to review them before launch.
Every figure in them is read from `policies`/`company`, so they cannot drift
from what the booking pages promise. Remove the notice by passing
`draftNotice={false}` once the review is done.

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

**The confirmation route is `/book/confirmed/[ref]`**, per §5 and `CLAUDE.md` —
not `/book/confirmation`. References are `CL-XXXXXX`. NOT-01 requires a
calendar file with the confirmation email.

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

**`pnpm check:compliance` will fail the build on the reviews page copy.** The
design's reviews text contains "in standard app taxis". Cityline has parked the
wording for review; it must be reworded before that page is ported.

**`design/brand/Loader.json`** is a Lottie file, but not a vector one: three
720×405 raster frames at 15fps, 0.2s total, no loop. As delivered it would
flash once and stop. Its intended use has not been confirmed.

---

## Waiting on Cityline

| Needed for | Item                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| S2         | **Launch price tables** — fixed fares per class, per-mile tariff, surcharges, extras. The main blocker |
| S3         | Google Maps keys (Places autocomplete, BK-02)                                                          |
| S4         | Stripe keys — account verification has a long lead time                                                |
| S4–S6      | Real phone number, company number, VAT status (decides how prices display)                             |
| S6         | Page copy for the phase-1 pages, meeting point text per terminal                                       |
| S7         | Solicitor-reviewed T&Cs and privacy policy                                                             |
| S0 (VPS)   | IONOS VPS purchase — see `runbook-vps.md`                                                              |
| S9         | Meta Business + a new phone number for WhatsApp — long lead time                                       |

Placeholders currently in the build are listed in `design-deviations.md` §11.

---

## Suggested next steps

1. **Commit.** 6,100 lines of source and all the documentation sit in one
   working tree with no history.
2. Confirmation page at `/book/confirmed/[ref]`, to close the funnel.
3. `not-found.tsx` with the quote widget (SEO-08), and the legal pages —
   cheapest way to cut into the 41 dead links.
4. S2 proper, once the price tables land.
