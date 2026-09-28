import { describe, expect, it } from "vitest";

import { findForbiddenWords } from "@/domain/compliance/forbidden-words";
import { TABLE_CLASSES } from "@/domain/pricing/indicative";
import { SEAPORTS, seaportBySlug } from "./seaports";
import { introWordCount, meetsQualityBar } from "./types";

describe("the seaports", () => {
  it("covers the ports in the sitemap (§5)", () => {
    expect(SEAPORTS.map((p) => p.slug).sort()).toEqual([
      "dover",
      "harwich",
      "portsmouth",
      "southampton",
      "tilbury",
    ]);
  });

  it("has a unique slug for each", () => {
    expect(new Set(SEAPORTS.map((p) => p.slug)).size).toBe(SEAPORTS.length);
  });

  it("finds a port by slug and nothing by a bad one", () => {
    expect(seaportBySlug("tilbury")?.postcode).toBe("RM18");
    expect(seaportBySlug("nonsense")).toBeUndefined();
  });

  it("puts Tilbury closest to London, as it is", () => {
    const nearest = [...SEAPORTS].sort(
      (a, b) => a.milesFromCentralLondon - b.milesFromCentralLondon,
    )[0];
    expect(nearest?.slug).toBe("tilbury");
  });
});

describe("SEO-01 quality bar", () => {
  for (const port of SEAPORTS) {
    it(`${port.name} clears it`, () => {
      const internalLinks = port.destinations.length + SEAPORTS.length;
      const check = meetsQualityBar(port, internalLinks, TABLE_CLASSES.length);

      expect(check.failures).toEqual([]);
    });

    it(`${port.name} has at least 120 words and 3 FAQs`, () => {
      expect(introWordCount(port)).toBeGreaterThanOrEqual(120);
      expect(port.faqs.length).toBeGreaterThanOrEqual(3);
    });

    it(`${port.name} gives a distance and journey time for every destination`, () => {
      for (const destination of port.destinations) {
        expect(destination.miles).toBeGreaterThan(0);
        expect(destination.offPeak).toMatch(/\d+–\d+ mins/);
        expect(destination.peak).toMatch(/\d+–\d+ mins/);
      }
    });
  }
});

describe("CMP-01 wording", () => {
  it("uses no forbidden wording anywhere in the seaport copy", () => {
    for (const port of SEAPORTS) {
      const everything = [
        port.name,
        port.fullName,
        port.summary,
        ...port.intro,
        ...port.terminals.flatMap((t) => [t.name, t.operators ?? "", t.meetingPoint]),
        ...port.destinations.map((d) => `${d.label} ${d.corridor}`),
        ...port.faqs.flatMap((f) => [f.question, f.answer]),
      ].join(" ");

      expect(findForbiddenWords(everything)).toEqual([]);
    }
  });
});
