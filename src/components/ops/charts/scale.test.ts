import { describe, expect, it } from "vitest";

import { counted, niceMax, percent } from "./scale";

describe("chart scales", () => {
  it("rounds an axis top up to a clean number", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(4)).toBe(5);
    expect(niceMax(7)).toBe(8);
    expect(niceMax(23)).toBe(25);
    expect(niceMax(140)).toBe(150);
    expect(niceMax(1000)).toBe(1000);
  });

  it("writes shares as whole percentages without hiding small ones", () => {
    expect(percent(0.423)).toBe("42%");
    expect(percent(0.004)).toBe("<1%");
    expect(percent(0)).toBe("0%");
  });

  it("counts in words", () => {
    expect(counted(1, "booking")).toBe("1 booking");
    expect(counted(3, "booking")).toBe("3 bookings");
  });
});
