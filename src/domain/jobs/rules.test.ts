import { describe, expect, it } from "vitest";

import {
  changedDetails,
  lockedFieldViolations,
  normaliseSupplierReference,
  staffCreateProblems,
} from "./rules";

const websiteJob = {
  locked: true,
  customerPricePence: 6800,
  leadName: "Aisha Rahman",
  leadPhone: "+447700900123",
  pickupAddress: "Heathrow Terminal 5",
  dropoffAddress: "Uxbridge",
  viaStops: [{ id: "a1", address: "Hayes" }],
  driverNotes: "",
};

describe("lockedFieldViolations", () => {
  it("refuses changing a website job's price, customer or route", () => {
    expect(lockedFieldViolations(websiteJob, { customerPricePence: 5000 })).toEqual([
      "customerPricePence",
    ]);
    expect(lockedFieldViolations(websiteJob, { pickupAddress: "Gatwick" })).toEqual([
      "pickupAddress",
    ]);
    expect(lockedFieldViolations(websiteJob, { leadName: "Someone else" })).toEqual([
      "leadName",
    ]);
  });

  it("refuses changing how a website job was paid", () => {
    expect(
      lockedFieldViolations(
        { ...websiteJob, paymentMethod: "web_prepaid" },
        { paymentMethod: "cash" },
      ),
    ).toEqual(["paymentMethod"]);
  });

  it("allows operational fields and unchanged values", () => {
    expect(
      lockedFieldViolations(websiteJob, { driverNotes: "Gate 4", status: "assigned" }),
    ).toEqual([]);
    expect(lockedFieldViolations(websiteJob, { customerPricePence: 6800 })).toEqual([]);
    // Payload re-sends arrays with fresh ids; the addresses are what matter.
    expect(
      lockedFieldViolations(websiteJob, { viaStops: [{ id: "b2", address: "Hayes" }] }),
    ).toEqual([]);
  });

  it("does not apply to jobs that are not locked", () => {
    expect(
      lockedFieldViolations({ ...websiteJob, locked: false }, { customerPricePence: 1 }),
    ).toEqual([]);
  });
});

describe("staffCreateProblems", () => {
  it("refuses a website job created by staff", () => {
    expect(staffCreateProblems({ source: "website" })).toHaveProperty("source");
  });

  it("needs a supplier and its reference for a supplier job", () => {
    expect(Object.keys(staffCreateProblems({ source: "supplier" }))).toEqual([
      "supplier",
      "supplierReference",
    ]);
    expect(
      staffCreateProblems({
        source: "supplier",
        supplier: 3,
        supplierReference: "TRIP-99",
      }),
    ).toEqual({});
  });

  it("accepts a phone job with nothing extra", () => {
    expect(staffCreateProblems({ source: "phone" })).toEqual({});
  });
});

describe("normaliseSupplierReference", () => {
  it("compares references without case or spaces around them", () => {
    expect(normaliseSupplierReference("  trip-123a ")).toBe("TRIP-123A");
  });
});

describe("changedDetails", () => {
  const done = {
    status: "completed",
    pickupAddress: "Heathrow Terminal 5",
    extras: [{ id: "x1", slug: "child-seat", quantity: 1, unitPricePence: 0 }],
    supplier: 3,
    driverPricePence: 4000,
  };

  it("names the booking details a change would alter", () => {
    expect(changedDetails(done, { ...done, pickupAddress: "Gatwick" })).toEqual([
      "pickupAddress",
    ]);
    expect(
      changedDetails(done, {
        ...done,
        extras: [{ id: "y2", slug: "child-seat", quantity: 2, unitPricePence: 0 }],
      }),
    ).toEqual(["extras"]);
  });

  it("leaves the driver price and unchanged details alone", () => {
    expect(changedDetails(done, { ...done, driverPricePence: 3500 })).toEqual([]);
    // Fresh row ids and a related record as an object are not changes.
    expect(
      changedDetails(done, {
        ...done,
        extras: [{ id: "z3", slug: "child-seat", quantity: 1, unitPricePence: 0 }],
        supplier: { id: 3, name: "Trip.com" },
      }),
    ).toEqual([]);
  });
});
