import {
  ValidationError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type PayloadRequest,
} from "payload";

import { checkAssignment, relId } from "@/domain/dispatch/assignment";
import { trackedChanges } from "@/domain/jobs/history";
import { isJobStatus, type JobStatus } from "@/domain/jobs/labels";
import { isFinal, statusChangeProblem } from "@/domain/jobs/status";
import type { Job } from "@/payload-types";

/**
 * Dispatch rules on every write to a job (JOB-05, JOB-06, JOB-08; spec §10,
 * §19, §49) — the screens show the same rules, but these are the ones that
 * count, so the API cannot be used to go around them.
 *
 * Note that Payload has already filled every field missing from the change
 * with the stored value by the time these run, so changes are found by
 * comparing values, never by looking for keys.
 */

type JobData = Partial<Job> & Record<string, unknown>;

function fail(req: PayloadRequest, errors: { path: string; message: string }[]): never {
  throw new ValidationError({ collection: "jobs", errors, req });
}

/** Status changes that simply follow the driver being given or taken away. */
function followsDriver(from: JobStatus, to: JobStatus): boolean {
  return (
    (from === "unassigned" && to === "assigned") ||
    (from !== "unassigned" && to === "unassigned") ||
    (from === "driver_confirmed" && to === "assigned")
  );
}

export const applyDispatchRules: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const job = data as JobData;
  const original = (originalDoc ?? {}) as JobData;
  const staff = Boolean(req.user);
  const now = new Date();

  const from: JobStatus =
    operation === "update" && isJobStatus(original.status)
      ? original.status
      : "unassigned";
  const requested: JobStatus = isJobStatus(job.status) ? job.status : from;
  const before = { driver: relId(original.driver), vehicle: relId(original.vehicle) };
  let driver = relId(job.driver);
  let vehicle = relId(job.vehicle);
  const pickupAt = new Date(String(job.pickupAt ?? original.pickupAt));
  const jobClass = String(job.vehicleClassSlug ?? original.vehicleClassSlug ?? "");

  if (staff && operation === "create") {
    job.takenByUser ??= req.user!.id;
    job.takenAt ??= now.toISOString();
  }

  // A job that happened, did not happen or was cancelled keeps that outcome
  // and the driver it had.
  if (operation === "update" && isFinal(from)) {
    if (requested !== from) {
      fail(req, [
        {
          path: "status",
          message: statusChangeProblem({
            from,
            to: requested,
            hasDriver: before.driver !== null,
            pickupAt,
            now,
          })!,
        },
      ]);
    }
    if (driver !== before.driver || vehicle !== before.vehicle) {
      fail(req, [
        { path: "driver", message: "This job is closed, so its driver cannot change." },
      ]);
    }
    return job;
  }

  // Asking for Unassigned is asking for the driver to be taken off.
  if (requested === "unassigned" && from !== "unassigned") {
    driver = null;
  }
  if (driver === null) vehicle = null;

  let status = requested;
  const driverChanged = driver !== before.driver || vehicle !== before.vehicle;

  if (driverChanged && driver === null) {
    Object.assign(job, {
      driver: null,
      vehicle: null,
      driverPhvNo: null,
      vehicleReg: null,
      dispatchedByUser: null,
      dispatchedAt: null,
      driverConfirmedAt: null,
      driverMessageStatus: "not_sent",
      driverMessageAt: null,
    });
    if (status === "assigned" || status === "driver_confirmed") status = "unassigned";
  } else if (driverChanged && driver !== null) {
    if (vehicle === null) {
      fail(req, [
        { path: "vehicle", message: "Choose the vehicle as well as the driver." },
      ]);
    }
    if (status === "cancelled") {
      fail(req, [
        { path: "driver", message: "A job being cancelled cannot be given a driver." },
      ]);
    }
    const check = await checkAssignment(
      req.payload,
      {
        driverId: driver,
        vehicleId: vehicle,
        pickupAt,
        jobClass,
        jobId: typeof original.id === "number" ? original.id : null,
      },
      req,
    );
    if ("missing" in check) {
      fail(req, [
        {
          path: check.missing,
          message: `That ${check.missing} is not on record.`,
        },
      ]);
    }
    if (!check.eligibility.eligible) {
      fail(req, [
        {
          path: "driver",
          message: `${check.driver.fullName ?? "This driver"} with ${check.vehicle.registration} cannot do this job. ${check.eligibility.blocks.join(" ")}`,
        },
      ]);
    }
    Object.assign(job, {
      driver,
      vehicle,
      driverPhvNo: check.phvNumber,
      vehicleReg: check.vehicle.registration,
      dispatchedByUser: req.user?.id ?? null,
      dispatchedAt: now.toISOString(),
      driverConfirmedAt: null,
      driverMessageStatus: "not_sent",
      driverMessageAt: null,
      passengerMessageStatus: "not_sent",
      passengerMessageAt: null,
    });
    if (status === "unassigned" || status === "driver_confirmed") status = "assigned";
    // On `req.context`, not the hook's `context` argument: the lookups above
    // replace `req.context` with a copy, and the after-change hook reads this.
    req.context.assignedDriver = `${check.driver.fullName ?? "Driver"} · ${check.vehicle.registration}`;
  } else if (
    staff &&
    driver !== null &&
    vehicle !== null &&
    (pickupAt.getTime() !== new Date(String(original.pickupAt)).getTime() ||
      jobClass !== original.vehicleClassSlug)
  ) {
    // The same driver, but a new time or class: still allowed to do it?
    const check = await checkAssignment(
      req.payload,
      { driverId: driver, vehicleId: vehicle, pickupAt, jobClass, jobId: original.id },
      req,
    );
    if (!("missing" in check) && !check.eligibility.eligible) {
      fail(req, [
        {
          path: "pickupAt",
          message: `The assigned driver cannot do the job with this change: ${check.eligibility.blocks.join(" ")} Take the driver off first, or choose another.`,
        },
      ]);
    }
  }

  if (status !== from) {
    const problem = statusChangeProblem({
      from,
      to: status,
      hasDriver: driver !== null,
      pickupAt,
      now,
      cancelReason: String(job.cancelReason ?? original.cancelReason ?? ""),
    });
    if (problem) fail(req, [{ path: "status", message: problem }]);

    job.status = status;
    const at = now.toISOString();
    if (status === "driver_confirmed") job.driverConfirmedAt = at;
    if (status === "completed") job.completedAt ??= at;
    if (status === "no_show") job.noShowAt = at;
    if (status === "cancelled") job.cancelledAt ??= at;
  }

  return job;
};

