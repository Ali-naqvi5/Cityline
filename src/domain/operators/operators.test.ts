import { describe, expect, it } from "vitest";

import { licensedFromText, operatorCheck } from "./operators";

const base = { name: "North Cars", licensedFrom: "tfl" };
const at = new Date("2026-10-20T09:00:00Z");

describe("who licensed an operator", () => {
  it("names TfL, or the council or Scottish authority", () => {
    expect(licensedFromText(base)).toBe("Transport for London");
    expect(
      licensedFromText({
        ...base,
        licensedFrom: "council",
        licensingAuthority: "Slough Borough Council",
      }),
    ).toBe("Slough Borough Council");
    expect(
      licensedFromText({
        ...base,
        licensedFrom: "scotland",
        licensingAuthority: "Glasgow City Council",
      }),
    ).toBe("Glasgow City Council (Scotland)");
  });
});

describe("whether a booking can go to an operator", () => {
  it("can, with a current licence on record", () => {
    expect(
      operatorCheck(
        { ...base, licenceNumber: "1234", licenceExpiresAt: "2027-03-01T12:00:00Z" },
        at,
      ),
    ).toEqual({ blocks: [], warnings: [] });
  });

  it("cannot once their licence has run out, or they have left", () => {
    expect(
      operatorCheck(
        { ...base, licenceNumber: "1234", licenceExpiresAt: "2026-10-19T12:00:00Z" },
        at,
      ).blocks,
    ).toEqual(["Operator licence expired on 19 Oct 2026."]);
    expect(
      operatorCheck({ ...base, dateLeft: "2026-10-01T12:00:00Z" }, at).blocks,
    ).toEqual(["Left on 1 Oct 2026."]);
  });

  it("only warns when the licence details are missing", () => {
    expect(operatorCheck(base, at)).toEqual({
      blocks: [],
      warnings: ["No licence number on record."],
    });
    expect(operatorCheck({ ...base, licenceNumber: "1234" }, at).warnings).toEqual([
      "No licence expiry on record.",
    ]);
  });
});
