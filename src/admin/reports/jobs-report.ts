import {
  JOB_SOURCE_LABELS,
  vehicleClassName,
  type JobStatus,
} from "@/domain/jobs/labels";
import { airportOf } from "@/domain/jobs/airport";
import { SERVICE_LABELS, serviceType } from "@/domain/jobs/service";
import { isFinal } from "@/domain/jobs/status";
import { londonDateAndTime } from "@/lib/time";

import { bucketOf, buckets, type Period } from "./period";
import {
  bucketLabel,
  bump,
  reasonLabel,
  shares,
  topWithOther,
  type Share,
} from "./shares";

/**
 * The Jobs Report (approved by Cityline, 2 Oct 2026): how much work the
 * office did in a period and how it went — counted by pickup date, no money
 * (that is Finance's), test bookings never counted.
 *
 * Pure: the screen and the CSV download both feed it the period's bookings,
 * so the figures on the dashboard and in the file always agree.
 */

export interface ReportJob {
  id: number;
  reference: string;
  status: JobStatus;
  source: string;
  supplierName: string | null;
  vehicleClassSlug: string;
  pickupAt: string;
  pickupAddress: string;
  dropoffAddress: string | null;
  hours: number | null;
  takenAt: string;
  dispatchedAt: string | null;
  cancelReason: string | null;
}

export type { Share };

export interface SeriesPoint {
  key: string;
  label: string;
  total: number;
  completed: number;
  noShows: number;
  cancelled: number;
}

export interface Totals {
  bookings: number;
  completed: number;
  noShows: number;
  cancelled: number;
}

export interface JobsReport {
  totals: Totals & {
    /** Not finished yet: still to happen or under way. */
    open: number;
    /** Pickup has passed but nobody moved the booking to Completed or PNS. */
    notClosed: number;
  };
  previous: Totals;
  rates: {
    /** Of bookings not cancelled. */
    completion: number | null;
    noShow: number | null;
    /** Of all bookings. */
    cancellation: number | null;
  };
  series: { unit: "day" | "week"; points: SeriesPoint[] };
  byClient: Share[];
  byService: Share[];
  byAirport: Share[];
  byVehicle: Share[];
  /** Pickups by weekday (Monday first) and hour, London time. */
  heat: number[][];
  leadTime: Share[];
  /** Bookings that got a driver less than two hours before the pickup. */
  lateDispatch: { count: number; of: number };
  /** Pickups that passed with no driver assigned in time. */
  noDriverAtPickup: number;
  /**
   * Bookings written down only after their pickup time. They say nothing
   * about lead time or dispatch, so they are counted here instead.
   */
  enteredAfterPickup: number;
  cancelReasons: Share[];
}

const HOUR_MS = 3_600_000;
const LATE_DISPATCH_HOURS = 2;

export function clientLabel(job: Pick<ReportJob, "source" | "supplierName">): string {
  if (job.supplierName) return job.supplierName;
  if (job.source === "supplier") return "Supplier (unknown)";
  return JOB_SOURCE_LABELS[job.source as keyof typeof JOB_SOURCE_LABELS] ?? job.source;
}

export function countTotals(jobs: readonly Pick<ReportJob, "status">[]): Totals {
  return {
    bookings: jobs.length,
    completed: jobs.filter((job) => job.status === "completed").length,
    noShows: jobs.filter((job) => job.status === "no_show").length,
    cancelled: jobs.filter((job) => job.status === "cancelled").length,
  };
}

const LEAD_BUCKETS = [
  "Under 24 hours",
  "1–3 days",
  "4–7 days",
  "8–30 days",
  "Over 30 days",
] as const;

function leadBucket(hours: number): (typeof LEAD_BUCKETS)[number] {
  if (hours < 24) return "Under 24 hours";
  if (hours < 24 * 4) return "1–3 days";
  if (hours < 24 * 8) return "4–7 days";
  if (hours < 24 * 31) return "8–30 days";
  return "Over 30 days";
}

export function buildJobsReport(
  jobs: readonly ReportJob[],
  previous: readonly Pick<ReportJob, "status">[],
  period: Pick<Period, "from" | "to" | "days">,
  now: Date,
): JobsReport {
  const totals = countTotals(jobs);
  const live = totals.bookings - totals.cancelled;
  const open = jobs.filter((job) => !isFinal(job.status)).length;
  const notClosed = jobs.filter(
    (job) => !isFinal(job.status) && new Date(job.pickupAt) < now,
  ).length;

  // Volume over time.
  const { unit, keys } = buckets(period);
  const points = new Map<string, SeriesPoint>(
    keys.map((key) => [
      key,
      {
        key,
        label: bucketLabel(key, unit),
        total: 0,
        completed: 0,
        noShows: 0,
        cancelled: 0,
      },
    ]),
  );

  const byClient = new Map<string, number>();
  const byService = new Map<string, number>();
  const byAirport = new Map<string, number>();
  const byVehicle = new Map<string, number>();
  const leadTime = new Map<string, number>();
  const reasons = new Map<string, number>();
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  let lateDispatch = 0;
  let dispatched = 0;
  let noDriverAtPickup = 0;
  let enteredAfterPickup = 0;

  for (const job of jobs) {
    const pickup = new Date(job.pickupAt);
    const { date, time } = londonDateAndTime(pickup);
    const point = points.get(bucketOf(date, unit));
    if (point) {
      point.total += 1;
      if (job.status === "completed") point.completed += 1;
      if (job.status === "no_show") point.noShows += 1;
      if (job.status === "cancelled") point.cancelled += 1;
    }

    bump(byClient, clientLabel(job));
    bump(byVehicle, vehicleClassName(job.vehicleClassSlug));

    if (job.status === "cancelled") {
      bump(reasons, reasonLabel(job.cancelReason));
      continue; // the rest describes work that went ahead
    }

    const service = serviceType(job);
    bump(byService, SERVICE_LABELS[service]);
    const airport =
      service === "to_airport"
        ? airportOf(job.dropoffAddress)
        : airportOf(job.pickupAddress);
    if (airport) bump(byAirport, airport.label);

    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    heat[weekday]![Number(time.slice(0, 2))]! += 1;

    const ahead = (pickup.getTime() - new Date(job.takenAt).getTime()) / HOUR_MS;
    if (ahead <= 0) {
      enteredAfterPickup += 1;
      continue;
    }
    bump(leadTime, leadBucket(ahead));

    if (job.dispatchedAt) {
      dispatched += 1;
      const before = (pickup.getTime() - new Date(job.dispatchedAt).getTime()) / HOUR_MS;
      if (before < LATE_DISPATCH_HOURS) lateDispatch += 1;
      if (before < 0) noDriverAtPickup += 1;
    } else if (pickup < now) {
      noDriverAtPickup += 1;
    }
  }

  return {
    totals: { ...totals, open, notClosed },
    previous: countTotals(previous),
    rates: {
      completion: live ? totals.completed / live : null,
      noShow: live ? totals.noShows / live : null,
      cancellation: totals.bookings ? totals.cancelled / totals.bookings : null,
    },
    series: { unit, points: [...points.values()] },
    byClient: topWithOther(shares(byClient), 7),
    byService: shares(byService),
    byAirport: topWithOther(shares(byAirport), 7),
    byVehicle: shares(byVehicle),
    heat,
    leadTime: shares(leadTime, LEAD_BUCKETS),
    lateDispatch: { count: lateDispatch, of: dispatched },
    noDriverAtPickup,
    enteredAfterPickup,
    cancelReasons: topWithOther(shares(reasons), 5),
  };
}
