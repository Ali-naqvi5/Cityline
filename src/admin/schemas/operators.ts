import { isValidDay } from "@/admin/format";
import { normalisePhone } from "@/domain/booking/passenger";
import { isLicensedFrom, type LicensedFrom } from "@/domain/operators/operators";
import { z } from "@/lib/zod";

import { dayToIso, expiryToIso } from "./fleet";

/**
 * What the subcontracting operator form accepts (Cityline, 15 Oct 2026).
 * Required: the name, who licensed them (and which council or authority,
 * when not TfL) and a contact phone. Everything else is optional.
 */

const optionalDay = z
  .string()
  .refine((value) => value === "" || isValidDay(value), "Enter a real date.");

export const operatorSchema = z
  .object({
    name: z.string().min(1, "Enter the operator's name.").max(120),
    legalName: z.string().max(160),
    licensedFrom: z
      .string()
      .refine((value) => isLicensedFrom(value), "Choose who licensed them."),
    licensingAuthority: z.string().max(120),
    licenceNumber: z.string().max(60),
    licenceExpiresAt: optionalDay,
    operatingCentre: z.string().max(500),
    contactName: z.string().max(80),
    phone: z
      .string()
      .min(1, "Enter a contact phone number.")
      .refine(
        (value) => normalisePhone(value) !== null,
        "Enter a valid phone number, such as 020 7946 0000 or 07700 900123.",
      ),
    email: z
      .string()
      .max(200)
      .refine(
        (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        "Enter a valid email address.",
      ),
    whatsappConsent: z.boolean(),
    dateJoined: optionalDay,
    dateLeft: optionalDay,
    companyNumber: z.string().max(20),
    vatNumber: z.string().max(20),
    notes: z.string().max(2000),
  })
  .superRefine((input, ctx) => {
    if (input.licensedFrom !== "tfl" && !input.licensingAuthority.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["licensingAuthority"],
        message: "Enter the council or authority that licensed them.",
      });
    }
    if (input.dateJoined && input.dateLeft && input.dateLeft < input.dateJoined) {
      ctx.addIssue({
        code: "custom",
        path: ["dateLeft"],
        message: "The date left is before the date joined.",
      });
    }
  });

export type OperatorInput = z.infer<typeof operatorSchema>;

export function operatorData(
  input: OperatorInput,
  consentBefore: string | null | undefined,
) {
  return {
    name: input.name.trim(),
    legalName: input.legalName.trim() || null,
    licensedFrom: input.licensedFrom as LicensedFrom,
    licensingAuthority:
      input.licensedFrom === "tfl" ? null : input.licensingAuthority.trim() || null,
    licenceNumber: input.licenceNumber.trim().toUpperCase() || null,
    licenceExpiresAt: expiryToIso(input.licenceExpiresAt),
    operatingCentre: input.operatingCentre.trim() || null,
    contactName: input.contactName.trim() || null,
    phone: normalisePhone(input.phone) ?? input.phone,
    email: input.email.trim() || null,
    // Consent keeps the day it was first given.
    whatsappConsentAt: input.whatsappConsent
      ? (consentBefore ?? new Date().toISOString())
      : null,
    dateJoined: dayToIso(input.dateJoined),
    dateLeft: dayToIso(input.dateLeft),
    companyNumber: input.companyNumber.trim().toUpperCase() || null,
    vatNumber: input.vatNumber.trim().toUpperCase() || null,
    notes: input.notes.trim() || null,
  };
}
