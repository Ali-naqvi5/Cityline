import type { Where } from "payload";

import {
  addDays,
  isValidDay,
  londonDay,
  londonDayBounds,
  mondayOf,
} from "@/admin/format";
import {
  isJobSource,
  isJobStatus,
  OPEN_STATUSES,
  PAYMENT_METHOD_LABELS,
  type JobSource,
  type JobStatus,
} from "@/domain/jobs/labels";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

/**
 * The bookings dashboard's filters, read from the URL and turned into a
 * Payload query. Filtering happens in the database, never in the browser:
 * the register will hold years of bookings.
 *
 * Pure functions, so the rules — what "upcoming" means, what search matches,
 * that test bookings stay out unless asked for — are tested directly.
 */

export type BookingsWhen =
  "upcoming" | "today" | "tomorrow" | "week" | "past" | "all" | "range";

export const WHEN_LABELS: Record<BookingsWhen, string> = {
  upcoming: "Upcoming",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This week",
  past: "Past",
  all: "All dates",
  range: "Pickup dates",
};

export const PAGE_SIZES = [30, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export interface BookingFilters {
  when: BookingsWhen;
  /** YYYY-MM-DD, London: the pickup range when `when` is "range". */
  from: string;
  to: string;
  /** YYYY-MM-DD, London: when the booking was taken. */
  createdFrom: string;
  createdTo: string;
  q: string;
  /** A status, "open" for any not yet finished, or "" for all. */
  status: JobStatus | "open" | "";
  source: JobSource | "";
  supplier: number | null;
  /** A driver's id, "none" for no driver, or null for anyone. */
  driver: number | "none" | null;
  vehicle: string;
  payment: string;
  takenBy: number | null;
  /** Assigned bookings with no driver price written yet. */
  noDriverPrice: boolean;
  includeTest: boolean;
  page: number;
  perPage: PageSize;
}

type Params = Record<string, string | string[] | undefined> | undefined;

function read(params: Params, key: string): string {
  const value = params?.[key];
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return typeof value === "string" ? value.trim() : "";
}

function id(value: string): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

const WHENS = Object.keys(WHEN_LABELS) as BookingsWhen[];

export function parseBookingFilters(params: Params): BookingFilters {
  const from = isValidDay(read(params, "from")) ? read(params, "from") : "";
  const to = isValidDay(read(params, "to")) ? read(params, "to") : "";
  const whenParam = read(params, "when") as BookingsWhen;
  const when: BookingsWhen = WHENS.includes(whenParam)
    ? whenParam
    : from || to
      ? "range"
      : "upcoming";

  const status = read(params, "status");
  const source = read(params, "source");
  const vehicle = read(params, "vehicle");
  const payment = read(params, "payment");
  const driver = read(params, "driver");
  const page = Number.parseInt(read(params, "page"), 10);
  const perPage = Number(read(params, "per")) as PageSize;

  return {
    when,
    from,
    to,
    createdFrom: isValidDay(read(params, "createdFrom"))
      ? read(params, "createdFrom")
      : "",
    createdTo: isValidDay(read(params, "createdTo")) ? read(params, "createdTo") : "",
    q: read(params, "q").slice(0, 80),
    status: status === "open" || isJobStatus(status) ? status : "",
    source: isJobSource(source) ? source : "",
    supplier: id(read(params, "supplier")),
    driver: driver === "none" ? "none" : id(driver),
    vehicle: VEHICLE_CLASSES.some((item) => item.slug === vehicle) ? vehicle : "",
    payment: payment in PAYMENT_METHOD_LABELS ? payment : "",
    takenBy: id(read(params, "takenBy")),
    noDriverPrice: read(params, "noDriverPrice") === "1",
    includeTest: read(params, "test") === "1",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    perPage: PAGE_SIZES.includes(perPage) ? perPage : 30,
  };
}

/** The pickup window a set of filters covers, or null for no limit. */
export function pickupRange(
  filters: Pick<BookingFilters, "when" | "from" | "to">,
  now: Date = new Date(),
): { from: Date | null; to: Date | null } {
  const today = londonDay(now);
  switch (filters.when) {
    case "today":
      return { from: londonDayBounds(today).start, to: londonDayBounds(today).end };
    case "tomorrow": {
      const tomorrow = addDays(today, 1);
      return { from: londonDayBounds(tomorrow).start, to: londonDayBounds(tomorrow).end };
    }
    case "week": {
      const monday = mondayOf(today);
      return {
        from: londonDayBounds(monday).start,
        to: londonDayBounds(addDays(monday, 6)).end,
      };
    }
    case "past":
      return { from: null, to: londonDayBounds(today).start };
    case "all":
      return { from: null, to: null };
    case "range":
      return {
        from: filters.from ? londonDayBounds(filters.from).start : null,
        to: filters.to ? londonDayBounds(filters.to).end : null,
      };
    case "upcoming":
    default:
      // From the start of today, so this morning's bookings stay in view.
      return { from: londonDayBounds(today).start, to: null };
  }
}

/**
 * What the search box matches: a job, booking or supplier reference, the
 * passenger's name, phone or email, a flight number or a registration.
 */
export function searchConditions(q: string): Where[] {
  const term = q.trim();
  if (!term) return [];
  const compact = term.replace(/\s+/g, "").toUpperCase();

  const conditions: Where[] = [
    { reference: { like: term } },
    { "booking.reference": { like: term } },
    { supplierReference: { like: compact } },
    { leadName: { like: term } },
    { nameBoardText: { like: term } },
    { leadEmail: { like: term } },
    { flightNumber: { like: compact } },
    { vehicleReg: { like: compact } },
  ];

  // Phones are stored as +447700900123. "07700 900123", "+44 7700 900123" and
  // "7700900123" should all find it, so match on the national digits.
  if (/^[\d\s+()-]+$/.test(term)) {
    const national = term.replace(/\D/g, "").replace(/^44/, "").replace(/^0+/, "");
    if (national.length >= 7) conditions.push({ leadPhone: { like: national } });
  }

  return conditions;
}

export function buildBookingsWhere(
  filters: BookingFilters,
  now: Date = new Date(),
): Where {
  const and: Where[] = [];

  // Test bookings are for checking the site works; they are not operations.
  if (!filters.includeTest) and.push({ isTest: { not_equals: true } });

  const { from, to } = pickupRange(filters, now);
  if (from) and.push({ pickupAt: { greater_than_equal: from.toISOString() } });
  if (to) and.push({ pickupAt: { less_than: to.toISOString() } });

  if (filters.createdFrom) {
    and.push({
      createdAt: {
        greater_than_equal: londonDayBounds(filters.createdFrom).start.toISOString(),
      },
    });
  }
  if (filters.createdTo) {
    and.push({
      createdAt: { less_than: londonDayBounds(filters.createdTo).end.toISOString() },
    });
  }

  if (filters.status === "open") and.push({ status: { in: [...OPEN_STATUSES] } });
  else if (filters.status) and.push({ status: { equals: filters.status } });

  if (filters.source) and.push({ source: { equals: filters.source } });
  if (filters.supplier) and.push({ supplier: { equals: filters.supplier } });
  if (filters.driver === "none") and.push({ driver: { exists: false } });
  else if (filters.driver) and.push({ driver: { equals: filters.driver } });
  if (filters.vehicle) and.push({ vehicleClassSlug: { equals: filters.vehicle } });
  if (filters.payment) and.push({ paymentMethod: { equals: filters.payment } });
  if (filters.takenBy) and.push({ takenByUser: { equals: filters.takenBy } });

  if (filters.noDriverPrice) {
    and.push({ driver: { exists: true } });
    and.push({ driverPricePence: { exists: false } });
  }

  const search = searchConditions(filters.q);
  if (search.length) and.push({ or: search });

  return { and };
}

/** Newest first for the past; soonest first for everything else. */
export function bookingsSort(filters: Pick<BookingFilters, "when">): string {
  return filters.when === "past" || filters.when === "all" ? "-pickupAt" : "pickupAt";
}

/** How many filters beyond the defaults are set — shown on the phone toggle. */
export function activeFilterCount(filters: BookingFilters): number {
  return [
    filters.when !== "upcoming",
    filters.createdFrom || filters.createdTo,
    filters.status,
    filters.source,
    filters.supplier,
    filters.driver,
    filters.vehicle,
    filters.payment,
    filters.takenBy,
    filters.noDriverPrice,
    filters.includeTest,
  ].filter(Boolean).length;
}

/** The dashboard's URL with some filters changed. */
export function bookingsHref(
  filters: BookingFilters,
  change: Partial<BookingFilters> = {},
): string {
  const next = { ...filters, ...change };
  const query = new URLSearchParams();
  if (next.when !== "upcoming") query.set("when", next.when);
  if (next.when === "range" && next.from) query.set("from", next.from);
  if (next.when === "range" && next.to) query.set("to", next.to);
  if (next.createdFrom) query.set("createdFrom", next.createdFrom);
  if (next.createdTo) query.set("createdTo", next.createdTo);
  if (next.q) query.set("q", next.q);
  if (next.status) query.set("status", next.status);
  if (next.source) query.set("source", next.source);
  if (next.supplier) query.set("supplier", String(next.supplier));
  if (next.driver) query.set("driver", String(next.driver));
  if (next.vehicle) query.set("vehicle", next.vehicle);
  if (next.payment) query.set("payment", next.payment);
  if (next.takenBy) query.set("takenBy", String(next.takenBy));
  if (next.noDriverPrice) query.set("noDriverPrice", "1");
  if (next.includeTest) query.set("test", "1");
  if (next.perPage !== 30) query.set("per", String(next.perPage));
  if (next.page > 1) query.set("page", String(next.page));
  const search = query.toString();
  return `/admin/bookings${search ? `?${search}` : ""}`;
}
