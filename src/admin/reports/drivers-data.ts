import type { Payload, Where } from "payload";

import { relId } from "@/domain/dispatch/assignment";
import {
  conductNotice,
  formatNiNumber,
  keepRecordUntil,
  missingParticulars,
  PARTICULAR_LABELS,
  recordRequired,
  type Particular,
} from "@/domain/fleet/driver-record";
import { DRIVER_STATUS_LABELS } from "@/domain/fleet/labels";
import type { JobStatus } from "@/domain/jobs/labels";
import { stageName } from "@/domain/jobs/status";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import type { CsvColumn } from "@/lib/csv";
import { londonDateAndTime } from "@/lib/time";
import type { Driver, DriverDocument, Job, User } from "@/payload-types";

import {
  buildDriversReport,
  DONE_STATUSES,
  minutesLate,
  minutesToConfirm,
  ON_TIME_GRACE_MINUTES,
  type DriverJob,
  type DriverJobLine,
  type DriverRow,
  type DriversReport,
  type TakenOffEvent,
} from "./drivers-report";
import { clientLabel } from "./jobs-report";
import type { Period } from "./period";

/**
 * Loading the Driver Report: the period's bookings (test bookings never),
 * the drivers taken off them with the reasons written, the comparison
 * period's, and — not tied to the period — the TfL record of every driver
 * TfL expects Cityline to keep. The screen and the CSV downloads both use
 * this, so they always agree. No money is loaded, except on one driver's
 * page: what each job was offered to them for (never whether it was paid).
 */

export const DRIVER_STATUSES = ["active", "suspended", "left"] as const;
type DriverStatus = (typeof DRIVER_STATUSES)[number];

export interface DriversReportFilters {
  driver: number | null;
  driverStatus: DriverStatus | "";
  supplier: number | null;
  vehicle: string;
}

type Params = Record<string, string | string[] | undefined> | undefined;
const read = (params: Params, key: string) => {
  const value = params?.[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
};
const id = (value: string) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

export function parseDriversReportFilters(params: Params): DriversReportFilters {
  const status = read(params, "driverStatus");
  const vehicle = read(params, "vehicle");
  return {
    driver: id(read(params, "driver")),
    driverStatus: (DRIVER_STATUSES as readonly string[]).includes(status)
      ? (status as DriverStatus)
      : "",
    supplier: id(read(params, "supplier")),
    vehicle: VEHICLE_CLASSES.some((item) => item.slug === vehicle) ? vehicle : "",
  };
}

/** The filters as a query string, for links and the CSV downloads. */
export function driversFilterQuery(filters: DriversReportFilters): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.driver) query.set("driver", String(filters.driver));
  if (filters.driverStatus) query.set("driverStatus", filters.driverStatus);
  if (filters.supplier) query.set("supplier", String(filters.supplier));
  if (filters.vehicle) query.set("vehicle", filters.vehicle);
  return query;
}

export interface DriverBookingRow extends DriverJob {
  reference: string;
  supplierReference: string | null;
  client: string;
  pickupAddress: string;
  dropoff: string;
  driverName: string;
  phvNumber: string | null;
  vehicleReg: string | null;
  onTheWayAt: string | null;
  onBoardAt: string | null;
  completedAt: string | null;
  noShowAt: string | null;
}

export interface LatestDocument {
  number: string | null;
  expiresAt: string | null;
  /** A copy — the file — is on record. */
  copy: boolean;
}

export interface DriverRecordRow {
  driverId: number;
  firstName: string;
  lastName: string;
  name: string;
  /** "registered" or "outsourced": an outsourced driver's copies are kept offline. */
  engagement: string;
  status: string;
  address: string | null;
  dateOfBirth: string | null;
  niNumber: string | null;
  drivingLicence: LatestDocument | null;
  phvLicence: LatestDocument | null;
  /** An outsourced driver's typed-in PHV licence number, if any. */
  phvLicenceNumber: string | null;
  photo: boolean;
  startDate: string | null;
  endDate: string | null;
  leftReason: string | null;
  leftForConduct: boolean;
  tflToldAt: string | null;
  keepUntil: string | null;
  missing: Particular[];
  notice: { due: string; overdue: boolean } | null;
}

export interface DriversReportData {
  report: DriversReport;
  rows: DriverBookingRow[];
  records: DriverRecordRow[];
}

