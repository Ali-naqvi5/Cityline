/**
 * Money (NFR-08): every amount in this codebase is an **integer number of pence**.
 * Floats are never used for money — 0.1 + 0.2 pounds is how a driver statement
 * ends up a penny out and nobody can explain why.
 *
 * Percentages are **basis points**: 1% = 100 bp, 17.5% = 1750 bp.
 */

export type Pence = number;
export type BasisPoints = number;

/** Guard for values that must be whole pence before they touch the database. */
export function assertPence(value: number, label = "amount"): asserts value is Pence {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a whole number of pence, received ${value}`);
  }
}

/**
 * Parse user or import input into pence: "£12.34", "12.34", "12", "1,234.50".
 * Returns null for anything it cannot read, so callers must handle bad input
 * rather than silently booking a £0 job.
 */
export function parsePounds(input: string): Pence | null {
  const cleaned = input.trim().replace(/[£\s,]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const negative = cleaned.startsWith("-");
  const [whole = "0", fraction = ""] = cleaned.replace("-", "").split(".");
  const pence = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return negative ? -pence : pence;
}

/** "£12.34" — the only way money is rendered to a customer, driver or report. */
export function formatPence(amount: Pence): string {
  assertPence(amount);
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const formatted = `£${Math.floor(absolute / 100).toLocaleString("en-GB")}.${String(
    absolute % 100,
  ).padStart(2, "0")}`;
  return negative ? `-${formatted}` : formatted;
}

/**
 * A share of an amount, in basis points — supplier commission (§7) and
 * percentage driver pay both go through here, so they round identically.
 */
export function applyBasisPoints(amount: Pence, bp: BasisPoints): Pence {
  assertPence(amount);
  assertPence(bp, "basis points");
  return Math.round((amount * bp) / 10_000);
}

/** Pricing step 7 (§7): quoted fares are rounded to the nearest whole pound. */
export function roundToNearestPound(amount: Pence): Pence {
  assertPence(amount);
  return Math.round(amount / 100) * 100;
}

export function sumPence(...amounts: Pence[]): Pence {
  return amounts.reduce((total, amount) => {
    assertPence(amount);
    return total + amount;
  }, 0);
}

/**
 * VAT already contained in a gross (VAT-inclusive) price. Cityline quotes
 * gross prices; whether VAT is shown at all is an open decision (§17).
 */
export function vatFromGross(gross: Pence, rateBp: BasisPoints): Pence {
  assertPence(gross);
  assertPence(rateBp, "VAT rate");
  return Math.round((gross * rateBp) / (10_000 + rateBp));
}
