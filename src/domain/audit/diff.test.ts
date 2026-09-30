import { describe, expect, it } from "vitest";

import { diffRecords, REDACTED } from "./diff";

describe("diffRecords", () => {
  it("lists only the fields that changed, ignoring timestamps", () => {
    expect(
      diffRecords(
        { id: 1, name: "A", status: "active", updatedAt: "x" },
        { id: 1, name: "A", status: "suspended", updatedAt: "y" },
      ),
    ).toEqual([{ field: "status", from: "active", to: "suspended" }]);
  });

  it("treats a populated and a bare reference to the same record as unchanged", () => {
    expect(diffRecords({ driver: 5 }, { driver: { id: 5, name: "D" } })).toEqual([]);
    expect(diffRecords({ driver: 5 }, { driver: { id: 6 } })).toEqual([
      { field: "driver", from: "5", to: "6" },
    ]);
  });

  it("records a new record's fields against nothing", () => {
    expect(diffRecords(null, { name: "New", notes: "" })).toEqual([
      { field: "name", from: null, to: "New" },
    ]);
  });

  it("treats an empty list as no value", () => {
    expect(diffRecords(null, { extras: [] })).toEqual([]);
    expect(diffRecords({ extras: [{ slug: "child-seat" }] }, { extras: [] })).toEqual([
      { field: "extras", from: '[{"slug":"child-seat"}]', to: null },
    ]);
  });

  it("says a redacted field changed without saying what it is", () => {
    expect(
      diffRecords({ bank: "sealed-a" }, { bank: "sealed-b" }, { redact: ["bank"] }),
    ).toEqual([{ field: "bank", from: REDACTED, to: REDACTED }]);
  });
});
