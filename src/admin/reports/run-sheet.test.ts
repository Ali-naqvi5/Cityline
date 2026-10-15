import { describe, expect, it } from "vitest";

import { buildRunSheet, durationText, type RunSheetJob } from "./run-sheet";

function job(overrides: Partial<RunSheetJob>): RunSheetJob {
  return {
    id: 1,
    reference: "J-000001",
    status: "driver_confirmed",
    pickupAt: "2026-10-06T09:00:00.000Z", // 10:00 in London
    client: "Website",
    supplierReference: null,
    passenger: "Jane Smith",
    leadName: "Jane Smith",
    leadPhone: "+447700900123",
    flightNumber: null,
    pickupAddress: "Heathrow Terminal 5",
    viaStops: [],
    dropoffAddress: "Uxbridge",
    hours: null,
    passengers: 1,
    largeBags: 1,
    smallBags: 0,
    vehicleClassSlug: "saloon",
    extras: [],
    meetAndGreet: false,
    driverNotes: null,
    driverId: 1,
    operatorName: null,
    vehicleReg: "CD34EFG",
    problems: [],
    ...overrides,
  };
}

const drivers = [
  {
    id: 1,
    name: "Sam Taylor",
    firstName: "Sam",
    phone: "+447700900456",
    whatsappConsent: true,
  },
  {
    id: 2,
    name: "Priya Shah",
    firstName: "Priya",
    phone: "+447700900458",
    whatsappConsent: false,
  },
];
// 08:00 in London.
const now = new Date("2026-10-06T07:00:00.000Z");

describe("the Daily Run Sheet", () => {
  const sheet = buildRunSheet(
    [
      job({ id: 3, reference: "J-000003", pickupAt: "2026-10-06T10:00:00.000Z" }),
      job({ id: 1 }),
      job({
        id: 2,
        reference: "J-000002",
        status: "unassigned",
        driverId: null,
        operatorName: null,
        vehicleReg: null,
        pickupAt: "2026-10-06T08:30:00.000Z",
      }),
      job({
        id: 4,
        reference: "J-000004",
        status: "assigned",
        driverId: 2,
        operatorName: null,
        pickupAt: "2026-10-06T15:00:00.000Z",
        problems: ["PHV driver licence expires before the pickup"],
      }),
      job({
        id: 5,
        reference: "J-000005",
        status: "completed",
        pickupAt: "2026-10-06T06:00:00.000Z",
      }),
    ],
    drivers,
    now,
  );

  it("lists the day in pickup order", () => {
    expect(sheet.jobs.map((item) => item.reference)).toEqual([
      "J-000005",
      "J-000002",
      "J-000001",
      "J-000003",
      "J-000004",
    ]);
    expect(sheet.unassigned.map((item) => item.reference)).toEqual(["J-000002"]);
  });

  it("gives each driver their day, with the time between pickups", () => {
    expect(sheet.days.map((day) => day.driver.name)).toEqual([
      "Sam Taylor",
      "Priya Shah",
    ]);
    const sam = sheet.days[0]!;
    expect(sam.jobs.map((item) => item.reference)).toEqual([
      "J-000005",
      "J-000001",
      "J-000003",
    ]);
    expect(sam.gaps).toEqual([180, 60, null]);
    expect(sam.vehicles).toEqual(["CD34EFG"]);
  });

  it("puts what needs the controller first, urgent before pending", () => {
    expect(sheet.warnings.map((warning) => [warning.tone, warning.text])).toEqual([
      ["danger", "No driver yet — pickup in 1 h 30 min"],
      ["danger", "Priya Shah: PHV driver licence expires before the pickup"],
      ["warn", "Sam Taylor has 1 h between J-000001 and J-000003"],
      ["warn", "Priya Shah has not confirmed — pickup in 8 h"],
    ]);
  });

  it("says when a pickup has already passed", () => {
    const late = buildRunSheet(
      [
        job({
          status: "unassigned",
          driverId: null,
          operatorName: null,
          pickupAt: "2026-10-06T06:30:00.000Z",
        }),
      ],
      drivers,
      now,
    );
    expect(late.warnings[0]?.text).toBe("No driver yet — pickup was at 07:30");
  });

  it("writes durations as people say them", () => {
    expect(durationText(45)).toBe("45 min");
    expect(durationText(60)).toBe("1 h");
    expect(durationText(125)).toBe("2 h 05 min");
  });
});
