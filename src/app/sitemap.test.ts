import { afterEach, describe, expect, it, vi } from "vitest";

import { AIRPORTS } from "@/domain/places/airports";
import { SEAPORTS } from "@/domain/places/seaports";

import sitemap from "./sitemap";

const paths = () => sitemap().map((entry) => new URL(entry.url).pathname);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sitemap", () => {
  it("is empty while the launch gate is on (PRD-02)", () => {
    // robots.txt disallows everything while gated; a full sitemap would invite
    // exactly the crawl the gate exists to prevent.
    vi.stubEnv("LAUNCH_GATE", "on");
    expect(sitemap()).toEqual([]);
  });

  it("never lists the funnel, manage-booking, the admin or the API", () => {
    // A crawler walking the booking funnel creates quote rows.
    vi.stubEnv("LAUNCH_GATE", "off");
    expect(
      paths().filter((path) => /^\/(book|manage|admin|api)(\/|$)/.test(path)),
    ).toEqual([]);
  });

  it("lists every airport and seaport that clears SEO-01", () => {
    vi.stubEnv("LAUNCH_GATE", "off");
    const listed = paths();

    // All of today's guides clear the bar. If one stops clearing it, this test
    // fails here rather than the page quietly vanishing from search.
    for (const airport of AIRPORTS) expect(listed).toContain(`/airports/${airport.slug}`);
    for (const port of SEAPORTS) expect(listed).toContain(`/seaports/${port.slug}`);
  });

  it("lists the help and legal pages", () => {
    vi.stubEnv("LAUNCH_GATE", "off");
    const listed = paths();

    for (const path of [
      "/faq",
      "/info/meeting-points",
      "/luggage-guide",
      "/child-seats",
      "/info/cancellation",
      "/info/payment",
      "/info/lost-property",
      "/terms",
      "/privacy",
      "/cookies",
      "/legal/licensing",
      "/legal/complaints",
    ]) {
      expect(listed).toContain(path);
    }
  });

  it("uses absolute URLs on one origin, with no duplicates", () => {
    vi.stubEnv("LAUNCH_GATE", "off");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test/");
    const urls = sitemap().map((entry) => entry.url);

    expect(urls.every((url) => url.startsWith("https://example.test/"))).toBe(true);
    // The trailing slash on the configured origin must not double up.
    expect(urls.some((url) => url.includes(".test//"))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
