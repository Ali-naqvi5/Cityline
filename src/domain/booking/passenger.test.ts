import { describe, expect, it } from "vitest";

import { nameBoardText, normalisePhone, passengerDetailsSchema } from "./passenger";

function details(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Jamie",
    lastName: "Okonkwo",
    email: "Jamie@Example.com",
    phone: "07700 900123",
    acceptedTerms: true,
    ...overrides,
  };
}

describe("normalisePhone", () => {
  it("normalises the ways people write a UK mobile", () => {
    // Ofcom's 07700 900xxx range is reserved for drama, so it is safe in tests.
    expect(normalisePhone("07700 900123")).toBe("+447700900123");
    expect(normalisePhone("07700900123")).toBe("+447700900123");
    expect(normalisePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalisePhone("0044 7700 900123")).toBe("+447700900123");
    expect(normalisePhone("(07700) 900-123")).toBe("+447700900123");
  });

  it("keeps international numbers as given", () => {
    expect(normalisePhone("+1 415 555 0123")).toBe("+14155550123");
    expect(normalisePhone("+33 6 12 34 56 78")).toBe("+33612345678");
  });

  it("normalises UK landlines too", () => {
    expect(normalisePhone("020 7946 0812")).toBe("+442079460812");
  });

  it("rejects what cannot be dialled", () => {
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone("   ")).toBeNull();
    expect(normalisePhone("not a phone")).toBeNull();
    expect(normalisePhone("12345")).toBeNull(); // no country code, no leading 0
    expect(normalisePhone("0770")).toBeNull(); // too short
    expect(normalisePhone("+0123456789")).toBeNull(); // country codes never start 0
  });
});

describe("passengerDetailsSchema", () => {
  it("accepts an ordinary booking and lowercases the email", () => {
    const result = passengerDetailsSchema.safeParse(details());

    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("jamie@example.com");
    expect(result.data?.phone).toBe("+447700900123");
  });

  it("requires the terms to be accepted (CMP-11)", () => {
    const result = passengerDetailsSchema.safeParse(details({ acceptedTerms: false }));

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("terms");
  });

  it("rejects an invalid email", () => {
    expect(passengerDetailsSchema.safeParse(details({ email: "jamie@" })).success).toBe(
      false,
    );
  });

  it("rejects a name with no letters in it", () => {
    expect(passengerDetailsSchema.safeParse(details({ firstName: "123" })).success).toBe(
      false,
    );
    expect(passengerDetailsSchema.safeParse(details({ lastName: "  " })).success).toBe(
      false,
    );
  });

  it("does not ask for passenger details when booking for yourself", () => {
    expect(passengerDetailsSchema.safeParse(details()).success).toBe(true);
  });

  it("insists on the travelling passenger's name and number when booking for someone else", () => {
    const result = passengerDetailsSchema.safeParse(
      details({ bookingForSomeoneElse: true }),
    );

    expect(result.success).toBe(false);
    const issues = JSON.stringify(result.error?.issues);
    expect(issues).toContain("name of the passenger travelling");
    expect(issues).toContain("mobile number for the passenger");
  });

  it("checks the travelling passenger's number is dialable", () => {
    const result = passengerDetailsSchema.safeParse(
      details({
        bookingForSomeoneElse: true,
        passengerName: "Ama Boateng",
        passengerPhone: "nonsense",
      }),
    );

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("reach the passenger");
  });

  it("accepts a complete booking on someone else's behalf", () => {
    const result = passengerDetailsSchema.safeParse(
      details({
        bookingForSomeoneElse: true,
        passengerName: "Ama Boateng",
        passengerPhone: "+44 7700 900456",
      }),
    );

    expect(result.success).toBe(true);
  });
});

describe("nameBoardText", () => {
  it("uses the booker's name for their own journey", () => {
    expect(nameBoardText({ firstName: "Jamie", lastName: "Okonkwo" })).toBe(
      "Jamie Okonkwo",
    );
  });

  it("uses the travelling passenger's name when there is one", () => {
    expect(
      nameBoardText({
        firstName: "Jamie",
        lastName: "Okonkwo",
        bookingForSomeoneElse: true,
        passengerName: "Ama Boateng",
      }),
    ).toBe("Ama Boateng");
  });

  it("falls back to the booker if the passenger name is somehow missing", () => {
    expect(
      nameBoardText({
        firstName: "Jamie",
        lastName: "Okonkwo",
        bookingForSomeoneElse: true,
      }),
    ).toBe("Jamie Okonkwo");
  });
});
