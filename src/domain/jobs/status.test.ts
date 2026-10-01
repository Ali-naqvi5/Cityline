import { describe, expect, it } from "vitest";

import type { JobStatus } from "./labels";
import {
  beforeBoarding,
  nextStages,
  previousStages,
  stageIndex,
  statusChangeProblem,
  type StatusChange,
} from "./status";

const pickupAt = new Date("2026-10-05T10:00:00Z");
const before = new Date("2026-10-05T09:00:00Z");
const after = new Date("2026-10-05T10:20:00Z");

function change(from: JobStatus, to: JobStatus, overrides: Partial<StatusChange> = {}) {
  return statusChangeProblem({
    from,
    to,
    hasDriver: true,
    pickupAt,
    now: before,
    ...overrides,
  });
}

describe("the job cycle", () => {
  it("moves forward one stage at a time, all the way to completed", () => {
    expect(change("assigned", "driver_confirmed")).toBeNull();
    expect(change("driver_confirmed", "on_the_way")).toBeNull();
    expect(change("on_the_way", "at_pickup")).toBeNull();
    expect(change("at_pickup", "on_board")).toBeNull();
    expect(change("on_board", "completed")).toBeNull();
  });

  it("refuses to jump forward", () => {
    expect(change("assigned", "on_board")).toMatch(
      /one stage at a time: from Assigned the next is Driver confirmed/,
    );
    expect(change("driver_confirmed", "at_pickup")).toMatch(
      /next is DOW — Driver on the way/,
    );
    expect(change("on_the_way", "completed")).toMatch(/next is DAP/);
    expect(change("at_pickup", "completed")).toMatch(/next is POB .* or PNS/);
  });

  it("steps back any number of stages", () => {
    expect(change("on_board", "at_pickup")).toBeNull();
    expect(change("on_board", "assigned")).toBeNull();
    expect(change("completed", "on_board")).toBeNull();
    expect(change("no_show", "at_pickup")).toBeNull();
    expect(previousStages("on_board")).toEqual([
      "at_pickup",
      "on_the_way",
      "driver_confirmed",
      "assigned",
    ]);
  });

  it("does not swap one outcome for the other without stepping back", () => {
    expect(change("no_show", "on_board")).toMatch(/end of the cycle/);
    expect(change("completed", "no_show")).toMatch(/end of the cycle/);
  });

  it("offers POB or PNS at the pickup, and nothing after the end", () => {
    expect(nextStages("at_pickup")).toEqual(["on_board", "no_show"]);
    expect(nextStages("completed")).toEqual([]);
    expect(nextStages("no_show")).toEqual([]);
  });

  it("marks a no-show only once the pickup time has passed", () => {
    expect(change("at_pickup", "no_show", { now: before })).toMatch(
      /pickup time has passed/,
    );
    expect(change("at_pickup", "no_show", { now: after })).toBeNull();
    // A passenger can board early: an early flight is not a mistake.
    expect(change("at_pickup", "on_board", { now: before })).toBeNull();
  });

  it("needs a driver for every stage after unassigned", () => {
    expect(change("unassigned", "assigned", { hasDriver: false })).toMatch(
      /Assign a driver/,
    );
  });

  it("cancels with a reason, and only before the passenger is on board", () => {
    expect(change("on_the_way", "cancelled")).toMatch(/Say why/);
    expect(
      change("at_pickup", "cancelled", { cancelReason: "Flight cancelled" }),
    ).toBeNull();
    expect(change("on_board", "cancelled", { cancelReason: "x" })).toMatch(/on board/);
    expect(change("cancelled", "assigned")).toMatch(/cancelled/);
    expect(beforeBoarding("at_pickup")).toBe(true);
    expect(beforeBoarding("on_board")).toBe(false);
  });

  it("takes the driver off only before the passenger is on board", () => {
    expect(change("on_the_way", "unassigned")).toBeNull();
    expect(change("on_board", "unassigned")).toMatch(/before the passenger is on board/);
  });

  it("places PNS alongside POB in the progress line", () => {
    expect(stageIndex("no_show")).toBe(stageIndex("on_board"));
    expect(stageIndex("completed")).toBeGreaterThan(stageIndex("on_board"));
  });
});
