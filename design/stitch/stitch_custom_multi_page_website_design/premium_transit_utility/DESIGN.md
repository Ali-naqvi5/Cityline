---
name: Premium Transit Utility
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
  secondary: "#006d3a"
  on-secondary: "#ffffff"
  secondary-container: "#83f7a9"
  on-secondary-container: "#00723d"
  tertiary: "#005116"
  on-tertiary: "#ffffff"
  tertiary-container: "#006c20"
  on-tertiary-container: "#8deb8d"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#a0f5b5"
  primary-fixed-dim: "#84d89b"
  on-primary-fixed: "#00210d"
  on-primary-fixed-variant: "#005229"
  secondary-fixed: "#85faac"
  secondary-fixed-dim: "#69dd92"
  on-secondary-fixed: "#00210e"
  on-secondary-fixed-variant: "#00522a"
  tertiary-fixed: "#99f899"
  tertiary-fixed-dim: "#7edb7f"
  on-tertiary-fixed: "#002105"
  on-tertiary-fixed-variant: "#005316"
  background: "#effdf2"
  on-background: "#121e18"
  surface-variant: "#d8e6db"
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: "600"
    lineHeight: 56px
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: "600"
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: "600"
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: "600"
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: "600"
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 28px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "600"
    lineHeight: 24px
    letterSpacing: -0.005em
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
    letterSpacing: 0.01em
  fare-tabular:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: "600"
    lineHeight: 28px
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
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-desktop: 7.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies the quiet competence, civic reliability, and pristine execution of a premium London municipal infrastructure service. Designed for international business travellers, flight crew, and discerning London residents requiring fixed-rate transit between central postcodes and major hubs (Heathrow, Gatwick, City, Stansted, and Luton), the tone avoids flashy ride-share gimmicks in favour of institutional trust and calm punctuality.

The aesthetic philosophy draws on Modern Corporate and Precision Utility principles:

- **Calm & Measured:** Generous negative space, restrained tonal shifts, and zero visual friction.
- **Civic Trust & Authority:** Inspired by Transport for London standards—structured, accessible, and grounded in transparent information architecture.
- **Functional Luxury:** Polished green accents alongside crisp, high-legibility typographic hierarchies that make quotes, flight tracking, and vehicle selection instantly readable.

## Colors

The palette is engineered for visual serenity and strict accessibility compliance (exceeding WCAG 2.1 AA contrast ratios across all functional elements):

- **Primary Action (`#0E6B39`):** Deep British transport green used strictly for primary call-to-actions, confirmation triggers, active states, and core brand anchors.
- **Action Hover (`#1E9E5A`):** Luminous emerald transition state for active button states, link interactions, and focused controls.
- **Signature Accent (`#90EE90`):** Soft meadow green reserved exclusively for non-text decorative badges, subtle pill fills, status indicator glows, and trajectory graphical marks. It is never used for small text or critical icons.
- **Headings & Structural Text (`#0F1A14`):** Deep slate-black with a faint green undertone, establishing clear, authoritative hierarchy.
- **Body Text & Subtext (`#47544C`):** Calibrated muted slate green, providing optimal reading comfort across journey timetables, vehicle notes, and policies.
- **Section Tint Surface (`#F2FBF3`):** Delicate mint-tinted neutral surface for alternating booking panels, quote summaries, and comparison bandings.
- **Pure Surface (`#FFFFFF`):** Primary canvas background and elevated card base.
- **Structural Borders (`#DDE8DF`):** Subtle outline definition for form inputs, table separators, and container borders.

## Typography

Typography relies uniformly on **Inter** to ensure maximum digital clarity, functional neutrality, and seamless cross-platform rendering.

Key Implementation Principles:

- **Sentence Case Primacy:** All headers, section titles, and action calls adhere strictly to clean sentence case. Avoid all-caps headlines to maintain a welcoming, non-confrontational civic presence.
- **Tabular Numerals (`font-feature-settings: "tnum"`):** Applied systematically across all booking engines, flight departure counters, terminal schedules, vehicle capacities, and currency/fare indicators to ensure precise columnar alignment.
- **Weight Restraint:** Weights are strictly locked to regular (`400`) for descriptive copy, medium (`500`) for form labels and secondary interactions, and semi-bold (`600`) for headers and core prices. Bold (`700+`) is avoided to keep the interface refined.

## Layout & Spacing

The layout system is tailored for a standard 1440px desktop viewport with a strict **1200px max-width container** for all core content, forms, and transit data matrices.

