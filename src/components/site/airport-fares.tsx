import Link from "next/link";

import { formatPence } from "@/domain/money";
import { TABLE_CLASSES, indicativeFarePence } from "@/domain/pricing/indicative";
import type { PlaceGuide } from "@/domain/places/types";
import { policies } from "@/lib/policies";

/**
 * The fixed-fare matrix from the airport page design: destination down the
 * side, vehicle class across the top (SEO-01 wants a live fare for at least
 * three classes, plus distance and journey time).
 *
 * A real table, not a grid of divs. Screen readers announce "Saloon, £54" when
 * a cell is read because the row and column headers are wired up, and the
 * whole thing can be copied into a message or a spreadsheet — both of which a
 * visual-only layout loses.
 *
 * On a phone it scrolls horizontally inside its own region rather than
 * squashing six columns into 390px. The region is focusable and labelled so
 * keyboard users can actually reach the scroll (a WCAG 2.2 requirement that
 * scrollable regions are keyboard operable).
 *
 * **The fares are placeholders**, from one formula — see
 * `domain/pricing/indicative.ts`.
 */
export function AirportFares({ airport }: { airport: PlaceGuide }) {
  const captionId = `fares-${airport.slug}`;

  return (
    // `min-w-0` is load-bearing: as a flex item this section defaults to
    // `min-width: auto`, so it would stretch to the table's full intrinsic
    // width and the scroll container inside it would never need to scroll —
    // pushing the whole page sideways at 390px.
    <section aria-labelledby={`${captionId}-heading`} className="min-w-0">
      <h2 id={`${captionId}-heading`} className="text-headline-md mb-2">
        Fares from {airport.name}
      </h2>
      <p className="text-body-md text-on-surface-variant mb-space-lg max-w-3xl">
        Every fare includes the airport&rsquo;s own drop-off and parking charges, the
        Congestion Charge and ULEZ where your route passes through them, meet and greet
        inside arrivals, help with your luggage, and {policies.airportFreeWaitingMinutes}{" "}
        minutes of free waiting from the time you land. No card fees, and the price never
        rises with demand.
      </p>

      <div
        role="region"
        aria-labelledby={`${captionId}-heading`}
        tabIndex={0}
        className="border-outline-variant rounded-card overflow-x-auto border"
      >
        <table className="text-body-sm w-full border-collapse text-left">
          <caption className="sr-only">
            Fares from {airport.fullName} to London destinations, by vehicle class, with
            road distance and typical journey time.
          </caption>
          <thead className="bg-surface-container-low">
            <tr>
              <th scope="col" className="p-space-md text-label-md font-semibold">
                Destination
              </th>
              <th scope="col" className="p-space-md text-label-md font-semibold">
                Distance and time
              </th>
              {TABLE_CLASSES.map((vehicle) => (
                <th
                  key={vehicle.slug}
                  scope="col"
                  className="p-space-md text-label-md text-right font-semibold whitespace-nowrap"
                >
                  {vehicle.name}
                </th>
              ))}
              <th scope="col" className="p-space-md">
                <span className="sr-only">Book</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {airport.destinations.map((destination) => (
              <tr
                key={destination.label}
                className="border-outline-variant border-t align-top"
              >
                <th scope="row" className="p-space-md font-normal">
                  <span className="text-body-md text-on-surface block">
                    {destination.label}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    {destination.postcodes}
                  </span>
                </th>
                <td className="p-space-md text-on-surface-variant whitespace-nowrap">
                  <span className="tabular-nums">{destination.miles} mi</span>
                  <span className="block tabular-nums">{destination.offPeak}</span>
                </td>
                {TABLE_CLASSES.map((vehicle) => (
                  <td
                    key={vehicle.slug}
                    className="p-space-md text-right whitespace-nowrap tabular-nums"
                  >
                    {formatPence(indicativeFarePence(destination.miles, vehicle))}
                  </td>
                ))}
                <td className="p-space-md text-right">
                  <Link
                    href={`/book?pickup=${encodeURIComponent(
                      `${airport.fullName} (${airport.code})`,
                    )}&dropoff=${encodeURIComponent(destination.label)}`}
                    className="text-label-md text-primary whitespace-nowrap hover:underline"
                  >
                    Book
                    <span className="sr-only">
                      {" "}
                      a transfer from {airport.name} to {destination.label}
                    </span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-body-sm text-on-surface-variant mt-space-md">
        Distances are by road and journey times are typical, not guaranteed — traffic
        decides. Peak times run longer; see the journey times below.
      </p>
    </section>
  );
}
