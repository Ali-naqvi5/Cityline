"use server";

import { redirect } from "next/navigation";

import { checked, payloadErrors, text, zodErrors } from "@/admin/form-errors";
import type { FormState } from "@/admin/form-state";
import { staffForAction } from "@/admin/guard";
import { fileProblem } from "@/admin/schemas/fleet";
import { operatorData, operatorSchema } from "@/admin/schemas/operators";
import type { Operator } from "@/payload-types";

/**
 * Adding and editing subcontracting operators (Cityline, 15 Oct 2026) —
 * Owner and Controller. A copy of their licence, if added, is kept as a
 * private file. Their bank details are saved apart, by the Owner and
 * Accounts (\`saveBankDetailsAction\`).
 */
export async function saveOperatorAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("operators.edit");
  const id = Number(text(formData, "id")) || null;

  const parsed = operatorSchema.safeParse({
    name: text(formData, "name"),
    legalName: text(formData, "legalName"),
    licensedFrom: text(formData, "licensedFrom"),
    licensingAuthority: text(formData, "licensingAuthority"),
    licenceNumber: text(formData, "licenceNumber"),
    licenceExpiresAt: text(formData, "licenceExpiresAt"),
    operatingCentre: text(formData, "operatingCentre"),
    contactName: text(formData, "contactName"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    whatsappConsent: checked(formData, "whatsappConsent"),
    dateJoined: text(formData, "dateJoined"),
    dateLeft: text(formData, "dateLeft"),
    companyNumber: text(formData, "companyNumber"),
    vatNumber: text(formData, "vatNumber"),
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return zodErrors(parsed.error);

  const upload = formData.get("licenceCopy");
  const file = upload instanceof File && upload.size > 0 ? upload : null;
  const problem = fileProblem(file);
  if (problem) {
    return {
      errors: { licenceCopy: problem },
      message: "Please check the highlighted fields.",
    };
  }

  let savedId: number;
  try {
    const existing = id
      ? ((await payload.findByID({
          collection: "operators",
          id,
          depth: 0,
          user,
          overrideAccess: false,
        })) as Operator)
      : null;
    const copy = file
      ? await payload.create({
          collection: "private-files",
          data: { purpose: "operator_licence", uploadedBy: user.id },
          file: {
            data: Buffer.from(await file.arrayBuffer()),
            mimetype: file.type,
            name: file.name,
            size: file.size,
          },
          user,
          overrideAccess: false,
        })
      : null;
    const data = {
      ...operatorData(parsed.data, existing?.whatsappConsentAt),
      ...(copy ? { licenceCopy: copy.id } : {}),
    };
    const saved = id
      ? await payload.update({
          collection: "operators",
          id,
          data,
          user,
          overrideAccess: false,
        })
      : await payload.create({
          collection: "operators",
          data,
          user,
          overrideAccess: false,
        });
    savedId = saved.id;
  } catch (error) {
    return payloadErrors(error, "saving an operator");
  }
  redirect(`/admin/operators/${savedId}?notice=${id ? "saved" : "created"}`);
}
