"use server";

import { redirect } from "next/navigation";

import { payloadErrors, text, zodErrors } from "@/admin/form-errors";
import type { FormState } from "@/admin/form-state";
import { staffForAction } from "@/admin/guard";
import { customerData, customerSchema } from "@/admin/schemas/customer";
import { sameName } from "@/domain/customers/match";

/**
 * Recording and correcting customers (Customers section). Written as the
 * member of staff, so access rules and the audit log apply.
 *
 * Two customers may not share an email, and the same name on the same phone
 * is the same person — both are refused with the name of the record that
 * already has them, so the office opens that one instead.
 */
export async function saveCustomerAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("customers.edit");
  const id = Number(text(formData, "id")) || null;

  const parsed = customerSchema.safeParse({
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return zodErrors(parsed.error);
  const data = customerData(parsed.data);
  const others = id ? [{ id: { not_equals: id } }] : [];

  if (data.email) {
    const taken = await payload.find({
      collection: "customers",
      where: { and: [{ email: { equals: data.email } }, ...others] },
      limit: 1,
      depth: 0,
      user,
      overrideAccess: false,
    });
    if (taken.docs[0]) {
      return {
        errors: { email: `${taken.docs[0].name} already has this email.` },
        message: "Please check the highlighted fields.",
      };
    }
  }
  const samePhone = await payload.find({
    collection: "customers",
    where: { and: [{ phone: { equals: data.phone } }, ...others] },
    limit: 20,
    depth: 0,
    user,
    overrideAccess: false,
  });
  const twin = samePhone.docs.find((customer) => sameName(customer.name, data.name));
  if (twin) {
    return {
      errors: { phone: `${twin.name} is already recorded with this phone.` },
      message:
        "This customer is already recorded. Open their record from the customer list.",
    };
  }

  let savedId: number;
  try {
    const saved = id
      ? await payload.update({
          collection: "customers",
          id,
          data,
          user,
          overrideAccess: false,
        })
      : await payload.create({
          collection: "customers",
          data,
          user,
          overrideAccess: false,
        });
    savedId = saved.id;
  } catch (error) {
    return payloadErrors(error, "saving a customer");
  }
  redirect(`/admin/customers/${savedId}?notice=${id ? "saved" : "created"}`);
}

/**
 * The customer asked not to receive marketing. Recorded as withdrawn; giving
 * consent again is the customer's own act, on the website.
 */
export async function withdrawConsentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("customers.edit");
  const id = Number(text(formData, "id"));
  try {
    await payload.update({
      collection: "customers",
      id,
      data: { marketingConsent: false, marketingConsentAt: null },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    return payloadErrors(error, "withdrawing marketing consent");
  }
  redirect(`/admin/customers/${id}?notice=consent-withdrawn`);
}
