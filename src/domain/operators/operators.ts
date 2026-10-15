/**
 * Subcontracting operators (Cityline, 15 Oct 2026): other licensed private
 * hire operators Cityline passes a booking to. TfL does not let Cityline run
 * drivers outside its own licence, so work it cannot cover goes to another
 * operator, who does it with their own drivers and cars.
 *
 * The law (Private Hire Vehicles (London) Act 1998, s.5): a London operator
 * may pass a booking only to another operator licensed by TfL, by a district
 * council in England and Wales (taking it in that district), or in Scotland,
 * and stays responsible to the passenger. The booking's record names the
 * operator, their licence and who licensed them. Cityline keeps no record of
 * the operator's drivers or cars, and runs no compliance checks on them
 * (Cityline, 15 Oct 2026); only the operator's own licence counts.
 */

export const LICENSED_FROM = {
  tfl: "Transport for London (TfL)",
  council: "A district council (England and Wales)",
  scotland: "A licensing authority in Scotland",
} as const;
export type LicensedFrom = keyof typeof LICENSED_FROM;

export function isLicensedFrom(value: unknown): value is LicensedFrom {
  return typeof value === "string" && value in LICENSED_FROM;
}

export interface OperatorRecord {
  name: string;
  licensedFrom: string;
  /** The council or authority, when not TfL. */
  licensingAuthority?: string | null;
  licenceNumber?: string | null;
  licenceExpiresAt?: string | null;
  dateLeft?: string | null;
}

/** Who licensed the operator, as the booking's record states it. */
export function licensedFromText(operator: OperatorRecord): string {
  if (operator.licensedFrom === "tfl") return "Transport for London";
  const authority = operator.licensingAuthority?.trim();
  if (operator.licensedFrom === "scotland") {
    return authority ? `${authority} (Scotland)` : "Scotland";
  }
  return authority || "A district council";
}

const day = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Whether a booking can go to this operator at `at` (its pickup), and what to
 * know if it can. Blocked once they have left, or once a recorded licence
 * has run out: a booking may only go to an operator with a current licence.
 * Missing licence details are only warned about — the Owner made them
 * optional (15 Oct 2026).
 */
export function operatorCheck(
  operator: OperatorRecord,
  at: Date,
): { blocks: string[]; warnings: string[] } {
  const blocks: string[] = [];
  const warnings: string[] = [];
  if (operator.dateLeft && new Date(operator.dateLeft) <= at) {
    blocks.push(`Left on ${day.format(new Date(operator.dateLeft))}.`);
  }
  if (operator.licenceExpiresAt && new Date(operator.licenceExpiresAt) < at) {
    blocks.push(
      `Operator licence expired on ${day.format(new Date(operator.licenceExpiresAt))}.`,
    );
  }
  if (!operator.licenceNumber?.trim()) warnings.push("No licence number on record.");
  else if (!operator.licenceExpiresAt) warnings.push("No licence expiry on record.");
  return { blocks, warnings };
}
