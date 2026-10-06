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
      driverPence: 8500,
      feesPence: 120,
      profitPence: 21380,
      margin: 21380 / 30000,
    });
  });

  it("has no margin with no income", () => {
    expect(financeOverview([]).profit.margin).toBe(null);
  });
});
