import { REDACTED } from "@/domain/audit/diff";

import { money, stamp } from "./format";

/**
 * Audit log values as staff read them. The log stores each value as plain
 * text (`domain/audit/diff.ts`); this turns pence into pounds, basis points
 * into percentages, timestamps into London time and record ids into "#5",
 * so "3500" reads as £35.00 and "2026-11-29T23:59:00.000Z" as a date.
 */

/** Fields that hold another record's id. */
const REFERENCES = new Set([
  "booking",
  "customer",
  "driver",
  "drivers",
  "supplier",
  "user",
  "uploadedBy",
  "vehicle",
  "verifiedBy",
]);

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const SNAKE_CASE = /^[a-z0-9]+(_[a-z0-9]+)+$/;

/** "payFixedPence" → "pay fixed", "defaultCommissionBp" → "default commission". */
export function auditFieldLabel(field: string): string {
  return field
    .replace(/(Pence|Bp)$/, "")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();
}

function parsed(value: string): unknown {
  if (!value.startsWith("[") && !value.startsWith("{")) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function one(field: string, value: unknown): string {
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  if (REFERENCES.has(field)) return `#${String(value)}`;
  if (typeof value !== "string") return String(value);
  if (ISO_INSTANT.test(value)) {
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? value : stamp(instant);
  }
  if (SNAKE_CASE.test(value)) return value.replaceAll("_", " ");
  return value;
}

/** A stored value, readable. `null` means there was none ("empty"). */
export function auditValue(field: string, value: string | null): string | null {
  if (value === null || value === REDACTED) return value;
  if (field === "file") return "uploaded file";
  if (value === "true") return "Yes";
  if (value === "false") return "No";

  if (/Pence$/.test(field) && /^-?\d+$/.test(value)) return money(Number(value));
  if (/Bp$/.test(field) && /^-?\d+$/.test(value)) return `${Number(value) / 100}%`;

  const data = parsed(value);
  if (Array.isArray(data)) {
    return data.length ? data.map((item) => one(field, item)).join(", ") : null;
  }
  return one(field, data);
}
