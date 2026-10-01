import "server-only";

import type { Payload, Where } from "payload";

import {
  CLASH_MINUTES,
  checkEligibility,
  classFit,
  type ClassFit,
  type Eligibility,
} from "@/domain/dispatch/eligibility";
import { relId } from "@/domain/dispatch/assignment";
import { OPEN_STATUSES } from "@/domain/jobs/labels";
import type { Driver, Job, User, Vehicle } from "@/payload-types";

import { loadDrivers, loadVehicles } from "./fleet";

/**
 * Who can take a job (spec §19): every working driver paired with each
 * vehicle they use, checked against the job's pickup time and class. The
 * controller picks from the eligible pairs; the rest are listed with the
 * reason, so nobody wonders why a driver is missing. The jobs collection's
 * hook checks the chosen pair again when it is saved.
 */

export interface AssignmentOption {
  driver: Driver;
  vehicle: Vehicle;
  eligibility: Eligibility;
  fit: ClassFit;
  current: boolean;
}

export interface UnavailableDriver {
  driver: Driver;
  reasons: string[];
}

const FIT_ORDER: Record<ClassFit, number> = { exact: 0, upgrade: 1, incompatible: 2 };

export async function loadAssignmentOptions(
  payload: Payload,
  user: User,
  job: Job,
  now: Date,
): Promise<{ options: AssignmentOption[]; unavailable: UnavailableDriver[] }> {
  const pickupAt = new Date(job.pickupAt);
  const [drivers, vehicles] = await Promise.all([
    loadDrivers(payload, user, now, { status: { not_equals: "left" } }),
    loadVehicles(payload, user, now, { status: { not_equals: "sold" } }),
  ]);

  const window = CLASH_MINUTES * 60_000;
  const clashes = drivers.length
    ? await payload.find({
        collection: "jobs",
        where: {
          and: [
            { driver: { in: drivers.map(({ driver }) => driver.id) } },
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

  const currentDriver = relId(job.driver);
  const currentVehicle = relId(job.vehicle);
  const options: AssignmentOption[] = [];
  const unavailable: UnavailableDriver[] = [];

  for (const { driver, documents } of drivers) {
    const own = vehicles.filter(({ vehicle }) =>
      (vehicle.drivers ?? []).some((linked) => relId(linked) === driver.id),
    );
    if (own.length === 0) {
      unavailable.push({
        driver,
        reasons: ["No vehicle is linked to this driver. Link one on the vehicle's page."],
      });
      continue;
    }

    const otherPickups = clashes.docs
      .filter((other) => relId(other.driver) === driver.id)
      .map((other) => new Date(other.pickupAt));

    const pairs = own.map(({ vehicle, documents: vehicleDocuments }) => ({
      driver,
      vehicle,
      fit: classFit(job.vehicleClassSlug, vehicle.vehicleClassSlug),
      current: driver.id === currentDriver && vehicle.id === currentVehicle,
      eligibility: checkEligibility({
        pickupAt,
        jobClass: job.vehicleClassSlug,
        driver: { status: driver.status, documents },
        vehicle: {
          status: vehicle.status,
          vehicleClassSlug: vehicle.vehicleClassSlug,
          documents: vehicleDocuments,
        },
        otherPickups,
        linked: true,
      }),
    }));

    const eligible = pairs.filter((pair) => pair.eligibility.eligible);
    if (eligible.length) {
      options.push(...eligible);
    } else {
      const reasons = [...new Set(pairs.flatMap((pair) => pair.eligibility.blocks))];
      unavailable.push({ driver, reasons });
    }
  }

  options.sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      a.eligibility.warnings.length - b.eligibility.warnings.length ||
      FIT_ORDER[a.fit] - FIT_ORDER[b.fit] ||
      (a.driver.fullName ?? "").localeCompare(b.driver.fullName ?? ""),
  );
  unavailable.sort((a, b) =>
    (a.driver.fullName ?? "").localeCompare(b.driver.fullName ?? ""),
  );
  return { options, unavailable };
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
