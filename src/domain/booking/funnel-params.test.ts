import { describe, expect, it } from "vitest";

import {
  funnelQuery,
  hasJourney,
  largestParty,
  parseFunnelParams,
  returnLegOf,
} from "./funnel-params";

describe("parseFunnelParams", () => {
  it("reads a full journey", () => {
    const journey = parseFunnelParams({
      pickup: "Mayfair W1J",
      dropoff: "Heathrow Terminal 5",
      via: ["Kensington W8"],
      date: "2027-03-14",
      time: "09:00",
      return: "yes",
      returnDate: "2027-03-21",
      returnTime: "17:30",
      flightNumber: "ba 117",
      passengers: "3",
      bags: "2",
    });

    expect(journey.pickup).toBe("Mayfair W1J");
    expect(journey.via).toEqual(["Kensington W8"]);
    expect(journey.returnJourney).toBe(true);
    expect(journey.passengers).toBe(3);
    expect(journey.flightNumber).toBe("BA117");
  });

  it("falls back to one passenger when the count is missing or junk", () => {
    // Number("") is 0 and passes an integer check, so this needs its own guard:
    // a party of nobody would make every vehicle look big enough.
    expect(parseFunnelParams({}).passengers).toBe(1);
    expect(parseFunnelParams({ passengers: "" }).passengers).toBe(1);
    expect(parseFunnelParams({ passengers: "two" }).passengers).toBe(1);
    expect(parseFunnelParams({ passengers: "-2" }).passengers).toBe(1);
    expect(parseFunnelParams({ passengers: "2.5" }).passengers).toBe(1);
  });

  it("allows zero bags but not a missing value becoming something else", () => {
    expect(parseFunnelParams({ bags: "0" }).bags).toBe(0);
    expect(parseFunnelParams({}).bags).toBe(0);
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(parseFunnelParams({ pickup: ["Mayfair", "Soho"] }).pickup).toBe("Mayfair");
  });

  it("keeps every via stop, and drops the empty ones", () => {
    expect(parseFunnelParams({ via: ["Soho", "", "  ", "Camden"] }).via).toEqual([
      "Soho",
      "Camden",
    ]);
  });

  it("treats anything but yes as no return journey", () => {
    expect(parseFunnelParams({ return: "no" }).returnJourney).toBe(false);
    expect(parseFunnelParams({}).returnJourney).toBe(false);
  });
});

describe("funnelQuery", () => {
  it("round-trips a journey through the query string", () => {
    const original = parseFunnelParams({
      pickup: "Mayfair W1J",
      dropoff: "Heathrow Terminal 5",
      date: "2027-03-14",
      time: "09:00",
      passengers: "3",
      bags: "2",
      flightNumber: "BA117",
    });

    const roundTripped = parseFunnelParams(
      Object.fromEntries(new URLSearchParams(funnelQuery(original))),
    );

    expect(roundTripped).toEqual(original);
  });

  it("leaves empty values out, so the URL stays readable", () => {
    const query = funnelQuery({ pickup: "Mayfair", dropoff: "", passengers: 2 });

    expect(query).toContain("pickup=Mayfair");
    expect(query).not.toContain("dropoff");
    expect(query).not.toContain("notes");
  });

  it("only carries return details when there is a return journey", () => {
    expect(funnelQuery({ returnJourney: false, returnDate: "2027-03-21" })).not.toContain(
      "returnDate",
    );
    expect(funnelQuery({ returnJourney: true, returnDate: "2027-03-21" })).toContain(
      "returnDate=2027-03-21",
    );
  });

  it("repeats the via parameter for each stop", () => {
    expect(funnelQuery({ via: ["Soho", "Camden"] })).toBe("via=Soho&via=Camden");
  });
});

describe("hasJourney", () => {
  const complete = {
    pickup: "Mayfair",
    dropoff: "Heathrow",
    date: "2027-03-14",
    time: "09:00",
  };

  it("needs where, where to, and when", () => {
    expect(hasJourney(parseFunnelParams(complete))).toBe(true);
  });

  it("is false when any of those is missing", () => {
    for (const key of Object.keys(complete)) {
      const partial = { ...complete, [key]: "" };
      expect(hasJourney(parseFunnelParams(partial))).toBe(false);
    }
  });
});

describe("service modes", () => {
  it("defaults to a route journey", () => {
    expect(parseFunnelParams({}).service).toBe("route");
    expect(parseFunnelParams({ service: "nonsense" }).service).toBe("route");
  });

  it("reads an hourly hire", () => {
    const params = parseFunnelParams({ service: "hourly", hours: "5" });

    expect(params.service).toBe("hourly");
    expect(params.hours).toBe(5);
  });
});

