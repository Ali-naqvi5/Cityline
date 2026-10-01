import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

/**
 * How jobs are described to staff. The values match the `jobs` collection's
 * select options; the labels are what the admin shows.
 */

/**
 * The job cycle, in the order it runs (Cityline, 2 Oct 2026):
 *
 *   Unassigned → Assigned → Driver confirmed → DOW → DAP → POB → Completed
 *                                                     ↘ PNS
 *
 * and Cancelled. See `status.ts` for the rules that move a job along it.
 */
export const JOB_STATUSES = [
  "unassigned",
  "assigned",
  "driver_confirmed",
  "on_the_way",
  "at_pickup",
  "on_board",
  "completed",
  "no_show",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  driver_confirmed: "Driver confirmed",
  on_the_way: "Driver on the way",
  at_pickup: "Driver at pickup",
  on_board: "Passenger on board",
  completed: "Completed",
  no_show: "Passenger no-show",
  cancelled: "Cancelled",
};

/** What the office calls each stage on the phone and in the register. */
export const JOB_STATUS_SHORT: Record<JobStatus, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  driver_confirmed: "Confirmed",
  on_the_way: "DOW",
  at_pickup: "DAP",
  on_board: "POB",
  completed: "Completed",
  no_show: "PNS",
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

/** Statuses where the job is still to happen or is under way. */
export const OPEN_STATUSES: readonly JobStatus[] = [
  "unassigned",
  "assigned",
  "driver_confirmed",
  "on_the_way",
  "at_pickup",
  "on_board",
];

export function vehicleClassName(slug: string | null | undefined): string {
  if (!slug) return "—";
  return VEHICLE_CLASSES.find((vehicle) => vehicle.slug === slug)?.name ?? slug;
}

/** Sources staff may enter a job from — never "website" (§2). */
export const STAFF_SOURCES = [
  "supplier",
  "phone",
  "whatsapp",
  "email",
  "account",
  "other",
] as const satisfies readonly JobSource[];

/** How a staff job is paid. "Paid on the website" belongs to checkout alone. */
export const STAFF_PAYMENT_METHODS = [
  "supplier",
  "cash",
  "card_link",
  "bank",
  "account",
] as const;

/** Most via stops a job can have. */
export const MAX_STOPS = 4;
