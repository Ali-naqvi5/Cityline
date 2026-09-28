import { Lock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FunnelProgress } from "@/components/booking/funnel-progress";
import { PaymentPanel } from "@/components/booking/payment-panel";
import { Container } from "@/components/ui/container";
import {
  DETAILS_COOKIE,
  bookingDraftSchema,
  type BookingDraft,
} from "@/domain/booking/details-session";
import {
  funnelQuery,
  hasJourney,
  parseFunnelParams,
} from "@/domain/booking/funnel-params";
import { nameBoardText } from "@/domain/booking/passenger";
import { formatPence } from "@/domain/money";
import { quoteFor } from "@/domain/pricing/quote";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { policies } from "@/lib/policies";

/**
 * Booking step 4 — review and pay (PAY-01).
 *
 * The card fields are Stripe's Payment Element, not ours. Handling raw card
 * details on this page would pull Cityline into a far heavier PCI regime; the
 * Payment Element keeps it at SAQ-A. That is why this step cannot match the
 * design pixel for pixel — see docs/design-deviations.md.
 */
export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
};

/** Reads and re-validates the in-progress booking from the httpOnly cookie. */
async function readDraft(): Promise<BookingDraft | null> {
  const raw = (await cookies()).get(DETAILS_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = bookingDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    // Malformed JSON means a corrupted or hand-edited cookie, not a crash.
    return null;
  }
}

export default async function PaymentStepPage({
  searchParams,
}: PageProps<"/book/payment">) {
  const journey = parseFunnelParams(await searchParams);

  if (!hasJourney(journey)) {
    redirect(`/book?${funnelQuery(journey)}`);
  }

  const vehicle = VEHICLE_CLASSES.find((item) => item.slug === journey.vehicle);
  if (!vehicle) {
    redirect(`/book/vehicle?${funnelQuery({ ...journey, vehicle: undefined })}`);
  }

  // No draft means the cookie expired or they arrived here directly. Send them
  // back to step 3 rather than showing a payment form with nobody to bill.
  const draft = await readDraft();
  if (!draft) {
    redirect(`/book/details?${funnelQuery(journey)}`);
  }

  // The whole quote, not a fare plus extras. The old sum here charged a single
  // fare while the panel below told the customer it covered both journeys —
  // which would have undercharged every return booking.
  const quote = quoteFor(journey, vehicle, draft.extras);
  const total = quote.totalPence;

  return (
    <>
      <FunnelProgress current={4} />

      <Container className="py-10">
        <div className="mb-space-xl">
          <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-2">
            Review and pay
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl">
            Your fare is fixed. No card fees, and no surge pricing.
          </p>
        </div>

        <div className="gap-gutter grid lg:grid-cols-12">
          <div className="gap-space-lg flex flex-col lg:col-span-7">
            <PaymentPanel totalPence={total} />

            <section className="border-outline-variant bg-surface-container-low rounded-card p-space-lg border">
              <h2 className="text-headline-sm mb-space-sm flex items-center gap-2">
                <ShieldCheck aria-hidden className="text-primary h-5 w-5" />
                Cancellation
              </h2>
              <p className="text-body-md text-on-surface-variant">
                Cancel free of charge up to{" "}
                <strong className="text-on-surface">
                  {policies.freeCancellationHours} hours
                </strong>{" "}
                before your pickup time and you are refunded in full (
                {policies.freeCancellationRefundPercent}%), back to the card you paid
                with.
              </p>
              <p className="text-body-sm text-on-surface-variant mt-space-sm">
                You can view, change or cancel your booking at any time with the link in
                your confirmation email. No account needed.
              </p>
            </section>

            <section className="border-outline-variant rounded-card p-space-lg border">
              <h2 className="text-headline-sm mb-space-md">Who is travelling</h2>
              <dl className="text-body-md grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-body-sm text-on-surface-variant">
                    Name on the driver&rsquo;s board
                  </dt>
                  <dd>{nameBoardText(draft.details)}</dd>
                </div>
                <div>
                  <dt className="text-body-sm text-on-surface-variant">Contact</dt>
                  <dd className="tabular-nums">{draft.details.phone}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-body-sm text-on-surface-variant">
                    Confirmation sent to
                  </dt>
                  <dd>{draft.details.email}</dd>
                </div>
              </dl>
              <Link
                href={`/book/details?${funnelQuery(journey)}`}
                className="text-label-md text-primary mt-space-md inline-block hover:underline"
              >
                Change these details
              </Link>
            </section>
          </div>

          <aside className="lg:col-span-5">
            <div className="border-outline-variant bg-surface-container-lowest rounded-card shadow-card sticky top-28 border">
              <div className="border-outline-variant p-space-lg border-b">
                <h2 className="text-headline-sm">Your booking</h2>
              </div>

              <div className="p-space-lg gap-space-md flex flex-col">
                <div className="text-body-md flex flex-col gap-1.5">
                  <p>{journey.pickup}</p>
                  {journey.via.map((stop, index) => (
                    <p key={index} className="text-body-sm text-on-surface-variant">
                      via {stop}
                    </p>
                  ))}
                  <p>{journey.dropoff}</p>
                  <p className="text-body-sm text-on-surface-variant tabular-nums">
                    {journey.date} at {journey.time}
                    {journey.flightNumber ? ` · flight ${journey.flightNumber}` : ""}
                  </p>
                </div>

                <dl className="border-outline-variant pt-space-md text-body-md grid gap-2 border-t">
                  {quote.lines.map((line, index) => (
                    <div key={index} className="flex justify-between gap-4">
                      <dt className="min-w-0">
                        {line.label}
                        {line.detail ? (
                          <span className="text-on-surface-variant">
                            {" "}
                            ({line.detail})
                          </span>
                        ) : null}
                      </dt>
                      <dd className="tabular-nums">{formatPence(line.amountPence)}</dd>
                    </div>
                  ))}

                  <div className="text-on-surface-variant flex justify-between gap-4">
                    <dt>Meet and greet</dt>
                    <dd>Included</dd>
                  </div>
                  <div className="text-on-surface-variant flex justify-between gap-4">
                    <dt>{policies.airportFreeWaitingMinutes} minutes airport waiting</dt>
                    <dd>Included</dd>
                  </div>
                  <div className="text-on-surface-variant flex justify-between gap-4">
                    <dt>Congestion charge and card fees</dt>
                    <dd>Included</dd>
                  </div>
                </dl>

                <div className="border-outline-variant pt-space-md flex items-end justify-between border-t">
                  <span className="text-title-md">Total to pay</span>
                  <span className="text-fare-tabular text-primary tabular-nums">
                    {formatPence(total)}
                  </span>
                </div>

                {quote.legs === 2 ? (
                  <p className="bg-surface-container-low text-body-sm rounded-card p-space-md">
                    This total covers both journeys, outbound and return.
                  </p>
                ) : null}

                <p className="text-body-sm text-on-surface-variant flex gap-2">
                  <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  Your card details are entered directly with our payment provider and
                  never reach Cityline&rsquo;s servers.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
