---
name: AeroChauffeur Slate
colors:
  surface: "#f8f9ff"
  surface-dim: "#cbdbf5"
  surface-bright: "#f8f9ff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#eff4ff"
  surface-container: "#e5eeff"
  surface-container-high: "#dce9ff"
  surface-container-highest: "#d3e4fe"
  on-surface: "#0b1c30"
  on-surface-variant: "#44474c"
  inverse-surface: "#213145"
  inverse-on-surface: "#eaf1ff"
  outline: "#74777c"
  outline-variant: "#c4c6cc"
  surface-tint: "#516070"
  primary: "#081826"
  on-primary: "#ffffff"
  primary-container: "#1e2d3b"
  on-primary-container: "#8594a6"
  inverse-primary: "#b8c8da"
  secondary: "#006e2f"
  on-secondary: "#ffffff"
  secondary-container: "#6bff8f"
  on-secondary-container: "#007432"
  tertiary: "#001b17"
  on-tertiary: "#ffffff"
  tertiary-container: "#00322b"
  on-tertiary-container: "#00a593"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#d4e4f7"
  primary-fixed-dim: "#b8c8da"
  on-primary-fixed: "#0d1d2a"
  on-primary-fixed-variant: "#394857"
  secondary-fixed: "#6bff8f"
  secondary-fixed-dim: "#4ae176"
  on-secondary-fixed: "#002109"
  on-secondary-fixed-variant: "#005321"
  tertiary-fixed: "#6ef9e2"
  tertiary-fixed-dim: "#4ddcc6"
  on-tertiary-fixed: "#00201b"
  on-tertiary-fixed-variant: "#005047"
  background: "#f8f9ff"
  on-background: "#0b1c30"
  surface-variant: "#d3e4fe"
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: "800"
    lineHeight: 56px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: "800"
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: "700"
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: "700"
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: "700"
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: "600"
    lineHeight: 30px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: "600"
    lineHeight: 26px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: "600"
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "600"
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "600"
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: "700"
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system serves an executive airport transit and private chauffeur service catering to discerning business travelers, corporate accounts, and private voyagers. The aesthetic merges executive reliability with seamless velocity: grounded, architectural slate navy grounds the experience, while energetic emerald-mint accents deliver swift clarity and forward momentum.

The design movement is **Corporate Modern with High-Precision Tactility**. It avoids loud ornamentation in favor of crisp whitespace, balanced typographic hierarchy, and razor-sharp data legibility for flight arrivals, terminal routing, vehicle classes, and live booking timelines. Interfaces prioritize friction-free confidence: high contrast for mobile viewing on airport concourses, subtle layered depths, and sleek geometric card structures.

## Colors

The color system is calibrated for authority, clarity, and rapid booking actions:

- **Primary (`#1E2D3B`):** Deep architectural slate navy. Serves as the primary brand bedrock across navigational headers, structural bars, primary button backgrounds, and strong typographic headings. Conveys executive reliability and quiet luxury.
- **Secondary (`#22C55E`):** Dynamic flight emerald. Applied deliberately to primary calls-to-action (booking confirms, terminal check-ins, active ride indicators) and high-priority states. Inspired by the aerodynamic ascent swoop in the identity mark.
- **Tertiary (`#5EEAD4`):** Soft mint cyan. Acts as a luminous companion for highlights, route trajectories, progress pulses, and badge backgrounds against slate backdrops.
- **Neutral (`#64748B`):** Balanced slate cool gray. Powers secondary typography, borders, subtle divider lines, and muted form controls.
- **Surface Foundations:** Backgrounds default to clean, bright whites (`#FFFFFF`) with cool tinted slate-tinted canvas backdrops (`#F8FAFC`, `#F1F5F9`) ensuring high contrast and pristine legibility under daylight concourse conditions.

## Typography

The typographic strategy pairs the structural warmth and geometric punch of **Plus Jakarta Sans** for headlines and core brand narrative with the hyper-legible precision of **Inter** for dense transit data, flight manifests, route times, pricing, and functional labels.

Headlines leverage tight, negative letter spacing to feel athletic and refined like modern aerospace branding. Numerical data (flight tracking numbers, timestamps, vehicle capacities) strictly utilize tabular figures (`tnum`) to maintain clean grid vertical alignment across fleet selection tables and booking summaries.

## Layout & Spacing

The design system implements a 12-column responsive fluid grid structured around an 8pt layout engine:

- **Desktop (1024px+):** 12 columns, `1.5rem` (24px) gutters, and `2rem` (32px) minimum outer canvas margins (max-width container clamped at 1280px for desktop workflows).
- **Tablet (768px - 1023px):** 8 columns, `1.25rem` (20px) gutters, and `1.5rem` (24px) outer margins.
- **Mobile (< 768px):** 4 columns, `1rem` (16px) gutters, and `1rem` (16px) outer margins.

