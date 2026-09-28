import { describe, expect, it } from "vitest";

import { buildCalendar, calendarFilename, type CalendarEvent } from "./calendar";

const NOW = new Date("2026-09-28T10:00:00Z");

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    reference: "CL-7K4Q2P",
    leg: "outbound",
    pickupAt: new Date("2026-10-14T05:30:00Z"),
    pickup: "Heathrow Terminal 5",
    dropoff: "Hillingdon House, Wren Avenue, Uxbridge",
    passengers: 2,
    vehicleName: "Executive Saloon",
    manageUrl: "https://citylineairporttransfers.com/manage/CL-7K4Q2P?t=abc",
    ...overrides,
  };
}

/** Unfolds continuation lines so a property can be asserted as one string. */
function properties(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n");
}

describe("buildCalendar", () => {
  it("produces one VEVENT per leg in a single file", () => {
    const ics = buildCalendar(
      [event(), event({ leg: "return", pickupAt: new Date("2026-10-21T14:00:00Z") })],
      NOW,
    );

    // A return booking must import as two appointments from one attachment.
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
  });

  it("writes DTSTART as a fixed UTC instant", () => {
    // The whole point of storing UTC: a passenger who lands in a different
    // timezone must still see 06:30 London, not a shifted local time.
    expect(properties(buildCalendar([event()], NOW))).toContain(
      "DTSTART:20261014T053000Z",
    );
  });

  it("gives the event an end time so it is not instantaneous", () => {
    expect(properties(buildCalendar([event()], NOW))).toContain("DTEND:20261014T070000Z");
  });

  it("blocks out the booked duration for an hourly hire", () => {
    const ics = properties(buildCalendar([event({ dropoff: "", hours: 4 })], NOW));

    expect(ics).toContain("DTSTART:20261014T053000Z");
    expect(ics).toContain("DTEND:20261014T093000Z");
  });

  it("escapes the commas in an address", () => {
    // An unescaped comma ends the property early, truncating the location to
    // "Hillingdon House" — and the passenger is dropped at the wrong place.
    const location = properties(buildCalendar([event()], NOW)).find((line) =>
      line.startsWith("LOCATION:"),
    );

    expect(
      properties(buildCalendar([event({ pickup: "Flat 2, 14 Wren Ave" })], NOW)),
    ).toContain("LOCATION:Flat 2\\, 14 Wren Ave");
    expect(location).toBe("LOCATION:Heathrow Terminal 5");
  });

  it("escapes semicolons, newlines and backslashes", () => {
    const ics = buildCalendar(
      [event({ pickup: "Gate 3; rear entrance\nvia \\service road" })],
      NOW,
    );

    expect(properties(ics)).toContain(
      "LOCATION:Gate 3\\; rear entrance\\nvia \\\\service road",
    );
  });

  it("carries the reference and the manage link, so the file is self-contained", () => {
    const ics = buildCalendar([event()], NOW);

    expect(ics).toContain("UID:CL-7K4Q2P-outbound@citylineairporttransfers.com");
    expect(ics).toContain("CL-7K4Q2P");
    expect(ics).toContain("manage/CL-7K4Q2P?t=abc");
  });

  it("keeps the UID stable so an amendment updates rather than duplicates", () => {
    const first = buildCalendar([event()], NOW);
    const amended = buildCalendar(
      [event({ pickupAt: new Date("2026-10-14T07:00:00Z") })],
      new Date("2026-09-29T11:00:00Z"),
    );

    const uid = (ics: string) => properties(ics).find((l) => l.startsWith("UID:"));
    expect(uid(amended)).toBe(uid(first));
    // ...but the time did move, otherwise the calendar shows the old pickup.
    expect(amended).toContain("DTSTART:20261014T070000Z");
  });

  it("gives outbound and return different UIDs", () => {
    const ics = properties(buildCalendar([event(), event({ leg: "return" })], NOW));
    const uids = ics.filter((line) => line.startsWith("UID:"));

    expect(new Set(uids).size).toBe(2);
  });

  it("uses CRLF line endings and ends with one", () => {
    const ics = buildCalendar([event()], NOW);

    // Outlook is strict about this; a bare-LF file is silently ignored.
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").some((line) => line.includes("\n"))).toBe(false);
  });

  it("folds lines to 75 octets", () => {
    const ics = buildCalendar(
      [
        event({
          pickup:
            "The Long Named Hotel and Conference Centre, 128 Somewhere Very Long Road, Uxbridge, Greater London",
        }),
      ],
      NOW,
    );

    for (const line of ics.split("\r\n")) {
      expect(Buffer.from(line, "utf8").length, line).toBeLessThanOrEqual(75);
    }
  });

  it("never splits a multi-byte character when folding", () => {
    // A £ sign or an accent is two bytes in UTF-8. Folding on character count
    // splits one down the middle and the file stops being valid UTF-8.
    const ics = buildCalendar(
      [event({ pickup: `Café Küçük — ${"£120 pré-paid ".repeat(6)}` })],
      NOW,
    );

    expect(ics).not.toContain("\uFFFD");
    expect(properties(ics).join("")).toContain("Café Küçük");
  });

  it("unfolds back to exactly what went in", () => {
    const pickup = `Terminal 5 arrivals — meeting point ${"A".repeat(120)}`;
    const ics = buildCalendar([event({ pickup })], NOW);

    expect(properties(ics)).toContain(`LOCATION:${pickup}`);
  });

  it("publishes rather than invites", () => {
    // METHOD:REQUEST makes some clients RSVP to an address that does not
    // accept replies.
    expect(properties(buildCalendar([event()], NOW))).toContain("METHOD:PUBLISH");
  });

  it("sets a reminder the night before, while there is still time to change it", () => {
    expect(properties(buildCalendar([event()], NOW))).toContain("TRIGGER:-PT12H");
  });

  it("names the file after the booking", () => {
    expect(calendarFilename("CL-7K4Q2P")).toBe("cityline-CL-7K4Q2P.ics");
  });
});
