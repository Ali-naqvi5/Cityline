import type { JobStatus } from "@/domain/jobs/labels";
import { londonDateAndTime } from "@/lib/time";

import { bucketOf, buckets, type Period } from "./period";
import {
  bucketLabel,
  bump,
  median,
  reasonLabel,
  shares,
  topWithOther,
  type Share,
} from "./shares";

/**
 * The Driver Report (approved by Cityline, 5 Oct 2026): who did the work in a
 * period and how reliably — counted by pickup date, no money (pay is
 * Finance's), test bookings never counted.
 *
 * On time means the driver was marked at the pickup (DAP) no later than 15
 * minutes after the booked pickup time. A driver taken off a booking is
 * counted with the reason the office wrote for it.
 *
 * Pure: the screen and the CSV downloads both feed it the same rows.
 */

export const ON_TIME_GRACE_MINUTES = 15;

export interface DriverJob {
  id: number;
  status: JobStatus;
  /** The driver on the booking now. */
  driverId: number | null;
  pickupAt: string;
  dispatchedAt: string | null;
  driverConfirmedAt: string | null;
  atPickupAt: string | null;
}

export interface TakenOffEvent {
  jobId: number;
  reference: string;
  pickupAt: string;
  driverId: number;
  /** When the driver was taken off. */
  at: string;
  reason: string | null;
  by: string;
}

export interface DriverInfo {
  id: number;
  name: string;
  status: string;
}

export interface DriverTotals {
  /** Drivers with at least one booking driven (completed or PNS). */
  driversWorked: number;
  driven: number;
  perDriver: number | null;
  /** Arrivals at pickup with a DAP time, and how many were on time. */
  arrivals: number;
  onTime: number;
  onTimeShare: number | null;
  medianConfirmMinutes: number | null;
  takenOff: number;
}

export interface DriverRow {
  driverId: number;
  name: string;
  status: string;
  /** Bookings in the period with this driver now, not cancelled. */
  bookings: number;
  driven: number;
  completed: number;
  noShows: number;
  takenOff: number;
  arrivals: number;
  onTime: number;
  medianConfirmMinutes: number | null;
  daysWorked: number;
  /** The pickup time of their last job done (completed or PNS) in the period. */
  lastJobAt: string | null;
}

export interface DayGridData {
  unit: "day" | "week";
  columns: { key: string; label: string }[];
  rows: { driverId: number; name: string; cells: number[]; total: number }[];
}

export interface DriversReport {
  totals: DriverTotals;
  previous: DriverTotals;
  byDriver: Share[];
  punctuality: Share[];
  /** Bookings driven with no DAP time: left out of punctuality. */
  arrivalNotRecorded: number;
  confirmTime: Share[];
  /** Assigned, not yet confirmed by the driver. */
  awaitingConfirmation: number;
  grid: DayGridData;
  drivers: DriverRow[];
  takenOff: (TakenOffEvent & { driverName: string })[];
  takenOffReasons: Share[];
}

const MINUTE_MS = 60_000;

/** The statuses that count as a job done: completed, or PNS. */
export const DONE_STATUSES = [
  "completed",
  "no_show",
] as const satisfies readonly JobStatus[];

const isDriven = (status: JobStatus) =>
  (DONE_STATUSES as readonly JobStatus[]).includes(status);

/** Minutes after the booked pickup time the driver was marked at the pickup. */
export function minutesLate(
  job: Pick<DriverJob, "pickupAt" | "atPickupAt">,
): number | null {
  if (!job.atPickupAt) return null;
  return Math.round(
    (new Date(job.atPickupAt).getTime() - new Date(job.pickupAt).getTime()) / MINUTE_MS,
  );
}

export function isOnTime(minutes: number): boolean {
  return minutes <= ON_TIME_GRACE_MINUTES;
}

