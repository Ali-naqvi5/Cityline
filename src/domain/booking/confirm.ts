import "server-only";

import { TERMS } from "@/content/legal";
import { nextJobReference } from "@/domain/jobs/reference";
import { chosenExtras } from "@/domain/pricing/extras";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { payloadClient } from "@/lib/payload";
import { londonToUtc } from "@/lib/time";

import { returnLegOf, type FunnelParams, type ResolvedLeg } from "./funnel-params";
import { createManageToken, hashManageToken } from "./manage-token";
import { nameBoardText, type PassengerDetails } from "./passenger";
import { isExpired, quoteRequestSchema, quoteResultsSchema } from "./quote-session";
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
 * Called by the Stripe webhook once PAY-01 lands. It is deliberately not a
 * server action and not reachable from a form: nothing a browser can hit should
 * be able to produce a confirmed booking, because a booking is the promise that
 * a car turns up.
 */

export type ConfirmResult =
  | { state: "confirmed"; reference: string; manageToken: string }
  /**
   * The quote already became a booking. Stripe retries webhooks, so this is an
   * ordinary outcome rather than an error — but the manage token cannot come
   * back, because only its hash was kept. A retry must therefore not re-send
   * the confirmation email; it has already gone.
   */
  | { state: "already_confirmed"; reference: string }
  | { state: "expired" }
  | { state: "missing" };

/** How many times to retry a reference collision before giving up. */
const REFERENCE_ATTEMPTS = 5;

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

export async function confirmBooking(quoteToken: string): Promise<ConfirmResult> {
  if (!quoteToken) return { state: "missing" };

  const payload = await payloadClient();

  /*
   * `overrideAccess` throughout. The collections deny `create` so that nothing
   * in the admin or the REST API can forge a booking; checkout is the one
   * caller allowed past that, and saying so explicitly here is the point —
   * grep for `overrideAccess` and this file is where a booking comes from.
   */
  const found = await payload.find({
    collection: "quotes",
    where: { token: { equals: quoteToken } },
    limit: 1,
    overrideAccess: true,
  });

  const quote = found.docs[0];
  if (!quote) return { state: "missing" };

  if (quote.status === "converted") {
    const existing = await payload.find({
      collection: "bookings",
      where: { quote: { equals: quote.id } },
      limit: 1,
      overrideAccess: true,
    });

    const booking = existing.docs[0];
    return booking
      ? { state: "already_confirmed", reference: booking.reference }
      : // Converted with no booking should be impossible — the two are written
        // in one transaction. If it happens it is a data problem, not a
        // customer problem, and charging again is not the fix.
        { state: "missing" };
  }

  if (isExpired(quote.expiresAt)) return { state: "expired" };

  const request = quoteRequestSchema.safeParse(quote.request);
  const results = quoteResultsSchema.safeParse(quote.results);
  if (!request.success || !results.success) return { state: "missing" };

  const { journey, details, extras } = request.data;
  const vehicle = VEHICLE_CLASSES.find((item) => item.slug === results.data.vehicleSlug);
  if (!vehicle) return { state: "missing" };

  const manageToken = createManageToken();
  const legs = legsOf(journey);
  const legPrices = pricePerLeg(results.data.totalPence, legs.length);

  /*
   * One transaction. A booking with only its outbound job would look confirmed
   * to the customer and be half a journey to the office, and the return leg
   * would never reach a run sheet.
   */
  const transactionID = await payload.db.beginTransaction();
  const req: TransactionReq =
    transactionID === null || transactionID === undefined ? undefined : { transactionID };

  try {
    const customer = await upsertCustomer(payload, details, req);

    const booking = await createWithFreshReference((reference) =>
      payload.create({
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
          manageTokenHash: hashManageToken(manageToken),
        },
        overrideAccess: true,
        req,
      }),
    );

    /*
     * Job references are sequential, so they are read and written inside the
     * transaction. Two simultaneous checkouts can still collide on the unique
     * index; `createWithFreshReference` re-reads and retries, which at
     * Cityline's volume is a path that will essentially never be taken.
     *
     * TODO(S8): move to a Postgres sequence once staff are also creating jobs
     * in the admin, where the collision window is wider.
     */
    for (const [index, leg] of legs.entries()) {
      await createWithFreshReference(
        (reference) =>
          payload.create({
            collection: "jobs",
            data: {
              reference,
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
               * `takenAt` is set but `takenByUser` is not: §14 wants both who
               * took the booking and when, and for a website job the answer to
               * the first is nobody — the system took it.
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
          }),
        () => nextJobReferenceFor(payload, req),
      );
    }

    await payload.update({
      collection: "quotes",
      id: quote.id,
      data: { status: "converted", customer: customer.id },
      overrideAccess: true,
      req,
    });

    if (req) await payload.db.commitTransaction(req.transactionID);

    return { state: "confirmed", reference: booking.reference, manageToken };
  } catch (error) {
    if (req) await payload.db.rollbackTransaction(req.transactionID);
    throw error;
  }
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

async function nextJobReferenceFor(
  payload: PayloadClient,
  req: TransactionReq,
): Promise<string> {
  /*
   * Sorted by reference descending and limited to a page: the highest is what
   * matters, but `nextJobReference` compares numerically rather than trusting
   * the text sort, which would put J-1000000 below J-999999.
   */
  const recent = await payload.find({
    collection: "jobs",
    sort: "-reference",
    limit: 50,
    overrideAccess: true,
    req,
  });

  return nextJobReference(recent.docs.map((job) => job.reference));
}

/**
 * Creates a row, retrying if its reference is already taken.
 *
 * Both reference formats are unique in the database, and that constraint is the
 * real guard — this only decides what happens when it fires. A collision is a
 * one-in-a-billion draw for `CL-XXXXXX` and a race for `J-NNNNNN`, and in both
 * cases the answer is the same: take another reference and try again. Anything
 * else surfaces a raw database error to someone who has just paid.
 */
async function createWithFreshReference<T>(
  create: (reference: string) => Promise<T>,
  nextReference: () => Promise<string> = async () => generateReference(),
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt += 1) {
    try {
      return await create(await nextReference());
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      lastError = error;
    }
  }

  throw lastError;
}

/**
 * Whether a failed write was a unique-constraint violation.
 *
 * Postgres says 23505. Payload wraps driver errors, so the code can be on the
 * error, on its cause, or only in the message — all three are checked, because
 * treating a genuine failure as a collision would retry five times and then
 * throw something unrecognisable.
 */
function isUniqueViolation(error: unknown): boolean {
  const codeOf = (value: unknown): string | undefined =>
    typeof value === "object" && value !== null && "code" in value
      ? String((value as { code: unknown }).code)
      : undefined;

  if (codeOf(error) === "23505") return true;

  if (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    codeOf((error as { cause: unknown }).cause) === "23505"
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /duplicate key value|unique constraint/i.test(message);
}
