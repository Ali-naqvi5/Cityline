/**
 * Booking rules (BK-05, ADM-01).
 *
 * These are the defaults. In S8 they move to the Payload `booking_rules` global
 * so the office can change them without a deployment — which is why nothing
 * here is hard-coded at the point of use: every rule is read through
 * `bookingRules()`.
 *
 * Several of these are open decisions (§17) and need Cityline's answer before
 * launch: minimum notice, free waiting minutes, cancellation windows.
 */
export interface BookingRules {
  /** How far ahead a website booking must be made (BK-05). */
  minNoticeMinutes: number;
  /** How far ahead bookings are accepted at all. */
  maxAdvanceDays: number;
  /** Quote lifetime before the price must be recalculated (BK-08). */
  quoteTtlMinutes: number;
  /** Most passengers any vehicle class can carry — the funnel caps here. */
  maxPassengers: number;
  maxLargeBags: number;
  maxSmallBags: number;
  /** Extra pick-up or drop-off points on one leg (BK-04). */
  maxViaStops: number;
  /** ISO dates (yyyy-mm-dd) on which the website takes no bookings (BK-05). */
  blackoutDates: readonly string[];
  /** Cap on website bookings accepted per calendar day (BK-05); 0 = no cap. */
  dailyBookingCap: number;
}

const DEFAULTS: BookingRules = {
  // TODO(Cityline): confirm — §17 lists minimum notice as an open decision.
  minNoticeMinutes: 180,
  maxAdvanceDays: 365,
  quoteTtlMinutes: 30,
  maxPassengers: 16,
  maxLargeBags: 16,
  maxSmallBags: 16,
  maxViaStops: 3,
  blackoutDates: [],
  dailyBookingCap: 0,
};

export function bookingRules(): BookingRules {
  // TODO(S8): read the `booking_rules` global from Payload, falling back here.
  return DEFAULTS;
}
