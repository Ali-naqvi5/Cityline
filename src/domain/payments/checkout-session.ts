import type Stripe from "stripe";

import type { QuoteResults } from "@/domain/booking/quote-session";

/**
 * The Checkout Session that pays for a quote (PAY-01).
 *
 * Stripe's recommendation for an embedded payment form is the Payment Element
 * backed by the Checkout Sessions API (`ui_mode: "elements"`), rather than a raw
 * PaymentIntent. The session carries the line items and the customer's email,
 * expires on its own, and its `checkout.session.completed` event is what
 * fulfilment listens for.
 *
 * Everything here is built from the stored quote, never from the browser: the
 * amounts are the ones step 3's server action priced and saved (BK-08).
 */

/**
 * Tags these sessions in the Stripe Dashboard so this flow can be told apart
 * from later ones (staff payment links, amendments). Stripe asks for a label
 * with an eight-letter random suffix.
 */
export const INTEGRATION_IDENTIFIER = "cityline_booking_funnel_nqwzhvtb";

/**
 * How long after the quote itself expires the session stays payable.
 *
 * Stripe requires a session to live at least 30 minutes. Deriving the expiry
 * from the quote, rather than from "now", keeps it identical on every page
 * load — which is what lets the idempotency key below return the same session
 * instead of failing on changed parameters. 35 rather than 30 so that a quote
 * seconds from expiry still clears Stripe's minimum after network latency.
 */
const SESSION_GRACE_MINUTES = 35;

export interface QuoteForCheckout {
  id: number;
  expiresAt: Date;
  customerEmail: string;
  results: QuoteResults;
}

/**
 * The line items the customer sees in Stripe's receipt and Dashboard.
 *
 * One per priced line of the quote, so the receipt reads like the summary on
 * step 4. If the lines ever fail to add up to the total, or one is not a
 * positive amount, it falls back to a single line for the total: charging the
 * quoted total matters more than itemising it.
 */
export function lineItemsFor(
  results: QuoteResults,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const itemised = results.lines.every(
    (line) => Number.isInteger(line.amountPence) && line.amountPence > 0,
  );
  const sum = results.lines.reduce((total, line) => total + line.amountPence, 0);

  const lines =
    itemised && sum === results.totalPence && results.lines.length > 0
      ? results.lines
      : [
          {
            label: "Cityline Airport Transfers booking",
            amountPence: results.totalPence,
          },
        ];

  return lines.map((line) => ({
    quantity: 1,
    price_data: {
      currency: "gbp",
      unit_amount: line.amountPence,
      product_data: {
        name: line.label,
        // Stripe rejects an empty description, so only send one that exists.
        ...("detail" in line && line.detail ? { description: line.detail } : {}),
      },
    },
  }));
}

export function checkoutSessionParams(
  quote: QuoteForCheckout,
  origin: string,
): Stripe.Checkout.SessionCreateParams {
  const quoteId = String(quote.id);

  return {
    ui_mode: "elements",
    mode: "payment",
    line_items: lineItemsFor(quote.results),

    /*
     * The email the booking is made under. Passing it here means the customer
     * cannot pay under a different one, so the receipt, the confirmation and
     * the booking all agree.
     */
    customer_email: quote.customerEmail,

    // How fulfilment finds the quote again; checked against the stored id.
    client_reference_id: quoteId,
    metadata: { quote_id: quoteId },
    payment_intent_data: {
      description: "Cityline Airport Transfers booking",
      metadata: { quote_id: quoteId },
    },

    /*
     * `{CHECKOUT_SESSION_ID}` is filled in by Stripe. The return page runs the
     * same fulfilment as the webhook, so the customer sees their booking even
     * if the webhook is slow (Stripe's fulfilment guide recommends both).
     */
    return_url: `${origin}/book/return?session_id={CHECKOUT_SESSION_ID}`,

    expires_at: Math.floor(
      (quote.expiresAt.getTime() + SESSION_GRACE_MINUTES * 60_000) / 1000,
    ),

    integration_identifier: INTEGRATION_IDENTIFIER,

    // No `payment_method_types`: Stripe's dynamic payment methods decide what
    // to offer (cards, Apple Pay, Google Pay…), configured in the Dashboard.
  };
}

/**
 * What a session's status means for fulfilment. Pure, so the mapping from
 * Stripe's two status fields is tested rather than assumed.
 *
 * Stripe's rule: fulfil when `payment_status` is not `unpaid`. A `complete`
 * session can still be `unpaid` — a delayed method that has not settled — and
 * fulfilling it then would book a car for money that may never arrive.
 */
export function fulfilmentStateOf(
  session: Pick<Stripe.Checkout.Session, "status" | "payment_status">,
): "fulfil" | "processing" | "unpaid" | "expired" {
  if (session.payment_status !== "unpaid") return "fulfil";
  if (session.status === "complete") return "processing";
  if (session.status === "expired") return "expired";
  return "unpaid";
}

/**
 * The idempotency key for a quote's session. The same quote always asks Stripe
 * for the same session, so two tabs or a double-click cannot open two sessions
 * that could each be paid.
 */
export function checkoutIdempotencyKey(quoteId: number): string {
  return `checkout-session:quote:${quoteId}`;
}
