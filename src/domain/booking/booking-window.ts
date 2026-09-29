import { formatDate, londonToUtc } from "@/lib/time";

import { returnLegOf, type FunnelParams } from "./funnel-params";
import { checkPickupTiming, type TimingProblem } from "./journey";
import { bookingRules } from "./rules";

/**
 * When a journey may be booked online (BK-05), checked on the server.
 *
 * The date picker already hides days that are too soon, but a picker is a
 * convenience, not a rule: a hand-edited link, a tab left open overnight, or a
 * time chosen late on today's date all get past it. So the funnel checks here
 * at every step that moves the booking forward — choosing a vehicle, saving the
 * details, and again before taking payment, because a quote can age past the
 * notice period while someone types their card number.
 *
 * Pure: it takes `now` rather than reading the clock, so it is tested at the
 * exact minute boundaries Cityline cares about.
 */
export type BookingWindowProblem =
  | (TimingProblem & { leg: "outbound" | "return" })
  | { reason: "missing_time"; leg: "outbound" | "return" }
  | { reason: "return_before_outbound" }
  /** The daily cap (BK-05) — set by `booking-availability.ts`, which can count. */
  | { reason: "fully_booked"; date: string; leg: "outbound" | "return" };

function pickupInstant(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;

  try {
    return londonToUtc(date, time);
  } catch {
    return null;
  }
}

export function checkBookingWindow(
  journey: FunnelParams,
  now: Date = new Date(),
): BookingWindowProblem | null {
  const outbound = pickupInstant(journey.date, journey.time);
  if (!outbound) return { reason: "missing_time", leg: "outbound" };

  const outboundProblem = checkPickupTiming(outbound, now);
  if (outboundProblem) return { ...outboundProblem, leg: "outbound" };

  const back = returnLegOf(journey);
  if (!back) return null;

  const returnAt = pickupInstant(back.date, back.time);
  if (!returnAt) return { reason: "missing_time", leg: "return" };

  if (returnAt.getTime() <= outbound.getTime())
    return { reason: "return_before_outbound" };

  const returnProblem = checkPickupTiming(returnAt, now);
  return returnProblem ? { ...returnProblem, leg: "return" } : null;
}

/** "3 hours", "90 minutes" — the notice period as a person would say it. */
export function noticeInWords(minutes: number = bookingRules().minNoticeMinutes): string {
  if (minutes % 60 !== 0) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/** "3 hours' notice", "1 hour's notice" — with the apostrophe in the right place. */
export function noticePhrase(minutes: number = bookingRules().minNoticeMinutes): string {
  const words = noticeInWords(minutes);
  return `${words}${words.endsWith("s") ? "'" : "'s"} notice`;
}

/**
 * What to tell the customer. Written for someone who has done nothing wrong —
 * they picked a time we cannot serve online — so each one says what to do next,
 * and the phone number is offered by the caller alongside it.
 */
export function bookingWindowMessage(problem: BookingWindowProblem): string {
  const journey =
    "leg" in problem && problem.leg === "return" ? "your return journey" : "your pickup";

  switch (problem.reason) {
    case "missing_time":
      return `Please choose a date and time for ${journey}.`;
    case "return_before_outbound":
      return "The return journey needs to be after the outbound journey. Please check the dates and times.";
    case "too_soon":
      return `Online bookings need at least ${noticePhrase(problem.minNoticeMinutes)}, and ${journey} is sooner than that. Please choose a later time, or call us and we will do our best to help.`;
    case "too_far_ahead":
      return `We take online bookings up to ${problem.maxAdvanceDays} days ahead, and ${journey} is further away than that. Please call us to arrange it.`;
    case "blackout_date":
      return `We are not taking online bookings for ${formatDate(new Date(`${problem.date}T12:00:00Z`))}. Please call us and we will see what we can do.`;
    case "fully_booked":
      return `We are fully booked online for ${formatDate(new Date(`${problem.date}T12:00:00Z`))}. Please call us — we may still be able to fit you in.`;
  }
}