function where(filters: DriversReportFilters, start: Date, end: Date): Where {
  const and: Where[] = [
    { isTest: { not_equals: true } },
    { pickupAt: { greater_than_equal: start.toISOString() } },
    { pickupAt: { less_than: end.toISOString() } },
  ];
  if (filters.supplier) and.push({ supplier: { equals: filters.supplier } });
  if (filters.vehicle) and.push({ vehicleClassSlug: { equals: filters.vehicle } });
  return { and };
}

const toDriverJob =
  (allowed: ReadonlySet<number>) =>
  (job: Pick<Job, "id" | "status" | "driver" | "pickupAt"> & Partial<Job>): DriverJob => {
    const driverId = relId(job.driver);
    return {
      id: job.id,
      status: job.status as JobStatus,
      driverId: driverId !== null && allowed.has(driverId) ? driverId : null,
      pickupAt: job.pickupAt,
      dispatchedAt: job.dispatchedAt ?? null,
      driverConfirmedAt: job.driverConfirmedAt ?? null,
      atPickupAt: job.atPickupAt ?? null,
    };
  };

function latestOf(
  documents: readonly DriverDocument[],
  type: string,
): LatestDocument | null {
  // Newest first already; a renewal is a new document, the latest one counts.
  const document = documents.find((item) => item.type === type);
  if (!document) return null;
  return {
    number: document.number ?? null,
    expiresAt: document.expiresAt ?? null,
    copy: Boolean(document.file),
  };
}

