import { normalisePhone } from "@/domain/booking/passenger";
import { londonDateAndTime } from "@/lib/time";

/**
 * Jobs that may be the same trip entered twice (JOB-03, spec §14).
 *
 * A repeated supplier reference is refused outright (`rules.ts` and a unique
 * index). This is the softer check for everything else: the same passenger
 * around the same time, or the same flight on the same day, is shown to the
 * controller before the job is saved. They can still go ahead — a family of
 * five may genuinely need two cars — but never without seeing it.
 */

export interface DuplicateProbe {
  leadName: string;
  leadPhone: string;
  pickupAt: Date;
  flightNumber?: string | null;
}

export interface DuplicateCandidate {
  id: number;
  reference: string;
  leadName: string;
  leadPhone: string;
  pickupAt: string;
  flightNumber?: string | null;
  status: string;
}

export interface PossibleDuplicate<T extends DuplicateCandidate = DuplicateCandidate> {
  job: T;
  reasons: string[];
}

/** How far apart two pickups can be and still look like the same trip. */
export const DUPLICATE_WINDOW_HOURS = 6;

const name = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const flight = (value: string | null | undefined) =>
  (value ?? "").replace(/\s+/g, "").toUpperCase();
const phone = (value: string) => normalisePhone(value) ?? value.replace(/\D/g, "");

export function possibleDuplicates<T extends DuplicateCandidate>(
  probe: DuplicateProbe,
  jobs: readonly T[],
): PossibleDuplicate<T>[] {
  const window = DUPLICATE_WINDOW_HOURS * 3_600_000;
  const probeDay = londonDateAndTime(probe.pickupAt).date;
  const probeFlight = flight(probe.flightNumber);
  const probePhone = phone(probe.leadPhone);
  const probeName = name(probe.leadName);

  const matches: PossibleDuplicate<T>[] = [];
  for (const job of jobs) {
    if (job.status === "cancelled") continue;
    const at = new Date(job.pickupAt);
    const close = Math.abs(at.getTime() - probe.pickupAt.getTime()) <= window;
    const reasons: string[] = [];

    if (close && probePhone && phone(job.leadPhone) === probePhone) {
      reasons.push("same passenger phone");
    }
    if (close && probeName && name(job.leadName) === probeName) {
      reasons.push("same passenger name");
    }
    if (
      probeFlight &&
      flight(job.flightNumber) === probeFlight &&
      londonDateAndTime(at).date === probeDay
    ) {
      reasons.push("same flight that day");
    }
    if (reasons.length) matches.push({ job, reasons });
  }
  return matches;
}
