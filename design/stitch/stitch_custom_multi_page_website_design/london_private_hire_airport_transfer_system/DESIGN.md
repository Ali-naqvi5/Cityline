---
name: London Private Hire & Airport Transfer System
colors:
  surface: "#effdf2"
  surface-dim: "#cfded3"
  surface-bright: "#effdf2"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#e9f7ec"
  surface-container: "#e3f1e7"
  surface-container-high: "#ddece1"
  surface-container-highest: "#d8e6db"
  on-surface: "#121e18"
  on-surface-variant: "#3f4940"
  inverse-surface: "#27332c"
  inverse-on-surface: "#e6f4e9"
  outline: "#6f7a6f"
  outline-variant: "#bfc9bd"
  surface-tint: "#116c3a"
  primary: "#005128"
  on-primary: "#ffffff"
  primary-container: "#0e6b39"
  on-primary-container: "#94e9aa"
  inverse-primary: "#84d89b"
  secondary: "#016e21"
  on-secondary: "#ffffff"
  secondary-container: "#99f899"
  on-secondary-container: "#0f7427"
  tertiary: "#005029"
  on-tertiary: "#ffffff"
  tertiary-container: "#006b39"
  on-tertiary-container: "#78eda0"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#a0f5b5"
  primary-fixed-dim: "#84d89b"
  on-primary-fixed: "#00210d"
  on-primary-fixed-variant: "#005229"
  secondary-fixed: "#99f899"
  secondary-fixed-dim: "#7edb7f"
  on-secondary-fixed: "#002105"
  on-secondary-fixed-variant: "#005316"
  tertiary-fixed: "#85faac"
  tertiary-fixed-dim: "#69dd92"
  on-tertiary-fixed: "#00210e"
  on-tertiary-fixed-variant: "#00522a"
  background: "#effdf2"
  on-background: "#121e18"
  surface-variant: "#d8e6db"
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: "700"
    lineHeight: 56px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: "700"
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: "700"
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: "700"
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: "600"
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 28px
    letterSpacing: 0em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "600"
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 28px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: "400"
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "600"
    lineHeight: 16px
    letterSpacing: 0.03em
  pricing-display:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: "700"
    lineHeight: 32px
    letterSpacing: -0.02em
  pricing-tabular:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "600"
    lineHeight: 24px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  gutter-mobile: 1rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  space-3xl: 4.5rem
---

## Brand & Style

This design system establishes a premium, authoritative, and dependable presence for a Transport for London (TfL)-licensed private hire airport transfer service. The visual tone aligns with executive travel, punctuality, and understated British refinement. It avoids gimmicks, loud startup trends, and superfluous decorative styling in favor of crisp utility, institutional trust, and seamless booking flows.

The design philosophy adheres to **Corporate / Modern** principles:

