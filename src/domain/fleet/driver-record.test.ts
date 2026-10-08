import { describe, expect, it } from "vitest";

import {
  conductNotice,
  formatNiNumber,
  heldOffline,
  isValidNiNumber,
  keepRecordUntil,
  missingParticulars,
  normaliseNiNumber,
  recordRequired,
  type DriverRecordInput,
} from "./driver-record";

const complete: DriverRecordInput = {
  firstName: "Sam",
  lastName: "Taylor",
  address: "10 Wren Avenue, Uxbridge UB8 1AA",
  dateOfBirth: "1985-04-02T11:00:00.000Z",
  nationalInsuranceNumber: "AB123456C",
  photo: 12,
  startDate: "2026-01-05T12:00:00.000Z",
  endDate: null,
  status: "active",
  documents: [
    { type: "dvla_licence", file: 3 },
    { type: "phv_licence", file: { id: 4 } },
  ],
};

describe("National Insurance numbers", () => {
  it("accepts HMRC's format, with or without spaces", () => {
    expect(isValidNiNumber("AB 12 34 56 C")).toBe(true);
    expect(isValidNiNumber("ab123456d")).toBe(true);
    expect(normaliseNiNumber(" ab 12 34 56 c ")).toBe("AB123456C");
    expect(formatNiNumber("ab123456c")).toBe("AB 12 34 56 C");
  });

  it("refuses numbers HMRC never issues", () => {
    expect(isValidNiNumber("QQ123456C")).toBe(false); // the specimen number
    expect(isValidNiNumber("GB123456A")).toBe(false);
    expect(isValidNiNumber("AO123456A")).toBe(false);
    expect(isValidNiNumber("AB123456E")).toBe(false);
    expect(isValidNiNumber("AB12345C")).toBe(false);
  });
});

describe("the TfL driver record", () => {
  it("is complete with every particular", () => {
    expect(missingParticulars(complete)).toEqual([]);
  });

  it("lists what is missing, in the handbook's order", () => {
    expect(
      missingParticulars({
        ...complete,
        address: " ",
        nationalInsuranceNumber: null,
        photo: null,
        documents: [
          { type: "phv_licence", file: null },
          { type: "dbs", file: 9 },
        ],
      }),
    ).toEqual(["address", "niNumber", "drivingLicenceCopy", "phvLicenceCopy", "photo"]);
  });

  it("keeps an outsourced driver's copies and photograph offline, not missing", () => {
    const outsourced = {
      ...complete,
      engagement: "outsourced",
      photo: null,
      documents: [
        { type: "phv_licence", file: null },
        { type: "dvla_licence", file: null },
      ],
    };
    expect(missingParticulars(outsourced)).toEqual([]);
    expect(heldOffline(outsourced)).toEqual([
      "drivingLicenceCopy",
      "phvLicenceCopy",
      "photo",
    ]);
    expect(heldOffline(complete)).toEqual([]);
    // The rest of the record is still needed here.
    expect(missingParticulars({ ...outsourced, dateOfBirth: null })).toEqual([
      "dateOfBirth",
    ]);
  });

  it("needs the date a driver stopped, once they have left", () => {
    expect(missingParticulars({ ...complete, status: "left" })).toEqual(["stoppedOn"]);
    expect(
      missingParticulars({
        ...complete,
        status: "left",
        endDate: "2026-09-30T11:00:00.000Z",
      }),
    ).toEqual([]);
  });

  it("is kept for 12 months after the driver stops", () => {
    expect(keepRecordUntil("2026-09-30T11:00:00.000Z")).toBe("2027-09-30");
    const left = { status: "left", endDate: "2025-10-05T11:00:00.000Z" };
    expect(recordRequired(left, new Date("2026-10-05T09:00:00Z"))).toBe(true);
    expect(recordRequired(left, new Date("2026-10-06T09:00:00Z"))).toBe(false);
    expect(recordRequired({ status: "left" }, new Date())).toBe(true);
    expect(recordRequired({ status: "suspended" }, new Date())).toBe(true);
  });
});

describe("telling TfL about a driver stopped for their conduct", () => {
  const now = new Date("2026-10-05T09:00:00Z");
  const stopped = {
    status: "left",
    endDate: "2026-09-28T11:00:00.000Z",
    leftForConduct: true,
  };

  it("is due 14 days after they stopped", () => {
    expect(conductNotice(stopped, now)).toEqual({ due: "2026-10-12", overdue: false });
    expect(conductNotice(stopped, new Date("2026-10-13T09:00:00Z"))?.overdue).toBe(true);
  });

  it("is no longer owed once sent, or when conduct was not the reason", () => {
    expect(conductNotice({ ...stopped, tflToldAt: "2026-10-01T11:00:00Z" }, now)).toBe(
      null,
    );
    expect(conductNotice({ ...stopped, leftForConduct: false }, now)).toBe(null);
    expect(conductNotice({ ...stopped, status: "active" }, now)).toBe(null);
  });
});
