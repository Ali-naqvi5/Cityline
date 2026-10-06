import "server-only";

import type Stripe from "stripe";

import { splitPence } from "@/domain/money";
import { payloadClient } from "@/lib/payload";
import { stripe } from "@/lib/stripe";
import type { Job, Payment } from "@/payload-types";

/**
 * Stripe's fee on a website payment, read from Stripe and kept with the
 * payment and its bookings, so takings and profit are net of it.
 *
 * Stripe works its fee out just after the payment, in the background: the
 * charge's balance transaction may not exist yet when the booking is made.
 * So this is tried three ways — straight after the booking is made, when the
 * webhook hears `charge.updated` (which names the balance transaction once
 * it is ready), and by hand from the Payments screen — and whichever finds
 * it first records it. Recording it twice changes nothing.
 *
 * A booking's journeys share the fee in proportion to their prices.
 */

export type CardFeeResult =
  /** Saved now. */
  | "recorded"
  /** Already known. */
  | "already"
  /** Stripe has not worked it out yet. */
  | "not_ready"
  /** No website payment with that id — a payment link, say. */
  | "not_ours";

export async function recordCardFee(paymentIntentId: string): Promise<CardFeeResult> {
  const payload = await payloadClient();
  const found = await payload.find({
    collection: "payments",
    where: { stripePaymentIntentId: { equals: paymentIntentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const payment = found.docs[0] as Payment | undefined;
  if (!payment) return "not_ours";
  if (payment.feeRecordedAt) return "already";

  const intent = await stripe().paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge =
    intent.latest_charge && typeof intent.latest_charge === "object"
      ? (intent.latest_charge as Stripe.Charge)
      : null;
  const balance =
    charge?.balance_transaction && typeof charge.balance_transaction === "object"
      ? (charge.balance_transaction as Stripe.BalanceTransaction)
      : null;
  if (!charge || !balance) return "not_ready";
  if (balance.currency !== "gbp") {
    console.error(
      `[payments] ${paymentIntentId}: Stripe's fee is in ${balance.currency}, not GBP; not recorded.`,
    );
    return "not_ready";
  }

  // The bookings first, the payment last: if anything fails part way, the
  // payment still says "not known" and the next try does it all again.
  const bookingId =
    typeof payment.booking === "object" ? payment.booking?.id : payment.booking;
  if (bookingId) {
    const jobs = await payload.find({
      collection: "jobs",
      where: { booking: { equals: bookingId } },
      sort: "pickupAt",
      pagination: false,
      depth: 0,
      overrideAccess: true,
    });
    const docs = jobs.docs as Job[];
    const shares = splitPence(
      balance.fee,
      docs.map((job) => job.customerPricePence ?? 0),
    );
    for (const [index, job] of docs.entries()) {
      await payload.update({
        collection: "jobs",
        id: job.id,
        data: { paymentFeePence: shares[index] ?? 0 },
        overrideAccess: true,
      });
    }
  }

  await payload.update({
    collection: "payments",
    id: payment.id,
    data: {
      feePence: balance.fee,
      feeRecordedAt: new Date().toISOString(),
      stripeChargeId: charge.id,
    },
    overrideAccess: true,
  });
  return "recorded";
}
