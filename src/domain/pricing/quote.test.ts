import { describe, expect, it } from "vitest";

import { parseFunnelParams, type FunnelParams } from "@/domain/booking/funnel-params";
import { VEHICLE_CLASSES } from "./vehicle-classes";
import { chargeableHours, quoteFor } from "./quote";

const saloon = VEHICLE_CLASSES.find((v) => v.slug === "saloon")!;
const minibus = VEHICLE_CLASSES.find((v) => v.slug === "minibus-16")!;

function journey(overrides: Record<string, string> = {}): FunnelParams {
  return parseFunnelParams({
    pickup: "Mayfair",
    dropoff: "Heathrow T5",
    date: "2026-12-01",
    time: "09:30",
    passengers: "2",
    bags: "2",
    ...overrides,
  });
}

describe("quoteFor — route", () => {
  it("charges one fare for a one-way journey", () => {
    const quote = quoteFor(journey(), saloon);

    expect(quote.legs).toBe(1);
    expect(quote.totalPence).toBe(saloon.fromPence);
  });

  it("charges both legs of a return journey", () => {
    // The bug this guards: step 4 said "this total covers both journeys"
    // while charging for one.
    const quote = quoteFor(journey({ return: "yes" }), saloon);

    expect(quote.legs).toBe(2);
    expect(quote.totalPence).toBe(saloon.fromPence * 2);
    expect(quote.lines[0]?.label).toContain("both journeys");
  });

  it("adds extras once, not once per leg", () => {
    const withExtras = quoteFor(journey({ return: "yes" }), saloon, {
      "booster-seat": 2,
    });

    expect(withExtras.totalPence).toBe(saloon.fromPence * 2 + 800 * 2);
  });

  it("ignores a return flag on an hourly hire", () => {
    const quote = quoteFor(
      journey({ service: "hourly", hours: "4", return: "yes" }),
      saloon,
    );

    expect(quote.legs).toBe(1);
  });
});

describe("quoteFor — hourly", () => {
  it("charges the hourly rate for the hours booked", () => {
    const quote = quoteFor(journey({ service: "hourly", hours: "5" }), saloon);

    expect(quote.totalPence).toBe(saloon.hourlyRatePence * 5);
    expect(quote.lines[0]?.detail).toBe("5 × £45");
  });

  it("never charges below the class minimum", () => {
    // Someone arriving with ?hours=1 must not get an hour's hire at an hour's
    // price when the minibus takes four.
    expect(chargeableHours(journey({ hours: "1" }), minibus)).toBe(minibus.minHours);

    const quote = quoteFor(journey({ service: "hourly", hours: "1" }), minibus);
    expect(quote.totalPence).toBe(minibus.hourlyRatePence * minibus.minHours);
  });

  it("does not use the route fare", () => {
    const quote = quoteFor(journey({ service: "hourly", hours: "3" }), saloon);

    expect(quote.totalPence).not.toBe(saloon.fromPence);
  });
});
