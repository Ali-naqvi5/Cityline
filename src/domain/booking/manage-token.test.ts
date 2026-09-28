import { describe, expect, it } from "vitest";

import { hashManageToken, manageTokenFor, manageTokenMatches } from "./manage-token";

const SECRET = "a-test-secret-that-is-at-least-thirty-two-characters";

describe("manageTokenFor", () => {
  it("is URL-safe, so it survives being emailed and clicked", () => {
    for (const reference of ["CL-7K4Q2P", "CL-000000", "CL-ZZZZZZ", "CL-1A2B3C"]) {
      // base64url only: no +, / or = to be mangled by a mail client.
      expect(manageTokenFor(reference, SECRET)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("gives the same token for the same booking, from any caller", () => {
    // The webhook and the returning browser must produce the same link, or one
    // of them shows the customer a link that does not open.
    expect(manageTokenFor("CL-7K4Q2P", SECRET)).toBe(manageTokenFor("CL-7K4Q2P", SECRET));
  });

  it("gives every booking a different token", () => {
    expect(manageTokenFor("CL-7K4Q2P", SECRET)).not.toBe(
      manageTokenFor("CL-7K4Q2Q", SECRET),
    );
  });

  it("depends on the server's secret, so a reference alone cannot produce it", () => {
    expect(manageTokenFor("CL-7K4Q2P", SECRET)).not.toBe(
      manageTokenFor("CL-7K4Q2P", `${SECRET}-rotated`),
    );
  });

  it("does not contain the reference", () => {
    expect(manageTokenFor("CL-7K4Q2P", SECRET)).not.toContain("7K4Q2P");
  });

  it("refuses to issue a link without a secret", () => {
    expect(() => manageTokenFor("CL-7K4Q2P", "")).toThrow(/PAYLOAD_SECRET/);
  });
});

describe("manageTokenMatches", () => {
  const token = manageTokenFor("CL-7K4Q2P", SECRET);

  it("accepts the token that produced the stored hash", () => {
    expect(manageTokenMatches(token, hashManageToken(token))).toBe(true);
  });

  it("rejects another booking's token", () => {
    const other = manageTokenFor("CL-7K4Q2Q", SECRET);
    expect(manageTokenMatches(other, hashManageToken(token))).toBe(false);
  });

  it("rejects an empty token, and an empty stored hash", () => {
    expect(manageTokenMatches("", hashManageToken(token))).toBe(false);
    expect(manageTokenMatches(token, "")).toBe(false);
  });

  it("rejects a truncated hash rather than throwing", () => {
    // timingSafeEqual throws on unequal lengths; a corrupt row must not 500
    // the page, it must simply fail to match.
    expect(manageTokenMatches(token, hashManageToken(token).slice(0, 20))).toBe(false);
  });

  it("stores a hash, not the token", () => {
    const hash = hashManageToken(token);

    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
