import { describe, expect, it } from "vitest";

import { buildJobsReport, clientLabel, type ReportJob } from "./jobs-report";

const period = { from: "2026-10-01", to: "2026-10-07", days: 7 };
const now = new Date("2026-10-05T12:00:00Z");

let next = 1;
function job(overrides: Partial<ReportJob>): ReportJob {
  return {
    id: next,
    reference: `J-${String(next++).padStart(6, "0")}`,
    status: "completed",
    source: "phone",
    supplierName: null,
    vehicleClassSlug: "saloon",
    pickupAt: "2026-10-01T09:30:00.000Z", // Thu 1 Oct, 10:30 in London
    pickupAddress: "Heathrow Terminal 5",
    dropoffAddress: "Wembley Park",
    hours: null,
    takenAt: "2026-09-28T09:00:00.000Z",
    dispatchedAt: "2026-09-30T09:00:00.000Z",
    cancelReason: null,
    ...overrides,
  };
}

describe("the Jobs Report", () => {
  const jobs = [
    job({}),
    job({ status: "completed", source: "supplier", supplierName: "Trip.com" }),
    job({ status: "no_show", pickupAt: "2026-10-02T21:00:00.000Z" }),
    job({ status: "cancelled", cancelReason: "flight cancelled." }),
    job({ status: "cancelled", cancelReason: "Flight cancelled" }),
    job({
      status: "assigned",
      pickupAt: "2026-10-06T09:00:00.000Z",
      pickupAddress: "Wembley Park",
      dropoffAddress: "North Terminal, Gatwick",
      takenAt: "2026-10-06T07:00:00.000Z",
      dispatchedAt: "2026-10-06T08:00:00.000Z",
    }),
    job({
      status: "unassigned",
      pickupAt: "2026-10-04T09:00:00.000Z",
      dispatchedAt: null,
    }),
  ];
  const report = buildJobsReport(
    jobs,
    [job({}), job({ status: "cancelled" })],
    period,
    now,
  );

  it("counts bookings and outcomes, and what was left open", () => {
    expect(report.totals).toEqual({
      bookings: 7,
      completed: 2,
      noShows: 1,
      cancelled: 2,
      open: 2,
      notClosed: 1,
    });
    expect(report.previous).toMatchObject({ bookings: 2, cancelled: 1 });
  });

  it("works out rates against the right base", () => {
    expect(report.rates.completion).toBeCloseTo(2 / 5);
    expect(report.rates.noShow).toBeCloseTo(1 / 5);
    expect(report.rates.cancellation).toBeCloseTo(2 / 7);
  });

  it("counts each day of the period, by London date", () => {
    expect(report.series.unit).toBe("day");
    expect(report.series.points).toHaveLength(7);
    expect(report.series.points[0]).toMatchObject({
      key: "2026-10-01",
      total: 4,
      completed: 2,
    });
    // 21:00 UTC on 2 Oct is 22:00 in London, still 2 Oct.
    expect(report.series.points[1]).toMatchObject({
      key: "2026-10-02",
      total: 1,
      noShows: 1,
    });
  });

  it("breaks the work down by client, service, airport and car", () => {
    expect(report.byClient[0]).toMatchObject({ label: "Phone", count: 6 });
    expect(report.byClient.find((row) => row.label === "Trip.com")?.count).toBe(1);
    expect(report.byService.find((row) => row.label === "To airport")?.count).toBe(1);
    expect(report.byAirport.find((row) => row.label === "Gatwick North")?.count).toBe(1);
    expect(report.byAirport.find((row) => row.label === "Heathrow T5")?.count).toBe(4);
    expect(report.byVehicle).toEqual([{ label: "Saloon", count: 7, share: 1 }]);
  });

  it("places pickups on the busy-hours grid in London time", () => {
    // Thu 1 Oct 10:30 BST: Thursday is row 3, hour 10. The two cancelled
    // bookings at that time are not work done, so they are not counted.
    expect(report.heat[3]![10]).toBe(2);
  });

  it("measures how far ahead bookings come in, and late dispatch", () => {
    expect(report.leadTime.find((row) => row.label === "Under 24 hours")?.count).toBe(1);
    expect(report.lateDispatch).toEqual({ count: 1, of: 4 });
    expect(report.noDriverAtPickup).toBe(1);
    expect(report.enteredAfterPickup).toBe(0);
  });

  it("keeps bookings entered after their pickup out of lead time and dispatch", () => {
    const late = buildJobsReport(
      [
        job({
          status: "no_show",
          pickupAt: "2026-10-01T20:13:00.000Z",
          takenAt: "2026-10-01T22:13:00.000Z",
          dispatchedAt: "2026-10-01T22:14:00.000Z",
        }),
      ],
      [],
      period,
      now,
    );
    expect(late.enteredAfterPickup).toBe(1);
    expect(late.leadTime.reduce((sum, row) => sum + row.count, 0)).toBe(0);
    expect(late.lateDispatch).toEqual({ count: 0, of: 0 });
    expect(late.noDriverAtPickup).toBe(0);
    expect(late.totals.noShows).toBe(1);
  });

  it("groups cancellation reasons however they were typed", () => {
    expect(report.cancelReasons).toEqual([
      { label: "Flight cancelled", count: 2, share: 1 },
    ]);
  });

  it("names a supplier job's client by the supplier", () => {
    expect(clientLabel({ source: "supplier", supplierName: "Webby" })).toBe("Webby");
    expect(clientLabel({ source: "website", supplierName: null })).toBe("Website");
  });
});
