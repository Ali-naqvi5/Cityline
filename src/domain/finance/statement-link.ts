import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/**
 * The link in a driver's WhatsApp message that opens their payment statement
 * (a PDF). WhatsApp's click-to-send can carry text only, so the statement
 * travels as a link the driver can open without an account.
 *
 * Like the manage-booking link it is a bearer credential: an HMAC, under a
 * key derived from `PAYLOAD_SECRET` with its own label, of the payment and the
 * date the link stops working. Nothing is stored; the payment number alone
 * opens nothing, and a link cannot be stretched past its expiry or moved to
 * another payment. Voiding the payment withdraws the statement.
 */

const KEY_LABEL = "cityline statement-link v1";
export const STATEMENT_LINK_DAYS = 60;

function linkKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", KEY_LABEL, 32));
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", linkKey(secret))
    .update(payload, "utf8")
    .digest("base64url");
}

/** A token for this payment's statement, valid until `expiresAt`. */
export function statementToken(
  paymentId: number,
  expiresAt: Date,
  secret: string | undefined = process.env.PAYLOAD_SECRET,
): string {
  if (!secret)
    throw new Error("PAYLOAD_SECRET is not set; cannot issue statement links.");
  const payload = `${paymentId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  return `${payload}.${signature(payload, secret)}`;
}

/** The payment a token opens, or null if it is forged, altered or expired. */
export function verifyStatementToken(
  token: string,
  now: Date = new Date(),
  secret: string | undefined = process.env.PAYLOAD_SECRET,
): number | null {
  if (!secret) return null;
  const [id, expires, presented] = token.split(".");
  if (!id || !expires || !presented) return null;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(expires)) return null;
  const expected = Buffer.from(signature(`${id}.${expires}`, secret), "utf8");
  const given = Buffer.from(presented, "utf8");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expires) * 1000 < now.getTime()) return null;
  return Number(id);
}
