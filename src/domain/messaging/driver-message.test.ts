import { describe, expect, it } from "vitest";

import { driverMessage, whatsappLink, type DriverMessageJob } from "./driver-message";

const job: DriverMessageJob = {
  reference: "J-000123",
  pickupAt: new Date("2026-10-05T10:00:00Z"), // 11:00 in London (BST)
  pickupAddress: "Heathrow Terminal 5",
  viaStops: ["Ealing Broadway"],
  dropoffAddress: "10 Wren Avenue, Uxbridge",
  hours: null,
  flightNumber: "BA117",
  leadName: "Jane Smith",
  leadPhone: "+447700900123",
  nameBoard: "SMITH",
  meetAndGreet: true,
  passengers: 2,
  largeBags: 2,
  smallBags: 1,
  vehicleClass: "Saloon",
  extras: [{ name: "Child seat", quantity: 1 }],
  driverNotes: "Call on landing",
  cashToCollectPence: null,
  payPence: null,
};

describe("the driver's WhatsApp job message", () => {
  it("carries everything the driver needs, in London time", () => {
    const text = driverMessage("new", job, "+44 7926 608888");
    expect(text).toContain("*NEW JOB J-000123*");
    expect(text).toContain("*Mon 5 Oct 2026, 11:00*");
    expect(text).toContain("Pickup: Heathrow Terminal 5");
    expect(text).toContain("Flight: BA117");
    expect(text).toContain("Stop 1: Ealing Broadway");
    expect(text).toContain("Drop-off: 10 Wren Avenue, Uxbridge");
    expect(text).toContain("Passenger: Jane Smith, +447700900123");
    expect(text).toContain("Passengers: 2 · Bags: 2 large, 1 small");
    expect(text).toContain("Extras: 1 × Child seat");
    expect(text).toContain('name board reading "SMITH"');
    expect(text).toContain("Notes: Call on landing");
    expect(text).toContain("Office: +44 7926 608888");
    expect(text).not.toContain("cash");
    expect(text).not.toContain("pay");
  });

  it("shows cash to collect and pay only when set", () => {
    const text = driverMessage(
      "update",
      { ...job, cashToCollectPence: 5500, payPence: 3500 },
      "+44 7926 608888",
    );
    expect(text).toContain("*UPDATED JOB J-000123*");
    expect(text).toContain("*Collect in cash: £55.00*");
    expect(text).toContain("Your pay: £35.00");
  });

  it("tells a driver plainly when a job is taken away or cancelled", () => {
    const removed = driverMessage("removed", job, "+44 7926 608888");
    expect(removed).toContain("*JOB REMOVED J-000123*");
    expect(removed).toContain("Please do not attend.");
    expect(removed).not.toContain("Jane Smith");
    expect(driverMessage("cancelled", job, "+44 7926 608888")).toContain(
      "This job is cancelled.",
    );
  });

  it("links to WhatsApp with the number's digits and the text encoded", () => {
    expect(whatsappLink("+447700900456", "Hi & bye")).toBe(
      "https://wa.me/447700900456?text=Hi%20%26%20bye",
    );
  });
});