- **Desktop (1440px):** 12-column grid system using `1.5rem` (24px) gutters, framed by symmetric outer margins of `7.5rem` (120px) to comfortably centre the 1200px content box.
- **Tablet (768px – 1024px):** 8-column layout with `1.25rem` (20px) gutters and `2rem` (32px) margins.
- **Mobile (320px – 767px):** 4-column layout with `1rem` (16px) gutters and `1rem` (16px) outer margins. Multi-step booking widgets stack sequentially with full-width action bars.
- **Vertical Spacing Cadence:** Base rhythm follows an 8px scale. Major page sections feature alternating backdrops (pure white `#FFFFFF` against section tint `#F2FBF3`) separated by `4rem` to `6rem` vertical padding.

## Elevation & Depth

This system intentionally departs from heavy, floaty consumer SaaS shadows. It communicates reliability through crisp structural lines and subtle, low-contrast ambient layering:

- **Flat Substrate Hierarchy:** Depth is created primarily through color plane alternation (`#FFFFFF` resting over `#F2FBF3`) rather than physical lift.
- **Resting Cards:** Border-anchored with `1px solid #DDE8DF` and a whisper of shadow: `0 1px 3px rgba(15, 26, 20, 0.04)`.
- **Interactive / Focus Surfaces:** Elevate smoothly on hover with an atmospheric green-tinted shadow: `0 8px 24px rgba(14, 107, 57, 0.08)` and subtle border highlight `#1E9E5A`.
- **Modals & Overlays:** Airport terminal selector pickers and fleet detail sheets utilize a crisp backdrop scrim (`rgba(15, 26, 20, 0.40)`) with a contained elevation of `0 20px 48px rgba(15, 26, 20, 0.12)`.

## Shapes

The geometric identity combines architectural discipline with deliberate touchpoint ergonomics:

- **Cards & Data Panels:** Standardized strictly at `12px` border radius. This introduces an approachable contour without sacrificing the modular density of tabular flight schedules.
- **Input Fields & Dropdowns:** Unified at `12px` border radius to seamlessly integrate alongside adjacent cards and booking toolbars.
- **Action Buttons:** Standardized at `10px` border radius. The slightly tighter curve visually distinguishes interactive clickable elements from passive content containers.
- **Status Badges, Chips & Meta Indicators:** Fully rounded at `999px` (pill configuration) for instantaneous visual scanning.

## Components

### Buttons

- **Primary Action:** Solid `#0E6B39` fill, white `#FFFFFF` text, `10px` border radius, `0.75rem 1.5rem` padding, `Inter 600`. Hover shifts smoothly to `#1E9E5A` over 150ms. Focus renders a `3px` outline in `#90EE90` with a 2px white offset.
- **Secondary Action:** Transparent background with `1px solid #DDE8DF`, text `#0F1A14`. Hover transitions to background `#F2FBF3` and border `#0E6B39`.
- **Destructive/Terminal Action:** Muted crimson icon support with slate borders; reserved for booking cancellations.

### Form Inputs & Date/Time Selectors

- Background `#FFFFFF`, height `48px`, border radius `12px`, border `1px solid #DDE8DF`. Text color `#0F1A14`, placeholder text `#47544C` at 60% opacity.
- **Focus State:** Solid `1.5px solid #0E6B39` with an ambient glow of `rgba(14, 107, 57, 0.12)`.
- Numeric inputs (passenger count, luggage, flight numbers) force `tnum` font features.

### Chips & Selection Pills

- Height `32px`, border radius `999px`, padding `0.25rem 0.875rem`.
- **Default:** Background `#FFFFFF`, border `1px solid #DDE8DF`, text `#47544C`.
- **Selected (Airport / Vehicle Tier):** Background `#F2FBF3`, border `1.5px solid #0E6B39`, text `#0E6B39`, font-weight `600`.
- **Status Indicator Pill (e.g., Flight On-Time):** Background `#F2FBF3`, text `#0E6B39`, featuring a 6px decorative dot in `#90EE90`.

### Cards & Vehicle Tier Selectors

- Base style: `#FFFFFF` fill, `12px` radius, `1px solid #DDE8DF`, internal padding `1.5rem`.
- **Fleet Card Variant:** Displays vehicle silhouette image, luggage/seat specs in `body-sm`, followed by a fixed price display utilizing `fare-tabular` typography in `#0F1A14`.

### Lists & Timetable Grids

- Clean horizontal divider pattern: border-bottom `1px solid #DDE8DF`.
- Alternating table striping alternates between `#FFFFFF` and `#F2FBF3`.
- Cell alignment: Labels left-aligned, timestamps and rates right-aligned in tabular numerals.

### Checkboxes & Radios

- Size `20px` by `20px`. Radius: `4px` for checkboxes, `999px` for radio buttons.
- Unchecked: `1.5px solid #DDE8DF` on `#FFFFFF`.
- Checked: `#0E6B39` fill with crisp `#FFFFFF` checkmark or center pip.
