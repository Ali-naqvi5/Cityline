import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, createNonce, policyKindFor } from "./csp";

function directive(policy: string, name: string): string[] {
  const found = policy
    .split("; ")
    .map((part) => part.split(" "))
    .find(([key]) => key === name);
  return found ? found.slice(1) : [];
}

describe("contentSecurityPolicy", () => {
  it("runs scripts by nonce, not inline, on the nonce policy", () => {
    const policy = contentSecurityPolicy({ nonce: "abc123", dev: false });
    const script = directive(policy, "script-src");

    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
  });

  it("allows inline scripts on the static policy, which has no nonce to give", () => {
    const script = directive(contentSecurityPolicy({ dev: false }), "script-src");
    expect(script).toContain("'unsafe-inline'");
    expect(script.some((source) => source.startsWith("'nonce-"))).toBe(false);
  });

  it("lets Stripe's Payment Element and Link work under both policies", () => {
    for (const policy of [
      contentSecurityPolicy({ nonce: "n", dev: false }),
      contentSecurityPolicy({ dev: false }),
    ]) {
      expect(directive(policy, "script-src")).toEqual(
        expect.arrayContaining(["https://js.stripe.com", "https://*.js.stripe.com"]),
      );
      expect(directive(policy, "frame-src")).toEqual(
        expect.arrayContaining([
          "https://js.stripe.com",
          "https://*.js.stripe.com",
          "https://hooks.stripe.com",
          "https://*.link.com",
        ]),
      );
      expect(directive(policy, "connect-src")).toEqual(
        expect.arrayContaining(["https://api.stripe.com", "https://*.link.com"]),
      );
    }
  });

  it("never allows eval in production", () => {
    expect(contentSecurityPolicy({ dev: false })).not.toContain("'unsafe-eval'");
    expect(contentSecurityPolicy({ nonce: "n", dev: false })).not.toContain(
      "'unsafe-eval'",
    );
    expect(contentSecurityPolicy({ dev: true })).toContain("'unsafe-eval'");
  });

  it("forbids framing, plugins and forms posting elsewhere", () => {
    const policy = contentSecurityPolicy({ dev: false });
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "form-action")).toEqual(["'self'"]);
    expect(directive(policy, "base-uri")).toEqual(["'self'"]);
  });
});

describe("policyKindFor", () => {
  it("gives the booking funnel and Manage booking the nonce policy", () => {
    for (const path of [
      "/book",
      "/book/payment",
      "/manage",
      "/manage/CL-7K4Q2P/cancel",
    ]) {
      expect(policyKindFor(path, false)).toBe("nonce");
    }
  });

  it("gives every other page the static policy", () => {
    for (const path of ["/", "/airports/heathrow", "/bookings-info", "/managed"]) {
      expect(policyKindFor(path, false)).toBe("static");
    }
  });

  it("gives the coming-soon page the static policy whatever URL showed it", () => {
    expect(policyKindFor("/book/payment", true)).toBe("static");
  });

  it("leaves the admin and the API alone", () => {
    for (const path of ["/admin", "/admin/collections/jobs", "/api/webhooks/stripe"]) {
      expect(policyKindFor(path, false)).toBe("none");
      expect(policyKindFor(path, true)).toBe("none");
    }
  });
});

describe("createNonce", () => {
  it("is different every time and safe inside a CSP header", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
