import { isValidDay } from "@/admin/format";
import { normalisePhone } from "@/domain/booking/passenger";
import {
  DRIVER_DOCUMENT_TYPES,
  EXPIRING_TYPES,
  VEHICLE_DOCUMENT_TYPES,
  type DocumentType,
} from "@/domain/compliance/documents";
import { parsePounds } from "@/domain/money";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { londonToUtc } from "@/lib/time";
import { z } from "@/lib/zod";
import type { Vehicle } from "@/payload-types";

/**
 * What the fleet and supplier forms accept, checked on the server. Each
 * schema reads the raw form strings and each `…Data` function turns the
 * result into what the collection stores (pence, basis points, UTC).
 */

const optionalDay = z
  .string()
  .refine((value) => value === "" || isValidDay(value), "Enter a real date.");
const optionalEmail = z
  .string()
  .max(200)
  .refine(
    (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Enter a valid email address.",
  );

/** A calendar date as noon London time, so it never slips to the day before. */
export function dayToIso(day: string): string | null {
  return day ? londonToUtc(day, "12:00").toISOString() : null;
}

/** An expiry date: valid until the end of that day, London time. */
export function expiryToIso(day: string): string | null {
  return day ? londonToUtc(day, "23:59").toISOString() : null;
}

// --- Drivers -------------------------------------------------------------------

export const driverSchema = z
  .object({
    firstName: z.string().min(1, "Enter the first name.").max(60),
    lastName: z.string().min(1, "Enter the last name.").max(60),
    phone: z
      .string()
      .min(1, "Enter the driver's mobile number.")
      .refine(
        (value) => normalisePhone(value) !== null,
        "Enter a valid mobile number, such as 07700 900123.",
      ),
    email: optionalEmail,
    address: z.string().max(500),
    dateOfBirth: optionalDay,
    status: z.enum(["active", "suspended", "left"]),
    employmentType: z.enum(["self_employed", "employee"]),
    startDate: optionalDay,
    endDate: optionalDay,
    payRule: z.enum(["fixed", "percent"]),
    payFixed: z.string(),
    payPercent: z.string(),
    showPayInMessages: z.enum(["default", "show", "hide"]),
    whatsappConsent: z.boolean(),
    notes: z.string().max(2000),
  })
  .superRefine((driver, ctx) => {
    if (
      driver.payRule === "fixed" &&
      driver.payFixed &&
      parsePounds(driver.payFixed) === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["payFixed"],
        message: "Enter an amount such as 35 or 35.50.",
      });
    }
    if (driver.payRule === "percent") {
      const percent = Number(driver.payPercent);
      if (!driver.payPercent || !(percent > 0 && percent <= 100)) {
        ctx.addIssue({
          code: "custom",
          path: ["payPercent"],
          message: "Enter a percentage between 1 and 100.",
        });
      }
    }
    if (driver.startDate && driver.endDate && driver.endDate < driver.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "The end date is before the start date.",
      });
    }
  });

export type DriverInput = z.infer<typeof driverSchema>;

export function driverData(input: DriverInput, previousConsentAt?: string | null) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: normalisePhone(input.phone) ?? input.phone,
    email: input.email || null,
    address: input.address || null,
    dateOfBirth: dayToIso(input.dateOfBirth),
    status: input.status,
    employmentType: input.employmentType,
    startDate: dayToIso(input.startDate),
    endDate: dayToIso(input.endDate),
    payRule: input.payRule,
    payFixedPence:
      input.payRule === "fixed" && input.payFixed ? parsePounds(input.payFixed) : null,
    payPercentBp:
      input.payRule === "percent" ? Math.round(Number(input.payPercent) * 100) : null,
    showPayInMessages: input.showPayInMessages,
    // Keep the original consent date; record it when first given.
    whatsappConsentAt: input.whatsappConsent
      ? (previousConsentAt ?? new Date().toISOString())
      : null,
    notes: input.notes || null,
  };
}

// --- Vehicles ------------------------------------------------------------------

const VEHICLE_CLASS_SLUGS = VEHICLE_CLASSES.map((vehicle) => vehicle.slug) as [
  string,
  ...string[],
];

