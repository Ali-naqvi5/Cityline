import { JOB_STATUS_LABELS, type JobStatus } from "./labels";

/**
 * How a job moves through its statuses (JOB-06, spec §10):
 *
 *   Unassigned → Assigned → Driver confirmed → Completed / No-show
 *   and Cancelled from any open status.
 *
 * Assigned and Unassigned follow the driver: giving a job a driver makes it
 * Assigned, taking the driver away makes it Unassigned. Completed, No-show and
 * Cancelled are final — a job that happened, or did not, stays that way, and
 * a cancelled website booking has its money settled on that basis.
 */

export const FINAL_STATUSES: readonly JobStatus[] = ["completed", "no_show", "cancelled"];

const NEXT: Record<JobStatus, readonly JobStatus[]> = {
  unassigned: ["assigned", "cancelled"],
  assigned: ["unassigned", "driver_confirmed", "completed", "no_show", "cancelled"],
  driver_confirmed: ["unassigned", "assigned", "completed", "no_show", "cancelled"],
  completed: [],
  no_show: [],
  cancelled: [],
};

export function isFinal(status: JobStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

export interface StatusChange {
  from: JobStatus;
  to: JobStatus;
  /** Whether the job has a driver and vehicle after the change. */
  hasDriver: boolean;
  pickupAt: Date;
  now: Date;
  cancelReason?: string | null;
}

/** Why this status change is not allowed, or null when it is. */
export function statusChangeProblem(change: StatusChange): string | null {
  const { from, to } = change;
  if (from === to) return null;

  if (isFinal(from)) {
    return `This job is ${JOB_STATUS_LABELS[from].toLowerCase()}, so its status cannot change.`;
  }
  if (!NEXT[from].includes(to)) {
    return `A job cannot go from ${JOB_STATUS_LABELS[from]} to ${JOB_STATUS_LABELS[to]}.`;
  }
  if ((to === "assigned" || to === "driver_confirmed") && !change.hasDriver) {
    return "Assign a driver and vehicle first.";
  }
  if (to === "completed" || to === "no_show") {
    if (!change.hasDriver) {
      return "Only a job with a driver can be marked completed or no-show.";
    }
    if (change.now < change.pickupAt) {
      return "A job can be marked completed or no-show only after its pickup time.";
    }
  }
  if (to === "cancelled" && !change.cancelReason?.trim()) {
    return "Say why the job is cancelled.";
  }
  return null;
}

/**
 * The status buttons a job shows, in the order a controller uses them.
 * Assigned and Unassigned are not here: they come from assigning or removing
 * the driver.
 */
export function statusActions(status: JobStatus): JobStatus[] {
  const order: JobStatus[] = ["driver_confirmed", "completed", "no_show", "cancelled"];
  return order.filter((to) => NEXT[status].includes(to));
}
