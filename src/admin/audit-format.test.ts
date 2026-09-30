import { describe, expect, it } from "vitest";

import { REDACTED } from "@/domain/audit/diff";

import { auditFieldLabel, auditValue } from "./audit-format";

describe("audit log values", () => {
  it("labels fields without their storage units", () => {
    expect(auditFieldLabel("payFixedPence")).toBe("pay fixed");
    expect(auditFieldLabel("defaultCommissionBp")).toBe("default commission");
    expect(auditFieldLabel("bankAccountLast4")).toBe("bank account last4");
  });

  it("shows money, percentages and yes/no as staff would say them", () => {
    expect(auditValue("customerPricePence", "5000")).toBe("£50.00");
    expect(auditValue("defaultCommissionBp", "1800")).toBe("18%");
    expect(auditValue("defaultCommissionBp", "1250")).toBe("12.5%");
    expect(auditValue("active", "true")).toBe("Yes");
    expect(auditValue("isTest", "false")).toBe("No");
  });

  it("shows timestamps in London time", () => {
    expect(auditValue("expiresAt", "2026-11-29T23:59:00.000Z")).toBe(
      "29 Nov 2026, 23:59",
    );
    // 22:59 UTC in October is 23:59 in London (BST).
    expect(auditValue("expiresAt", "2026-10-06T22:59:00.000Z")).toBe("6 Oct 2026, 23:59");
  });

  it("shows references as record numbers and uploads as a file", () => {
    expect(auditValue("driver", "5")).toBe("#5");
    expect(auditValue("drivers", "[5,7]")).toBe("#5, #7");
    expect(auditValue("file", "11")).toBe("uploaded file");
  });

  it("reads codes as words and empty lists as empty", () => {
    expect(auditValue("employmentType", "self_employed")).toBe("self employed");
    expect(auditValue("extras", "[]")).toBeNull();
    expect(auditValue("extras", '[{"slug":"child-seat"}]')).toBe('{"slug":"child-seat"}');
  });

  it("keeps hidden values hidden and plain text as it is", () => {
    expect(auditValue("bankDetailsSealed", REDACTED)).toBe(REDACTED);
    expect(auditValue("internalNotes", "Checked by the office")).toBe(
      "Checked by the office",
    );
    expect(auditValue("registration", "AB12CDE")).toBe("AB12CDE");
    expect(auditValue("notes", null)).toBeNull();
  });
});
