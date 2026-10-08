import { londonDateAndTime } from "@/lib/time";

/**
 * The record TfL requires of every driver available to an operator — the
 * Private Hire Vehicles (London) (Operators' Licences) Regulations 2000,
 * reg. 13 and 16, as TfL's Private Hire Operator's Handbook sets them out:
 *
 *   surname, forenames, address and date of birth; National Insurance
 *   number; a copy of their driving licence; a copy of their London PHV
 *   driver's licence; a photograph; the date they became available, and the
 *   date they stopped being available.
 *
 * Kept while the driver is available and for 12 months after they stop, and
 * shown to a TfL officer or the police on request. A driver the operator
 * stops using because of their conduct in connection with driving a PHV is
 * reported to TfL within 14 days (a licence condition; form PHV/105).
 *
 * Drivers are independent: nothing here describes employment.
 */

export const RECORD_KEEP_MONTHS = 12;
export const CONDUCT_NOTICE_DAYS = 14;

// Two letters, six digits, A–D. HMRC never issues D, F, I, Q, U or V first,
// those or O second, nor the prefixes below.
const NI_PATTERN =
  /^(?!BG|GB|KN|NK|NT|TN|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/;

export function normaliseNiNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function isValidNiNumber(value: string): boolean {
  return NI_PATTERN.test(normaliseNiNumber(value));
}

/** "AB 12 34 56 C", as it is printed on HMRC letters. */
export function formatNiNumber(value: string): string {
  const number = normaliseNiNumber(value);
  if (!NI_PATTERN.test(number)) return value;
  return [
    number.slice(0, 2),
    number.slice(2, 4),
    number.slice(4, 6),
    number.slice(6, 8),
    number.slice(8),
  ].join(" ");
}

export const PARTICULARS = [
  "name",
  "address",
  "dateOfBirth",
  "niNumber",
  "drivingLicenceCopy",
  "phvLicenceCopy",
  "photo",
  "availableFrom",
  "stoppedOn",
] as const;
export type Particular = (typeof PARTICULARS)[number];

export const PARTICULAR_LABELS: Record<Particular, string> = {
  name: "Full name",
  address: "Address",
  dateOfBirth: "Date of birth",
  niNumber: "National Insurance number",
  drivingLicenceCopy: "Copy of driving licence",
  phvLicenceCopy: "Copy of PHV driver's licence",
  photo: "Photograph",
  availableFrom: "Date available from",
  stoppedOn: "Date stopped being available",
};

export interface DriverRecordInput {
  firstName?: string | null;
  lastName?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  nationalInsuranceNumber?: string | null;
  photo?: unknown;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  /** "outsourced": copies and the photograph are kept offline by the office. */
  engagement?: string | null;
  /** Every document on record for the driver; a copy is one with a file. */
  documents: readonly { type: string; file?: unknown }[];
}

/**
 * The particulars an outsourced driver's record keeps on paper, not here:
 * the office collects copies of their licences and a photograph when it
 * takes them on (Cityline, 9 Oct 2026). TfL accepts records in any form, as
 * long as they can be produced on request.
 */
export const OFFLINE_PARTICULARS: readonly Particular[] = [
  "drivingLicenceCopy",
  "phvLicenceCopy",
  "photo",
];

/** Particulars of this driver's record held offline, not in the system. */
export function heldOffline(driver: Pick<DriverRecordInput, "engagement">): Particular[] {
  return driver.engagement === "outsourced" ? [...OFFLINE_PARTICULARS] : [];
}

const filled = (value: string | null | undefined) => Boolean(value && value.trim());

/** What TfL's record of this driver still lacks, in the handbook's order. */
export function missingParticulars(driver: DriverRecordInput): Particular[] {
  const copyOf = (type: string) =>
    driver.documents.some((document) => document.type === type && document.file);
  const missing: Particular[] = [];
  if (!filled(driver.firstName) || !filled(driver.lastName)) missing.push("name");
  if (!filled(driver.address)) missing.push("address");
  if (!driver.dateOfBirth) missing.push("dateOfBirth");
  if (!filled(driver.nationalInsuranceNumber)) missing.push("niNumber");
  if (!copyOf("dvla_licence")) missing.push("drivingLicenceCopy");
  if (!copyOf("phv_licence")) missing.push("phvLicenceCopy");
  if (!driver.photo) missing.push("photo");
  if (!driver.startDate) missing.push("availableFrom");
  if (driver.status === "left" && !driver.endDate) missing.push("stoppedOn");
  const offline = heldOffline(driver);
  return missing.filter((particular) => !offline.includes(particular));
}

const londonDay = (instant: string | Date) => londonDateAndTime(new Date(instant)).date;

function shiftDay(day: string, { months = 0, days = 0 }) {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1 + months, date + days))
    .toISOString()
    .slice(0, 10);
}

/** The last day the record of a driver who stopped on `endDate` must be kept. */
export function keepRecordUntil(endDate: string): string {
  return shiftDay(londonDay(endDate), { months: RECORD_KEEP_MONTHS });
}

/**
 * Whether TfL expects the record kept today: while the driver is available,
 * and for 12 months after they stop. Without a stop date, it is kept.
 */
export function recordRequired(
  driver: { status: string; endDate?: string | null },
  now: Date,
): boolean {
  if (driver.status !== "left" || !driver.endDate) return true;
  return keepRecordUntil(driver.endDate) >= londonDay(now);
}

/**
 * The notice TfL is owed when Cityline stops using a driver because of their
 * conduct driving a PHV: due 14 days after they stopped, until it is sent.
 */
export function conductNotice(
  driver: {
    status: string;
    endDate?: string | null;
    leftForConduct?: boolean | null;
    tflToldAt?: string | null;
  },
  now: Date,
): { due: string; overdue: boolean } | null {
  if (driver.status !== "left" || !driver.leftForConduct || driver.tflToldAt) return null;
  if (!driver.endDate) return { due: londonDay(now), overdue: false };
  const due = shiftDay(londonDay(driver.endDate), { days: CONDUCT_NOTICE_DAYS });
  return { due, overdue: due < londonDay(now) };
}
