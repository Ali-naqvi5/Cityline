import { Clock, Luggage, MapPin, PoundSterling, Route, UserCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AirportFares } from "@/components/site/airport-fares";
import { FaqList } from "@/components/site/faq-list";
import { QuoteWidget } from "@/components/site/quote-widget";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { earliestBookableDate } from "@/domain/booking/journey";
import { formatPence } from "@/domain/money";
import type { PlaceGuide } from "@/domain/places/types";
import { cheapestIndicativePence } from "@/domain/pricing/indicative";
import { company, telHref } from "@/lib/company";
import { policies } from "@/lib/policies";

/**
 * One template for every place guide — the six airports and the five seaports
 * today, stations and areas later (§5, WEB-02).
 *
 * These pages are the same page with different nouns, so they are one
 * component rather than eleven files that slowly drift apart. Adding a place
 * is a data file; adding a *kind* of place is a few lines of configuration
 * here.
 *
 * Every page carries the quote widget (SEO-08), `BreadcrumbList` and
 * `FAQPage` structured data (SEO-04), and enough internal links and written
 * copy to clear SEO-01 — which the calling page re-checks rather than assumes.
 */
export interface PlaceGuideConfig {
  /** "airport" or "seaport" — used in headings and link text. */
  noun: string;
  /** Plural, for the "other …" section. */
  nounPlural: string;
  /** e.g. "/airports". */
  hubHref: string;
  hubLabel: string;
  /** The other places of this kind, for internal links. */
  siblings: readonly PlaceGuide[];
  /** Shown beside the name in the breadcrumb and title, e.g. "LHR". */
  showCode?: boolean;
  /** Overrides the generic "Included in every fare" copy. */
  includedNote?: string;
}

