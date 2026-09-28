import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DetailsStep } from "@/components/booking/details-step";
import { FunnelProgress } from "@/components/booking/funnel-progress";
import { Container } from "@/components/ui/container";
import {
  funnelQuery,
  hasJourney,
  parseFunnelParams,
} from "@/domain/booking/funnel-params";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

/**
 * Booking step 3 — passenger details and extras (BK-01, BK-04, BK-06).
 *
 * Guest checkout: no account is required, or offered, before payment.
 */
export const metadata: Metadata = {
  title: "Passenger details",
  robots: { index: false, follow: false },
};

export default async function DetailsStepPage({
  searchParams,
}: PageProps<"/book/details">) {
  const journey = parseFunnelParams(await searchParams);

  if (!hasJourney(journey)) {
    redirect(`/book?${funnelQuery(journey)}`);
  }

  // A vehicle must have been chosen. An unknown slug means a stale or edited
  // link, so send them back to pick again rather than guessing a class for them.
  const vehicle = VEHICLE_CLASSES.find((item) => item.slug === journey.vehicle);
  if (!vehicle) {
    redirect(`/book/vehicle?${funnelQuery({ ...journey, vehicle: undefined })}`);
  }

  return (
    <>
      <FunnelProgress current={3} />

      <Container className="py-10">
        <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-2">
          Passenger details
        </h1>
        <p className="text-body-lg text-on-surface-variant mb-space-xl max-w-2xl">
          Almost there. We need to know who is travelling and how to reach you on the day.
        </p>

        <DetailsStep journey={journey} vehicle={vehicle} />
      </Container>
    </>
  );
}
