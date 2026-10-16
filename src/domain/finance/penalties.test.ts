import { describe, expect, it } from "vitest";

import {
  citylineSharePence,
  driverShareProblem,
  driverSharesTotal,
  penaltiesTotal,
  penaltyAmountProblem,
  penaltyReference,
} from "./penalties";

describe("partner penalties", () => {
  it("numbers penalties", () => {
    expect(penaltyReference(4)).toBe("PN-000004");
  });

  it("leaves Cityline the part not passed to the driver", () => {
    expect(citylineSharePence({ amountPence: 1000, driverSharePence: 0 })).toBe(1000);
    expect(citylineSharePence({ amountPence: 1000, driverSharePence: 400 })).toBe(600);
    expect(citylineSharePence({ amountPence: 1000, driverSharePence: 1000 })).toBe(0);
  });

  it("needs a penalty of more than nothing, in whole pence", () => {
    expect(penaltyAmountProblem(1000)).toBeNull();
    expect(penaltyAmountProblem(0)).not.toBeNull();
    expect(penaltyAmountProblem(-100)).not.toBeNull();
    expect(penaltyAmountProblem(null)).not.toBeNull();
    expect(penaltyAmountProblem(10.5)).not.toBeNull();
  });

  it("takes from the driver nothing up to the whole penalty, never more", () => {
    expect(driverShareProblem(1000, 0)).toBeNull();
    expect(driverShareProblem(1000, 500)).toBeNull();
    expect(driverShareProblem(1000, 1000)).toBeNull();
    expect(driverShareProblem(1000, 1001)).toMatch(/more than the penalty/);
    expect(driverShareProblem(1000, -1)).not.toBeNull();
    expect(driverShareProblem(1000, null)).not.toBeNull();
  });

  it("totals penalties and drivers' shares", () => {
    const penalties = [
      { amountPence: 1000, driverSharePence: 500 },
      { amountPence: 2500, driverSharePence: 0 },
    ];
    expect(penaltiesTotal(penalties)).toBe(3500);
    expect(driverSharesTotal(penalties)).toBe(500);
  });
});
