import { roundToNearestPound, type Pence } from "@/domain/money";
import { VEHICLE_CLASSES, type VehicleClass } from "./vehicle-classes";

/**
 * A **placeholder** distance fare, for the "from" prices on airport and route
 * pages (SEO-01 wants a live fare for at least three classes).
 *
 * One formula rather than hand-written tables. Six airports times six
 * destinations times four classes is 144 numbers, and invented numbers that
 * disagree with each other are worse than obviously-derived ones: a customer
 * who spots Heathrow→Mayfair cheaper than Heathrow→Kensington, when Kensington
 * is nearer, has found a reason not to trust the site.
 *
 * Replaced wholesale in S2 by `route_fares` and `tariffs` (§14, §7 steps 1–7:
 * fixed route fare where one matches, otherwise flag fall plus per-mile bands,
 * then location charges, time modifiers, discounts and rounding).
 *
 * Deleting this file is the goal, not maintaining it.
 */
const FLAG_FALL_PENCE = 2500;
const PER_MILE_PENCE = 180;

const saloon = VEHICLE_CLASSES.find((vehicle) => vehicle.slug === "saloon");

/**
 * Each class priced relative to the saloon, so the ordering on a page always
 * matches the ordering on the fleet page and in the funnel.
 */
function multiplier(vehicle: VehicleClass): number {
  return saloon ? vehicle.fromPence / saloon.fromPence : 1;
}

export function indicativeFarePence(miles: number, vehicle: VehicleClass): Pence {
  const base = FLAG_FALL_PENCE + Math.round(miles * PER_MILE_PENCE);
  return roundToNearestPound(Math.round(base * multiplier(vehicle)));
}

/** The classes shown in a fare table — the common ones, cheapest first. */
export const TABLE_CLASSES: readonly VehicleClass[] = VEHICLE_CLASSES.filter((vehicle) =>
  ["saloon", "estate", "mpv-5", "mpv-8", "executive"].includes(vehicle.slug),
);

/** Cheapest indicative fare for a distance — the "from" figure on a card. */
export function cheapestIndicativePence(miles: number): Pence {
  return Math.min(...TABLE_CLASSES.map((vehicle) => indicativeFarePence(miles, vehicle)));
}
