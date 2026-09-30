/**
 * What changed between two versions of a record, for the audit log (ADM-04).
 *
 * Top-level fields only, compared by value; relationships compare by id so a
 * populated and an unpopulated reference to the same record are "no change",
 * and an empty list counts as no value.
 * Redacted fields are recorded as changed without their values — the log says
 * *that* bank details were edited and by whom, never what they are.
 */

export interface FieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

const ALWAYS_IGNORED = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "sizes",
  "_verified",
  "sessions",
]);

export const REDACTED = "(hidden)";

function normalise(value: unknown): unknown {
  if (value === undefined || value === "") return null;
  if (Array.isArray(value) && value.length === 0) return null;
  if (value && typeof value === "object" && !Array.isArray(value) && "id" in value) {
    return (value as { id: unknown }).id;
  }
  if (Array.isArray(value)) return value.map(normalise);
  return value;
}

function display(value: unknown): string | null {
  const normalised = normalise(value);
  if (normalised === null) return null;
  if (typeof normalised === "string") return normalised;
  return JSON.stringify(normalised);
}

export function diffRecords(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>,
  options: { ignore?: readonly string[]; redact?: readonly string[] } = {},
): FieldChange[] {
  const ignore = new Set([...ALWAYS_IGNORED, ...(options.ignore ?? [])]);
  const redact = new Set(options.redact ?? []);
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  const changes: FieldChange[] = [];

  for (const field of [...fields].sort()) {
    if (ignore.has(field)) continue;
    const from = normalise(before?.[field]);
    const to = normalise(after[field]);
    if (JSON.stringify(from) === JSON.stringify(to)) continue;

    if (redact.has(field)) {
      changes.push({
        field,
        from: from === null ? null : REDACTED,
        to: to === null ? null : REDACTED,
      });
    } else {
      changes.push({ field, from: display(from), to: display(to) });
    }
  }
  return changes;
}
