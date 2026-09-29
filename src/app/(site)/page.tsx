import {
  Award,
  Briefcase,
  Bus,
  Camera,
  Car,
  Clock,
  Hand,
  Lock,
  type LucideIcon,
  PoundSterling,
  Scale,
  Ship,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ScrollFadeIn } from "@/components/motion/scroll-fade-in";
import { ScrollStagger, StaggerItem } from "@/components/motion/scroll-stagger";
import { QuoteWidget } from "@/components/site/quote-widget";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { AIRPORT_CARDS, POPULAR_ROUTES, SERVICES, WHY_CITYLINE } from "@/content/home";
import { formatPence } from "@/domain/money";
import { policies, policyCopy } from "@/lib/policies";

/**
 * Home page (WEB-01), ported from the Stitch design.
 *
 * Three of the design's sections are not built — see
 * `docs/design-deviations.md`: the statistics strip, the testimonials, and
 * every claim that a system watches your flight (see
 * `domain/compliance/unsupported-claims.ts`).
 */
export const metadata: Metadata = {
  title: "Licensed London airport transfers, priced before you travel",
  description:
    "Fixed-price private hire transfers between London and Heathrow, Gatwick, Luton, Stansted, London City and Southend. Meet and greet included, and your fare is agreed before you travel.",
  alternates: { canonical: "/" },
};

const ICONS: Record<string, LucideIcon> = {
  car: Car,
  briefcase: Briefcase,
  award: Award,
  bus: Bus,
  ship: Ship,
  camera: Camera,
  scale: Scale,
  hand: Hand,
  lock: Lock,
  clock: Clock,
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <AssurancesStrip />
      <Airports />
      <Services />
      <PopularRoutes />
      <WhyCityline />
      <ClosingBand />
    </>
  );
}

