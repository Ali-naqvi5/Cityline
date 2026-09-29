import { CircleAlert, Phone } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { company, telHref } from "@/lib/company";

/**
 * Shown for both a reference that does not exist and a link whose token is
 * wrong or missing — on the confirmation screen and in Manage booking.
 *
 * Identical for both on purpose — see `load-booking.ts`. The copy assumes a
 * customer with a broken link rather than an intruder, because that is who
 * actually ends up here: mail clients truncate long URLs, and people copy them
 * by hand off a phone screen. So it offers the way to get a fresh link.
 */
export function CannotShowBooking() {
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
            You can also{" "}
            <Link href="/manage" className="text-primary font-semibold underline">
              ask for a fresh link
            </Link>{" "}
            with your booking reference and email. Nothing is lost — if you have had a
            confirmation email, your car is booked.
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
