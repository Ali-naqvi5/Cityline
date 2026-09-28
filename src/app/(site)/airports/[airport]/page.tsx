import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlaceGuidePage } from "@/components/site/place-guide-page";
import { AIRPORTS, airportBySlug } from "@/domain/places/airports";
import { meetsQualityBar, type PlaceGuide } from "@/domain/places/types";
import { TABLE_CLASSES } from "@/domain/pricing/indicative";
import { company } from "@/lib/company";

/**
 * Airport pages (§5, WEB-02) — one template, six pages.
 *
 * Pre-rendered at build time via `generateStaticParams` (SEO-02), so these
 * serve as static HTML well inside the 250ms target (NFR-01).
 *
 * Indexing is not assumed: `meetsQualityBar` re-checks SEO-01 at render time
 * and marks the page `noindex` if it is thin. The spec names publishing
 * generated pages faster than their content as the main SEO risk in this plan,
 * so the check lives in code rather than in a habit.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export function generateStaticParams() {
  return AIRPORTS.map((airport) => ({ airport: airport.slug }));
}

/** Links this page renders to other pages, for the SEO-01 count. */
function internalLinkCount(airport: PlaceGuide): number {
  return airport.destinations.length + (AIRPORTS.length - 1) + 4;
}

export async function generateMetadata({
  params,
}: PageProps<"/airports/[airport]">): Promise<Metadata> {
  const airport = airportBySlug((await params).airport);
  if (!airport) return {};

  const quality = meetsQualityBar(
    airport,
    internalLinkCount(airport),
    TABLE_CLASSES.length,
  );

  return {
    title: `${airport.fullName} transfers (${airport.code})`,
    description: airport.summary,
    alternates: { canonical: `/airports/${airport.slug}` },
    robots: quality.passes ? undefined : { index: false, follow: true },
  };
}

export default async function AirportPage({ params }: PageProps<"/airports/[airport]">) {
  const airport = airportBySlug((await params).airport);
  if (!airport) notFound();

  // SEO-04: Service with an Offer, so the fare can appear in search results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Airport transfer",
    name: `${airport.fullName} private hire transfers`,
    description: airport.summary,
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
      <PlaceGuidePage
        place={airport}
        siteUrl={siteUrl}
        config={{
          noun: "airport",
          nounPlural: "airports",
          hubHref: "/airports",
          hubLabel: "Airports",
          siblings: AIRPORTS,
          showCode: true,
        }}
      />
      <script
        type="application/ld+json"
        // Built from our own data, never from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
