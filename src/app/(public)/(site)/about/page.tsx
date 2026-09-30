import {
  Clock,
  FileText,
  PoundSterling,
  ScrollText,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { AIRPORTS } from "@/domain/places/airports";
import { company, formattedAddress, telHref } from "@/lib/company";
import { legalNav } from "@/lib/navigation";
import { policies } from "@/lib/policies";

/**
 * About us (§5, WEB-02).
 *
 * Deliberately short on adjectives and long on checkable facts. The project
 * spec warns twice about invented credibility — §3 flags a competitor
 * advertising a "9% on-time" figure that reads as a typo and destroys trust,
 * and the design's own stat strip ("150,000+ journeys", "since 2012") was
 * dropped for the same reason. Nothing here is a number Cityline has not
 * confirmed.
 *
 * The page also carries the route to the legal documents, which is where most
 * people go looking for them after the footer.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export const metadata: Metadata = {
  title: "About Cityline Airport Transfers",
  description:
    "Who we are: a licensed London private hire operator running fixed-price airport transfers, with the price agreed before you travel.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <section className="bg-surface-container-lowest pt-8 pb-12">
        <Container>
          <Breadcrumbs crumbs={[{ label: "About us" }]} siteUrl={siteUrl} />

          <div className="gap-gutter mt-space-lg grid items-start lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="bg-tertiary-fixed text-primary text-label-sm mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1">
                <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
                Licensed private hire operator
              </p>

              <h1 className="text-on-surface mb-4 text-[30px] leading-[1.14] font-semibold tracking-tight text-balance sm:text-[40px]">
                A London airport transfer you can price before you book
              </h1>

              <div className="gap-space-md text-body-lg text-on-surface-variant flex max-w-145 flex-col">
                <p>
                  {company.legalName} is a private hire operator licensed by{" "}
                  {company.licensingAuthority}. We run fixed-price transfers between
                  London and all six of its airports, along with seaports, stations and
                  point-to-point journeys across the city.
                </p>
                <p>
                  We are a direct operator rather than a booking platform. When you book
                  with us, your contract is with us, the driver is working to our booking,
                  and we are the ones answerable if something goes wrong.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-card shadow-card overflow-hidden">
                <Image
                  src="/images/chauffeur-london-street.webp"
                  alt="A Cityline driver helping a passenger with their luggage on a London street"
                  width={1200}
                  height={800}
                  priority
                  sizes="(max-width: 1024px) 100vw, 460px"
                  className="h-auto w-full object-cover"
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="gap-space-xl flex flex-col py-12">
        {/* --- How we work ------------------------------------------------- */}
        <section aria-labelledby="how-we-work">
          <h2 id="how-we-work" className="text-headline-md mb-space-lg">
            How we work
          </h2>

          <ul className="gap-space-md grid sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: PoundSterling,
                title: "The price is agreed first",
                body: "You see the fare before we ask for your name, and it is fixed from that point. No card fees, and it never rises with demand.",
              },
              {
                icon: UserCheck,
                title: "We meet you inside",
                body: "On airport pickups your driver waits in the arrivals hall with a name board and helps with the luggage. No pickup bay to find.",
              },
              {
                icon: Clock,
                title: `${policies.airportFreeWaitingMinutes} minutes of free waiting`,
                body: "Counted from when your flight lands, not from the time you booked, so a slow bag carousel is not your problem.",
              },
              {
                icon: ShieldCheck,
                title: "Licensed drivers and vehicles",
                body: "Every driver and vehicle on a Cityline job holds a current private hire licence, insurance for hire and reward, and a valid MOT.",
              },
            ].map((item) => (
              <li
                key={item.title}
                className="border-outline-variant rounded-card p-space-lg border"
              >
                <item.icon aria-hidden className="text-primary mb-space-sm h-6 w-6" />
                <h3 className="text-title-md mb-1">{item.title}</h3>
                <p className="text-body-sm text-on-surface-variant">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* --- What we don't do ------------------------------------------- */}
        <section aria-labelledby="straight-answers" className="max-w-3xl">
          <h2 id="straight-answers" className="text-headline-md mb-space-md">
            Some straight answers
          </h2>
          <div className="gap-space-md text-body-md text-on-surface-variant flex flex-col">
            <p>
              <strong className="text-on-surface">
                We do not track your flight automatically.
              </strong>{" "}
              Plenty of transfer companies say they do. What we do is ask for your flight
              number and have a person check the arrival time before your driver is sent,
              which is what actually needs to happen. Your free waiting time starts when
              you land either way.
            </p>
            <p>
              <strong className="text-on-surface">
                Drivers are allocated by people.
              </strong>{" "}
              There is no algorithm deciding who collects you. A controller assigns the
              job and sends the driver your details, and you get the driver&rsquo;s name,
              licence number and vehicle registration before the journey.
            </p>
            <p>
              <strong className="text-on-surface">
                Our office is not open to callers.
              </strong>{" "}
              Our licence carries a no public access condition, so {formattedAddress()} is
              a registered and operating address rather than somewhere to visit. Reach us
              by phone or email and we will always answer.
            </p>
          </div>
        </section>

        {/* --- Where we go -------------------------------------------------- */}
        <section aria-labelledby="coverage">
          <h2 id="coverage" className="text-headline-md mb-2">
            Where we go
          </h2>
          <p className="text-body-md text-on-surface-variant mb-space-lg max-w-3xl">
            All six London airports, plus seaports, stations and door-to-door journeys
            across the city and the home counties.
          </p>

          <ul className="gap-space-sm flex flex-wrap">
            {AIRPORTS.map((airport) => (
              <li key={airport.slug}>
                <Link
                  href={`/airports/${airport.slug}`}
                  className="border-outline-variant hover:border-primary-container text-label-md rounded-button inline-flex items-center gap-2 border px-4 py-2 transition-colors"
                >
                  {airport.name}
                  <span className="text-on-surface-variant">{airport.code}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* --- Legal documents ---------------------------------------------- */}
        <section aria-labelledby="legal">
          <h2 id="legal" className="text-headline-md mb-2">
            Our terms and your privacy
          </h2>
          <p className="text-body-md text-on-surface-variant mb-space-lg max-w-3xl">
            Worth reading before you book. The terms set out what you are agreeing to, and
            the privacy policy explains what we do with your information and the rights
            you have over it.
          </p>

          <div className="gap-space-md grid sm:grid-cols-2">
            <Link
              href="/terms"
              className="border-outline-variant hover:border-primary-container rounded-card p-space-lg group block border transition-colors"
            >
              <ScrollText aria-hidden className="text-primary mb-space-sm h-6 w-6" />
              <h3 className="text-title-md group-hover:text-primary transition-colors">
                Terms and conditions
              </h3>
              <p className="text-body-sm text-on-surface-variant mt-1">
                Bookings, prices, waiting time, changes, cancellations and refunds,
                luggage, child seats, complaints and liability.
              </p>
              <span className="text-label-md text-primary mt-space-md inline-block">
                Read the terms
              </span>
            </Link>

            <Link
              href="/privacy"
              className="border-outline-variant hover:border-primary-container rounded-card p-space-lg group block border transition-colors"
            >
              <FileText aria-hidden className="text-primary mb-space-sm h-6 w-6" />
              <h3 className="text-title-md group-hover:text-primary transition-colors">
                Privacy policy
              </h3>
              <p className="text-body-sm text-on-surface-variant mt-1">
                What we collect, why we need it, who it is shared with, how long we keep
                it, your rights, and how to complain to the ICO.
              </p>
              <span className="text-label-md text-primary mt-space-md inline-block">
                Read the privacy policy
              </span>
            </Link>
          </div>

          <p className="text-body-sm text-on-surface-variant mt-space-md">
            Also available:{" "}
            {legalNav
              .filter((item) => item.href !== "/terms" && item.href !== "/privacy")
              .map((item, index, all) => (
                <span key={item.href}>
                  <Link href={item.href} className="text-primary hover:underline">
                    {item.label}
                  </Link>
                  {index < all.length - 1 ? ", " : "."}
                </span>
              ))}
          </p>
        </section>

        {/* --- Contact ------------------------------------------------------ */}
        <section className="bg-surface-container-low rounded-card p-space-xl flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-headline-sm mb-1">Talk to a person</h2>
            <p className="text-body-md text-on-surface-variant">
              {company.serviceHours}. Call us, or email{" "}
              <a
                href={`mailto:${company.email}`}
                className="text-primary hover:underline"
              >
                {company.email}
              </a>
              .
            </p>
          </div>
          <div className="gap-space-md flex shrink-0 flex-wrap items-center">
            <a
              href={telHref()}
              className="text-label-md text-on-surface hover:text-primary tabular-nums"
            >
              {company.phone}
            </a>
            <ButtonLink href="/book">Book a transfer</ButtonLink>
          </div>
        </section>
      </Container>
    </>
  );
}
