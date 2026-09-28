import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The magic link into "Manage booking" (BK-07).
 *
 * §17 settled on guest booking with no password, which makes this token the
 * only thing standing between a stranger and a customer's name, phone number
 * and home address. It is a bearer credential, so it is treated like one:
 *
 *   Only the **hash** is stored. `bookings.manageTokenHash` is a SHA-256; the
 *   token itself exists in the confirmation email and nowhere else. A leaked
 *   database dump therefore hands over no booking links.
 *
 *   The **reference is not enough on its own.** `CL-7K4Q2P` gets read down the
 *   phone, quoted in support chats and printed on receipts — it is an
 *   identifier, not a secret. Every screen that shows personal data checks this
 *   token as well.
 *
 * SHA-256 with no salt or stretching is right here and would be wrong for a
 * password: the input is already 32 bytes of CSPRNG output, so there is no
 * low-entropy guess for an attacker to grind through. Stretching would only
 * slow down the legitimate lookup.
 */

const TOKEN_BYTES = 32;

/** A new manage token. Never logged, never stored — only its hash is kept. */
export function createManageToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);

  return Buffer.from(bytes).toString("base64url");
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
