import { Ban, CalendarPlus, Check, Phone, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BookingLegCard } from "@/components/booking/booking-leg-card";
import { CannotShowBooking } from "@/components/booking/cannot-show-booking";
import { Container } from "@/components/ui/container";
import { loadBooking } from "@/domain/booking/load-booking";
import { canManageOnline, onlineDeadline } from "@/domain/booking/manage-rules";
import { formatReferenceForSpeech } from "@/domain/booking/reference";
import { formatPence } from "@/domain/money";
import { company, telHref } from "@/lib/company";
import { policies } from "@/lib/policies";
import { formatDate, formatTime } from "@/lib/time";

/**
 * Manage booking (BK-07, §5 `/manage/[ref]`): the booking as it stands, and
 * the two things a customer can do with it online — change the details or
 * cancel.
 *
 * Guarded like the confirmation page: the reference alone is not enough, the
 * magic-link token must match. Never indexed, and no referrer, because the URL
 * carries that token.
 */
export const metadata: Metadata = {
  title: "Manage booking",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function ManageBookingPage({
  params,
  searchParams,
}: PageProps<"/manage/[ref]">) {
  const { ref } = await params;
  const query = await searchParams;
  const token = typeof query.t === "string" ? query.t : "";

  const loaded = await loadBooking(ref, token);
  if (loaded.state !== "ok") return <CannotShowBooking />;

  const { booking, jobs } = loaded;
  const cancelled = booking.status === "cancelled";
  const manageable = canManageOnline(booking.status, jobs);
  const deadline = onlineDeadline(jobs);
  const withToken = (path: string) =>
    `/manage/${booking.reference}${path}?t=${encodeURIComponent(token)}`;

  return (
    <Container className="py-12 sm:py-16">
      <div className="max-w-3xl">
        {query.updated ? (
          <Notice icon={<Check aria-hidden className="h-5 w-5" />}>
            Your changes are saved. We have emailed you the updated details.
          </Notice>
        ) : null}
        {query.cancelled ? (
          <Notice icon={<Check aria-hidden className="h-5 w-5" />}>
            Your booking is cancelled and no car will come. We have emailed you, and our
            team will be in touch about your refund.
          </Notice>
        ) : null}

        <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-sm">
          {cancelled ? "Cancelled booking" : "Your booking"}
        </h1>
        <p className="text-body-lg text-on-surface-variant mb-space-xl">
          Reference{" "}
          <strong className="text-primary tabular-nums select-all">
            {formatReferenceForSpeech(booking.reference)}
          </strong>
          . Quote it if you call us.
        </p>
      </div>

      <div className="gap-gutter grid lg:grid-cols-12">
        <div className="gap-space-lg flex flex-col lg:col-span-7">
          {jobs.map((job) => (
            <BookingLegCard key={job.id} job={job} jobs={jobs} />
          ))}
        </div>

        <aside className="lg:col-span-5">
          <div className="gap-space-lg sticky top-28 flex flex-col">
            <div className="border-outline-variant bg-surface-container-lowest rounded-card shadow-card p-space-lg border">
              <div className="flex items-end justify-between">
                <span className="text-title-md">Paid</span>
                <span className="text-fare-tabular text-primary tabular-nums">
                  {formatPence(booking.totalPence)}
                </span>
              </div>
              {cancelled && booking.cancelledAt ? (
                <p className="text-body-sm text-on-surface-variant mt-space-sm">
                  Cancelled on {formatDate(new Date(booking.cancelledAt))} at{" "}
                  {formatTime(new Date(booking.cancelledAt))}. Refunds are made by our
                  team to the card you paid with.
                </p>
              ) : null}
            </div>

            {manageable ? (
              <div className="gap-space-sm flex flex-col">
                <Link
                  href={withToken("/change")}
                  className="bg-primary-container text-on-primary hover:bg-secondary rounded-button text-label-md flex h-12 items-center justify-center gap-2 font-semibold transition-colors"
                >
                  <Settings2 aria-hidden className="h-4 w-4" />
                  Change date, time or details
                </Link>
                <Link
                  href={withToken("/cancel")}
                  className="border-outline text-on-surface hover:bg-surface-container-low rounded-button text-label-md flex h-12 items-center justify-center gap-2 border font-semibold transition-colors"
                >
                  <Ban aria-hidden className="h-4 w-4" />
                  Cancel booking
                </Link>
                {deadline ? (
                  <p className="text-body-sm text-on-surface-variant">
                    You can change or cancel online until {formatDate(deadline)} at{" "}
                    {formatTime(deadline)}. Cancelling by then gets a full refund.
                  </p>
                ) : null}
              </div>
            ) : !cancelled ? (
              <div className="border-outline-variant rounded-card p-space-lg border">
                <h2 className="text-title-md mb-space-sm">Need to change something?</h2>
                <p className="text-body-md text-on-surface-variant">
                  Your pickup is less than {policies.freeCancellationHours} hours away, so
                  changes and cancellations go through our team — a driver may already be
                  on the way. Call{" "}
                  <a
                    href={telHref()}
                    className="text-primary tabular-nums hover:underline"
                  >
                    {company.phone}
                  </a>{" "}
                  ({company.serviceHours}).
                </p>
              </div>
            ) : null}

            {!cancelled ? (
              <a
                href={`/book/confirmed/${booking.reference}/calendar?t=${encodeURIComponent(token)}`}
                className="text-label-md text-primary flex items-center gap-2 hover:underline"
              >
                <CalendarPlus aria-hidden className="h-4 w-4" />
                Add to your calendar
              </a>
            ) : null}

            <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
              <Phone aria-hidden className="h-4 w-4" />
              Questions? Call{" "}
              <a href={telHref()} className="text-primary tabular-nums hover:underline">
                {company.phone}
              </a>
            </p>
          </div>
        </aside>
      </div>
    </Container>
  );
}

function Notice({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      className="bg-surface-container-low border-outline-variant rounded-card p-space-md text-body-md mb-space-lg flex gap-2 border"
    >
      <span className="text-primary mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  );
}
