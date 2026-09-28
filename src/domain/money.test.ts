import { describe, expect, it } from "vitest";
import {
  applyBasisPoints,
  formatPence,
  parsePounds,
  roundToNearestPound,
  sumPence,
  vatFromGross,
} from "./money";

describe("parsePounds", () => {
  it("reads the shapes a price table or a controller actually types", () => {
    expect(parsePounds("12.34")).toBe(1234);
    expect(parsePounds("£12.34")).toBe(1234);
    expect(parsePounds(" 12 ")).toBe(1200);
    expect(parsePounds("1,234.50")).toBe(123_450);
    expect(parsePounds("12.5")).toBe(1250);
    expect(parsePounds("-7.50")).toBe(-750);
  });

  it("returns null rather than guessing", () => {
    expect(parsePounds("")).toBeNull();
    expect(parsePounds("twelve")).toBeNull();
    expect(parsePounds("12.345")).toBeNull();
    expect(parsePounds("12.34.56")).toBeNull();
  });
});

describe("formatPence", () => {
  it("always shows two decimals", () => {
    expect(formatPence(1234)).toBe("£12.34");
    expect(formatPence(1200)).toBe("£12.00");
    expect(formatPence(5)).toBe("£0.05");
    expect(formatPence(0)).toBe("£0.00");
    expect(formatPence(123_450)).toBe("£1,234.50");
    expect(formatPence(-750)).toBe("-£7.50");
  });

  it("refuses fractional pence instead of rendering them wrong", () => {
    expect(() => formatPence(12.5)).toThrow();
  });
});

describe("applyBasisPoints", () => {
  it("computes supplier commission", () => {
    // Trip.com at 18% on a £85.00 fare.
    expect(applyBasisPoints(8500, 1800)).toBe(1530);
    expect(applyBasisPoints(8500, 0)).toBe(0);
  });

  it("rounds to whole pence", () => {
    expect(applyBasisPoints(1999, 1800)).toBe(360); // 359.82 -> 360
  });
});

describe("roundToNearestPound", () => {
  it("rounds quoted fares to £1 (§7 step 7)", () => {
    expect(roundToNearestPound(4249)).toBe(4200);
    expect(roundToNearestPound(4250)).toBe(4300);
    expect(roundToNearestPound(4251)).toBe(4300);
    expect(roundToNearestPound(0)).toBe(0);
  });
});

describe("sumPence", () => {
  it("adds without float drift", () => {
    expect(sumPence(10, 20, 30)).toBe(60);
    // The classic 0.1 + 0.2 case, in pence.
    expect(sumPence(10, 20)).toBe(30);
    expect(sumPence()).toBe(0);
  });
});

describe("vatFromGross", () => {
  it("extracts VAT contained in a gross price at 20%", () => {
    expect(vatFromGross(12_000, 2000)).toBe(2000); // £120.00 gross -> £20.00 VAT
    expect(vatFromGross(8500, 2000)).toBe(1417);
  });
});
