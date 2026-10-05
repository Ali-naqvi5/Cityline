import { describe, expect, it } from "vitest";

import {
  buildDriversReport,
  minutesLate,
  minutesToConfirm,
  type DriverJob,
  type TakenOffEvent,
} from "./drivers-report";

const period = { from: "2026-10-01", to: "2026-10-07", days: 7 };

function job(overrides: Partial<DriverJob>): DriverJob {
  return {
    id: 1,
    status: "completed",
    driverId: 1,
    // 10:00 BST on Thu 1 Oct.
    pickupAt: "2026-10-01T09:00:00.000Z",
    dispatchedAt: "2026-09-30T09:00:00.000Z",
    driverConfirmedAt: "2026-09-30T09:10:00.000Z",
    atPickupAt: "2026-10-01T08:50:00.000Z",
    ...overrides,
  };
}

const drivers = [
  { id: 1, name: "Sam Taylor", status: "active" },
  { id: 2, name: "Priya Shah", status: "active" },
];

const takenOff: TakenOffEvent[] = [
  {
    jobId: 9,
    reference: "J-000009",
    pickupAt: "2026-10-03T09:00:00.000Z",
    driverId: 2,
    at: "2026-10-02T18:00:00.000Z",
    reason: "car broke down.",
    by: "Carl Controller",
  },
];

describe("the Driver Report", () => {
  const jobs = [
    job({ id: 1 }),
    // 15 minutes after the pickup time still counts as on time.
    job({ id: 2, atPickupAt: "2026-10-01T09:15:00.000Z" }),
    job({
      id: 3,
      status: "no_show",
      atPickupAt: "2026-10-01T09:40:00.000Z",
      driverConfirmedAt: "2026-09-30T11:00:00.000Z",
    }),
    job({
      id: 4,
      driverId: 2,
      pickupAt: "2026-10-02T09:00:00.000Z",
      atPickupAt: "2026-10-02T09:20:00.000Z",
      driverConfirmedAt: "2026-09-30T09:05:00.000Z",
    }),
    // Assigned, not yet confirmed, still to happen.
    job({
      id: 5,
      driverId: 2,
      status: "assigned",
      pickupAt: "2026-10-06T09:00:00.000Z",
      driverConfirmedAt: null,
      atPickupAt: null,
    }),
    // Cancelled before the driver set off: not work done.
    job({ id: 6, status: "cancelled", atPickupAt: null }),
    // No driver at all.
    job({ id: 7, driverId: null, status: "unassigned", atPickupAt: null }),
  ];
  const report = buildDriversReport({
    jobs,
    previousJobs: [job({ id: 10 })],
    takenOff,
    previousTakenOff: 0,
    drivers,
    period,
  });

  it("measures lateness against the booked pickup time, and confirmation", () => {
    expect(minutesLate(jobs[0]!)).toBe(-10);
    expect(minutesLate(jobs[1]!)).toBe(15);
    expect(minutesLate(jobs[4]!)).toBe(null);
    expect(minutesToConfirm(jobs[0]!)).toBe(10);
    expect(minutesToConfirm(jobs[4]!)).toBe(null);
  });

  it("totals the work driven, on time with 15 minutes' grace", () => {
    expect(report.totals).toEqual({
      driversWorked: 2,
      driven: 4,
      perDriver: 2,
      arrivals: 4,
      onTime: 2,
      onTimeShare: 0.5,
      // The cancelled booking was confirmed too: the driver did answer.
      medianConfirmMinutes: 10,
      takenOff: 1,
    });
    expect(report.previous).toMatchObject({ driversWorked: 1, driven: 1, takenOff: 0 });
  });

  it("buckets arrivals and confirmations", () => {
    expect(report.punctuality.map((row) => [row.label, row.count])).toEqual([
      ["On time (up to 15 min after)", 2],
      ["16–30 min late", 1],
      ["Over 30 min late", 1],
    ]);
    expect(report.confirmTime.map((row) => [row.label, row.count])).toEqual([
      ["Under 15 min", 4],
      ["1–6 hours", 1],
    ]);
    expect(report.awaitingConfirmation).toBe(1);
    expect(report.arrivalNotRecorded).toBe(0);
  });

  it("has a row per driver, busiest first", () => {
    expect(report.drivers).toEqual([
      expect.objectContaining({
        driverId: 1,
        name: "Sam Taylor",
        bookings: 3,
        driven: 3,
        completed: 2,
        noShows: 1,
        takenOff: 0,
        arrivals: 3,
        onTime: 2,
        medianConfirmMinutes: 10,
        daysWorked: 1,
      }),
      expect.objectContaining({
        driverId: 2,
        bookings: 2,
        driven: 1,
        takenOff: 1,
        medianConfirmMinutes: 5,
      }),
    ]);
  });

  it("lays each driver's bookings out by day, cancelled ones left out", () => {
    expect(report.grid.unit).toBe("day");
    expect(report.grid.columns[0]).toEqual({ key: "2026-10-01", label: "Thu 1 Oct" });
    expect(report.grid.rows[0]).toEqual({
      driverId: 1,
      name: "Sam Taylor",
      cells: [3, 0, 0, 0, 0, 0, 0],
      total: 3,
    });
    expect(report.grid.rows[1]?.cells).toEqual([0, 1, 0, 0, 0, 1, 0]);
  });

  it("lists drivers taken off, with the reason as written", () => {
    expect(report.takenOff[0]).toMatchObject({
      driverName: "Priya Shah",
      reason: "car broke down.",
    });
    expect(report.takenOffReasons).toEqual([
      { label: "Car broke down", count: 1, share: 1 },
    ]);
  });

  it("counts driven bookings with no arrival time as not recorded", () => {
    const missing = buildDriversReport({
      jobs: [job({ atPickupAt: null })],
      previousJobs: [],
      takenOff: [],
      previousTakenOff: 0,
      drivers,
      period,
    });
    expect(missing.arrivalNotRecorded).toBe(1);
    expect(missing.totals.onTimeShare).toBe(null);
  });
});
