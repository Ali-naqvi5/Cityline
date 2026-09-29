import { describe, expect, it } from "vitest";

import {
  canManageOnline,
  cancellationTerms,
  nextPickup,
  onlineDeadline,
  upcomingJobs,
} from "./manage-rules";

const job = (pickupAt: string, status = "unassigned") => ({ pickupAt, status });

// Pickup at 09:00 UTC on 14 Dec 2026.
const PICKUP = "2026-12-14T09:00:00.000Z";
const at = (iso: string) => new Date(iso);

describe("canManageOnline", () => {
  it("allows changes up to exactly 24 hours before pickup", () => {
    expect(canManageOnline("confirmed", [job(PICKUP)], at("2026-12-13T09:00:00Z"))).toBe(
      true,
    );
    // The seconds do not cost the customer the last minute.
    expect(canManageOnline("confirmed", [job(PICKUP)], at("2026-12-13T09:00:45Z"))).toBe(
      true,
    );
  });

  it("closes a minute inside 24 hours", () => {
    expect(canManageOnline("confirmed", [job(PICKUP)], at("2026-12-13T09:01:00Z"))).toBe(
      false,
    );
  });

  it("never allows it on a cancelled booking", () => {
    expect(canManageOnline("cancelled", [job(PICKUP)], at("2026-12-01T09:00:00Z"))).toBe(
      false,
    );
  });

  it("judges a return trip on the next leg still to run", () => {
    const jobs = [job("2026-12-14T09:00:00Z", "completed"), job("2026-12-21T14:00:00Z")];
    expect(canManageOnline("confirmed", jobs, at("2026-12-15T12:00:00Z"))).toBe(true);
  });

  it("has nothing to change once every leg has run", () => {
    expect(
      canManageOnline(
        "confirmed",
        [job(PICKUP, "completed")],
        at("2026-12-01T09:00:00Z"),
      ),
    ).toBe(false);
  });
});

describe("cancellationTerms", () => {
  it("refunds in full at 24 hours or more", () => {
    expect(cancellationTerms(13600, [job(PICKUP)], at("2026-12-13T09:00:00Z"))).toEqual({
      kind: "full",
      refundPence: 13600,
    });
  });

  it("is partial inside 24 hours, with the amount left to the team until the percentage is set", () => {
    expect(cancellationTerms(13600, [job(PICKUP)], at("2026-12-13T09:30:00Z"))).toEqual({
      kind: "partial",
      percent: null,
      refundPence: null,
    });
  });

  it("has nothing to cancel once every leg has run", () => {
    expect(
      cancellationTerms(13600, [job(PICKUP, "completed")], at("2026-12-20T09:00:00Z")),
    ).toBeNull();
  });
});

describe("nextPickup, upcomingJobs and onlineDeadline", () => {
  it("ignore cancelled, completed and no-show legs", () => {
    const jobs = [
      job("2026-12-10T09:00:00Z", "no_show"),
      job("2026-12-12T09:00:00Z", "cancelled"),
      job("2026-12-14T09:00:00Z"),
    ];
    expect(upcomingJobs(jobs)).toHaveLength(1);
    expect(nextPickup(jobs)?.toISOString()).toBe("2026-12-14T09:00:00.000Z");
    expect(onlineDeadline(jobs)?.toISOString()).toBe("2026-12-13T09:00:00.000Z");
  });
});
