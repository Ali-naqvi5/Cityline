import {
  isBlocking,
  REQUIRED_VEHICLE_DOCUMENTS,
  requiredDriverDocuments,
  requirements,
  DOCUMENT_LABELS,
  type DocumentRecord,
  type DocumentType,
} from "@/domain/compliance/documents";
import { vehicleClassName } from "@/domain/jobs/labels";

/**
 * Who may be given a job (JOB-05, CMP-10).
 *
 * Any driver may be given any car for any job (Cityline, 9 Oct 2026) — the
 * office knows the job and the car; dispatch only says what to look at.
 *
 * Blocks — the law, not preference, so the assignment is refused:
 *   - the driver is not active;
 *   - a required driver document is missing, or expired at the pickup time
 *     (an outsourced driver's PHV and driving licences; every document for a
 *     registered one — `requiredDriverDocuments`);
 *   - the car is not active, or a required car document — PHV vehicle
 *     licence, MOT, hire and reward insurance — is missing or expired at the
 *     pickup time.
 *
 * Warnings — shown before the controller confirms, never in the way:
 *   - the car is a different class from the booking;
 *   - the car has fewer passenger seats than the booking has passengers;
 *   - the car is not one the driver normally uses;
 *   - a document runs out within 30 days of the pickup;
 *   - the driver has another job within 90 minutes.
 *
 * The driver's side and the car's side are checked apart (`driverCheck`,
 * `carCheck`) and joined with how the car suits the job (`fitWarnings`), so
 * the assignment screen can pair any driver with any car without checking
 * every pair on the server.
 */

/**
 * Which vehicle classes are a like-for-like or better car for a job booked as
 * each class. Anything else is still allowed, with a warning.
 */
export const COMPATIBLE_CLASSES: Record<string, readonly string[]> = {
  saloon: ["saloon", "estate", "executive", "mpv-5", "mpv-8"],
  estate: ["estate", "mpv-5", "mpv-8"],
  executive: ["executive"],
  "mpv-5": ["mpv-5", "mpv-8"],
  "mpv-8": ["mpv-8", "minibus-16"],
  "minibus-16": ["minibus-16"],
};

export type ClassFit = "exact" | "upgrade" | "different";

export function classFit(jobClass: string, vehicleClass: string): ClassFit {
  if (jobClass === vehicleClass) return "exact";
  return (COMPATIBLE_CLASSES[jobClass] ?? []).includes(vehicleClass)
    ? "upgrade"
    : "different";
}

export interface DriverSide {
  status: string;
  /** "registered" or "outsourced"; registered when not given. */
  engagement?: string | null;
  documents: readonly DocumentRecord[];
}

export interface CarSide {
  status: string;
  vehicleClassSlug: string;
  seats?: number | null;
  documents: readonly DocumentRecord[];
}

export interface EligibilityInput {
  pickupAt: Date;
  jobClass: string;
  /** The booking's passengers, to compare with the car's seats. */
  passengers?: number | null;
  driver: DriverSide;
  vehicle: CarSide;
  /** Pickup times of the driver's other open jobs. */
  otherPickups: readonly Date[];
  /** Whether the car lists this driver as one who normally uses it. */
  linked?: boolean;
}

export interface Eligibility {
  eligible: boolean;
  blocks: string[];
  warnings: string[];
}

export const CLASH_MINUTES = 90;
const WARN_DAYS = 30;

function label(type: string): string {
  return DOCUMENT_LABELS[type as DocumentType] ?? type;
}

/** Documents in date at the pickup that run out within 30 days of it. */
function expiringSoon(
  who: string,
  required: readonly string[],
  documents: readonly DocumentRecord[],
  at: Date,
): string[] {
  const soon = new Date(at.getTime() + WARN_DAYS * 86_400_000);
  const warnings: string[] = [];
  for (const result of requirements(required, documents, at)) {
    if (isBlocking(result.status)) continue;
    const expires = result.document?.expiresAt
      ? new Date(result.document.expiresAt)
      : null;
    if (expires && expires <= soon) {
      warnings.push(
        `${who}'s ${label(result.type)} expires within ${WARN_DAYS} days of the pickup.`,
      );
    }
  }
  return warnings;
}

