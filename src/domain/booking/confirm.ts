import "server-only";

import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";

import { TERMS } from "@/content/legal";
import { formatJobReference } from "@/domain/jobs/reference";
import { chosenExtras } from "@/domain/pricing/extras";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { payloadClient } from "@/lib/payload";
import { londonToUtc } from "@/lib/time";

import { returnLegOf, type FunnelParams, type ResolvedLeg } from "./funnel-params";
import { hashManageToken, manageTokenFor } from "./manage-token";
import { nameBoardText, type PassengerDetails } from "./passenger";
import { quoteRequestSchema, quoteResultsSchema } from "./quote-session";
import { generateReference } from "./reference";

/**
 * Turning a paid quote into a booking and its jobs (BK-09).
 *
 * **This is the only place a website booking is born.** §2 is explicit that the
 * staff job form cannot create `source = "website"` jobs, and the reason is
 * double entry: if both Stripe's webhook and a controller could create the same
 * booking, the TfL register would eventually show one journey twice. One
 * function, called from one place, is what makes that structurally impossible.
 *
 * It is reached only through `fulfilCheckoutSession`, which first asks Stripe —
 * with the secret key, never trusting the browser — whether the payment really
 * succeeded. Nothing a browser can submit produces a booking on its own.
 *
 * **It is called more than once for the same payment, sometimes at the same
 * moment**, and that is by design: Stripe's webhook and the customer's browser
 * returning from payment both trigger it, as Stripe's fulfilment guide
 * recommends, and Stripe retries webhooks. The guard is the unique index on
 * `payments.stripe_payment_intent_id`, written first inside the transaction:
 * whichever call gets there second is blocked by the first, then fails and
 * rolls back, and `fulfilCheckoutSession` retries it into `already_confirmed`.
 */

/** What Stripe says was paid, read from the Checkout Session on the server. */
export interface ConfirmedPayment {
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string;
  amountPence: number;
  currency: string;
}

export type ConfirmResult =
  | { state: "confirmed"; reference: string }
  /** Already a booking — a webhook retry, or the browser and webhook racing. */
  | { state: "already_confirmed"; reference: string }
  /**
   * Stripe took a different amount from the one we quoted. It cannot happen
   * while the session's line items come from the quote, which is exactly why
   * it must not be waved through if it ever does.
   */
  | { state: "amount_mismatch"; quotedPence: number; paidPence: number }
  | { state: "missing" };

interface Leg {
  leg: "outbound" | "return";
  pickup: string;
  dropoff: string;
  via: string[];
  date: string;
  time: string;
  passengers: number;
  bags: number;
  flightNumber: string;
}

/**
 * The legs to create a job for. One for a single journey, two for a return
 * (BK-09), and one for an hourly hire — a car booked by the hour is one job
 * however many places it visits.
 */
function legsOf(journey: FunnelParams): Leg[] {
  const outbound: Leg = {
    leg: "outbound",
    pickup: journey.pickup,
    dropoff: journey.dropoff,
    via: journey.via,
    date: journey.date,
    time: journey.time,
    passengers: journey.passengers,
    bags: journey.bags,
    flightNumber: journey.flightNumber,
  };

  const back: ResolvedLeg | null = returnLegOf(journey);
  if (!back) return [outbound];

  return [
    outbound,
    {
      leg: "return",
      pickup: back.pickup,
      dropoff: back.dropoff,
      via: back.via,
      date: back.date,
      time: back.time,
      passengers: back.passengers,
      bags: back.bags,
      // The return leg is a departure, not a meet-and-greet off a flight.
      flightNumber: "",
    },
  ];
}

/**
 * The booking total split across its jobs, in whole pence.
 *
 * Finance reports sum jobs; the customer paid the booking. Those two have to
 * agree exactly, so the remainder goes on the outbound rather than being
 * rounded away — 9601p across two legs is 4801 and 4800, never 4800 and 4800.
 */
function pricePerLeg(totalPence: number, legs: number): number[] {
  const base = Math.floor(totalPence / legs);
  const remainder = totalPence - base * legs;

  return Array.from({ length: legs }, (_, index) =>
    index === 0 ? base + remainder : base,
  );
}

type PayloadClient = Awaited<ReturnType<typeof payloadClient>>;
type TransactionReq = { transactionID: string | number } | undefined;

