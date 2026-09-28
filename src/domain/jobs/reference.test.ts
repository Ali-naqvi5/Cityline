import { describe, expect, it } from "vitest";

import { formatJobReference, JOB_REFERENCE_PATTERN, jobSequenceOf } from "./reference";

describe("formatJobReference", () => {
  it("pads to six digits", () => {
    expect(formatJobReference(1)).toBe("J-000001");
    expect(formatJobReference(4271)).toBe("J-004271");
    expect(formatJobReference(999999)).toBe("J-999999");
  });

  it("widens rather than truncating past a million", () => {
    // Truncating would recycle references, and two jobs with one reference in
    // the TfL register is the worst outcome available here.
    expect(formatJobReference(1000000)).toBe("J-1000000");
    expect(JOB_REFERENCE_PATTERN.test(formatJobReference(1000000))).toBe(true);
  });

  it("refuses a sequence that is not a positive whole number", () => {
    expect(() => formatJobReference(0)).toThrow(RangeError);
    expect(() => formatJobReference(-1)).toThrow(RangeError);
    expect(() => formatJobReference(1.5)).toThrow(RangeError);
    expect(() => formatJobReference(Number.NaN)).toThrow(RangeError);
  });

  it("does not look like a booking reference", () => {
    // CL-7K4Q2P is quoted by customers, J-000001 by the office. Confusing the
    // two on a phone call is a real cost.
    expect(formatJobReference(1)).not.toMatch(/^CL-/);
  });
});

describe("jobSequenceOf", () => {
  it("reads the sequence back", () => {
    expect(jobSequenceOf("J-004271")).toBe(4271);
    expect(jobSequenceOf("J-1000000")).toBe(1000000);
  });

  it("rejects anything that is not a job reference", () => {
    for (const input of ["", "J-", "004271", "CL-7K4Q2P", "J-12345", "J-ABCDEF"]) {
      expect(jobSequenceOf(input), input).toBeNull();
    }
  });
});
