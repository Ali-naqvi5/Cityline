import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/**
 * The magic link into "Manage booking" (BK-07).
 *
 * §17 settled on guest booking with no password, which makes this token the
 * only thing standing between a stranger and a customer's name, phone number
 * and home address. It is a bearer credential, so it is treated like one:
 *
 *   The **reference is not enough on its own.** `CL-7K4Q2P` gets read down the
 *   phone, quoted in support chats and printed on receipts — it is an
 *   identifier, not a secret. Every screen that shows personal data checks this
 *   token as well.
 *
 *   The token is **derived, not stored**: an HMAC of the reference under a key
 *   only the server holds. That matters because a booking is created by
 *   whichever arrives first — Stripe's webhook or the customer's browser
 *   returning from payment — and both then need the same link: the webhook for
 *   the confirmation email, the browser for the confirmation screen. A random
 *   token would exist only in whichever path created it, and the other would
 *   have nothing to show.
 *
 *   A **hash** of the token is still kept on the booking and is what gets
 *   checked. So a leaked database hands over no links (the key is not in it),
 *   and one booking's link can be withdrawn by changing its stored hash.
 *
 * The key is derived from `PAYLOAD_SECRET` with HKDF under its own label, so it
 * is separate from every other use of that secret while needing no new
 * configuration on the server. Rotating `PAYLOAD_SECRET` withdraws every link at
 * once, which is what a compromise calls for anyway.
 */

const KEY_LABEL = "cityline manage-link v1";

function linkKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", KEY_LABEL, 32));
}

/**
 * The manage token for a booking. Deterministic: the same reference always
 * gives the same token, from any process that holds the secret.
 */
export function manageTokenFor(
  reference: string,
  secret: string | undefined = process.env.PAYLOAD_SECRET,
): string {
  if (!secret) throw new Error("PAYLOAD_SECRET is not set; cannot issue booking links.");

  return createHmac("sha256", linkKey(secret))
    .update(reference, "utf8")
    .digest("base64url");
}

export function hashManageToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Whether a token presented in a URL matches the hash on the booking.
 *
 * Compared with `timingSafeEqual` rather than `===`. The margin this closes is
 * small, but it costs nothing and the alternative leaks the length of the
 * matching prefix to anyone willing to measure — which, over enough requests,
 * is how a token gets guessed a byte at a time.
 */
export function manageTokenMatches(token: string, storedHash: string): boolean {
  if (!token || !storedHash) return false;

  const presented = Buffer.from(hashManageToken(token), "utf8");
  const stored = Buffer.from(storedHash, "utf8");

  // `timingSafeEqual` throws on a length mismatch, which would itself be a
  // signal — and a stored hash of the wrong length is corrupt, not a match.
  if (presented.length !== stored.length) return false;

  return timingSafeEqual(presented, stored);
}
