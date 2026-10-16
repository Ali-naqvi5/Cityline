import { describe, expect, it } from "vitest";

import { bookingMoney, driverPriceLoss } from "./booking-money";

describe("what a booking makes", () => {
  it("keeps the whole price of a supplier job: partners take their cut first", () => {
    expect(bookingMoney({ customerPricePence: 6000, driverPricePence: 3500 })).toEqual({
      netPence: 6000,
      driverPricePence: 3500,
      penaltyPence: 0,
      profitPence: 2500,
    });
  });

  it("takes card fees off a website booking", () => {
    expect(
      bookingMoney({
        customerPricePence: 6000,
        paymentFeePence: 110,
        driverPricePence: 3500,
      }),
    ).toMatchObject({ netPence: 5890, profitPence: 2390 });
  });

  it("takes a refund off what the booking made", () => {
    expect(
      bookingMoney({
        customerPricePence: 6000,
        refundedPence: 1000,
        paymentFeePence: 110,
        driverPricePence: 3500,
      }),
    ).toMatchObject({ netPence: 4890, profitPence: 1390 });
  });

  it("does not guess the profit before the driver's price is written", () => {
    expect(bookingMoney({ customerPricePence: 6000 }).profitPence).toBeNull();
    expect(
      bookingMoney({ customerPricePence: 6000, driverPricePence: null }).profitPence,
    ).toBeNull();
  });

  it("shows a loss as a loss", () => {
    expect(
      bookingMoney({ customerPricePence: 3000, driverPricePence: 3500 }).profitPence,
    ).toBe(-500);
  });

  it("counts a driver paid nothing as a known price", () => {
    expect(
      bookingMoney({ customerPricePence: 3000, driverPricePence: 0 }).profitPence,
    ).toBe(3000);
  });

  it("takes a partner penalty off profit, less the part the driver bears", () => {
    // £20 booking, £15 driver, £10 penalty: a £5 loss.
    expect(
      bookingMoney({
        customerPricePence: 2000,
        driverPricePence: 1500,
        penaltyPence: 1000,
      }),
    ).toMatchObject({ penaltyPence: 1000, profitPence: -500 });
    // £5 of it passed to the driver: Cityline bears £5, and breaks even.
    expect(
      bookingMoney({
        customerPricePence: 2000,
        driverPricePence: 1500,
        penaltyPence: 1000,
        penaltyFromDriverPence: 500,
      }),
    ).toMatchObject({ penaltyPence: 500, profitPence: 0 });
  });
});

describe("the loss warning on a driver price", () => {
  it("says how much a driver price above the agreed price loses", () => {
    expect(driverPriceLoss(2000, 3000)).toBe(1000);
  });

  it("stays quiet at or below the agreed price, or with a price unknown", () => {
    expect(driverPriceLoss(2000, 2000)).toBeNull();
    expect(driverPriceLoss(2000, 1500)).toBeNull();
    expect(driverPriceLoss(2000, null)).toBeNull();
    expect(driverPriceLoss(null, 3000)).toBeNull();
  });
});
