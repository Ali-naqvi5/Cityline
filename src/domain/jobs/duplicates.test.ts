import { describe, expect, it } from "vitest";

import { possibleDuplicates, type DuplicateCandidate } from "./duplicates";

const existing = (overrides: Partial<DuplicateCandidate>): DuplicateCandidate => ({
  id: 1,
  reference: "J-000001",
  leadName: "Jane Smith",
  leadPhone: "+447700900123",
  pickupAt: "2026-10-05T10:00:00.000Z",
  flightNumber: "BA117",
  status: "unassigned",
  ...overrides,
});

const probe = {
  leadName: "jane  smith",
  leadPhone: "07700 900123",
  pickupAt: new Date("2026-10-05T12:30:00Z"),
  flightNumber: "ba 117",
};

describe("possible duplicate jobs", () => {
  it("matches the same passenger around the same time, however it was typed", () => {
    const [match] = possibleDuplicates(probe, [existing({})]);
    expect(match?.reasons).toEqual([
      "same passenger phone",
      "same passenger name",
      "same flight that day",
    ]);
  });

  it("matches the same flight on the same London day even hours apart", () => {
    const matches = possibleDuplicates(
      { ...probe, leadName: "Someone Else", leadPhone: "07700900999" },
      [existing({ pickupAt: "2026-10-05T21:00:00.000Z" })],
    );
    expect(matches[0]?.reasons).toEqual(["same flight that day"]);
  });

  it("ignores the same passenger on another day, and cancelled jobs", () => {
    expect(
      possibleDuplicates({ ...probe, flightNumber: "" }, [
        existing({ pickupAt: "2026-10-07T10:00:00.000Z" }),
      ]),
    ).toEqual([]);
    expect(possibleDuplicates(probe, [existing({ status: "cancelled" })])).toEqual([]);
  });

  it("does not match on an empty flight number", () => {
    const matches = possibleDuplicates(
      {
        leadName: "A",
        leadPhone: "07700900111",
        pickupAt: probe.pickupAt,
        flightNumber: "",
      },
      [existing({ flightNumber: "", leadName: "B", leadPhone: "07700900222" })],
    );
    expect(matches).toEqual([]);
  });
});