export async function loadDriversReport(
  payload: Payload,
  user: User,
  period: Period,
  filters: DriversReportFilters,
  now: Date,
): Promise<DriversReportData> {
  const as = { user, overrideAccess: false } as const;

  const [current, previous, suppliers, drivers] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: where(filters, period.start, period.end),
      sort: "pickupAt",
      pagination: false,
      depth: 0,
      ...as,
    }),
    payload.find({
      collection: "jobs",
      where: where(filters, period.previous.start, period.previous.end),
      pagination: false,
      depth: 0,
      select: {
        status: true,
        driver: true,
        pickupAt: true,
        dispatchedAt: true,
        driverConfirmedAt: true,
        atPickupAt: true,
      },
      ...as,
    }),
    payload.find({ collection: "suppliers", pagination: false, depth: 0, ...as }),
    payload.find({
      collection: "drivers",
      sort: "fullName",
      pagination: false,
      depth: 0,
      ...as,
    }),
  ]);

  const chosen = (drivers.docs as Driver[]).filter(
    (driver) =>
      (!filters.driver || driver.id === filters.driver) &&
      (!filters.driverStatus || driver.status === filters.driverStatus),
  );
  const allowed = new Set(chosen.map((driver) => driver.id));
  const driverName = new Map(
    (drivers.docs as Driver[]).map((driver) => [
      driver.id,
      driver.fullName ?? `Driver ${driver.id}`,
    ]),
  );
  const supplierName = new Map(
    suppliers.docs.map((supplier) => [supplier.id, supplier.name]),
  );

  // Drivers taken off the period's bookings, and the previous period's.
  const takenOffWhere = (jobIds: number[]): Where => ({
    and: [{ job: { in: jobIds } }, { driverTakenOff: { exists: true } }],
  });
  const currentIds = current.docs.map((job) => job.id);
  const previousIds = previous.docs.map((job) => job.id);
  const [events, previousEvents] = await Promise.all([
    currentIds.length
      ? payload.find({
          collection: "job-events",
          where: takenOffWhere(currentIds),
          sort: "-createdAt",
          pagination: false,
          depth: 0,
          ...as,
        })
      : { docs: [] },
    previousIds.length
      ? payload.find({
          collection: "job-events",
          where: takenOffWhere(previousIds),
          pagination: false,
          depth: 0,
          select: { driverTakenOff: true },
          ...as,
        })
      : { docs: [] },
  ]);
  const ownEvents = events.docs.filter((event) => {
    const driverId = relId(event.driverTakenOff);
    return driverId !== null && allowed.has(driverId);
  });
  const actorIds = [
    ...new Set(
      ownEvents
        .map((event) => relId(event.actorUser))
        .filter((value): value is number => value !== null),
    ),
  ];
  const actors = actorIds.length
    ? await payload.find({
        collection: "users",
        where: { id: { in: actorIds } },
        pagination: false,
        depth: 0,
        ...as,
      })
    : { docs: [] };
  const actorName = new Map(
    actors.docs.map((member) => [member.id, member.name || member.email]),
  );
  const jobById = new Map(current.docs.map((job) => [job.id, job]));
  const takenOff: TakenOffEvent[] = ownEvents.map((event) => {
    const job = jobById.get(relId(event.job) ?? 0);
    const actorId = relId(event.actorUser);
    return {
      jobId: job?.id ?? 0,
      reference: job?.reference ?? "",
      pickupAt: job?.pickupAt ?? event.createdAt,
      driverId: relId(event.driverTakenOff)!,
      at: event.createdAt,
      reason: event.note ?? null,
      by: actorId ? (actorName.get(actorId) ?? "Staff") : "Staff",
    };
  });
  const previousTakenOff = previousEvents.docs.filter((event) => {
    const driverId = relId(event.driverTakenOff);
    return driverId !== null && allowed.has(driverId);
  }).length;

  const jobs = current.docs.map(toDriverJob(allowed));
  const report = buildDriversReport({
    jobs,
    previousJobs: (previous.docs as Job[]).map(toDriverJob(allowed)),
    takenOff,
    previousTakenOff,
    drivers: chosen.map((driver) => ({
      id: driver.id,
      name: driverName.get(driver.id)!,
      status: driver.status,
    })),
    period,
  });

  // The raw rows: every booking in the period with one of these drivers on it.
  const rows: DriverBookingRow[] = current.docs.flatMap((job, index) => {
    const base = jobs[index]!;
    if (base.driverId === null) return [];
    const supplierId = relId(job.supplier);
    return [
      {
        ...base,
        reference: job.reference,
        supplierReference: job.supplierReference ?? null,
        client: clientLabel({
          source: job.source,
          supplierName: supplierId ? (supplierName.get(supplierId) ?? null) : null,
        }),
        pickupAddress: job.pickupAddress,
        dropoff:
          job.dropoffAddress ?? (job.hours ? `Hourly hire, ${job.hours} hours` : ""),
        driverName: driverName.get(base.driverId) ?? `Driver ${base.driverId}`,
        phvNumber: job.driverPhvNo ?? null,
        vehicleReg: job.vehicleReg ?? null,
        onTheWayAt: job.onTheWayAt ?? null,
        onBoardAt: job.onBoardAt ?? null,
        completedAt: job.completedAt ?? null,
        noShowAt: job.noShowAt ?? null,
      },
    ];
  });

  // TfL's driver records: today, not the period — every driver TfL expects
  // Cityline to keep a record of (available now, or stopped within 12 months).
  const onRecord = chosen.filter((driver) => recordRequired(driver, now));
  const documents = onRecord.length
    ? await payload.find({
        collection: "driver-documents",
        where: { driver: { in: onRecord.map((driver) => driver.id) } },
        sort: "-createdAt",
        pagination: false,
        depth: 0,
        ...as,
      })
    : { docs: [] };
  const documentsOf = new Map<number, DriverDocument[]>();
  for (const document of documents.docs as DriverDocument[]) {
    const owner = relId(document.driver);
    if (owner === null) continue;
    documentsOf.set(owner, [...(documentsOf.get(owner) ?? []), document]);
  }
  const records: DriverRecordRow[] = onRecord.map((driver) => {
    const own = documentsOf.get(driver.id) ?? [];
    return {
      driverId: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      name: driverName.get(driver.id)!,
      status: driver.status,
      address: driver.address ?? null,
      dateOfBirth: driver.dateOfBirth ?? null,
      niNumber: driver.nationalInsuranceNumber ?? null,
      drivingLicence: latestOf(own, "dvla_licence"),
      phvLicence: latestOf(own, "phv_licence"),
      phvLicenceNumber: driver.phvLicenceNumber ?? null,
      photo: Boolean(driver.photo),
      engagement: driver.engagement ?? "registered",
      startDate: driver.startDate ?? null,
      endDate: driver.endDate ?? null,
      leftReason: driver.leftReason ?? null,
      leftForConduct: Boolean(driver.leftForConduct),
      tflToldAt: driver.tflToldAt ?? null,
      keepUntil:
        driver.status === "left" && driver.endDate
          ? keepRecordUntil(driver.endDate)
          : null,
      missing: missingParticulars({ ...driver, documents: own }),
      notice: conductNotice(driver, now),
    };
  });

  return { report, rows, records };
}

// --- One driver's jobs -------------------------------------------------------------

