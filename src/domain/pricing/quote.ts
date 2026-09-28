import { returnLegOf, type FunnelParams } from "@/domain/booking/funnel-params";
import { sumPence, type Pence } from "@/domain/money";
import { chosenExtras, type ExtraQuantities } from "./extras";
import type { VehicleClass } from "./vehicle-classes";

/**
 * What the customer is quoted, as a list of lines that add up to the total.
 *
 * **This is a placeholder engine.** It exists so every step of the funnel
 * agrees on one number instead of each screen doing its own arithmetic — which
 * is how step 4 came to promise "this total covers both journeys" while
 * charging for one. The real engine (§7: fixed route fares, distance tariff,
 * location charges, time modifiers, discounts, rounding and VAT) lands in S2,
 * and replaces the body of `quoteFor` without changing its shape.
 *
 * Whatever replaces it, the rule from CLAUDE.md stands: the price shown to a
 * customer is recalculated on the server and never taken from the client.
 */
export interface QuoteLine {
  label: string;
  /** e.g. "2 × £48.00" — shown beside the label where it helps. */
  detail?: string;
  amountPence: Pence;
}

export interface Quote {
  lines: QuoteLine[];
  totalPence: Pence;
  /** Legs to be driven: 1, or 2 with a return journey. */
  legs: number;
}

/** Hours actually charged: never fewer than the class's minimum (§7). */
export function chargeableHours(journey: FunnelParams, vehicle: VehicleClass): number {
  return Math.max(journey.hours, vehicle.minHours);
}

export function quoteFor(
  journey: FunnelParams,
  vehicle: VehicleClass,
  extras: ExtraQuantities = {},
): Quote {
  const lines: QuoteLine[] = [];

  if (journey.service === "hourly") {
    const hours = chargeableHours(journey, vehicle);
    lines.push({
      label: `${vehicle.name} by the hour`,
      detail: `${hours} × ${poundsish(vehicle.hourlyRatePence)}`,
      amountPence: vehicle.hourlyRatePence * hours,
    });
  } else {
    const legs = returnLegOf(journey) ? 2 : 1;
    lines.push({
      label: legs === 2 ? `${vehicle.name}, both journeys` : vehicle.name,
      detail: legs === 2 ? `2 × ${poundsish(vehicle.fromPence)}` : undefined,
      amountPence: vehicle.fromPence * legs,
    });
  }

  // Extras are charged once per booking, not per leg: a child seat stays in
  // the car. Revisit with the price sheet — an extra that is genuinely
  // per-journey (extra waiting time) may need to be.
  for (const { extra, quantity, linePence } of chosenExtras(extras)) {
    lines.push({
      label: extra.name,
      detail: quantity > 1 ? `${quantity} × ${poundsish(extra.pricePence)}` : undefined,
      amountPence: linePence,
    });
  }

  return {
    lines,
    totalPence: sumPence(...lines.map((line) => line.amountPence)),
    legs: journey.service === "hourly" ? 1 : returnLegOf(journey) ? 2 : 1,
  };
}

/** The fare alone, without extras — what step 2 puts on each vehicle card. */
export function vehicleFarePence(journey: FunnelParams, vehicle: VehicleClass): Pence {
  return quoteFor(journey, vehicle).totalPence;
}

/** Compact form for the "2 × £48" detail strings, not for headline prices. */
function poundsish(amount: Pence): string {
  return amount % 100 === 0 ? `£${amount / 100}` : `£${(amount / 100).toFixed(2)}`;
}
