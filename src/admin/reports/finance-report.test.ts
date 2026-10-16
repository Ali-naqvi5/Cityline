import { describe, expect, it } from "vitest";

import {
  byBucket,
  bySource,
  linesOf,
  moneyUnit,
  type Movement,
  type MovementKind,
} from "./finance-report";

function move(
  kind: MovementKind,
  amount: number,
  overrides: Partial<Movement> = {},
): Movement {
  const out = ["refund", "card_fee", "driver_pay", "partner_penalty", "expense"].includes(
    kind,
  );
  return {
    day: "2026-10-02",
    at: "2026-10-02T10:00:00.000Z",
    kind,
    record: "X",
    recordHref: null,
    bookings: [],
    source: "website",
    sourceLabel: "Website",
    detail: "",
    inPence: out ? 0 : amount,
    outPence: out ? amount : 0,
    ...overrides,
  };
}

const movements: Movement[] = [
  move("card_payment", 13600),
  move("card_fee", 448),
  move("refund", 6800),
  move("driver_pay", 4000),
  move("office_payment", 9000, { source: "office", sourceLabel: "Office" }),
  move("office_cash", 5500, { source: "office", sourceLabel: "Office" }),
  move("driver_pay", 3500, { source: "office", sourceLabel: "Office" }),
  move("partner_receipt", 8000, { source: "partner-2", sourceLabel: "Blue Cars" }),
  move("partner_receipt", 12000, { source: "partner-3", sourceLabel: "Airport Co" }),
  move("driver_pay", 5000, { source: "partner-3", sourceLabel: "Airport Co" }),
  move("expense", 2500, {
    source: "cityline",
    sourceLabel: "Cityline's own costs",
    day: "2026-10-09",
  }),
];

describe("the money in and out", () => {
  it("adds each line up, and profit is in less out", () => {
    expect(linesOf(movements)).toEqual({
      cardPence: 13600,
      officePence: 9000,
      cashPence: 5500,
      partnerPence: 20000,
      penaltiesFromDriversPence: 0,
      inPence: 48100,
      refundsPence: 6800,
      feesPence: 448,
      driversPence: 12500,
      penaltiesPence: 0,
      expensesPence: 2500,
      outPence: 22248,
      profitPence: 25852,
    });
  });

  it("splits by where the money came from: website, office, then partners by money in", () => {
    const rows = bySource(movements);
    expect(rows.map((row) => row.label)).toEqual([
      "Website",
      "Office",
      "Airport Co",
      "Blue Cars",
    ]);
    expect(rows[0]).toMatchObject({
      inPence: 13600,
      refundsPence: 6800,
      feesPence: 448,
      driversPence: 4000,
      netPence: 13600 - 6800 - 448 - 4000,
    });
    expect(rows[1]).toMatchObject({
      inPence: 14500,
      driversPence: 3500,
      netPence: 11000,
    });
  });

  it("takes a partner's penalty off, less the driver's share, on that partner's row", () => {
    // £100 of bookings, less a £10 penalty: £90 reached the bank. £5 of it
    // came off the driver's £35, so £30 went to them.
    const partner = { source: "partner-2", sourceLabel: "Blue Cars" };
    const fined = [
      move("partner_receipt", 10000, partner),
      move("partner_penalty", 1000, partner),
      move("driver_pay", 3500, partner),
      move("penalty_from_driver", 500, partner),
    ];
    expect(linesOf(fined)).toMatchObject({
      partnerPence: 10000,
      penaltiesFromDriversPence: 500,
      penaltiesPence: 1000,
      profitPence: 10000 - 1000 - 3500 + 500,
    });
    expect(bySource(fined)[0]).toMatchObject({
      inPence: 10000,
      penaltiesPence: 500,
      driversPence: 3500,
      netPence: 6000,
    });
  });

  it("keeps Cityline's own expenses out of the split", () => {
    expect(bySource(movements).some((row) => row.key === "cityline")).toBe(false);
  });
});

describe("the chart's buckets", () => {
  it("counts by day up to a month, by week up to four months, then by month", () => {
    expect(moneyUnit(31)).toBe("day");
    expect(moneyUnit(90)).toBe("week");
    expect(moneyUnit(366)).toBe("month");
  });

  it("has every day of the period, with nothing where nothing moved", () => {
    const { unit, buckets } = byBucket(movements, {
      from: "2026-10-01",
      to: "2026-10-10",
      days: 10,
    });
    expect(unit).toBe("day");
    expect(buckets).toHaveLength(10);
    expect(buckets[1]!.lines.profitPence).toBe(25852 + 2500);
    expect(buckets[8]!.lines.profitPence).toBe(-2500);
    expect(buckets[0]!.lines.inPence).toBe(0);
  });

  it("groups a year by month", () => {
    const { buckets } = byBucket(movements, {
      from: "2026-01-01",
      to: "2026-12-31",
      days: 365,
    });
    expect(buckets.map((bucket) => bucket.key)).toHaveLength(12);
    expect(buckets[9]).toMatchObject({ key: "2026-10-01", label: "Oct 2026" });
    expect(buckets[9]!.lines.profitPence).toBe(25852);
  });
});
