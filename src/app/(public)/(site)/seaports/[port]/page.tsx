import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlaceGuidePage } from "@/components/site/place-guide-page";
import { SEAPORTS, seaportBySlug } from "@/domain/places/seaports";
import { meetsQualityBar, placeInternalLinkCount } from "@/domain/places/types";
import { TABLE_CLASSES } from "@/domain/pricing/indicative";
import { company } from "@/lib/company";

/** Seaport pages (§5, `/seaports/[port]`) — one template, five pages. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export function generateStaticParams() {
  return SEAPORTS.map((port) => ({ port: port.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/seaports/[port]">): Promise<Metadata> {
  const port = seaportBySlug((await params).port);
  if (!port) return {};

  const quality = meetsQualityBar(
    port,
    placeInternalLinkCount(port, SEAPORTS),
    TABLE_CLASSES.length,
  );

  return {
    title: `${port.fullName} transfers`,
    description: port.summary,
    alternates: { canonical: `/seaports/${port.slug}` },
    robots: quality.passes ? undefined : { index: false, follow: true },
  };
}

export default async function SeaportPage({ params }: PageProps<"/seaports/[port]">) {
  const port = seaportBySlug((await params).port);
  if (!port) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Cruise and ferry port transfer",
    name: `${port.fullName} private hire transfers`,
    description: port.summary,
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
        place={port}
        siteUrl={siteUrl}
        config={{
          noun: "seaport",
          nounPlural: "seaports",
          hubHref: "/seaports",
          hubLabel: "Seaports",
          siblings: SEAPORTS,
          // A cruise transfer has no flight to land, so the waiting-time note
          // is worded for a ship rather than a plane.
          includedNote:
            "From your booked pickup time, or from when your ship docks on a return.",
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
