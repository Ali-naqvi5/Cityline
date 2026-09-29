import { describe, expect, it } from "vitest";

import {
  bookingWindowMessage,
  checkBookingWindow,
  noticeInWords,
  noticePhrase,
} from "./booking-window";
import { parseFunnelParams } from "./funnel-params";

// 12:00 London on 29 Sep 2026 (BST, so 11:00 UTC).
const NOON = new Date("2026-09-29T11:00:00Z");

const journey = (params: Record<string, string>) =>
  parseFunnelParams({
    pickup: "Heathrow Terminal 5",
    dropoff: "Uxbridge",
    passengers: "2",
    ...params,
  });

describe("checkBookingWindow", () => {
  it("accepts a pickup exactly three hours away", () => {
    expect(
      checkBookingWindow(journey({ date: "2026-09-29", time: "15:00" }), NOON),
    ).toBeNull();
  });

  it("refuses a pickup a minute inside three hours", () => {
    expect(
      checkBookingWindow(journey({ date: "2026-09-29", time: "14:59" }), NOON),
    ).toMatchObject({ reason: "too_soon", leg: "outbound" });
  });

  it("refuses a pickup with no date or time", () => {
    expect(checkBookingWindow(journey({ date: "", time: "" }), NOON)).toMatchObject({
      reason: "missing_time",
      leg: "outbound",
    });
  });

  it("refuses a malformed time from a hand-edited link", () => {
    expect(
      checkBookingWindow(journey({ date: "2026-09-29", time: "25:99" }), NOON)?.reason,
    ).toBe("missing_time");
  });

  it("refuses a return that is not after the outbound", () => {
    const problem = checkBookingWindow(
      journey({
        date: "2026-10-05",
        time: "10:00",
        return: "yes",
        returnDate: "2026-10-05",
        returnTime: "09:00",
      }),
      NOON,
    );
    expect(problem?.reason).toBe("return_before_outbound");
  });

  it("accepts a return a week later", () => {
    expect(
      checkBookingWindow(
        journey({
          date: "2026-10-05",
          time: "10:00",
          return: "yes",
          returnDate: "2026-10-12",
          returnTime: "18:00",
        }),
        NOON,
      ),
    ).toBeNull();
  });

  it("checks the return leg's own horizon", () => {
    const problem = checkBookingWindow(
      journey({
        date: "2026-10-05",
        time: "10:00",
        return: "yes",
        returnDate: "2028-10-05",
        returnTime: "10:00",
      }),
      NOON,
    );
    expect(problem).toMatchObject({ reason: "too_far_ahead", leg: "return" });
  });

  it("ignores return fields on an hourly hire", () => {
    expect(
      checkBookingWindow(
        journey({
          service: "hourly",
          hours: "4",
          date: "2026-10-05",
          time: "10:00",
          return: "yes",
          returnDate: "2026-10-01",
          returnTime: "10:00",
        }),
        NOON,
      ),
    ).toBeNull();
  });
});

describe("bookingWindowMessage", () => {
  it("says how much notice is needed, in words", () => {
    const message = bookingWindowMessage({
      reason: "too_soon",
      minNoticeMinutes: 180,
      leg: "outbound",
    });
    expect(message).toContain("at least 3 hours' notice");
    expect(message).toContain("call us");
  });

  it("names the return leg when that is the problem", () => {
    expect(
      bookingWindowMessage({ reason: "too_soon", minNoticeMinutes: 180, leg: "return" }),
    ).toContain("your return journey");
  });

  it("names a blackout date in London's format", () => {
    expect(
      bookingWindowMessage({
        reason: "blackout_date",
        date: "2026-12-25",
        leg: "outbound",
      }),
    ).toContain("25 Dec 2026");
  });
});

describe("noticeInWords and noticePhrase", () => {
  it("speaks in hours where it can", () => {
    expect(noticeInWords(180)).toBe("3 hours");
    expect(noticeInWords(60)).toBe("1 hour");
    expect(noticeInWords(90)).toBe("90 minutes");
  });

  it("puts the apostrophe where English does", () => {
    expect(noticePhrase(180)).toBe("3 hours' notice");
    expect(noticePhrase(60)).toBe("1 hour's notice");
    expect(noticePhrase(90)).toBe("90 minutes' notice");
  });
});
