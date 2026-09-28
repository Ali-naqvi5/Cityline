import { Clock, RefreshCw } from "lucide-react";

import { FunnelProgress } from "@/components/booking/funnel-progress";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { funnelQuery, type FunnelParams } from "@/domain/booking/funnel-params";
import { bookingRules } from "@/domain/booking/rules";
import { company, telHref } from "@/lib/company";

/**
 * "Your quote has expired" — one of the four error states §7 requires, and the
 * one BK-08's 30-minute limit makes inevitable.
 *
 * A screen rather than a redirect, deliberately. Silently bouncing someone
 * back to step 1 with their form refilled looks like the site lost their work;
 * saying what happened and why, with one button to re-quote, does not.
 *
 * The journey is carried through, so "get a new price" is a click rather than
 * retyping an address, a date and a party at the point of most frustration.
 */
export function QuoteExpired({ journey }: { journey: FunnelParams }) {
  const minutes = bookingRules().quoteTtlMinutes;

  return (
    <>
      <FunnelProgress current={4} />

      <Container className="py-16">
        <div className="max-w-2xl">
          <p className="bg-surface-container-low text-on-surface-variant text-label-sm mb-space-md inline-flex items-center gap-1.5 rounded-full px-3 py-1">
            <Clock aria-hidden className="h-3.5 w-3.5" />
            Quote expired
          </p>

          <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-md">
            That price is a little out of date
          </h1>

          <div className="gap-space-md text-body-lg text-on-surface-variant flex flex-col">
            <p>
              We hold a quote for {minutes} minutes so the fare you are shown is one we
              can still honour. This one is older than that, so rather than charge you a
              price we set earlier, here is a fresh one.
            </p>
            <p>
              Nothing is lost — your journey is still filled in. Getting a new price takes
              a few seconds.
            </p>
          </div>

          <div className="gap-space-md mt-space-xl flex flex-wrap items-center">
            <ButtonLink href={`/book/vehicle?${funnelQuery(journey)}`}>
              <RefreshCw aria-hidden className="h-4 w-4" />
              Get a new price
            </ButtonLink>

            <p className="text-body-sm text-on-surface-variant">
              Or call us on{" "}
              <a href={telHref()} className="text-primary tabular-nums hover:underline">
                {company.phone}
              </a>{" "}
              — {company.serviceHours}.
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
