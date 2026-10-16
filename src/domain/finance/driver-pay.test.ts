import { describe, expect, it } from "vitest";

import {
  cashHeldPence,
  isPayable,
  owedUpTo,
  paymentPeriod,
  paymentPeriodStart,
  paymentReference,
  payTotals,
  priceChangedSincePaid,
  routeText,
  type PayJob,
} from "./driver-pay";

function job(overrides: Partial<PayJob>): PayJob {
  return {
    id: 1,
    reference: "J-000001",
    status: "completed",
    pickupAt: "2026-10-01T09:00:00.000Z",
    pickupAddress: "Heathrow Terminal 5",
    dropoffAddress: "Uxbridge",
    hours: null,
    driverPricePence: 3500,
    paymentMethod: "web_prepaid",
    customerPricePence: 6000,
    driverPaymentId: null,
    driverPaidPricePence: null,
    ...overrides,
  };
}

describe("driver pay", () => {
  it("pays completed and PNS bookings that have a price and are not paid", () => {
    expect(isPayable(job({}))).toBe(true);
    expect(isPayable(job({ status: "no_show", driverPricePence: 1500 }))).toBe(true);
    expect(isPayable(job({ status: "on_board" }))).toBe(false);
    expect(isPayable(job({ status: "cancelled" }))).toBe(false);
    expect(isPayable(job({ driverPricePence: null }))).toBe(false);
    expect(isPayable(job({ driverPaymentId: 4 }))).toBe(false);
  });

  it("counts cash only where the passenger travelled and paid the driver", () => {
    expect(cashHeldPence(job({ paymentMethod: "cash" }))).toBe(6000);
    expect(cashHeldPence(job({ paymentMethod: "cash", status: "no_show" }))).toBe(0);
    expect(cashHeldPence(job({}))).toBe(0);
  });

  it("takes the cash a driver holds off what they are owed", () => {
    expect(
      payTotals([
        job({}),
        job({
          id: 2,
          paymentMethod: "cash",
          customerPricePence: 5000,
          driverPricePence: 3000,
        }),
      ]),
    ).toEqual({ earnedPence: 6500, cashPence: 5000, penaltiesPence: 0, netPence: 1500 });
    // More cash held than earned: the driver owes Cityline.
    expect(
      payTotals([job({ paymentMethod: "cash", customerPricePence: 9000 })]).netPence,
    ).toBe(-5500);
  });

  it("works out what is owed up to a chosen date, and what has no price yet", () => {
    const owed = owedUpTo(
      [
        job({ id: 1 }),
        job({ id: 2, driverPricePence: null }),
        job({ id: 3, pickupAt: "2026-10-09T09:00:00.000Z" }),
        job({ id: 4, driverPaymentId: 7 }),
        job({ id: 5, status: "driver_confirmed" }),
      ],
      new Date("2026-10-05T23:00:00.000Z"),
    );
    expect(owed.payable.map((item) => item.id)).toEqual([1]);
    expect(owed.missingPrice.map((item) => item.id)).toEqual([2]);
    expect(owed.netPence).toBe(3500);
  });

  it("takes the driver's share of a partner penalty off what they are owed", () => {
    const penalty = {
      id: 9,
      jobId: 1,
      jobReference: "J-000001",
      supplierReference: "TRIP-1",
      penalisedAt: "2026-10-03T12:00:00.000Z",
      reason: "Driver 20 minutes late",
      amountPence: 1000,
      driverSharePence: 500,
    };
    const owed = owedUpTo([job({ id: 1 })], new Date("2026-10-05T23:00:00.000Z"), [
      penalty,
    ]);
    expect(owed).toMatchObject({
      earnedPence: 3500,
      penaltiesPence: 500,
      netPence: 3000,
      penalties: [penalty],
    });
    // A penalty alone, with no bookings to pay: the driver owes Cityline.
    expect(payTotals([], [penalty]).netPence).toBe(-500);
  });

  it("notices a price changed after the booking was paid", () => {
    expect(
      priceChangedSincePaid(job({ driverPaymentId: 3, driverPaidPricePence: 3500 })),
    ).toBe(false);
    expect(
      priceChangedSincePaid(job({ driverPaymentId: 3, driverPaidPricePence: 4000 })),
    ).toBe(true);
  });

  it("names payments and routes plainly", () => {
    expect(paymentReference(12)).toBe("DP-000012");
    expect(routeText(job({}))).toBe("Heathrow Terminal 5 to Uxbridge");
    expect(routeText(job({ dropoffAddress: null, hours: 3 }))).toBe(
      "Heathrow Terminal 5 to hourly hire, 3 hours",
    );
  });
});

describe("a payment's period", () => {
  const start = (upTo: string, previousUpTo: string | null, firstBooking: string) =>
    paymentPeriodStart({ upTo, previousUpTo, firstBooking });

  it("runs from the day after the last payment, whatever days were worked", () => {
    expect(start("2026-10-25", "2026-10-13", "2026-10-17")).toBe("2026-10-14");
    // Across the end of a month.
    expect(start("2026-11-05", "2026-10-31", "2026-11-02")).toBe("2026-11-01");
  });

  it("starts a first payment on its first booking's day", () => {
    expect(start("2026-10-13", null, "2026-10-09")).toBe("2026-10-09");
  });

  it("reaches back to a booking paid late, so every booking is inside", () => {
    expect(start("2026-10-25", "2026-10-13", "2026-10-10")).toBe("2026-10-10");
    // Paid again after a void, up to the same day as another payment.
    expect(start("2026-10-13", null, "2026-10-09")).toBe("2026-10-09");
  });

  it("reads as dates, one date for one day", () => {
    const day = (iso: string) => new Date(`${iso}T11:00:00Z`);
    expect(paymentPeriod(day("2026-10-14"), day("2026-10-25"))).toBe(
      "14 Oct – 25 Oct 2026",
    );
    expect(paymentPeriod(day("2026-10-13"), day("2026-10-13"))).toBe("13 Oct 2026");
    expect(paymentPeriod(day("2026-12-28"), day("2027-01-03"))).toBe(
      "28 Dec 2026 – 3 Jan 2027",
    );
  });
});
