import { Hourglass, RefreshCw } from "lucide-react";

import { FunnelProgress } from "@/components/booking/funnel-progress";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { company, telHref } from "@/lib/company";

/**
 * Step 4 when this visitor has loaded the payment page far more often than a
 * person does (NFR-04, `RATE_LIMITS.checkout`). Each load is a call to Stripe,
 * and Stripe limits Cityline's account as a whole, so one client refreshing in
 * a loop could make paying fail for everybody else.
 *
 * Their quote is untouched; waiting a few minutes and trying again works.
 */
export function TooManyAttempts({ retryHref }: { retryHref: string }) {
  return (
    <>
      <FunnelProgress current={4} />

      <Container className="py-16">
        <div className="max-w-2xl">
          <p className="bg-surface-container-low text-on-surface-variant text-label-sm mb-space-md inline-flex items-center gap-1.5 rounded-full px-3 py-1">
            <Hourglass aria-hidden className="h-3.5 w-3.5" />
            Please wait a moment
          </p>

          <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-md">
            This page has been opened a lot in a short time
          </h1>

          <p className="text-body-lg text-on-surface-variant">
            To keep payments working for everyone, we pause for a few minutes after that.
            Your quote is still saved — try again shortly and it will be here.
          </p>

          <div className="gap-space-md mt-space-xl flex flex-wrap items-center">
            <ButtonLink href={retryHref}>
              <RefreshCw aria-hidden className="h-4 w-4" />
              Try again
            </ButtonLink>

            <p className="text-body-sm text-on-surface-variant">
              Or call us on{" "}
              <a href={telHref()} className="text-primary tabular-nums hover:underline">
                {company.phone}
              </a>{" "}
              and we will take the booking by phone.
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