/** Minutes from assigning the driver to the driver confirming. */
export function minutesToConfirm(
  job: Pick<DriverJob, "dispatchedAt" | "driverConfirmedAt">,
): number | null {
  if (!job.dispatchedAt || !job.driverConfirmedAt) return null;
  return Math.max(
    0,
    Math.round(
      (new Date(job.driverConfirmedAt).getTime() - new Date(job.dispatchedAt).getTime()) /
        MINUTE_MS,
    ),
  );
}

const PUNCTUALITY = [
  `On time (up to ${ON_TIME_GRACE_MINUTES} min after)`,
  "16–30 min late",
  "Over 30 min late",
] as const;

function punctualityBucket(minutes: number): (typeof PUNCTUALITY)[number] {
  if (isOnTime(minutes)) return PUNCTUALITY[0];
  if (minutes <= 30) return PUNCTUALITY[1];
  return PUNCTUALITY[2];
}

const CONFIRM = ["Under 15 min", "15–60 min", "1–6 hours", "Over 6 hours"] as const;

function confirmBucket(minutes: number): (typeof CONFIRM)[number] {
  if (minutes < 15) return CONFIRM[0];
  if (minutes < 60) return CONFIRM[1];
  if (minutes < 360) return CONFIRM[2];
  return CONFIRM[3];
}

export function countDriverTotals(
  jobs: readonly DriverJob[],
  takenOff: number,
): DriverTotals {
  const driven = jobs.filter((job) => job.driverId !== null && isDriven(job.status));
  const driversWorked = new Set(driven.map((job) => job.driverId)).size;
  const lateness = jobs
    .filter((job) => job.driverId !== null)
    .map(minutesLate)
    .filter((value): value is number => value !== null);
  const onTime = lateness.filter(isOnTime).length;
  const confirms = jobs
    .filter((job) => job.driverId !== null)
    .map(minutesToConfirm)
    .filter((value): value is number => value !== null);
  return {
    driversWorked,
    driven: driven.length,
    perDriver: driversWorked ? driven.length / driversWorked : null,
    arrivals: lateness.length,
    onTime,
    onTimeShare: lateness.length ? onTime / lateness.length : null,
    medianConfirmMinutes: median(confirms),
    takenOff,
  };
}

