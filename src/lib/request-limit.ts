import "server-only";

import { headers } from "next/headers";

import { company } from "@/lib/company";

import { clientKey, RATE_LIMITS, RateLimiter, type RateLimitName } from "./rate-limit";

/**
 * The rate limits of `rate-limit.ts`, applied to the request being handled.
 *
 * The limiters live on `globalThis`, not in a module variable: Next may load
 * this module more than once in one process (a server action and a page are
 * bundled separately), and two copies would each allow the full limit.
 */

const STORE = Symbol.for("cityline.rate-limiters");

function limiter(name: RateLimitName): RateLimiter {
  const global = globalThis as { [STORE]?: Map<RateLimitName, RateLimiter> };
  const store = (global[STORE] ??= new Map());

  let found = store.get(name);
  if (!found) {
    found = new RateLimiter(RATE_LIMITS[name]);
    store.set(name, found);
  }
  return found;
}

/** Spends one of this client's `name` requests; false once they have run out. */
export async function allowRequest(name: RateLimitName): Promise<boolean> {
  return limiter(name).take(clientKey(await headers())).allowed;
}

/** What a customer is told when they hit a limit: a way forward, not a code. */
export const TOO_MANY_ATTEMPTS = `You have tried this several times in a short while. Please wait a few minutes and try again, or call us on ${company.phone}.`;
