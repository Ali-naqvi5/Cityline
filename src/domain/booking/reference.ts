/**
 * Booking references (`CL-7K4Q2P`).
 *
 * These are not internal ids. A customer reads one down the phone to a
 * dispatcher at 5am, types it into /manage from a phone screen, or copies it
 * out of an email into a support chat. Every design choice below is about
 * surviving that round trip.
 */

/**
 * Crockford's base32 alphabet: the digits and the uppercase letters minus
 * I, L, O and U. Dropping I/L/O removes the classic transcription errors
 * (1 vs I vs l, 0 vs O) at the point where they are created rather than
 * trying to guess at them later. U is excluded so a random reference cannot
 * spell an obscenity.
 *
 * Exactly 32 symbols, which also makes unbiased generation trivial — see below.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const PREFIX = "CL-";
const BODY_LENGTH = 6;

/** `CL-` followed by six symbols from the alphabet above. */
export const REFERENCE_PATTERN = /^CL-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;

/**
 * A new reference, from the platform's cryptographic RNG.
 *
 * `Math.random()` would be wrong here: references are also the secret half of
 * the manage-booking lookup, so a predictable sequence would let someone
 * enumerate other people's journeys.
 *
 * The alphabet is exactly 32 symbols and a byte is exactly 256 values, so
 * `byte % 32` divides evenly — every symbol is equally likely, with none of
 * the modulo bias that a 26- or 36-symbol alphabet would introduce.
 *
 * 32^6 is just over a billion. Collisions are still possible, so the database
 * holds the unique constraint and the caller retries; this function only
 * promises randomness.
 */
export function generateReference(): string {
  const bytes = new Uint8Array(BODY_LENGTH);
  crypto.getRandomValues(bytes);

  let body = "";
  for (const byte of bytes) {
    body += ALPHABET[byte % ALPHABET.length];
  }

  return PREFIX + body;
}

/**
 * Turns what someone actually typed into the canonical form, or null if it
 * cannot be one of our references.
 *
 * Accepts lower case, a missing or repeated prefix, and spaces, dots or
 * hyphens anywhere — people break long codes into groups when reading them
 * aloud. Applies Crockford's substitutions (I and L are 1, O is zero) so the
 * ambiguity the alphabet avoids on the way out is also forgiven on the way in.
 *
 * Returning null rather than a best guess matters: a lookup that silently
 * "corrects" one customer's reference into another's would show them someone
 * else's journey.
 */
export function normaliseReference(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s.\-_]/g, "")
    .replace(/^(?:CL)+/, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");

  if (cleaned.length !== BODY_LENGTH) return null;

  for (const character of cleaned) {
    if (!ALPHABET.includes(character)) return null;
  }

  return PREFIX + cleaned;
}

/** Groups the body as `CL-7K4 Q2P` for display where it is read aloud. */
export function formatReferenceForSpeech(reference: string): string {
  const body = reference.slice(PREFIX.length);
  return `${PREFIX}${body.slice(0, 3)} ${body.slice(3)}`;
}
