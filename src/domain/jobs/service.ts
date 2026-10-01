/**
 * What kind of trip a booking is — "From airport", "To airport" — as the
 * bookings dashboard shows it. Worked out from the addresses, which name the
 * airport or terminal for every airport pickup the website and staff enter,
 * rather than stored, so it can never disagree with the route.
 */

export type ServiceType =
  "from_airport" | "to_airport" | "airport_to_airport" | "transfer" | "hourly";

export const SERVICE_LABELS: Record<ServiceType, string> = {
  from_airport: "From airport",
  to_airport: "To airport",
  airport_to_airport: "Airport to airport",
  transfer: "Transfer",
  hourly: "Hourly hire",
};

const AIRPORT =
  /\b(airport|heathrow|gatwick|stansted|luton|terminal\s*\d|north terminal|south terminal|lhr|lgw|stn|ltn|lcy)\b/i;

export function isAirport(address: string | null | undefined): boolean {
  return Boolean(address && AIRPORT.test(address));
}

export function serviceType(job: {
  pickupAddress: string;
  dropoffAddress?: string | null;
  hours?: number | null;
}): ServiceType {
  if (!job.dropoffAddress && job.hours) return "hourly";
  const from = isAirport(job.pickupAddress);
  const to = isAirport(job.dropoffAddress);
  if (from && to) return "airport_to_airport";
  if (from) return "from_airport";
  if (to) return "to_airport";
  return "transfer";
}
