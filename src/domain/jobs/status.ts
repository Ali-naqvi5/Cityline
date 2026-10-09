import { JOB_STATUS_LABELS, JOB_STATUS_SHORT, type JobStatus } from "./labels";

/**
 * How a job moves through its cycle (JOB-06, Cityline's operating cycle of
 * 2 Oct 2026). An operator runs each job live, on the phone and WhatsApp to
 * the driver and passenger, and moves it on one stage at a time:
 *
 *   Unassigned → Assigned → Driver confirmed → DOW → DAP → POB → Completed
 *                                                     ↘ PNS
 *
 *   DOW  driver on the way      DAP  driver at pickup
 *   POB  passenger on board     PNS  passenger no-show
 *
 * Forward moves go one stage at a time — Assigned cannot jump to POB. Moves
 * back are allowed any number of stages, to correct a mistake; stepping
 * back clears the times of the stages undone, and the job's history keeps
 * every move. Assigned and Unassigned follow the driver: giving a job a
 * driver makes it Assigned, taking the driver away makes it Unassigned.
 * Cancelled is final; Completed and PNS can be stepped back.
 */

/** The main line, in order. PNS is the other outcome of DAP. */
const LINE: readonly JobStatus[] = [
  "unassigned",
  "assigned",
  "driver_confirmed",
  "on_the_way",
  "at_pickup",
  "on_board",
  "completed",
];

/** The stages before each status, nearest first — where it can step back to. */
const BEFORE: Record<JobStatus, readonly JobStatus[]> = {
  unassigned: [],
  assigned: [],
  driver_confirmed: ["assigned"],
  on_the_way: ["driver_confirmed", "assigned"],
  at_pickup: ["on_the_way", "driver_confirmed", "assigned"],
  on_board: ["at_pickup", "on_the_way", "driver_confirmed", "assigned"],
  completed: ["on_board", "at_pickup", "on_the_way", "driver_confirmed", "assigned"],
  no_show: ["at_pickup", "on_the_way", "driver_confirmed", "assigned"],
  cancelled: [],
};

/** The next stage(s) forward from each status. */
const NEXT: Record<JobStatus, readonly JobStatus[]> = {
  unassigned: ["assigned"],
  assigned: ["driver_confirmed"],
  driver_confirmed: ["on_the_way"],
  on_the_way: ["at_pickup"],
  at_pickup: ["on_board", "no_show"],
  on_board: ["completed"],
  completed: [],
  no_show: [],
  cancelled: [],
};

/** Before the passenger is on board, a job can still be cancelled or re-driven. */
const BEFORE_BOARDING: readonly JobStatus[] = [
  "unassigned",
  "assigned",
  "driver_confirmed",
  "on_the_way",
  "at_pickup",
];

/** Closed jobs: their driver no longer changes. */
export const FINAL_STATUSES: readonly JobStatus[] = ["completed", "no_show", "cancelled"];

export function isFinal(status: JobStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

/** Whether a job in this status may still be cancelled or given another driver. */
export function beforeBoarding(status: JobStatus): boolean {
  return BEFORE_BOARDING.includes(status);
}

/** The stage forward from this status (two at DAP: POB or PNS). */
export function nextStages(status: JobStatus): JobStatus[] {
  return [...NEXT[status]];
}

/** The stages this status can step back to, nearest first. */
export function previousStages(status: JobStatus): JobStatus[] {
  return [...BEFORE[status]];
}

/** "DOW — Driver on the way" */
export function stageName(status: JobStatus): string {
  const short = JOB_STATUS_SHORT[status];
  const long = JOB_STATUS_LABELS[status];
  return short === long || short === "Confirmed" ? long : `${short} — ${long}`;
}

/** Where a status sits in the cycle, for progress displays. PNS sits with POB. */
export function stageIndex(status: JobStatus): number {
  if (status === "no_show") return LINE.indexOf("on_board");
  return LINE.indexOf(status);
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

  if (from === "cancelled")
    return "This booking is cancelled, so its status cannot change.";

  if (to === "cancelled") {
    if (!beforeBoarding(from)) {
      return "A booking cannot be cancelled once the passenger is on board. Step it back first.";
    }
    return change.cancelReason?.trim() ? null : "Say why the booking is cancelled.";
  }

  if (to === "unassigned") {
    return beforeBoarding(from)
      ? null
      : "Take the driver off only before the passenger is on board. Step it back first.";
  }

  if (!change.hasDriver) return "Assign a driver and vehicle first.";

  if (BEFORE[from].includes(to)) return null; // stepping back

  if (!NEXT[from].includes(to)) {
    const next = NEXT[from];
    return next.length
      ? `Bookings move one stage at a time: from ${stageName(from)} the next is ${next
          .map(stageName)
          .join(" or ")}.`
      : `${stageName(from)} is the end of the cycle; step it back to change it.`;
  }

  if (to === "no_show" && change.now < change.pickupAt) {
    return "A passenger can be marked a no-show only once the pickup time has passed.";
  }
  return null;
}
