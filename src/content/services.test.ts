import { describe, expect, it } from "vitest";

import { findForbiddenWords } from "@/domain/compliance/forbidden-words";
import { SERVICES, serviceBySlug } from "./services";

describe("services", () => {
  it("covers the phase-1 services from the sitemap (§5)", () => {
    expect(SERVICES.map((s) => s.slug).sort()).toEqual([
      "airport-transfers",
      "corporate",
      "executive-chauffeur",
      "hourly-hire",
      "minibus-hire",
      "seaport-transfers",
      "station-transfers",
    ]);
  });

  it("has a unique slug for each", () => {
    expect(new Set(SERVICES.map((s) => s.slug)).size).toBe(SERVICES.length);
  });

  it("finds a service by slug and nothing by a bad one", () => {
    expect(serviceBySlug("hourly-hire")?.name).toBe("Hourly hire");
    expect(serviceBySlug("nonsense")).toBeUndefined();
  });

  it("keeps stations as one page, not nine", () => {
    // §5 makes the same call for areas: "one page, not nine near-identical
    // ones". Nine pages differing only by a station name is the thin-content
    // pattern the spec names as the main SEO risk in this plan.
    const stations = SERVICES.find((s) => s.slug === "station-transfers");

    expect(stations).toBeDefined();
    expect(stations?.places?.items.length).toBeGreaterThanOrEqual(9);
    expect(SERVICES.filter((s) => s.slug.startsWith("station"))).toHaveLength(1);
  });
});

describe("every service page has enough to justify existing (SEO-01)", () => {
  for (const service of SERVICES) {
    it(`${service.name} has 120+ words of its own copy`, () => {
      const words = service.intro.join(" ").trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(120);
    });

    it(`${service.name} has at least 3 specific FAQs`, () => {
      expect(service.faqs.length).toBeGreaterThanOrEqual(3);
      for (const faq of service.faqs) {
        expect(faq.question.length).toBeGreaterThan(10);
        expect(faq.answer.length).toBeGreaterThan(60);
      }
    });

    it(`${service.name} has three highlights`, () => {
      expect(service.highlights).toHaveLength(3);
    });
  }
});

describe("CMP-01 wording", () => {
  it("uses no forbidden wording anywhere in the service copy", () => {
    for (const service of SERVICES) {
      const everything = [
        service.name,
        service.title,
        service.summary,
        ...service.intro,
        ...service.highlights.flatMap((h) => [h.title, h.body]),
        ...(service.places?.items.map((i) => `${i.label} ${i.note ?? ""}`) ?? []),
        service.places?.heading ?? "",
        service.places?.blurb ?? "",
        ...service.faqs.flatMap((f) => [f.question, f.answer]),
      ].join(" ");

      expect(findForbiddenWords(everything)).toEqual([]);
    }
  });
});
