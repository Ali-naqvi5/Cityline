/**
 * The journey as it travels through the funnel's query string.
 *
 * Until the quote is persisted server-side in S3 (`quotes` table, BK-08), the
 * four steps carry their state in the URL. That keeps the funnel working
 * without a session, makes a half-finished booking shareable and resumable,
 * and means the back button behaves the way people expect.
 *
 * Nothing here is trusted: the price is always recalculated on the server, and
 * these values are revalidated with `journeySchema` before a booking is made.
 */

/** §7 service types. The funnel handles two; the rest are staff-entered jobs. */
export const SERVICE_MODES = ["route", "hourly"] as const;
export type ServiceMode = (typeof SERVICE_MODES)[number];

export interface FunnelParams {
  /** "route" is A to B; "hourly" is a car and driver by the hour (§7). */
  service: ServiceMode;
  pickup: string;
  /** Empty on an hourly hire — there is no fixed destination. */
  dropoff: string;
  via: string[];
  date: string;
  time: string;
  /** Hourly hire only: how long the car is booked for. */
  hours: number;

  /** Return journey (BK-04). Its legs are the outbound reversed by default. */
  returnJourney: boolean;
  returnPickup: string;
  returnDropoff: string;
  returnVia: string[];
  returnDate: string;
  returnTime: string;
  returnPassengers: number;
  returnBags: number;

  flightNumber: string;
  airline: string;
  passengers: number;
  bags: number;
  notes: string;
  /** Vehicle class slug, set at step 2. */
  vehicle: string;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function one(params: RawSearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function many(params: RawSearchParams, key: string): string[] {
  const value = params[key];
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value])
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function positiveInt(raw: string, fallback: number): number {
  // An empty string must fall back, not become zero: `Number("")` is 0, which
  // would silently turn a missing passenger count into a party of nobody —
  // and then every vehicle looks big enough.
  if (raw === "") return fallback;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function serviceMode(raw: string): ServiceMode {
  return (SERVICE_MODES as readonly string[]).includes(raw)
    ? (raw as ServiceMode)
    : "route";
}

export function parseFunnelParams(params: RawSearchParams): FunnelParams {
  const passengers = positiveInt(one(params, "passengers"), 1);
  const bags = positiveInt(one(params, "bags"), 0);

  return {
    service: serviceMode(one(params, "service")),
    pickup: one(params, "pickup"),
    dropoff: one(params, "dropoff"),
    via: many(params, "via"),
    date: one(params, "date"),
    time: one(params, "time"),
    hours: positiveInt(one(params, "hours"), 0),

    returnJourney: one(params, "return") === "yes",
    returnPickup: one(params, "returnPickup"),
    returnDropoff: one(params, "returnDropoff"),
    returnVia: many(params, "returnVia"),
    returnDate: one(params, "returnDate"),
    returnTime: one(params, "returnTime"),
    // A return leg carries the same party unless it says otherwise.
    returnPassengers: positiveInt(one(params, "returnPassengers"), passengers),
    returnBags: positiveInt(one(params, "returnBags"), bags),

    flightNumber: one(params, "flightNumber").toUpperCase().replace(/\s+/g, ""),
    airline: one(params, "airline"),
    passengers,
    bags,
    notes: one(params, "notes"),
    vehicle: one(params, "vehicle"),
  };
}

/**
 * Rebuilds the query string for the next step. Empty values are dropped, so
 * the URL stays readable rather than trailing a dozen empty parameters.
 */
export function funnelQuery(params: Partial<FunnelParams>): string {
  const search = new URLSearchParams();

  const set = (key: string, value: string | undefined) => {
    if (value) search.set(key, value);
  };
  const setInt = (key: string, value: number | undefined) => {
    if (value !== undefined && value > 0) search.set(key, String(value));
  };

  if (params.service && params.service !== "route") set("service", params.service);
  set("pickup", params.pickup);
  for (const stop of params.via ?? []) search.append("via", stop);
  set("dropoff", params.dropoff);
  set("date", params.date);
  set("time", params.time);
  if (params.service === "hourly") setInt("hours", params.hours);

  if (params.returnJourney) {
    search.set("return", "yes");
    set("returnPickup", params.returnPickup);
    for (const stop of params.returnVia ?? []) search.append("returnVia", stop);
    set("returnDropoff", params.returnDropoff);
    set("returnDate", params.returnDate);
    set("returnTime", params.returnTime);
    setInt("returnPassengers", params.returnPassengers);
    setInt("returnBags", params.returnBags);
  }

  set("flightNumber", params.flightNumber);
  set("airline", params.airline);
  if (params.passengers !== undefined)
    search.set("passengers", String(params.passengers));
  if (params.bags !== undefined) search.set("bags", String(params.bags));
  set("notes", params.notes);
  set("vehicle", params.vehicle);

  return search.toString();
}

/** True when step 1 has enough to price a journey. */
export function hasJourney(params: FunnelParams): boolean {
  if (!params.pickup || !params.date || !params.time) return false;

  // An hourly hire has no destination; what it needs instead is a duration.
  return params.service === "hourly" ? params.hours > 0 : Boolean(params.dropoff);
}

export interface ResolvedLeg {
  pickup: string;
  dropoff: string;
  via: string[];
  date: string;
  time: string;
  passengers: number;
  bags: number;
}

/**
 * The return leg with its blanks filled in.
 *
 * A return journey is the outbound reversed unless the customer says
 * otherwise, so an unanswered return pickup means "wherever the outbound
 * dropped me". Resolving it here rather than in `parseFunnelParams` keeps
 * parsing faithful to the URL — what was typed stays distinguishable from what
 * was inferred, which matters when the booking is later rebuilt from its
 * stored query.
 */
export function returnLegOf(params: FunnelParams): ResolvedLeg | null {
  if (!params.returnJourney || params.service !== "route") return null;

  return {
    pickup: params.returnPickup || params.dropoff,
    dropoff: params.returnDropoff || params.pickup,
    via: params.returnVia,
    date: params.returnDate,
    time: params.returnTime,
    passengers: params.returnPassengers,
    bags: params.returnBags,
  };
}

/**
 * The largest party across every leg.
 *
 * One vehicle carries the whole booking, so it has to fit the busiest leg —
 * four people out and five back still needs a car that seats five.
 */
export function largestParty(params: FunnelParams): {
  passengers: number;
  largeBags: number;
} {
  const back = returnLegOf(params);

  return {
    passengers: Math.max(params.passengers, back?.passengers ?? 0),
    largeBags: Math.max(params.bags, back?.bags ?? 0),
  };
}
