import { describe, expect, it } from "vitest";

import {
  awaitingDecision,
  dueDate,
  invoiceNumber,
  isChargeable,
  isOwed,
  partnerOwed,
  receiptReference,
  type PartnerJob,
} from "./supplier-money";

function job(overrides: Partial<PartnerJob>): PartnerJob {
  return {
    id: 1,
    reference: "J-000001",
    supplierReference: "TRIP-1",
    status: "completed",
    pickupAt: "2026-09-01T09:00:00.000Z",
    pickupAddress: "Heathrow Terminal 5",
    dropoffAddress: "Uxbridge",
    hours: null,
    pricePence: 6000,
    cancellationCharge: null,
    supplierPaymentId: null,
    supplierInvoiceId: null,
    ...overrides,
  };
}

describe("supplier money", () => {
  it("charges partners for completed, PNS and charged late cancellations", () => {
    expect(isChargeable(job({}))).toBe(true);
    expect(isChargeable(job({ status: "no_show" }))).toBe(true);
    expect(isChargeable(job({ status: "cancelled" }))).toBe(false);
    expect(
      isChargeable(job({ status: "cancelled", cancellationCharge: "charged" })),
    ).toBe(true);
    expect(
      isChargeable(job({ status: "cancelled", cancellationCharge: "not_charged" })),
    ).toBe(false);
    expect(isChargeable(job({ status: "on_board" }))).toBe(false);
  });

  it("owes what is chargeable, priced and not yet paid", () => {
    expect(isOwed(job({}))).toBe(true);
    expect(isOwed(job({ supplierPaymentId: 3 }))).toBe(false);
    expect(isOwed(job({ pricePence: null }))).toBe(false);
  });

  it("asks for a decision on every cancelled booking until there is one", () => {
    expect(awaitingDecision(job({ status: "cancelled" }))).toBe(true);
    expect(
      awaitingDecision(job({ status: "cancelled", cancellationCharge: "not_charged" })),
    ).toBe(false);
    expect(awaitingDecision(job({}))).toBe(false);
  });

  it("falls due the partner's terms after the pickup", () => {
    expect(dueDate(job({}), 30).toISOString()).toBe("2026-10-01T09:00:00.000Z");
    expect(dueDate(job({}), null).toISOString()).toBe("2026-09-01T09:00:00.000Z");
  });

  it("totals what is owed, overdue and not yet invoiced, up to a day", () => {
    const owed = partnerOwed(
      [
        job({ id: 1 }),
        job({ id: 2, pickupAt: "2026-10-03T09:00:00.000Z", supplierInvoiceId: 5 }),
        job({
          id: 3,
          status: "cancelled",
          cancellationCharge: "charged",
          pricePence: 3000,
        }),
        job({ id: 4, status: "cancelled" }),
        job({ id: 5, supplierPaymentId: 9 }),
        job({ id: 6, pickupAt: "2026-10-09T09:00:00.000Z" }),
      ],
      new Date("2026-10-06T23:00:00.000Z"),
      30,
      new Date("2026-10-06T12:00:00.000Z"),
    );
    expect(owed.owed.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(owed.totalPence).toBe(15000);
    expect(owed.overduePence).toBe(9000);
    expect(owed.uninvoiced).toBe(2);
    expect(owed.toDecide.map((item) => item.id)).toEqual([4]);
    expect(owed.netPence).toBe(15000);
  });

  it("takes the partner's open penalties off what they owe", () => {
    const owed = partnerOwed(
      [job({ id: 1 })],
      new Date("2026-10-06T23:00:00.000Z"),
      30,
      new Date("2026-10-06T12:00:00.000Z"),
      [
        {
          id: 3,
          jobId: 1,
          jobReference: "J-000001",
          supplierReference: "TRIP-1",
          penalisedAt: "2026-10-05T12:00:00.000Z",
          reason: "Driver late",
          amountPence: 1000,
          driverSharePence: 0,
        },
      ],
    );
    expect(owed).toMatchObject({
      totalPence: 6000,
      penaltiesPence: 1000,
      netPence: 5000,
    });
    expect(owed.penalties.map((penalty) => penalty.id)).toEqual([3]);
  });

  it("numbers invoices and receipts", () => {
    expect(invoiceNumber(7)).toBe("INV-000007");
    expect(receiptReference(7)).toBe("PR-000007");
  });
});
