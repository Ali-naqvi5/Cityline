"use server";

import { redirect } from "next/navigation";

import { checked, payloadErrors, text, zodErrors } from "@/admin/form-errors";
import type { FormState } from "@/admin/form-state";
import { staffForAction } from "@/admin/guard";
import {
  dayToIso,
  documentSchema,
  driverData,
  driverSchema,
  expiryToIso,
  fileProblem,
  supplierData,
  supplierSchema,
  vehicleData,
  vehicleSchema,
} from "@/admin/schemas/fleet";
import { normaliseBankDetails, sealBankDetails } from "@/lib/sealed";

/**
 * Saving drivers, vehicles, suppliers and their documents (DRV-*, VEH-*,
 * spec §20–§26). Every action checks the member of staff again on the server,
 * validates on the server, and saves as that person — so collection access
 * rules and the audit log apply exactly as they would anywhere else.
 */

// --- Drivers -------------------------------------------------------------------

function driverForm(formData: FormData) {
  return {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    address: text(formData, "address"),
    dateOfBirth: text(formData, "dateOfBirth"),
    status: text(formData, "status"),
    employmentType: text(formData, "employmentType"),
    startDate: text(formData, "startDate"),
    endDate: text(formData, "endDate"),
    payRule: text(formData, "payRule"),
    payFixed: text(formData, "payFixed"),
    payPercent: text(formData, "payPercent"),
    showPayInMessages: text(formData, "showPayInMessages"),
    whatsappConsent: checked(formData, "whatsappConsent"),
    notes: text(formData, "notes"),
  };
}

export async function saveDriverAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("drivers.edit");
  const id = Number(text(formData, "id")) || null;

  const parsed = driverSchema.safeParse(driverForm(formData));
  if (!parsed.success) return zodErrors(parsed.error);

  let savedId: number;
  try {
    if (id) {
      const existing = await payload.findByID({
        collection: "drivers",
        id,
        depth: 0,
        user,
        overrideAccess: false,
      });
      const saved = await payload.update({
        collection: "drivers",
        id,
        data: driverData(parsed.data, existing.whatsappConsentAt),
        user,
        overrideAccess: false,
      });
      savedId = saved.id;
    } else {
      const saved = await payload.create({
        collection: "drivers",
        data: driverData(parsed.data),
        user,
        overrideAccess: false,
      });
      savedId = saved.id;
    }
  } catch (error) {
    return payloadErrors(error, "saving a driver");
  }

  redirect(`/admin/drivers/${savedId}?notice=${id ? "saved" : "created"}`);
}

