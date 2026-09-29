import "server-only";

import { confirmBooking } from "@/domain/booking/confirm";
import { sendNewBookingNotifications } from "@/domain/notifications/send-booking-notifications";
import { payloadClient } from "@/lib/payload";
import { stripe } from "@/lib/stripe";

import { fulfilmentStateOf } from "./checkout-session";

/**
 * Turning a Checkout Session into a booking — Stripe's `fulfill_checkout`.
 *
 * Two callers, on purpose, as Stripe's fulfilment guide recommends:
 *
 *   The **webhook** (`/api/webhooks/stripe`) — the one that must never be
 *   missed. It arrives even if the customer's phone dies the moment they pay.
 *
 *   The **return page** (`/book/return`) — so the customer sees their booking
 *   straight away instead of waiting for a webhook that can lag.
 *
 * Both may run at once for the same session. `confirmBooking` is what makes
 * that safe; this function only decides whether there is anything to confirm.
 *
 * It trusts nothing it is handed except the session id. The session is read
 * back from Stripe with the secret key, so a browser cannot claim a payment it
 * did not make.
 */

export type FulfilResult =
  | { state: "confirmed"; reference: string }
  /** Paid by a method that settles later (bank debit and similar). */
  | { state: "processing"; quoteToken: string }
  /** Not paid: abandoned, declined, or a redirect-based method that failed. */
  | { state: "unpaid"; quoteToken: string }
  | { state: "expired"; quoteToken: string }
  | { state: "amount_mismatch" }
  /** Not a session this site created for a quote. */
  | { state: "not_ours" };

/** How many times to run the booking transaction before giving up. */
const ATTEMPTS = 3;

export async function fulfilCheckoutSession(sessionId: string): Promise<FulfilResult> {
  const session = await stripe().checkout.sessions.retrieve(sessionId);

  const quoteId = Number(session.client_reference_id ?? session.metadata?.quote_id);
  if (!Number.isInteger(quoteId) || quoteId <= 0) return { state: "not_ours" };

  const payload = await payloadClient();
  const quote = await payload
    .findByID({ collection: "quotes", id: quoteId, overrideAccess: true })
    .catch(() => null);
  if (!quote) return { state: "not_ours" };

  /*
   * The quote remembers which session it created. A different one means the
   * id and the quote do not belong together — refuse rather than guess. A
   * quote with no stored id is allowed through: the save after creating the
   * session can fail, and the customer may still have paid.
   */
  if (quote.stripeCheckoutSessionId && quote.stripeCheckoutSessionId !== session.id) {
    console.error(
      `[payments] session ${session.id} names quote ${quoteId}, which belongs to ${quote.stripeCheckoutSessionId}.`,
    );
    return { state: "not_ours" };
  }

  const state = fulfilmentStateOf(session);
  if (state !== "fulfil") return { state, quoteToken: quote.token };

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) {
    throw new Error(`Paid Checkout Session ${session.id} has no PaymentIntent.`);
  }

  const payment = {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    amountPence: session.amount_total ?? 0,
    currency: session.currency ?? "",
    livemode: session.livemode,
  };

  /*
   * Retried because the two callers race. The loser of that race hits the
   * unique index on the payment and its transaction rolls back; run again, it
   * finds the booking the winner made and returns `already_confirmed`. The
   * same retry covers the one-in-a-billion booking reference collision.
   */
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const result = await confirmBooking(quoteId, payment);

      if (result.state === "confirmed" || result.state === "already_confirmed") {
        // Both callers get here for the same payment; the emails' idempotency
        // keys make the second call a no-op at Nuntly. Never throws.
        await sendNewBookingNotifications(result.reference);
        return { state: "confirmed", reference: result.reference };
      }
      if (result.state === "amount_mismatch") return { state: "amount_mismatch" };
      return { state: "not_ours" };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
