import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

/**
 * How jobs are described to staff. The values match the `jobs` collection's
 * select options; the labels are what the admin shows.
 */

export const JOB_STATUSES = [
  "unassigned",
  "assigned",
  "driver_confirmed",
  "completed",
  "no_show",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  driver_confirmed: "Driver confirmed",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export const JOB_SOURCES = [
  "website",
  "supplier",
  "phone",
  "whatsapp",
  "email",
  "account",
  "other",
] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

export const JOB_SOURCE_LABELS: Record<JobSource, string> = {
  website: "Website",
  supplier: "Supplier",
  phone: "Phone",
  whatsapp: "WhatsApp",
  email: "Email",
  account: "Account",
  other: "Other",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  web_prepaid: "Paid on the website",
  supplier: "Supplier pays",
  cash: "Cash",
  card_link: "Card link",
  bank: "Bank transfer",
  account: "On account",
};

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}

export function isJobSource(value: unknown): value is JobSource {
  return typeof value === "string" && (JOB_SOURCES as readonly string[]).includes(value);
}

/** Statuses where the job is still to happen. */
export const OPEN_STATUSES: readonly JobStatus[] = [
  "unassigned",
  "assigned",
  "driver_confirmed",
];

export function vehicleClassName(slug: string | null | undefined): string {
  if (!slug) return "—";
  return VEHICLE_CLASSES.find((vehicle) => vehicle.slug === slug)?.name ?? slug;
}
