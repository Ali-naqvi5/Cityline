import { describe, expect, it } from "vitest";

import { clientKey, RateLimiter } from "./rate-limit";

function clock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("RateLimiter", () => {
  it("allows the limit in a burst, then refuses", () => {
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000 }, clock().now);

    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a")).toEqual({ allowed: false, retryAfterSeconds: 20 });
  });

  it("earns requests back steadily, not all at once at a window boundary", () => {
    const time = clock();
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000 }, time.now);
    for (let i = 0; i < 3; i += 1) limiter.take("a");

    time.advance(19_000);
    expect(limiter.take("a").allowed).toBe(false);

    time.advance(1_500);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(false);
  });

  it("keeps refused attempts from resetting the wait", () => {
    const time = clock();
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 }, time.now);
    limiter.take("a");

    time.advance(30_000);
    expect(limiter.take("a")).toEqual({ allowed: false, retryAfterSeconds: 30 });
    time.advance(30_000);
    expect(limiter.take("a").allowed).toBe(true);
  });

  it("counts each client separately", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 }, clock().now);

    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(false);
    expect(limiter.take("b").allowed).toBe(true);
  });

  it("gives the full limit back after a quiet window", () => {
    const time = clock();
    const limiter = new RateLimiter({ limit: 2, windowMs: 60_000 }, time.now);
    limiter.take("a");
    limiter.take("a");

    time.advance(120_000);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(true);
  });
});

describe("clientKey", () => {
  const headers = (entries: Record<string, string>) => new Headers(entries);

  it("uses the last X-Forwarded-For entry, the one our own proxy added", () => {
    expect(clientKey(headers({ "x-forwarded-for": "10.0.0.1, 203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
    expect(clientKey(headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to X-Real-IP, then to one shared key", () => {
    expect(clientKey(headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientKey(headers({}))).toBe("unknown");
  });

  it("keys IPv6 by the /64, however the address is written", () => {
    const key = "2001:db8:1:2::/64";
    expect(clientKey(headers({ "x-forwarded-for": "2001:db8:1:2:3:4:5:6" }))).toBe(key);
    expect(clientKey(headers({ "x-forwarded-for": "2001:db8:1:2::9" }))).toBe(key);
    expect(clientKey(headers({ "x-forwarded-for": "2001:0db8:0001:0002:ffff::1" }))).toBe(
      key,
    );
    expect(clientKey(headers({ "x-forwarded-for": "[2001:db8:1:2::9]:443" }))).toBe(key);
  });

  it("reads an IPv4 address wrapped in IPv6 as the IPv4 address", () => {
    expect(clientKey(headers({ "x-forwarded-for": "::ffff:203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
  });
});
