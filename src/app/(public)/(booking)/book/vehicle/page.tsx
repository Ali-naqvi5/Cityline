import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BookingWindowNotice } from "@/components/booking/booking-window-notice";
import { FunnelProgress } from "@/components/booking/funnel-progress";
import { JourneySummary } from "@/components/booking/journey-summary";
import { VehicleList } from "@/components/booking/vehicle-list";
import { Container } from "@/components/ui/container";
import { checkBookingAvailability } from "@/domain/booking/booking-availability";
import {
  funnelQuery,
  hasJourney,
  largestParty,
  parseFunnelParams,
} from "@/domain/booking/funnel-params";
import { recommendedVehicle, vehicleOptionsFor } from "@/domain/pricing/select-vehicle";
import { chargeableHours, vehicleFarePence } from "@/domain/pricing/quote";
import { company, telHref } from "@/lib/company";

/**
 * Booking step 2 — choose a vehicle (BK-01).
 *
 * Fares shown are the placeholder "from" prices until the pricing engine and
 * the launch price tables land in S2. The server will then recalculate the
 * fare for the actual route, and never trust a price from the client (BK-08).
 */
export const metadata: Metadata = {
  title: "Choose your vehicle",
  robots: { index: false, follow: false },
};

export default async function VehicleStepPage({
  searchParams,
}: PageProps<"/book/vehicle">) {
  const journey = parseFunnelParams(await searchParams);

  // Arriving here without a journey means a stale or hand-edited link; send
  // them back to step 1 rather than showing an empty summary.
  if (!hasJourney(journey)) {
    redirect(`/book?${funnelQuery(journey)}`);
  }

  // BK-05 on the server: the date picker is a convenience, not the rule.
  const windowProblem = await checkBookingAvailability(journey);
  if (windowProblem) {
    return <BookingWindowNotice problem={windowProblem} journey={journey} step={2} />;
  }

  // One vehicle carries the whole booking, so it has to fit the busiest leg —
  // four out and five back still needs a car that seats five.
  const party = largestParty(journey);
  const options = vehicleOptionsFor(party);
  const recommended = recommendedVehicle(party);
  const nextHref = `/book/details?${funnelQuery({ ...journey, vehicle: undefined })}`;

  // Fares are worked out here, on the server, never in the browser (BK-08).
  const fares = Object.fromEntries(
    options.map(({ vehicle }) => [vehicle.slug, vehicleFarePence(journey, vehicle)]),
  );

  const isHourly = journey.service === "hourly";
  const hours = recommended ? chargeableHours(journey, recommended) : journey.hours;
  const fareNote = isHourly
    ? `For ${hours} ${hours === 1 ? "hour" : "hours"}, all inclusive`
    : journey.returnJourney
      ? "Both journeys, all inclusive"
      : "Fixed fare, all inclusive";

  return (
    <>
      <FunnelProgress current={2} />

      <Container className="py-10">
        <div className="gap-gutter grid lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-2">
              Choose your vehicle
            </h1>
            <p className="text-body-lg text-on-surface-variant mb-space-xl max-w-2xl">
              Every fare is fixed and includes everything. Classes that cannot carry{" "}
              {party.passengers} {party.passengers === 1 ? "passenger" : "passengers"} and{" "}
              {party.largeBags} large {party.largeBags === 1 ? "case" : "cases"} are shown
              but cannot be selected.
            </p>

            {recommended ? (
              <VehicleList
                options={options}
                fares={fares}
                fareNote={fareNote}
                initialSlug={journey.vehicle || recommended.slug}
                nextHref={nextHref}
              />
            ) : (
              <NoVehicleFits passengers={party.passengers} bags={party.largeBags} />
            )}
          </div>

          <aside className="lg:col-span-4">
            <JourneySummary journey={journey} />
          </aside>
        </div>
      </Container>
    </>
  );
}

/**
 * A party too large for the fleet is a real booking, not an error — it just
 * needs a person. Sending them to a dead end would lose the job.
 */
function NoVehicleFits({ passengers, bags }: { passengers: number; bags: number }) {
  return (
    <div className="border-outline-variant bg-surface-container-low rounded-card p-space-lg border">
      <div className="flex gap-3">
        <AlertTriangle aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 className="text-headline-sm mb-1">Let us arrange this one for you</h2>
          <p className="text-body-md text-on-surface-variant">
            {passengers} passengers with {bags} large {bags === 1 ? "case" : "cases"} is
            more than one of our vehicles can take, so it needs more than one car. We
            arrange these all the time — we just cannot price it automatically.
          </p>

          <div className="mt-space-md gap-space-md flex flex-wrap items-center">
            <a
              href={telHref()}
              className="bg-primary-container text-on-primary hover:bg-secondary rounded-button text-label-md inline-flex h-12 items-center px-6 font-semibold transition-colors"
            >
              Call {company.phone}
            </a>
            <Link href="/contact" className="text-label-md text-primary hover:underline">
              Or send us the details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
