import { describe, expect, it } from "vitest";

import { financeOverview, type OverviewJob } from "./overview";

function job(overrides: Partial<OverviewJob>): OverviewJob {
  return {
    status: "completed",
    source: "website",
    customerPricePence: 6000,
    driverPricePence: 3500,
    paymentFeePence: 120,
    cancellationCharge: null,
    driverPaymentId: null,
    supplierPaymentId: null,
    ...overrides,
  };
}

describe("the accounts overview", () => {
  const overview = financeOverview([
    job({ driverPaymentId: 1 }),
    job({ source: "supplier", paymentFeePence: 0, supplierPaymentId: 2 }),
    job({
      source: "supplier",
      status: "no_show",
      paymentFeePence: 0,
      driverPricePence: 1500,
    }),
    // A late cancellation the partner pays for: income, no driver cost.
    job({
      source: "supplier",
      status: "cancelled",
      cancellationCharge: "charged",
      paymentFeePence: 0,
      driverPricePence: null,
    }),
    // Cancelled with no charge, and work not done yet: not counted.
    job({ source: "supplier", status: "cancelled", cancellationCharge: "not_charged" }),
    job({ status: "driver_confirmed" }),
    // Done, but no driver price yet.
    job({ source: "phone", driverPricePence: null, paymentFeePence: 0 }),
  ]);

  it("shows how much of what drivers earned is paid", () => {
    expect(overview.drivers).toEqual({ earnedPence: 8500, paidPence: 3500, unpriced: 1 });
  });

  it("shows how much of what partners owe has come in", () => {
    expect(overview.suppliers).toEqual({ owedPence: 18000, receivedPence: 6000 });
  });

  it("works out profit as prices less driver prices less card fees", () => {
    expect(overview.profit).toEqual({
      incomePence: 30000,
      refundsPence: 0,
      driverPence: 8500,
      feesPence: 120,
      expensesPence: 0,
      profitPence: 21380,
      margin: 21380 / 30000,
    });
  });

  it("takes Cityline's own expenses off the profit too", () => {
    const withExpenses = financeOverview([job({})], 1000);
    expect(withExpenses.profit).toMatchObject({
      incomePence: 6000,
      expensesPence: 1000,
      profitPence: 6000 - 3500 - 120 - 1000,
    });
  });

  it("takes refunds off the work they were made on, and margin is on what was kept", () => {
    const refunded = financeOverview([
      job({ refundedPence: 1000 }),
      // A cancelled booking earned nothing, so its refund changes nothing.
      job({ status: "cancelled", refundedPence: 6000 }),
    ]);
    expect(refunded.profit).toMatchObject({
      incomePence: 6000,
      refundsPence: 1000,
      profitPence: 6000 - 1000 - 3500 - 120,
      margin: (6000 - 1000 - 3500 - 120) / 5000,
    });
  });

  it("has no margin with no income", () => {
    expect(financeOverview([]).profit.margin).toBe(null);
  });
});
