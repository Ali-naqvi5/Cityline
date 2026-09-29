import { describe, expect, it } from "vitest";

import {
  checkPickupTiming,
  earliestBookableDate,
  flightNumberSchema,
  journeySchema,
} from "./journey";
import { bookingRules } from "./rules";

const heathrowT5 = {
  kind: "terminal" as const,
  label: "Heathrow Terminal 5",
  lat: 51.4723,
  lng: -0.4874,
};

const kensington = {
  kind: "address" as const,
  label: "12 Kensington High Street, London W8",
  lat: 51.5011,
  lng: -0.1919,
};

/** Comfortably outside the minimum notice window. */
function soon(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

function journey(overrides: Record<string, unknown> = {}) {
  return {
    outbound: {
      pickup: heathrowT5,
      dropoff: kensington,
      pickupAt: soon(48),
      viaStops: [],
      flightNumber: "BA117",
    },
    passengers: 2,
    largeBags: 2,
    smallBags: 1,
    ...overrides,
  };
}

describe("flightNumberSchema", () => {
  it("accepts the shapes airlines actually use", () => {
    expect(flightNumberSchema.parse("BA117")).toBe("BA117");
    expect(flightNumberSchema.parse("ba 117")).toBe("BA117");
    expect(flightNumberSchema.parse("U21234")).toBe("U21234");
    expect(flightNumberSchema.parse("EZY8321")).toBe("EZY8321");
    expect(flightNumberSchema.parse("3K501")).toBe("3K501");
    expect(flightNumberSchema.parse("BA1234")).toBe("BA1234");
  });

  it("rejects what is clearly not a flight number", () => {
    expect(flightNumberSchema.safeParse("").success).toBe(false);
    expect(flightNumberSchema.safeParse("my flight").success).toBe(false);
    expect(flightNumberSchema.safeParse("BA").success).toBe(false);
    // Would wrongly parse as airline "BA1", flight "2345" with a loose pattern.
    expect(flightNumberSchema.safeParse("BA12345").success).toBe(false);
    expect(flightNumberSchema.safeParse("1234").success).toBe(false);
  });
});

describe("journeySchema", () => {
  it("accepts an ordinary airport pickup", () => {
    expect(journeySchema.safeParse(journey()).success).toBe(true);
  });

  it("insists on a flight number when collecting from an airport (BK-03)", () => {
    const result = journeySchema.safeParse(
      journey({
        outbound: {
          pickup: heathrowT5,
          dropoff: kensington,
          pickupAt: soon(48),
          viaStops: [],
        },
      }),
    );

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("flight number");
  });

  it("does not ask for a flight number on an address pickup", () => {
    const result = journeySchema.safeParse(
      journey({
        outbound: {
          pickup: kensington,
          dropoff: heathrowT5,
          pickupAt: soon(48),
          viaStops: [],
        },
      }),
    );

    expect(result.success).toBe(true);
  });

  it("rejects a return leg that is before the outbound journey", () => {
    const result = journeySchema.safeParse(
      journey({
        returnLeg: { pickupAt: soon(24), viaStops: [] },
      }),
    );

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("must be after");
  });

  it("accepts a return leg after the outbound journey (BK-04)", () => {
    const result = journeySchema.safeParse(
      journey({ returnLeg: { pickupAt: soon(120), viaStops: [] } }),
    );

    expect(result.success).toBe(true);
  });

  it("sends oversized groups to a human rather than taking the booking", () => {
    const result = journeySchema.safeParse(
      journey({ passengers: bookingRules().maxPassengers + 1 }),
    );

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("group quote");
  });

  it("requires at least one passenger", () => {
    expect(journeySchema.safeParse(journey({ passengers: 0 })).success).toBe(false);
  });

  it("caps the number of extra stops bookable online", () => {
    const tooMany = Array.from(
      { length: bookingRules().maxViaStops + 1 },
      () => kensington,
    );
    const result = journeySchema.safeParse(
      journey({
        outbound: {
          pickup: kensington,
          dropoff: heathrowT5,
          pickupAt: soon(48),
          viaStops: tooMany,
        },
      }),
    );

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("extra stops");
  });
});

describe("checkPickupTiming", () => {
  const now = new Date("2027-03-14T09:00:00Z");

  it("passes a pickup outside the notice window", () => {
    expect(checkPickupTiming(new Date("2027-03-16T09:00:00Z"), now)).toBeNull();
  });

  it("catches a pickup that is too soon (BK-05)", () => {
    const problem = checkPickupTiming(new Date("2027-03-14T10:00:00Z"), now);
    expect(problem?.reason).toBe("too_soon");
  });

  it("catches a pickup in the past", () => {
    expect(checkPickupTiming(new Date("2027-03-13T09:00:00Z"), now)?.reason).toBe(
      "too_soon",
    );
  });

  it("catches a pickup beyond the booking horizon", () => {
    expect(checkPickupTiming(new Date("2029-03-14T09:00:00Z"), now)?.reason).toBe(
      "too_far_ahead",
    );
  });

  describe("exactly three hours counts (Cityline's rule, 29 Sep 2026)", () => {
    // 12:00 London on 29 Sep 2026 is 11:00 UTC (BST).
    const noon = new Date("2026-09-29T11:00:00Z");
    const at = (hhmm: string) => new Date(`2026-09-29T${hhmm}:00+01:00`);

    it("accepts 15:00 and later at 12:00", () => {
      expect(checkPickupTiming(at("15:00"), noon)).toBeNull();
      expect(checkPickupTiming(at("15:01"), noon)).toBeNull();
    });

    it("refuses 14:59 at 12:00", () => {
      expect(checkPickupTiming(at("14:59"), noon)?.reason).toBe("too_soon");
    });

    it("still accepts 15:00 when it is 12:00 and some seconds", () => {
      // The customer reads 12:00 on their clock; the seconds must not cost them
      // the 15:00 slot.
      const noonAndABit = new Date("2026-09-29T11:00:59Z");
      expect(checkPickupTiming(at("15:00"), noonAndABit)).toBeNull();
    });

    it("refuses 15:00 once the clock reads 12:01", () => {
      const oneMinutePast = new Date("2026-09-29T11:01:00Z");
      expect(checkPickupTiming(at("15:00"), oneMinutePast)?.reason).toBe("too_soon");
    });
  });
});

describe("earliestBookableDate", () => {
  it("adds the minimum notice period", () => {
    // 3 hours notice from 09:00 lands the same day.
    expect(earliestBookableDate(new Date("2027-03-14T09:00:00Z"))).toBe("2027-03-14");
  });

  it("rolls over to the next day when the notice period crosses midnight", () => {
    expect(earliestBookableDate(new Date("2027-03-14T23:00:00Z"))).toBe("2027-03-15");
  });

  it("uses London dates, not UTC ones", () => {
    // 23:30 UTC in July is 00:30 the next day in London (BST), so before the
    // notice period is even added the London date has already rolled over.
    expect(earliestBookableDate(new Date("2027-07-14T23:30:00Z"))).toBe("2027-07-15");
  });
});
