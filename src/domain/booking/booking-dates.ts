import { bookingRules } from "./rules";

/**
 * The earliest date a customer can pick, as `yyyy-mm-dd` in London time, so a
 * date picker cannot offer a day we would only reject later (BK-05).
 *
 * Kept apart from `journey.ts` so the quote widget can call it in the browser
 * without bundling Zod onto every marketing page. It reads the clock, which
 * makes it impure, and it is the kind of off-by-one-day logic that deserves a
 * test — see `journey.test.ts`.
 */
export function earliestBookableDate(now: Date = new Date()): string {
  const rules = bookingRules();
  const earliest = new Date(now.getTime() + rules.minNoticeMinutes * 60_000);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(earliest);
}
