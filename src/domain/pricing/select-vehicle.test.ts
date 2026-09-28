import { describe, expect, it } from "vitest";

import {
  hasAnySuitableVehicle,
  recommendedVehicle,
  vehicleOptionsFor,
} from "./select-vehicle";

function suitableSlugs(passengers: number, largeBags: number): string[] {
  return vehicleOptionsFor({ passengers, largeBags })
    .filter((option) => option.suitable)
    .map((option) => option.vehicle.slug);
}

describe("vehicleOptionsFor", () => {
  it("offers everything that fits a small party", () => {
    expect(suitableSlugs(2, 2)).toEqual([
      "saloon",
      "estate",
      "executive",
      "mpv-5",
      "mpv-8",
      "minibus-16",
    ]);
  });

  it("rules out classes with too few seats", () => {
    // The executive saloon seats 3.
    expect(suitableSlugs(4, 1)).not.toContain("executive");
    expect(suitableSlugs(4, 1)).toContain("saloon");
  });

  it("rules out classes with too small a boot, even when the seats fit", () => {
    // A saloon seats 4 but holds only 2 large cases.
    const options = suitableSlugs(4, 3);
    expect(options).not.toContain("saloon");
    expect(options).toContain("estate");
  });

  it("explains why a class is unavailable rather than just disabling it", () => {
    const saloon = vehicleOptionsFor({ passengers: 6, largeBags: 6 }).find(
      (option) => option.vehicle.slug === "saloon",
    );

    expect(saloon?.suitable).toBe(false);
    expect(saloon?.reason).toContain("seats 4 passengers");
    expect(saloon?.reason).toContain("holds 2 large cases");
  });

  it("returns every class, suitable or not, so the list stays complete", () => {
    expect(vehicleOptionsFor({ passengers: 16, largeBags: 14 })).toHaveLength(6);
  });

  it("leaves only the minibus for a very large party", () => {
    expect(suitableSlugs(12, 10)).toEqual(["minibus-16"]);
  });
});

describe("recommendedVehicle", () => {
  it("preselects the cheapest class that fits", () => {
    expect(recommendedVehicle({ passengers: 2, largeBags: 2 })?.slug).toBe("saloon");
  });

  it("steps up when the luggage does not fit the cheapest", () => {
    expect(recommendedVehicle({ passengers: 4, largeBags: 3 })?.slug).toBe("estate");
  });

  it("returns null when nothing can carry the party", () => {
    expect(recommendedVehicle({ passengers: 20, largeBags: 0 })).toBeNull();
    expect(hasAnySuitableVehicle({ passengers: 20, largeBags: 0 })).toBe(false);
  });
});
