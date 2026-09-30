import { describe, expect, it } from "vitest";

import {
  addDays,
  dayHeading,
  isValidDay,
  londonDay,
  londonDayBounds,
  mondayOf,
  pickupLabel,
  relative,
} from "./format";

describe("London days", () => {
  it("knows which London day an instant falls on, across midnight in summer", () => {
    // 23:30 UTC on 30 Sep is 00:30 on 1 Oct in London (BST).
    expect(londonDay(new Date("2026-09-30T23:30:00Z"))).toBe("2026-10-01");
    expect(londonDay(new Date("2026-12-14T23:30:00Z"))).toBe("2026-12-14");
  });

  it("gives a day's bounds in UTC, including the short and long clock-change days", () => {
    const summer = londonDayBounds("2026-07-01");
    expect(summer.start.toISOString()).toBe("2026-06-30T23:00:00.000Z");
    expect(summer.end.toISOString()).toBe("2026-07-01T23:00:00.000Z");

    // 25 Oct 2026: clocks go back, so the day is 25 hours long.
    const autumn = londonDayBounds("2026-10-25");
    expect((autumn.end.getTime() - autumn.start.getTime()) / 3_600_000).toBe(25);

    // 29 Mar 2026: clocks go forward, so the day is 23 hours long.
    const spring = londonDayBounds("2026-03-29");
    expect((spring.end.getTime() - spring.start.getTime()) / 3_600_000).toBe(23);
  });

  it("adds days and finds the Monday of a week", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(mondayOf("2026-10-01")).toBe("2026-09-28"); // a Thursday
    expect(mondayOf("2026-10-04")).toBe("2026-09-28"); // a Sunday
    expect(mondayOf("2026-09-28")).toBe("2026-09-28"); // a Monday
  });

  it("accepts only real dates", () => {
    expect(isValidDay("2026-02-28")).toBe(true);
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("2026-2-3")).toBe(false);
    expect(isValidDay("")).toBe(false);
  });
});

describe("labels", () => {
  it("shows a pickup in London time", () => {
    expect(pickupLabel(new Date("2026-10-01T09:30:00Z"))).toBe("Thu 1 Oct · 10:30");
    expect(dayHeading("2026-10-01")).toBe("Thursday 1 October");
  });

  it("says how far away something is", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    expect(relative(new Date("2026-10-01T10:45:00Z"), now)).toBe("in 45 min");
    expect(relative(new Date("2026-10-02T04:00:00Z"), now)).toBe("in 18 h");
    expect(relative(new Date("2026-09-28T10:00:00Z"), now)).toBe("3 d ago");
    expect(relative(now, now)).toBe("now");
  });
});