export async function confirmBooking(
  quoteId: number,
  payment: ConfirmedPayment,
): Promise<ConfirmResult> {
  const payload = await payloadClient();

  /*
   * `overrideAccess` throughout. The collections deny `create` so that nothing
   * in the admin or the REST API can forge a booking; checkout is the one
   * caller allowed past that, and saying so explicitly here is the point —
   * grep for `overrideAccess` and this file is where a booking comes from.
   */
  const existing = await bookingForPayment(payload, payment.stripePaymentIntentId);
  if (existing) return { state: "already_confirmed", reference: existing };

  const quote = await payload
    .findByID({ collection: "quotes", id: quoteId, overrideAccess: true })
    .catch(() => null);
  if (!quote) return { state: "missing" };

  if (quote.status === "converted") {
    const booked = await payload.find({
      collection: "bookings",
      where: { quote: { equals: quote.id } },
      limit: 1,
      overrideAccess: true,
    });

    const booking = booked.docs[0];
    if (!booking) return { state: "missing" };

    /*
     * The quote became a booking through a *different* payment. One Checkout
     * Session per quote makes this impossible in the normal course of things,
     * so if it happens the customer has paid twice and a person needs to
     * refund one of them. Logged loudly until staff alerts (NOT-03) exist.
     */
    console.error(
      `[payments] quote ${quote.id} already booked as ${booking.reference}; ` +
        `payment ${payment.stripePaymentIntentId} is a second payment and needs refunding.`,
    );
    return { state: "already_confirmed", reference: booking.reference };
  }

  /*
   * Deliberately no expiry check here. The 30-minute limit (BK-08) is enforced
   * where it belongs — before a Checkout Session is created for the quote. By
   * the time this runs the customer has paid, and refusing the booking because
   * the webhook arrived a minute late would keep their money and send no car.
   */

  const request = quoteRequestSchema.safeParse(quote.request);
  const results = quoteResultsSchema.safeParse(quote.results);
  if (!request.success || !results.success) return { state: "missing" };

  const { journey, details, extras } = request.data;
  const vehicle = VEHICLE_CLASSES.find((item) => item.slug === results.data.vehicleSlug);
  if (!vehicle) return { state: "missing" };

  if (
    payment.currency.toLowerCase() !== "gbp" ||
    payment.amountPence !== results.data.totalPence
  ) {
    console.error(
      `[payments] quote ${quote.id}: quoted ${results.data.totalPence}p GBP, ` +
        `Stripe took ${payment.amountPence}p ${payment.currency}. Not booked; check by hand.`,
    );
    return {
      state: "amount_mismatch",
      quotedPence: results.data.totalPence,
      paidPence: payment.amountPence,
    };
  }

  const legs = legsOf(journey);
  const legPrices = pricePerLeg(results.data.totalPence, legs.length);

  // Taken from the sequence before the transaction: `nextval` is outside
  // transactions anyway, and a rolled-back booking only leaves a gap.
  const jobReferences = await Promise.all(legs.map(() => nextJobReference(payload)));

  /*
   * One transaction. A booking with only its outbound job would look confirmed
   * to the customer and be half a journey to the office, and the return leg
   * would never reach a run sheet.
   */
  const transactionID = await payload.db.beginTransaction();
  const req: TransactionReq =
    transactionID === null || transactionID === undefined ? undefined : { transactionID };

  try {
    // First, so a second call for the same payment stops here (see top).
    const paymentRow = await payload.create({
      collection: "payments",
      data: {
        stripePaymentIntentId: payment.stripePaymentIntentId,
        amountPence: payment.amountPence,
        status: "succeeded",
        kind: "initial",
        raw: {
          checkoutSessionId: payment.stripeCheckoutSessionId,
          paymentIntentId: payment.stripePaymentIntentId,
          currency: payment.currency,
        },
      },
      overrideAccess: true,
      req,
    });

    const customer = await upsertCustomer(payload, details, req);

    /*
     * A booking reference is random, and a collision is a one-in-a-billion
     * draw. If it ever happens, the unique index fails the whole transaction
     * and `fulfilCheckoutSession` runs it again with a new reference.
     */
    const reference = generateReference();

    const booking = await payload.create({
      collection: "bookings",
      data: {
        reference,
        status: "confirmed",
        customer: customer.id,
        quote: quote.id,
        ...bookerFields(details),
        subtotalPence: results.data.totalPence,
        discountPence: 0,
        totalPence: results.data.totalPence,
        // CMP-02: what the customer agreed to, kept even if pricing changes.
        priceSnapshot: results.data,
        termsVersion: TERMS.updated,
        manageTokenHash: hashManageToken(manageTokenFor(reference)),
      },
      overrideAccess: true,
      req,
    });

    for (const [index, leg] of legs.entries()) {
      await payload.create({
        collection: "jobs",
        data: {
          reference: jobReferences[index] ?? (await nextJobReference(payload)),
          source: "website",
          booking: booking.id,
          leg: leg.leg,
          pickupAt: londonToUtc(leg.date, leg.time).toISOString(),
          pickupAddress: leg.pickup,
          dropoffAddress: leg.dropoff || undefined,
          viaStops: leg.via.map((address) => ({ address })),
          flightNumber: leg.flightNumber || undefined,
          hours: journey.service === "hourly" ? journey.hours : undefined,
          vehicleClassSlug: vehicle.slug,
          passengers: leg.passengers,
          largeBags: leg.bags,
          smallBags: 0,
          leadName: nameBoardText(details),
          leadPhone: details.passengerPhone || details.phone,
          leadEmail: details.email,
          meetAndGreet: true,
          nameBoardText: nameBoardText(details),
          extras: chosenExtras(extras).map(({ extra, quantity }) => ({
            slug: extra.slug,
            quantity,
            unitPricePence: extra.pricePence,
          })),
          status: "unassigned",
          /*
           * `takenAt` is set but `takenByUser` is not: §14 wants both who took
           * the booking and when, and for a website job the answer to the
           * first is nobody — the system took it.
           */
          takenAt: new Date().toISOString(),
          customerPricePence: legPrices[index] ?? 0,
          paymentMethod: "web_prepaid",
          // JOB-07: price, customer and route come from the booking.
          locked: true,
          driverNotes: details.notes || journey.notes || undefined,
        },
        overrideAccess: true,
        req,
      });
    }

    await payload.update({
      collection: "payments",
      id: paymentRow.id,
      data: { booking: booking.id },
      overrideAccess: true,
      req,
    });

    await payload.update({
      collection: "quotes",
      id: quote.id,
      data: { status: "converted", customer: customer.id },
      overrideAccess: true,
      req,
    });

    if (req) await payload.db.commitTransaction(req.transactionID);

    return { state: "confirmed", reference: booking.reference };
  } catch (error) {
    if (req) await payload.db.rollbackTransaction(req.transactionID);
    throw error;
  }
}

