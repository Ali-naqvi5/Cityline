import type Stripe from "stripe";

import { env } from "@/env";
import { fulfilCheckoutSession } from "@/domain/payments/fulfil-checkout";
import { payloadClient } from "@/lib/payload";
import { stripe } from "@/lib/stripe";

/**
 * Stripe's webhook (PAY-01, BK-09).
 *
 * The source of truth for "has this customer paid?". CLAUDE.md is explicit that
 * payment status comes from here, never from what a browser reports, and Stripe
 * delivers these even when the customer closes the tab the instant they pay.
 *
 * Every request is signature-checked against `STRIPE_WEBHOOK_SECRET` before
 * anything is read. Without that, anyone who found this URL could post a fake
 * "paid" event — and fulfilment would still refuse it, because it re-reads the
 * session from Stripe, but it should never get that far.
 *
 * Exempt from the launch gate (`src/proxy.ts` lets `/api/webhooks` through), so
 * test payments work before launch.
 *
 * Response codes are the retry policy. 2xx tells Stripe to stop; anything else
 * makes it retry with backoff for up to three days. So a failure that retrying
 * could fix — the database was down — returns 500, and one it cannot — a bad
 * signature — returns 400.
 */
export const dynamic = "force-dynamic";

/** Events that mean money arrived for a Checkout Session. */
const FULFIL_EVENTS = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export async function POST(request: Request): Promise<Response> {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set; refusing events.");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  // The raw body, byte for byte: the signature is over exactly what was sent.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const payload = await payloadClient();

  /*
   * Every event is recorded, keyed on Stripe's event id (unique per provider).
   * Only identifiers are kept, not the event body: the body carries the
   * customer's email and address, and the booking already holds what we need.
   */
  const seen = await payload.find({
    collection: "webhook-events",
    where: {
      and: [{ provider: { equals: "stripe" } }, { eventId: { equals: event.id } }],
    },
    limit: 1,
    overrideAccess: true,
  });

  const recorded =
    seen.docs[0] ??
    (await payload.create({
      collection: "webhook-events",
      data: {
        provider: "stripe",
        eventId: event.id,
        type: event.type,
        payload: {
          objectId: (event.data.object as { id?: string }).id ?? null,
          livemode: event.livemode,
          created: event.created,
        },
      },
      overrideAccess: true,
    }));

  if (recorded.processedAt) return Response.json({ received: true, duplicate: true });

  try {
    if (FULFIL_EVENTS.has(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await fulfilCheckoutSession(session.id);

      if (result.state === "amount_mismatch" || result.state === "not_ours") {
        // Retrying cannot change the answer, so acknowledge it and leave it
        // logged for a person (fulfilment already logged the detail).
        console.error(
          `[stripe-webhook] ${event.id}: session ${session.id} → ${result.state}`,
        );
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      // Nothing was booked, so there is nothing to undo. Staff alerts (NOT-03)
      // and a "your payment failed" email hang off this once they exist.
      const session = event.data.object as Stripe.Checkout.Session;
      console.warn(`[stripe-webhook] delayed payment failed for session ${session.id}`);
    }
  } catch (error) {
    console.error(
      `[stripe-webhook] ${event.id} (${event.type}) failed; Stripe will retry.`,
      error,
    );
    return new Response("Processing failed", { status: 500 });
  }

  await payload.update({
    collection: "webhook-events",
    id: recorded.id,
    data: { processedAt: new Date().toISOString() },
    overrideAccess: true,
  });

  return Response.json({ received: true });
}
