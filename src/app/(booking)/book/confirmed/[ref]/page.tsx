import {
  CalendarPlus,
  Check,
  CircleAlert,
  Clock,
  Mail,
  MapPin,
  Phone,
  Settings2,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { formatReferenceForSpeech } from "@/domain/booking/reference";
import { loadBooking } from "@/domain/booking/load-booking";
import { formatPence } from "@/domain/money";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { company, telHref } from "@/lib/company";
import { policies } from "@/lib/policies";
import { formatDate, formatTime } from "@/lib/time";
import type { Job } from "@/payload-types";

/**
 * Booking step 5 — the confirmation (§5 `/book/confirmed/[ref]`).
 *
 * The screen that closes the funnel. Its job is narrow and worth stating: prove
 * the money went somewhere, give the customer the reference, and hand over the
 * two things they will actually need later — the calendar entry and the link to
 * change or cancel.
 *
 * It does **not** create anything. The booking already exists by the time anyone
 * arrives here; `confirmBooking` made it when payment succeeded, and this page
 * only reads. That matters because customers reload confirmation pages, forward
 * them, and open them again from a browser's history a week later, and none of
 * those may produce a second booking or a second charge.
 *
 * Reaching it needs the magic-link token as well as the reference, for the reason
 * in `load-booking.ts`: a reference gets read down the phone and is not a secret,
 * while what this page shows — a name, a mobile number, a home address and a
 * time the house will be empty — very much is.
 */
export const metadata: Metadata = {
  title: "Booking confirmed",
  // Never indexable, and no referrer: the URL carries the magic-link token, and
  // a `Referer` header would hand it to every third party the page talks to.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function vehicleName(slug: string): string {
  return VEHICLE_CLASSES.find((item) => item.slug === slug)?.name ?? slug;
}

function legHeading(job: Job, jobs: Job[]): string {
  if (jobs.length < 2) return "Your journey";
  return job.leg === "return" ? "Return journey" : "Outbound journey";
}

export default async function BookingConfirmedPage({
  params,
  searchParams,
}: PageProps<"/book/confirmed/[ref]">) {
  const { ref } = await params;
  const query = await searchParams;
  const manageToken = typeof query.t === "string" ? query.t : "";

  const loaded = await loadBooking(ref, manageToken);

  /*
   * One screen for both failures. A stranger who guesses a reference and a
   * customer whose link has been truncated by a mail client see the same thing,
   * so nothing here reveals whether a reference exists — but the copy is written
   * for the customer, because they are the only one who will read it twice.
   */
  if (loaded.state !== "ok") {
    return <CannotShowBooking />;
  }

  const { booking, jobs } = loaded;
  const manageUrl = `/manage/${booking.reference}?t=${encodeURIComponent(manageToken)}`;

  return (
    <Container className="py-12 sm:py-16">
      <div className="max-w-3xl">
        <p className="bg-primary-container text-on-primary text-label-sm mb-space-md inline-flex items-center gap-1.5 rounded-full px-3 py-1">
          <Check aria-hidden className="h-3.5 w-3.5" />
          Paid and confirmed
        </p>

        <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-sm">
          Your car is booked
        </h1>

        <p className="text-body-lg text-on-surface-variant mb-space-xl">
          We have emailed the details to{" "}
          <strong className="text-on-surface">{customerEmail(booking, jobs)}</strong>. The
          fare is fixed and paid — there is nothing to settle with the driver.
        </p>

        {/*
         * The reference, given the prominence it earns. This is what a customer
         * reads down the phone at 5am, so it is large, spaced for speech, and
         * selectable rather than tucked into a sentence.
         */}
        <div className="border-outline-variant bg-surface-container-low rounded-card p-space-lg mb-space-xl border">
          <h2 className="text-body-sm text-on-surface-variant mb-1">
            Your booking reference
          </h2>
          <p className="text-headline-md text-primary font-semibold tabular-nums select-all">
            {formatReferenceForSpeech(booking.reference)}
          </p>
          <p className="text-body-sm text-on-surface-variant mt-space-sm">
            Quote this if you call us. Keep it — you will need it to change or cancel.
          </p>
        </div>
      </div>

      <div className="gap-gutter grid lg:grid-cols-12">
        <div className="gap-space-lg flex flex-col lg:col-span-7">
          {jobs.map((job) => (
            <section
              key={job.id}
              className="border-outline-variant rounded-card p-space-lg border"
            >
              <h2 className="text-headline-sm mb-space-md">{legHeading(job, jobs)}</h2>

              <p className="text-title-md mb-space-sm tabular-nums">
                {formatDate(new Date(job.pickupAt))} at{" "}
                {formatTime(new Date(job.pickupAt))}
              </p>

              <ol className="gap-space-sm text-body-md flex flex-col">
                <li className="flex gap-2">
                  <MapPin aria-hidden className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="text-body-sm text-on-surface-variant block">
                      Pickup
                    </span>
                    {job.pickupAddress}
                  </span>
                </li>

                {(job.viaStops ?? []).map((stop, index) => (
                  <li key={index} className="text-on-surface-variant flex gap-2 pl-6">
                    <span>
                      <span className="text-body-sm block">Stop {index + 1}</span>
                      {stop.address}
                    </span>
                  </li>
                ))}

                {job.dropoffAddress ? (
                  <li className="flex gap-2">
                    <MapPin
                      aria-hidden
                      className="text-primary mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span>
                      <span className="text-body-sm text-on-surface-variant block">
                        Drop-off
                      </span>
                      {job.dropoffAddress}
                    </span>
                  </li>
                ) : (
                  <li className="flex gap-2">
                    <Clock aria-hidden className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <span className="text-body-sm text-on-surface-variant block">
                        Hourly hire
                      </span>
                      {job.hours} hours with your driver
                    </span>
                  </li>
                )}
              </ol>

              <dl className="border-outline-variant mt-space-md pt-space-md text-body-md grid gap-2 border-t sm:grid-cols-2">
                <div>
                  <dt className="text-body-sm text-on-surface-variant">Vehicle</dt>
                  <dd>{vehicleName(job.vehicleClassSlug)}</dd>
                </div>
                <div>
                  <dt className="text-body-sm text-on-surface-variant">Passengers</dt>
                  <dd className="tabular-nums">{job.passengers}</dd>
                </div>
                <div>
                  <dt className="text-body-sm text-on-surface-variant">
                    Name on the driver&rsquo;s board
                  </dt>
                  <dd>{job.nameBoardText ?? job.leadName}</dd>
                </div>
                {job.flightNumber ? (
                  <div>
                    <dt className="text-body-sm text-on-surface-variant">Flight</dt>
                    <dd className="tabular-nums">{job.flightNumber}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ))}

          {/*
           * What happens next, in the order it happens. This is the section that
           * stops the "has anything gone wrong?" email three days before the
           * journey — and it is deliberately specific about the driver's details
           * arriving later, because CMP-04 requires them to be sent and a
           * customer who does not know that assumes they were forgotten.
           */}
          <section className="border-outline-variant bg-surface-container-low rounded-card p-space-lg border">
            <h2 className="text-headline-sm mb-space-md">What happens next</h2>

            <ol className="gap-space-md text-body-md flex flex-col">
              <li className="flex gap-3">
                <Mail aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <strong className="text-on-surface block">Now</strong>
                  Your confirmation email arrives, with a calendar file and the link to
                  manage this booking.
                </span>
              </li>
              <li className="flex gap-3">
                <Phone aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <strong className="text-on-surface block">Before your pickup</strong>
                  We send you your driver&rsquo;s name, their licence number, and the
                  make, colour and registration of the car, so you know exactly who is
                  meeting you.
                </span>
              </li>
              <li className="flex gap-3">
                <MapPin aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <strong className="text-on-surface block">On the day</strong>
                  Your driver meets you with a name board. Airport pickups include{" "}
                  {policies.airportFreeWaitingMinutes} minutes of free waiting.
                </span>
              </li>
            </ol>
          </section>
        </div>

        <aside className="lg:col-span-5">
          <div className="gap-space-lg sticky top-28 flex flex-col">
            <div className="border-outline-variant bg-surface-container-lowest rounded-card shadow-card border">
              <div className="border-outline-variant p-space-lg border-b">
                <h2 className="text-headline-sm">Paid in full</h2>
              </div>

              <div className="p-space-lg gap-space-md flex flex-col">
                <div className="flex items-end justify-between">
                  <span className="text-title-md">Total paid</span>
                  <span className="text-fare-tabular text-primary tabular-nums">
                    {formatPence(booking.totalPence)}
                  </span>
                </div>

                {jobs.length === 2 ? (
                  <p className="bg-surface-container-low text-body-sm rounded-card p-space-md">
                    This covered both journeys, outbound and return.
                  </p>
                ) : null}

                <p className="text-body-sm text-on-surface-variant">
                  No card fees, no surge pricing and nothing to pay the driver. Your
                  receipt is in your confirmation email.
                </p>
              </div>
            </div>

            {/*
             * The two actions a customer actually takes from this page. Both are
             * ordinary links: a download and a navigation, working without
             * JavaScript, on a phone, in the airport car park.
             */}
            <div className="gap-space-sm flex flex-col">
              <a
                href={`/book/confirmed/${booking.reference}/calendar?t=${encodeURIComponent(manageToken)}`}
                className="bg-primary-container text-on-primary hover:bg-secondary rounded-button text-label-md flex h-12 items-center justify-center gap-2 font-semibold transition-colors"
              >
                <CalendarPlus aria-hidden className="h-4 w-4" />
                Add to your calendar
              </a>

              <Link
                href={manageUrl}
                className="border-outline text-on-surface hover:bg-surface-container-low rounded-button text-label-md flex h-12 items-center justify-center gap-2 border font-semibold transition-colors"
              >
                <Settings2 aria-hidden className="h-4 w-4" />
                View or change this booking
              </Link>
            </div>

            <div className="border-outline-variant rounded-card p-space-lg border">
              <h2 className="text-title-md mb-space-sm">Need to change something?</h2>
              <p className="text-body-md text-on-surface-variant">
                Cancel free of charge up to{" "}
                <strong className="text-on-surface">
                  {policies.freeCancellationHours} hours
                </strong>{" "}
                before your pickup and you are refunded in full, back to the card you paid
                with.
              </p>
              <p className="text-body-sm text-on-surface-variant mt-space-sm">
                Or call us on{" "}
                <a href={telHref()} className="text-primary tabular-nums hover:underline">
                  {company.phone}
                </a>{" "}
                — {company.serviceHours}.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </Container>
  );
}

/**
 * The email the confirmation went to.
 *
 * Read off the job rather than the booking, because the booking only carries a
 * `bookerEmail` when the booker is not the passenger (BK-04). Falling back to the
 * generic phrase rather than showing nothing: an empty space where an email
 * address should be reads as a bug, on the one screen that most needs to look
 * like nothing went wrong.
 */
function customerEmail(
  booking: { bookerEmail?: string | null },
  jobs: readonly Job[],
): string {
  return booking.bookerEmail ?? jobs[0]?.leadEmail ?? "your email address";
}

/**
 * Shown for both a reference that does not exist and a link whose token is
 * wrong or missing.
 *
 * Identical for both on purpose — see `load-booking.ts`. The copy assumes a
 * customer with a broken link rather than an intruder, because that is who
 * actually ends up here: mail clients truncate long URLs, and people copy them
 * by hand off a phone screen.
 */
function CannotShowBooking() {
  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <p className="bg-surface-container-low text-on-surface-variant text-label-sm mb-space-md inline-flex items-center gap-1.5 rounded-full px-3 py-1">
          <CircleAlert aria-hidden className="h-3.5 w-3.5" />
          Link not recognised
        </p>

        <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-md">
          We cannot open that booking
        </h1>

        <div className="gap-space-md text-body-lg text-on-surface-variant flex flex-col">
          <p>
            The link we use to show a booking is long, and some email apps cut it short.
            Opening it straight from your confirmation email usually fixes it.
          </p>
          <p>
            If it still will not open, call us with your reference and we will pull the
            booking up at our end. Nothing is lost — if you have had a confirmation email,
            your car is booked.
          </p>
        </div>

        <div className="gap-space-md mt-space-xl flex flex-wrap items-center">
          <a
            href={telHref()}
            className="bg-primary-container text-on-primary hover:bg-secondary rounded-button text-label-md inline-flex h-12 items-center gap-2 px-6 font-semibold transition-colors"
          >
            <Phone aria-hidden className="h-4 w-4" />
            Call {company.phone}
          </a>
          <p className="text-body-sm text-on-surface-variant">
            {company.serviceHours}. Or email{" "}
            <a href={`mailto:${company.email}`} className="text-primary hover:underline">
              {company.email}
            </a>
            .
          </p>
        </div>
      </div>
    </Container>
  );
}
