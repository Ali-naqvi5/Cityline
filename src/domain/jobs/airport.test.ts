import { describe, expect, it } from "vitest";

import { airportOf } from "./airport";

describe("airportOf", () => {
  it("names Heathrow's terminal, however the address is written", () => {
    expect(airportOf("Heathrow Terminal 5")?.label).toBe("Heathrow T5");
    expect(airportOf("Terminal 3, Nelson Rd, Longford")?.label).toBe("Heathrow T3");
    expect(airportOf("Terminal 4, Hounslow TW6 3XA")?.label).toBe("Heathrow T4");
    expect(airportOf("London Heathrow Airport (LHR)")?.label).toBe("Heathrow");
  });

  it("tells Gatwick's North and South terminals apart", () => {
    expect(airportOf("North Terminal, Departures Rd, Gatwick")?.label).toBe(
      "Gatwick North",
    );
    expect(airportOf("Gatwick South")?.label).toBe("Gatwick South");
    expect(airportOf("London Gatwick Airport (LGW)")?.label).toBe("Gatwick");
  });

  it("knows the other London airports", () => {
    expect(airportOf("London Stansted Airport (STN)")?.airport).toBe("Stansted");
    expect(airportOf("London Luton Airport (LTN)")?.airport).toBe("Luton");
    expect(airportOf("London City Airport, Hartmann Rd")?.airport).toBe("London City");
    expect(airportOf("Birmingham Airport")?.airport).toBe("Other airport");
  });

  it("does not mistake streets for airports", () => {
    expect(airportOf("Stanstead Road, SE23")).toBeNull();
    expect(airportOf("Lutonia Road")).toBeNull();
    expect(airportOf("10 Wren Avenue, Uxbridge")).toBeNull();
  });
});
