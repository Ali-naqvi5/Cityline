import { describe, expect, it } from "vitest";

import { formatDateTime, formatTime, londonDateAndTime, londonToUtc } from "./time";

describe("londonToUtc", () => {
  it("treats winter wall time as GMT", () => {
    // In January London is UTC, so the instant is the wall time unchanged.
    expect(londonToUtc("2027-01-14", "09:05").toISOString()).toBe(
      "2027-01-14T09:05:00.000Z",
    );
  });

  it("treats summer wall time as BST — an hour ahead of UTC", () => {
    // A 09:05 pickup in July is 08:05 UTC. Storing 09:05 would send the driver
    // an hour late.
    expect(londonToUtc("2027-07-14", "09:05").toISOString()).toBe(
      "2027-07-14T08:05:00.000Z",
    );
  });

  it("round-trips back to the same wall clock the customer typed", () => {
    // The real guarantee: whatever conversion happens, the passenger and the
    // driver must both read back the time that was booked.
    for (const [date, time] of [
      ["2026-03-28", "23:30"], // the night before the clocks go forward
      ["2026-03-29", "09:00"], // the morning after
      ["2026-06-21", "04:15"], // deep in BST
      ["2026-10-25", "09:00"], // the morning after the clocks go back
      ["2026-12-25", "00:05"], // Christmas, GMT
    ] as const) {
      expect(formatTime(londonToUtc(date, time)), `${date} ${time}`).toBe(time);
    }
  });

  it("puts a pickup on the right side of midnight", () => {
    // 00:30 BST is 23:30 UTC the previous day. A naive conversion shifts the
    // booking to the wrong calendar day, which is how a run sheet loses a job.
    const instant = londonToUtc("2026-07-02", "00:30");
    expect(instant.toISOString()).toBe("2026-07-01T23:30:00.000Z");
    expect(formatDateTime(instant)).toContain("2 Jul 2026");
  });

  it("resolves the spring-forward gap to the earlier instant", () => {
    // 01:30 on 29 March 2026 never happens: 01:00 GMT becomes 02:00 BST. There
    // is no right answer, so the rule is the same as the overlap - err early.
    expect(londonToUtc("2026-03-29", "01:30").toISOString()).toBe(
      "2026-03-29T00:30:00.000Z",
    );
  });

  it("resolves the autumn overlap to the earlier, BST occurrence", () => {
    // 01:30 on 25 October 2026 happens twice. Early is safer than late.
    expect(londonToUtc("2026-10-25", "01:30").toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });

  it("rejects something that is not a date and time", () => {
    expect(() => londonToUtc("not-a-date", "09:00")).toThrow(RangeError);
    expect(() => londonToUtc("2027-01-14", "half nine")).toThrow(RangeError);
  });
});

describe("londonToUtc across a whole clock-change weekend", () => {
  /**
   * The hand-picked cases above missed a regression that shifted every booking
   * in the twelve hours *before* a spring change. So sweep every half hour of
   * both transition weekends and assert the round trip, skipping only the
   * spring gap where no round trip exists.
   */
  const sweep = (from: string, days: number): string[] => {
    const broken: string[] = [];
    const start = Date.parse(`${from}T00:00:00Z`);

    for (let minutes = 0; minutes < days * 24 * 60; minutes += 30) {
      const at = new Date(start + minutes * 60_000);
      const [date, time] = [
        at.toISOString().slice(0, 10),
        at.toISOString().slice(11, 16),
      ] as [string, string];

      const readBack = formatTime(londonToUtc(date, time));
      if (readBack !== time) broken.push(`${date} ${time} -> ${readBack}`);
    }

    return broken;
  };

  it("round-trips every half hour around the spring change, bar the gap", () => {
    // 29 March 2026: 01:00 GMT becomes 02:00 BST, so 01:00 and 01:30 never
    // happen. Everything else must survive.
    expect(sweep("2026-03-27", 4)).toEqual([
      "2026-03-29 01:00 -> 00:00",
      "2026-03-29 01:30 -> 00:30",
    ]);
  });

  it("round-trips every half hour around the autumn change", () => {
    // 25 October 2026: 02:00 BST becomes 01:00 GMT. Every wall time exists
    // here — two of them twice — so nothing may drift.
    expect(sweep("2026-10-23", 4)).toEqual([]);
  });
});

describe("londonDateAndTime", () => {
  it("is the inverse of londonToUtc, in summer and winter", () => {
    for (const [date, time] of [
      ["2027-01-14", "09:05"],
      ["2027-07-14", "09:05"],
      ["2026-07-02", "00:30"],
    ] as const) {
      expect(londonDateAndTime(londonToUtc(date, time))).toEqual({ date, time });
    }
  });
});
