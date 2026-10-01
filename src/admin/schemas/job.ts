import { isValidDay } from "@/admin/format";
import { normalisePhone } from "@/domain/booking/passenger";
import {
  applyBasisPoints,
  parsePounds,
  type BasisPoints,
  type Pence,
} from "@/domain/money";
import { EXTRAS } from "@/domain/pricing/extras";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { MAX_STOPS, STAFF_PAYMENT_METHODS, STAFF_SOURCES } from "@/domain/jobs/labels";
import { normaliseSupplierReference } from "@/domain/jobs/rules";
import { londonToUtc } from "@/lib/time";
import { z } from "@/lib/zod";
import type { Job } from "@/payload-types";

/**
 * The staff job form (spec §13), checked on the server. Website jobs are not
 * made here — only checkout makes them — so "website" is not a source.
 */

const optionalEmail = z
  .string()
  .max(200)
  .refine(
    (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Enter a valid email address.",
  );
const count = (label: string, max: number) =>
  z
    .string()
    .refine(
      (value) => /^\d{1,2}$/.test(value) && Number(value) <= max,
      `Enter ${label} (0–${max}).`,
    );

export const jobSchema = z
  .object({
    source: z.enum(STAFF_SOURCES, { message: "Choose where the job came from." }),
    supplier: z.string(),
    supplierReference: z.string().max(60),
    pickupDate: z.string().refine(isValidDay, "Enter the pickup date."),
    pickupTime: z
      .string()
      .refine(
        (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
        "Enter the pickup time.",
      ),
    pickupAddress: z.string().min(3, "Enter the pickup address.").max(300),
    stops: z.array(z.string().max(300)).max(MAX_STOPS),
    dropoffAddress: z.string().max(300),
    hours: z.string(),
    flightNumber: z
      .string()
      .max(12)
      .refine(
        (value) => value === "" || /^[A-Z0-9]{2,3}\s?\d{1,5}[A-Z]?$/i.test(value),
        "Enter a flight number such as BA117.",
      ),
    vehicleClassSlug: z.enum(
      VEHICLE_CLASSES.map((vehicle) => vehicle.slug) as [string, ...string[]],
      { message: "Choose the vehicle class." },
    ),
    passengers: z
      .string()
      .refine(
        (value) => /^\d{1,2}$/.test(value) && Number(value) >= 1,
        "Enter the number of passengers.",
      ),
    largeBags: count("the number of large bags", 30),
    smallBags: count("the number of small bags", 30),
    leadName: z.string().min(2, "Enter the passenger's name.").max(100),
    leadPhone: z
      .string()
      .min(1, "Enter the passenger's phone number.")
      .refine(
        (value) => normalisePhone(value) !== null,
        "Enter a valid phone number, such as 07700 900123 or +33 6 12 34 56 78.",
      ),
    leadEmail: optionalEmail,
    nameBoardText: z.string().max(60),
    meetAndGreet: z.boolean(),
    bookerName: z.string().max(100),
    bookerPhone: z
      .string()
      .refine(
        (value) => value === "" || normalisePhone(value) !== null,
        "Enter a valid phone number.",
      ),
    bookerEmail: optionalEmail,
    extras: z.record(z.string(), z.number().int().min(0).max(9)),
    price: z.string().min(1, "Enter the agreed price."),
    paymentMethod: z.enum(STAFF_PAYMENT_METHODS, { message: "Choose how it is paid." }),
    commissionPercent: z.string(),
    driverNotes: z.string().max(2000),
    internalNotes: z.string().max(2000),
    notifyPassenger: z.boolean(),
    isTest: z.boolean(),
  })
  .superRefine((job, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    if (job.source === "supplier") {
      if (!job.supplier) issue("supplier", "Choose the supplier this job came from.");
      if (!job.supplierReference.trim())
        issue("supplierReference", "Enter the supplier's booking reference.");
      const percent = Number(job.commissionPercent);
      if (
        job.commissionPercent.trim() === "" ||
        !Number.isFinite(percent) ||
        percent < 0 ||
        percent > 100
      ) {
        issue("commissionPercent", "Enter the supplier's commission, 0–100%.");
      }
    }
    if (!job.dropoffAddress.trim()) {
      const hours = Number(job.hours);
      if (!job.hours || !Number.isInteger(hours) || hours < 1 || hours > 24) {
        issue("dropoffAddress", "Enter the drop-off, or the hours for an hourly hire.");
      }
    }
    const price = parsePounds(job.price);
    if (price === null || price <= 0)
      issue("price", "Enter the agreed price, such as 55 or 55.50.");

    const vehicle = VEHICLE_CLASSES.find((item) => item.slug === job.vehicleClassSlug);
    if (vehicle && Number(job.passengers) > vehicle.maxPassengers) {
      issue(
        "passengers",
        `A ${vehicle.name} takes up to ${vehicle.maxPassengers} passengers. Choose a bigger vehicle.`,
      );
    }
    if (job.source === "supplier" && job.paymentMethod === "cash") {
      issue("paymentMethod", "Supplier jobs are paid by the supplier, not in cash.");
    }
  });

export type JobForm = z.infer<typeof jobSchema>;

/** The form's raw values, from FormData. */
export function jobForm(formData: FormData): Record<string, unknown> {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const extras: Record<string, number> = {};
  for (const extra of EXTRAS) {
    const quantity = Number(text(`extra-${extra.slug}`) || "0");
    if (quantity) extras[extra.slug] = quantity;
  }
  return {
    source: text("source"),
    supplier: text("supplier"),
    supplierReference: text("supplierReference"),
    pickupDate: text("pickupDate"),
    pickupTime: text("pickupTime"),
    pickupAddress: text("pickupAddress"),
    stops: formData
      .getAll("stop")
      .map((stop) => (typeof stop === "string" ? stop.trim() : ""))
      .filter(Boolean),
    dropoffAddress: text("dropoffAddress"),
    hours: text("hours"),
    flightNumber: text("flightNumber"),
    vehicleClassSlug: text("vehicleClassSlug"),
    passengers: text("passengers"),
    largeBags: text("largeBags") || "0",
    smallBags: text("smallBags") || "0",
    leadName: text("leadName"),
    leadPhone: text("leadPhone"),
    leadEmail: text("leadEmail"),
    nameBoardText: text("nameBoardText"),
    meetAndGreet: formData.get("meetAndGreet") === "on",
    bookerName: text("bookerName"),
    bookerPhone: text("bookerPhone"),
    bookerEmail: text("bookerEmail"),
    extras,
    price: text("price"),
    paymentMethod: text("paymentMethod"),
    commissionPercent: text("commissionPercent"),
    driverNotes: text("driverNotes"),
    internalNotes: text("internalNotes"),
    notifyPassenger: formData.get("notifyPassenger") === "on",
    isTest: formData.get("isTest") === "on",
  };
}

/** What the jobs collection stores for a valid form. */
export function jobData(form: JobForm) {
  const price = parsePounds(form.price) as Pence;
  const supplierJob = form.source === "supplier";
  const commissionBp = supplierJob
    ? (Math.round(Number(form.commissionPercent) * 100) as BasisPoints)
    : null;
  const flight = form.flightNumber.replace(/\s+/g, "").toUpperCase();

  return {
    source: form.source,
    supplier: supplierJob ? Number(form.supplier) : null,
    supplierReference: supplierJob
      ? normaliseSupplierReference(form.supplierReference)
      : null,
    pickupAt: londonToUtc(form.pickupDate, form.pickupTime).toISOString(),
    pickupAddress: form.pickupAddress,
    viaStops: form.stops.map((address) => ({ address })),
    dropoffAddress: form.dropoffAddress || null,
    hours: form.dropoffAddress ? null : Number(form.hours),
    flightNumber: flight || null,
    vehicleClassSlug: form.vehicleClassSlug,
    passengers: Number(form.passengers),
    largeBags: Number(form.largeBags),
    smallBags: Number(form.smallBags),
    leadName: form.leadName,
    leadPhone: normalisePhone(form.leadPhone) ?? form.leadPhone,
    leadEmail: form.leadEmail || null,
    nameBoardText: form.nameBoardText || form.leadName,
    meetAndGreet: form.meetAndGreet,
    bookerName: form.bookerName || null,
    bookerPhone: form.bookerPhone
      ? (normalisePhone(form.bookerPhone) ?? form.bookerPhone)
      : null,
    bookerEmail: form.bookerEmail || null,
    // Extras on a staff job are part of the agreed price, not priced per item.
    extras: Object.entries(form.extras).map(([slug, quantity]) => ({
      slug,
      quantity,
      unitPricePence: 0,
    })),
    customerPricePence: price,
    paymentMethod: form.paymentMethod,
    commissionBp,
    commissionPence: commissionBp === null ? null : applyBasisPoints(price, commissionBp),
    driverNotes: form.driverNotes || null,
    internalNotes: form.internalNotes || null,
    notifyPassenger: form.notifyPassenger,
    isTest: form.isTest,
  } satisfies Partial<Job>;
}

/**
 * A website job's operational details — what staff may change without going
 * through Amend booking (JOB-07): the time, flight, passengers and notes.
 * Price, customer and route are locked by the collection's hook as well.
 */
export const websiteJobSchema = z.object({
  pickupDate: z.string().refine(isValidDay, "Enter the pickup date."),
  pickupTime: z
    .string()
    .refine((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value), "Enter the pickup time."),
  flightNumber: z
    .string()
    .max(12)
    .refine(
      (value) => value === "" || /^[A-Z0-9]{2,3}\s?\d{1,5}[A-Z]?$/i.test(value),
      "Enter a flight number such as BA117.",
    ),
  passengers: z
    .string()
    .refine(
      (value) => /^\d{1,2}$/.test(value) && Number(value) >= 1,
      "Enter the number of passengers.",
    ),
  largeBags: count("the number of large bags", 30),
  smallBags: count("the number of small bags", 30),
  nameBoardText: z.string().max(60),
  meetAndGreet: z.boolean(),
  driverNotes: z.string().max(2000),
  internalNotes: z.string().max(2000),
  notifyPassenger: z.boolean(),
});

export type WebsiteJobForm = z.infer<typeof websiteJobSchema>;

export function websiteJobData(form: WebsiteJobForm, leadName: string) {
  return {
    pickupAt: londonToUtc(form.pickupDate, form.pickupTime).toISOString(),
    flightNumber: form.flightNumber.replace(/\s+/g, "").toUpperCase() || null,
    passengers: Number(form.passengers),
    largeBags: Number(form.largeBags),
    smallBags: Number(form.smallBags),
    nameBoardText: form.nameBoardText || leadName,
    meetAndGreet: form.meetAndGreet,
    driverNotes: form.driverNotes || null,
    internalNotes: form.internalNotes || null,
    notifyPassenger: form.notifyPassenger,
  } satisfies Partial<Job>;
}

/** Whether this many passengers fit the job's class; the message if not. */
export function capacityProblem(
  vehicleClassSlug: string,
  passengers: number,
): string | null {
  const vehicle = VEHICLE_CLASSES.find((item) => item.slug === vehicleClassSlug);
  if (!vehicle || passengers <= vehicle.maxPassengers) return null;
  return `A ${vehicle.name} takes up to ${vehicle.maxPassengers} passengers. Change the vehicle through Amend booking.`;
}
