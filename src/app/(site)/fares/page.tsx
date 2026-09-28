import { AlertTriangle, Check, Clock, PoundSterling, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FaqList } from "@/components/site/faq-list";
import { QuoteWidget } from "@/components/site/quote-widget";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { earliestBookableDate } from "@/domain/booking/journey";
import { formatPence } from "@/domain/money";
import { AIRPORTS } from "@/domain/places/airports";
import { EXTRAS } from "@/domain/pricing/extras";
import { TABLE_CLASSES, indicativeFarePence } from "@/domain/pricing/indicative";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { policies } from "@/lib/policies";

/**
 * The fares page (§5, CMP-02: "A public Fares page is generated from the
 * pricing tables").
 *
 * The point of this page is not to list every price — the booking form does
 * that in seconds for the journey you actually want. It is to explain how the
 * price is arrived at, so nobody has to wonder what will be added later. Every
 * figure comes from the same modules the funnel uses, so this page cannot
 * quote one number while checkout charges another.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export const metadata: Metadata = {
  title: "Fares and how our pricing works",
  description:
    "How Cityline prices a transfer: a fixed fare agreed before you travel, with airport charges, tolls, the Congestion Charge and waiting time included. No card fees and no surge pricing.",
  alternates: { canonical: "/fares" },
};

const INCLUDED = [
  "The driver, the vehicle and the fuel",
  "Airport and port drop-off and pickup charges",
  "Congestion Charge and ULEZ where your route passes through them",
  "Tolls on your route, including the Dartford Crossing",
  "Meet and greet inside arrivals on airport pickups",
  "Help with your luggage at both ends",
  `${policies.airportFreeWaitingMinutes} minutes of free waiting at the airport, from the time you land`,
  "Card payment — there is no card fee",
];

const NOT_INCLUDED = [
  "Waiting beyond the free period, charged at the rate shown when you book",
  "Child seats and other extras you choose, priced separately and shown before you pay",
  "Anything you ask for on the day that was not in the booking",
  "Gratuities, which are never expected",
];

export default function FaresPage() {
  const heathrow = AIRPORTS.find((airport) => airport.slug === "heathrow");
  const examples = (heathrow?.destinations ?? []).slice(0, 4);

  const faqs = [
    {
      question: "Is the price I see the price I pay?",
      answer:
        "Yes. The fare is fixed when you book and does not change afterwards — not for traffic, not for a longer route, and not because it turned out to be a busy evening. The only things that can change the total are extras you choose, or a change you ask us to make to the booking, and both are priced and shown before they take effect.",
    },
    {
      question: "Why is there no surge pricing?",
      answer:
        "Because you are booking in advance with an operator, not hailing a car. We commit a driver and a vehicle to your journey at the time you book, so the price reflects that job rather than how many other people happen to want a car at that moment. A 5am Monday airport run costs the same as a Tuesday lunchtime.",
    },
    {
      question: "Do you charge extra for paying by card?",
      answer:
        "No. Card payment costs the same as any other method. Consumer law prohibits surcharging consumer cards in the UK, and we would not want to anyway — a fee added at the last step is exactly the sort of thing this pricing is meant to avoid.",
    },
    {
      question: "How is a fare worked out?",
      answer:
        "Where we have a fixed fare for a route, that is what you pay. Otherwise the fare is based on the distance and the vehicle class, with any airport or port charges, time-of-day factors and extras applied on top, and the total rounded to the nearest pound. Whichever way it is calculated, you see the final figure before you give us any personal details.",
    },
    {
      question: "What if I need to cancel?",
      answer: `Cancel up to ${policies.freeCancellationHours} hours before your pickup and you get a ${policies.freeCancellationRefundPercent}% refund to the card you paid with. Inside that window the vehicle and driver are already committed, so a refund may not be possible — but if your flight is cancelled by the airline, contact us and we will move or refund the booking.`,
    },
  ];

  return (
    <>
      <section className="bg-surface-container-lowest pt-8 pb-12">
        <Container>
          <Breadcrumbs crumbs={[{ label: "Fares" }]} siteUrl={siteUrl} />

          <div className="gap-gutter mt-space-lg grid items-start lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h1 className="text-on-surface mb-4 text-[30px] leading-[1.14] font-semibold tracking-tight text-balance sm:text-[40px]">
                Fares, and how they are worked out
              </h1>
              <div className="gap-space-md text-body-lg text-on-surface-variant flex max-w-145 flex-col">
                <p>
                  One price, agreed before you travel, with everything in it. No card
                  fees, no surge pricing, and nothing added at the end.
                </p>
                <p>
                  This page explains how the number is arrived at. For the price of your
                  actual journey, the form does it in a few seconds — and shows it before
                  asking for a name.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5">
              <h2 className="sr-only">Get a price</h2>
              <QuoteWidget minDate={earliestBookableDate()} />
            </div>
          </div>
        </Container>
      </section>

      <Container className="gap-space-xl flex flex-col py-12">
        {/* --- Placeholder notice ------------------------------------------ */}
        <p className="border-outline-variant bg-surface-container-low rounded-card p-space-md text-body-sm flex max-w-3xl gap-2.5 border">
          <AlertTriangle aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong className="text-on-surface">Indicative prices.</strong> The figures on
            this page are estimates while Cityline&rsquo;s launch price tables are
            finalised. The price quoted in the booking form is the one that applies to
            your journey.
          </span>
        </p>

        {/* --- Included / not included -------------------------------------- */}
        <section aria-labelledby="whats-included">
          <h2 id="whats-included" className="text-headline-md mb-space-lg">
            What the fare includes
          </h2>

          <div className="gap-gutter grid lg:grid-cols-2">
            <div className="border-outline-variant rounded-card p-space-lg border">
              <h3 className="text-title-md mb-space-md">Included in every fare</h3>
              <ul className="gap-space-sm text-body-md text-on-surface-variant flex flex-col">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-outline-variant rounded-card p-space-lg border">
              <h3 className="text-title-md mb-space-md">Charged separately</h3>
              <ul className="gap-space-sm text-body-md text-on-surface-variant flex flex-col">
                {NOT_INCLUDED.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <X
                      aria-hidden
                      className="text-on-surface-variant mt-0.5 h-5 w-5 shrink-0"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-body-sm text-on-surface-variant mt-space-md">
                Anything in this column is shown to you and added to the total before you
                pay. Nothing is charged after the journey.
              </p>
            </div>
          </div>
        </section>

        {/* --- Vehicle starting fares --------------------------------------- */}
        <section aria-labelledby="by-vehicle">
          <h2 id="by-vehicle" className="text-headline-md mb-2">
            Starting fares by vehicle
          </h2>
          <p className="text-body-md text-on-surface-variant mb-space-lg max-w-3xl">
            The class you need depends on passengers <em>and</em> luggage — a full car of
            people with a full set of cases needs the next size up. See the{" "}
            <Link href="/fleet" className="text-primary hover:underline">
              fleet page
            </Link>{" "}
            for capacities.
          </p>

          <div
            role="region"
            aria-labelledby="by-vehicle"
            tabIndex={0}
            className="border-outline-variant rounded-card min-w-0 overflow-x-auto border"
          >
            <table className="text-body-sm w-full border-collapse text-left">
              <caption className="sr-only">
                Starting fares and hourly rates by vehicle class.
              </caption>
              <thead className="bg-surface-container-low">
                <tr>
                  <th scope="col" className="p-space-md text-label-md font-semibold">
                    Vehicle
                  </th>
                  <th scope="col" className="p-space-md text-label-md font-semibold">
                    Carries
                  </th>
                  <th
                    scope="col"
                    className="p-space-md text-label-md text-right font-semibold"
                  >
                    Transfers from
                  </th>
                  <th
                    scope="col"
                    className="p-space-md text-label-md text-right font-semibold whitespace-nowrap"
                  >
                    Per hour
                  </th>
                </tr>
              </thead>
              <tbody>
                {VEHICLE_CLASSES.map((vehicle) => (
                  <tr key={vehicle.slug} className="border-outline-variant border-t">
                    <th scope="row" className="p-space-md font-normal">
                      <span className="text-body-md text-on-surface block">
                        {vehicle.name}
                      </span>
                      <span className="text-body-sm text-on-surface-variant">
                        {vehicle.tier}
                      </span>
                    </th>
                    <td className="p-space-md text-on-surface-variant whitespace-nowrap">
                      {vehicle.maxPassengers} passengers
                      <span className="block">{vehicle.maxLargeBags} large cases</span>
                    </td>
                    <td className="p-space-md text-right whitespace-nowrap tabular-nums">
                      {formatPence(vehicle.fromPence)}
                    </td>
                    <td className="p-space-md text-right whitespace-nowrap tabular-nums">
                      {formatPence(vehicle.hourlyRatePence)}
                      <span className="text-on-surface-variant block text-xs">
                        min {vehicle.minHours} hrs
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* --- Worked examples ---------------------------------------------- */}
        {examples.length > 0 ? (
          <section aria-labelledby="examples">
            <h2 id="examples" className="text-headline-md mb-2">
              Some worked examples
            </h2>
            <p className="text-body-md text-on-surface-variant mb-space-lg max-w-3xl">
              Heathrow to four common destinations, to show how distance and vehicle class
              combine. Every{" "}
              <Link href="/airports" className="text-primary hover:underline">
                airport page
              </Link>{" "}
              carries a full table.
            </p>

            <div
              role="region"
              aria-labelledby="examples"
              tabIndex={0}
              className="border-outline-variant rounded-card min-w-0 overflow-x-auto border"
            >
              <table className="text-body-sm w-full border-collapse text-left">
                <caption className="sr-only">
                  Example fares from Heathrow by destination and vehicle class.
                </caption>
                <thead className="bg-surface-container-low">
                  <tr>
                    <th scope="col" className="p-space-md text-label-md font-semibold">
                      Heathrow to
                    </th>
                    <th scope="col" className="p-space-md text-label-md font-semibold">
                      Distance
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
                  </tr>
                </thead>
                <tbody>
                  {examples.map((destination) => (
                    <tr
                      key={destination.label}
                      className="border-outline-variant border-t"
                    >
                      <th scope="row" className="p-space-md font-normal">
                        {destination.label}
                      </th>
                      <td className="p-space-md text-on-surface-variant whitespace-nowrap tabular-nums">
                        {destination.miles} mi
                      </td>
                      {TABLE_CLASSES.map((vehicle) => (
                        <td
                          key={vehicle.slug}
                          className="p-space-md text-right whitespace-nowrap tabular-nums"
                        >
                          {formatPence(indicativeFarePence(destination.miles, vehicle))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* --- Extras -------------------------------------------------------- */}
        <section aria-labelledby="extras">
          <h2 id="extras" className="text-headline-md mb-2">
            Extras
          </h2>
          <p className="text-body-md text-on-surface-variant mb-space-lg max-w-3xl">
            Chosen during booking and added to the total before you pay. Meet and greet
            and {policies.airportFreeWaitingMinutes} minutes of airport waiting are
            already included and are never charged as extras.
          </p>

          <ul className="gap-space-md grid sm:grid-cols-2 lg:grid-cols-4">
            {EXTRAS.map((extra) => (
              <li
                key={extra.slug}
                className="border-outline-variant rounded-card p-space-lg border"
              >
                <h3 className="text-title-md">{extra.name}</h3>
                <p className="text-body-sm text-on-surface-variant mt-1">
                  {extra.description}
                </p>
                <p className="text-label-md text-primary mt-space-sm tabular-nums">
                  {formatPence(extra.pricePence)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* --- Policies ------------------------------------------------------ */}
        <section aria-labelledby="policies">
          <h2 id="policies" className="text-headline-md mb-space-lg">
            Waiting, cancellations and changes
          </h2>
          <ul className="gap-space-md grid sm:grid-cols-3">
            <li className="border-outline-variant rounded-card p-space-lg border">
              <Clock aria-hidden className="text-primary mb-space-sm h-6 w-6" />
              <h3 className="text-title-md mb-1">
                {policies.airportFreeWaitingMinutes} minutes at the airport
              </h3>
              <p className="text-body-sm text-on-surface-variant">
                From the time you land. Elsewhere it is{" "}
                {policies.standardFreeWaitingMinutes} minutes from the booked time.
              </p>
            </li>
            <li className="border-outline-variant rounded-card p-space-lg border">
              <PoundSterling aria-hidden className="text-primary mb-space-sm h-6 w-6" />
              <h3 className="text-title-md mb-1">
                {policies.freeCancellationRefundPercent}% refund
              </h3>
              <p className="text-body-sm text-on-surface-variant">
                Cancel more than {policies.freeCancellationHours} hours before pickup and
                you are refunded in full, to the card you paid with.
              </p>
            </li>
            <li className="border-outline-variant rounded-card p-space-lg border">
              <Check aria-hidden className="text-primary mb-space-sm h-6 w-6" />
              <h3 className="text-title-md mb-1">Changes repriced openly</h3>
              <p className="text-body-sm text-on-surface-variant">
                A change that costs more is shown to you first. A change that costs less
                is refunded.
              </p>
            </li>
          </ul>
          <p className="text-body-sm text-on-surface-variant mt-space-md">
            The full detail is in our{" "}
            <Link href="/terms" className="text-primary hover:underline">
              terms and conditions
            </Link>
            .
          </p>
        </section>

        <FaqList faqs={faqs} heading="Questions about pricing" headingId="faqs" />
      </Container>
    </>
  );
}
