import { describe, expect, it } from "vitest";

import { customerData, customerSchema } from "./customer";

const valid = { name: "Jane Smith", phone: "07700 900123", email: "", notes: "" };

describe("the customer form", () => {
  it("stores the phone as +44 and the email in lower case", () => {
    const data = customerData(
      customerSchema.parse({ ...valid, email: "Jane@Example.com", notes: " VIP " }),
    );
    expect(data).toEqual({
      name: "Jane Smith",
      phone: "+447700900123",
      email: "jane@example.com",
      notes: "VIP",
    });
  });

  it("lets the email be empty for someone who booked by phone", () => {
    expect(customerData(customerSchema.parse(valid)).email).toBeNull();
  });

  it("refuses a phone that cannot be dialled and a broken email", () => {
    expect(customerSchema.safeParse({ ...valid, phone: "123" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...valid, email: "jane@" }).success).toBe(false);
  });
});