/** Owner only (spec §22): sealed before it is stored, never shown in lists. */
export async function saveBankDetailsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("drivers.bankDetails");
  const id = Number(text(formData, "id"));

  if (text(formData, "remove") === "1") {
    await payload.update({
      collection: "drivers",
      id,
      data: { bankDetailsSealed: null, bankAccountLast4: null },
      user,
      overrideAccess: false,
    });
    redirect(`/admin/drivers/${id}?notice=bank-removed`);
  }

  const details = normaliseBankDetails({
    accountName: text(formData, "accountName"),
    sortCode: text(formData, "sortCode"),
    accountNumber: text(formData, "accountNumber"),
  });
  if (!details) {
    return {
      errors: {},
      message:
        "Enter the account name, a 6-digit sort code and an 8-digit account number.",
    };
  }

  try {
    await payload.update({
      collection: "drivers",
      id,
      data: {
        bankDetailsSealed: sealBankDetails(details),
        bankAccountLast4: details.accountNumber.slice(-4),
      },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    return payloadErrors(error, "saving bank details");
  }
  redirect(`/admin/drivers/${id}?notice=bank-saved`);
}

// --- Vehicles ------------------------------------------------------------------

export async function saveVehicleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("vehicles.edit");
  const id = Number(text(formData, "id")) || null;

  const parsed = vehicleSchema.safeParse({
    registration: text(formData, "registration"),
    make: text(formData, "make"),
    model: text(formData, "model"),
    colour: text(formData, "colour"),
    vehicleClassSlug: text(formData, "vehicleClassSlug"),
    seats: text(formData, "seats"),
    ownership: text(formData, "ownership"),
    status: text(formData, "status"),
    drivers: formData
      .getAll("drivers")
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0),
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return zodErrors(parsed.error);

  let savedId: number;
  try {
    const saved = id
      ? await payload.update({
          collection: "vehicles",
          id,
          data: vehicleData(parsed.data),
          user,
          overrideAccess: false,
        })
      : await payload.create({
          collection: "vehicles",
          data: vehicleData(parsed.data),
          user,
          overrideAccess: false,
        });
    savedId = saved.id;
  } catch (error) {
    return payloadErrors(error, "saving a vehicle");
  }
  redirect(`/admin/vehicles/${savedId}?notice=${id ? "saved" : "created"}`);
}

// --- Suppliers -----------------------------------------------------------------

export async function saveSupplierAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("suppliers.edit");
  const id = Number(text(formData, "id")) || null;

  const parsed = supplierSchema.safeParse({
    name: text(formData, "name"),
    commissionPercent: text(formData, "commissionPercent"),
    paymentTermsDays: text(formData, "paymentTermsDays"),
    contactName: text(formData, "contactName"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    dashboardUrl: text(formData, "dashboardUrl"),
    notes: text(formData, "notes"),
    active: checked(formData, "active"),
  });
  if (!parsed.success) return zodErrors(parsed.error);

  let savedId: number;
  try {
    const saved = id
      ? await payload.update({
          collection: "suppliers",
          id,
          data: supplierData(parsed.data),
          user,
          overrideAccess: false,
        })
      : await payload.create({
          collection: "suppliers",
          data: supplierData(parsed.data),
          user,
          overrideAccess: false,
        });
    savedId = saved.id;
  } catch (error) {
    return payloadErrors(error, "saving a supplier");
  }
  redirect(`/admin/suppliers/${savedId}?notice=${id ? "saved" : "created"}`);
}

// --- Documents -----------------------------------------------------------------

export async function addDocumentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const kind = text(formData, "kind") === "vehicle" ? "vehicle" : "driver";
  const { payload, user } = await staffForAction("compliance.verify");
  const ownerId = Number(text(formData, "ownerId"));
  if (!Number.isInteger(ownerId) || ownerId <= 0)
    return { errors: {}, message: "Unknown record." };

  const parsed = documentSchema(kind).safeParse({
    type: text(formData, "type"),
    number: text(formData, "number"),
    issuedAt: text(formData, "issuedAt"),
    expiresAt: text(formData, "expiresAt"),
    checked: checked(formData, "checked"),
    notes: text(formData, "notes"),
  });
  const upload = formData.get("file");
  const file = upload instanceof File && upload.size > 0 ? upload : null;
  const problem = fileProblem(file);
  if (!parsed.success || problem) {
    const state = parsed.success
      ? { errors: {} as Record<string, string> }
      : zodErrors(parsed.error);
    if (problem) state.errors.file = problem;
    return { ...state, message: "Please check the highlighted fields." };
  }

  const now = new Date().toISOString();
  try {
    let fileId: number | null = null;
    if (file) {
      const stored = await payload.create({
        collection: "private-files",
        data: {
          purpose: kind === "driver" ? "driver_document" : "vehicle_document",
          uploadedBy: user.id,
        },
        file: {
          data: Buffer.from(await file.arrayBuffer()),
          mimetype: file.type,
          name: file.name,
          size: file.size,
        },
        user,
        overrideAccess: false,
      });
      fileId = stored.id;
    }

    const common = {
      type: parsed.data.type,
      number: parsed.data.number || null,
      issuedAt: dayToIso(parsed.data.issuedAt),
      expiresAt: expiryToIso(parsed.data.expiresAt),
      file: fileId,
      verifiedBy: parsed.data.checked ? user.id : null,
      verifiedAt: parsed.data.checked ? now : null,
      notes: parsed.data.notes || null,
    };
    if (kind === "driver") {
      await payload.create({
        collection: "driver-documents",
        data: { ...common, driver: ownerId, type: common.type as "phv_licence" },
        user,
        overrideAccess: false,
      });
    } else {
      await payload.create({
        collection: "vehicle-documents",
        data: { ...common, vehicle: ownerId, type: common.type as "mot" },
        user,
        overrideAccess: false,
      });
    }
  } catch (error) {
    return payloadErrors(error, "adding a document");
  }

  redirect(`/admin/${kind}s/${ownerId}?notice=document-added`);
}

/** "I have seen the original": who checked it, and when (DRV-02). */
export async function verifyDocumentAction(formData: FormData): Promise<void> {
  const kind = text(formData, "kind") === "vehicle" ? "vehicle" : "driver";
  const { payload, user } = await staffForAction("compliance.verify");
  const id = Number(text(formData, "documentId"));
  const ownerId = Number(text(formData, "ownerId"));

  await payload.update({
    collection: kind === "driver" ? "driver-documents" : "vehicle-documents",
    id,
    data: { verifiedBy: user.id, verifiedAt: new Date().toISOString() },
    user,
    overrideAccess: false,
  });
  redirect(`/admin/${kind}s/${ownerId}?notice=document-checked`);
}
