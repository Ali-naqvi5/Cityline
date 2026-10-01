import {
  isBlocking,
  REQUIRED_DRIVER_DOCUMENTS,
  REQUIRED_VEHICLE_DOCUMENTS,
  requirements,
  DOCUMENT_LABELS,
  type DocumentRecord,
  type DocumentType,
} from "@/domain/compliance/documents";

/**
 * Who may be given a job (JOB-05, CMP-10).
 *
 * Blocks — the assignment is refused:
 *   - the driver is not active;
 *   - a required driver document is missing, or expired at the pickup time;
 *   - the vehicle is not active, or a required vehicle document is missing or
 *     expired at the pickup time;
 *   - the vehicle's class cannot do the job's class.
 *
 * Warnings — the controller is told, and may go ahead:
 *   - a document runs out within 30 days of the pickup;
 *   - the vehicle is a different class that can still do the job (an upgrade);
 *   - the vehicle is not one the driver normally uses;
 *   - the driver has another job within 90 minutes.
 */

/**
 * Which vehicle classes may do a job booked as each class. The booked class
 * itself always; a bigger vehicle may do a smaller job (the customer gets
 * more room). Executive is a promise about the car, so only an executive car
 * does an executive job.
 */
export const COMPATIBLE_CLASSES: Record<string, readonly string[]> = {
  saloon: ["saloon", "estate", "executive", "mpv-5", "mpv-8"],
  estate: ["estate", "mpv-5", "mpv-8"],
  executive: ["executive"],
  "mpv-5": ["mpv-5", "mpv-8"],
  "mpv-8": ["mpv-8", "minibus-16"],
  "minibus-16": ["minibus-16"],
};

export type ClassFit = "exact" | "upgrade" | "incompatible";

export function classFit(jobClass: string, vehicleClass: string): ClassFit {
  if (jobClass === vehicleClass) return "exact";
  return (COMPATIBLE_CLASSES[jobClass] ?? []).includes(vehicleClass)
    ? "upgrade"
    : "incompatible";
}

export interface EligibilityInput {
  pickupAt: Date;
  jobClass: string;
  driver: { status: string; documents: readonly DocumentRecord[] };
  vehicle: {
    status: string;
    vehicleClassSlug: string;
    documents: readonly DocumentRecord[];
  };
  /** Pickup times of the driver's other open jobs. */
  otherPickups: readonly Date[];
  /** Whether the vehicle lists this driver as one who normally uses it. */
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

export function checkEligibility(input: EligibilityInput): Eligibility {
  const blocks: string[] = [];
  const warnings: string[] = [];
  const at = input.pickupAt;

  if (input.driver.status !== "active") {
    blocks.push(`The driver is ${input.driver.status}, not active.`);
  }
  for (const result of requirements(
    REQUIRED_DRIVER_DOCUMENTS,
    input.driver.documents,
    at,
  )) {
    if (result.status === "missing")
      blocks.push(`Driver has no ${label(result.type)} on record.`);
    else if (result.status === "expired")
      blocks.push(`Driver's ${label(result.type)} has expired by the pickup.`);
  }

  if (input.vehicle.status !== "active") {
    blocks.push(`The vehicle is ${input.vehicle.status.replace("_", " ")}, not active.`);
  }
  for (const result of requirements(
    REQUIRED_VEHICLE_DOCUMENTS,
    input.vehicle.documents,
    at,
  )) {
    if (result.status === "missing")
      blocks.push(`Vehicle has no ${label(result.type)} on record.`);
    else if (result.status === "expired")
      blocks.push(`Vehicle's ${label(result.type)} has expired by the pickup.`);
  }

  const fit = classFit(input.jobClass, input.vehicle.vehicleClassSlug);
  if (fit === "incompatible") {
    blocks.push("This vehicle's class cannot do this job.");
  } else if (fit === "upgrade") {
    warnings.push(
      "Different vehicle class from the booking — an upgrade for the customer.",
    );
  }

  if (input.linked === false) {
    warnings.push("This vehicle is not one the driver normally uses.");
  }

  // Documents that are fine at the pickup but run out soon after it.
  const soon = new Date(at.getTime() + WARN_DAYS * 86_400_000);
  for (const [who, required, documents] of [
    ["Driver", REQUIRED_DRIVER_DOCUMENTS, input.driver.documents],
    ["Vehicle", REQUIRED_VEHICLE_DOCUMENTS, input.vehicle.documents],
  ] as const) {
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
  }

  const clash = input.otherPickups.find(
    (other) => Math.abs(other.getTime() - at.getTime()) < CLASH_MINUTES * 60_000,
  );
  if (clash) {
    const minutes = Math.round(Math.abs(clash.getTime() - at.getTime()) / 60_000);
    warnings.push(
      `The driver has another job ${minutes} minutes ${clash < at ? "before" : "after"} this one.`,
    );
  }

  return { eligible: blocks.length === 0, blocks, warnings };
}
