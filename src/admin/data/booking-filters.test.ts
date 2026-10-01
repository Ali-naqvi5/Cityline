import type { Where } from "payload";
import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  bookingsHref,
  bookingsSort,
  buildBookingsWhere,
  parseBookingFilters,
  pickupRange,
  searchConditions,
} from "./booking-filters";

const NOW = new Date("2026-10-01T09:00:00Z"); // Thursday, 10:00 in London

function conditions(where: Where): Where[] {
  return (where.and as Where[]) ?? [];
}

describe("parseBookingFilters", () => {
  it("defaults to upcoming bookings, 30 a page, without test bookings", () => {
    expect(parseBookingFilters({})).toMatchObject({
      when: "upcoming",
      includeTest: false,
      page: 1,
      perPage: 30,
      driver: null,
    });
  });

  it("ignores values it does not recognise rather than trusting the URL", () => {
    const filters = parseBookingFilters({
      status: "deleted",
      source: "hack",
      vehicle: "tank",
      payment: "barter",
      supplier: "abc",
      driver: "-1",
      page: "-3",
      per: "1000",
      from: "2026-02-30",
    });
    expect(filters).toMatchObject({
      status: "",
      source: "",
      vehicle: "",
      payment: "",
      supplier: null,
      driver: null,
      page: 1,
      perPage: 30,
      from: "",
      when: "upcoming",
    });
  });

  it("lets pickup dates decide over a preset", () => {
    expect(
      parseBookingFilters({ when: "today", from: "2026-10-05", to: "2026-10-06" }),
    ).toMatchObject({ when: "range", from: "2026-10-05", to: "2026-10-06" });
    expect(parseBookingFilters({ when: "all", to: "2026-10-06" })).toMatchObject({
      when: "range",
      from: "",
      to: "2026-10-06",
    });
  });

  it("reads pickup dates as a range, and 'none' as no driver", () => {
    expect(
      parseBookingFilters({ from: "2026-10-05", to: "2026-10-06", driver: "none" }),
    ).toMatchObject({
      when: "range",
      from: "2026-10-05",
      to: "2026-10-06",
      driver: "none",
    });
  });
});

describe("pickupRange", () => {
  it("starts 'upcoming' at the beginning of today, London time", () => {
    const { from, to } = pickupRange({ when: "upcoming", from: "", to: "" }, NOW);
    expect(from?.toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(to).toBeNull();
  });

  it("covers whole London days for a date range", () => {
    const { from, to } = pickupRange(
      { when: "range", from: "2026-10-24", to: "2026-10-25" },
      NOW,
    );
    expect(from?.toISOString()).toBe("2026-10-23T23:00:00.000Z");
    // 25 Oct: the clocks go back, so that day ends at midnight GMT.
    expect(to?.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("covers Monday to Sunday for 'this week'", () => {
    const { from, to } = pickupRange({ when: "week", from: "", to: "" }, NOW);
    expect(from?.toISOString()).toBe("2026-09-27T23:00:00.000Z");
    expect(to?.toISOString()).toBe("2026-10-04T23:00:00.000Z");
  });
});

describe("buildBookingsWhere", () => {
  it("leaves test bookings out unless asked", () => {
    const base = parseBookingFilters({});
    expect(conditions(buildBookingsWhere(base, NOW))).toContainEqual({
      isTest: { not_equals: true },
    });
    expect(
      conditions(buildBookingsWhere({ ...base, includeTest: true }, NOW)).some(
        (condition) => "isTest" in condition,
      ),
    ).toBe(false);
  });

  it("reads 'open' as every booking not yet finished, under way ones included", () => {
    const where = buildBookingsWhere(parseBookingFilters({ status: "open" }), NOW);
    expect(conditions(where)).toContainEqual({
      status: {
        in: [
          "unassigned",
          "assigned",
          "driver_confirmed",
          "on_the_way",
          "at_pickup",
          "on_board",
        ],
      },
    });
  });

  it("finds assigned bookings with no driver price written", () => {
    const where = buildBookingsWhere(parseBookingFilters({ noDriverPrice: "1" }), NOW);
    expect(conditions(where)).toEqual(
      expect.arrayContaining([
        { driver: { exists: true } },
        { driverPricePence: { exists: false } },
      ]),
    );
  });

  it("filters by supplier, driver, payment and who took it", () => {
    const where = buildBookingsWhere(
      parseBookingFilters({
        supplier: "3",
        driver: "none",
        payment: "cash",
        takenBy: "2",
      }),
      NOW,
    );
    expect(conditions(where)).toEqual(
      expect.arrayContaining([
        { supplier: { equals: 3 } },
        { driver: { exists: false } },
        { paymentMethod: { equals: "cash" } },
        { takenByUser: { equals: 2 } },
      ]),
    );
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

  it("matches flight, registration and supplier reference however they were typed", () => {
    const found = searchConditions("ab12 cde");
    expect(found).toContainEqual({ vehicleReg: { like: "AB12CDE" } });
    expect(found).toContainEqual({ supplierReference: { like: "AB12CDE" } });
    expect(searchConditions("ba 117")).toContainEqual({
      flightNumber: { like: "BA117" },
    });
  });

  it("matches nothing extra for an empty box", () => {
    expect(searchConditions("   ")).toEqual([]);
  });
});

describe("bookingsSort, bookingsHref and activeFilterCount", () => {
  it("shows the past newest first and everything else soonest first", () => {
    expect(bookingsSort({ when: "past" })).toBe("-pickupAt");
    expect(bookingsSort({ when: "upcoming" })).toBe("pickupAt");
  });

  it("builds a short URL and drops the defaults", () => {
    const filters = parseBookingFilters({});
    expect(bookingsHref(filters)).toBe("/admin/bookings");
    expect(bookingsHref(filters, { status: "assigned", page: 2, perPage: 50 })).toBe(
      "/admin/bookings?status=assigned&per=50&page=2",
    );
    expect(bookingsHref(filters, { when: "range", from: "2026-10-05" })).toBe(
      "/admin/bookings?when=range&from=2026-10-05",
    );
  });

  it("counts the filters that are set", () => {
    expect(activeFilterCount(parseBookingFilters({}))).toBe(0);
    expect(
      activeFilterCount(parseBookingFilters({ status: "open", driver: "none" })),
    ).toBe(2);
  });
});