export interface DriverJobRow extends DriverJobLine {
  id: number;
  reference: string;
  pickupAddress: string;
  dropoff: string;
  vehicleReg: string | null;
}

/**
 * One driver's jobs done in the period — completed or PNS, newest first —
 * with what each was offered to them for. Test bookings never.
 */
export async function loadDriverJobs(
  payload: Payload,
  user: User,
  driverId: number,
  period: Pick<Period, "start" | "end">,
): Promise<DriverJobRow[]> {
  const jobs = await payload.find({
    collection: "jobs",
    where: {
      and: [
        { driver: { equals: driverId } },
        { status: { in: [...DONE_STATUSES] } },
        { isTest: { not_equals: true } },
        { pickupAt: { greater_than_equal: period.start.toISOString() } },
        { pickupAt: { less_than: period.end.toISOString() } },
      ],
    },
    sort: "-pickupAt",
    pagination: false,
    depth: 0,
    select: {
      reference: true,
      status: true,
      pickupAt: true,
      pickupAddress: true,
      dropoffAddress: true,
      hours: true,
      vehicleReg: true,
      driverPricePence: true,
    },
    user,
    overrideAccess: false,
  });
  return jobs.docs.map((job) => ({
    id: job.id,
    reference: job.reference,
    status: job.status as JobStatus,
    pickupAt: job.pickupAt,
    pickupAddress: job.pickupAddress,
    dropoff: job.dropoffAddress ?? (job.hours ? `Hourly hire, ${job.hours} hours` : ""),
    vehicleReg: job.vehicleReg ?? null,
    driverPricePence: job.driverPricePence ?? null,
  }));
}

// --- CSV ------------------------------------------------------------------------

const day = (iso: string | null | undefined) =>
  iso ? londonDateAndTime(new Date(iso)).date : "";
const stamp = (iso: string | null | undefined) => {
  if (!iso) return "";
  const { date, time } = londonDateAndTime(new Date(iso));
  return `${date} ${time}`;
};
const yesNo = (value: boolean) => (value ? "Yes" : "No");

/** One row per booking a driver had in the period. */
export const DRIVER_BOOKINGS_CSV_COLUMNS: CsvColumn<DriverBookingRow>[] = [
  { header: "Booking", value: (row) => row.reference },
  { header: "Supplier reference", value: (row) => row.supplierReference },
  { header: "Client", value: (row) => row.client },
  { header: "Pickup date", value: (row) => day(row.pickupAt) },
  { header: "Pickup time", value: (row) => stamp(row.pickupAt).slice(11) },
  { header: "Pickup", value: (row) => row.pickupAddress },
  { header: "Drop-off", value: (row) => row.dropoff },
  { header: "Driver", value: (row) => row.driverName },
  { header: "PHV licence", value: (row) => row.phvNumber },
  { header: "Vehicle", value: (row) => row.vehicleReg },
  { header: "Status", value: (row) => stageName(row.status) },
  { header: "Driver assigned", value: (row) => stamp(row.dispatchedAt) },
  { header: "Driver confirmed", value: (row) => stamp(row.driverConfirmedAt) },
  { header: "Minutes to confirm", value: (row) => minutesToConfirm(row) },
  { header: "DOW", value: (row) => stamp(row.onTheWayAt) },
  { header: "DAP", value: (row) => stamp(row.atPickupAt) },
  { header: "Minutes after pickup time at DAP", value: (row) => minutesLate(row) },
  {
    header: `On time (within ${ON_TIME_GRACE_MINUTES} min)`,
    value: (row) => {
      const late = minutesLate(row);
      return late === null ? "" : yesNo(late <= ON_TIME_GRACE_MINUTES);
    },
  },
  { header: "POB", value: (row) => stamp(row.onBoardAt) },
  { header: "Completed", value: (row) => stamp(row.completedAt) },
  { header: "PNS", value: (row) => stamp(row.noShowAt) },
];

