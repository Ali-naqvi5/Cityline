import { describe, expect, it } from "vitest";

import { serviceType } from "./service";

describe("serviceType", () => {
  it("reads an airport or terminal in the pickup as from the airport", () => {
    for (const pickupAddress of [
      "Terminal 3, Nelson Rd, Longford",
      "London Stansted Airport (STN)",
      "North Terminal, Departures Rd, Gatwick",
      "Heathrow Terminal 5",
    ]) {
      expect(
        serviceType({ pickupAddress, dropoffAddress: "29 Dawson Place, London W2" }),
      ).toBe("from_airport");
    }
  });

  it("reads an airport drop-off as to the airport", () => {
    expect(
      serviceType({
        pickupAddress: "Alexandra Hotel, 159-161 Sussex Gardens",
        dropoffAddress: "Terminal 2, Inner Ring E, Hounslow",
      }),
    ).toBe("to_airport");
  });

  it("tells transfers, airport-to-airport and hourly hire apart", () => {
    expect(
      serviceType({ pickupAddress: "Uxbridge", dropoffAddress: "Ealing Broadway" }),
    ).toBe("transfer");
    expect(
      serviceType({
        pickupAddress: "Heathrow Terminal 5",
        dropoffAddress: "Gatwick South",
      }),
    ).toBe("airport_to_airport");
    expect(
      serviceType({ pickupAddress: "Mayfair", dropoffAddress: null, hours: 4 }),
    ).toBe("hourly");
  });

  it("does not mistake a street name for an airport", () => {
    expect(
      serviceType({
        pickupAddress: "Lutonia Road",
        dropoffAddress: "Stanstead Road, SE23",
      }),
    ).toBe("transfer");
  });
});