Vertical rhythm follows deterministic increments: compact component internal spacing (`space-xs` to `space-md`) ensures inputs, route step milestones, and car spec badges remain tight and scan-friendly, while structural section separation (`space-xl` and above) provides generous breathing space fitting executive tier services.

## Elevation & Depth

Visual hierarchy leverages a hybrid model of **Tonal Surface Stacking** reinforced by **Subtle Slate Ambient Shadows** and crisp micro-borders:

1. **Surface 0 (Base Canvas):** `#F8FAFC` to `#FFFFFF` creates a clean canvas.
2. **Surface 1 (Card & Module Containers):** Pure `#FFFFFF` resting atop canvas, bound by a razor-thin border (`1px solid #E2E8F0`) and an ambient shadow: `0 1px 3px rgba(30, 45, 59, 0.05), 0 4px 12px rgba(30, 45, 59, 0.03)`.
3. **Surface 2 (Fleet Selection & Hover States):** Lifted cards utilize an enhanced elevation: `0 8px 24px -4px rgba(30, 45, 59, 0.08), 0 2px 6px -1px rgba(30, 45, 59, 0.04)` alongside an active border accent using `#22C55E` or `#1E2D3B`.
4. **Surface 3 (Overlays, Flight Trackers & Modals):** High-priority focus layers use an executive deep float: `0 20px 35px -8px rgba(30, 45, 59, 0.18)` paired with a soft backdrop blur (`backdrop-filter: blur(8px); background: rgba(30, 45, 59, 0.4)`).

## Shapes

The design system establishes a **Rounded** shape language (`roundedness: 2`). Standard controls, interactive cards, input wrappers, and segmented vehicle switchers inherit `0.5rem` (8px) corners.

Prominent callout panels, vehicle spec cards, and modal sheets scale to `rounded-lg` (`1rem` / 16px). Pill shapes (`rounded-full`) are reserved exclusively for flight status indicators, baggage/passenger capacity badges, and secondary action chips to maintain visual momentum aligned with the aerodynamic flight swoosh of the logo.

## Components

### Buttons

- **Primary Action (Confirm Booking / Request Chauffeur):** Deep slate navy (`#1E2D3B`) text on vibrant emerald background (`#22C55E`), transitioning to `#16A34A` on hover. Bold `label-lg` typography, height 48px, horizontal padding `1.5rem`, rounded `0.5rem`.
- **Secondary / Executive:** Deep slate navy background (`#1E2D3B`) with white text and a soft green glow on hover (`box-shadow: 0 0 0 2px #22C55E`).
- **Outline / Ghost:** Transparent surface with a `1.5px solid #CBD5E1` border and `#1E2D3B` label, tinting to `#F1F5F9` on hover.

### Inputs & Date-Time Pickers

- Form containers feature a 48px height, `0.5rem` radius, crisp `1px solid #E2E8F0` border, and pure white background.
- Focus state applies a direct `2px solid #1E2D3B` ring combined with a soft emerald accent hint (`box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2)`).
- Input prefixes feature dedicated icons (airplane takeoff, terminal pin, calendar, luggage) rendered in muted slate (`#64748B`).

### Vehicle & Fleet Cards

- Tiered vehicle cards (e.g., Executive Sedan, First Class SUV, Chauffeur Van) built on Surface 1 with `1rem` corner rounding.
- Includes a dedicated header for class name, passenger/luggage pill chips, high-fidelity car silhouette preview, and a prominent fixed-fare quote in `Plus Jakarta Sans` 700.
- Selected state triggers a `2px solid #22C55E` border and a soft mint green background gradient tint.

### Status Chips & Flight Badges

- Compact pill-shaped modules (`height: 24px`, padding `0.25rem 0.75rem`, font `label-sm` uppercase).
- Live/On-Time: Mint background (`rgba(34, 197, 94, 0.12)`) with deep green text (`#15803D`) and a pulsing green dot.
- Delayed: Warm amber background (`#FEF3C7`) with dark bronze text (`#92400E`).

### Checkboxes & Radios

- Radios and checkboxes utilize a `18px` boundary with a `1.5px solid #94A3B8` perimeter.
- Checked state fills with `#1E2D3B` featuring an emerald green (`#22C55E`) checkmark or inner core, delivering corporate crispness.

### Route & Terminal Timeline

- Custom component displaying pick-up, flight leg, and terminal drop-off points linked by a vertical/horizontal 2px slate-dashed or emerald-solid stroke with terminal waypoint rings.
