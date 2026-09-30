import type { CollectionAfterChangeHook } from "payload";

import { diffRecords } from "@/domain/audit/diff";

/**
 * Writes an audit-log row for every change a member of staff makes (ADM-04,
 * spec §39): who, their role, which record, and each field's old and new
 * value. Written in the same transaction as the change, so a change that is
 * rolled back leaves no audit row, and one that commits always has one.
 *
 * Changes with no signed-in staff member — website checkout, a customer using
 * Manage booking — are not staff actions; `job-events` records those.
 */
export function auditChanges<T extends { id: number | string }>(options: {
  label: (doc: T) => string;
  redact?: readonly string[];
  ignore?: readonly string[];
}): CollectionAfterChangeHook<T> {
  return async ({ doc, previousDoc, operation, req, collection }) => {
    const user = req.user as { id: number; role?: string } | null | undefined;
    if (!user) return doc;

    const changes = diffRecords(
      operation === "create" ? null : (previousDoc as unknown as Record<string, unknown>),
      doc as unknown as Record<string, unknown>,
      { redact: options.redact, ignore: options.ignore },
    );
    if (operation === "update" && changes.length === 0) return doc;

    await req.payload.create({
      collection: "audit-log",
      data: {
        entity: collection.slug,
        docId: String(doc.id),
        docLabel: options.label(doc).slice(0, 200),
        action: operation,
        changes,
        user: user.id,
        role: user.role ?? "",
      },
      overrideAccess: true,
      req,
    });
    return doc;
  };
}
