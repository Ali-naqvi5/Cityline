import { describe, expect, it } from "vitest";

import { createManageToken, hashManageToken, manageTokenMatches } from "./manage-token";

describe("createManageToken", () => {
  it("is URL-safe, so it survives being emailed and clicked", () => {
    for (let i = 0; i < 200; i += 1) {
      // base64url only: no +, / or = to be mangled by a mail client.
      expect(createManageToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("is long enough that guessing one is not worth attempting", () => {
    // 32 bytes as base64url.
    expect(createManageToken()).toHaveLength(43);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 2000 }, createManageToken));
    expect(seen.size).toBe(2000);
  });

  it("is not a booking reference", () => {
    // References are short and readable because they are spoken aloud. If this
    // ever became reference-shaped, the secret half of the lookup would be
    // guessable from a receipt.
    expect(createManageToken()).not.toMatch(/^CL-/);
  });
});

describe("manageTokenMatches", () => {
  it("accepts the token that produced the hash", () => {
    const token = createManageToken();
    expect(manageTokenMatches(token, hashManageToken(token))).toBe(true);
  });

  it("rejects a different token", () => {
    expect(
      manageTokenMatches(createManageToken(), hashManageToken(createManageToken())),
    ).toBe(false);
  });

  it("rejects an empty token, and an empty stored hash", () => {
    const token = createManageToken();
    expect(manageTokenMatches("", hashManageToken(token))).toBe(false);
    expect(manageTokenMatches(token, "")).toBe(false);
  });

  it("rejects a truncated hash rather than throwing", () => {
    // timingSafeEqual throws on unequal lengths; a corrupt row must not 500
    // the page, it must simply fail to match.
    const token = createManageToken();
    expect(manageTokenMatches(token, hashManageToken(token).slice(0, 20))).toBe(false);
  });

  it("stores a hash, not the token", () => {
    const token = createManageToken();
    const hash = hashManageToken(token);

    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes deterministically, so a link keeps working", () => {
    const token = createManageToken();
    expect(hashManageToken(token)).toBe(hashManageToken(token));
  });
});
