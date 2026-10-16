import type { Pence } from "@/domain/money";

/**
 * What a booking makes (spec §30): the price Cityline receives, less any
 * refund on it, less card fees, less what the driver is paid, less any
 * partner penalty on it that Cityline bears itself.
 *
 * There is no supplier commission to take off: partners take their cut
 * before they send a job, so the price on a supplier job is already what
 * Cityline receives (Cityline, 2 Oct 2026). Profit is unknown — not £0 —
 * until the driver's price is written on the booking. Below zero it is a
 * loss, shown as one (Cityline, 16 Oct 2026).
 */
export interface BookingMoneyInput {
  customerPricePence: Pence;
  paymentFeePence?: Pence | null;
  /** Refunds recorded on this booking. */
  refundedPence?: Pence | null;
  driverPricePence?: Pence | null;
  /** Partner penalties on this booking, not void. */
  penaltyPence?: Pence | null;
  /** The part of those penalties passed to the driver. */
  penaltyFromDriverPence?: Pence | null;
}

export interface BookingMoney {
  netPence: Pence;
  driverPricePence: Pence | null;
  /** The partner penalties Cityline bears: the penalties less the driver's share. */
  penaltyPence: Pence;
  profitPence: Pence | null;
}

export function bookingMoney(input: BookingMoneyInput): BookingMoney {
  const netPence =
    input.customerPricePence - (input.refundedPence ?? 0) - (input.paymentFeePence ?? 0);
  const driverPricePence = input.driverPricePence ?? null;
  const penaltyPence = (input.penaltyPence ?? 0) - (input.penaltyFromDriverPence ?? 0);
  return {
    netPence,
    driverPricePence,
    penaltyPence,
    profitPence:
      driverPricePence === null ? null : netPence - driverPricePence - penaltyPence,
  };
}

/**
 * How much a driver price loses on a booking, against its agreed price — the
 * warning on the assign screen and the booking page (Cityline, 16 Oct 2026).
 * Null when it does not lose, or either price is not known. Only the agreed
 * price is used, which anyone who dispatches already sees: never card fees.
 */
export function driverPriceLoss(
  customerPricePence: number | null | undefined,
  driverPricePence: number | null | undefined,
): number | null {
  if (
    customerPricePence === null ||
    customerPricePence === undefined ||
    driverPricePence === null ||
    driverPricePence === undefined
  ) {
    return null;
  }
  return driverPricePence > customerPricePence
    ? driverPricePence - customerPricePence
    : null;
}
