import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { QuoteWidget } from "@/components/site/quote-widget";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { SERVICES } from "@/content/services";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export const metadata: Metadata = {
  title: "Our services",
  description:
    "Airport and seaport transfers, station runs, executive chauffeur, corporate travel, minibus hire and hourly hire — all fixed-price and booked direct.",
  alternates: { canonical: "/services" },
};

export default function ServicesHubPage() {
  return (
    <>
      <section className="bg-surface-container-lowest pt-8 pb-12">
        <Container>
          <Breadcrumbs crumbs={[{ label: "Services" }]} siteUrl={siteUrl} />

          <div className="gap-gutter mt-space-lg grid items-start lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h1 className="text-on-surface mb-4 text-[30px] leading-[1.14] font-semibold tracking-tight text-balance sm:text-[40px]">
                What we do
              </h1>
              <p className="text-body-lg text-on-surface-variant max-w-145">
                Every service below is the same licensed operation with the same promises:
                a price agreed before you travel, a driver who meets you, and nothing
                added afterwards.
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
        <ul className="gap-gutter grid sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <li key={service.slug}>
              <Link
                href={`/services/${service.slug}`}
                className="border-outline-variant hover:border-primary-container rounded-card p-space-lg group flex h-full flex-col border transition-colors"
              >
                <h2 className="text-title-md group-hover:text-primary transition-colors">
                  {service.name}
                </h2>
                <p className="text-body-sm text-on-surface-variant mt-space-sm flex-1">
                  {service.summary}
                </p>
                <span className="text-label-md text-primary mt-space-md inline-flex items-center gap-1.5">
                  Read more
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
