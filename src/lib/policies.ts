/**
 * The promises the website makes to customers. Confirmed by Cityline on
 * 20 Sep 2026; they may change, which is why they live in one place and are
 * never written inline into page copy.
 *
 * In S8 these move to the Payload `booking_rules` global (ADM-01).
 *
 * Note what is NOT here: anything about watching your flight. Cityline has
 * confirmed that capability will never be built, so no page may promise it.
 * The rule is enforced by `domain/compliance/unsupported-claims.ts`, which
 * fails the build on the designs' phrasing.
 */
export const policies = {
  /** Free waiting time from the moment the flight lands, in minutes. */
  airportFreeWaitingMinutes: 60,
  /** Free waiting time on a non-airport pickup, in minutes. */
  standardFreeWaitingMinutes: 15,

  /** Free cancellation window before pickup, in hours. */
  freeCancellationHours: 24,
  /** Refund within that window, in percent. */
  freeCancellationRefundPercent: 100,

  /** No surcharge for paying by card (PAY-01). */
  cardFeesCharged: false,
  /** Fares are fixed at booking and never rise with demand. */
  surgePricing: false,

  /** Meet and greet inside arrivals is included on airport pickups. */
  meetAndGreetIncluded: true,

  /** Complaints: acknowledged within, then resolved within, in working days. */
  complaintAcknowledgeWorkingDays: 2,
  complaintResolveWorkingDays: 10,

  /**
   * How long complaint and lost-property records are kept (CMP-05). A TfL
   * licence condition, so it is stated to customers rather than left implicit.
   */
  recordRetentionMonths: 12,
} as const;

/** Phrases reused across pages, so the numbers can never drift apart. */
export const policyCopy = {
  airportWaiting: `${policies.airportFreeWaitingMinutes} minutes free waiting time at the airport`,
  cancellation: `Free cancellation up to ${policies.freeCancellationHours} hours before pickup, with a ${policies.freeCancellationRefundPercent}% refund`,
  fixedFare: "Your fare is agreed and fixed before you travel",
  noCardFees: "No card fees",
} as const;
