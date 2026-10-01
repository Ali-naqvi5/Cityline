import { describe, expect, it } from "vitest";

import { summarise, type SummaryJob } from "./summary";

const now = new Date("2026-10-02T12:00:00Z");
const job = (
  status: SummaryJob["status"],
  pickupAt: string,
  price = 5000,
): SummaryJob => ({
  status,
  pickupAt,
  customerPricePence: price,
});

describe("a customer's history in figures", () => {
  it("counts bookings, outcomes, what is coming and what it is worth", () => {
    const summary = summarise(
      [
        job("completed", "2026-09-01T10:00:00Z"),
        job("completed", "2026-09-20T10:00:00Z", 6000),
        job("no_show", "2026-09-25T10:00:00Z"),
        job("cancelled", "2026-09-28T10:00:00Z", 9900),
        job("assigned", "2026-10-05T10:00:00Z"),
        job("unassigned", "2026-10-03T10:00:00Z"),
      ],
      now,
    );
    expect(summary).toMatchObject({
      bookings: 6,
      completed: 2,
      noShows: 1,
      cancelled: 1,
      upcoming: 2,
      valuePence: 26000,
    });
    expect(summary.lastTrip?.toISOString()).toBe("2026-09-20T10:00:00.000Z");
    expect(summary.nextTrip?.toISOString()).toBe("2026-10-03T10:00:00.000Z");
  });

  it("has no last or next trip for someone new", () => {
    expect(summarise([], now)).toMatchObject({
      bookings: 0,
      lastTrip: null,
      nextTrip: null,
    });
  });

  it("does not count an open booking whose pickup has passed as upcoming", () => {
    expect(summarise([job("on_board", "2026-10-02T11:00:00Z")], now).upcoming).toBe(0);
  });
});
