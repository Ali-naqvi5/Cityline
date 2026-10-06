import { describe, expect, it } from "vitest";

import { bookingMoney } from "./booking-money";

describe("what a booking makes", () => {
  it("keeps the whole price of a supplier job: partners take their cut first", () => {
    expect(bookingMoney({ customerPricePence: 6000, driverPricePence: 3500 })).toEqual({
      netPence: 6000,
      driverPricePence: 3500,
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
});
