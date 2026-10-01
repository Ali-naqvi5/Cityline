import { describe, expect, it } from "vitest";

import { matchCustomer, sameName, type CustomerCandidate } from "./match";

const jane: CustomerCandidate = {
  id: 1,
  name: "Jane Smith",
  phone: "+447700900123",
  email: "jane@example.com",
};
const john: CustomerCandidate = { id: 2, name: "John Smith", phone: "+447700900123" };

describe("matching a booking to a customer", () => {
  it("prefers the email, whatever the name or phone", () => {
    expect(
      matchCustomer(
        { name: "J Smith", phone: "+447700900999", email: "JANE@example.com" },
        [jane],
        [],
      ),
    ).toBe(jane);
  });

  it("matches a phone only when the name matches too", () => {
    expect(
      matchCustomer({ name: "john  smith", phone: "+447700900123" }, [], [jane, john]),
    ).toBe(john);
    expect(
      matchCustomer({ name: "Ahmed Khan", phone: "+447700900123" }, [], [jane, john]),
    ).toBeNull();
  });

  it("finds nobody for a new person", () => {
    expect(
      matchCustomer({ name: "New Person", phone: "+447700900555", email: "" }, [], []),
    ).toBeNull();
  });

  it("compares names without case, spaces or full stops", () => {
    expect(sameName("J. Smith", "j smith")).toBe(true);
    expect(sameName("Jane Smith", "Jane Smyth")).toBe(false);
    expect(sameName("", "")).toBe(false);
  });
});
