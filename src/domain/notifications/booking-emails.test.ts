import { describe, expect, it } from "vitest";

import {
  confirmationEmail,
  driverDetailsEmail,
  escapeHtml,
  officeNewBookingEmail,
  type BookingEmailData,
} from "./booking-emails";

const DATA: BookingEmailData = {
  reference: "CL-7K4Q2P",
  totalPence: 13600,
  isTest: false,
  customerName: "Aisha Rahman",
  customerEmail: "aisha@example.com",
  customerPhone: "+447700900123",
  manageUrl: "https://citylineairporttransfers.com/manage/CL-7K4Q2P?t=abc",
  adminUrl: "https://citylineairporttransfers.com/admin/collections/bookings/7",
  legs: [
    {
      leg: "outbound",
      pickupAt: new Date("2026-12-14T09:30:00Z"),
      pickup: "Heathrow Terminal 5",
      dropoff: "Hillingdon House, Wren Avenue, Uxbridge",
      via: [],
      hours: null,
      flightNumber: "BA117",
      vehicleName: "Executive saloon",
      passengers: 2,
      largeBags: 2,
      nameBoard: "Aisha Rahman",
    },
    {
      leg: "return",
      pickupAt: new Date("2026-12-21T14:00:00Z"),
      pickup: "Hillingdon House, Wren Avenue, Uxbridge",
      dropoff: "Heathrow Terminal 5",
      via: [],
      hours: null,
      flightNumber: null,
      vehicleName: "Executive saloon",
      passengers: 2,
      largeBags: 1,
      nameBoard: "Aisha Rahman",
    },
  ],
  extras: [{ name: "Child seat (15 months – 4 years)", quantity: 1 }],
  notes: "Buzzer code 4411",
};

describe("confirmationEmail", () => {
  const email = confirmationEmail(DATA);

  it("names the booking and the day in the subject", () => {
    expect(email.subject).toBe("Booking confirmed: CL-7K4Q2P · 14 Dec 2026");
  });

  it("carries the reference, both journeys, the total and the manage link", () => {
    for (const part of [email.html, email.text]) {
      expect(part).toContain("CL-7K4Q2P");
      expect(part).toContain("£136.00");
      expect(part).toContain("manage/CL-7K4Q2P?t=abc");
      expect(part).toContain("BA117");
    }
    expect(email.html).toContain("Outbound journey");
    expect(email.html).toContain("Return journey");
    expect(email.text).toContain("OUTBOUND JOURNEY");
    expect(email.text).toContain("RETURN JOURNEY");
  });

  it("shows pickup times in London time", () => {
    // 09:30 UTC in December is 09:30 London; 14:00 likewise.
    expect(email.text).toContain("14 Dec 2026 at 09:30");
    expect(email.text).toContain("21 Dec 2026 at 14:00");
  });

  it("lists extras", () => {
    expect(email.text).toContain("1 × Child seat (15 months – 4 years)");
  });

  it("does not show the office's notes back to the customer", () => {
    expect(email.text).not.toContain("Buzzer code");
  });
});

describe("officeNewBookingEmail", () => {
  it("gives the office what it needs to dispatch", () => {
    const email = officeNewBookingEmail(DATA);
    for (const needed of [
      "CL-7K4Q2P",
      "+447700900123",
      "aisha@example.com",
      "Buzzer code 4411",
      "£136.00",
      "admin/collections/bookings/7",
    ]) {
      expect(email.text).toContain(needed);
    }
    expect(email.subject).toBe("New booking CL-7K4Q2P · 14 Dec 2026 09:30");
  });

  it("marks a test booking so nobody sends a car", () => {
    const email = officeNewBookingEmail({ ...DATA, isTest: true });
    expect(email.subject.startsWith("[TEST] ")).toBe(true);
    expect(email.text).toContain("TEST BOOKING");
    expect(email.html).toContain("No car needed");
  });
});

describe("escaping", () => {
  it("escapes the five HTML characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });

  it("turns markup typed into an address into harmless text", () => {
    const hostile = {
      ...DATA,
      customerName: `<img src=x onerror=alert(1)>`,
      legs: [{ ...DATA.legs[0]!, pickup: `<a href="https://evil.example">Click</a>` }],
    };
    for (const email of [confirmationEmail(hostile), officeNewBookingEmail(hostile)]) {
      expect(email.html).not.toContain("<img src=x");
      expect(email.html).not.toContain('<a href="https://evil.example"');
      expect(email.html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;");
    }
  });
});

describe("driverDetailsEmail", () => {
  const email = driverDetailsEmail({
    reference: "CL-7K4Q2P",
    pickupAt: new Date("2026-10-05T10:00:00Z"),
    pickup: "Heathrow Terminal 5",
    driverFirstName: "Sam",
    phvLicence: "PHV-123456",
    vehicle: "Toyota Prius",
    colour: "Black",
    registration: "AB12CDE",
  });

  it("says who is coming and in what, in London time", () => {
    expect(email.subject).toBe("Your driver for 5 Oct 2026 at 11:00: Sam, AB12CDE");
    for (const part of [email.html, email.text]) {
      expect(part).toContain("Sam");
      expect(part).toContain("PHV-123456");
      expect(part).toContain("Black Toyota Prius");
      expect(part).toContain("AB12CDE");
      expect(part).toContain("Transport for London");
    }
  });

  it("gives the office number, never a driver's surname or phone", () => {
    expect(email.text).toContain("+44 7926 608888");
    expect(email.text).not.toMatch(/Taylor|\+447700/);
  });
});
