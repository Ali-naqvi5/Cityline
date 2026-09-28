import "server-only";

import { payloadClient } from "@/lib/payload";

import type { FunnelParams } from "./funnel-params";
import type { PassengerDetails } from "./passenger";
import {
  isExpired,
  quoteRequestSchema,
  quoteResultsSchema,
  type QuoteResults,
} from "./quote-session";

/**
 * Loads a quote by its token, for step 4 and (later) the confirmation page.
 *
 * Four outcomes rather than a nullable row, because the caller has to do
 * something different for each and a `null` would flatten them into one:
 *
 *   `missing`  — no token, nothing matches, or the row failed validation.
 *                Start again.
 *   `booked`   — already paid for and turned into a booking. The customer
 *                pressed Back after paying, or reopened the tab: show them the
 *                booking. Offering "get a new price" here, as this once did,
 *                invites them to pay a second time.
 *   `expired`  — past `expiresAt`. §7 wants a real screen for this, not a
 *                redirect, and the journey comes back so re-quoting is one
 *                click.
 *   `ok`       — a live quote, validated.
 *
 * Everything read from the row is parsed before use. A `quotes.request`
 * written by an older release, or edited in the admin, must fail loudly here
 * rather than quietly become a booking.
 */
export type LoadedQuote =
  | { state: "missing" }
  | { state: "booked"; reference: string }
  | { state: "expired"; journey: FunnelParams }
  | {
      state: "ok";
      id: number;
      token: string;
      /** Set once step 4 has opened a Checkout Session for this quote. */
      stripeCheckoutSessionId: string | null;
      journey: FunnelParams;
      details: PassengerDetails;
      extras: Record<string, number>;
      results: QuoteResults;
      expiresAt: Date;
    };

export async function loadQuote(token: string): Promise<LoadedQuote> {
  if (!token) return { state: "missing" };

  const payload = await payloadClient();
  const found = await payload.find({
    collection: "quotes",
    where: { token: { equals: token } },
    limit: 1,
    // A quote is read before anyone has authenticated — this is the customer
    // mid-checkout, not a logged-in user.
    overrideAccess: true,
  });

  const row = found.docs[0];
  if (!row) return { state: "missing" };

  const request = quoteRequestSchema.safeParse(row.request);
  if (!request.success) {
    // A row we cannot make sense of is worse than no row: it could put bad
    // data into a booking. Treat it as missing and make them re-quote.
    return { state: "missing" };
  }

  if (row.status === "converted") {
    const booked = await payload.find({
      collection: "bookings",
      where: { quote: { equals: row.id } },
      limit: 1,
      overrideAccess: true,
    });

    const booking = booked.docs[0];
    if (booking) return { state: "booked", reference: booking.reference };
  }

  if (row.status !== "open" || isExpired(row.expiresAt)) {
    return { state: "expired", journey: request.data.journey };
  }

  const results = quoteResultsSchema.safeParse(row.results);
  if (!results.success) return { state: "missing" };

  return {
    state: "ok",
    id: row.id,
    token,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId ?? null,
    journey: request.data.journey,
    details: request.data.details,
    extras: request.data.extras,
    results: results.data,
    expiresAt: new Date(row.expiresAt),
  };
}
