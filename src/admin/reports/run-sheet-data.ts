import type { Payload } from "payload";

import { isValidDay, londonDay, londonDayBounds } from "@/admin/format";
import {
  DOCUMENT_LABELS,
  REQUIRED_DRIVER_DOCUMENTS,
  REQUIRED_VEHICLE_DOCUMENTS,
  requirements,
  type DocumentType,
} from "@/domain/compliance/documents";
import { relId } from "@/domain/dispatch/assignment";
import { DRIVER_STATUS_LABELS, VEHICLE_STATUS_LABELS } from "@/domain/fleet/labels";
import { vehicleClassName, type JobStatus } from "@/domain/jobs/labels";
import { stageName } from "@/domain/jobs/status";
import { driverDayMessage, messageJobFrom } from "@/domain/messaging/driver-message";
import { EXTRAS } from "@/domain/pricing/extras";
import { company } from "@/lib/company";
import type { CsvColumn } from "@/lib/csv";
import { formatTime } from "@/lib/time";
import type {
  Driver,
  DriverDocument,
  Job,
  User,
  Vehicle,
  VehicleDocument,
} from "@/payload-types";

import { clientLabel } from "./jobs-report";
import { buildRunSheet, type RunSheet, type RunSheetJob } from "./run-sheet";

/**
 * Loading the Daily Run Sheet: one London day's bookings (test bookings
 * never, cancelled ones counted but not listed), their drivers, and every
 * driver and vehicle document checked at each booking's own pickup time.
 * The screen, the print and the CSV all use this.
 */

export type RunSheetView = "day" | "driver";

type Params = Record<string, string | string[] | undefined> | undefined;
const read = (params: Params, key: string) => {
  const value = params?.[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
};

/** The day (today by default, London time) and the view. */
export function parseRunSheetParams(
  params: Params,
  now: Date,
): { date: string; view: RunSheetView } {
  const date = read(params, "date");
  return {
    date: isValidDay(date) ? date : londonDay(now),
    view: read(params, "view") === "driver" ? "driver" : "day",
  };
}

export interface RunSheetData {
  sheet: RunSheet;
  cancelled: number;
  /** Each driver's day as a WhatsApp message, their price included. */
  messages: Map<number, string>;
}

const docLabel = (type: string) => DOCUMENT_LABELS[type as DocumentType] ?? type;

export async function loadRunSheet(
  payload: Payload,
  user: User,
  date: string,
  now: Date,
): Promise<RunSheetData> {
  const as = { user, overrideAccess: false } as const;
  const { start, end } = londonDayBounds(date);

  const [found, suppliers] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: {
        and: [
          { isTest: { not_equals: true } },
          { archivedAt: { exists: false } },
          { pickupAt: { greater_than_equal: start.toISOString() } },
          { pickupAt: { less_than: end.toISOString() } },
        ],
      },
      sort: "pickupAt",
      pagination: false,
      depth: 0,
      ...as,
    }),
    payload.find({ collection: "suppliers", pagination: false, depth: 0, ...as }),
  ]);
  const all = found.docs as Job[];
  const jobs = all.filter((job) => job.status !== "cancelled");
  const supplierName = new Map(
    suppliers.docs.map((supplier) => [supplier.id, supplier.name]),
  );

  const ids = (pick: (job: Job) => unknown) => [
    ...new Set(
      jobs.map((job) => relId(pick(job))).filter((id): id is number => id !== null),
    ),
  ];
  const driverIds = ids((job) => job.driver);
  const vehicleIds = ids((job) => job.vehicle);
  const none = { docs: [] };
  const [drivers, vehicles, driverDocuments, vehicleDocuments] = await Promise.all([
    driverIds.length
      ? payload.find({
          collection: "drivers",
          where: { id: { in: driverIds } },
          pagination: false,
          depth: 0,
          ...as,
        })
      : none,
    vehicleIds.length
      ? payload.find({
          collection: "vehicles",
          where: { id: { in: vehicleIds } },
          pagination: false,
          depth: 0,
          ...as,
        })
      : none,
    driverIds.length
      ? payload.find({
          collection: "driver-documents",
          where: { driver: { in: driverIds } },
          pagination: false,
          depth: 0,
          ...as,
        })
      : none,
    vehicleIds.length
      ? payload.find({
          collection: "vehicle-documents",
          where: { vehicle: { in: vehicleIds } },
          pagination: false,
          depth: 0,
          ...as,
        })
      : none,
  ]);
  const driverById = new Map(
    (drivers.docs as Driver[]).map((driver) => [driver.id, driver]),
  );
  const vehicleById = new Map(
    (vehicles.docs as Vehicle[]).map((vehicle) => [vehicle.id, vehicle]),
  );
  const group = <T>(docs: T[], owner: (doc: T) => unknown) => {
    const map = new Map<number, T[]>();
    for (const doc of docs) {
      const id = relId(owner(doc));
      if (id !== null) map.set(id, [...(map.get(id) ?? []), doc]);
    }
    return map;
  };
  const driverDocs = group(driverDocuments.docs as DriverDocument[], (doc) => doc.driver);
  const vehicleDocs = group(
    vehicleDocuments.docs as VehicleDocument[],
    (doc) => doc.vehicle,
  );

  /** What will not be valid at this booking's pickup time. */
  const problemsAt = (job: Job): string[] => {
    const at = new Date(job.pickupAt);
    const problems: string[] = [];
    const driverId = relId(job.driver);
    const vehicleId = relId(job.vehicle);
    const driver = driverId ? driverById.get(driverId) : undefined;
    const vehicle = vehicleId ? vehicleById.get(vehicleId) : undefined;
    if (driver && driver.status !== "active") {
      problems.push(`driver is ${DRIVER_STATUS_LABELS[driver.status]?.toLowerCase()}`);
    }
    if (vehicle && vehicle.status !== "active") {
      problems.push(
        `${vehicle.registration} is ${VEHICLE_STATUS_LABELS[vehicle.status]?.toLowerCase()}`,
      );
    }
    if (driverId) {
      for (const item of requirements(
        REQUIRED_DRIVER_DOCUMENTS,
        driverDocs.get(driverId) ?? [],
        at,
      )) {
        if (item.status === "missing") problems.push(`${docLabel(item.type)} missing`);
        if (item.status === "expired")
          problems.push(`${docLabel(item.type)} expired by the pickup`);
      }
    }
    if (vehicleId) {
      for (const item of requirements(
        REQUIRED_VEHICLE_DOCUMENTS,
        vehicleDocs.get(vehicleId) ?? [],
        at,
      )) {
        if (item.status === "missing")
          problems.push(
            `${vehicle?.registration ?? "vehicle"}: ${docLabel(item.type)} missing`,
          );
        if (item.status === "expired")
          problems.push(
            `${vehicle?.registration ?? "vehicle"}: ${docLabel(item.type)} expired by the pickup`,
          );
      }
    }
    return problems;
  };

  const rows: RunSheetJob[] = jobs.map((job) => {
    const supplierId = relId(job.supplier);
    return {
      id: job.id,
      reference: job.reference,
      status: job.status as JobStatus,
      pickupAt: job.pickupAt,
      client: clientLabel({
        source: job.source,
        supplierName: supplierId ? (supplierName.get(supplierId) ?? null) : null,
      }),
      supplierReference: job.supplierReference ?? null,
      passenger: job.nameBoardText || job.leadName,
      leadName: job.leadName,
      leadPhone: job.leadPhone,
      flightNumber: job.flightNumber ?? null,
      pickupAddress: job.pickupAddress,
      viaStops: (job.viaStops ?? []).map((stop) => stop.address),
      dropoffAddress: job.dropoffAddress ?? null,
      hours: job.hours ?? null,
      passengers: job.passengers,
      largeBags: job.largeBags,
      smallBags: job.smallBags,
      vehicleClassSlug: job.vehicleClassSlug,
      extras: (job.extras ?? []).map((extra) => ({
        name: EXTRAS.find((item) => item.slug === extra.slug)?.name ?? extra.slug,
        quantity: extra.quantity,
      })),
      meetAndGreet: job.meetAndGreet ?? false,
      driverNotes: job.driverNotes ?? null,
      driverId: relId(job.driver),
      vehicleReg: job.vehicleReg ?? null,
      problems: relId(job.driver) ? problemsAt(job) : [],
    };
  });

  const sheet = buildRunSheet(
    rows,
    (drivers.docs as Driver[]).map((driver) => ({
      id: driver.id,
      name: driver.fullName ?? `Driver ${driver.id}`,
      firstName: driver.firstName,
      phone: driver.phone,
      whatsappConsent: Boolean(driver.whatsappConsentAt),
    })),
    now,
  );

  // Each driver's day — the jobs still to do — as one WhatsApp message.
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const messages = new Map<number, string>();
  for (const day of sheet.days) {
    const toDo = day.jobs.filter(
      (job) => job.status !== "completed" && job.status !== "no_show",
    );
    if (toDo.length === 0) continue;
    messages.set(
      day.driver.id,
      driverDayMessage(
        day.driver.firstName,
        toDo.map((job) => messageJobFrom(jobById.get(job.id)!)),
        company.phone,
      ),
    );
  }

  return { sheet, cancelled: all.length - jobs.length, messages };
}

