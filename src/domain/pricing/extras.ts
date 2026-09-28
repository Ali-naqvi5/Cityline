import type { Pence } from "@/domain/money";

/**
 * Bookable extras (§7 catalogue), with **PLACEHOLDER PRICES** from the step 3
 * design. Replaced by Cityline's price sheet in S2, after which they come from
 * the `extras` table and are editable in the admin (ADM-01).
 *
 * Two contradictions in the designs, both flagged for the price sheet:
 *
 *   - Child seats are £10 here, but the fleet page says "child seats provided
 *     complimentary on request".
 *   - Meet and greet is a £15 extra here, while the same page's own summary
 *     lists it as "£0.00 (Included free)".
 *
 * Meet and greet is not offered as a paid extra below, because Cityline has
 * confirmed it is included (`policies.meetAndGreetIncluded`). Charging for
 * something the home page promises for free is the kind of thing that ends in a
 * chargeback.
 */
export interface Extra {
  slug: string;
  name: string;
  description: string;
  pricePence: Pence;
  /** Most someone can add of this extra. */
  maxQuantity: number;
  image: string;
  /** Child restraints are grouped and explained together. */
  group: "child-seats" | "journey";
}

export const EXTRAS: readonly Extra[] = [
  {
    slug: "infant-seat",
    name: "Infant seat (0–15 months)",
    description: "Rear-facing safety capsule with impact protection and a harness.",
    pricePence: 1000,
    maxQuantity: 3,
    image: "/images/extras/infant-seat.png",
    group: "child-seats",
  },
  {
    slug: "child-seat",
    name: "Child seat (15 months – 4 years)",
    description: "Forward-facing padded seat with a five-point safety harness.",
    pricePence: 1000,
    maxQuantity: 3,
    image: "/images/extras/child-seat.png",
    group: "child-seats",
  },
  {
    slug: "booster-seat",
    name: "Booster seat (4–12 years)",
    description: "Raises your child so the car's own seatbelt sits correctly.",
    pricePence: 800,
    maxQuantity: 3,
    image: "/images/extras/booster-seat.png",
    group: "child-seats",
  },
  {
    slug: "extra-waiting",
    name: "Extra waiting time (30 minutes)",
    description: "Added on top of your free waiting time, if you expect to be held up.",
    pricePence: 1500,
    maxQuantity: 4,
    image: "/images/extras/extra-waiting.png",
    group: "journey",
  },
] as const;

export type ExtraQuantities = Record<string, number>;

/** A child restraint cannot be fitted for a passenger who is not travelling. */
export function childSeatsExceedPassengers(
  quantities: ExtraQuantities,
  passengers: number,
): boolean {
  const seats = EXTRAS.filter((extra) => extra.group === "child-seats").reduce(
    (total, extra) => total + (quantities[extra.slug] ?? 0),
    0,
  );

  return seats > passengers;
}

export function extrasTotalPence(quantities: ExtraQuantities): Pence {
  return EXTRAS.reduce((total, extra) => {
    const quantity = quantities[extra.slug] ?? 0;
    return total + extra.pricePence * Math.max(0, Math.min(quantity, extra.maxQuantity));
  }, 0);
}

/** Only the extras actually chosen, for the summary panel and the job sheet. */
export function chosenExtras(
  quantities: ExtraQuantities,
): { extra: Extra; quantity: number; linePence: Pence }[] {
  return EXTRAS.filter((extra) => (quantities[extra.slug] ?? 0) > 0).map((extra) => {
    const quantity = Math.min(quantities[extra.slug] ?? 0, extra.maxQuantity);
    return { extra, quantity, linePence: extra.pricePence * quantity };
  });
}
