import { describe, expect, it } from "vitest";

import { CAPABILITIES, can, ROLES, staffCan } from "./permissions";

describe("the permission matrix", () => {
  it("gives the owner everything", () => {
    for (const capability of CAPABILITIES) expect(can("owner", capability)).toBe(true);
  });

  it("keeps company finance and bank details away from controllers", () => {
    for (const capability of [
      "finance.jobs",
      "payments.view",
      "refunds.issue",
      "driverPay.view",
      "supplierMoney.view",
      "expenses.view",
      "reports.financial",
      "drivers.bankDetails",
      "staff.manage",
    ] as const) {
      expect(can("controller", capability)).toBe(false);
    }
    expect(can("controller", "jobs.dispatch")).toBe(true);
    expect(can("controller", "tfl.register")).toBe(true);
  });

  it("gives accounts the money but no dispatch, editing or bank details", () => {
    expect(can("accounts", "refunds.issue")).toBe(true);
    expect(can("accounts", "finance.jobs")).toBe(true);
    expect(can("accounts", "jobs.view")).toBe(true);
    for (const capability of [
      "jobs.edit",
      "jobs.dispatch",
      "bookings.amend",
      "drivers.edit",
      "drivers.bankDetails",
      "staff.manage",
    ] as const) {
      expect(can("accounts", capability)).toBe(false);
    }
  });

  it("gives editors content and nothing operational", () => {
    expect(can("editor", "content.manage")).toBe(true);
    expect(can("editor", "jobs.view")).toBe(false);
    expect(can("editor", "customers.view")).toBe(false);
  });

  it("keeps bank details to the owner alone", () => {
    expect(ROLES.filter((role) => can(role, "drivers.bankDetails"))).toEqual(["owner"]);
  });

  it("refuses an unknown role", () => {
    expect(can("admin", "dashboard")).toBe(false);
    expect(can(undefined, "dashboard")).toBe(false);
  });
});

describe("staffCan", () => {
  it("refuses a missing or deactivated user", () => {
    expect(staffCan(null, "dashboard")).toBe(false);
    expect(staffCan({ id: 1, role: "owner", active: false }, "dashboard")).toBe(false);
  });

  it("follows the matrix for an active user", () => {
    expect(staffCan({ id: 1, role: "owner", active: true }, "audit.view")).toBe(true);
    expect(staffCan({ id: 2, role: "editor", active: true }, "audit.view")).toBe(false);
  });
});
