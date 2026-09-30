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
  type JobSource,
  type JobStatus,
} from "@/domain/jobs/labels";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

/**
 * The jobs screen's filters, read from the URL and turned into a Payload
 * query. Filtering happens in the database, never in the browser: the
 * register will hold years of jobs.
 *
 * Pure functions, so the rules — what "upcoming" means, what search matches,
 * that test bookings stay out unless asked for — are tested directly.
 */

export type JobsView = "list" | "day" | "week";
export type JobsWhen =
  "upcoming" | "today" | "tomorrow" | "week" | "past" | "all" | "date";

export interface JobFilters {
  view: JobsView;
  when: JobsWhen;
  /** YYYY-MM-DD, London. The day shown in day view, the week in week view. */
  date: string;
  q: string;
  status: JobStatus | "";
  source: JobSource | "";
  vehicle: string;
  unassigned: boolean;
  includeTest: boolean;
  page: number;
}

type Params = Record<string, string | string[] | undefined> | undefined;

function read(params: Params, key: string): string {
  const value = params?.[key];
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return typeof value === "string" ? value.trim() : "";
}

const WHENS: JobsWhen[] = [
  "upcoming",
  "today",
  "tomorrow",
  "week",
  "past",
  "all",
  "date",
];

export function parseJobFilters(params: Params, now: Date = new Date()): JobFilters {
  const viewParam = read(params, "view");
  const view: JobsView = viewParam === "day" || viewParam === "week" ? viewParam : "list";

  const dateParam = read(params, "date");
  const date = isValidDay(dateParam) ? dateParam : londonDay(now);

  const whenParam = read(params, "when") as JobsWhen;
  const when: JobsWhen = WHENS.includes(whenParam)
    ? whenParam
    : isValidDay(dateParam)
      ? "date"
      : "upcoming";

  const status = read(params, "status");
  const source = read(params, "source");
  const vehicle = read(params, "vehicle");
  const page = Number.parseInt(read(params, "page"), 10);

  return {
    view,
    when,
    date,
    q: read(params, "q").slice(0, 80),
    status: isJobStatus(status) ? status : "",
    source: isJobSource(source) ? source : "",
    vehicle: VEHICLE_CLASSES.some((item) => item.slug === vehicle) ? vehicle : "",
    unassigned: read(params, "unassigned") === "1",
    includeTest: read(params, "test") === "1",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** The pickup window a set of filters covers, or null for no limit. */
export function pickupRange(
  filters: Pick<JobFilters, "view" | "when" | "date">,
  now: Date = new Date(),
): { from: Date | null; to: Date | null } {
  if (filters.view === "day") {
    const { start, end } = londonDayBounds(filters.date);
    return { from: start, to: end };
  }
  if (filters.view === "week") {
    const monday = mondayOf(filters.date);
    return {
      from: londonDayBounds(monday).start,
      to: londonDayBounds(addDays(monday, 6)).end,
    };
  }

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
    case "date": {
      const { start, end } = londonDayBounds(filters.date);
      return { from: start, to: end };
    }
    case "upcoming":
    default:
      // From the start of today, so this morning's jobs stay in view.
      return { from: londonDayBounds(today).start, to: null };
  }
}

/**
 * What a search box entry matches: job or booking reference, passenger name,
 * phone number (typed any common way) or flight number.
 */
export function searchConditions(q: string): Where[] {
  const term = q.trim();
  if (!term) return [];

  const conditions: Where[] = [
    { reference: { like: term } },
    { "booking.reference": { like: term } },
    { leadName: { like: term } },
    { nameBoardText: { like: term } },
    { flightNumber: { like: term.replace(/\s+/g, "").toUpperCase() } },
  ];

  // Phones are stored as +447700900123. "07700 900123", "+44 7700 900123" and
  // "7700900123" should all find it, so match on the national digits.
  if (/^[\d\s+()-]+$/.test(term)) {
    const national = term.replace(/\D/g, "").replace(/^44/, "").replace(/^0+/, "");
    if (national.length >= 7) conditions.push({ leadPhone: { like: national } });
  }

  return conditions;
}

export function buildJobsWhere(filters: JobFilters, now: Date = new Date()): Where {
  const and: Where[] = [];

  // Test bookings are for checking the site works; they are not operations.
  if (!filters.includeTest) and.push({ isTest: { not_equals: true } });

  const { from, to } = pickupRange(filters, now);
  if (from) and.push({ pickupAt: { greater_than_equal: from.toISOString() } });
  if (to) and.push({ pickupAt: { less_than: to.toISOString() } });

  if (filters.unassigned) and.push({ status: { equals: "unassigned" } });
  else if (filters.status) and.push({ status: { equals: filters.status } });

  if (filters.source) and.push({ source: { equals: filters.source } });
  if (filters.vehicle) and.push({ vehicleClassSlug: { equals: filters.vehicle } });

  const search = searchConditions(filters.q);
  if (search.length) and.push({ or: search });

  return { and };
}

/** Newest first for the past; soonest first for everything else. */
export function jobsSort(filters: Pick<JobFilters, "view" | "when">): string {
  if (filters.view !== "list") return "pickupAt";
  return filters.when === "past" || filters.when === "all" ? "-pickupAt" : "pickupAt";
}

/** The URL for the jobs screen with some filters changed. */
export function jobsHref(filters: JobFilters, change: Partial<JobFilters> = {}): string {
  const next = { ...filters, ...change };
  const query = new URLSearchParams();
  if (next.view !== "list") query.set("view", next.view);
  if (next.view === "list" && next.when !== "upcoming") query.set("when", next.when);
  if (next.view !== "list" || next.when === "date") query.set("date", next.date);
  if (next.q) query.set("q", next.q);
  if (next.status) query.set("status", next.status);
  if (next.source) query.set("source", next.source);
  if (next.vehicle) query.set("vehicle", next.vehicle);
  if (next.unassigned) query.set("unassigned", "1");
  if (next.includeTest) query.set("test", "1");
  if (next.page > 1) query.set("page", String(next.page));
  const search = query.toString();
  return `/admin/jobs${search ? `?${search}` : ""}`;
}
