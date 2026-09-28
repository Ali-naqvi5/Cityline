/**
 * Time conventions (NFR-08): stored in UTC, shown in Europe/London.
 * Every user-facing timestamp goes through here — never `toLocaleString()` with
 * the server's locale, which would silently drift with the host's timezone.
 */
export const DISPLAY_TIMEZONE = "Europe/London";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIMEZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const dateOnly = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIMEZONE,
  dateStyle: "medium",
});

const timeOnly = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIMEZONE,
  timeStyle: "short",
});

/** e.g. "14 Mar 2027, 09:05" — London wall-clock time, whatever the server's zone. */
export function formatDateTime(instant: Date): string {
  return dateTime.format(instant);
}

/** e.g. "14 Mar 2027" */
export function formatDate(instant: Date): string {
  return dateOnly.format(instant);
}

/** e.g. "09:05" — the pickup time a passenger and driver both read. */
export function formatTime(instant: Date): string {
  return timeOnly.format(instant);
}
