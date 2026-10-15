import { CLASH_MINUTES } from "@/domain/dispatch/eligibility";
import type { JobStatus } from "@/domain/jobs/labels";
import { isFinal } from "@/domain/jobs/status";
import { formatTime } from "@/lib/time";

/**
 * The Daily Run Sheet (approved by Cityline, 6 Oct 2026): one London day's
 * bookings in pickup order, the same day per driver with the time between
 * their pickups, and what needs the controller first — no driver, a driver
 * who has not confirmed, a document that will not be valid at the pickup,
 * pickups too close together for one driver.
 *
 * Pure: the screen, the print and the CSV are all built from it.
 */

/** A pickup this close with no confirmed driver is urgent, not just pending. */
export const SOON_MINUTES = 120;

export interface RunSheetJob {
  id: number;
  reference: string;
  status: JobStatus;
  pickupAt: string;
  client: string;
  supplierReference: string | null;
  /** The name on the board, or the lead passenger's. */
  passenger: string;
  leadName: string;
  leadPhone: string;
  flightNumber: string | null;
  pickupAddress: string;
  viaStops: string[];
  dropoffAddress: string | null;
  hours: number | null;
  passengers: number;
  largeBags: number;
  smallBags: number;
  vehicleClassSlug: string;
  extras: { name: string; quantity: number }[];
  meetAndGreet: boolean;
  driverNotes: string | null;
  driverId: number | null;
  /** Or the subcontracting operator it went to, by name (Cityline, 15 Oct 2026). */
  operatorName: string | null;
  vehicleReg: string | null;
  /** What will not be valid at the pickup: a document, or the driver or car. */
  problems: string[];
}

export interface RunSheetDriver {
  id: number;
  name: string;
  firstName: string;
  phone: string;
  whatsappConsent: boolean;
}

export interface DriverDay {
  driver: RunSheetDriver;
  jobs: RunSheetJob[];
  /** Minutes from each pickup to the driver's next one; null after the last. */
  gaps: (number | null)[];
  vehicles: string[];
}

export interface RunSheetWarning {
  tone: "danger" | "warn";
  jobId: number;
  reference: string;
  pickupAt: string;
  text: string;
}

export interface RunSheet {
  jobs: RunSheetJob[];
  days: DriverDay[];
  unassigned: RunSheetJob[];
  warnings: RunSheetWarning[];
}

const MINUTE_MS = 60_000;

/** "45 min", "1 h", "2 h 05 min". */
export function durationText(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole} min`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")} min` : `${hours} h`;
}

function untilText(pickupAt: Date, now: Date): string {
  const minutes = (pickupAt.getTime() - now.getTime()) / MINUTE_MS;
  return minutes >= 0
    ? `pickup in ${durationText(minutes)}`
    : `pickup was at ${formatTime(pickupAt)}`;
}

export function buildRunSheet(
  jobs: readonly RunSheetJob[],
  drivers: readonly RunSheetDriver[],
  now: Date,
): RunSheet {
  const ordered = [...jobs].sort(
    (a, b) =>
      a.pickupAt.localeCompare(b.pickupAt) || a.reference.localeCompare(b.reference),
  );
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const warnings: RunSheetWarning[] = [];
  const warn = (job: RunSheetJob, tone: RunSheetWarning["tone"], text: string) =>
    warnings.push({
      tone,
      jobId: job.id,
      reference: job.reference,
      pickupAt: job.pickupAt,
      text,
    });

  for (const job of ordered) {
    if (isFinal(job.status)) continue;
    const at = new Date(job.pickupAt);
    const soon = at.getTime() - now.getTime() <= SOON_MINUTES * MINUTE_MS;
    const name = job.driverId
      ? (driverById.get(job.driverId)?.name ?? "The driver")
      : (job.operatorName ?? "");
    if (job.status === "unassigned") {
      warn(job, soon ? "danger" : "warn", `No driver yet — ${untilText(at, now)}`);
    } else if (job.status === "assigned") {
      warn(
        job,
        soon ? "danger" : "warn",
        `${name} has not confirmed — ${untilText(at, now)}`,
      );
    }
    if (job.driverId && job.problems.length) {
      warn(job, "danger", `${name}: ${job.problems.join("; ")}`);
    }
  }

  const days: DriverDay[] = [];
  const byDriver = new Map<number, RunSheetJob[]>();
  for (const job of ordered) {
    if (job.driverId === null) continue;
    byDriver.set(job.driverId, [...(byDriver.get(job.driverId) ?? []), job]);
  }
  for (const [driverId, own] of byDriver) {
    const driver = driverById.get(driverId) ?? {
      id: driverId,
      name: `Driver ${driverId}`,
      firstName: "Driver",
      phone: "",
      whatsappConsent: false,
    };
    const gaps = own.map((job, index) => {
      const next = own[index + 1];
      if (!next) return null;
      return Math.round(
        (new Date(next.pickupAt).getTime() - new Date(job.pickupAt).getTime()) /
          MINUTE_MS,
      );
    });
    own.forEach((job, index) => {
      const gap = gaps[index];
      const next = own[index + 1];
      if (
        gap !== null &&
        gap !== undefined &&
        next &&
        gap < CLASH_MINUTES &&
        !isFinal(next.status)
      ) {
        warn(
          next,
          "warn",
          `${driver.name} has ${durationText(gap)} between ${job.reference} and ${next.reference}`,
        );
      }
    });
    days.push({
      driver,
      jobs: own,
      gaps,
      vehicles: [
        ...new Set(
          own.map((job) => job.vehicleReg).filter((reg): reg is string => Boolean(reg)),
        ),
      ],
    });
  }
  days.sort(
    (a, b) =>
      a.jobs[0]!.pickupAt.localeCompare(b.jobs[0]!.pickupAt) ||
      a.driver.name.localeCompare(b.driver.name),
  );

  warnings.sort(
    (a, b) =>
      (a.tone === b.tone ? 0 : a.tone === "danger" ? -1 : 1) ||
      a.pickupAt.localeCompare(b.pickupAt),
  );

  return {
    jobs: ordered,
    days,
    unassigned: ordered.filter((job) => job.driverId === null && !job.operatorName),
    warnings,
  };
}
