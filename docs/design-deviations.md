# Where the build differs from the Stitch designs

The design set in `design/stitch/` is the source of truth for how Cityline's
site looks. This file records every place the build deliberately departs from
it, and why. Anything not listed here should match the design — if it does not,
that is a bug.

Reviewed against the exports dated 20 September 2026 (26 unique page designs,
all sharing the "Premium Transit Utility" system).

---

## 1. No flight tracking anywhere

**Design:** "automated flight monitoring", "we track live radar feeds", "your
chauffeur automatically adjusts for any delays", "Free flight tracking",
"Flight Delay Protection". Present on the home page, booking step 1, the route
page, the help article and the corporate page.

**Build:** none of it, permanently. Cityline confirmed on 20 Sep 2026 that it
would not be implemented, and on **22 Sep 2026 that it will never be** — not
now, not in future. It is out of scope in the project spec's scope rules too.

Customers still give a flight number at booking (BK-03) so the office knows when
to send a driver, and the free waiting time still runs from landing. The site
just never promises that a system is watching the flight.

**This is now enforced, not just documented.**
`src/domain/compliance/unsupported-claims.ts` fails the build on the designs'
phrasing, and `pnpm check:compliance` runs it in CI. That guard exists because
the promise appears on seven design pages and several are still to be ported —
a note in a file does not stop copy arriving with a page; a failing build does.

A promise of automatic delay handling that nobody is monitoring is the kind of
thing that turns one late flight into a complaint, and into a
misleading-advertising problem.

## 2. No operator licence number displayed

**Design:** "TfL PH Operator Lic. #008942/01" in the footer.

**Build:** not shown at all, at Cityline's instruction (20 Sep 2026).

Two separate issues with the design's version. The number was invented —
Cityline's actual operator licence is 11628, and the design also names the
company as "Cityline Transfers Ltd" rather than Cityline Airport Transfers
Limited. Shipping it would have been a licensing misstatement.

**Worth revisiting before launch:** CMP-09 in the project spec lists the
operator licence number among the details that must be shown, and TfL expects
operators to identify their licence in advertising. Set
`company.showOperatorLicence` to `true` in `src/lib/company.ts` to restore it in
the header and footer — nothing else needs to change.

## 3. No invented statistics

**Design:** a stat strip reading "99.4% on-time pickup rate", "150,000+ journeys
completed", "over 4,800 verified passenger journeys", "since 2012".

**Build:** replaced with a strip of claims Cityline has actually confirmed — free
waiting time, no card fees, no surge pricing, the cancellation window.

None of the design's figures came from Cityline. The project spec explicitly
warns about this ("only with real, provable figures"), having found a competitor
advertising a "9% on-time arrivals" rate that reads as a typo and destroys
trust. Publishing unverifiable performance statistics is also a
misleading-advertising risk under consumer protection rules.

Supply real figures and they go straight in.

## 4. No testimonials yet

**Design:** two written passenger testimonials with names and five-star ratings.

**Build:** the section is not rendered.

The testimonials in the design are written specimens, not real customers. WEB-06
requires genuine Google and Trustpilot reviews, rendered server-side. The
section returns once a review source is connected.

## 5. Payment step will not match pixel for pixel

**Design:** booking step 4 shows card number, expiry, security code and
cardholder name as ordinary fields on the page.

**Build:** Stripe's Payment Element, which renders those fields inside an iframe
Stripe controls (PAY-01).

This is not optional. Handling raw card details on our own page would pull
Cityline into a far heavier PCI compliance regime; the Payment Element keeps it
at SAQ-A. The surrounding layout, summary panel and buttons follow the design —
only the card fields themselves are Stripe's.

## 6. Focus ring uses the brand green, not the design's

**Design:** a 3px `#90EE90` focus ring.

**Build:** the same 3px ring with a 2px offset, in `#0e6b39`.

`#90EE90` on a white card is about 1.7:1 contrast. WCAG 2.2 requires 3:1 for
focus indicators, and NFR-05 makes AA a hard requirement. The brand green is
about 6.5:1.

This only shows when navigating by keyboard, so it does not affect how the site
looks to someone using a mouse — but it is what keyboard users rely on to see
where they are on the page.

## 7. Material 3 token values, not the prose palette

The design package describes itself twice and the two do not agree:

|              | DESIGN.md prose | YAML tokens and rendered pages                         |
| ------------ | --------------- | ------------------------------------------------------ |
| Primary      | `#0E6B39`       | `#005128` (`primary`), `#0e6b39` (`primary-container`) |
| Borders      | `#DDE8DF`       | `#bfc9bd`                                              |
| Section tint | `#F2FBF3`       | `#e9f7ec`                                              |
| Body text    | `#47544C`       | `#3f4940`                                              |
| Headings     | `#0F1A14`       | `#121e18`                                              |

**Build:** the YAML tokens, confirmed by Cityline. All 26 rendered pages use
them, so they are what the design actually looks like.

Button hover follows the same rule: the prose names `#1E9E5A`, the markup uses
`secondary` (`#006d3a`), and the markup wins.

## 8. Icons are Lucide, not Material Symbols

**Design:** Google's Material Symbols Outlined, loaded from Google's CDN.

**Build:** `lucide-react`, which ships as tree-shaken inline SVG.

Three reasons. The full Material Symbols variable font is several megabytes,
against a Core Web Vitals target (NFR-01). Loading it from Google's CDN sends
every visitor's IP address to Google on page load, which is a needless
processor relationship for a UK site (CMP-11). And a 1:1 icon match was never
possible anyway — see below.

Lucide is visually close: both are clean, uniform-stroke outline sets.

## 9. The `local_taxi` icon is gone

