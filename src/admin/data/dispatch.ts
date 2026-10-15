import "server-only";

import type { Payload } from "payload";

import { carCheck, CLASH_MINUTES, driverCheck } from "@/domain/dispatch/eligibility";
import { relId } from "@/domain/dispatch/assignment";
import { OPEN_STATUSES } from "@/domain/jobs/labels";
import { licensedFromText, operatorCheck } from "@/domain/operators/operators";
import type { Job, Operator, User } from "@/payload-types";

import { loadDrivers, loadVehicles, ownerEngagement } from "./fleet";

/**
 * Everyone who could take a job, each with their own car (spec §19;
 * Cityline, 9 Oct 2026: drivers are self-employed and bring their own car —
 * Cityline owns none, and no two drivers share one). Each driver and their
 * car are checked against the pickup time — documents, status, other jobs —
 * and the screen adds how the car suits the job. The jobs collection's hook
 * checks the pair again when it is saved.
 */

export interface BoardDriver {
  id: number;
  name: string;
  phone: string;
  engagement: string;
  status: string;
  /** Their own car, or null when none is on record. */
  car: BoardCar | null;
  blocks: string[];
  warnings: string[];
}

export interface BoardCar {
  id: number;
  registration: string;
  make: string;
  model: string;
  colour: string;
  vehicleClassSlug: string;
  seats: number | null;
  status: string;
  blocks: string[];
  warnings: string[];
}

export async function loadAssignmentBoard(
  payload: Payload,
  user: User,
  job: Job,
  now: Date,
): Promise<BoardDriver[]> {
  const pickupAt = new Date(job.pickupAt);
  const [driverRecords, carRecords] = await Promise.all([
    loadDrivers(payload, user, now, { status: { not_equals: "left" } }),
    loadVehicles(payload, user, now, { status: { not_equals: "sold" } }),
  ]);

  const window = CLASH_MINUTES * 60_000;
  const clashes = driverRecords.length
    ? await payload.find({
        collection: "jobs",
        where: {
          and: [
            { driver: { in: driverRecords.map(({ driver }) => driver.id) } },
            { status: { in: [...OPEN_STATUSES] } },
            {
              pickupAt: {
                greater_than: new Date(pickupAt.getTime() - window).toISOString(),
              },
            },
            {
              pickupAt: {
                less_than: new Date(pickupAt.getTime() + window).toISOString(),
              },
            },
            { id: { not_equals: job.id } },
          ],
        },
        pagination: false,
        depth: 0,
        user,
        overrideAccess: false,
      })
    : { docs: [] as Job[] };

  // Each driver's car. Older records may link a car to two drivers, or a
  // driver to two cars: the one on this job comes first, then one in use.
  const currentCar = relId(job.vehicle);
  const carOf = new Map<number, BoardCar>();
  const ranked = [...carRecords].sort(
    (a, b) =>
      Number(b.vehicle.id === currentCar) - Number(a.vehicle.id === currentCar) ||
      Number(b.vehicle.status === "active") - Number(a.vehicle.status === "active"),
  );
  for (const { vehicle, documents } of ranked) {
    const check = carCheck(
      {
        status: vehicle.status,
        vehicleClassSlug: vehicle.vehicleClassSlug,
        seats: vehicle.seats,
        documents,
        ownerEngagement: ownerEngagement(vehicle),
      },
      pickupAt,
    );
    const car: BoardCar = {
      id: vehicle.id,
      registration: vehicle.registration,
      make: vehicle.make,
      model: vehicle.model,
      colour: vehicle.colour,
      vehicleClassSlug: vehicle.vehicleClassSlug,
      seats: vehicle.seats ?? null,
      status: vehicle.status,
      blocks: check.blocks,
      warnings: check.warnings,
    };
    for (const linked of vehicle.drivers ?? []) {
      const driverId = relId(linked);
      if (driverId !== null && !carOf.has(driverId)) carOf.set(driverId, car);
    }
  }

  return driverRecords
    .map(({ driver, documents }) => {
      const check = driverCheck(
        { status: driver.status, engagement: driver.engagement, documents },
        pickupAt,
        clashes.docs
          .filter((other) => relId(other.driver) === driver.id)
          .map((other) => new Date(other.pickupAt)),
      );
      return {
        id: driver.id,
        name: driver.fullName ?? `Driver ${driver.id}`,
        phone: driver.phone,
        engagement: driver.engagement ?? "registered",
        status: driver.status,
        car: carOf.get(driver.id) ?? null,
        blocks: check.blocks,
        warnings: check.warnings,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A subcontracting operator, as the assign page lists them. */
export interface BoardOperator {
  id: number;
  name: string;
  licensedFrom: string;
  licenceNumber: string | null;
  phone: string;
  blocks: string[];
  warnings: string[];
}

/**
 * The subcontracting operators a job could go to (Cityline, 15 Oct 2026),
 * checked against its pickup: one who has left, or whose recorded licence has
 * run out, cannot take it. Those who have left are not listed unless the job
 * is theirs now. The jobs collection's hook checks again when it is saved.
 */
export async function loadOperatorBoard(
  payload: Payload,
  user: User,
  job: Job,
): Promise<BoardOperator[]> {
  const pickupAt = new Date(job.pickupAt);
  const current = relId(job.operator);
  const found = await payload.find({
    collection: "operators",
    sort: "name",
    pagination: false,
    depth: 0,
    user,
    overrideAccess: false,
  });
  return (found.docs as Operator[])
    .filter(
      (operator) =>
        operator.id === current ||
        !operator.dateLeft ||
        new Date(operator.dateLeft) > pickupAt,
    )
    .map((operator) => ({
      id: operator.id,
      name: operator.name,
      licensedFrom: licensedFromText(operator),
      licenceNumber: operator.licenceNumber ?? null,
      phone: operator.phone,
      ...operatorCheck(operator, pickupAt),
    }));
}
