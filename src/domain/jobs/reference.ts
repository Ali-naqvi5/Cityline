/**
 * Job references (`J-004271`).
 *
 * One format for every source (§2). A website booking, a Trip.com job and a
 * phone booking all get a reference from this sequence, because they all live in
 * one register — the thing TfL inspects — and a controller reading a run sheet
 * should not have to know where a job came from to know what to call it.
 *
 * Deliberately **not** the same shape as a booking reference. `CL-7K4Q2P` is
 * what a customer quotes; `J-004271` is what the office quotes. Keeping them
 * visibly different stops the two being confused on a phone call, and stops a
 * customer's reference being typed into a job search.
 *
 * Sequential rather than random, also deliberately: these are counted, sorted
 * and read aloud in order by staff. Nothing secret depends on a job reference —
 * the magic link guards customer data — so predictability costs nothing here.
 *
 * The numbers come from the Postgres sequence `job_reference_seq`, which never
 * hands out the same one twice, even to two checkouts at the same instant. A
 * booking that rolls back leaves a gap; a gap is harmless, a duplicate is not.
 */

const PREFIX = "J-";

/**
 * Six digits: a million jobs before the format has to widen, which at
 * Cityline's volume is well beyond the life of this system. `formatJobReference`
 * does not truncate if it ever overflows — it just gets longer, and the pattern
 * below accepts that rather than rejecting a valid seven-digit reference.
 */
const DIGITS = 6;

export const JOB_REFERENCE_PATTERN = /^J-[0-9]{6,}$/;

export function formatJobReference(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(`Job sequence must be a positive integer, got ${sequence}`);
  }

  return PREFIX + String(sequence).padStart(DIGITS, "0");
}

/** The number back out of a reference, or null if it is not one of ours. */
export function jobSequenceOf(reference: string): number | null {
  if (!JOB_REFERENCE_PATTERN.test(reference)) return null;

  const sequence = Number(reference.slice(PREFIX.length));
  return Number.isInteger(sequence) && sequence > 0 ? sequence : null;
}
