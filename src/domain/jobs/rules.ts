/**
 * Rules on what staff may do to a job (§2, JOB-03, JOB-07, spec §15, §49).
 * Pure, so they are tested directly; `collections/Jobs.ts` enforces them on
 * every write, whatever screen or API call made it.
 */

/**
 * The fields a website booking locks: its price, its customer and its route.
 * They come from what the customer agreed and paid for, so staff change them
 * through "Amend booking", which reprices and settles the difference.
 */
export const LOCKED_FIELDS = [
  "customerPricePence",
  "leadName",
  "leadPhone",
  "leadEmail",
  "pickupAddress",
  "dropoffAddress",
  "viaStops",
] as const;

export const LOCKED_FIELD_LABELS: Record<(typeof LOCKED_FIELDS)[number], string> = {
  customerPricePence: "price",
  leadName: "passenger name",
  leadPhone: "passenger phone",
  leadEmail: "passenger email",
  pickupAddress: "pickup address",
  dropoffAddress: "drop-off address",
  viaStops: "stops",
};

function same(a: unknown, b: unknown): boolean {
  const norm = (value: unknown) => {
    if (value === undefined || value === "") return null;
    if (Array.isArray(value))
      return value.map((item) =>
        item && typeof item === "object"
          ? { address: (item as { address?: string }).address ?? null }
          : item,
      );
    return value;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/** Locked fields this change would alter, if the job is locked. */
export function lockedFieldViolations(
  original: Record<string, unknown>,
  change: Record<string, unknown>,
): string[] {
  if (!original.locked) return [];
  return LOCKED_FIELDS.filter(
    (field) => field in change && !same(original[field], change[field]),
  );
}

export interface JobCreateCheck {
  source?: unknown;
  supplier?: unknown;
  supplierReference?: unknown;
}

/** Problems with a job staff are creating, before the database sees it. */
export function staffCreateProblems(data: JobCreateCheck): Record<string, string> {
  const problems: Record<string, string> = {};
  if (data.source === "website") {
    problems.source = "Website jobs are created by the website checkout only.";
  }
  if (data.source === "supplier") {
    if (!data.supplier) problems.supplier = "Choose the supplier this job came from.";
    if (typeof data.supplierReference !== "string" || !data.supplierReference.trim()) {
      problems.supplierReference = "Enter the supplier's booking reference.";
    }
  }
  return problems;
}

/** Supplier references compare without case or surrounding spaces. */
export function normaliseSupplierReference(value: string): string {
  return value.trim().toUpperCase();
}
