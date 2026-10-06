import type { Pence } from "@/domain/money";

/**
 * What a booking makes (spec §30): the price Cityline receives, less any
 * refund on it, less card fees, less what the driver is paid.
 *
 * There is no supplier commission to take off: partners take their cut
 * before they send a job, so the price on a supplier job is already what
 * Cityline receives (Cityline, 2 Oct 2026). Profit is unknown — not £0 —
 * until the driver's price is written on the booking.
 */
export interface BookingMoneyInput {
  customerPricePence: Pence;
  paymentFeePence?: Pence | null;
  /** Refunds recorded on this booking. */
  refundedPence?: Pence | null;
  driverPricePence?: Pence | null;
}

export interface BookingMoney {
  netPence: Pence;
  driverPricePence: Pence | null;
  profitPence: Pence | null;
}

export function bookingMoney(input: BookingMoneyInput): BookingMoney {
  const netPence =
    input.customerPricePence - (input.refundedPence ?? 0) - (input.paymentFeePence ?? 0);
  const driverPricePence = input.driverPricePence ?? null;
  return {
    netPence,
    driverPricePence,
    profitPence: driverPricePence === null ? null : netPence - driverPricePence,
  };
}
