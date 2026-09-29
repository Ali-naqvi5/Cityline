import "server-only";

import { payloadClient } from "@/lib/payload";
import { londonToUtc } from "@/lib/time";

import { checkBookingWindow, type BookingWindowProblem } from "./booking-window";
import { returnLegOf, type FunnelParams } from "./funnel-params";
import { bookingRules } from "./rules";

/**
 * Every BK-05 rule, including the one that needs the database: the daily cap.
 *
 * The cap counts **pickups on the day**, not bookings made that day. What runs
 * out is cars and drivers on a given date, and a booking made today for next
 * Friday uses next Friday's capacity. Cancelled jobs and test bookings do not
 * count. Each leg is checked against its own date, since a return trip uses a
 * car on two days.
 *
 * With the cap at 0 — its default until the admin can set it (S8) — no query
 * runs at all.
 */
export async function checkBookingAvailability(
  journey: FunnelParams,
  now: Date = new Date(),
): Promise<BookingWindowProblem | null> {
  const problem = checkBookingWindow(journey, now);
  if (problem) return problem;

  const cap = bookingRules().dailyBookingCap;
  if (cap <= 0) return null;

  const legs: { leg: "outbound" | "return"; date: string }[] = [
    { leg: "outbound", date: journey.date },
  ];
  const back = returnLegOf(journey);
  if (back) legs.push({ leg: "return", date: back.date });

  const payload = await payloadClient();

  for (const { leg, date } of legs) {
    // One London calendar day, as UTC instants — midnight to midnight.
    const start = londonToUtc(date, "00:00");
    const next = new Date(start.getTime() + 36 * 3_600_000); // safely into tomorrow
    const end = londonToUtc(next.toISOString().slice(0, 10), "00:00");

    const { totalDocs } = await payload.count({
      collection: "jobs",
      where: {
        and: [
          { pickupAt: { greater_than_equal: start.toISOString() } },
          { pickupAt: { less_than: end.toISOString() } },
          { status: { not_equals: "cancelled" } },
          { isTest: { not_equals: true } },
        ],
      },
      overrideAccess: true,
    });

    if (totalDocs >= cap) return { reason: "fully_booked", date, leg };
  }

  return null;
}
