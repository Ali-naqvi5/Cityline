import { describe, expect, it } from "vitest";

import { statusActions, statusChangeProblem, type StatusChange } from "./status";

const pickupAt = new Date("2026-10-05T10:00:00Z");
const before = new Date("2026-10-05T09:00:00Z");
const after = new Date("2026-10-05T11:00:00Z");

function change(overrides: Partial<StatusChange>): StatusChange {
  return {
    from: "assigned",
    to: "driver_confirmed",
    hasDriver: true,
    pickupAt,
    now: before,
    ...overrides,
  };
}

describe("job status changes", () => {
  it("follows the operational order", () => {
    expect(statusChangeProblem(change({}))).toBeNull();
    expect(
      statusChangeProblem(
        change({ from: "driver_confirmed", to: "completed", now: after }),
      ),
    ).toBeNull();
    expect(
      statusChangeProblem(change({ from: "assigned", to: "no_show", now: after })),
    ).toBeNull();
    expect(
      statusChangeProblem(
        change({
          from: "unassigned",
          to: "cancelled",
          hasDriver: false,
          cancelReason: "Duplicate",
        }),
      ),
    ).toBeNull();
  });

  it("does not let a final status change", () => {
    for (const from of ["completed", "no_show", "cancelled"] as const) {
      expect(statusChangeProblem(change({ from, to: "assigned" }))).toMatch(
        /cannot change/,
      );
    }
  });

  it("refuses skipping the driver", () => {
    expect(
      statusChangeProblem(
        change({ from: "unassigned", to: "driver_confirmed", hasDriver: false }),
      ),
    ).toMatch(/cannot go from Unassigned to Driver confirmed/);
    expect(
      statusChangeProblem(
        change({ from: "unassigned", to: "assigned", hasDriver: false }),
      ),
    ).toMatch(/Assign a driver/);
    expect(
      statusChangeProblem(
        change({ from: "unassigned", to: "completed", hasDriver: false }),
      ),
    ).toMatch(/cannot go from/);
  });

  it("marks a job completed or no-show only after its pickup time", () => {
    expect(
      statusChangeProblem(
        change({ from: "driver_confirmed", to: "completed", now: before }),
      ),
    ).toMatch(/after its pickup time/);
    expect(
      statusChangeProblem(change({ from: "assigned", to: "no_show", now: before })),
    ).toMatch(/after its pickup time/);
  });

  it("needs a reason to cancel", () => {
    expect(statusChangeProblem(change({ to: "cancelled" }))).toMatch(/Say why/);
    expect(statusChangeProblem(change({ to: "cancelled", cancelReason: "  " }))).toMatch(
      /Say why/,
    );
  });

  it("offers the buttons each status allows", () => {
    expect(statusActions("unassigned")).toEqual(["cancelled"]);
    expect(statusActions("assigned")).toEqual([
      "driver_confirmed",
      "completed",
      "no_show",
      "cancelled",
    ]);
    expect(statusActions("driver_confirmed")).toEqual([
      "completed",
      "no_show",
      "cancelled",
    ]);
    expect(statusActions("completed")).toEqual([]);
  });
});
