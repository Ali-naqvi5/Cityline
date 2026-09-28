import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import sharp from "sharp";

/**
 * Brings the Stitch design photography and vehicle illustrations into
 * `public/images` at web weights.
 *
 * The exports are 1.2–1.6 MB PNGs, which no amount of runtime optimisation
 * makes acceptable as source files for a Core Web Vitals target (NFR-01).
 * Photos become WebP; the vehicle illustrations keep their alpha channel.
 *
 * Re-run after dropping new exports in:  pnpm images:import
 */
const DESIGN_ROOT = "design/stitch/stitch_custom_multi_page_website_design";

interface ImportSpec {
  from: string;
  to: string;
  width: number;
  /** Illustrations need transparency; photographs do not. */
  alpha?: boolean;
}

const IMPORTS: ImportSpec[] = [
  // Photography
  {
    from: "a_premium_modern_dark_green_or_deep_obsidian_luxury_chauffeur_executive_saloon",
    to: "images/hero-executive-saloon.webp",
    width: 1200,
  },
  {
    from: "family_b_documentary_realistic_photography_1600x600_aspect._a_luxury_dark_green",
    to: "images/chauffeur-london-street.webp",
    width: 1200,
  },
  {
    from: "interior_architectural_photograph_of_a_modern_generic_airport_arrivals_hall",
    to: "images/arrivals-hall.webp",
    width: 1000,
  },
  {
    from: "london_heathrow_modern_airport_departure_terminal_forecourt_and_architectural",
    to: "images/airports/heathrow.webp",
    width: 800,
  },
  {
    from: "london_gatwick_airport_terminal_modern_exterior_and_covered_elevated_walkway",
    to: "images/airports/gatwick.webp",
    width: 800,
  },
  {
    from: "london_luton_airport_terminal_building_exterior_architecture_with_modern",
    to: "images/airports/luton.webp",
    width: 800,
  },
  {
    from: "london_stansted_airport_terminal_with_famous_architectural_geometric_roof",
    to: "images/airports/stansted.webp",
    width: 800,
  },
  {
    from: "modern_regional_airport_terminal_entrance_exterior_at_london_city_airport_clean",
    to: "images/airports/london-city.webp",
    width: 800,
  },
  {
    from: "london_southend_airport_modern_regional_air_terminal_entrance_and_tarmac_apron",
    to: "images/airports/southend.webp",
    width: 800,
  },

  // Vehicle illustrations (transparent)
  {
    from: "saloon_car_illustration",
    to: "images/fleet/saloon.png",
    width: 480,
    alpha: true,
  },
  {
    from: "estate_car_illustration",
    to: "images/fleet/estate.png",
    width: 480,
    alpha: true,
  },
  { from: "mpv_5_illustration", to: "images/fleet/mpv-5.png", width: 480, alpha: true },
  { from: "mpv_8_illustration", to: "images/fleet/mpv-8.png", width: 480, alpha: true },
  {
    from: "executive_saloon_illustration",
    to: "images/fleet/executive.png",
    width: 480,
    alpha: true,
  },
  {
    from: "16_seater_minibus_illustration",
    to: "images/fleet/minibus-16.png",
    width: 480,
    alpha: true,
  },

  // Booking extras (transparent)
  {
    from: "infant_seat_icon",
    to: "images/extras/infant-seat.png",
    width: 96,
    alpha: true,
  },
  { from: "child_seat_icon", to: "images/extras/child-seat.png", width: 96, alpha: true },
  {
    from: "booster_seat_icon",
    to: "images/extras/booster-seat.png",
    width: 96,
    alpha: true,
  },
  {
    from: "extra_waiting_time_icon",
    to: "images/extras/extra-waiting.png",
    width: 96,
    alpha: true,
  },
];

let imported = 0;
let savedBytes = 0;

for (const spec of IMPORTS) {
  const source = join(DESIGN_ROOT, spec.from, "screen.png");
  const target = join("public", spec.to);

  let input: Buffer;
  try {
    input = readFileSync(source);
  } catch {
    console.warn(`skipped (not found): ${spec.from}`);
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });

  const pipeline = sharp(input).resize({ width: spec.width, withoutEnlargement: true });
  const output = spec.alpha
    ? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
    : await pipeline.webp({ quality: 78 }).toBuffer();

  writeFileSync(target, output);
  imported += 1;
  savedBytes += input.length - output.length;

  const before = Math.round(input.length / 1024);
  const after = Math.round(output.length / 1024);
  console.log(`${spec.to}  ${before}KB -> ${after}KB`);
}

console.log("");
console.log(`${imported} images imported, ${Math.round(savedBytes / 1024)}KB saved.`);
