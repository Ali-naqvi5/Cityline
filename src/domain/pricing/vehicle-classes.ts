import type { Pence } from "@/domain/money";

/**
 * The fleet, with **PLACEHOLDER FARES**.
 *
 * Capacities and descriptions come from the fleet page design. The prices are
 * the design's illustrative "from" figures and are NOT Cityline's real rates —
 * they are replaced by the launch price tables in S2, after which fares come
 * from `route_fares` / `tariffs` in the database (§14) and never from here.
 *
 * Note for S2: the designs are inconsistent with themselves. The fleet page
 * shows Saloon at 4 passengers from £48; booking step 2 shows Saloon at
 * 3 passengers at £58. The fleet page is used here.
 */
export interface VehicleClass {
  slug: string;
  name: string;
  /** Short qualifier shown beside the name, e.g. "Standard". */
  tier: string;
  maxPassengers: number;
  maxLargeBags: number;
  maxHandLuggage: number;
  exampleModels: string;
  note?: string;
  /** Shown as a badge on the fleet page and in vehicle selection. */
  mostPopular?: boolean;
  image: string;
  /** PLACEHOLDER — see the note above. */
  fromPence: Pence;
  /** PLACEHOLDER hourly rate (§7: £/hour per class, with a minimum). */
  hourlyRatePence: Pence;
  /** Shortest hourly hire this class can be booked for. */
  minHours: number;
  sort: number;
}

/**
 * Cityline's six classes, in the order the office lists them (Cityline,
 * 10 Oct 2026): Saloon, Green Class, Executive Saloon, Estate, People
 * Carrier, Large People Carrier. One list for the website and the admin, so
 * the two stay connected. The slugs `mpv-5` and `mpv-8` are kept for People
 * Carrier and Large People Carrier, so earlier bookings and cars keep their
 * class.
 */
export const VEHICLE_CLASSES: readonly VehicleClass[] = [
  {
    slug: "saloon",
    name: "Saloon",
    tier: "Standard",
    maxPassengers: 4,
    maxLargeBags: 2,
    maxHandLuggage: 2,
    exampleModels: "Volkswagen Passat, Toyota Camry or similar",
    mostPopular: true,
    image: "/images/fleet/saloon.png",
    fromPence: 4800,
    hourlyRatePence: 4500,
    minHours: 3,
    sort: 1,
  },
  {
    slug: "green",
    name: "Green Class",
    tier: "Hybrid or electric",
    maxPassengers: 4,
    maxLargeBags: 2,
    maxHandLuggage: 2,
    exampleModels: "Toyota Prius, Tesla Model 3 or similar",
    // TODO(Cityline): a Green Class photo; the saloon's stands in until then.
    image: "/images/fleet/saloon.png",
    // TODO(Cityline): Green Class fares. The saloon's placeholders for now.
    fromPence: 4800,
    hourlyRatePence: 4500,
    minHours: 3,
    sort: 2,
  },
  {
    slug: "executive",
    name: "Executive Saloon",
    tier: "Chauffeur",
    maxPassengers: 3,
    maxLargeBags: 2,
    maxHandLuggage: 2,
    exampleModels: "Mercedes-Benz E-Class, BMW 5 Series, Audi A6",
    image: "/images/fleet/executive.png",
    fromPence: 6800,
    hourlyRatePence: 6500,
    minHours: 3,
    sort: 3,
  },
  {
    slug: "estate",
    name: "Estate",
    tier: "Extra luggage",
    maxPassengers: 4,
    maxLargeBags: 3,
    maxHandLuggage: 2,
    exampleModels: "Škoda Superb Estate, Volkswagen Passat Estate or similar",
    note: "Fold-flat split rear seats",
    image: "/images/fleet/estate.png",
    fromPence: 5600,
    hourlyRatePence: 5000,
    minHours: 3,
    sort: 4,
  },
  {
    slug: "mpv-5",
    name: "People Carrier",
    tier: "Small group",
    maxPassengers: 5,
    maxLargeBags: 4,
    maxHandLuggage: 3,
    exampleModels: "Ford Galaxy, Volkswagen Touran or similar",
    image: "/images/fleet/mpv-5.png",
    fromPence: 6500,
    hourlyRatePence: 5800,
    minHours: 3,
    sort: 5,
  },
  {
    slug: "mpv-8",
    name: "Large People Carrier",
    tier: "Group",
    maxPassengers: 8,
    maxLargeBags: 5,
    maxHandLuggage: 4,
    exampleModels: "Mercedes-Benz Vito, Ford Tourneo or similar",
    image: "/images/fleet/mpv-8.png",
    fromPence: 7800,
    hourlyRatePence: 7000,
    minHours: 3,
    sort: 6,
  },
];

/**
 * Classes no longer offered, by slug, so older bookings and cars still read
 * properly. The 16 seat minibus was withdrawn on 10 Oct 2026; its value stays
 * in the database, which is never shrunk.
 */
export const RETIRED_VEHICLE_CLASSES: Readonly<Record<string, string>> = {
  "minibus-16": "16 seat minibus",
};

/** A class's name, including retired ones; the slug itself when unknown. */
export function vehicleClassLabel(slug: string | null | undefined): string {
  if (!slug) return "—";
  return (
    VEHICLE_CLASSES.find((vehicle) => vehicle.slug === slug)?.name ??
    RETIRED_VEHICLE_CLASSES[slug] ??
    slug
  );
}

export function cheapestFromPence(): Pence {
  return Math.min(...VEHICLE_CLASSES.map((v) => v.fromPence));
}
