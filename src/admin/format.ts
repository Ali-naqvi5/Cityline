import { formatPence, type Pence } from "@/domain/money";
import { londonDateAndTime, londonToUtc } from "@/lib/time";

/**
 * Dates and money as the admin shows them. Every pickup is stored in UTC and
 * shown in London time — a controller in the office and a server in a data
 * centre must agree on what "today" means.
 */

const TZ = "Europe/London";

/** YYYY-MM-DD for the London day containing this instant. */
export function londonDay(instant: Date = new Date()): string {
  return londonDateAndTime(instant).date;
}

/** Adds whole days to a YYYY-MM-DD date, calendar-wise. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/** The UTC instants a London day starts and ends at (end exclusive). */
export function londonDayBounds(date: string): { start: Date; end: Date } {
  return {
    start: londonToUtc(date, "00:00"),
    end: londonToUtc(addDays(date, 1), "00:00"),
  };
}

/** Monday of the London week containing `date`. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

export function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

const pickupFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dayHeadingFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const stampFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Thu 1 Oct" */
export function shortDay(instant: Date): string {
  return pickupFormat.format(instant).replace(",", "");
}

/** "10:30" */
export function clock(instant: Date): string {
  return timeFormat.format(instant);
}

/** "Thu 1 Oct · 10:30" */
export function pickupLabel(instant: Date): string {
  return `${shortDay(instant)} · ${clock(instant)}`;
}

/** "Thursday 1 October", for a YYYY-MM-DD London day. */
export function dayHeading(date: string): string {
  return dayHeadingFormat.format(londonToUtc(date, "12:00")).replace(",", "");
}

/** "1 Oct 2026, 10:30" — when something was done. */
export function stamp(instant: Date): string {
  return stampFormat.format(instant);
}

/** "in 18 h", "in 45 min", "3 d ago" — how far away a pickup is. */
export function relative(instant: Date, now: Date = new Date()): string {
  const minutes = Math.round((instant.getTime() - now.getTime()) / 60_000);
  const past = minutes < 0;
  const abs = Math.abs(minutes);
  let text: string;
  if (abs < 1) return "now";
  if (abs < 60) text = `${abs} min`;
  else if (abs < 48 * 60) text = `${Math.round(abs / 60)} h`;
  else text = `${Math.round(abs / 1440)} d`;
  return past ? `${text} ago` : `in ${text}`;
}

export function money(pence: number | null | undefined): string {
  return typeof pence === "number" ? formatPence(pence as Pence) : "—";
}
