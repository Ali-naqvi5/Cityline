/**
 * The shape shared by every place guide — airports today, seaports alongside
 * them, stations and areas later (§5).
 *
 * These pages are the same page with different nouns: a hero, some copy
 * written for that place, a fare table, journey times, FAQs and links out. The
 * template and the SEO-01 quality check are written against this type, so a
 * new kind of place is a data file rather than a new page.
 */
export interface PlaceDestination {
  label: string;
  /** Postcode districts, so people recognise their own area. */
  postcodes: string;
  miles: number;
  /** Typical door-to-door range, off-peak then peak. */
  offPeak: string;
  peak: string;
  /** Main road route — the detail that makes a journey time believable. */
  corridor: string;
}

export interface PlaceFaq {
  question: string;
  answer: string;
}

export interface PlaceTerminal {
  slug: string;
  name: string;
  /** Who flies or sails from here. */
  operators?: string;
  /** Where the driver waits. */
  meetingPoint: string;
}

export interface PlaceGuide {
  slug: string;
  /** Short form used in navigation and headings. */
  name: string;
  /** Full name for the page title and structured data. */
  fullName: string;
  /** IATA code for an airport; a short label for a seaport. */
  code: string;
  postcode: string;
  /** Compass position relative to central London, e.g. "west". */
  direction: string;
  milesFromCentralLondon: number;
  /** Optional: seaports have no photography yet, and one stock picture
   *  repeated five times looks worse than none. */
  image?: string;
  summary: string;
  /** The page's own copy — SEO-01 wants at least 120 words. */
  intro: string[];
  terminals: PlaceTerminal[];
  destinations: PlaceDestination[];
  faqs: PlaceFaq[];
}

/** Rough word count of the copy written for this page (SEO-01). */
export function introWordCount(place: PlaceGuide): number {
  return place.intro.join(" ").trim().split(/\s+/).length;
}

/**
 * Links a place guide renders to other pages, for SEO-01's count: one per
 * destination, one to each sibling place, and four fixed ones (booking, fares,
 * fleet and the hub).
 *
 * Shared by the page and the sitemap. SEO-01 wants a thin page both `noindex`
 * and out of the sitemap, and two copies of this arithmetic would eventually
 * disagree about which pages those are.
 */
export function placeInternalLinkCount(
  place: PlaceGuide,
  siblings: readonly PlaceGuide[],
): number {
  return place.destinations.length + (siblings.length - 1) + 4;
}

export interface QualityCheck {
  passes: boolean;
  failures: string[];
}

/**
 * SEO-01's quality bar, checked rather than assumed.
 *
 * A page that fails is rendered `noindex` and kept out of the sitemap. The
 * spec is blunt about why: publishing generated pages faster than the content
 * can be written for them is the main SEO risk in this plan, and a thin page
 * that ranks for nothing still costs crawl budget.
 *
 * `internalLinks` is passed in by the page, because only the page knows how
 * many it actually rendered.
 */
export function meetsQualityBar(
  place: PlaceGuide,
  internalLinks: number,
  pricedClasses: number,
): QualityCheck {
  const failures: string[] = [];

  if (pricedClasses < 3) failures.push(`only ${pricedClasses} vehicle classes priced`);
  if (place.destinations.length === 0) failures.push("no distances or journey times");
  if (introWordCount(place) < 120) failures.push("fewer than 120 words of page copy");
  if (place.faqs.length < 3) failures.push("fewer than 3 FAQs");
  if (internalLinks < 5) failures.push(`only ${internalLinks} internal links`);

  return { passes: failures.length === 0, failures };
}