export const vehicleSchema = z.object({
  registration: z
    .string()
    .min(2, "Enter the registration.")
    .max(10)
    .refine((value) => /^[A-Z0-9 ]+$/i.test(value), "Letters and numbers only."),
  make: z.string().min(1, "Enter the make.").max(40),
  model: z.string().min(1, "Enter the model.").max(40),
  colour: z.string().min(1, "Enter the colour.").max(30),
  vehicleClassSlug: z.enum(VEHICLE_CLASS_SLUGS, "Choose the vehicle class."),
  seats: z
    .string()
    .refine(
      (value) =>
        value === "" ||
        (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 20),
      "Enter a number of seats from 1 to 20.",
    ),
  ownership: z.enum(["company", "driver", "hired"]),
  status: z.enum(["active", "off_road", "sold"]),
  drivers: z.array(z.number().int().positive()),
  notes: z.string().max(2000),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export function vehicleData(input: VehicleInput) {
  return {
    registration: input.registration,
    make: input.make,
    model: input.model,
    colour: input.colour,
    // The schema has already limited this to the known classes.
    vehicleClassSlug: input.vehicleClassSlug as Vehicle["vehicleClassSlug"],
    seats: input.seats ? Number(input.seats) : null,
    ownership: input.ownership,
    status: input.status,
    drivers: input.drivers,
    notes: input.notes || null,
  };
}

// --- Suppliers -----------------------------------------------------------------

export const supplierSchema = z.object({
  name: z.string().min(1, "Enter the supplier's name.").max(80),
  commissionPercent: z
    .string()
    .refine(
      (value) => value !== "" && Number(value) >= 0 && Number(value) <= 100,
      "Enter a percentage from 0 to 100.",
    ),
  paymentTermsDays: z
    .string()
    .refine(
      (value) =>
        value === "" ||
        (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 365),
      "Enter a number of days.",
    ),
  contactName: z.string().max(80),
  email: optionalEmail,
  phone: z.string().max(30),
  dashboardUrl: z
    .string()
    .max(300)
    .refine(
      (value) => value === "" || /^https?:\/\//.test(value),
      "Enter the full address, starting https://",
    ),
  notes: z.string().max(2000),
  active: z.boolean(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

export function supplierData(input: SupplierInput) {
  return {
    name: input.name,
    defaultCommissionBp: Math.round(Number(input.commissionPercent) * 100),
    paymentTermsDays: input.paymentTermsDays ? Number(input.paymentTermsDays) : null,
    contactName: input.contactName || null,
    email: input.email || null,
    phone: input.phone || null,
    dashboardUrl: input.dashboardUrl || null,
    notes: input.notes || null,
    active: input.active,
  };
}

// --- Documents -----------------------------------------------------------------

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function documentSchema(kind: "driver" | "vehicle") {
  const types = (
    kind === "driver" ? DRIVER_DOCUMENT_TYPES : VEHICLE_DOCUMENT_TYPES
  ) as readonly [string, ...string[]];
  return z
    .object({
      type: z.enum(types, "Choose the type of document."),
      number: z.string().max(60),
      issuedAt: optionalDay,
      expiresAt: optionalDay,
      checked: z.boolean(),
      notes: z.string().max(1000),
    })
    .superRefine((document, ctx) => {
      if (EXPIRING_TYPES.has(document.type as DocumentType) && !document.expiresAt) {
        ctx.addIssue({
          code: "custom",
          path: ["expiresAt"],
          message: "This document needs an expiry date.",
        });
      }
      if (document.type === "phv_licence" && !document.number) {
        ctx.addIssue({
          code: "custom",
          path: ["number"],
          message:
            "Enter the PHV licence number — it goes on every job this driver does.",
        });
      }
      if (
        document.issuedAt &&
        document.expiresAt &&
        document.expiresAt < document.issuedAt
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["expiresAt"],
          message: "The expiry is before the issue date.",
        });
      }
    });
}

/** Problems with an uploaded file, or null if it can be stored. */
export function fileProblem(file: File | null): string | null {
  if (!file || file.size === 0) return null;
  if (!ALLOWED_FILE_TYPES.includes(file.type))
    return "Upload a PDF, JPG, PNG or WebP file.";
  if (file.size > MAX_FILE_BYTES) return "The file is larger than 10 MB.";
  return null;
}