function Hero() {
  return (
    <section className="bg-surface-container-lowest relative overflow-hidden pt-10 pb-16 lg:pt-12 lg:pb-20">
      {/* Radial accent wash, from the design */}
      <div
        aria-hidden
        className="bg-tertiary-fixed pointer-events-none absolute -top-36 -right-36 h-135 w-135 rounded-full opacity-30 blur-3xl"
      />

      <Container className="relative z-10">
        {/*
          `items-start`, not `items-center`. The left column runs ~200px taller
          than the quote widget, so centring the row pushed the widget down by
          half that difference — on a 1080p screen at 100% zoom the "See prices"
          button ended up at the very bottom of the viewport. Top-aligning puts
          the widget level with the badge, where the design has it.
        */}
        <div className="gap-gutter grid items-start lg:grid-cols-12">
          <div className="flex flex-col items-start lg:col-span-7 lg:pr-6">
            <p className="bg-tertiary-fixed text-primary text-label-sm mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
              Licensed private hire operator
            </p>

            <h1 className="text-on-surface mb-5 text-[32px] leading-[1.12] font-semibold tracking-tight text-balance sm:text-[44px] lg:text-[52px]">
              Fixed-price London airport transfers, timed to your flight.
            </h1>

            <p className="text-body-lg text-on-surface-variant mb-8 max-w-145">
              Direct private hire between central London, suburban postcodes and every
              major terminal. Your fare is agreed before you travel, with{" "}
              {policies.airportFreeWaitingMinutes} minutes of free waiting time included
              as standard.
            </p>

            <div className="rounded-card shadow-card mb-8 w-full max-w-130 overflow-hidden">
              <Image
                src="/images/hero-executive-saloon.webp"
                alt="A Cityline executive saloon waiting outside an airport terminal"
                width={1200}
                height={670}
                priority
                sizes="(max-width: 1024px) 100vw, 520px"
                className="h-auto w-full object-cover"
              />
            </div>

            <ul className="grid w-full grid-cols-2 gap-4 pt-2 sm:grid-cols-4">
              {[
                { icon: ShieldCheck, label: "Licensed operator" },
                { icon: PoundSterling, label: "Fixed fares, agreed up front" },
                {
                  icon: Clock,
                  label: `${policies.airportFreeWaitingMinutes} min free waiting`,
                },
                { icon: UserCheck, label: "Meet and greet included" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5">
                  <Icon aria-hidden className="text-primary h-5 w-5 shrink-0" />
                  <span className="text-label-md text-on-surface leading-snug">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full lg:col-span-5">
            <h2 className="sr-only">Get a price</h2>
            <QuoteWidget />
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * Where the design had a statistics strip ("99.4% on-time", "150,000+
 * journeys"), this carries only claims Cityline has confirmed. Invented
 * numbers are exactly the trust problem §3 warns about.
 */
function AssurancesStrip() {
  const items = [
    {
      value: `${policies.airportFreeWaitingMinutes} min`,
      label: "Free waiting after landing",
    },
    { value: formatPence(0), label: "Card fees" },
    { value: formatPence(0), label: "Surge pricing, ever" },
    {
      value: `${policies.freeCancellationHours} hr`,
      label: `Free cancellation, ${policies.freeCancellationRefundPercent}% refund`,
    },
  ];

  return (
    <ScrollFadeIn as="section" className="border-outline-variant border-y">
      <Container>
        <dl className="gap-gutter grid grid-cols-2 py-8 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label}>
              <dt className="text-fare-tabular text-primary tabular-nums">
                {item.value}
              </dt>
              <dd className="text-body-sm text-on-surface-variant mt-1">{item.label}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </ScrollFadeIn>
  );
}

function Airports() {
  return (
    <ScrollFadeIn as="section" className="py-16">
      <Container>
        <p className="text-label-sm text-primary mb-2 uppercase">Where we take you</p>
        <h2 className="text-headline-lg-mobile sm:text-headline-lg mb-2">
          Every London airport
        </h2>
        <p className="text-body-lg text-on-surface-variant mb-8 max-w-160">
          Terminal-level pickup and drop-off, with a meeting point agreed in advance.
        </p>

        <ScrollStagger as="ul" className="gap-gutter grid sm:grid-cols-2 lg:grid-cols-3">
          {AIRPORT_CARDS.map((airport) => (
            <StaggerItem as="li" key={airport.code}>
              <Link
                href={airport.href}
                className="group border-outline-variant bg-surface-container-lowest shadow-card hover:shadow-card-hover hover:border-primary-container rounded-card block h-full overflow-hidden border transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02]"
              >
                <Image
                  src={airport.image}
                  alt=""
                  width={800}
                  height={450}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                  className="h-44 w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                />
                <div className="p-space-lg">
                  <h3 className="text-headline-sm group-hover:text-primary transition-colors">
                    {airport.name}{" "}
                    <span className="text-on-surface-variant tabular-nums">
                      ({airport.code})
                    </span>
                  </h3>
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    {airport.terminals}
                  </p>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </ScrollStagger>
      </Container>
    </ScrollFadeIn>
  );
}

function Services() {
  return (
    <ScrollFadeIn as="section" className="bg-surface-container-low py-16">
      <Container>
        <p className="text-label-sm text-primary mb-2 uppercase">Capabilities</p>
        <h2 className="text-headline-lg-mobile sm:text-headline-lg mb-2">Our services</h2>
        <p className="text-body-lg text-on-surface-variant mb-8 max-w-160">
          Private transport for business travellers, families and visiting parties.
        </p>

        <ScrollStagger as="ul" className="gap-gutter grid sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => {
            const Icon = ICONS[service.icon] ?? Car;
            return (
              <StaggerItem as="li" key={service.title}>
                <Link
                  href={service.href}
                  className="group border-outline-variant bg-surface-container-lowest shadow-card hover:shadow-card-hover hover:border-primary-container rounded-card p-space-lg block h-full border transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02]"
                >
                  <Icon aria-hidden className="text-primary mb-3 h-6 w-6" />
                  <h3 className="text-headline-sm group-hover:text-primary mb-1 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">{service.body}</p>
                </Link>
              </StaggerItem>
            );
          })}
        </ScrollStagger>
      </Container>
    </ScrollFadeIn>
  );
}

function PopularRoutes() {
  return (
    <ScrollFadeIn as="section" className="py-16">
      <Container>
        <p className="text-label-sm text-primary mb-2 uppercase">Fixed pricing</p>
        <h2 className="text-headline-lg-mobile sm:text-headline-lg mb-2">
          Popular routes
        </h2>
        <p className="text-body-lg text-on-surface-variant mb-8 max-w-160">
          Fares between central London postcodes and the main departure hubs.
        </p>

        <ul className="border-outline-variant bg-surface-container-lowest divide-outline-variant shadow-card rounded-card divide-y overflow-hidden border">
          {POPULAR_ROUTES.map((route) => (
            <li key={`${route.from}|${route.to}`}>
              <Link
                href={route.href}
                className="hover:bg-surface-container-low p-space-lg flex flex-wrap items-center justify-between gap-3 transition-colors"
              >
                <span className="min-w-0">
                  <span className="text-title-md block">
                    {route.from} to {route.to}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    About {route.duration} · Direct
                  </span>
                </span>
                <span className="text-fare-tabular text-primary tabular-nums">
                  {formatPence(route.pricePence)}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* TODO(S2): replace with live fares from the pricing engine. */}
        <p className="text-body-sm text-on-surface-variant mt-3">
          Fares shown are for a saloon and include {policyCopy.noCardFees.toLowerCase()}.
        </p>
      </Container>
    </ScrollFadeIn>
  );
}

function WhyCityline() {
  return (
    <ScrollFadeIn as="section" className="bg-surface-container-low py-16">
      <Container>
        <p className="text-label-sm text-primary mb-2 uppercase">Standards</p>
        <h2 className="text-headline-lg-mobile sm:text-headline-lg mb-8">
          Why London travellers rely on Cityline
        </h2>

        <ScrollStagger as="ul" className="gap-gutter grid sm:grid-cols-2">
          {WHY_CITYLINE.map((item) => {
            const Icon = ICONS[item.icon] ?? ShieldCheck;
            return (
              <StaggerItem
                as="li"
                key={item.title}
                className="border-outline-variant bg-surface-container-lowest shadow-card hover:shadow-card-hover rounded-card p-space-lg flex gap-4 border transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02]"
              >
                <Icon aria-hidden className="text-primary mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <h3 className="text-headline-sm mb-1">{item.title}</h3>
                  <p className="text-body-sm text-on-surface-variant">{item.body}</p>
                </div>
              </StaggerItem>
            );
          })}
        </ScrollStagger>
      </Container>
    </ScrollFadeIn>
  );
}

function ClosingBand() {
  return (
    <ScrollFadeIn
      as="section"
      className="bg-inverse-surface text-inverse-on-surface py-16"
    >
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-headline-lg-mobile sm:text-headline-lg mb-2 text-balance">
              Ready to book your airport transfer?
            </h2>
            <p className="text-body-lg opacity-85">
              A fixed price in under a minute, with no booking fee.
            </p>
          </div>
          <ButtonLink href="/book" size="lg" className="shrink-0">
            Get a price
          </ButtonLink>
        </div>
      </Container>
    </ScrollFadeIn>
  );
}
