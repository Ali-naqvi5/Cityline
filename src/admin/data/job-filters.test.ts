import type { Where } from "payload";
import { describe, expect, it } from "vitest";

import {
  buildJobsWhere,
  jobsHref,
  jobsSort,
  parseJobFilters,
  pickupRange,
  searchConditions,
} from "./job-filters";

const NOW = new Date("2026-10-01T09:00:00Z"); // Thursday, 10:00 in London

function conditions(where: Where): Where[] {
  return (where.and as Where[]) ?? [];
}

describe("parseJobFilters", () => {
  it("defaults to upcoming jobs in a list, without test bookings", () => {
    const filters = parseJobFilters({}, NOW);
    expect(filters).toMatchObject({
      view: "list",
      when: "upcoming",
      date: "2026-10-01",
      includeTest: false,
      page: 1,
    });
  });

  it("ignores values it does not recognise rather than trusting the URL", () => {
    const filters = parseJobFilters(
      {
        status: "deleted",
        source: "hack",
        vehicle: "tank",
        page: "-3",
        date: "2026-02-30",
      },
      NOW,
    );
    expect(filters).toMatchObject({ status: "", source: "", vehicle: "", page: 1 });
    expect(filters.date).toBe("2026-10-01");
  });

  it("reads a picked date as that day", () => {
    expect(parseJobFilters({ date: "2026-10-05" }, NOW)).toMatchObject({
      when: "date",
      date: "2026-10-05",
    });
  });
});

describe("pickupRange", () => {
  it("starts 'upcoming' at the beginning of today, London time", () => {
    const { from, to } = pickupRange({ view: "list", when: "upcoming", date: "" }, NOW);
    expect(from?.toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(to).toBeNull();
  });

  it("covers Monday to Sunday in week view", () => {
    const { from, to } = pickupRange(
      { view: "week", when: "upcoming", date: "2026-10-01" },
      NOW,
    );
    expect(from?.toISOString()).toBe("2026-09-27T23:00:00.000Z");
    // Sunday 4 Oct ends at midnight BST.
    expect(to?.toISOString()).toBe("2026-10-04T23:00:00.000Z");
  });
});

describe("buildJobsWhere", () => {
  it("leaves test bookings out unless asked", () => {
    const base = parseJobFilters({}, NOW);
    expect(conditions(buildJobsWhere(base, NOW))).toContainEqual({
      isTest: { not_equals: true },
    });
    expect(
      conditions(buildJobsWhere({ ...base, includeTest: true }, NOW)).some(
        (condition) => "isTest" in condition,
      ),
    ).toBe(false);
  });

  it("lets 'unassigned only' win over a status filter", () => {
    const filters = {
      ...parseJobFilters({}, NOW),
      unassigned: true,
      status: "completed" as const,
    };
    const statuses = conditions(buildJobsWhere(filters, NOW)).filter(
      (condition) => "status" in condition,
    );
    expect(statuses).toEqual([{ status: { equals: "unassigned" } }]);
  });
});

describe("searchConditions", () => {
  it("finds a phone number however it was typed", () => {
    for (const typed of ["07700 900123", "+44 7700 900123", "7700900123"]) {
      expect(searchConditions(typed)).toContainEqual({
        leadPhone: { like: "7700900123" },
      });
    }
  });

  it("does not treat a job reference's digits as a phone number", () => {
    expect(searchConditions("J-000123").some((c) => "leadPhone" in c)).toBe(false);
  });

  it("normalises a flight number", () => {
    expect(searchConditions("ba 117")).toContainEqual({
      flightNumber: { like: "BA117" },
    });
  });

  it("matches nothing extra for an empty box", () => {
    expect(searchConditions("   ")).toEqual([]);
  });
});

describe("jobsSort and jobsHref", () => {
  it("shows the past newest first and everything else soonest first", () => {
    expect(jobsSort({ view: "list", when: "past" })).toBe("-pickupAt");
    expect(jobsSort({ view: "list", when: "upcoming" })).toBe("pickupAt");
    expect(jobsSort({ view: "day", when: "past" })).toBe("pickupAt");
  });

  it("builds a short URL and drops page 1", () => {
    const filters = parseJobFilters({}, NOW);
    expect(jobsHref(filters)).toBe("/admin/jobs");
    expect(jobsHref(filters, { status: "assigned", page: 2 })).toBe(
      "/admin/jobs?status=assigned&page=2",
    );
    expect(jobsHref(filters, { view: "day" })).toBe(
      "/admin/jobs?view=day&date=2026-10-01",
    );
  });
});
