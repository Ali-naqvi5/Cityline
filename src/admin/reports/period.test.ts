import { describe, expect, it } from "vitest";

import { buckets, rangeLabel, resolvePeriod } from "./period";

const NOW = new Date("2026-10-02T09:00:00Z"); // Friday 2 Oct, 10:00 in London

describe("report periods", () => {
  it("defaults to this month so far, compared with the same days last month", () => {
    const period = resolvePeriod({}, NOW);
    expect(period).toMatchObject({
      key: "this_month",
      from: "2026-10-01",
      to: "2026-10-02",
      days: 2,
    });
    expect(period.previous).toMatchObject({ from: "2026-09-01", to: "2026-09-02" });
    expect(period.start.toISOString()).toBe("2026-09-30T23:00:00.000Z");
  });

  it("covers last month whole, against the month before", () => {
    const period = resolvePeriod({ period: "last_month" }, NOW);
    expect(period).toMatchObject({ from: "2026-09-01", to: "2026-09-30", days: 30 });
    expect(period.previous).toMatchObject({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("compares this week so far with the same days last week", () => {
    const period = resolvePeriod({ period: "this_week" }, NOW);
    expect(period).toMatchObject({ from: "2026-09-28", to: "2026-10-02", days: 5 });
    expect(period.previous).toMatchObject({ from: "2026-09-21", to: "2026-09-25" });
  });

  it("takes chosen dates in either order, up to a year", () => {
    expect(resolvePeriod({ from: "2026-09-10", to: "2026-09-01" }, NOW)).toMatchObject({
      key: "custom",
      from: "2026-09-01",
      to: "2026-09-10",
      days: 10,
    });
    expect(resolvePeriod({ from: "2020-01-01", to: "2026-09-30" }, NOW).days).toBe(366);
  });

  it("ignores a period it does not know", () => {
    expect(resolvePeriod({ period: "forever" }, NOW).key).toBe("this_month");
  });

  it("clips the comparison month to its length", () => {
    const period = resolvePeriod({}, new Date("2026-03-31T09:00:00Z"));
    expect(period.previous).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("labels ranges the way people write them", () => {
    expect(rangeLabel("2026-10-01", "2026-10-31")).toBe("1–31 Oct 2026");
    expect(rangeLabel("2026-09-28", "2026-10-04")).toBe("28 Sept – 4 Oct 2026");
    expect(rangeLabel("2026-10-02", "2026-10-02")).toBe("2 Oct 2026");
  });

  it("counts by day up to two months and by week beyond", () => {
    expect(buckets(resolvePeriod({ period: "last_30" }, NOW))).toMatchObject({
      unit: "day",
    });
    expect(buckets(resolvePeriod({ period: "last_30" }, NOW)).keys).toHaveLength(30);
    const weekly = buckets(resolvePeriod({ period: "last_90" }, NOW));
    expect(weekly.unit).toBe("week");
    // 90 days back is Sunday 5 Jul; its week starts on Monday 29 Jun.
    expect(weekly.keys[0]).toBe("2026-06-29");
  });
});
