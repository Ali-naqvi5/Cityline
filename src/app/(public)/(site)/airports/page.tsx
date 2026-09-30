import { Clock, MapPin, PoundSterling } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { QuoteWidget } from "@/components/site/quote-widget";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { formatPence } from "@/domain/money";
import { AIRPORTS } from "@/domain/places/airports";
import { cheapestIndicativePence } from "@/domain/pricing/indicative";
import { policies } from "@/lib/policies";

/**
 * The airports hub (§5). Built alongside the six airport pages because every
 * one of them breadcrumbs to it and the header links to it — six pages whose
 * parent 404s is not a finished job.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export const metadata: Metadata = {
  title: "London airport transfers",
  description:
    "Fixed-price private hire transfers to and from all six London airports — Heathrow, Gatwick, Stansted, Luton, London City and Southend. Meet and greet included.",
  alternates: { canonical: "/airports" },
};

export default function AirportsHubPage() {
  return (
    <>
      <section className="bg-surface-container-lowest pt-8 pb-12">
        <Container>
          <Breadcrumbs crumbs={[{ label: "Airports" }]} siteUrl={siteUrl} />

          <div className="gap-gutter mt-space-lg grid items-start lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h1 className="text-on-surface mb-4 text-[30px] leading-[1.14] font-semibold tracking-tight text-balance sm:text-[40px]">
                London airport transfers
              </h1>
              <p className="text-body-lg text-on-surface-variant max-w-145">
                We cover all six London airports. Every fare is agreed before you travel
                and includes meet and greet inside arrivals,{" "}
                {policies.airportFreeWaitingMinutes} minutes of free waiting from the time
                you land, and the airport&rsquo;s own charges.
              </p>
            </div>

            <div className="lg:col-span-5">
              <h2 className="sr-only">Get a price</h2>
              <QuoteWidget />
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-12">
        <h2 className="text-headline-md mb-space-lg">Choose your airport</h2>

        <ul className="gap-gutter grid sm:grid-cols-2 lg:grid-cols-3">
          {AIRPORTS.map((airport) => {
            const from = cheapestIndicativePence(
              Math.min(...airport.destinations.map((d) => d.miles)),
            );

            return (
              <li key={airport.slug}>
                <Link
                  href={`/airports/${airport.slug}`}
                  className="border-outline-variant hover:border-primary-container rounded-card group block h-full overflow-hidden border transition-colors"
                >
                  <Image
                    src={airport.image ?? ""}
                    alt=""
                    width={800}
                    height={450}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                    className="h-44 w-full object-cover"
                  />
                  <div className="p-space-lg">
                    <h3 className="text-title-md group-hover:text-primary transition-colors">
                      {airport.name} ({airport.code})
                    </h3>
                    <p className="text-body-sm text-on-surface-variant mt-1">
                      {airport.terminals.length > 1
                        ? `${airport.terminals.length} terminals`
                        : "Single terminal"}{" "}
                      · {airport.milesFromCentralLondon} miles {airport.direction}
                    </p>
                    <p className="text-body-sm text-on-surface-variant mt-space-sm">
                      {airport.summary}
                    </p>
                    <p className="text-label-md text-primary mt-space-md tabular-nums">
                      Transfers from {formatPence(from)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <section className="bg-surface-container-low rounded-card p-space-xl mt-space-xl">
          <h2 className="text-headline-sm mb-space-md">
            What every airport transfer includes
          </h2>
          <ul className="gap-space-lg text-body-md text-on-surface-variant grid sm:grid-cols-3">
            <li className="flex gap-2.5">
              <MapPin aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />
              Meet and greet inside the arrivals hall, with a name board and help with
              your luggage.
            </li>
            <li className="flex gap-2.5">
              <Clock aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />
              {policies.airportFreeWaitingMinutes} minutes of free waiting, counted from
              the time your flight lands.
            </li>
            <li className="flex gap-2.5">
              <PoundSterling
                aria-hidden
                className="text-primary mt-0.5 h-5 w-5 shrink-0"
              />
              Airport charges, Congestion Charge, ULEZ and tolls included. No card fees,
              no surge.
            </li>
          </ul>
        </section>
      </Container>
    </>
  );
}
