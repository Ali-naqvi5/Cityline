import { Anchor, Clock, PoundSterling } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { QuoteWidget } from "@/components/site/quote-widget";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { earliestBookableDate } from "@/domain/booking/journey";
import { formatPence } from "@/domain/money";
import { SEAPORTS } from "@/domain/places/seaports";
import { cheapestIndicativePence } from "@/domain/pricing/indicative";
import { policies } from "@/lib/policies";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export const metadata: Metadata = {
  title: "Cruise and ferry port transfers",
  description:
    "Fixed-price transfers between London and Tilbury, Dover, Southampton, Portsmouth and Harwich. Timed to your check-in, with help for cruise luggage.",
  alternates: { canonical: "/seaports" },
};

export default function SeaportsHubPage() {
  return (
    <>
      <section className="bg-surface-container-lowest pt-8 pb-12">
        <Container>
          <Breadcrumbs crumbs={[{ label: "Seaports" }]} siteUrl={siteUrl} />

          <div className="gap-gutter mt-space-lg grid items-start lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h1 className="text-on-surface mb-4 text-[30px] leading-[1.14] font-semibold tracking-tight text-balance sm:text-[40px]">
                Cruise and ferry port transfers
              </h1>
              <div className="gap-space-md text-body-lg text-on-surface-variant flex max-w-145 flex-col">
                <p>
                  We cover the ports London sails from — Tilbury on the Thames, and the
                  coastal ports at Dover, Southampton, Portsmouth and Harwich.
                </p>
                <p>
                  A cruise transfer is not an airport run. Check-in windows close hours
                  before the ship leaves, terminals sit well outside town, and the luggage
                  is bigger. We plan the pickup back from your check-in rather than from
                  the sailing time.
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

      <Container className="py-12">
        <h2 className="text-headline-md mb-space-lg">Choose your port</h2>

        <ul className="gap-gutter grid sm:grid-cols-2 lg:grid-cols-3">
          {SEAPORTS.map((port) => {
            const from = cheapestIndicativePence(
              Math.min(...port.destinations.map((d) => d.miles)),
            );

            return (
              <li key={port.slug}>
                <Link
                  href={`/seaports/${port.slug}`}
                  className="border-outline-variant hover:border-primary-container rounded-card p-space-lg group block h-full border transition-colors"
                >
                  <Anchor aria-hidden className="text-primary mb-space-sm h-6 w-6" />
                  <h3 className="text-title-md group-hover:text-primary transition-colors">
                    {port.name}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    {port.terminals.length > 1
                      ? `${port.terminals.length} terminals`
                      : "Single terminal"}{" "}
                    · {port.milesFromCentralLondon} miles {port.direction}
                  </p>
                  <p className="text-body-sm text-on-surface-variant mt-space-sm">
                    {port.summary}
                  </p>
                  <p className="text-label-md text-primary mt-space-md tabular-nums">
                    Transfers from {formatPence(from)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>

        <section className="bg-surface-container-low rounded-card p-space-xl mt-space-xl gap-gutter grid lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h2 className="text-headline-sm mb-space-md">
              What a cruise transfer includes
            </h2>
            <ul className="gap-space-lg text-body-md text-on-surface-variant grid sm:grid-cols-3">
              <li className="flex gap-2.5">
                <Clock aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                Timed to your check-in window, not the sailing time — the two are hours
                apart.
              </li>
              <li className="flex gap-2.5">
                <Anchor aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />A
                driver at the terminal entrance with a name board, and help with the
                cases.
              </li>
              <li className="flex gap-2.5">
                <PoundSterling
                  aria-hidden
                  className="text-primary mt-0.5 h-5 w-5 shrink-0"
                />
                Tolls, the Dartford Crossing and the Congestion Charge included. No surge.
              </li>
            </ul>
            <p className="text-body-sm text-on-surface-variant mt-space-lg">
              Also see our{" "}
              <Link href="/airports" className="text-primary hover:underline">
                London airports
              </Link>
              ,{" "}
              <Link href="/fleet" className="text-primary hover:underline">
                fleet and luggage capacities
              </Link>{" "}
              and{" "}
              <Link href="/fares" className="text-primary hover:underline">
                how fares work
              </Link>
              . Free waiting is {policies.airportFreeWaitingMinutes} minutes.
            </p>
          </div>

          <div className="lg:col-span-4">
            <Image
              src="/images/seaports/cruise.webp"
              alt=""
              width={512}
              height={608}
              sizes="(max-width: 1024px) 100vw, 300px"
              className="rounded-card h-full w-full object-cover"
            />
          </div>
        </section>
      </Container>
    </>
  );
}
