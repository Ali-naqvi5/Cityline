/**
 * Payments (approved by Cityline, 6 Oct 2026): money in from customers.
 *
 *   - Website bookings are paid by card on the website. Stripe's webhook
 *     records each payment, and Stripe's fee once Stripe has worked it out.
 *   - Office bookings paid by card link, bank transfer or on account are
 *     marked paid here by hand — the date, how, and a reference — against the
 *     bookings the money covers. A booking is paid for once. Cash bookings
 *     are settled through Driver Pay and partner bookings through Supplier
 *     Money, so neither is listed.
 *   - Refunds are made by the office, in Stripe or by bank, never from the
 *     admin. They are recorded here by hand, against the payment and the
 *     bookings they give money back for, and never for more than was paid
 *     for a booking.
 */

/** How an office booking is paid when it has to be marked paid here. */
export const PAID_BY_HAND = ["card_link", "bank", "account"] as const;

export interface AwaitingJob {
  paymentMethod: string;
  status: string;
  customerPaymentId: number | null;
  isTest?: boolean | null;
}

/** An office booking still waiting for its customer's money. */
export function awaitsPayment(job: AwaitingJob): boolean {
  return (
    (PAID_BY_HAND as readonly string[]).includes(job.paymentMethod) &&
    job.status !== "cancelled" &&
    job.customerPaymentId === null &&
    !job.isTest
  );
}

/** Paid, and the booking's price has moved since. */
export function priceChangedSincePaid(job: {
  customerPaymentId: number | null;
  customerPricePence: number | null;
  customerPaidPricePence: number | null;
}): boolean {
  return (
    job.customerPaymentId !== null &&
    job.customerPaidPricePence !== null &&
    job.customerPricePence !== job.customerPaidPricePence
  );
}

export const CUSTOMER_PAYMENT_METHODS = {
  card_link: "Card payment link",
  bank_transfer: "Bank transfer",
  card: "Card by phone",
  cash: "Cash to the office",
  other: "Other",
} as const;
export type CustomerPaymentMethod = keyof typeof CUSTOMER_PAYMENT_METHODS;

export const REFUND_METHODS = {
  stripe: "Stripe",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
} as const;
export type RefundMethod = keyof typeof REFUND_METHODS;

/** "CP-000007" — an office booking's payment, recorded by hand. */
export function customerPaymentReference(id: number): string {
  return `CP-${String(id).padStart(6, "0")}`;
}

/** "RF-000007" — a refund, recorded by hand. */
export function refundReference(id: number): string {
  return `RF-${String(id).padStart(6, "0")}`;
}

/** A Stripe refund's own id, as the Dashboard shows it on the refund. */
export function isStripeRefundId(value: string): boolean {
  return /^(re|pyr)_[A-Za-z0-9]{8,}$/.test(value);
}

/** What may still be refunded on a booking: what was paid, less refunds. */
export function refundable(paidPence: number, refundedPence: number): number {
  return Math.max(0, paidPence - refundedPence);
}

export interface MoneyIn {
  amountPence: number;
  /** Stripe's fee; null while Stripe has not said. */
  feePence: number | null;
  voided: boolean;
}

export interface Takings {
  takenPence: number;
  feesPence: number;
  /** Payments whose fee is not known yet. */
  feesUnknown: number;
  refundedPence: number;
  /** Taken, less refunds and card fees. */
  keptPence: number;
}

/** Money in for a period: void payments never count. */
export function takingsTotals(
  payments: readonly MoneyIn[],
  refundedPence: number,
): Takings {
  const live = payments.filter((payment) => !payment.voided);
  const takenPence = live.reduce((sum, payment) => sum + payment.amountPence, 0);
  const feesPence = live.reduce((sum, payment) => sum + (payment.feePence ?? 0), 0);
  return {
    takenPence,
    feesPence,
    feesUnknown: live.filter((payment) => payment.feePence === null).length,
    refundedPence,
    keptPence: takenPence - refundedPence - feesPence,
  };
}

/** The Stripe Dashboard's page for a payment, in test or live mode. */
export function stripePaymentUrl(paymentIntentId: string, test: boolean): string {
  return `https://dashboard.stripe.com/${test ? "test/" : ""}payments/${encodeURIComponent(paymentIntentId)}`;
}
