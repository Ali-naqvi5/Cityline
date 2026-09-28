# Design sources

Cityline's own design files (§6 of the spec). **Nothing here is invented** — the
palette, typography, spacing and component states all come from these files.

## How to hand files over

Save them into `design/stitch/` on this machine:

```
D:\Cityline transfers\cityline-web\design\stitch\
```

That folder is read directly, so there is no limit on how many files go in at
once. No need to attach anything to chat.

## What to export from Google Stitch

**Code, not pictures, wherever Stitch offers it.** Use Stitch's _Copy code_ /
_Export code_ and save as `.html`.

A screenshot means guessing hex values and font sizes by eye; the HTML export
carries the exact values, which is the difference between a build that matches
the design and one that is nearly right everywhere.

If a screen is only available as an image: PNG, one screen per file, 2× scale.
Both is ideal — the code for values, the image for intent.

## Naming

```
NN-screen-name--desktop.html      e.g.  01-home--desktop.html
NN-screen-name--mobile.html       e.g.  01-home--mobile.html
```

Desktop = 1440px, mobile = 390px (§6). If a screen only exists at one width,
send that one — do not skip the screen.

## Batch 1 — send these first (16)

These unblock the whole component library and the booking funnel:

| #   | Screen                                                   | Why it is first                                      |
| --- | -------------------------------------------------------- | ---------------------------------------------------- |
| 01  | Home — desktop                                           | Sets the palette, type scale and header/footer       |
| 02  | Home — mobile                                            | The 390px reference for every other screen           |
| 03  | Booking step 1, route & time — desktop                   | Form fields, the pattern every input follows         |
| 04  | Booking step 1 — mobile                                  |                                                      |
| 05  | Booking step 2, choose vehicle — desktop                 | Cards, prices, disabled states                       |
| 06  | Booking step 2 — mobile                                  |                                                      |
| 07  | Booking step 3, passenger details & extras               | Complex forms, the running total                     |
| 08  | Booking step 4, payment                                  | Stripe Payment Element sits inside this              |
| 09  | Confirmation page                                        |                                                      |
| 10  | A route page, e.g. Heathrow to central London            | The template behind hundreds of pages                |
| 11  | An airport page, e.g. Heathrow                           | Hub layout and terminal links                        |
| 12  | Fleet / vehicle class page                               | Vehicle cards reused in step 2                       |
| 13  | Contact page                                             | Form + the legal footer block (CMP-09)               |
| 14  | 404 page                                                 | Carries a quote widget (SEO-08)                      |
| 15  | Any component / style-guide screen Stitch produced       | Buttons, alerts, empty states in one place           |
| 16  | The quote widget on its own, if it exists as a component | It appears in three forms — hero, inline, sticky bar |

## Batch 2 — after that

Manage booking (view, amend, cancel), a terminal page, a service page, an
information/policy page, FAQ, fares, luggage guide, child seats, about, reviews,
a legal page, the cookie banner, and the four error states from §7: price
changed, quote expired, payment failed, pickup too soon.

## Also useful, any time

- Logo as **SVG** → `design/brand/`
- Vehicle, driver and meeting-point photography → `design/brand/photos/`
- Any written brand guidance (fonts, colour names, tone of voice)

## Constraints the design must respect, whatever it looks like

- No image or wording implying a licensed London taxi (CMP-01).
- The footer legal block: company name, address, phone, operator licence 11628,
  company number, VAT number (CMP-09).
- WCAG 2.2 AA: enough contrast, and a visible focus state on every control.