/** The day as a spreadsheet, one row per booking. No prices. */
export function runSheetCsvColumns(
  driverName: (id: number | null) => string,
): CsvColumn<RunSheetJob>[] {
  return [
    { header: "Pickup time", value: (row) => formatTime(new Date(row.pickupAt)) },
    { header: "Booking", value: (row) => row.reference },
    { header: "Supplier reference", value: (row) => row.supplierReference },
    { header: "Client", value: (row) => row.client },
    { header: "Passenger", value: (row) => row.passenger },
    { header: "Passenger phone", value: (row) => row.leadPhone },
    { header: "Flight", value: (row) => row.flightNumber },
    { header: "Pickup", value: (row) => row.pickupAddress },
    { header: "Stops", value: (row) => row.viaStops.join(" → ") },
    {
      header: "Drop-off",
      value: (row) =>
        row.dropoffAddress ?? (row.hours ? `Hourly hire, ${row.hours} hours` : ""),
    },
    { header: "Passengers", value: (row) => row.passengers },
    { header: "Large bags", value: (row) => row.largeBags },
    { header: "Small bags", value: (row) => row.smallBags },
    { header: "Car", value: (row) => vehicleClassName(row.vehicleClassSlug) },
    {
      header: "Extras",
      value: (row) =>
        row.extras.map((extra) => `${extra.quantity} × ${extra.name}`).join(", "),
    },
    { header: "Meet and greet", value: (row) => (row.meetAndGreet ? "Yes" : "No") },
    { header: "Driver notes", value: (row) => row.driverNotes },
    { header: "Driver", value: (row) => (row.driverId ? driverName(row.driverId) : "") },
    { header: "Vehicle", value: (row) => row.vehicleReg },
    { header: "Stage", value: (row) => stageName(row.status) },
    { header: "Problems", value: (row) => row.problems.join("; ") },
  ];
}
