import { isFinal } from "@/domain/jobs/status";
import type { JobStatus } from "@/domain/jobs/labels";

/**
 * A customer's history in figures (Customers section): how many bookings,
 * how many happened, what is coming, what they are worth. Pure, so it is
 * tested; the screens feed it the customer's jobs.
 */

export interface SummaryJob {
  status: JobStatus;
  pickupAt: string;
  customerPricePence: number;
}

export interface CustomerSummary {
  bookings: number;
  completed: number;
  upcoming: number;
  noShows: number;
  cancelled: number;
  /** The price of every booking not cancelled, in pence. */
  valuePence: number;
  lastTrip: Date | null;
  nextTrip: Date | null;
}

export function summarise(jobs: readonly SummaryJob[], now: Date): CustomerSummary {
  const summary: CustomerSummary = {
    bookings: jobs.length,
    completed: 0,
    upcoming: 0,
    noShows: 0,
    cancelled: 0,
    valuePence: 0,
    lastTrip: null,
    nextTrip: null,
  };
  for (const job of jobs) {
    const at = new Date(job.pickupAt);
    if (job.status === "cancelled") {
      summary.cancelled += 1;
      continue;
    }
    summary.valuePence += job.customerPricePence;
    if (job.status === "completed") summary.completed += 1;
    if (job.status === "no_show") summary.noShows += 1;
    if (!isFinal(job.status) && at >= now) {
      summary.upcoming += 1;
      if (!summary.nextTrip || at < summary.nextTrip) summary.nextTrip = at;
    }
    if (job.status === "completed" && (!summary.lastTrip || at > summary.lastTrip)) {
      summary.lastTrip = at;
    }
  }
  return summary;
}
