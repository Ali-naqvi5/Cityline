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

/**
 * The offset between UTC and London wall-clock time at a given instant, in ms.
 *
 * Derived from `Intl` rather than a hard-coded BST rule, so it stays correct if
 * the UK ever changes its clock-change dates — and it is already correct for
 * every historical year, which matters when an old booking is re-read.
 */
function londonOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const field = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  // Read London's wall clock, then re-read it as though it were UTC. The gap
  // between that and the real instant is the offset.
  const asIfUtc = Date.UTC(
    field("year"),
    field("month") - 1,
    field("day"),
    // Intl renders midnight as hour 24 in some engines with hour12: false.
    field("hour") % 24,
    field("minute"),
    field("second"),
  );

  return asIfUtc - instant.getTime();
}

const HOUR_MS = 3_600_000;

/**
 * A London wall-clock date and time (`2026-10-25`, `01:30`) as a UTC instant.
 *
 * The funnel collects what the customer reads off their own clock; the database
 * stores UTC (NFR-08). Something has to bridge the two, and doing it with
 * `new Date("2026-10-25T01:30")` would bridge it using *the server's* timezone
 * — correct on a London laptop, an hour out on a UTC container, and wrong in a
 * way that only shows up for half the year.
 *
 * London wall time is not quite a function of UTC. Twice a year it breaks:
 *
 *   The spring gap — 01:00–02:00 on the last Sunday in March never happens.
 *   The autumn overlap — 01:00–02:00 on the last Sunday in October happens
 *   twice, once in BST and again in GMT.
 *
 * So this does not converge on an answer; it tests them. Both offsets in force
 * around any nearby clock change give a candidate instant, and a candidate is
 * only accepted if reading its London clock gives back the wall time asked for.
 * The earlier of the accepted ones wins.
 *
 * That ordering is the whole point. Inside the autumn overlap both candidates
 * are valid and erring early is the only defensible direction: a driver who
 * waits an hour has cost Cityline some goodwill, one who arrives an hour after
 * the passenger expected has cost them their flight. Inside the spring gap
 * neither is valid — the time never happened — and the earlier is returned for
 * the same reason.
 */
export function londonToUtc(date: string, time: string): Date {
  const wallAsUtc = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(wallAsUtc)) {
    throw new RangeError(`Not a London date and time: "${date}" "${time}"`);
  }

  /*
   * Twelve hours either side: comfortably more than the one-hour shift, so a
   * nearby transition is always caught, and comfortably less than the months
   * between changes, so no unrelated one is dragged in. Away from a transition
   * these are the same offset and both candidates collapse to one instant.
   */
  const fromBefore = wallAsUtc - londonOffsetMs(new Date(wallAsUtc - 12 * HOUR_MS));
  const fromAfter = wallAsUtc - londonOffsetMs(new Date(wallAsUtc + 12 * HOUR_MS));

  const earlier = Math.min(fromBefore, fromAfter);
  const later = Math.max(fromBefore, fromAfter);

  /*
   * `londonOffsetMs` is defined as (London wall clock read as UTC) − instant,
   * so adding it back lands on the wall time. Equality with what was asked for
   * is therefore an exact round-trip check, not an approximation.
   */
  const readsBackCorrectly = (instant: number): boolean =>
    instant + londonOffsetMs(new Date(instant)) === wallAsUtc;

  if (readsBackCorrectly(earlier)) return new Date(earlier);
  if (readsBackCorrectly(later)) return new Date(later);

  return new Date(earlier);
}

/**
 * A UTC instant as London's `yyyy-mm-dd` and `HH:mm` — the inverse of
 * `londonToUtc`, for prefilling a date and time picker with a stored pickup.
 */
export function londonDateAndTime(instant: Date): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: DISPLAY_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
