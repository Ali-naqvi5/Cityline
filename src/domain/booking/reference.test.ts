import { describe, expect, it } from "vitest";

import {
  REFERENCE_PATTERN,
  formatReferenceForSpeech,
  generateReference,
  normaliseReference,
} from "./reference";

describe("generateReference", () => {
  it("produces references in the CL-XXXXXX format", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateReference()).toMatch(REFERENCE_PATTERN);
    }
  });

  it("never emits the letters that are misread as digits", () => {
    // Only the generated body is checked: the fixed "CL-" prefix contains an L
    // of its own, which is not a character anyone has to transcribe correctly.
    const bodies = Array.from({ length: 1000 }, () => generateReference().slice(3));

    // I, L and O are excluded by the alphabet; U so a reference cannot swear.
    expect(bodies.join("")).not.toMatch(/[ILOU]/);
  });

  it("does not repeat itself", () => {
    const references = new Set(Array.from({ length: 500 }, generateReference));

    expect(references.size).toBe(500);
  });
});

describe("normaliseReference", () => {
  it("accepts the reference exactly as printed", () => {
    expect(normaliseReference("CL-7K4Q2P")).toBe("CL-7K4Q2P");
  });

  it("forgives how people retype it", () => {
    expect(normaliseReference("cl-7k4q2p")).toBe("CL-7K4Q2P");
    expect(normaliseReference("  CL-7K4Q2P  ")).toBe("CL-7K4Q2P");
    expect(normaliseReference("CL 7K4 Q2P")).toBe("CL-7K4Q2P");
    expect(normaliseReference("7K4Q2P")).toBe("CL-7K4Q2P");
    expect(normaliseReference("CL7K4Q2P")).toBe("CL-7K4Q2P");
    expect(normaliseReference("CL-7K4-Q2P")).toBe("CL-7K4Q2P");
  });

  it("applies Crockford's substitutions for characters that look alike", () => {
    // Someone reading CL-7K4Q2P off a screen may type O for zero or I for one.
    expect(normaliseReference("CL-7K4Q2P")).toBe("CL-7K4Q2P");
    expect(normaliseReference("CL-0AB1CD")).toBe("CL-0AB1CD");
    expect(normaliseReference("CL-OAB1CD")).toBe("CL-0AB1CD");
    expect(normaliseReference("CL-0ABICD")).toBe("CL-0AB1CD");
    expect(normaliseReference("CL-0ABLCD")).toBe("CL-0AB1CD");
    expect(normaliseReference("cl-oablcd")).toBe("CL-0AB1CD");
  });

  it("rejects anything that is not one of our references", () => {
    expect(normaliseReference("")).toBeNull();
    expect(normaliseReference("CL-")).toBeNull();
    expect(normaliseReference("CL-7K4Q2")).toBeNull(); // too short
    expect(normaliseReference("CL-7K4Q2PX")).toBeNull(); // too long
    expect(normaliseReference("CL-7K4Q2U")).toBeNull(); // U is not in the alphabet
    expect(normaliseReference("CL-7K4Q2!")).toBeNull();
    expect(normaliseReference("not a reference")).toBeNull();
  });

  it("round-trips anything it generates", () => {
    for (let i = 0; i < 200; i++) {
      const reference = generateReference();

      expect(normaliseReference(reference)).toBe(reference);
      expect(normaliseReference(reference.toLowerCase())).toBe(reference);
    }
  });
});

describe("formatReferenceForSpeech", () => {
  it("breaks the body into two groups of three", () => {
    expect(formatReferenceForSpeech("CL-7K4Q2P")).toBe("CL-7K4 Q2P");
  });
});