describe("hasJourney", () => {
  const base = { pickup: "Mayfair", date: "2026-12-01", time: "09:30" };

  it("needs a drop-off for a route journey", () => {
    expect(hasJourney(parseFunnelParams(base))).toBe(false);
    expect(hasJourney(parseFunnelParams({ ...base, dropoff: "Heathrow" }))).toBe(true);
  });

  it("needs hours rather than a drop-off for an hourly hire", () => {
    expect(hasJourney(parseFunnelParams({ ...base, service: "hourly" }))).toBe(false);
    expect(
      hasJourney(parseFunnelParams({ ...base, service: "hourly", hours: "4" })),
    ).toBe(true);
  });

  it("still needs a pickup, date and time either way", () => {
    expect(hasJourney(parseFunnelParams({ dropoff: "Heathrow" }))).toBe(false);
  });
});

describe("returnLegOf", () => {
  const outbound = {
    pickup: "Mayfair",
    dropoff: "Heathrow T5",
    date: "2026-12-01",
    time: "09:30",
    passengers: "3",
    bags: "4",
  };

  it("is null when no return was asked for", () => {
    expect(returnLegOf(parseFunnelParams(outbound))).toBeNull();
  });

  it("mirrors the outbound journey when the return fields are blank", () => {
    const leg = returnLegOf(parseFunnelParams({ ...outbound, return: "yes" }));

    expect(leg?.pickup).toBe("Heathrow T5");
    expect(leg?.dropoff).toBe("Mayfair");
    expect(leg?.passengers).toBe(3);
    expect(leg?.bags).toBe(4);
  });

  it("prefers what the customer actually entered", () => {
    const leg = returnLegOf(
      parseFunnelParams({
        ...outbound,
        return: "yes",
        returnPickup: "Gatwick North",
        returnPassengers: "5",
      }),
    );

    expect(leg?.pickup).toBe("Gatwick North");
    expect(leg?.dropoff).toBe("Mayfair"); // still mirrored
    expect(leg?.passengers).toBe(5);
  });

  it("has no return leg on an hourly hire", () => {
    expect(
      returnLegOf(parseFunnelParams({ ...outbound, service: "hourly", return: "yes" })),
    ).toBeNull();
  });
});

describe("largestParty", () => {
  it("sizes the vehicle for the busiest leg", () => {
    // Four out, five back still needs a car that seats five.
    const params = parseFunnelParams({
      pickup: "Mayfair",
      dropoff: "Heathrow T5",
      date: "2026-12-01",
      time: "09:30",
      passengers: "4",
      bags: "2",
      return: "yes",
      returnPassengers: "5",
      returnBags: "1",
    });

    expect(largestParty(params)).toEqual({ passengers: 5, largeBags: 2 });
  });

  it("is just the outbound party without a return leg", () => {
    const params = parseFunnelParams({ passengers: "2", bags: "3" });

    expect(largestParty(params)).toEqual({ passengers: 2, largeBags: 3 });
  });
});

describe("funnelQuery round trip", () => {
  it("carries an hourly hire through unchanged", () => {
    const original = parseFunnelParams({
      service: "hourly",
      pickup: "Mayfair",
      date: "2026-12-01",
      time: "09:30",
      hours: "5",
      passengers: "3",
      bags: "1",
    });

    const round = parseFunnelParams(
      Object.fromEntries(new URLSearchParams(funnelQuery(original))),
    );

    expect(round).toEqual(original);
  });

  it("carries a return journey through unchanged", () => {
    const original = parseFunnelParams({
      pickup: "Mayfair",
      dropoff: "Heathrow T5",
      via: ["Paddington"],
      date: "2026-12-01",
      time: "09:30",
      return: "yes",
      returnPickup: "Heathrow T5",
      returnDropoff: "Mayfair",
      returnDate: "2026-12-08",
      returnTime: "18:00",
      returnPassengers: "2",
      returnBags: "2",
      passengers: "2",
      bags: "2",
    });

    const query = new URLSearchParams(funnelQuery(original));
    const round = parseFunnelParams({
      ...Object.fromEntries(query),
      via: query.getAll("via"),
      returnVia: query.getAll("returnVia"),
    });

    expect(round).toEqual(original);
  });

  it("drops hours from a route journey", () => {
    const query = funnelQuery(parseFunnelParams({ pickup: "Mayfair", hours: "5" }));

    expect(query).not.toContain("hours");
  });
});
