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
 * 3 passengers at £58. The fleet page is used here because it covers all six
 * classes.
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
    sort: 2,
  },
  {
    slug: "executive",
    name: "Executive saloon",
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
    slug: "mpv-5",
    name: "MPV 5",
    tier: "Small group",
    maxPassengers: 5,
    maxLargeBags: 4,
    maxHandLuggage: 3,
    exampleModels: "Ford Galaxy, Volkswagen Touran or similar",
    image: "/images/fleet/mpv-5.png",
    fromPence: 6500,
    hourlyRatePence: 5800,
    minHours: 3,
    sort: 4,
  },
  {
    slug: "mpv-8",
    name: "MPV 8",
    tier: "Group",
    maxPassengers: 8,
    maxLargeBags: 5,
    maxHandLuggage: 4,
    exampleModels: "Mercedes-Benz Vito, Ford Tourneo or similar",
    image: "/images/fleet/mpv-8.png",
    fromPence: 7800,
    hourlyRatePence: 7000,
    minHours: 3,
    sort: 5,
  },
  {
    slug: "minibus-16",
    name: "16 seat minibus",
    tier: "Large group",
    maxPassengers: 16,
    maxLargeBags: 14,
    maxHandLuggage: 10,
    exampleModels: "Mercedes-Benz Sprinter or similar",
    image: "/images/fleet/minibus-16.png",
    fromPence: 14_500,
    hourlyRatePence: 11000,
    minHours: 4,
    sort: 6,
  },
] as const;

export function cheapestFromPence(): Pence {
  return Math.min(...VEHICLE_CLASSES.map((v) => v.fromPence));
}