/** The booking a Stripe payment already produced, if any. */
async function bookingForPayment(
  payload: PayloadClient,
  paymentIntentId: string,
): Promise<string | null> {
  const found = await payload.find({
    collection: "payments",
    where: { stripePaymentIntentId: { equals: paymentIntentId } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });

  const booking = found.docs[0]?.booking;
  return booking && typeof booking === "object" ? booking.reference : null;
}

/** `J-000042`, from the database sequence (see the second migration). */
async function nextJobReference(payload: PayloadClient): Promise<string> {
  // Payload types `db` as its generic adapter; `payload.config.ts` configures
  // the Postgres one, which is what exposes Drizzle for raw SQL.
  const db = payload.db as unknown as PostgresAdapter;
  const result = await db.drizzle.execute<{ n: string }>(
    sql`select nextval('job_reference_seq') as n`,
  );

  return formatJobReference(Number(result.rows[0]?.n));
}

/**
 * Booker fields, set only when the booker is not the passenger (BK-04), so the
 * admin shows a second name only when there genuinely is one.
 */
function bookerFields(details: PassengerDetails) {
  if (!details.bookingForSomeoneElse) return {};

  return {
    bookerName: `${details.firstName} ${details.lastName}`.trim(),
    bookerPhone: details.phone,
    bookerEmail: details.email,
  };
}

/**
 * One customer row per email, so a repeat booker is one record rather than five.
 *
 * Marketing consent is only ever turned **on** here, never off: withdrawing it
 * is a deliberate act through an unsubscribe link, and a later booking made
 * without ticking the box is not that.
 */
async function upsertCustomer(
  payload: PayloadClient,
  details: PassengerDetails,
  req: TransactionReq,
) {
  const name = `${details.firstName} ${details.lastName}`.trim();

  const existing = await payload.find({
    collection: "customers",
    where: { email: { equals: details.email } },
    limit: 1,
    overrideAccess: true,
    req,
  });

  const found = existing.docs[0];
  if (found) {
    return payload.update({
      collection: "customers",
      id: found.id,
      data: {
        name,
        phone: details.phone,
        ...(details.marketingConsent
          ? { marketingConsent: true, marketingConsentAt: new Date().toISOString() }
          : {}),
      },
      overrideAccess: true,
      req,
    });
  }

  return payload.create({
    collection: "customers",
    data: {
      email: details.email,
      name,
      phone: details.phone,
      marketingConsent: details.marketingConsent,
      marketingConsentAt: details.marketingConsent ? new Date().toISOString() : undefined,
    },
    overrideAccess: true,
    req,
  });
}
