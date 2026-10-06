import { describe, expect, it } from "vitest";

import {
  awaitsPayment,
  customerPaymentReference,
  isStripeRefundId,
  priceChangedSincePaid,
  refundable,
  refundReference,
  stripePaymentUrl,
  takingsTotals,
} from "./customer-money";

describe("awaitsPayment", () => {
  const job = {
    paymentMethod: "bank",
    status: "unassigned",
    customerPaymentId: null,
    isTest: false,
  };

  it("lists office bookings paid by card link, bank transfer or on account", () => {
    expect(awaitsPayment(job)).toBe(true);
    expect(awaitsPayment({ ...job, paymentMethod: "card_link" })).toBe(true);
    expect(awaitsPayment({ ...job, paymentMethod: "account", status: "completed" })).toBe(
      true,
    );
  });

  it("leaves out cash, partner and website bookings — settled elsewhere", () => {
    for (const paymentMethod of ["cash", "supplier", "web_prepaid"]) {
      expect(awaitsPayment({ ...job, paymentMethod })).toBe(false);
    }
  });

  it("leaves out what is paid, cancelled or a test", () => {
    expect(awaitsPayment({ ...job, customerPaymentId: 4 })).toBe(false);
    expect(awaitsPayment({ ...job, status: "cancelled" })).toBe(false);
    expect(awaitsPayment({ ...job, isTest: true })).toBe(false);
  });
});

describe("priceChangedSincePaid", () => {
  it("notices a price that moved after the money came in", () => {
    const paid = {
      customerPaymentId: 3,
      customerPricePence: 6000,
      customerPaidPricePence: 6000,
    };
    expect(priceChangedSincePaid(paid)).toBe(false);
    expect(priceChangedSincePaid({ ...paid, customerPricePence: 7000 })).toBe(true);
    expect(
      priceChangedSincePaid({
        ...paid,
        customerPaymentId: null,
        customerPricePence: 7000,
      }),
    ).toBe(false);
  });
});

describe("references", () => {
  it("numbers payments and refunds recorded by hand", () => {
    expect(customerPaymentReference(12)).toBe("CP-000012");
    expect(refundReference(7)).toBe("RF-000007");
  });

  it("knows a Stripe refund id when it sees one", () => {
    expect(isStripeRefundId("re_3UKjUwJm1lMPqGGP0abcdEF")).toBe(true);
    expect(isStripeRefundId("pyr_1AbCdEfGhIjK")).toBe(true);
    expect(isStripeRefundId("BACS 1234")).toBe(false);
    expect(isStripeRefundId("re_")).toBe(false);
  });

  it("links to the payment in Stripe, test or live", () => {
    expect(stripePaymentUrl("pi_1", true)).toBe(
      "https://dashboard.stripe.com/test/payments/pi_1",
    );
    expect(stripePaymentUrl("pi_1", false)).toBe(
      "https://dashboard.stripe.com/payments/pi_1",
    );
  });
});

describe("refundable", () => {
  it("is what was paid less what is already refunded, never below nothing", () => {
    expect(refundable(6800, 0)).toBe(6800);
    expect(refundable(6800, 2000)).toBe(4800);
    expect(refundable(6800, 6800)).toBe(0);
    expect(refundable(6800, 9000)).toBe(0);
  });
});

describe("takingsTotals", () => {
  it("adds up money in, less refunds and card fees; void payments never count", () => {
    const totals = takingsTotals(
      [
        { amountPence: 13600, feePence: 448, voided: false },
        { amountPence: 6800, feePence: null, voided: false },
        { amountPence: 5000, feePence: 0, voided: false },
        { amountPence: 9999, feePence: 100, voided: true },
      ],
      2000,
    );
    expect(totals).toEqual({
      takenPence: 25400,
      feesPence: 448,
      feesUnknown: 1,
      refundedPence: 2000,
      keptPence: 22952,
    });
  });
});
