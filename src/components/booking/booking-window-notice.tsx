import { CalendarClock, Phone } from "lucide-react";

import { FunnelProgress } from "@/components/booking/funnel-progress";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import {
  bookingWindowMessage,
  type BookingWindowProblem,
} from "@/domain/booking/booking-window";
import { funnelQuery, type FunnelParams } from "@/domain/booking/funnel-params";
import { company, telHref } from "@/lib/company";

/**
 * §7's "pickup too soon" state, and its relatives: a journey the website cannot
 * take (BK-05). Shown in place of the step, not as a redirect, for the same
 * reason as the expired-quote screen — saying what happened and what to do
 * beats silently bouncing someone back to step 1.
 *
 * The journey is carried back into step 1 so changing the time is the only
 * thing left to do, and the phone number is right there because "sooner than
 * three hours" is exactly the case where a person can often still help.
 */
export function BookingWindowNotice({
  problem,
  journey,
  step,
}: {
  problem: BookingWindowProblem;
  journey: FunnelParams;
  step: 2 | 3 | 4;
}) {
  return (
    <>
      <FunnelProgress current={step} />

      <Container className="py-16">
        <div className="max-w-2xl">
          <p className="bg-surface-container-low text-on-surface-variant text-label-sm mb-space-md inline-flex items-center gap-1.5 rounded-full px-3 py-1">
            <CalendarClock aria-hidden className="h-3.5 w-3.5" />
            Check your date and time
          </p>

          <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-md">
            We cannot book this journey online
          </h1>

          <p role="alert" className="text-body-lg text-on-surface-variant">
            {bookingWindowMessage(problem)}
          </p>

          <div className="gap-space-md mt-space-xl flex flex-wrap items-center">
            <ButtonLink href={`/book?${funnelQuery(journey)}`}>
              Change the date or time
            </ButtonLink>

            <p className="text-body-sm text-on-surface-variant flex items-center gap-1.5">
              <Phone aria-hidden className="h-4 w-4" />
              <a href={telHref()} className="text-primary tabular-nums hover:underline">
                {company.phone}
              </a>
              — {company.serviceHours}
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
