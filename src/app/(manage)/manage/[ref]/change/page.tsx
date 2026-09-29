import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { legHeading } from "@/components/booking/booking-leg-card";
import { CannotShowBooking } from "@/components/booking/cannot-show-booking";
import { ChangeForm } from "@/components/manage/change-form";
import { Container } from "@/components/ui/container";
import { loadBooking } from "@/domain/booking/load-booking";
import { canManageOnline, upcomingJobs } from "@/domain/booking/manage-rules";
import { londonDateAndTime } from "@/lib/time";

/**
 * Change a booking's date, time or passenger details (BK-07).
 *
 * Only reachable while the booking can be changed online — within 24 hours of
 * pickup the view page sends people to the phone instead, and so does this.
 */
export const metadata: Metadata = {
  title: "Change your booking",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function ChangeBookingPage({
  params,
  searchParams,
}: PageProps<"/manage/[ref]/change">) {
  const { ref } = await params;
  const query = await searchParams;
  const token = typeof query.t === "string" ? query.t : "";

  const loaded = await loadBooking(ref, token);
  if (loaded.state !== "ok") return <CannotShowBooking />;

  const { booking, jobs } = loaded;
  const backHref = `/manage/${booking.reference}?t=${encodeURIComponent(token)}`;
  if (!canManageOnline(booking.status, jobs)) redirect(backHref);

  const upcoming = upcomingJobs(jobs);
  const first = upcoming[0];
  const outbound = upcoming.find((job) => job.leg !== "return");

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-sm">
        Change your booking
      </h1>
      <p className="text-body-lg text-on-surface-variant mb-space-xl max-w-2xl">
        Update the date and time, the flight, or the passenger&rsquo;s details. Your fare
        stays the same, and we email you the new details.
      </p>

      <ChangeForm
        reference={booking.reference}
        token={token}
        legs={upcoming.map((job) => ({
          jobId: job.id,
          heading: legHeading(job, jobs),
          ...londonDateAndTime(new Date(job.pickupAt)),
        }))}
        flightNumber={outbound?.flightNumber ?? ""}
        hasFlight={Boolean(outbound)}
        passengerName={first?.nameBoardText ?? first?.leadName ?? ""}
        passengerPhone={first?.leadPhone ?? ""}
        notes={first?.driverNotes ?? ""}
        backHref={backHref}
      />
    </Container>
  );
}