/**
 * The job's timeline (JOB-08): what staff changed, as `job-events` rows —
 * field, before, after, who and when. Website checkout and Manage booking
 * write their own rows, as the system and the customer.
 */
export const recordJobHistory: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== "update" || !req.user) return doc;

  const job = doc as Job;
  const previous = previousDoc as Job;
  const actor = { actorType: "user" as const, actorUser: req.user.id };
  const events: {
    type: "updated" | "assigned" | "unassigned" | "status_changed";
    field?: string;
    oldValue?: string | null;
    newValue?: string | null;
  }[] = [];

  const driverBefore = relId(previous.driver);
  const driverNow = relId(job.driver);
  const driverChanged =
    driverBefore !== driverNow || relId(previous.vehicle) !== relId(job.vehicle);

  if (driverChanged) {
    let before: string | null = null;
    if (driverBefore !== null) {
      const old = await req.payload.findByID({
        collection: "drivers",
        id: driverBefore,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      });
      before = `${old?.fullName ?? "Driver"} · ${previous.vehicleReg ?? "no vehicle"}`;
    }
    events.push(
      driverNow === null
        ? { type: "unassigned", field: "driver", oldValue: before }
        : {
            type: "assigned",
            field: "driver",
            oldValue: before,
            newValue:
              typeof req.context.assignedDriver === "string"
                ? req.context.assignedDriver
                : job.vehicleReg,
          },
    );
  }

  if (
    previous.status !== job.status &&
    !(driverChanged && followsDriver(previous.status, job.status))
  ) {
    events.push({
      type: "status_changed",
      field: "status",
      oldValue: previous.status,
      newValue: job.status,
    });
  }

  for (const change of trackedChanges(
    previous as unknown as Record<string, unknown>,
    job as unknown as Record<string, unknown>,
  )) {
    events.push({
      type: "updated",
      field: change.field,
      oldValue: change.from,
      newValue: change.to,
    });
  }

  for (const event of events) {
    await req.payload.create({
      collection: "job-events",
      data: { job: job.id, ...event, ...actor },
      overrideAccess: true,
      req,
    });
  }
  return doc;
};
