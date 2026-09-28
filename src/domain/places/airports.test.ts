import { describe, expect, it } from "vitest";

import { findForbiddenWords } from "@/domain/compliance/forbidden-words";
import { TABLE_CLASSES } from "@/domain/pricing/indicative";
import { AIRPORTS, airportBySlug } from "./airports";
import { introWordCount, meetsQualityBar } from "./types";

describe("the six London airports", () => {
  it("covers all six from the sitemap (§5)", () => {
    expect(AIRPORTS.map((a) => a.slug).sort()).toEqual([
      "gatwick",
      "heathrow",
      "london-city",
      "luton",
      "southend",
      "stansted",
    ]);
  });

  it("has a unique slug and IATA code for each", () => {
    expect(new Set(AIRPORTS.map((a) => a.slug)).size).toBe(AIRPORTS.length);
    expect(new Set(AIRPORTS.map((a) => a.code)).size).toBe(AIRPORTS.length);
  });

  it("finds an airport by slug and nothing by a bad one", () => {
    expect(airportBySlug("heathrow")?.code).toBe("LHR");
    expect(airportBySlug("nonsense")).toBeUndefined();
  });
});

describe("SEO-01 quality bar", () => {
  // The spec is blunt that publishing thin generated pages is the main SEO
  // risk in this plan, so every page is held to the bar in a test rather than
  // by assurance.
  for (const airport of AIRPORTS) {
    it(`${airport.name} clears it`, () => {
      // Internal links each page renders: 5 terminals/destinations links at
      // minimum, plus the other five airports, fleet, fares and help.
      const internalLinks = airport.destinations.length + AIRPORTS.length;
      const check = meetsQualityBar(airport, internalLinks, TABLE_CLASSES.length);

      expect(check.failures).toEqual([]);
      expect(check.passes).toBe(true);
    });

    it(`${airport.name} has at least 120 words of its own copy`, () => {
      expect(introWordCount(airport)).toBeGreaterThanOrEqual(120);
    });

    it(`${airport.name} has at least 3 specific FAQs`, () => {
      expect(airport.faqs.length).toBeGreaterThanOrEqual(3);
      // "Specific" means specific: the airport is named in its own questions.
      // Matched on the distinctive word rather than the full name, because
      // "London Southend" is written "Southend" in prose, as it should be.
      const distinctive = airport.name.split(" ").at(-1)!;
      const mentionsAirport = airport.faqs.some((faq) =>
        `${faq.question} ${faq.answer}`.includes(distinctive),
      );
      expect(mentionsAirport).toBe(true);
    });

    it(`${airport.name} gives a distance and a journey time for every destination`, () => {
      for (const destination of airport.destinations) {
        expect(destination.miles).toBeGreaterThan(0);
        expect(destination.offPeak).toMatch(/\d+–\d+ mins/);
        expect(destination.peak).toMatch(/\d+–\d+ mins/);
      }
    });
  }

  it("fails a page that is too thin, rather than waving it through", () => {
    const thin = { ...AIRPORTS[0]!, intro: ["Too short."], faqs: [] };

    const check = meetsQualityBar(thin, 2, 1);
    expect(check.passes).toBe(false);
    expect(check.failures).toHaveLength(4);
  });
});

describe("CMP-01 wording", () => {
  it("uses no forbidden wording anywhere in the airport copy", () => {
    for (const airport of AIRPORTS) {
      const everything = [
        airport.name,
        airport.fullName,
        airport.summary,
        ...airport.intro,
        ...airport.terminals.flatMap((t) => [t.name, t.operators ?? "", t.meetingPoint]),
        ...airport.destinations.map((d) => `${d.label} ${d.corridor}`),
        ...airport.faqs.flatMap((f) => [f.question, f.answer]),
      ].join(" ");

      expect(findForbiddenWords(everything)).toEqual([]);
    }
  });
});
