/**
 * Rules on what staff may do to a job (§2, JOB-03, JOB-07, spec §15, §49).
 * Pure, so they are tested directly; `collections/Jobs.ts` enforces them on
 * every write, whatever screen or API call made it.
 */

/**
 * The fields a website booking locks: its price and how it was paid, its
 * customer and its route.
 * They come from what the customer agreed and paid for, so staff change them
 * through "Amend booking", which reprices and settles the difference.
 */
export const LOCKED_FIELDS = [
  "customerPricePence",
  "paymentMethod",
  "leadName",
  "leadPhone",
  "leadEmail",
  "pickupAddress",
  "dropoffAddress",
  "viaStops",
] as const;

export const LOCKED_FIELD_LABELS: Record<(typeof LOCKED_FIELDS)[number], string> = {
  customerPricePence: "price",
  paymentMethod: "payment method",
  leadName: "passenger name",
  leadPhone: "passenger phone",
  leadEmail: "passenger email",
  pickupAddress: "pickup address",
  dropoffAddress: "drop-off address",
  viaStops: "stops",
};

function same(a: unknown, b: unknown): boolean {
  const norm = (value: unknown): unknown => {
    if (value === undefined || value === "") return null;
    // Payload gives array rows fresh ids; their content is what matters.
    if (Array.isArray(value))
      return value.map((item) => {
        if (!item || typeof item !== "object") return item;
        const { id: _id, ...rest } = item as Record<string, unknown>;
        void _id;
        return Object.fromEntries(
          Object.entries(rest).map(([key, field]) => [key, norm(field)]),
        );
      });
    // A related record, as an object or just its id.
    if (value && typeof value === "object" && "id" in value)
      return (value as { id: unknown }).id;
    return value;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/**
 * A booking's own details: everything the booking form edits. Once a booking
 * is completed or PNS only the Owner may change these (Cityline, 13 Oct
 * 2026); the driver's price stays open, as it is often written afterwards.
 */
export const DETAIL_FIELDS = [
  "supplier",
  "supplierReference",
  "pickupAt",
  "pickupAddress",
  "viaStops",
  "dropoffAddress",
  "hours",
  "flightNumber",
  "vehicleClassSlug",
  "passengers",
  "largeBags",
  "smallBags",
  "leadName",
  "leadPhone",
  "leadEmail",
  "nameBoardText",
  "meetAndGreet",
  "bookerName",
  "bookerPhone",
  "bookerEmail",
  "extras",
  "customerPricePence",
  "paymentMethod",
  "driverNotes",
  "internalNotes",
  "notifyPassenger",
  "isTest",
] as const;

/** Detail fields this change would alter. */
export function changedDetails(
  original: Record<string, unknown>,
  change: Record<string, unknown>,
): string[] {
  return DETAIL_FIELDS.filter(
    (field) => field in change && !same(original[field], change[field]),
  );
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
