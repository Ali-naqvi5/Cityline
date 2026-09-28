import "server-only";

import Stripe from "stripe";

import { env } from "@/env";

/**
 * The server's Stripe client (PAY-01).
 *
 * One instance, created on first use and reused, as the SDK's own README
 * recommends — never the deprecated module-level `Stripe.apiKey` pattern.
 *
 * The API version is pinned rather than left to the account default. A Stripe
 * account's default version can be changed in the Dashboard by anyone with
 * access, and an integration that silently changes shape when someone clicks
 * "upgrade" is one that breaks on a Saturday.
 *
 * Only the server imports this. The secret key must never reach a browser
 * bundle; `server-only` makes that a build error rather than a code review
 * comment.
 */
export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

let client: Stripe | undefined;

export function stripe(): Stripe {
  if (client) return client;

  const key = env().STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set; card payments are unavailable.");
  }

  client = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "cityline-web", url: "https://citylineairporttransfers.com" },
    // Retries use Stripe's own idempotency keys, so a timed-out create is not
    // repeated as a second object.
    maxNetworkRetries: 2,
  });

  return client;
}

/**
 * Whether card payments can be taken in this environment.
 *
 * Both halves are needed: the secret key to create the Checkout Session on the
 * server, and the publishable key for Stripe.js in the browser. With either
 * missing, step 4 shows an honest "not connected" panel rather than a form that
 * cannot work.
 */
export function stripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}
