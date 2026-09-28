import { VEHICLE_CLASSES, type VehicleClass } from "./vehicle-classes";

/**
 * Which vehicle classes can actually take this party (BK-01: "unsuitable
 * classes disabled").
 *
 * A class is offered only if it seats everyone AND holds the luggage. This is
 * not a nicety — a driver who arrives at Heathrow in a saloon for four people
 * with four suitcases either refuses the job or makes two trips, and either way
 * Cityline has a complaint and a refund.
 *
 * Hand luggage is not counted here: step 1 collects large cases only, and cabin
 * bags ride with the passengers.
 */
export interface Party {
  passengers: number;
  largeBags: number;
}

export interface VehicleOption {
  vehicle: VehicleClass;
  suitable: boolean;
  /** Shown on a disabled card, so the reason is never a mystery. */
  reason?: string;
}

export function vehicleOptionsFor(party: Party): VehicleOption[] {
  return VEHICLE_CLASSES.map((vehicle) => {
    const seatsShort = party.passengers > vehicle.maxPassengers;
    const bootShort = party.largeBags > vehicle.maxLargeBags;

    if (!seatsShort && !bootShort) return { vehicle, suitable: true };

    const reasons: string[] = [];
    if (seatsShort) {
      reasons.push(
        `seats ${vehicle.maxPassengers} ${vehicle.maxPassengers === 1 ? "passenger" : "passengers"}`,
      );
    }
    if (bootShort) {
      reasons.push(
        `holds ${vehicle.maxLargeBags} large ${vehicle.maxLargeBags === 1 ? "case" : "cases"}`,
      );
    }

    return {
      vehicle,
      suitable: false,
      reason: `Too small for your party — ${reasons.join(" and ")}.`,
    };
  });
}

/** The cheapest class that fits, which is what we preselect. */
export function recommendedVehicle(party: Party): VehicleClass | null {
  const suitable = vehicleOptionsFor(party)
    .filter((option) => option.suitable)
    .map((option) => option.vehicle);

  if (suitable.length === 0) return null;

  return suitable.reduce((cheapest, vehicle) =>
    vehicle.fromPence < cheapest.fromPence ? vehicle : cheapest,
  );
}

export function hasAnySuitableVehicle(party: Party): boolean {
  return recommendedVehicle(party) !== null;
}
