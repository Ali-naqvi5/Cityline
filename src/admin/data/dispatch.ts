import "server-only";

import type { Payload, Where } from "payload";

import { carCheck, CLASH_MINUTES, driverCheck } from "@/domain/dispatch/eligibility";
import { relId } from "@/domain/dispatch/assignment";
import { OPEN_STATUSES } from "@/domain/jobs/labels";
import type { Job, User } from "@/payload-types";

import { loadDrivers, loadVehicles } from "./fleet";

/**
 * Everyone who could take a job, and every car (spec §19; Cityline,
 * 9 Oct 2026: any driver, any car). Each driver and each car is checked
 * against the pickup time on its own — documents, status, other jobs — and
 * the screen joins them with how the car suits the job, so the office can
 * pair anyone with anything and still see what to look at. The jobs
 * collection's hook checks the chosen pair again when it is saved.
 */

export interface BoardDriver {
  id: number;
  name: string;
  phone: string;
  engagement: string;
  status: string;
  /** Cars that list this driver as one who normally uses them. */
  carIds: number[];
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
  driverIds: number[];
  blocks: string[];
  warnings: string[];
}

export async function loadAssignmentBoard(
  payload: Payload,
  user: User,
  job: Job,
  now: Date,
): Promise<{ drivers: BoardDriver[]; cars: BoardCar[] }> {
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

  const cars: BoardCar[] = carRecords.map(({ vehicle, documents }) => {
    const check = carCheck(
      {
        status: vehicle.status,
        vehicleClassSlug: vehicle.vehicleClassSlug,
        seats: vehicle.seats,
        documents,
      },
      pickupAt,
    );
    return {
      id: vehicle.id,
      registration: vehicle.registration,
      make: vehicle.make,
      model: vehicle.model,
      colour: vehicle.colour,
      vehicleClassSlug: vehicle.vehicleClassSlug,
      seats: vehicle.seats ?? null,
      status: vehicle.status,
      driverIds: (vehicle.drivers ?? [])
        .map((linked) => relId(linked))
        .filter((id): id is number => id !== null),
      blocks: check.blocks,
      warnings: check.warnings,
    };
  });

  const drivers: BoardDriver[] = driverRecords
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
        carIds: cars
          .filter((car) => car.driverIds.includes(driver.id))
          .map((car) => car.id),
        blocks: check.blocks,
        warnings: check.warnings,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { drivers, cars };
}

/**
 * The dispatch board's jobs: open jobs from `from` to `to`, and the open jobs
 * before both the range and now — pickups that have passed with nobody
 * closing the job, which still need completing or chasing.
 */
export async function loadBoardJobs(
  payload: Payload,
  user: User,
  range: { from: Date; to: Date },
  onlyUnassigned: boolean,
  now: Date,
): Promise<{ upcoming: Job[]; overdue: Job[] }> {
  const overdueBefore = new Date(Math.min(range.from.getTime(), now.getTime()));
  const statuses = onlyUnassigned ? ["unassigned"] : [...OPEN_STATUSES];
  const base: Where[] = [{ status: { in: statuses } }, { archivedAt: { exists: false } }];

  const [upcoming, overdue] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: {
        and: [
          ...base,
          { pickupAt: { greater_than_equal: range.from.toISOString() } },
          { pickupAt: { less_than: range.to.toISOString() } },
        ],
      },
      sort: "pickupAt",
      limit: 300,
      depth: 1,
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: "jobs",
      where: {
        and: [...base, { pickupAt: { less_than: overdueBefore.toISOString() } }],
      },
      sort: "pickupAt",
      limit: 100,
      depth: 1,
      user,
      overrideAccess: false,
    }),
  ]);
  return { upcoming: upcoming.docs, overdue: overdue.docs };
}