The design uses Material Symbols' `local_taxi` on seven pages — home, booking
step 2, the Heathrow–Gatwick route page, corporate, the blog index, the article
page and the flight-delays help article. That glyph draws a taxi with a roof
sign.

A TfL private hire operator may not use taxi imagery or wording (CMP-01). Those
are replaced with a plain car icon.

The reviews page also contains the phrase "in standard app taxis" in body copy.
Cityline has parked this for review once the site is up; it will be caught
before it reaches a page, because `pnpm check:compliance` runs in CI and fails
the build on this wording.

## 10. A mobile menu was added

The exports hide the navigation below the `md` breakpoint and show nothing in
its place. The site has to work at 390px (§6), so `MobileNav` is an addition
rather than a port. It follows the design's type and colour tokens.

## 11. Placeholder values still in the build

These are marked in code and must be replaced before launch:

| What                       | Where                                                          | Note                                                                |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| Fares                      | `src/domain/pricing/vehicle-classes.ts`, `src/content/home.ts` | The design's illustrative figures. Real price tables arrive in S2.  |
| Company number, VAT number | `src/lib/company.ts`                                           | Not yet supplied. VAT status also decides how prices display (§17). |

The designs are also inconsistent with themselves on fares: the fleet page shows
a saloon from £48 carrying 4 passengers, while booking step 2 shows a saloon at
£58 carrying 3. The fleet page is used, because it covers all six vehicle
classes. Both are placeholders regardless.

## 12. The logo does not match the design system's palette

Cityline's logo is dark slate (`#344149`) with a light green (`#9CDAA1`). The
design system is deep forest green (`#0e6b39`) on mint (`#effdf2`). They read as
two different brands sitting next to each other in the header.

Cityline has confirmed the logo is correct as supplied, so it stays. Noting it
because it is visible on every page and may be worth revisiting.

The supplied SVG needed work before use: it is an auto-trace of the raster logo
(324 paths, 28 near-duplicate shades) and carried an opaque **black** background
path covering the whole canvas, which would have rendered as a black box. That
path is removed and the file optimised, 229KB to 77KB, in
`public/brand/cityline-logo.svg`. A clean vector from the original artwork would
still be better than a trace.

---

## 13. Step 2: no "Live Availability · Real-Time Dispatch Lock" badge

**Design:** a badge above the vehicle list reading "Live Availability · Real-Time
Dispatch Lock".

**Build:** not rendered.

There is no live availability. Drivers are allocated by hand after a booking is
made (§1 scope rules), so nothing on the page can know whether a vehicle class
is free at that moment. The badge promises a capability the system does not
have, and the first customer who books a minibus that turns out to be
unavailable will remember reading it.

## 14. Step 2: unsuitable vehicles are shown, not hidden

BK-01 says unsuitable classes are disabled. They are rendered greyed out with
the reason ("Too small for your party — holds 2 large cases"), rather than
removed from the list.

Someone travelling with four cases should be able to see that the cheaper saloon
exists and why they cannot have it. Silently removing it makes the estate's
higher price look arbitrary, which reads as a site that quotes high.

A party too large for any single vehicle gets a "let us arrange this for you"
panel with the phone number, rather than a dead end. Twenty passengers needing
two cars is a real booking; it just cannot be priced automatically.

## 15. Step 3: two price contradictions in the designs

Both need settling with the price sheet:

| Item           | Fleet page                                      | Booking step 3                                                                  |
| -------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Child seats    | "Child seats provided complimentary on request" | £10.00 each                                                                     |
| Meet and greet | —                                               | £15.00 extra, while the same page's summary lists it as "£0.00 (Included free)" |

**Build:** meet and greet is **not** offered as a paid extra, because Cityline
has confirmed it is included (`policies.meetAndGreetIncluded`). Charging for
something the home page promises free is how chargebacks start.

Child seats are priced at the step 3 figures for now, since they are
placeholders either way — but the fleet page's "complimentary" wording will need
changing, or the price removing.

## 16. Step 3: two claims reworded

**"E-ticket and VAT receipt sent here"** → "Your booking confirmation and receipt
are sent here." Cityline's VAT status is still open (§17). Promising a VAT
receipt from a business that may not be VAT registered is a claim we cannot
keep.

**"For SMS automated driver arrival notifications"** → "We text you your
driver's name, licence number and vehicle before pickup." The original implies
arrival tracking, which is not being built. What the text actually says is what
CMP-04 requires us to send when a driver is assigned.

## 17. Passenger details never travel in the URL

Steps 1 and 2 carry the journey in the query string, which makes a part-finished
booking shareable and resumable, and the back button behave properly.

Step 3 does not do this with personal data. Name, email and phone are submitted
to a server action and held in an httpOnly cookie scoped to `/book`. A URL
containing a customer's phone number would otherwise end up in browser history,
in `Referer` headers sent to Stripe and Google, in server access logs, and in
any link that customer forwards.

This cookie is an interim. Once the `quotes` table exists (BK-08, S3) the
in-progress booking is stored server-side and the cookie holds only a token.

## 18. Step 4: payment method options

**Design:** three choices — "Credit or Debit Card", "Digital Wallet (Apple Pay /
Google Pay)", and "Accounts — Pay on Arrival (Corporate accounts only)".

**Build:** one payment panel.

Stripe's Payment Element already offers Apple Pay and Google Pay alongside the
card, on the devices that support them, so a separate wallet option would be a
second button leading to the same place.

Pay-on-account is not built: business accounts with invoicing are ACC-02, phase 2. Showing a locked option for something that does not exist yet invites people
to ask for it.

Until Stripe keys are set, the panel says plainly that card payment is not
connected rather than rendering a dead "Pay now" button, and the rest of the
step — fare breakdown, passenger recap, cancellation terms — is complete.
