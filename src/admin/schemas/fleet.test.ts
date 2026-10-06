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
  nationalInsuranceNumber: "",
  status: "active",
  startDate: "",
  endDate: "",
  leftReason: "",
  leftForConduct: false,
  tflToldAt: "",
  whatsappConsent: true,
  notes: "",
};

describe("driverSchema", () => {
  it("accepts a valid driver and stores the phone as +44", () => {
    const parsed = driverSchema.parse(driver);
    const data = driverData(parsed);
    expect(data.phone).toBe("+447700900456");
    expect(data.whatsappConsentAt).toBeTruthy();
  });

  it("records no pay or employment terms: pay is agreed per booking", () => {
    const data = driverData(driverSchema.parse(driver));
    expect(Object.keys(data)).not.toEqual(
      expect.arrayContaining(["payRule", "employmentType", "showPayInMessages"]),
    );
  });

  it("keeps the original consent date when the form is saved again", () => {
    const data = driverData(driverSchema.parse(driver), "2026-01-01T00:00:00.000Z");
    expect(data.whatsappConsentAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("refuses a phone number that cannot be dialled", () => {
    const result = driverSchema.safeParse({ ...driver, phone: "123" });
    expect(result.success).toBe(false);
  });

  it("stores a National Insurance number without spaces, and refuses a bad one", () => {
    const data = driverData(
      driverSchema.parse({ ...driver, nationalInsuranceNumber: "ab 12 34 56 c" }),
    );
    expect(data.nationalInsuranceNumber).toBe("AB123456C");
    expect(
      driverSchema.safeParse({ ...driver, nationalInsuranceNumber: "QQ123456C" }).success,
    ).toBe(false);
  });

  it("needs the date a driver stopped being available once they have left", () => {
    const result = driverSchema.safeParse({ ...driver, status: "left" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["endDate"]);
  });

  it("keeps why a driver left, and TfL's notice, only for a driver who has left", () => {
    const left = driverData(
      driverSchema.parse({
        ...driver,
        status: "left",
        endDate: "2026-09-30",
        leftReason: "Moved away",
        leftForConduct: true,
        tflToldAt: "2026-10-02",
      }),
    );
    expect(left).toMatchObject({ leftReason: "Moved away", leftForConduct: true });
    expect(left.tflToldAt).toBeTruthy();

    const back = driverData(
      driverSchema.parse({ ...driver, leftReason: "Moved away", leftForConduct: true }),
    );
    expect(back).toMatchObject({
      leftReason: null,
      leftForConduct: false,
      tflToldAt: null,
    });
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
  it("records the supplier without any commission: partners take their cut first", () => {
    const data = supplierData(
      supplierSchema.parse({
        name: "Trip.com",
        paymentTermsDays: "30",
        contactName: "",
        email: "",
        phone: "",
        dashboardUrl: "https://example.com",
        billingAddress: "",
        notes: "",
        active: true,
      }),
    );
    expect(data).toMatchObject({ name: "Trip.com", paymentTermsDays: 30 });
    expect(data).not.toHaveProperty("defaultCommissionBp");
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
