/**
 * Feature flags (PRD-03) — hide unfinished work in production without branching.
 *
 * Flags are read from the environment so they can be flipped on the VPS with a
 * container restart, no rebuild. Default to OFF: a flag that does not exist yet
 * must never expose a half-built screen to a customer.
 */
const truthy = new Set(["1", "true", "on", "yes"]);

export type FeatureFlag =
  | "booking_funnel" // S3–S4: /quote and the 4 steps
  | "manage_booking" // S5: magic-link self-service
  | "customer_accounts" // Phase 2 (§17 open decision)
  | "admin_panel"; // S8+: Payload admin

export function isEnabled(flag: FeatureFlag): boolean {
  const raw = process.env[`FLAG_${flag.toUpperCase()}`];
  return raw ? truthy.has(raw.toLowerCase()) : false;
}
