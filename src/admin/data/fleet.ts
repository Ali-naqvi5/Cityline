import "server-only";

import type { Payload, Where } from "payload";

import {
  REQUIRED_DRIVER_DOCUMENTS,
  REQUIRED_VEHICLE_DOCUMENTS,
  requirements,
  worstStatus,
  type DocumentStatus,
  type RequirementResult,
} from "@/domain/compliance/documents";
import { OPEN_STATUSES } from "@/domain/jobs/labels";
import type {
  Driver,
  DriverDocument,
  Job,
  User,
  Vehicle,
  VehicleDocument,
} from "@/payload-types";

/**
 * Drivers and vehicles with their documents and compliance, read as the
 * member of staff (access rules apply). The fleet is tens of records, not
 * thousands, so compliance is worked out here rather than in SQL.
 */

type As = { user: User; overrideAccess: false };

export interface DriverRecord {
  driver: Driver;
  documents: DriverDocument[];
  required: RequirementResult<DriverDocument>[];
  worst: DocumentStatus;
  nextJob: Job | null;
}

export interface VehicleRecord {
  vehicle: Vehicle;
  documents: VehicleDocument[];
  required: RequirementResult<VehicleDocument>[];
  worst: DocumentStatus;
}

function byId<T extends { id: number }>(
  items: T[],
  key: (item: T) => number | null,
): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const id = key(item);
    if (id === null) continue;
    map.set(id, [...(map.get(id) ?? []), item]);
  }
  return map;
}

const relId = (value: number | { id: number } | null | undefined): number | null =>
  value === null || value === undefined
    ? null
    : typeof value === "object"
      ? value.id
      : value;

export async function loadDrivers(
  payload: Payload,
  user: User,
  now: Date,
  where?: Where,
): Promise<DriverRecord[]> {
  const as: As = { user, overrideAccess: false };
  const drivers = await payload.find({
    collection: "drivers",
    where,
    sort: "fullName",
    pagination: false,
    depth: 0,
    ...as,
  });
  const ids = drivers.docs.map((driver) => driver.id);
  if (ids.length === 0) return [];

  const [documents, jobs] = await Promise.all([
    payload.find({
      collection: "driver-documents",
      where: { driver: { in: ids } },
      sort: "-createdAt",
      pagination: false,
      depth: 1,
      ...as,
    }),
    payload.find({
      collection: "jobs",
      where: {
        and: [
          { driver: { in: ids } },
          { status: { in: [...OPEN_STATUSES] } },
          { pickupAt: { greater_than_equal: now.toISOString() } },
        ],
      },
      sort: "pickupAt",
      pagination: false,
      depth: 0,
      ...as,
    }),
  ]);

  const documentsByDriver = byId(documents.docs, (doc) => relId(doc.driver));
  const jobsByDriver = byId(jobs.docs, (job) => relId(job.driver));

  return drivers.docs.map((driver) => {
    const own = documentsByDriver.get(driver.id) ?? [];
    const required = requirements(REQUIRED_DRIVER_DOCUMENTS, own, now);
    return {
      driver,
      documents: own,
      required,
      worst: worstStatus(required.map((item) => item.status)),
      nextJob: jobsByDriver.get(driver.id)?.[0] ?? null,
    };
  });
}

export async function loadVehicles(
  payload: Payload,
  user: User,
  now: Date,
  where?: Where,
): Promise<VehicleRecord[]> {
  const as: As = { user, overrideAccess: false };
  const vehicles = await payload.find({
    collection: "vehicles",
    where,
    sort: "registration",
    pagination: false,
    depth: 1,
    ...as,
  });
  const ids = vehicles.docs.map((vehicle) => vehicle.id);
  if (ids.length === 0) return [];

  const documents = await payload.find({
    collection: "vehicle-documents",
    where: { vehicle: { in: ids } },
    sort: "-createdAt",
    pagination: false,
    depth: 1,
    ...as,
  });
  const documentsByVehicle = byId(documents.docs, (doc) => relId(doc.vehicle));

  return vehicles.docs.map((vehicle) => {
    const own = documentsByVehicle.get(vehicle.id) ?? [];
    const required = requirements(REQUIRED_VEHICLE_DOCUMENTS, own, now);
    return {
      vehicle,
      documents: own,
      required,
      worst: worstStatus(required.map((item) => item.status)),
    };
  });
}

// --- Compliance across the fleet ---------------------------------------------------

export interface ComplianceItem {
  kind: "driver" | "vehicle";
  ownerId: number;
  ownerName: string;
  type: string;
  status: DocumentStatus;
  expiresAt: string | null;
}

const SEVERITY: Record<DocumentStatus, number> = {
  missing: 0,
  expired: 1,
  expiring_7: 2,
  expiring_14: 3,
  expiring_30: 4,
  valid: 5,
};

/**
 * Every required document of every working driver and vehicle, with its
 * status now — what the compliance screen and the dashboard alerts show.
 * Drivers who have left and vehicles sold are not counted.
 */
export async function loadComplianceItems(
  payload: Payload,
  user: User,
  now: Date,
): Promise<{ drivers: ComplianceItem[]; vehicles: ComplianceItem[] }> {
  const [drivers, vehicles] = await Promise.all([
    loadDrivers(payload, user, now, { status: { not_equals: "left" } }),
    loadVehicles(payload, user, now, { status: { not_equals: "sold" } }),
  ]);

  const sort = (a: ComplianceItem, b: ComplianceItem) =>
    SEVERITY[a.status] - SEVERITY[b.status] ||
    (a.expiresAt ?? "").localeCompare(b.expiresAt ?? "") ||
    a.ownerName.localeCompare(b.ownerName);

  return {
    drivers: drivers
      .flatMap(({ driver, required }) =>
        required.map((item) => ({
          kind: "driver" as const,
          ownerId: driver.id,
          ownerName: driver.fullName ?? `Driver ${driver.id}`,
          type: item.type,
          status: item.status,
          expiresAt: item.document?.expiresAt ?? null,
        })),
      )
      .sort(sort),
    vehicles: vehicles
      .flatMap(({ vehicle, required }) =>
        required.map((item) => ({
          kind: "vehicle" as const,
          ownerId: vehicle.id,
          ownerName: vehicle.registration,
          type: item.type,
          status: item.status,
          expiresAt: item.document?.expiresAt ?? null,
        })),
      )
      .sort(sort),
  };
}
