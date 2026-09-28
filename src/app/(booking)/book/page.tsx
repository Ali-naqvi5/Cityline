import type { Metadata } from "next";

import { JourneyForm } from "@/components/booking/journey-form";
import { FunnelProgress } from "@/components/booking/funnel-progress";
import { Container } from "@/components/ui/container";
import { parseFunnelParams } from "@/domain/booking/funnel-params";
import { earliestBookableDate } from "@/domain/booking/journey";
import { policies } from "@/lib/policies";

/**
 * Booking step 1 — the journey (BK-01 … BK-05).
 *
 * The funnel is never indexed (SEO-03, enforced in `src/proxy.ts`), and never
 * requires an account (BK-06).
 *
 * The quote widget hands over its values as query parameters, so someone who
 * started on a landing page does not retype anything.
 */
export const metadata: Metadata = {
  title: "Your journey",
  robots: { index: false, follow: false },
};

export default async function BookingJourneyPage({ searchParams }: PageProps<"/book">) {
  // Parsed with the same function every other step uses, so a journey started
  // in the hero widget arrives here complete — service mode, stops, return leg
  // and all — instead of being partially re-read with a local helper.
  const journey = parseFunnelParams(await searchParams);
  const minDate = earliestBookableDate();

  return (
    <>
      <FunnelProgress current={1} />

      <Container className="py-10">
        <div className="gap-gutter grid lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-2">
              Your journey
            </h1>
            <p className="text-body-lg text-on-surface-variant mb-space-xl max-w-2xl">
              Tell us where you are going and when. You will see prices on the next
              screen, before we ask for any personal details.
            </p>

            <JourneyForm minDate={minDate} defaults={journey} />
          </div>

          <aside className="lg:col-span-4">
            <div className="border-outline-variant bg-surface-container-low rounded-card p-space-lg sticky top-28 border">
              <h2 className="text-headline-sm mb-space-md">Included in every transfer</h2>
              <ul className="text-body-sm text-on-surface-variant space-y-2.5">
                <li>
                  <strong className="text-on-surface">
                    {policies.airportFreeWaitingMinutes} minutes free waiting
                  </strong>{" "}
                  at the airport, from the time your flight lands.
                </li>
                <li>
                  <strong className="text-on-surface">Meet and greet</strong> in the
                  arrivals hall, with a name board and help with your luggage.
                </li>
                <li>
                  <strong className="text-on-surface">A fixed fare</strong>, agreed before
                  you travel. Congestion charges included, and no card fees.
                </li>
                <li>
                  <strong className="text-on-surface">
                    Free cancellation up to {policies.freeCancellationHours} hours
                  </strong>{" "}
                  before pickup, refunded in full.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
