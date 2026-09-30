import { beforeAll, describe, expect, it } from "vitest";

import {
  normaliseBankDetails,
  open,
  openBankDetails,
  seal,
  sealBankDetails,
} from "./sealed";

beforeAll(() => {
  process.env.PAYLOAD_SECRET ??= "test-secret-test-secret-test-secret-12";
});

describe("sealed values", () => {
  it("round-trips, and differs every time it is sealed", () => {
    const first = seal("12-34-56 12345678");
    expect(first).not.toContain("12345678");
    expect(open(first)).toBe("12-34-56 12345678");
    expect(seal("12-34-56 12345678")).not.toBe(first);
  });

  it("refuses a tampered or foreign value", () => {
    const sealed = seal("secret");
    const parts = sealed.split(".");
    const tampered = [parts[0], parts[1], parts[2], `A${parts[3]!.slice(1)}`].join(".");
    expect(open(tampered)).toBeNull();
    expect(open("not-ours")).toBeNull();
    expect(open(null)).toBeNull();
  });

  it("seals bank details as a whole", () => {
    const sealed = sealBankDetails({
      accountName: "A Driver",
      sortCode: "12-34-56",
      accountNumber: "12345678",
    });
    expect(openBankDetails(sealed)).toEqual({
      accountName: "A Driver",
      sortCode: "12-34-56",
      accountNumber: "12345678",
    });
  });
});

describe("normaliseBankDetails", () => {
  it("accepts UK sort codes and account numbers however they are typed", () => {
    expect(
      normaliseBankDetails({
        accountName: " A Driver ",
        sortCode: "123456",
        accountNumber: "1234 5678",
      }),
    ).toEqual({
      accountName: "A Driver",
      sortCode: "12-34-56",
      accountNumber: "12345678",
    });
  });

  it("rejects anything that cannot be a UK account", () => {
    expect(
      normaliseBankDetails({
        accountName: "A",
        sortCode: "1234",
        accountNumber: "12345678",
      }),
    ).toBeNull();
    expect(
      normaliseBankDetails({
        accountName: "A",
        sortCode: "123456",
        accountNumber: "123",
      }),
    ).toBeNull();
    expect(
      normaliseBankDetails({
        accountName: "",
        sortCode: "123456",
        accountNumber: "12345678",
      }),
    ).toBeNull();
  });
});
