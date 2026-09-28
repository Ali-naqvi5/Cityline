import { describe, expect, it } from "vitest";

import { claimsUnsupportedCapability, findUnsupportedClaims } from "./unsupported-claims";

/**
 * The "design" strings below are the real phrasings from the supplied Stitch
 * exports. They are the copy this guard exists to stop reaching a page.
 */
describe("flight tracking claims are blocked", () => {
  const fromTheDesigns = [
    "Our dispatch team monitors flight BA 1392 via live radar.",
    "All flights are monitored in real time using live air traffic radar feeds.",
    "Free flight tracking on every booking.",
    "Automated flight monitoring keeps your driver in step with your flight.",
    "Your chauffeur's arrival time adjusts automatically at no extra charge.",
    "Flight Delay Protection included as standard.",
    "Full 60 minutes complimentary waiting time, tracked in real-time by flight radar.",
    "We track your flight so you never have to worry.",
  ];

  for (const copy of fromTheDesigns) {
    it(`rejects: ${copy.slice(0, 48)}…`, () => {
      expect(claimsUnsupportedCapability(copy)).toBe(true);
    });
  }

  it("says what to write instead", () => {
    const [hit] = findUnsupportedClaims("Our team monitors your flight via live radar.");

    expect(hit?.instead).toBeTruthy();
    expect(hit?.sentence).toContain("radar");
  });
});

describe("what the site is still allowed to say", () => {
  const allowed = [
    // The real service, described accurately.
    "Give us your flight number and our team checks the arrival time before sending your driver.",
    "Your free waiting time starts when your flight lands, not when you booked.",
    "Please give us your flight number so we can meet your flight.",
    "If your flight is delayed, call us and we will move the pickup.",
    "Flight number and airline are collected at booking.",
    "60 minutes of free waiting from the time you land.",
    // Denials must be writable.
    "We do not operate automatic flight tracking, and we do not claim to.",
    "We do not track your flight automatically.",
    "There is no flight monitoring — a person checks your arrival time.",
  ];

  for (const copy of allowed) {
    it(`allows: ${copy.slice(0, 48)}…`, () => {
      expect(findUnsupportedClaims(copy)).toEqual([]);
    });
  }
});

describe("sentence scoping", () => {
  it("does not let a denial elsewhere excuse a claim", () => {
    const text =
      "We do not track flights. Our system monitors your flight via live radar.";

    expect(claimsUnsupportedCapability(text)).toBe(true);
  });

  it("reports the offending sentence, not the whole document", () => {
    const [hit] = findUnsupportedClaims(
      "Welcome to Cityline. Flight Delay Protection is included. Book online.",
    );

    expect(hit?.sentence).toBe("Flight Delay Protection is included.");
  });

  it("is quiet on empty input", () => {
    expect(findUnsupportedClaims("")).toEqual([]);
  });
});
