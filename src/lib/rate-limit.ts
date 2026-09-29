/**
 * Rate limits for the requests that cost something (NFR-04): a quote row, a
 * call to Stripe, an email to a customer.
 *
 * **In memory, in this process.** Cityline runs one app container (§12), so one
 * process sees every request, and a limiter needs nothing more. If the app
 * ever runs as more than one instance, this has to move to Postgres or Redis:
 * each instance would otherwise allow the full limit on its own.
 *
 * **Token bucket.** Each client starts with `limit` requests, spends one per
 * request, and earns them back steadily over `windowMs`. Unlike a fixed
 * window, a burst at the end of one window cannot be followed straight away
 * by a burst at the start of the next.
 *
 * **Keyed by IP address**, the last `X-Forwarded-For` entry. That is the one
 * our own Caddy wrote: Caddy trusts forwarded headers only from private
 * networks (docker/Caddyfile), so a client cannot put an address there that
 * Caddy passes through as its own. IPv6 is keyed by its /64, the block one
 * home or phone is normally given, or a single client could use a fresh
 * address for every request.
 */

export interface RateLimit {
  /** Requests allowed in a burst. */
  limit: number;
  /** Time to earn all of them back. */
  windowMs: number;
}

const MINUTE = 60_000;

/**
 * Generous for a person and tight for a script. A family pricing three cars
 * makes three quotes; nobody makes twenty in ten minutes.
 */
export const RATE_LIMITS = {
  /** Step 3 submitted: a quote row, and later a routing call. */
  quote: { limit: 20, windowMs: 10 * MINUTE },
  /** Step 4 viewed: one Stripe API call per view. */
  checkout: { limit: 30, windowMs: 10 * MINUTE },
  /** "Email me the link" on /manage. */
  manageLink: { limit: 5, windowMs: 15 * MINUTE },
  /** Changes and cancellations, each of which emails the customer and the office. */
  manageChange: { limit: 20, windowMs: 60 * MINUTE },
} as const satisfies Record<string, RateLimit>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type TakeResult =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** Beyond this many clients, the least recently seen are forgotten first. */
const MAX_KEYS = 50_000;

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(
    private readonly rule: RateLimit,
    private readonly now: () => number = Date.now,
  ) {}

  /** Spends one of `key`'s requests, if it has one. */
  take(key: string): TakeResult {
    const now = this.now();
    const { limit, windowMs } = this.rule;
    const earnedPerMs = limit / windowMs;

    const bucket = this.buckets.get(key);
    const tokens = bucket
      ? Math.min(limit, bucket.tokens + (now - bucket.updatedAt) * earnedPerMs)
      : limit;

    // Deleted and re-added so the Map's order stays least-recently-seen first.
    this.buckets.delete(key);
    this.sweep(now);

    if (tokens < 1) {
      this.buckets.set(key, { tokens, updatedAt: now });
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((1 - tokens) / earnedPerMs / 1000),
      };
    }

    this.buckets.set(key, { tokens: tokens - 1, updatedAt: now });
    return { allowed: true };
  }

  /**
   * A bucket untouched for a whole window has earned everything back, which is
   * the same as having no bucket, so it can go. Once a minute is plenty.
   */
  private sweep(now: number): void {
    if (now - this.lastSweep >= MINUTE) {
      this.lastSweep = now;
      for (const [key, bucket] of this.buckets) {
        if (now - bucket.updatedAt >= this.rule.windowMs) this.buckets.delete(key);
      }
    }

    // A flood of distinct clients must not grow memory without end. Forgetting
    // the oldest only ever gives a client more allowance, never less.
    for (const key of this.buckets.keys()) {
      if (this.buckets.size < MAX_KEYS) break;
      this.buckets.delete(key);
    }
  }
}

/** The client's address as a limiter key, from the request's headers. */
export function clientKey(headers: Headers): string {
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);
  const address = forwarded ?? headers.get("x-real-ip")?.trim();
  return address ? keyForAddress(address) : "unknown";
}

function keyForAddress(raw: string): string {
  const address = raw.replace(/^\[|\](:\d+)?$/g, "").replace(/%.*$/, "");

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  if (mapped?.[1]) return mapped[1];
  if (!address.includes(":")) return address;

  // Expand `::` so the first four groups are the /64 however it was written.
  const [head = "", tail] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups =
    tail === undefined
      ? left
      : [
          ...left,
          ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"),
          ...right,
        ];

  const prefix = groups
    .slice(0, 4)
    .map((group) => (Number.parseInt(group || "0", 16) || 0).toString(16))
    .join(":");
  return `${prefix}::/64`;
}
