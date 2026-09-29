import {
  buildCalendar,
  calendarEventsForJobs,
  calendarFilename,
} from "@/domain/booking/calendar";
import { loadBooking } from "@/domain/booking/load-booking";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { siteUrl } from "@/lib/company";

/**
 * The calendar file for a booking (NOT-01).
 *
 * The same `.ics` the confirmation email attaches, offered as a download on the
 * confirmation screen — one builder, so the two can never disagree about a
 * pickup time.
 *
 * Guarded exactly like the page it sits under: the reference is not a secret, so
 * the magic-link token is checked before anything is written. Without that, a
 * guessed reference would hand over a passenger's address and the hour their
 * house is empty in a single file.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const { ref } = await params;
  const manageToken = new URL(request.url).searchParams.get("t") ?? "";

  const loaded = await loadBooking(ref, manageToken);
  if (loaded.state !== "ok") {
    // Deliberately terse and identical for a missing reference and a bad token.
    return new Response("Not found", { status: 404 });
  }

  const { booking, jobs } = loaded;
  const origin = siteUrl();
  const manageUrl = `${origin}/manage/${booking.reference}?t=${encodeURIComponent(manageToken)}`;

  const events = calendarEventsForJobs(
    booking.reference,
    jobs,
    manageUrl,
    (slug) => VEHICLE_CLASSES.find((item) => item.slug === slug)?.name ?? slug,
  );

  return new Response(buildCalendar(events, new Date()), {
    headers: {
      // `charset` spelled out: a £ in an address is mojibake without it in some
      // desktop clients.
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${calendarFilename(booking.reference)}"`,
      // A booking can be amended, so a cached file could hand someone the old
      // pickup time. Never store this one.
      "cache-control": "no-store, max-age=0",
      // The URL carries the magic-link token, so no part of it travels onward.
      "referrer-policy": "no-referrer",
    },
  });
}
