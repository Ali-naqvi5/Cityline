import { describe, expect, it } from "vitest";

import { VEHICLE_CLASSES } from "./vehicle-classes";
import {
  TABLE_CLASSES,
  cheapestIndicativePence,
  indicativeFarePence,
} from "./indicative";

const saloon = VEHICLE_CLASSES.find((v) => v.slug === "saloon")!;
const mpv8 = VEHICLE_CLASSES.find((v) => v.slug === "mpv-8")!;

describe("indicativeFarePence", () => {
  it("rounds to whole pounds (§7 step 7)", () => {
    for (const miles of [3, 8, 14, 19, 28, 41]) {
      for (const vehicle of TABLE_CLASSES) {
        expect(indicativeFarePence(miles, vehicle) % 100).toBe(0);
      }
    }
  });

  it("charges more for a longer journey", () => {
    // The thing a customer notices instantly: a nearer place costing more.
    expect(indicativeFarePence(28, saloon)).toBeGreaterThan(
      indicativeFarePence(14, saloon),
    );
  });

  it("keeps the class ordering consistent with the fleet page", () => {
    expect(indicativeFarePence(16, mpv8)).toBeGreaterThan(
      indicativeFarePence(16, saloon),
    );
  });

  it("never quotes below the flag fall", () => {
    expect(indicativeFarePence(0, saloon)).toBeGreaterThanOrEqual(2500);
  });

  it("offers at least the three priced classes SEO-01 requires", () => {
    expect(TABLE_CLASSES.length).toBeGreaterThanOrEqual(3);
  });

  it("cheapest is the cheapest of the table classes", () => {
    const all = TABLE_CLASSES.map((v) => indicativeFarePence(16, v));
    expect(cheapestIndicativePence(16)).toBe(Math.min(...all));
  });
});
