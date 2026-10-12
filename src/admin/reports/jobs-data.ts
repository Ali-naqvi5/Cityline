import type { Payload, Where } from "payload";

import { relId } from "@/domain/dispatch/assignment";
import {
  isJobSource,
  isJobStatus,
  JOB_SOURCE_LABELS,
  vehicleClassName,
  type JobSource,
  type JobStatus,
} from "@/domain/jobs/labels";
import { SERVICE_LABELS, serviceType, type ServiceType } from "@/domain/jobs/service";
import { stageName } from "@/domain/jobs/status";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import type { CsvColumn } from "@/lib/csv";
import { londonDateAndTime } from "@/lib/time";
import type { Job, User } from "@/payload-types";

import {
  buildJobsReport,
  clientLabel,
  type JobsReport,
  type ReportJob,
} from "./jobs-report";
import type { Period } from "./period";

/**
 * Loading the Jobs Report: the period's bookings (test bookings never), the
 * comparison period's, and the names the raw rows show. The screen and the
 * CSV download both use this, so they always agree. No money is loaded.
 */

export interface JobsReportFilters {
  source: JobSource | "";
  supplier: number | null;
  driver: number | null;
  vehicle: string;
  status: JobStatus | "";
  service: ServiceType | "";
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

export function parseJobsReportFilters(params: Params): JobsReportFilters {
  const source = read(params, "source");
  const status = read(params, "status");
  const vehicle = read(params, "vehicle");
  const service = read(params, "service");
  return {
    source: isJobSource(source) ? source : "",
    supplier: id(read(params, "supplier")),
    driver: id(read(params, "driver")),
    vehicle: VEHICLE_CLASSES.some((item) => item.slug === vehicle) ? vehicle : "",
    status: isJobStatus(status) ? status : "",
    service: service in SERVICE_LABELS ? (service as ServiceType) : "",
  };
}

/** The filters as a query string, for links and the CSV download. */
export function filterQuery(filters: JobsReportFilters): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.source) query.set("source", filters.source);
  if (filters.supplier) query.set("supplier", String(filters.supplier));
  if (filters.driver) query.set("driver", String(filters.driver));
  if (filters.vehicle) query.set("vehicle", filters.vehicle);
  if (filters.status) query.set("status", filters.status);
  if (filters.service) query.set("service", filters.service);
  return query;
}

export interface JobsReportRow extends ReportJob {
  bookingReference: string | null;
  supplierReference: string | null;
  flightNumber: string | null;
  passengers: number;
  largeBags: number;
  smallBags: number;
  passenger: string;
  driverName: string | null;
  vehicleReg: string | null;
  takenBy: string;
}

function where(filters: JobsReportFilters, start: Date, end: Date): Where {
  const and: Where[] = [
    { isTest: { not_equals: true } },
    { archivedAt: { exists: false } },
    { pickupAt: { greater_than_equal: start.toISOString() } },
    { pickupAt: { less_than: end.toISOString() } },
  ];
  if (filters.source) and.push({ source: { equals: filters.source } });
  if (filters.supplier) and.push({ supplier: { equals: filters.supplier } });
  if (filters.driver) and.push({ driver: { equals: filters.driver } });
  if (filters.vehicle) and.push({ vehicleClassSlug: { equals: filters.vehicle } });
  if (filters.status) and.push({ status: { equals: filters.status } });
  return { and };
}

const byService = (filters: JobsReportFilters) => (job: Job) =>
  !filters.service || serviceType(job) === filters.service;