/** One row per driver: the table on the screen. */
export const DRIVER_SUMMARY_CSV_COLUMNS: CsvColumn<DriverRow>[] = [
  { header: "Driver", value: (row) => row.name },
  { header: "Status", value: (row) => DRIVER_STATUS_LABELS[row.status] ?? row.status },
  { header: "Jobs done", value: (row) => row.driven },
  { header: "Last job", value: (row) => day(row.lastJobAt) },
  { header: "Bookings", value: (row) => row.bookings },
  { header: "Completed", value: (row) => row.completed },
  { header: "PNS", value: (row) => row.noShows },
  { header: "Taken off", value: (row) => row.takenOff },
  { header: "Arrivals recorded (DAP)", value: (row) => row.arrivals },
  { header: "On time", value: (row) => row.onTime },
  {
    header: "On time %",
    value: (row) => (row.arrivals ? Math.round((row.onTime / row.arrivals) * 100) : ""),
  },
  {
    header: "Typical minutes to confirm",
    value: (row) =>
      row.medianConfirmMinutes === null ? "" : Math.round(row.medianConfirmMinutes),
  },
  { header: "Days worked", value: (row) => row.daysWorked },
];

/** One row per time a driver was taken off a booking. */
export const TAKEN_OFF_CSV_COLUMNS: CsvColumn<TakenOffEvent & { driverName: string }>[] =
  [
    { header: "Booking", value: (row) => row.reference },
    { header: "Pickup", value: (row) => stamp(row.pickupAt) },
    { header: "Driver taken off", value: (row) => row.driverName },
    { header: "Taken off at", value: (row) => stamp(row.at) },
    { header: "By", value: (row) => row.by },
    { header: "Reason", value: (row) => row.reason },
  ];

/** TfL's driver record, one row per driver Cityline must keep a record of. */
/** "Yes", or for an outsourced driver without one here, "Kept offline". */
const copyHeld = (row: DriverRecordRow, here: boolean) =>
  here ? "Yes" : row.engagement === "outsourced" ? "Kept offline" : "No";

export const DRIVER_RECORDS_CSV_COLUMNS: CsvColumn<DriverRecordRow>[] = [
  { header: "Surname", value: (row) => row.lastName },
  { header: "Forenames", value: (row) => row.firstName },
  { header: "Status", value: (row) => DRIVER_STATUS_LABELS[row.status] ?? row.status },
  {
    header: "Type",
    value: (row) => (row.engagement === "outsourced" ? "Outsourced" : "Registered"),
  },
  { header: "Address", value: (row) => row.address },
  { header: "Date of birth", value: (row) => day(row.dateOfBirth) },
  {
    header: "National Insurance number",
    value: (row) => (row.niNumber ? formatNiNumber(row.niNumber) : ""),
  },
  { header: "Driving licence number", value: (row) => row.drivingLicence?.number },
  {
    header: "Driving licence copy on file",
    value: (row) => copyHeld(row, Boolean(row.drivingLicence?.copy)),
  },
  {
    header: "PHV driver's licence number",
    value: (row) => row.phvLicence?.number ?? row.phvLicenceNumber,
  },
  { header: "PHV licence expires", value: (row) => day(row.phvLicence?.expiresAt) },
  {
    header: "PHV licence copy on file",
    value: (row) => copyHeld(row, Boolean(row.phvLicence?.copy)),
  },
  { header: "Photograph on file", value: (row) => copyHeld(row, row.photo) },
  { header: "Available from", value: (row) => day(row.startDate) },
  { header: "Stopped being available", value: (row) => day(row.endDate) },
  { header: "Why they left", value: (row) => row.leftReason },
  {
    header: "Stopped for conduct",
    value: (row) => (row.status === "left" ? yesNo(row.leftForConduct) : ""),
  },
  { header: "TfL told on", value: (row) => day(row.tflToldAt) },
  { header: "Keep record until", value: (row) => row.keepUntil },
  {
    header: "Missing particulars",
    value: (row) => row.missing.map((item) => PARTICULAR_LABELS[item]).join("; "),
  },
];

/** One driver's jobs done: what the driver's page in the report lists. */
export const DRIVER_JOBS_CSV_COLUMNS: CsvColumn<DriverJobRow>[] = [
  { header: "Pickup date", value: (row) => day(row.pickupAt) },
  { header: "Pickup time", value: (row) => stamp(row.pickupAt).slice(11) },
  { header: "Booking", value: (row) => row.reference },
  { header: "Pickup", value: (row) => row.pickupAddress },
  { header: "Drop-off", value: (row) => row.dropoff },
  { header: "Status", value: (row) => stageName(row.status) },
  { header: "Vehicle", value: (row) => row.vehicleReg },
  {
    header: "Driver price (£)",
    value: (row) =>
      row.driverPricePence === null ? "" : (row.driverPricePence / 100).toFixed(2),
  },
];
