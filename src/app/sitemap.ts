import type { MetadataRoute } from "next";

import { SERVICES } from "@/content/services";
import { AIRPORTS } from "@/domain/places/airports";
import { SEAPORTS } from "@/domain/places/seaports";
import {
  meetsQualityBar,
  placeInternalLinkCount,
  type PlaceGuide,
} from "@/domain/places/types";
import { TABLE_CLASSES } from "@/domain/pricing/indicative";
import { reviewProfileLinks, siteUrl } from "@/lib/company";

/**
 * SEO-01: a place guide that fails the quality bar is rendered `noindex` *and*
 * kept out of the sitemap. Same inputs as the page's own check, so the two can
 * never disagree about which pages are thin.
 */
function indexable(places: readonly PlaceGuide[]): PlaceGuide[] {
  return places.filter(
    (place) =>
      meetsQualityBar(place, placeInternalLinkCount(place, places), TABLE_CLASSES.length)
        .passes,
  );
}

/**
 * SEO-03: the sitemap `robots.txt` already points at.
 *
 * Built from the same constants the pages are built from — `AIRPORTS`,
 * `SEAPORTS`, `SERVICES` — rather than a hand-kept list. A sitemap maintained
 * separately from its pages drifts, and a sitemap full of 404s is worse for
 * crawling than no sitemap at all.
 *
 * What is deliberately **not** here:
 *
 *   `/book`, `/manage`, `/admin`, `/api` — the same set `robots.txt` disallows
 *   and `src/proxy.ts` sends `X-Robots-Tag: noindex` for. A booking funnel in a
 *   sitemap gets crawled, and a crawler walking a funnel creates quote rows.
 *
 *   `/coming-soon` — an implementation detail of the launch gate (PRD-02).
 */

// Evaluated per request, like robots.ts: the launch gate flips with a container
// restart rather than a rebuild, and the two must agree.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  /*
   * Nothing is indexable while the gate is on (PRD-02), and `robots.txt` says
   * so. Serving a full sitemap anyway would invite exactly the crawl that the
   * gate exists to prevent.
   */
  if (process.env.LAUNCH_GATE === "on") return [];

  const origin = siteUrl();
  const lastModified = new Date();

  const entry = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly",
  ) => ({ url: `${origin}${path}`, lastModified, changeFrequency, priority });

  return [
    entry("/", 1, "weekly"),

    // The hubs, and the pages a customer checks before booking.
    entry("/fares", 0.9, "weekly"),
    entry("/airports", 0.9),
    entry("/seaports", 0.8),
    entry("/services", 0.8),
    entry("/fleet", 0.7),
    entry("/about", 0.6),
    entry("/contact", 0.6),

    /*
     * Airport guides rank highest of the leaf pages: they are the pages the
     * business is found through, and each one carries the price table, distance
     * and journey time that SEO-01 requires.
     */
    ...indexable(AIRPORTS).map((airport) => entry(`/airports/${airport.slug}`, 0.9)),
    ...indexable(SEAPORTS).map((seaport) => entry(`/seaports/${seaport.slug}`, 0.7)),
    ...SERVICES.map((service) => entry(`/services/${service.slug}`, 0.7)),

    // Help pages (WEB-03): what people search for just before, or just after,
    // booking.
    entry("/faq", 0.6),
    entry("/info/meeting-points", 0.6),
    entry("/luggage-guide", 0.5),
    entry("/child-seats", 0.5),
    entry("/info/cancellation", 0.5),
    entry("/info/payment", 0.5),
    entry("/info/lost-property", 0.4),

    // Only once there are genuine reviews to show — the page is `noindex`
    // until then, and the sitemap must not contradict it.
    ...(reviewProfileLinks().length > 0 ? [entry("/reviews", 0.5)] : []),

    // Legal pages are indexable — customers look for them before paying — but
    // they are not what anyone should land on first.
    entry("/terms", 0.3, "yearly"),
    entry("/privacy", 0.3, "yearly"),
    entry("/cookies", 0.2, "yearly"),
    entry("/legal/licensing", 0.3, "yearly"),
    entry("/legal/complaints", 0.3, "yearly"),
  ];
}
