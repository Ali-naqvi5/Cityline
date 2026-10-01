import { diffRecords, type FieldChange } from "@/domain/audit/diff";

/**
 * The job's own history (JOB-08, spec §12): which field changes appear on the
 * job's timeline, under what name. The audit log keeps every field; this is
 * the operational story a controller reads — time, route, passenger, notes.
 * Driver, status and message changes have their own entries.
 */
export const TRACKED_FIELDS: Record<string, string> = {
  pickupAt: "Pickup time",
  pickupAddress: "Pickup",
  viaStops: "Stops",
  dropoffAddress: "Drop-off",
  flightNumber: "Flight",
  vehicleClassSlug: "Vehicle class",
  passengers: "Passengers",
  largeBags: "Large bags",
  smallBags: "Small bags",
  leadName: "Passenger name",
  leadPhone: "Passenger phone",
  leadEmail: "Passenger email",
  nameBoardText: "Name board",
  meetAndGreet: "Meet and greet",
  extras: "Extras",
  bookerName: "Booker",
  bookerPhone: "Booker phone",
  bookerEmail: "Booker email",
  supplierReference: "Supplier reference",
  customerPricePence: "Price",
  paymentMethod: "Payment",
  commissionPence: "Supplier commission",
  driverNotes: "Driver notes",
  internalNotes: "Internal notes",
  notifyPassenger: "Passenger email setting",
  isTest: "Test job",
};

function simplify(field: string, value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  if (field === "viaStops") {
    return value.map((stop: { address?: string }) => stop.address ?? "").join(" → ");
  }
  if (field === "extras") {
    return value
      .map(
        (extra: { slug?: string; quantity?: number }) =>
          `${extra.quantity} × ${extra.slug}`,
      )
      .join(", ");
  }
  return value;
}

function tracked(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of Object.keys(TRACKED_FIELDS)) {
    if (field in record) out[field] = simplify(field, record[field]);
  }
  return out;
}

/** The tracked fields this change altered, with before and after as text. */
export function trackedChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChange[] {
  return diffRecords(tracked(before), tracked(after));
}