export function PlaceGuidePage({
  place,
  config,
  siteUrl,
}: {
  place: PlaceGuide;
  config: PlaceGuideConfig;
  siteUrl: string;
}) {
  const others = config.siblings.filter((item) => item.slug !== place.slug);
  const fromPence = cheapestIndicativePence(
    Math.min(...place.destinations.map((d) => d.miles)),
  );
  const codeSuffix = config.showCode ? ` (${place.code})` : "";

  return (
    <>
      {/* --- Hero ---------------------------------------------------------- */}
      <section className="bg-surface-container-lowest relative overflow-hidden pt-8 pb-12">
        <Container className="relative z-10">
          <Breadcrumbs
            crumbs={[
              { label: config.hubLabel, href: config.hubHref },
              { label: `${place.name}${codeSuffix}` },
            ]}
            siteUrl={siteUrl}
          />

          <div className="gap-gutter mt-space-lg grid items-start lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="bg-tertiary-fixed text-primary text-label-sm mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1">
                <MapPin aria-hidden className="h-3.5 w-3.5" />
                Licensed private hire · {place.postcode}
              </p>

              <h1 className="text-on-surface mb-4 text-[30px] leading-[1.14] font-semibold tracking-tight text-balance sm:text-[40px]">
                {place.fullName} transfers{codeSuffix}
              </h1>

              <p className="text-body-lg text-on-surface-variant mb-space-lg max-w-145">
                {place.summary}
              </p>

              {/*
                Seaports have no photography yet. One stock picture repeated
                across five pages looks worse than none, so the hero simply
                runs without it rather than faking it.
              */}
              {place.image ? (
                <div className="rounded-card shadow-card mb-space-lg overflow-hidden">
                  <Image
                    src={place.image}
                    alt={`${place.fullName} terminal`}
                    width={1200}
                    height={670}
                    priority
                    sizes="(max-width: 1024px) 100vw, 560px"
                    className="h-auto w-full object-cover"
                  />
                </div>
              ) : null}

              <dl className="gap-space-md grid grid-cols-2 sm:grid-cols-3">
                <Stat
                  icon={Route}
                  label="From central London"
                  value={`${place.milesFromCentralLondon} miles ${place.direction}`}
                />
                <Stat
                  icon={PoundSterling}
                  label="Transfers from"
                  value={formatPence(fromPence)}
                />
                <Stat
                  icon={Clock}
                  label="Free waiting"
                  value={`${policies.airportFreeWaitingMinutes} minutes`}
                />
              </dl>
            </div>

            <div className="lg:col-span-5">
              <h2 className="sr-only">Get a price for a {place.name} transfer</h2>
              {/* SEO-08: the quote widget appears on every landing page. */}
              <QuoteWidget minDate={earliestBookableDate()} />
            </div>
          </div>
        </Container>
      </section>

      <Container className="gap-space-xl flex flex-col py-12">
        {/* --- The page's own copy (SEO-01) -------------------------------- */}
        <section aria-labelledby="about">
          <h2 id="about" className="text-headline-md mb-space-md">
            Getting to and from {place.name}
          </h2>
          <div className="gap-space-md text-body-md text-on-surface-variant flex max-w-3xl flex-col">
            {place.intro.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>

        {/* --- Terminals ---------------------------------------------------- */}
        <section aria-labelledby="terminals">
          <h2 id="terminals" className="text-headline-md mb-2">
            {place.terminals.length > 1
              ? `${place.name} terminals`
              : `Where to meet your driver at ${place.name}`}
          </h2>
          <p className="text-body-md text-on-surface-variant mb-space-lg max-w-3xl">
            Your driver meets you at the terminal with a name board and helps with your
            luggage to the vehicle. There is no pickup bay to find and no car park to walk
            to.
          </p>

          <ul className="gap-space-md grid sm:grid-cols-2">
            {place.terminals.map((terminal) => (
              <li
                key={terminal.slug}
                className="border-outline-variant rounded-card p-space-lg border"
              >
                <h3 className="text-title-md mb-1">{terminal.name}</h3>
                {terminal.operators ? (
                  <p className="text-body-sm text-on-surface-variant mb-space-sm">
                    {terminal.operators}
                  </p>
                ) : null}
                <p className="text-body-sm text-on-surface-variant flex gap-2">
                  <UserCheck
                    aria-hidden
                    className="text-primary mt-0.5 h-4 w-4 shrink-0"
                  />
                  {terminal.meetingPoint}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <AirportFares airport={place} />

        {/* --- Journey times ------------------------------------------------ */}
        <section aria-labelledby="journey-times">
          <h2 id="journey-times" className="text-headline-md mb-2">
            Journey times from {place.name}
          </h2>
          <p className="text-body-md text-on-surface-variant mb-space-lg max-w-3xl">
            Typical door-to-door times by road. Peak figures cover the weekday morning and
            evening rushes, when traffic is at its slowest.
          </p>

          <ul className="gap-space-md grid sm:grid-cols-2 lg:grid-cols-3">
            {place.destinations.map((destination) => (
              <li
                key={destination.label}
                className="border-outline-variant bg-surface-container-low/40 rounded-card p-space-lg border"
              >
                <h3 className="text-title-md">{destination.label}</h3>
                <p className="text-body-sm text-on-surface-variant mb-space-sm">
                  {destination.postcodes}
                </p>
                <p className="text-fare-tabular text-primary tabular-nums">
                  {destination.offPeak}
                </p>
                <p className="text-body-sm text-on-surface-variant tabular-nums">
                  Peak {destination.peak} · {destination.miles} miles
                </p>
                <p className="text-body-sm text-on-surface-variant mt-space-sm">
                  Usually via {destination.corridor}.
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* --- What's included ---------------------------------------------- */}
        <section aria-labelledby="included">
          <h2 id="included" className="text-headline-md mb-space-lg">
            Included in every {place.name} fare
          </h2>
          <ul className="gap-space-md grid sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: UserCheck,
                title: "Meet and greet",
                body: `Your driver waits at the ${config.noun} with a name board and walks you to the vehicle.`,
              },
              {
                icon: Clock,
                title: `${policies.airportFreeWaitingMinutes} minutes free waiting`,
                body:
                  config.includedNote ??
                  "Counted from the moment you land, not from the time you booked.",
              },
              {
                icon: Luggage,
                title: "Help with luggage",
                body: "Loading and unloading, from the terminal to the door at the other end.",
              },
              {
                icon: PoundSterling,
                title: "All charges included",
                body: `${config.noun === "seaport" ? "Port" : "Airport"} charges, Congestion Charge, ULEZ and tolls on your route.`,
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

        <FaqList
          faqs={place.faqs}
          heading={`${place.name} transfer questions`}
          headingId="faqs"
        />

        {/* --- Other places of this kind (internal links, SEO-01) ----------- */}
        <section aria-labelledby="other-places">
          <h2 id="other-places" className="text-headline-md mb-space-lg">
            The other London {config.nounPlural}
          </h2>
          <ul className="gap-space-md grid sm:grid-cols-2 lg:grid-cols-5">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`${config.hubHref}/${other.slug}`}
                  className="border-outline-variant hover:border-primary-container rounded-card p-space-md block border transition-colors"
                >
                  <span className="text-title-md block">{other.name}</span>
                  <span className="text-body-sm text-on-surface-variant">
                    {other.milesFromCentralLondon} miles {other.direction}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="text-body-md text-on-surface-variant mt-space-lg">
            You may also want our{" "}
            <Link href="/fleet" className="text-primary hover:underline">
              fleet and capacities
            </Link>
            ,{" "}
            <Link href="/fares" className="text-primary hover:underline">
              how our fares work
            </Link>
            , the{" "}
            <Link href="/airports" className="text-primary hover:underline">
              London airports
            </Link>
            , or to{" "}
            <Link href="/contact" className="text-primary hover:underline">
              contact the office
            </Link>
            .
          </p>
        </section>

        {/* --- Closing CTA --------------------------------------------------- */}
        <section className="bg-surface-container-low rounded-card p-space-xl flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-headline-sm mb-1">
              Ready to book your {place.name} transfer?
            </h2>
            <p className="text-body-md text-on-surface-variant">
              You will see the price before we ask for any personal details, and no card
              details until you book.
            </p>
          </div>
          <div className="gap-space-md flex shrink-0 flex-wrap items-center">
            <a
              href={telHref()}
              className="text-label-md text-on-surface hover:text-primary tabular-nums"
            >
              {company.phone}
            </a>
            <ButtonLink
              href={`/book?pickup=${encodeURIComponent(`${place.fullName}${codeSuffix}`)}`}
            >
              Book a {place.name} transfer
            </ButtonLink>
          </div>
        </section>
      </Container>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Route;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-body-sm text-on-surface-variant flex items-center gap-1.5">
        <Icon aria-hidden className="text-primary h-4 w-4" />
        {label}
      </dt>
      <dd className="text-title-md text-on-surface mt-0.5">{value}</dd>
    </div>
  );
}
