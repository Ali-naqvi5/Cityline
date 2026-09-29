import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CannotShowBooking } from "@/components/booking/cannot-show-booking";
import { CancelForm } from "@/components/manage/cancel-form";
import { Container } from "@/components/ui/container";
import { loadBooking } from "@/domain/booking/load-booking";
import {
  canManageOnline,
  cancellationTerms,
  nextPickup,
} from "@/domain/booking/manage-rules";
import { formatReferenceForSpeech } from "@/domain/booking/reference";
import { formatPence } from "@/domain/money";
import { policies } from "@/lib/policies";
import { formatDate, formatTime } from "@/lib/time";

/**
 * Cancel a booking (BK-07, §5 `/manage/[ref]/cancel`).
 *
 * §5 asks this page to "show the actual refund before confirming", so the
 * amount is worked out here from the same rule the cancellation itself uses
 * (`cancellationTerms`), not described in general terms. Refunds are then made
 * by the office rather than automatically (Cityline, 29 Sep 2026), and the
 * page says so plainly.
 */
export const metadata: Metadata = {
  title: "Cancel your booking",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function CancelBookingPage({
  params,
  searchParams,
}: PageProps<"/manage/[ref]/cancel">) {
  const { ref } = await params;
  const query = await searchParams;
  const token = typeof query.t === "string" ? query.t : "";

  const loaded = await loadBooking(ref, token);
  if (loaded.state !== "ok") return <CannotShowBooking />;

  const { booking, jobs } = loaded;
  const backHref = `/manage/${booking.reference}?t=${encodeURIComponent(token)}`;
  const terms = cancellationTerms(booking.totalPence, jobs);
  if (!canManageOnline(booking.status, jobs) || !terms) redirect(backHref);

  const next = nextPickup(jobs);

  return (
    <Container className="py-12 sm:py-16">
      <div className="max-w-2xl">
        <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-sm">
          Cancel your booking?
        </h1>
        <p className="text-body-lg text-on-surface-variant mb-space-xl">
          Booking{" "}
          <strong className="tabular-nums">
            {formatReferenceForSpeech(booking.reference)}
          </strong>
          {next ? (
            <>
              , pickup {formatDate(next)} at {formatTime(next)}
            </>
          ) : null}
          .
        </p>

        <div className="border-outline-variant bg-surface-container-low rounded-card p-space-lg mb-space-xl border">
          <h2 className="text-title-md mb-space-sm">Your refund</h2>
          {terms.kind === "full" ? (
            <p className="text-body-lg">
              You get a <strong>full refund of {formatPence(terms.refundPence)}</strong>,
              because you are cancelling at least {policies.freeCancellationHours} hours
              before pickup.
            </p>
          ) : (
            <p className="text-body-lg">
              Your pickup is less than {policies.freeCancellationHours} hours away, so a
              partial refund applies
              {terms.refundPence === null
                ? " — our team will confirm the amount."
                : ` of ${formatPence(terms.refundPence)}.`}
            </p>
          )}
          <p className="text-body-md text-on-surface-variant mt-space-sm">
            Refunds are made by our team, back to the card you paid with — we will be in
            touch to arrange it. Once it is on its way, it usually reaches your account
            within a few working days.
          </p>
        </div>

        <CancelForm reference={booking.reference} token={token} backHref={backHref} />
      </div>
    </Container>
  );
}
