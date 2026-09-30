/**
 * Driver and vehicle documents, and whether they are in date (CMP-10,
 * DRV-02, VEH-02, DOC-01).
 *
 * A driver or vehicle may carry several documents of one type over time — a
 * renewed licence is a new document, and the old one stays on record. The one
 * that counts is the most recent: the latest expiry, or the latest recorded if
 * a type does not expire.
 *
 * Status is always judged at a moment. For the compliance screens that moment
 * is now; for assigning a job it is the pickup time — a licence that runs out
 * tonight must not be assigned to tomorrow's airport run.
 */

export const DRIVER_DOCUMENT_TYPES = [
  "phv_licence",
  "dvla_licence",
  "dbs",
  "right_to_work",
  "other",
] as const;
export type DriverDocumentType = (typeof DRIVER_DOCUMENT_TYPES)[number];

export const VEHICLE_DOCUMENT_TYPES = [
  "phv_vehicle_licence",
  "mot",
  "insurance",
  "v5c",
  "service",
] as const;
export type VehicleDocumentType = (typeof VEHICLE_DOCUMENT_TYPES)[number];

export type DocumentType = DriverDocumentType | VehicleDocumentType;

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  phv_licence: "PHV driver licence",
  dvla_licence: "DVLA driving licence",
  dbs: "DBS certificate",
  right_to_work: "Right to work",
  other: "Other document",
  phv_vehicle_licence: "PHV vehicle licence",
  mot: "MOT certificate",
  insurance: "Hire and reward insurance",
  v5c: "V5C logbook",
  service: "Service record",
};

/** Without these, in date, a driver cannot be given a job. */
export const REQUIRED_DRIVER_DOCUMENTS: readonly DriverDocumentType[] = [
  "phv_licence",
  "dvla_licence",
  "dbs",
  "right_to_work",
];

/** Without these, in date, a vehicle cannot be given a job. */
export const REQUIRED_VEHICLE_DOCUMENTS: readonly VehicleDocumentType[] = [
  "phv_vehicle_licence",
  "mot",
  "insurance",
];

/**
 * Types that must carry an expiry date. Right to work may not expire (a
 * British citizen's does not); a V5C and a service record never do.
 */
export const EXPIRING_TYPES: ReadonlySet<DocumentType> = new Set([
  "phv_licence",
  "dvla_licence",
  "dbs",
  "phv_vehicle_licence",
  "mot",
  "insurance",
]);

export type DocumentStatus =
  "missing" | "expired" | "expiring_7" | "expiring_14" | "expiring_30" | "valid";

export interface DocumentRecord {
  type: string;
  expiresAt?: string | Date | null;
  createdAt?: string | Date | null;
  number?: string | null;
}

const DAY_MS = 86_400_000;

/** Status of one document at a moment. */
export function documentStatus(
  document: Pick<DocumentRecord, "expiresAt"> | null | undefined,
  at: Date,
): DocumentStatus {
  if (!document) return "missing";
  if (!document.expiresAt) return "valid";
  const expires = new Date(document.expiresAt).getTime();
  if (expires <= at.getTime()) return "expired";
  const days = (expires - at.getTime()) / DAY_MS;
  if (days <= 7) return "expiring_7";
  if (days <= 14) return "expiring_14";
  if (days <= 30) return "expiring_30";
  return "valid";
}

/** The document of a type that counts: latest expiry, else latest recorded. */
export function currentDocument<T extends DocumentRecord>(
  documents: readonly T[],
  type: string,
): T | null {
  const ofType = documents.filter((document) => document.type === type);
  if (ofType.length === 0) return null;
  return [...ofType].sort((a, b) => {
    const expiryA = a.expiresAt
      ? new Date(a.expiresAt).getTime()
      : Number.POSITIVE_INFINITY;
    const expiryB = b.expiresAt
      ? new Date(b.expiresAt).getTime()
      : Number.POSITIVE_INFINITY;
    if (expiryA !== expiryB) return expiryB - expiryA;
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return createdB - createdA;
  })[0]!;
}

export interface RequirementResult<T extends DocumentRecord> {
  type: string;
  document: T | null;
  status: DocumentStatus;
}

/** Each required document's current record and status. */
export function requirements<T extends DocumentRecord>(
  required: readonly string[],
  documents: readonly T[],
  at: Date,
): RequirementResult<T>[] {
  return required.map((type) => {
    const document = currentDocument(documents, type);
    return { type, document, status: documentStatus(document, at) };
  });
}

/** Missing or expired documents block work; expiring ones only warn. */
export function isBlocking(status: DocumentStatus): boolean {
  return status === "missing" || status === "expired";
}

const SEVERITY: Record<DocumentStatus, number> = {
  missing: 0,
  expired: 1,
  expiring_7: 2,
  expiring_14: 3,
  expiring_30: 4,
  valid: 5,
};

/** The worst status in a set — what a compliance badge shows. */
export function worstStatus(statuses: readonly DocumentStatus[]): DocumentStatus {
  if (statuses.length === 0) return "valid";
  return statuses.reduce((worst, status) =>
    SEVERITY[status] < SEVERITY[worst] ? status : worst,
  );
}

const londonDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });

/**
 * Calendar days from `at` to the expiry date, London time — what staff mean by
 * "expires in 5 days". A document expiring on Saturday is 5 days away on
 * Monday, whatever the hour.
 */
export function daysUntil(expiresAt: string | Date, at: Date): number {
  const expiryDay = Date.parse(`${londonDate.format(new Date(expiresAt))}T00:00:00Z`);
  const today = Date.parse(`${londonDate.format(at)}T00:00:00Z`);
  return Math.round((expiryDay - today) / DAY_MS);
}
