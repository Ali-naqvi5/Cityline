import { describe, expect, it } from "vitest";

import {
  documentSchema,
  driverData,
  driverSchema,
  expiryToIso,
  supplierData,
  supplierSchema,
  vehicleSchema,
} from "./fleet";

const driver = {
  firstName: "Sam",
  lastName: "Driver",
  phone: "07700 900456",
  email: "",
  address: "",
  dateOfBirth: "1985-06-01",
  status: "active",
  employmentType: "self_employed",
  startDate: "",
  endDate: "",
  payRule: "fixed",
  payFixed: "35.50",
  payPercent: "",
  showPayInMessages: "default",
  whatsappConsent: true,
  notes: "",
};

describe("driverSchema", () => {
  it("accepts a valid driver and stores pay in pence and the phone as +44", () => {
    const parsed = driverSchema.parse(driver);
    const data = driverData(parsed);
    expect(data.phone).toBe("+447700900456");
    expect(data.payFixedPence).toBe(3550);
    expect(data.payPercentBp).toBeNull();
    expect(data.whatsappConsentAt).toBeTruthy();
  });

  it("keeps the original consent date when the form is saved again", () => {
    const data = driverData(driverSchema.parse(driver), "2026-01-01T00:00:00.000Z");
    expect(data.whatsappConsentAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("refuses a phone number that cannot be dialled", () => {
    const result = driverSchema.safeParse({ ...driver, phone: "123" });
    expect(result.success).toBe(false);
  });

  it("needs a percentage for a percentage pay rule, and stores it in basis points", () => {
    expect(
      driverSchema.safeParse({ ...driver, payRule: "percent", payPercent: "" }).success,
    ).toBe(false);
    const data = driverData(
      driverSchema.parse({ ...driver, payRule: "percent", payPercent: "70" }),
    );
    expect(data.payPercentBp).toBe(7000);
    expect(data.payFixedPence).toBeNull();
  });
});

describe("vehicleSchema", () => {
  it("refuses a class that does not exist", () => {
    const result = vehicleSchema.safeParse({
      registration: "AB12 CDE",
      make: "Toyota",
      model: "Prius",
      colour: "Black",
      vehicleClassSlug: "tank",
      seats: "4",
      ownership: "driver",
      status: "active",
      drivers: [],
      notes: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("supplierSchema", () => {
  it("stores commission in basis points", () => {
    const data = supplierData(
      supplierSchema.parse({
        name: "Trip.com",
        commissionPercent: "18",
        paymentTermsDays: "30",
        contactName: "",
        email: "",
        phone: "",
        dashboardUrl: "https://example.com",
        notes: "",
        active: true,
      }),
    );
    expect(data.defaultCommissionBp).toBe(1800);
  });
});

describe("documentSchema", () => {
  const schema = documentSchema("driver");

  it("needs an expiry for a licence and a number for a PHV licence", () => {
    const result = schema.safeParse({
      type: "phv_licence",
      number: "",
      issuedAt: "",
      expiresAt: "",
      checked: true,
      notes: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toContain("expiresAt");
      expect(paths).toContain("number");
    }
  });

  it("lets right to work have no expiry", () => {
    expect(
      schema.safeParse({
        type: "right_to_work",
        number: "",
        issuedAt: "",
        expiresAt: "",
        checked: true,
        notes: "",
      }).success,
    ).toBe(true);
  });

  it("refuses a vehicle document type for a driver", () => {
    expect(
      schema.safeParse({
        type: "mot",
        number: "",
        issuedAt: "",
        expiresAt: "2027-01-01",
        checked: false,
        notes: "",
      }).success,
    ).toBe(false);
  });
});

describe("expiryToIso", () => {
  it("keeps a document valid to the end of its expiry day, London time", () => {
    expect(expiryToIso("2026-12-14")).toBe("2026-12-14T23:59:00.000Z");
    expect(expiryToIso("2026-07-14")).toBe("2026-07-14T22:59:00.000Z");
  });
});
