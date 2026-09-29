/**
 * The site map as data (§5). The header, the footer, breadcrumbs and
 * sitemap.xml all read from here, so a page cannot appear in one and be missing
 * from another (SEO-07).
 */
export interface NavItem {
  label: string;
  href: string;
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
  { label: "Waiting time", href: "/info/waiting-time" },
  { label: "Luggage guide", href: "/luggage-guide" },
  { label: "Child seats", href: "/child-seats" },
  { label: "Cancellations", href: "/info/cancellation" },
  { label: "Payment", href: "/info/payment" },
  { label: "Lost property", href: "/info/lost-property" },
  { label: "Accessibility", href: "/info/accessibility" },
  { label: "Frequently asked questions", href: "/faq" },
] as const;

/**
 * About and Contact, which the header also carries. SEO-07 wants the one
 * canonical Contact page linked identically from both. The phase 2 pages that
 * used to sit here (reviews, driver recruitment, corporate accounts, blog) were
 * dropped from this build by Cityline on 29 Sep 2026.
 */
export const companyNav: readonly NavItem[] = [
  { label: "About us", href: "/about" },
  { label: "Contact us", href: "/contact" },
] as const;

/** CMP-09 and CMP-11 pages. These are never hidden. */
export const legalNav: readonly NavItem[] = [
  { label: "Terms and conditions", href: "/terms" },
  { label: "Privacy policy", href: "/privacy" },
  { label: "Cookies", href: "/cookies" },
  { label: "Licensing", href: "/legal/licensing" },
  { label: "Complaints", href: "/legal/complaints" },
] as const;
