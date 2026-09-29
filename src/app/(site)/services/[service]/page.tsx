import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FaqList } from "@/components/site/faq-list";
import { QuoteWidget } from "@/components/site/quote-widget";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SERVICES, serviceBySlug } from "@/content/services";
import { formatPence } from "@/domain/money";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { company, telHref } from "@/lib/company";

/**
 * Service pages (§5, WEB-02) — one template, seven pages, pre-rendered at
 * build time (SEO-02).
 *
 * Station transfers is one page covering every terminus rather than nine
 * pages differing only by a station name — see the note in `content/services`.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export function generateStaticParams() {
  return SERVICES.map((service) => ({ service: service.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/services/[service]">): Promise<Metadata> {
  const service = serviceBySlug((await params).service);
  if (!service) return {};

  return {
    title: service.title,
    description: service.summary,
    alternates: { canonical: `/services/${service.slug}` },
  };
}

export default async function ServicePage({ params }: PageProps<"/services/[service]">) {
  const service = serviceBySlug((await params).service);
  if (!service) notFound();

  const others = SERVICES.filter((item) => item.slug !== service.slug);
  const vehicles = VEHICLE_CLASSES.filter((vehicle) =>
    (service.vehicles ?? []).includes(vehicle.slug),
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: service.title,
    name: `${service.title} from ${company.tradingName}`,
    description: service.summary,
    areaServed: { "@type": "City", name: "London" },
    provider: {
      "@type": "LocalBusiness",
      name: company.legalName,
      telephone: company.phone,
      url: siteUrl,
    },
  };

  return (
    <>
      <section className="bg-surface-container-lowest pt-8 pb-12">
        <Container>
          <Breadcrumbs
            crumbs={[{ label: "Services", href: "/services" }, { label: service.name }]}
            siteUrl={siteUrl}
          />

          <div className="gap-gutter mt-space-lg grid items-start lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h1 className="text-on-surface mb-4 text-[30px] leading-[1.14] font-semibold tracking-tight text-balance sm:text-[40px]">
                {service.title}
              </h1>
              <p className="text-body-lg text-on-surface-variant max-w-145">
                {service.summary}
              </p>
            </div>

            <div className="lg:col-span-5">
              <h2 className="sr-only">Get a price</h2>
              {/* SEO-08: the quote widget appears on every landing page. */}
              <QuoteWidget />
            </div>
          </div>
        </Container>
      </section>

      <Container className="gap-space-xl flex flex-col py-12">
        <section aria-labelledby="about">
          <h2 id="about" className="text-headline-md mb-space-md">
            How it works
          </h2>
          <div className="gap-space-md text-body-md text-on-surface-variant flex max-w-3xl flex-col">
            {service.intro.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section aria-labelledby="highlights">
          <h2 id="highlights" className="text-headline-md mb-space-lg">
            What you get
          </h2>
          <ul className="gap-space-md grid sm:grid-cols-3">
            {service.highlights.map((item) => (
              <li
                key={item.title}
                className="border-outline-variant rounded-card p-space-lg border"
              >
                <Check aria-hidden className="text-primary mb-space-sm h-6 w-6" />
                <h3 className="text-title-md mb-1">{item.title}</h3>
                <p className="text-body-sm text-on-surface-variant">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {service.places ? (
          <section aria-labelledby="places">
            <h2 id="places" className="text-headline-md mb-2">
              {service.places.heading}
            </h2>
            <p className="text-body-md text-on-surface-variant mb-space-lg max-w-3xl">
              {service.places.blurb}
            </p>
            <ul className="gap-space-md grid sm:grid-cols-2 lg:grid-cols-3">
              {service.places.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="border-outline-variant hover:border-primary-container rounded-card p-space-md group flex items-center justify-between gap-3 border transition-colors"
                  >
                    <span>
                      <span className="text-title-md group-hover:text-primary block transition-colors">
                        {item.label}
                      </span>
                      {item.note ? (
                        <span className="text-body-sm text-on-surface-variant">
                          {item.note}
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="text-on-surface-variant group-hover:text-primary h-4 w-4 shrink-0"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {vehicles.length > 0 ? (
          <section aria-labelledby="vehicles">
            <h2 id="vehicles" className="text-headline-md mb-2">
              Vehicles for this service
            </h2>
            <p className="text-body-md text-on-surface-variant mb-space-lg max-w-3xl">
              Prices are indicative starting fares; the exact price for your journey is
              shown before you give us any details. See the{" "}
              <Link href="/fleet" className="text-primary hover:underline">
                full fleet
              </Link>{" "}
              for capacities.
            </p>
            <ul className="gap-space-md grid sm:grid-cols-2 lg:grid-cols-4">
              {vehicles.map((vehicle) => (
                <li
                  key={vehicle.slug}
                  className="border-outline-variant rounded-card p-space-lg border"
                >
                  <h3 className="text-title-md">{vehicle.name}</h3>
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    {vehicle.maxPassengers} passengers · {vehicle.maxLargeBags} large
                    cases
                  </p>
                  <p className="text-label-md text-primary mt-space-sm tabular-nums">
                    From {formatPence(vehicle.fromPence)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <FaqList
          faqs={service.faqs}
          heading={`${service.name} questions`}
          headingId="faqs"
        />

        <section aria-labelledby="other-services">
          <h2 id="other-services" className="text-headline-md mb-space-lg">
            Our other services
          </h2>
          <ul className="gap-space-sm flex flex-wrap">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/services/${other.slug}`}
                  className="border-outline-variant hover:border-primary-container text-label-md rounded-button inline-flex items-center border px-4 py-2 transition-colors"
                >
                  {other.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-surface-container-low rounded-card p-space-xl flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-headline-sm mb-1">Get a price in a few seconds</h2>
            <p className="text-body-md text-on-surface-variant">
              No account needed, and no card details until you book.
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

      <script
        type="application/ld+json"
        // Built from our own data, never from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
