import { z } from "zod";

import { bookingRules } from "./rules";

/**
 * Step 1 of the funnel: where, when, how many (BK-01 … BK-05).
 *
 * The same schema runs on the client and on the server (§10). The server is the
 * one that counts — a client can send anything, and the price is recalculated
 * server-side regardless (BK-08).
 */

/** Where a leg starts or ends. Airports and terminals are ranked first (BK-02). */
export const placeKinds = [
  "airport",
  "terminal",
  "station",
  "seaport",
  "hotel",
  "address",
] as const;
export type PlaceKind = (typeof placeKinds)[number];

export const placeRefSchema = z.object({
  kind: z.enum(placeKinds),
  /** What the customer sees, e.g. "Heathrow Terminal 5". */
  label: z.string().min(2).max(240),
  /** Google Places id, when the customer picked a suggestion (BK-02). */
  googlePlaceId: z.string().max(400).optional(),
  /** Our own `places` / `terminals` row, when it is somewhere we know. */
  placeId: z.string().max(64).optional(),
  terminalId: z.string().max(64).optional(),
  postcode: z.string().max(12).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type PlaceRef = z.infer<typeof placeRefSchema>;

/**
 * Flight designator: an airline code then 1–4 digits.
 *
 * The airline code is a 2-letter IATA code (BA), a letter-digit or digit-letter
 * IATA code (U2, 3K), or a 3-letter ICAO code (EZY). The alternatives are
 * ordered longest-first, and the code may not swallow a digit of the number —
 * otherwise "BA12345" would parse as airline "BA1", flight "2345".
 *
 * Stored uppercase without spaces so a controller can search for it (JOB-11).
 */
export const flightNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^(?:[A-Z]{3}|[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{1,4}$/,
    "Enter a flight number such as BA117",
  )
  .transform((value) => value.replace(/\s+/g, ""));

const legBase = z.object({
  pickup: placeRefSchema,
  dropoff: placeRefSchema,
  /** Always UTC (NFR-08); the widget converts from Europe/London. */
  pickupAt: z.coerce.date(),
  viaStops: z.array(placeRefSchema).default([]),
  /** Required when the pickup is an airport or terminal (BK-03). */
  flightNumber: flightNumberSchema.optional(),
});

export const journeySchema = z
  .object({
    outbound: legBase,
    /** Return journey (BK-04); its pickup and drop-off are swapped. */
    returnLeg: legBase.partial({ pickup: true, dropoff: true }).optional(),
    passengers: z.number().int().min(1),
    largeBags: z.number().int().min(0),
    smallBags: z.number().int().min(0),
  })
  .superRefine((value, ctx) => {
    const rules = bookingRules();

    if (value.passengers > rules.maxPassengers) {
      ctx.addIssue({
        code: "custom",
        path: ["passengers"],
        message: `We can carry up to ${rules.maxPassengers} passengers in one vehicle. Please contact us for a group quote.`,
      });
    }

    if (value.largeBags > rules.maxLargeBags) {
      ctx.addIssue({
        code: "custom",
        path: ["largeBags"],
        message: `Please contact us for more than ${rules.maxLargeBags} large bags.`,
      });
    }

    if (value.smallBags > rules.maxSmallBags) {
      ctx.addIssue({
        code: "custom",
        path: ["smallBags"],
        message: `Please contact us for more than ${rules.maxSmallBags} small bags.`,
      });
    }

    if (value.outbound.viaStops.length > rules.maxViaStops) {
      ctx.addIssue({
        code: "custom",
        path: ["outbound", "viaStops"],
        message: `Up to ${rules.maxViaStops} extra stops can be booked online.`,
      });
    }

    // A return leg must leave after the outbound pickup, not before it.
    if (
      value.returnLeg &&
      value.returnLeg.pickupAt.getTime() <= value.outbound.pickupAt.getTime()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["returnLeg", "pickupAt"],
        message: "The return journey must be after the outbound journey.",
      });
    }

    // A flight number is how the office knows when to send the driver (BK-03).
    const pickupKind = value.outbound.pickup.kind;
    if (
      (pickupKind === "airport" || pickupKind === "terminal") &&
      !value.outbound.flightNumber
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["outbound", "flightNumber"],
        message: "Please give your flight number so we can meet your flight.",
      });
    }
  });

export type Journey = z.infer<typeof journeySchema>;

/**
 * Timing rules, kept separate from the schema so the funnel can re-check them
 * at payment: a customer who leaves the tab open for two hours may have drifted
 * inside the minimum notice window (BK-05, and the "pickup too soon" error
 * state in §7).
 */
export type TimingProblem =
  | { reason: "too_soon"; minNoticeMinutes: number }
  | { reason: "too_far_ahead"; maxAdvanceDays: number }
  | { reason: "blackout_date"; date: string };

export function checkPickupTiming(
  pickupAt: Date,
  now = new Date(),
): TimingProblem | null {
  const rules = bookingRules();

  const minutesAway = (pickupAt.getTime() - now.getTime()) / 60_000;
  if (minutesAway < rules.minNoticeMinutes) {
    return { reason: "too_soon", minNoticeMinutes: rules.minNoticeMinutes };
  }

  const daysAway = minutesAway / (60 * 24);
  if (daysAway > rules.maxAdvanceDays) {
    return { reason: "too_far_ahead", maxAdvanceDays: rules.maxAdvanceDays };
  }

  // Blackout dates are London calendar days, not UTC days.
  const londonDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(pickupAt);

  if (rules.blackoutDates.includes(londonDate)) {
    return { reason: "blackout_date", date: londonDate };
  }

  return null;
}

/**
 * The earliest date a customer can pick, as `yyyy-mm-dd` in London time, so a
 * date picker cannot offer a day we would only reject later (BK-05).
 *
 * Lives here rather than in a component: it reads the clock, which makes it
 * impure, and it is the kind of off-by-one-day logic that deserves a test.
 */
export function earliestBookableDate(now: Date = new Date()): string {
  const rules = bookingRules();
  const earliest = new Date(now.getTime() + rules.minNoticeMinutes * 60_000);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(earliest);
}