export async function loadJobsReport(
  payload: Payload,
  user: User,
  period: Period,
  filters: JobsReportFilters,
  now: Date,
): Promise<{ report: JobsReport; rows: JobsReportRow[] }> {
  const as = { user, overrideAccess: false } as const;

  const [current, previous, suppliers] = await Promise.all([
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
      select: { status: true, pickupAddress: true, dropoffAddress: true, hours: true },
      ...as,
    }),
    payload.find({ collection: "suppliers", pagination: false, depth: 0, ...as }),
  ]);

  const jobs = current.docs.filter(byService(filters));
  const supplierName = new Map(
    suppliers.docs.map((supplier) => [supplier.id, supplier.name]),
  );

  const ids = (pick: (job: Job) => unknown) => [
    ...new Set(
      jobs
        .map((job) => relId(pick(job)))
        .filter((value): value is number => value !== null),
    ),
  ];
  const [drivers, users, bookings] = await Promise.all([
    ids((job) => job.driver).length
      ? payload.find({
          collection: "drivers",
          where: { id: { in: ids((job) => job.driver) } },
          pagination: false,
          depth: 0,
          ...as,
        })
      : { docs: [] },
    ids((job) => job.takenByUser).length
      ? payload.find({
          collection: "users",
          where: { id: { in: ids((job) => job.takenByUser) } },
          pagination: false,
          depth: 0,
          ...as,
        })
      : { docs: [] },
    ids((job) => job.booking).length
      ? payload.find({
          collection: "bookings",
          where: { id: { in: ids((job) => job.booking) } },
          pagination: false,
          depth: 0,
          select: { reference: true },
          ...as,
        })
      : { docs: [] },
  ]);
  const driverName = new Map(
    drivers.docs.map((driver) => [driver.id, driver.fullName ?? ""]),
  );
  const userName = new Map(
    users.docs.map((member) => [member.id, member.name || member.email]),
  );
  const bookingReference = new Map(
    bookings.docs.map((booking) => [booking.id, booking.reference]),
  );

  const rows: JobsReportRow[] = jobs.map((job) => {
    const supplierId = relId(job.supplier);
    const driverId = relId(job.driver);
    const takenById = relId(job.takenByUser);
    const bookingId = relId(job.booking);
    return {
      id: job.id,
      reference: job.reference,
      status: job.status,
      source: job.source,
      supplierName: supplierId ? (supplierName.get(supplierId) ?? null) : null,
      vehicleClassSlug: job.vehicleClassSlug,
      pickupAt: job.pickupAt,
      pickupAddress: job.pickupAddress,
      dropoffAddress: job.dropoffAddress ?? null,
      hours: job.hours ?? null,
      takenAt: job.takenAt ?? job.createdAt,
      dispatchedAt: job.dispatchedAt ?? null,
      cancelReason: job.cancelReason ?? null,
      bookingReference: bookingId ? (bookingReference.get(bookingId) ?? null) : null,
      supplierReference: job.supplierReference ?? null,
      flightNumber: job.flightNumber ?? null,
      passengers: job.passengers,
      largeBags: job.largeBags,
      smallBags: job.smallBags,
      passenger: job.nameBoardText || job.leadName,
      driverName: driverId ? (driverName.get(driverId) ?? null) : null,
      vehicleReg: job.vehicleReg ?? null,
      takenBy:
        job.source === "website"
          ? "Website"
          : takenById
            ? (userName.get(takenById) ?? "Staff")
            : "—",
    };
  });

  const report = buildJobsReport(
    rows,
    (previous.docs as Job[]).filter(byService(filters)),
    period,
    now,
  );
  return { report, rows };
}

const when = (iso: string | null) => {
  if (!iso) return { date: "", time: "" };
  return londonDateAndTime(new Date(iso));
};

/** The raw data, one row per booking, as the CSV download writes it. */
export const JOBS_CSV_COLUMNS: CsvColumn<JobsReportRow>[] = [
  { header: "Booking", value: (row) => row.reference },
  { header: "Website booking", value: (row) => row.bookingReference },
  { header: "Supplier reference", value: (row) => row.supplierReference },
  {
    header: "Source",
    value: (row) => JOB_SOURCE_LABELS[row.source as JobSource] ?? row.source,
  },
  { header: "Client", value: (row) => clientLabel(row) },
  { header: "Service", value: (row) => SERVICE_LABELS[serviceType(row)] },
  { header: "Pickup date", value: (row) => when(row.pickupAt).date },
  { header: "Pickup time", value: (row) => when(row.pickupAt).time },
  { header: "Pickup", value: (row) => row.pickupAddress },
  {
    header: "Drop-off",
    value: (row) =>
      row.dropoffAddress ?? (row.hours ? `Hourly hire, ${row.hours} hours` : ""),
  },
  { header: "Flight", value: (row) => row.flightNumber },
  { header: "Car", value: (row) => vehicleClassName(row.vehicleClassSlug) },
  { header: "Passengers", value: (row) => row.passengers },
  { header: "Large bags", value: (row) => row.largeBags },
  { header: "Small bags", value: (row) => row.smallBags },
  { header: "Passenger", value: (row) => row.passenger },
  { header: "Driver", value: (row) => row.driverName },
  { header: "Vehicle", value: (row) => row.vehicleReg },
  { header: "Status", value: (row) => stageName(row.status) },
  { header: "Taken by", value: (row) => row.takenBy },
  {
    header: "Taken",
    value: (row) => `${when(row.takenAt).date} ${when(row.takenAt).time}`.trim(),
  },
  {
    header: "Driver assigned",
    value: (row) =>
      `${when(row.dispatchedAt).date} ${when(row.dispatchedAt).time}`.trim(),
  },
  { header: "Cancellation reason", value: (row) => row.cancelReason },
];