function result(blocks: string[], warnings: string[]): Eligibility {
  return { eligible: blocks.length === 0, blocks, warnings };
}

/** The driver's side: status, documents at the pickup, and other jobs near it. */
export function driverCheck(
  driver: DriverSide,
  at: Date,
  otherPickups: readonly Date[] = [],
): Eligibility {
  const blocks: string[] = [];
  const warnings: string[] = [];
  if (driver.status !== "active") {
    blocks.push(`The driver is ${driver.status}, not active.`);
  }
  const required = requiredDriverDocuments(driver.engagement);
  for (const item of requirements(required, driver.documents, at)) {
    if (item.status === "missing")
      blocks.push(`Driver has no ${label(item.type)} on record.`);
    else if (item.status === "expired")
      blocks.push(`Driver's ${label(item.type)} has expired by the pickup.`);
  }
  warnings.push(...expiringSoon("Driver", required, driver.documents, at));
  const clash = otherPickups.find(
    (other) => Math.abs(other.getTime() - at.getTime()) < CLASH_MINUTES * 60_000,
  );
  if (clash) {
    const minutes = Math.round(Math.abs(clash.getTime() - at.getTime()) / 60_000);
    warnings.push(
      `The driver has another job ${minutes} minutes ${clash < at ? "before" : "after"} this one.`,
    );
  }
  return result(blocks, warnings);
}

/** The car's side: status and documents at the pickup. */
export function carCheck(car: CarSide, at: Date): Eligibility {
  const blocks: string[] = [];
  if (car.status !== "active") {
    blocks.push(`The car is ${car.status.replace("_", " ")}, not active.`);
  }
  for (const item of requirements(REQUIRED_VEHICLE_DOCUMENTS, car.documents, at)) {
    if (item.status === "missing")
      blocks.push(`Car has no ${label(item.type)} on record.`);
    else if (item.status === "expired")
      blocks.push(`Car's ${label(item.type)} has expired by the pickup.`);
  }
  return result(
    blocks,
    expiringSoon("Car", REQUIRED_VEHICLE_DOCUMENTS, car.documents, at),
  );
}

/** How a car suits a job and its driver: warnings only, never a block. */
export function fitWarnings(
  job: { jobClass: string; passengers?: number | null },
  car: Pick<CarSide, "vehicleClassSlug" | "seats">,
  linked?: boolean,
): string[] {
  const warnings: string[] = [];
  const fit = classFit(job.jobClass, car.vehicleClassSlug);
  if (fit === "upgrade") {
    warnings.push(
      `A bigger car than booked (${vehicleClassName(car.vehicleClassSlug)} for ${vehicleClassName(job.jobClass)}) — an upgrade for the customer.`,
    );
  } else if (fit === "different") {
    warnings.push(
      `Booked as ${vehicleClassName(job.jobClass)}; this car is ${vehicleClassName(car.vehicleClassSlug)}.`,
    );
  }
  if (car.seats && job.passengers && job.passengers > car.seats) {
    warnings.push(`${car.seats} passenger seats for ${job.passengers} passengers.`);
  }
  if (linked === false) {
    warnings.push("This car is not one the driver normally uses.");
  }
  return warnings;
}

/** A driver and car for one job, checked together. */
export function checkEligibility(input: EligibilityInput): Eligibility {
  const driver = driverCheck(input.driver, input.pickupAt, input.otherPickups);
  const car = carCheck(input.vehicle, input.pickupAt);
  return result(
    [...driver.blocks, ...car.blocks],
    [
      ...fitWarnings(
        { jobClass: input.jobClass, passengers: input.passengers },
        input.vehicle,
        input.linked,
      ),
      ...driver.warnings,
      ...car.warnings,
    ],
  );
}
