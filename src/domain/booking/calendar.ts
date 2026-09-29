import { company } from "@/lib/company";
import { formatTime } from "@/lib/time";

/**
 * The calendar file that goes out with a confirmation (NOT-01).
 *
 * A pure string builder, deliberately: the same `.ics` has to be attached to
 * the confirmation email, offered as a download on the confirmation screen, and
 * regenerated identically after an amendment. Anything that read the database
 * or the clock could not be tested, and NOT-01 is a requirement worth testing —
 * a malformed file is silently dropped by Outlook rather than reported.
 *
 * Written against RFC 5545 rather than a library. The whole of what is needed
 * here is one VEVENT with a fixed UTC start, and a dependency that renders
 * `DTSTART` in local time would reintroduce exactly the timezone bug
 * `londonToUtc` exists to remove.
 */

export interface CalendarEvent {
  /** Booking reference — also the stable part of the event's UID. */
  reference: string;
  /** Which leg, so a return booking produces two distinct events. */
  leg: "outbound" | "return";
  /** Pickup, in UTC (NFR-08). */
  pickupAt: Date;
  pickup: string;
  /** Empty on an hourly hire — there is no fixed destination. */
  dropoff: string;
  /** Hourly hire only; used to give the event a realistic length. */
  hours?: number;
  passengers: number;
  /** Shown so the passenger can check it without opening the email. */
  vehicleName: string;
  manageUrl: string;
}

/** A guess at how long to block out, so the event does not look instantaneous. */
const DEFAULT_DURATION_MINUTES = 90;

function utcStamp(instant: Date): string {
  // RFC 5545 basic format: 20261025T013000Z. No punctuation, no milliseconds.
  return `${instant.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/**
 * Escapes a value for a text property (RFC 5545 §3.3.11).
 *
 * Backslash first — escaping it after the others would double-escape the
 * backslashes they introduce. An address containing a comma is the common case
 * here ("Hillingdon House, Wren Avenue"), and an unescaped one silently ends
 * the property, truncating the location.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * Folds a line to 75 octets (RFC 5545 §3.1).
 *
 * Counted in **bytes, not characters**. A long address with a £ or an é in it
 * is longer in UTF-8 than it looks, and folding on character count can split a
 * multi-byte sequence down the middle — which produces a file that some clients
 * reject outright and others render with a replacement character.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const pieces: string[] = [];
  let start = 0;

  while (start < bytes.length) {
    // 75 on the first line; continuations carry a leading space, so 74.
    const limit = start === 0 ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);

    // Back off to a character boundary: continuation bytes are 10xxxxxx.
    while (end > start && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) {
      end -= 1;
    }

    pieces.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }

  return pieces.join("\r\n ");
}

function durationMinutes(event: CalendarEvent): number {
  return event.hours && event.hours > 0 ? event.hours * 60 : DEFAULT_DURATION_MINUTES;
}

function summary(event: CalendarEvent): string {
  const direction = event.leg === "return" ? "Return transfer" : "Transfer";
  const destination = event.dropoff ? ` to ${event.dropoff}` : "";

  return `${company.tradingName}: ${direction}${destination}`;
}

function description(event: CalendarEvent): string {
  const lines = [
    `Booking ${event.reference}`,
    `Pickup: ${event.pickup} at ${formatTime(event.pickupAt)}`,
    event.dropoff
      ? `Drop-off: ${event.dropoff}`
      : `Hourly hire: ${event.hours ?? 0} hours`,
    `Vehicle: ${event.vehicleName}`,
    `Passengers: ${event.passengers}`,
    "",
    `View, change or cancel: ${event.manageUrl}`,
    `Questions: ${company.phone}`,
  ];

  return lines.join("\n");
}

/**
 * One VEVENT per leg, in a single calendar so a return booking imports as two
 * appointments from one file.
 *
 * `now` is a parameter rather than a call to `new Date()` so the output is
 * reproducible — both for the tests and so regenerating a file after an
 * amendment differs only where the booking differs.
 */
export function buildCalendar(events: readonly CalendarEvent[], now: Date): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${company.tradingName}//Booking//EN`,
    "CALSCALE:GREGORIAN",
    // The passenger is being told about their own booking, not invited to
    // negotiate a time, so PUBLISH rather than REQUEST. REQUEST would make some
    // clients send an RSVP back to an address that does not accept them.
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    const end = new Date(event.pickupAt.getTime() + durationMinutes(event) * 60_000);

    lines.push(
      "BEGIN:VEVENT",
      // Stable across regeneration: an amended booking updates the existing
      // calendar entry instead of leaving the old time sitting there too.
      `UID:${event.reference}-${event.leg}@citylineairporttransfers.com`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(event.pickupAt)}`,
      `DTEND:${utcStamp(end)}`,
      `SUMMARY:${escapeText(summary(event))}`,
      `LOCATION:${escapeText(event.pickup)}`,
      `DESCRIPTION:${escapeText(description(event))}`,
      `URL:${escapeText(event.manageUrl)}`,
      "STATUS:CONFIRMED",
      // A reminder the night before is the one that is actually useful: it
      // leaves time to change a booking, which one an hour before does not.
      "BEGIN:VALARM",
      "TRIGGER:-PT12H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(`${company.tradingName} pickup tomorrow`)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  // CRLF throughout, and a trailing one: RFC 5545 requires it, and Outlook is
  // the client that actually cares.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** `cityline-CL-7K4Q2P.ics` — recognisable in a downloads folder. */
export function calendarFilename(reference: string): string {
  return `cityline-${reference}.ics`;
}

/** The fields of a job the calendar needs — a subset of the `jobs` row. */
export interface CalendarJob {
  leg?: "outbound" | "return" | null;
  pickupAt: string;
  pickupAddress: string;
  dropoffAddress?: string | null;
  hours?: number | null;
  passengers: number;
  vehicleClassSlug: string;
}

/**
 * One calendar event per job. Shared by the download on the confirmation page
 * and the file attached to the confirmation email, so the two cannot disagree
 * about a pickup time.
 */
export function calendarEventsForJobs(
  reference: string,
  jobs: readonly CalendarJob[],
  manageUrl: string,
  vehicleName: (slug: string) => string,
): CalendarEvent[] {
  return jobs.map((job) => ({
    reference,
    leg: job.leg === "return" ? "return" : "outbound",
    pickupAt: new Date(job.pickupAt),
    pickup: job.pickupAddress,
    dropoff: job.dropoffAddress ?? "",
    hours: job.hours ?? undefined,
    passengers: job.passengers,
    vehicleName: vehicleName(job.vehicleClassSlug),
    manageUrl,
  }));
}
