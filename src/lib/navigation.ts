/**
 * The site map as data (§5). The header, the footer, breadcrumbs and
 * sitemap.xml all read from here, so a page cannot appear in one and be missing
 * from another (SEO-07).
 *
 * Phase 2 entries are marked and are not rendered until their pages exist.
 */
export interface NavItem {
  label: string;
  href: string;
  /** Phase 2 pages (§5) stay out of the navigation until they are built. */
  phase2?: boolean;
  /**
   * Menus go two levels deep at most: Services → Airport transfers → the six
   * airports. Anything deeper stops being a menu and starts being a maze, and
   * it is unusable on a phone.
   */
  children?: NavItem[];
}

/**
 * The six airports and five seaports, defined once.
 *
 * They hang off Services in the header and off their own columns in the
 * footer. One list rather than two copies, because two copies is how a new
 * airport ends up in the menu and missing from the footer (SEO-07).
 */
export const airportsNav: readonly NavItem[] = [
  { label: "Heathrow (LHR)", href: "/airports/heathrow" },
  { label: "Gatwick (LGW)", href: "/airports/gatwick" },
  { label: "Stansted (STN)", href: "/airports/stansted" },
  { label: "Luton (LTN)", href: "/airports/luton" },
  { label: "London City (LCY)", href: "/airports/london-city" },
  { label: "London Southend (SEN)", href: "/airports/southend" },
] as const;

export const seaportsNav: readonly NavItem[] = [
  { label: "Tilbury", href: "/seaports/tilbury" },
  { label: "Dover", href: "/seaports/dover" },
  { label: "Southampton", href: "/seaports/southampton" },
  { label: "Portsmouth", href: "/seaports/portsmouth" },
  { label: "Harwich", href: "/seaports/harwich" },
] as const;

/**
 * Main navigation — kept short on purpose; the footer carries the long tail.
 *
 * There is no separate "Airports" entry: every airport is reachable through
 * Services → Airport transfers, and a second top-level route to the same six
 * pages only splits the click and makes the row longer.
 */
export const primaryNav: readonly NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Services",
    href: "/services",
    children: [
      {
        label: "Airport transfers",
        href: "/services/airport-transfers",
        children: [...airportsNav],
      },
      {
        label: "Seaport transfers",
        href: "/services/seaport-transfers",
        children: [...seaportsNav],
      },
      { label: "Station transfers", href: "/services/station-transfers" },
      { label: "Executive chauffeur", href: "/services/executive-chauffeur" },
      { label: "Corporate travel", href: "/services/corporate" },
      { label: "Minibus and group travel", href: "/services/minibus-hire" },
      { label: "Hourly hire", href: "/services/hourly-hire" },
    ],
  },
  { label: "Fleet", href: "/fleet" },
  { label: "Fares", href: "/fares" },
  { label: "Contact us", href: "/contact" },
  { label: "About us", href: "/about" },
] as const;

/** Travel information and policies (WEB-03). */
export const helpNav: readonly NavItem[] = [
  { label: "Meeting points", href: "/info/meeting-points" },
  { label: "Luggage guide", href: "/luggage-guide" },
  { label: "Child seats", href: "/child-seats" },
  { label: "Cancellations", href: "/info/cancellation" },
  { label: "Payment", href: "/info/payment" },
  { label: "Lost property", href: "/info/lost-property" },
  { label: "Frequently asked questions", href: "/faq" },
] as const;

export const companyNav: readonly NavItem[] = [
  { label: "Reviews", href: "/reviews" },
  { label: "Drive with us", href: "/drive-with-us", phase2: true },
  { label: "Corporate accounts", href: "/business/corporate-accounts", phase2: true },
  { label: "Blog", href: "/blog", phase2: true },
] as const;

/** CMP-09 and CMP-11 pages. These are never hidden. */
export const legalNav: readonly NavItem[] = [
  { label: "Terms and conditions", href: "/terms" },
  { label: "Privacy policy", href: "/privacy" },
  { label: "Cookies", href: "/cookies" },
  { label: "Licensing", href: "/legal/licensing" },
  { label: "Complaints", href: "/legal/complaints" },
] as const;

/** Drops phase 2 entries until those pages exist. */
export function live(items: readonly NavItem[]): NavItem[] {
  return items
    .filter((item) => !item.phase2)
    .map((item) => (item.children ? { ...item, children: live(item.children) } : item));
}
