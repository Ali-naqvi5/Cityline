import { describe, expect, it } from "vitest";

import { statementToken, verifyStatementToken } from "./statement-link";

const SECRET = "a-test-secret-that-is-long-enough-for-hkdf";
const now = new Date("2026-10-06T12:00:00Z");
const later = new Date("2026-12-05T12:00:00Z");

describe("payment statement links", () => {
  it("opens the payment it was made for, until it expires", () => {
    const token = statementToken(42, later, SECRET);
    expect(verifyStatementToken(token, now, SECRET)).toBe(42);
    expect(verifyStatementToken(token, new Date("2026-12-06T12:00:00Z"), SECRET)).toBe(
      null,
    );
  });

  it("cannot be moved to another payment or given a longer life", () => {
    const [, expires, signature] = statementToken(42, later, SECRET).split(".");
    expect(verifyStatementToken(`43.${expires}.${signature}`, now, SECRET)).toBe(null);
    expect(
      verifyStatementToken(`42.${Number(expires) + 86400}.${signature}`, now, SECRET),
    ).toBe(null);
  });

  it("refuses anything forged, broken, or signed with another secret", () => {
    expect(verifyStatementToken("42", now, SECRET)).toBe(null);
    expect(verifyStatementToken("42.abc.def", now, SECRET)).toBe(null);
    expect(
      verifyStatementToken(
        statementToken(42, later, "another-secret-entirely"),
        now,
        SECRET,
      ),
    ).toBe(null);
  });
});