- **Calm, High-Reliability Palette:** Deep forest greens paired with subtle environmental tints evoke reassurance, regulatory compliance, and prestige.
- **Precision Utility:** Information architecture prioritizes clarity: fixed pricing, flight monitoring disclaimers, vehicle capacities, luggage limits, and exact pickup times.
- **Strictly Grounded Visuals:** No glassmorphism, no neo-brutalism, no heavy dropshadows, and strictly no dark mode. Every element rests cleanly on structural white (#FFFFFF) or soft botanical washes (#F2FBF3).

## Colors

The color system is rigorously structured around clarity, legibility, and brand trust:

- **Primary Actions & Emphasized Icons (`#0E6B39`):** Reserved strictly for primary call-to-actions, core confirmations, active states, and focal iconography.
- **Hover & Interaction State (`#1E9E5A`):** Used exclusively for interactive hover states across buttons, active tab indicators, and primary links.
- **Signature Accent (`#90EE90`):** Decorative only. Utilized solely for badge surfaces, subtle indicator backdrops, notification dots, and decorative visual anchors. _Rule:_ Never place white text on `#90EE90`. Always set type on this tint to near-black (`#0F1A14`) or deep green (`#0E6B39`).
- **Headings & Core Contrast (`#0F1A14`):** An authoritative deep charcoal-green used for all primary page titles, section headers, pricing numerals, and essential data labels.
- **Body & Secondary Copy (`#47544C`):** A balanced muted slate-forest tone optimized for high readability across paragraphs, auxiliary vehicle specifications, and booking field labels.
- **Page Foundation (`#FFFFFF`):** Crisp pure white canvas for the primary background and elevated vehicle cards.
- **Section Wash & Input Fill (`#F2FBF3`):** Soft, soothing green wash used for alternating full-width landing sections, summary panels, and input background fills.
- **Structural Borders (`#DDE8DF`):** Soft, low-contrast boundary lines providing crisp component separation without visual clutter.

## Typography

The design system exclusively utilizes **Inter** across all typographic applications to deliver clean, neutral, and authoritative British transport communications.

### Tabular Numerals Requirement

All pricing values (£ GBP), flight numbers, pickup/arrival timestamps, passenger counts, and luggage capacities must have the OpenType tabular numbers feature explicitly activated (`font-feature-settings: "tnum" 1, "cv05" 1;`). This prevents layout shifts across dynamic booking selectors, flight countdowns, and tariff comparison tables.

### Type Hierarchy Guidance

- **`display-hero` / `headline-lg`:** Used for primary landing page value propositions ("London Airport Transfers Made Effortless").
- **`headline-md` & `headline-sm`:** Applied to vehicle fleet classes (e.g., Executive Saloon, First Class, MPV-8) and booking step titles.
- **`pricing-display` & `pricing-tabular`:** Always rendered in near-black (`#0F1A14`) with tabular figures enabled. Never set prices in pale or muted tones.
- **`label-sm`:** Employed for uppercase meta-tags, licensing declarations (e.g., "TFL LICENSED OPERATOR"), and badge descriptors.

## Layout & Spacing

### Grid Architecture

- **Desktop Target:** 1440px master viewport.
- **Content Container:** 12-column fixed-max layout centered at `1200px` width.
- **Gutters & Outer Margin:** Desktop columns leverage a `24px` (`1.5rem`) gutter and `32px` (`2rem`) outer margin.
- **Mobile Reflow:** Single column layout below 768px, transitioning through a 4-column structure with `16px` gutters and `16px` side margins.

### Spacing System

The 8pt base layout rhythm dictates all intra-element whitespace:

- `space-xs` (4px): Icon-to-text spacing, micro badges.
- `space-sm` (8px): Input internal vertical padding, inline badge spacing, metadata stack gaps.
- `space-md` (16px): Input field horizontal padding, standard component stacks, card inner mobile padding.
- `space-lg` (24px): Standard card interior padding, grid card spacing.
- `space-xl` (32px): Gap between form rows and sub-sections.
- `space-2xl` (48px): Spacing preceding major section dividers.
- `space-3xl` (72px): Vertical padding defining page section blocks.

## Elevation & Depth

This design system avoids heavy shadows, floating elevations, and frosted glass/glassmorphism entirely. Depth is structured through clean planar layering, distinct border lines, and precise background tone shifts:

- **Base Layer (Level 0):** Pure `#FFFFFF` for primary content or `#F2FBF3` for full-width alternating structural bands.
- **Contained Surface (Level 1):** Cards, car comparison blocks, and booking forms sit on pure `#FFFFFF` backgrounds bounded by 1px solid borders in `#DDE8DF`.
- **Form Surface:** Input fields use the `#F2FBF3` tint as their resting background with a `#DDE8DF` border. Upon receiving focus, the border shifts to `#0E6B39` with a subtle 2px ring at 15% opacity (`rgba(14, 107, 57, 0.15)`).
- **Subtle Ambient Hover:** Only interactive selection cards (such as choosing a vehicle category) possess an elevated hover state: `box-shadow: 0 4px 16px -2px rgba(15, 26, 20, 0.06); border-color: #0E6B39;`.

## Shapes

The interface balances sharp precision with friendly travel ergonomics by utilizing fixed geometric radii across distinct component families:

- **Cards & Input Containers:** Set to strict `12px` (`0.75rem`) corner rounding. This applies to booking modules, car fleet cards, review cards, and route summary sheets.
- **Buttons & Interactive Controls:** Set to `10px` (`0.625rem`) corner rounding. This distinguishes actionable elements from their containing card surfaces.
- **Chips, Badges, and Status Indicators:** Set to `999px` (full pill radius) to create crisp, pill-shaped tags for TfL licensing, meet-and-greet indicators, and flight status pills.
- **Icon Enclosures:** Square or circular icon backdrops use either `8px` or `999px` radius depending on whether they sit inline or as feature badges.

## Components

### Buttons

- **Primary Action:** Background `#0E6B39`, text `#FFFFFF`, border-radius `10px`, padding `14px 24px`. Hover state changes background to `#1E9E5A`. Transition: `background-color 150ms ease`.
- **Secondary Action:** Background `#FFFFFF`, text `#0E6B39`, 1px solid `#DDE8DF`, border-radius `10px`, padding `14px 24px`. Hover state changes background to `#F2FBF3` and border to `#0E6B39`.
- **Ghost / Tertiary Action:** Background transparent, text `#0E6B39`, hover state text `#1E9E5A` with subtle underline.

### Input Fields & Booking Selectors

- **Structure:** Height `48px`, background `#F2FBF3`, border `1px solid #DDE8DF`, border-radius `12px`, padding `0 16px`.
- **Typography:** Body text in `#0F1A14`, placeholder text in `#47544C` (opacity 65%).
- **Focus:** Border transitions to `#0E6B39`, outline `2px solid rgba(14, 107, 57, 0.15)`.
- **Labels:** Set in `label-md` (`#0F1A14`), positioned outside the input with an 8px bottom margin.

### Chips & Badges

- **Status / Feature Chip:** Height `28px`, border-radius `999px`, padding `4px 12px`. Background `#90EE90`, text `#0F1A14` in `label-sm`.
- **Neutral Indicator Chip:** Height `28px`, border-radius `999px`, padding `4px 12px`. Background `#F2FBF3`, border `1px solid #DDE8DF`, text `#47544C`.

### Cards & Fleet Display

- **Container:** Background `#FFFFFF`, border `1px solid #DDE8DF`, border-radius `12px`, padding `24px`.
- **Fleet Card Details:** Includes vehicle graphic, title (`headline-sm`, `#0F1A14`), passenger/luggage icons with counts in tabular figures, price block (`pricing-display` in `#0F1A14` with "fixed fare" caption in `body-sm`), and a full-width Primary Button.

### Checkboxes & Radios

- **Radio Buttons (Journey Type, Payment Options):** 20px circle, `#FFFFFF` fill, `1.5px solid #DDE8DF`. Active state features a `#0E6B39` border with a centered `#0E6B39` solid 10px circular pip.
- **Checkboxes (Flight Monitoring, Child Seat):** 20px square, 4px corner radius, `#FFFFFF` fill. Checked state transitions to `#0E6B39` fill with a sharp white `#FFFFFF` tick icon.

### Flight & Route Summary Banners

- **Strip Layout:** Background `#F2FBF3`, 1px solid `#DDE8DF`, border-radius `12px`, padding `16px 20px`.
- **Contents:** Displays live distance, journey duration, TfL licensed operator assurance icon, and inclusive waiting time disclaimer in `body-md` (`#47544C`).
