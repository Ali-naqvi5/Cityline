import { policies } from "@/lib/policies";

/**
 * What a customer may do to their own booking online (BK-07), as pure rules.
 *
 * Two windows, one number. Online changes and cancellation both close
 * `freeCancellationHours` before the next pickup — 24 hours today. Inside that,
 * a driver may already be on the job, so the office handles it by phone.
 *
 * Changes are limited to things that do not change the price: the date and
 * time, the flight number, the passenger's name and phone, and notes. Fares are
 * not repriced online and refunds are made by the office, not automatically
 * (Cityline, 29 Sep 2026), so an address, vehicle or party change goes through
 * a person.
 *
 * Times compare in whole minutes, as the booking rules do: "24 hours before
 * 09:00" means 09:00 the day before, whatever the seconds.
 */

export interface ManageableJob {
  pickupAt: string | Date;
  status: string;
}

const HOUR_MS = 3_600_000;

/** Jobs still to happen: not cancelled, completed or a no-show. */
export function upcomingJobs<T extends ManageableJob>(jobs: readonly T[]): T[] {
  return jobs.filter(
    (job) => !["cancelled", "completed", "no_show"].includes(job.status),
  );
}

/** The next pickup the booking has, or null if nothing is left to travel. */
export function nextPickup(jobs: readonly ManageableJob[]): Date | null {
  const times = upcomingJobs(jobs).map((job) => new Date(job.pickupAt).getTime());
  return times.length ? new Date(Math.min(...times)) : null;
}

function minutesUntil(at: Date, now: Date): number {
  const nowToTheMinute = Math.floor(now.getTime() / 60_000) * 60_000;
  return (at.getTime() - nowToTheMinute) / 60_000;
}

/** Whether the booking can still be changed or cancelled online. */
export function canManageOnline(
  bookingStatus: string,
  jobs: readonly ManageableJob[],
  now: Date = new Date(),
): boolean {
  if (bookingStatus !== "confirmed") return false;

  const next = nextPickup(jobs);
  if (!next) return false;

  return minutesUntil(next, now) >= policies.freeCancellationHours * 60;
}

export type CancellationTerms =
  | { kind: "full"; refundPence: number }
  /** Inside the free window. `refundPence` is null until Cityline sets the percentage. */
  | { kind: "partial"; refundPence: number | null; percent: number | null };

/**
 * What a customer gets back if they cancel now. Measured from the next pickup,
 * so a return trip whose outbound has already run is judged on the return leg.
 */
export function cancellationTerms(
  totalPence: number,
  jobs: readonly ManageableJob[],
  now: Date = new Date(),
): CancellationTerms | null {
  const next = nextPickup(jobs);
  if (!next) return null;

  if (minutesUntil(next, now) >= policies.freeCancellationHours * 60) {
    return {
      kind: "full",
      refundPence: Math.round(
        (totalPence * policies.freeCancellationRefundPercent) / 100,
      ),
    };
  }

  const percent = policies.lateCancellationRefundPercent;
  return {
    kind: "partial",
    percent,
    refundPence: percent === null ? null : Math.round((totalPence * percent) / 100),
  };
}

/** When online changes close for this booking, for telling the customer. */
export function onlineDeadline(jobs: readonly ManageableJob[]): Date | null {
  const next = nextPickup(jobs);
  return next
    ? new Date(next.getTime() - policies.freeCancellationHours * HOUR_MS)
    : null;
}
