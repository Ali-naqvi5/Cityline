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
 * and read aloud in order by staff, and a gap in the sequence is a useful
 * signal. Nothing secret depends on a job reference — the magic link guards
 * customer data — so predictability costs nothing here.
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

/**
 * The next reference after a batch of existing ones.
 *
 * Takes the references rather than reading the database, so the ordering rule
 * is testable. It compares **numerically**, which is the point: sorting
 * `J-000999` and `J-0001000` as text puts the thousandth job before the
 * nine-hundredth, and the sequence would then start handing out duplicates.
 *
 * Unrecognised references are ignored rather than throwing. A hand-entered or
 * legacy reference in the column must not be able to stop checkout.
 */
export function nextJobReference(existing: readonly string[]): string {
  let highest = 0;

  for (const reference of existing) {
    const sequence = jobSequenceOf(reference);
    if (sequence !== null && sequence > highest) highest = sequence;
  }

  return formatJobReference(highest + 1);
}
