import { Briefcase, Luggage, ShieldCheck, Sparkles, Users, Wind } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { ScrollFadeIn } from "@/components/motion/scroll-fade-in";
import { ScrollStagger, StaggerItem } from "@/components/motion/scroll-stagger";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { formatPence } from "@/domain/money";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { company } from "@/lib/company";
import { policies } from "@/lib/policies";

/**
 * Fleet page (WEB-02), ported from the fleet design: header, six vehicle
 * cards, a luggage-fit helper and a standards banner.
 *
 * The design's luggage helper is a six-column SVG diagram. It is built here as
 * a real table instead: the same information, but it can be read by a screen
 * reader, searched, and copied — and it does not need redrawing when a vehicle
 * class changes (NFR-05).
 *
 * Fares are placeholders until S2 — see docs/design-deviations.md.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export const metadata: Metadata = {
  title: "Our London fleet",
  description:
    "Saloon, estate, executive, MPV and 16-seat minibus private hire vehicles for London airport transfers, with passenger and luggage capacities for each.",
  alternates: { canonical: "/fleet" },
};

export default function FleetPage() {
  return (
    <>
      <Header />
      <VehicleGrid />
      <LuggageHelper />
      <StandardsBanner />
    </>
  );
}

function Header() {
  return (
    <section className="bg-surface-container-lowest border-outline-variant border-b py-10">
      <Container>
        <Breadcrumbs crumbs={[{ label: "Fleet" }]} siteUrl={siteUrl} />

        <div className="gap-space-md mt-space-lg flex flex-col justify-between md:flex-row md:items-end">
          <div>
            <h1 className="text-display-lg-mobile sm:text-display-lg text-on-surface leading-tight tracking-tight">
              Our London fleet
            </h1>
            <p className="text-body-lg text-on-surface-variant mt-space-xs max-w-2xl">
              Every vehicle is licensed for private hire, regularly maintained and
              air-conditioned, and driven by a professional chauffeur.
            </p>
          </div>

          <p className="px-space-md bg-surface-container-high text-primary text-label-md inline-flex shrink-0 items-center gap-2 rounded-full py-2">
            <ShieldCheck aria-hidden className="h-4 w-4" />
            Fixed rates, no surge pricing
          </p>
        </div>
      </Container>
    </section>
  );
}

function VehicleGrid() {
  return (
    <ScrollFadeIn as="section" className="py-12">
      <Container>
        <h2 className="sr-only">Vehicle classes</h2>

        <ScrollStagger as="ul" className="gap-gutter grid sm:grid-cols-2 lg:grid-cols-3">
          {VEHICLE_CLASSES.map((vehicle) => (
            <StaggerItem as="li" key={vehicle.slug}>
              <article className="group bg-surface-container-lowest border-outline-variant shadow-card hover:shadow-card-hover rounded-card flex h-full flex-col overflow-hidden border transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02]">
                <div className="bg-surface-container-low p-space-lg relative flex min-h-50 items-center justify-center">
                  <Image
                    src={vehicle.image}
                    alt={`${vehicle.name} vehicle illustration`}
                    width={480}
                    height={308}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                    className="h-auto w-full max-w-90 object-contain transition-transform duration-500 motion-safe:group-hover:scale-105"
                  />
                  {vehicle.mostPopular ? (
                    <span className="bg-surface-container-lowest/80 text-label-sm text-on-surface-variant absolute top-4 right-4 rounded-full px-2.5 py-1 uppercase backdrop-blur-md">
                      Most booked
                    </span>
                  ) : null}
                </div>

                <div className="p-space-lg gap-space-md flex flex-grow flex-col justify-between">
                  <div>
                    <h3 className="text-headline-sm">{vehicle.name}</h3>
                    <p className="text-label-sm text-on-surface-variant mt-0.5">
                      {vehicle.tier}
                    </p>
                    <p className="text-body-sm text-on-surface-variant mt-space-sm">
                      {vehicle.exampleModels}
                    </p>
                    {vehicle.note ? (
                      <p className="text-body-sm text-primary mt-1">{vehicle.note}</p>
                    ) : null}

                    <ul className="mt-space-md text-body-sm space-y-1.5">
                      <li className="flex items-center gap-2">
                        <Users aria-hidden className="text-primary h-4 w-4 shrink-0" />
                        <span className="tabular-nums">
                          Up to {vehicle.maxPassengers} passengers
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Luggage aria-hidden className="text-primary h-4 w-4 shrink-0" />
                        <span className="tabular-nums">
                          {vehicle.maxLargeBags} large cases
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Briefcase
                          aria-hidden
                          className="text-primary h-4 w-4 shrink-0"
                        />
                        <span className="tabular-nums">
                          {vehicle.maxHandLuggage} items of hand luggage
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="border-outline-variant pt-space-md flex items-end justify-between border-t">
                    <p>
                      <span className="text-body-sm text-on-surface-variant block">
                        From
                      </span>
                      <span className="text-fare-tabular text-primary tabular-nums">
                        {formatPence(vehicle.fromPence)}
                      </span>
                    </p>
                    <ButtonLink
                      href={`/book?vehicle=${vehicle.slug}`}
                      variant="secondary"
                    >
                      Get a price
                    </ButtonLink>
                  </div>
                </div>
              </article>
            </StaggerItem>
          ))}
        </ScrollStagger>

        <p className="text-body-sm text-on-surface-variant mt-space-lg">
          Fares shown are indicative starting prices. Your exact fare is calculated from
          your route and confirmed before you book.
        </p>
      </Container>
    </ScrollFadeIn>
  );
}

function LuggageHelper() {
  return (
    <ScrollFadeIn as="section" className="bg-surface-container-low py-12">
      <Container>
        <h2 className="text-headline-lg-mobile sm:text-headline-lg mb-2">
          Which vehicle fits your luggage?
        </h2>
        <p className="text-body-lg text-on-surface-variant mb-space-lg max-w-2xl">
          A large case is roughly 75cm tall. Hand luggage is cabin-sized. If you are close
          to a limit, choose the next size up — a driver cannot take more than the vehicle
          safely holds.
        </p>

        <div className="border-outline-variant bg-surface-container-lowest shadow-card rounded-card overflow-x-auto border">
          <table className="w-full text-left">
            <caption className="sr-only">
              Passenger and luggage capacity by vehicle class
            </caption>
            <thead>
              <tr className="border-outline-variant bg-surface-container-low border-b">
                <th scope="col" className="text-label-sm p-space-md uppercase">
                  Vehicle
                </th>
                <th scope="col" className="text-label-sm p-space-md text-right uppercase">
                  Passengers
                </th>
                <th scope="col" className="text-label-sm p-space-md text-right uppercase">
                  Large cases
                </th>
                <th scope="col" className="text-label-sm p-space-md text-right uppercase">
                  Hand luggage
                </th>
                <th scope="col" className="text-label-sm p-space-md text-right uppercase">
                  From
                </th>
              </tr>
            </thead>
            <tbody>
              {VEHICLE_CLASSES.map((vehicle) => (
                <tr
                  key={vehicle.slug}
                  className="border-outline-variant border-b last:border-0"
                >
                  <th scope="row" className="text-title-md p-space-md font-semibold">
                    {vehicle.name}
                  </th>
                  <td className="p-space-md text-right tabular-nums">
                    {vehicle.maxPassengers}
                  </td>
                  <td className="p-space-md text-right tabular-nums">
                    {vehicle.maxLargeBags}
                  </td>
                  <td className="p-space-md text-right tabular-nums">
                    {vehicle.maxHandLuggage}
                  </td>
                  <td className="p-space-md text-primary text-right font-semibold tabular-nums">
                    {formatPence(vehicle.fromPence)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </ScrollFadeIn>
  );
}

function StandardsBanner() {
  const standards = [
    {
      icon: ShieldCheck,
      title: "Licensed and checked",
      body: `${company.legalName} is licensed by ${company.licensingAuthority} as a private hire operator. Every driver and vehicle is licensed, insured for hire and reward, and checked before it can be allocated to a job.`,
    },
    {
      icon: Wind,
      title: "Maintained and air-conditioned",
      body: "Vehicles are serviced on schedule, MOT records are held on file, and every car is cleaned between journeys.",
    },
    {
      icon: Sparkles,
      title: "What is included",
      body: `Meet and greet in arrivals, help with your luggage, ${policies.airportFreeWaitingMinutes} minutes of free waiting after landing, and congestion charges. No card fees.`,
    },
  ];

  return (
    <ScrollFadeIn as="section" className="py-12">
      <Container>
        <ul className="gap-gutter grid md:grid-cols-3">
          {standards.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="border-outline-variant bg-surface-container-lowest shadow-card rounded-card p-space-lg border"
            >
              <Icon aria-hidden className="text-primary mb-3 h-6 w-6" />
              <h3 className="text-headline-sm mb-1">{title}</h3>
              <p className="text-body-sm text-on-surface-variant">{body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </ScrollFadeIn>
  );
}
