/**
 * Partner penalties (Cityline, 16 Oct 2026). A partner fines Cityline for a
 * booking — a late driver, say — and takes the fine off what it pays.
 *
 *   - Always recorded by hand, by the Owner or Accounts, against one partner
 *     booking. Nothing in the system ever creates, suggests or enforces one:
 *     not lateness, not stage times, not the Driver Report.
 *   - It comes off what the partner owes, and off the payment they take it
 *     from — which may be a later one than the booking's own.
 *   - When it is made, staff may pass part or all of it to the booking's
 *     driver (or subcontracting operator); that part comes off their next
 *     Driver Pay. The rest is Cityline's, off its profit.
 *   - Never edited or deleted: voided with a reason, and only while no
 *     partner payment, invoice or driver payment holds it.
 */

/** A penalty, as the money screens and documents use it. */
export interface PenaltyLine {
  id: number;
  jobId: number;
  jobReference: string;
  supplierReference: string | null;
  /** The day the partner fined Cityline. */
  penalisedAt: string;
  reason: string;
  amountPence: number;
  /** The part passed to the driver or operator; 0 when Cityline bears it all. */
  driverSharePence: number;
}

/** "PN-000004" — a penalty's reference, from its record. */
export function penaltyReference(id: number): string {
  return `PN-${String(id).padStart(6, "0")}`;
}

/** What a penalty costs Cityline itself: the part not passed to the driver. */
export function citylineSharePence(
  penalty: Pick<PenaltyLine, "amountPence" | "driverSharePence">,
): number {
  return penalty.amountPence - penalty.driverSharePence;
}

/** Why an amount cannot be a penalty, or null when it can. */
export function penaltyAmountProblem(amountPence: number | null): string | null {
  if (amountPence === null || !Number.isInteger(amountPence) || amountPence <= 0) {
    return "Enter the penalty, more than nothing.";
  }
  return null;
}

/** Why a driver's share cannot be taken, or null when it can. */
export function driverShareProblem(
  amountPence: number,
  sharePence: number | null,
): string | null {
  if (sharePence === null || !Number.isInteger(sharePence) || sharePence < 0) {
    return "Enter the driver's share in pounds, such as 5 or 5.50, or leave it empty.";
  }
  if (sharePence > amountPence)
    return "The driver's share cannot be more than the penalty.";
  return null;
}

/** The penalties' total, in pence. */
export function penaltiesTotal(
  penalties: readonly Pick<PenaltyLine, "amountPence">[],
): number {
  return penalties.reduce((sum, penalty) => sum + penalty.amountPence, 0);
}

/** The drivers' shares' total, in pence. */
export function driverSharesTotal(
  penalties: readonly Pick<PenaltyLine, "driverSharePence">[],
): number {
  return penalties.reduce((sum, penalty) => sum + penalty.driverSharePence, 0);
}
