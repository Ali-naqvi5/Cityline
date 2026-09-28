import "server-only";

import { siteUrl } from "@/lib/company";
import { payloadClient } from "@/lib/payload";
import { stripe } from "@/lib/stripe";

import {
  checkoutIdempotencyKey,
  checkoutSessionParams,
  type QuoteForCheckout,
} from "./checkout-session";

export type CheckoutForQuote =
  /** Render the payment form with this client secret. */
  | { state: "ready"; clientSecret: string }
  /** Already paid — send the customer to the return page to see their booking. */
  | { state: "paid"; sessionId: string }
  /** Stripe let the session lapse; the quote has to be priced again. */
  | { state: "expired" };

/**
 * The quote's Checkout Session: the existing one if there is one, otherwise a
 * new one.
 *
 * Called while rendering step 4, and only for a quote that has not expired —
 * the page checks that first. That is where BK-08's 30-minute limit is
 * enforced: no new session for a stale price. A session that already exists is
 * honoured until Stripe expires it, so a customer who started paying at minute
 * 29 is not cut off at minute 30.
 */
export async function checkoutForQuote(
  quote: QuoteForCheckout & { stripeCheckoutSessionId: string | null },
): Promise<CheckoutForQuote> {
  const client = stripe();

  if (quote.stripeCheckoutSessionId) {
    const session = await client.checkout.sessions.retrieve(
      quote.stripeCheckoutSessionId,
    );

    if (session.status === "complete") return { state: "paid", sessionId: session.id };
    if (session.status === "expired") return { state: "expired" };
    if (session.client_secret)
      return { state: "ready", clientSecret: session.client_secret };
  }

  const session = await client.checkout.sessions.create(
    checkoutSessionParams(quote, siteUrl()),
    { idempotencyKey: checkoutIdempotencyKey(quote.id) },
  );

  if (!session.client_secret) {
    throw new Error(`Checkout Session ${session.id} came back without a client secret.`);
  }

  // Remembered on the quote so a reload reuses it, and so fulfilment can check
  // that the session it is handed really belongs to this quote.
  const payload = await payloadClient();
  await payload.update({
    collection: "quotes",
    id: quote.id,
    data: { stripeCheckoutSessionId: session.id },
    overrideAccess: true,
  });

  return { state: "ready", clientSecret: session.client_secret };
}
