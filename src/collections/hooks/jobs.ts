import { ValidationError, type CollectionBeforeChangeHook } from "payload";

import {
  LOCKED_FIELD_LABELS,
  lockedFieldViolations,
  normaliseSupplierReference,
  staffCreateProblems,
} from "@/domain/jobs/rules";

/**
 * The job rules, enforced on every write (§2, JOB-03, JOB-07; spec §49).
 *
 * "Staff" means a signed-in user made the change. Website checkout and a
 * customer's Manage booking run without one, so they are not held to the
 * staff rules — checkout is exactly what may create website jobs, and Manage
 * booking has its own rules (`domain/booking/manage-rules.ts`).
 *
 * The amend flow passes `context.allowLockedEdit`, because it is the one
 * sanctioned way for staff to change a website job's price or route.
 */
export const enforceJobRules: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
  collection,
  context,
}) => {
  const staff = Boolean(req.user);
  const fail = (errors: { path: string; message: string }[]) => {
    throw new ValidationError({ collection: collection.slug, errors, req });
  };

  if (operation === "create" && staff) {
    const problems = staffCreateProblems(data);
    if (Object.keys(problems).length) {
      fail(Object.entries(problems).map(([path, message]) => ({ path, message })));
    }
  }

  if (operation === "update" && originalDoc) {
    if ("source" in data && data.source !== originalDoc.source) {
      fail([
        { path: "source", message: "A job's source cannot change after it is created." },
      ]);
    }
    if (staff && !context?.allowLockedEdit) {
      const violations = lockedFieldViolations(originalDoc, data);
      if (violations.length) {
        fail(
          violations.map((field) => ({
            path: field,
            message: `Locked on a website booking — use Amend booking to change the ${LOCKED_FIELD_LABELS[field as keyof typeof LOCKED_FIELD_LABELS]}.`,
          })),
        );
      }
    }
  }

  if (typeof data.supplierReference === "string") {
    data.supplierReference = normaliseSupplierReference(data.supplierReference) || null;
  }

  // JOB-03: one supplier reference, once, per supplier. The database has a
  // unique index too; this check exists to say which job already has it.
  const supplier = data.supplier ?? originalDoc?.supplier;
  const reference = data.supplierReference ?? originalDoc?.supplierReference;
  if (supplier && reference) {
    const supplierId = typeof supplier === "object" ? supplier.id : supplier;
    const existing = await req.payload.find({
      collection: "jobs",
      where: {
        and: [
          { supplier: { equals: supplierId } },
          { supplierReference: { equals: reference } },
          ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    });
    const duplicate = existing.docs[0];
    if (duplicate) {
      fail([
        {
          path: "supplierReference",
          message: `This supplier reference is already entered as ${duplicate.reference}.`,
        },
      ]);
    }
  }

  return data;
};
