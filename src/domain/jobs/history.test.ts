import { describe, expect, it } from "vitest";

import { trackedChanges } from "./history";

describe("job history", () => {
  it("records operational changes and leaves bookkeeping fields out", () => {
    const changes = trackedChanges(
      {
        pickupAt: "2026-10-05T10:00:00.000Z",
        flightNumber: "BA117",
        driverNotes: null,
        updatedAt: "2026-10-01T00:00:00.000Z",
        driverMessageStatus: "sent",
      },
      {
        pickupAt: "2026-10-05T11:00:00.000Z",
        flightNumber: "BA117",
        driverNotes: "Gate code 1234",
        updatedAt: "2026-10-02T00:00:00.000Z",
        driverMessageStatus: "read",
      },
    );
    expect(changes).toEqual([
      { field: "driverNotes", from: null, to: "Gate code 1234" },
      {
        field: "pickupAt",
        from: "2026-10-05T10:00:00.000Z",
        to: "2026-10-05T11:00:00.000Z",
      },
    ]);
  });

  it("describes stops and extras as text, ignoring row ids", () => {
    const changes = trackedChanges(
      {
        viaStops: [{ id: "a", address: "Uxbridge" }],
        extras: [{ id: "x", slug: "child-seat", quantity: 1 }],
      },
      {
        viaStops: [
          { id: "b", address: "Uxbridge" },
          { id: "c", address: "Ealing" },
        ],
        extras: [{ id: "y", slug: "child-seat", quantity: 1 }],
      },
    );
    expect(changes).toEqual([
      { field: "viaStops", from: "Uxbridge", to: "Uxbridge → Ealing" },
    ]);
  });
});
