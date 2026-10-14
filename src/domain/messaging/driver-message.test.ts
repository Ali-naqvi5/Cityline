import { describe, expect, it } from "vitest";

import {
  driverDayMessage,
  driverMessage,
  paymentMessage,
  whatsappLink,
  type DriverMessageJob,
} from "./driver-message";

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
    expect(text).not.toContain("Your price");
  });

  it("shows cash to collect and the driver's price only when set", () => {
    const text = driverMessage(
      "update",
      { ...job, cashToCollectPence: 5500, payPence: 3500 },
      "+44 7926 608888",
    );
    expect(text).toContain("*UPDATED JOB J-000123*");
    expect(text).toContain("*Collect in cash: £55.00*");
    expect(text).toContain("Your price: £35.00");
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

describe("the driver's day on WhatsApp", () => {
  const later: DriverMessageJob = {
    ...job,
    reference: "J-000124",
    pickupAt: new Date("2026-10-05T15:30:00Z"), // 16:30 in London
    pickupAddress: "10 Wren Avenue, Uxbridge",
    dropoffAddress: "Gatwick North",
    flightNumber: null,
    viaStops: [],
    payPence: 4000,
  };
  const text = driverDayMessage(
    "Sam",
    [later, { ...job, payPence: 3500 }],
    "+44 7926 608888",
  );

  it("lists every job in pickup order, with the passenger's number and the price", () => {
    expect(text.startsWith("*YOUR JOBS · Mon 5 Oct 2026*")).toBe(true);
    expect(text).toContain("Sam, here are your 2 jobs in pickup order.");
    expect(text.indexOf("*1. 11:00 · J-000123*")).toBeLessThan(
      text.indexOf("*2. 16:30 · J-000124*"),
    );
    expect(text).toContain("Passenger: Jane Smith, +447700900123");
    expect(text).toContain("Your price: £35.00");
    expect(text).toContain("Your price: £40.00");
    expect(text.trimEnd().endsWith("Please reply OK to confirm.")).toBe(true);
  });

  it("speaks of one job as one job", () => {
    expect(driverDayMessage("Sam", [job], "+44 7926 608888")).toContain(
      "Sam, here is your job.",
    );
  });
});

describe("the payment note on WhatsApp", () => {
  const payment = {
    reference: "DP-000012",
    paidAt: new Date("2026-10-06T11:00:00Z"),
    periodFrom: new Date("2026-09-29T11:00:00Z"),
    upTo: new Date("2026-10-05T11:00:00Z"),
    method: "Bank transfer",
    bankReference: "CITYLINE 12",
    bookings: 3,
    earnedPence: 14000,
    cashPence: 5500,
    amountPence: 8500,
    statementUrl: "https://example.com/api/statements/abc",
  };

  it("says what was paid, how, for what, with the statement link", () => {
    const text = paymentMessage("Sam", payment, "+44 7926 608888");
    expect(text).toContain("*PAYMENT STATEMENT DP-000012*");
    expect(text).toContain(
      "Sam, we paid you £85.00 on 6 Oct 2026 by bank transfer (reference CITYLINE 12).",
    );
    expect(text).toContain("3 bookings, 29 Sept – 5 Oct 2026: £140.00");
    expect(text).toContain("Less cash you collected: £55.00");
    expect(text).toContain("Paid to you: £85.00");
    expect(text).toContain(
      "Your statement (PDF): https://example.com/api/statements/abc",
    );
  });

  it("says so when the driver paid Cityline instead", () => {
    const text = paymentMessage(
      "Sam",
      { ...payment, cashPence: 20000, amountPence: -6000, bankReference: null },
      "+44 7926 608888",
    );
    expect(text).toContain("this settles £60.00 you paid Cityline");
    expect(text).toContain("You paid Cityline: £60.00");
  });
});
