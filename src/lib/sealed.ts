import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encryption for the few fields that must never sit in the database as plain
 * text — drivers' bank details (DRV-04, CMP-11).
 *
 * AES-256-GCM, so a tampered value fails to open rather than decrypting to
 * nonsense. The key is derived from `PAYLOAD_SECRET` with HKDF under its own
 * label, like the magic-link key, so it never appears anywhere else. A
 * database dump on its own therefore reveals nothing.
 *
 * Rotating `PAYLOAD_SECRET` makes sealed values unreadable, as it already
 * withdraws every customer's booking link — rotate only after re-entering
 * bank details, and only on a suspected compromise.
 */

const VERSION = "v1";

function key(): Buffer {
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret) throw new Error("PAYLOAD_SECRET is not set; cannot seal or open data.");
  return Buffer.from(hkdfSync("sha256", secret, "", "cityline sealed-fields v1", 32));
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    body.toString("base64url"),
  ].join(".");
}

/** The plain text, or null if the value is not ours or has been altered. */
export function open(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(body, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export interface BankDetails {
  accountName: string;
  sortCode: string;
  accountNumber: string;
}

export function sealBankDetails(details: BankDetails): string {
  return seal(JSON.stringify(details));
}

export function openBankDetails(sealed: string | null | undefined): BankDetails | null {
  const plain = open(sealed);
  if (!plain) return null;
  try {
    const parsed = JSON.parse(plain) as Partial<BankDetails>;
    if (!parsed.accountName || !parsed.sortCode || !parsed.accountNumber) return null;
    return parsed as BankDetails;
  } catch {
    return null;
  }
}

/** UK sort code and account number, normalised; null if not plausible. */
export function normaliseBankDetails(input: {
  accountName: string;
  sortCode: string;
  accountNumber: string;
}): BankDetails | null {
  const accountName = input.accountName.trim();
  const sortDigits = input.sortCode.replace(/\D/g, "");
  const accountNumber = input.accountNumber.replace(/\D/g, "");
  if (!accountName || sortDigits.length !== 6 || accountNumber.length !== 8) return null;
  return {
    accountName,
    sortCode: `${sortDigits.slice(0, 2)}-${sortDigits.slice(2, 4)}-${sortDigits.slice(4)}`,
    accountNumber,
  };
}
