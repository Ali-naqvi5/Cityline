import type { Payload, PayloadRequest } from "payload";

import { currentDocument } from "@/domain/compliance/documents";
import { OPEN_STATUSES } from "@/domain/jobs/labels";
import type { Driver, Vehicle } from "@/payload-types";

import { CLASH_MINUTES, checkEligibility, type Eligibility } from "./eligibility";

/**
 * Everything the assignment rules need about one driver and vehicle for one
 * job, read from the database (JOB-05, spec §19).
 *
 * The jobs collection's hook calls this on every write that gives a job a
 * driver, whichever screen or API call made it; the assignment screen shows
 * the same answer before the controller confirms. Read with access
 * overridden: whoever is asking has already been allowed to dispatch.
 */

export interface AssignmentCheck {
  driver: Driver;
  vehicle: Vehicle;
  eligibility: Eligibility;
  /** The driver's PHV licence number, copied onto the job (CMP-03). */
  phvNumber: string | null;
}

export type AssignmentLookup = AssignmentCheck | { missing: "driver" | "vehicle" };

export const relId = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return (value as { id: number }).id ?? null;
  const id = Number(value);
  return Number.isInteger(id) ? id : null;
};

export async function checkAssignment(
  payload: Payload,
  args: {
    driverId: number;
    vehicleId: number;
    pickupAt: Date;
    jobClass: string;
    /** The job itself, so it is not counted as its own clash. */
    jobId?: number | null;
  },
  req?: PayloadRequest,
): Promise<AssignmentLookup> {
  const read = { overrideAccess: true, depth: 0, req } as const;

  const driver = await payload.findByID({
    collection: "drivers",
    id: args.driverId,
    disableErrors: true,
    ...read,
  });
  if (!driver) return { missing: "driver" };
  const vehicle = await payload.findByID({
    collection: "vehicles",
    id: args.vehicleId,
    disableErrors: true,
    ...read,
  });
  if (!vehicle) return { missing: "vehicle" };

  const driverDocuments = await payload.find({
    collection: "driver-documents",
    where: { driver: { equals: driver.id } },
    pagination: false,
    ...read,
  });
  const vehicleDocuments = await payload.find({
    collection: "vehicle-documents",
    where: { vehicle: { equals: vehicle.id } },
    pagination: false,
    ...read,
  });

  const window = CLASH_MINUTES * 60_000;
  const others = await payload.find({
    collection: "jobs",
    where: {
      and: [
        { driver: { equals: driver.id } },
        { status: { in: [...OPEN_STATUSES] } },
        {
          pickupAt: {
            greater_than: new Date(args.pickupAt.getTime() - window).toISOString(),
          },
        },
        {
          pickupAt: {
            less_than: new Date(args.pickupAt.getTime() + window).toISOString(),
          },
        },
        ...(args.jobId ? [{ id: { not_equals: args.jobId } }] : []),
      ],
    },
    pagination: false,
    ...read,
  });

  const eligibility = checkEligibility({
    pickupAt: args.pickupAt,
    jobClass: args.jobClass,
    driver: { status: driver.status, documents: driverDocuments.docs },
    vehicle: {
      status: vehicle.status,
      vehicleClassSlug: vehicle.vehicleClassSlug,
      documents: vehicleDocuments.docs,
    },
    otherPickups: others.docs.map((job) => new Date(job.pickupAt)),
    linked: (vehicle.drivers ?? []).some((linked) => relId(linked) === driver.id),
  });

  return {
    driver,
    vehicle,
    eligibility,
    phvNumber: currentDocument(driverDocuments.docs, "phv_licence")?.number ?? null,
  };
}