export function buildDriversReport({
  jobs,
  previousJobs,
  takenOff,
  previousTakenOff,
  drivers,
  period,
}: {
  jobs: readonly DriverJob[];
  previousJobs: readonly DriverJob[];
  takenOff: readonly TakenOffEvent[];
  previousTakenOff: number;
  drivers: readonly DriverInfo[];
  period: Pick<Period, "from" | "to" | "days">;
}): DriversReport {
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const nameOf = (id: number) => driverById.get(id)?.name ?? `Driver ${id}`;
  const withDriver = jobs.filter(
    (job): job is DriverJob & { driverId: number } => job.driverId !== null,
  );

  // Per driver.
  const rows = new Map<number, DriverRow & { confirms: number[]; days: Set<string> }>();
  const row = (driverId: number) => {
    let entry = rows.get(driverId);
    if (!entry) {
      entry = {
        driverId,
        name: nameOf(driverId),
        status: driverById.get(driverId)?.status ?? "active",
        bookings: 0,
        driven: 0,
        completed: 0,
        noShows: 0,
        takenOff: 0,
        arrivals: 0,
        onTime: 0,
        medianConfirmMinutes: null,
        daysWorked: 0,
        lastJobAt: null,
        confirms: [],
        days: new Set(),
      };
      rows.set(driverId, entry);
    }
    return entry;
  };

  const punctuality = new Map<string, number>();
  const confirmTime = new Map<string, number>();
  const byDriver = new Map<string, number>();
  let arrivalNotRecorded = 0;
  let awaitingConfirmation = 0;

  const { unit, keys } = buckets(period);
  const column = new Map(keys.map((key, index) => [key, index]));
  const cells = new Map<number, number[]>();

  // Every driver still working is listed, with or without jobs in the period.
  for (const driver of drivers) {
    if (driver.status !== "left") row(driver.id);
  }

  for (const job of withDriver) {
    const entry = row(job.driverId);
    const late = minutesLate(job);
    if (late !== null) {
      entry.arrivals += 1;
      if (isOnTime(late)) entry.onTime += 1;
      bump(punctuality, punctualityBucket(late));
    }
    const confirm = minutesToConfirm(job);
    if (confirm !== null) {
      entry.confirms.push(confirm);
      bump(confirmTime, confirmBucket(confirm));
    } else if (job.status === "assigned") {
      awaitingConfirmation += 1;
    }

    if (job.status === "cancelled") continue;
    entry.bookings += 1;
    const day = londonDateAndTime(new Date(job.pickupAt)).date;
    const index = column.get(bucketOf(day, unit));
    if (index !== undefined) {
      const counts = cells.get(job.driverId) ?? Array<number>(keys.length).fill(0);
      counts[index]! += 1;
      cells.set(job.driverId, counts);
    }
    if (!isDriven(job.status)) continue;
    entry.driven += 1;
    if (!entry.lastJobAt || job.pickupAt > entry.lastJobAt)
      entry.lastJobAt = job.pickupAt;
    if (job.status === "completed") entry.completed += 1;
    else entry.noShows += 1;
    entry.days.add(day);
    bump(byDriver, entry.name);
    if (late === null) arrivalNotRecorded += 1;
  }

  const reasons = new Map<string, number>();
  for (const event of takenOff) {
    row(event.driverId).takenOff += 1;
    bump(reasons, reasonLabel(event.reason));
  }

  const driverRows: DriverRow[] = [...rows.values()]
    .map(({ confirms, days, ...entry }) => ({
      ...entry,
      medianConfirmMinutes: median(confirms),
      daysWorked: days.size,
    }))
    .sort(
      (a, b) =>
        b.driven - a.driven || b.bookings - a.bookings || a.name.localeCompare(b.name),
    );

  return {
    totals: countDriverTotals(jobs, takenOff.length),
    previous: countDriverTotals(previousJobs, previousTakenOff),
    byDriver: topWithOther(shares(byDriver), 10),
    punctuality: shares(punctuality, PUNCTUALITY),
    arrivalNotRecorded,
    confirmTime: shares(confirmTime, CONFIRM),
    awaitingConfirmation,
    grid: {
      unit,
      columns: keys.map((key) => ({ key, label: bucketLabel(key, unit) })),
      rows: [...cells.entries()]
        .map(([driverId, counts]) => ({
          driverId,
          name: nameOf(driverId),
          cells: counts,
          total: counts.reduce((sum, count) => sum + count, 0),
        }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    },
    drivers: driverRows,
    takenOff: [...takenOff]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((event) => ({ ...event, driverName: nameOf(event.driverId) })),
    takenOffReasons: topWithOther(shares(reasons), 5),
  };
}

/** A job a driver did, on their page in the Driver Report. */
export interface DriverJobLine {
  status: JobStatus;
  pickupAt: string;
  /** What the job was offered to them for; null when not written. */
  driverPricePence: number | null;
}

/**
 * One driver's jobs done in the period (Cityline, 9 Oct 2026): how many, the
 * last, and what they were offered for them in all. Whether the driver has
 * been paid is Finance's, never shown here.
 */
export function driverJobTotals(jobs: readonly DriverJobLine[]) {
  let offeredPence = 0;
  let unpriced = 0;
  let lastJobAt: string | null = null;
  for (const job of jobs) {
    if (job.driverPricePence === null) unpriced += 1;
    else offeredPence += job.driverPricePence;
    if (!lastJobAt || job.pickupAt > lastJobAt) lastJobAt = job.pickupAt;
  }
  return {
    jobs: jobs.length,
    completed: jobs.filter((job) => job.status === "completed").length,
    noShows: jobs.filter((job) => job.status === "no_show").length,
    offeredPence,
    unpriced,
    lastJobAt,
  };
}
