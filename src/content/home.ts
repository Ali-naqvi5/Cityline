/**
 * Home page content, from the Stitch design (WEB-01).
 *
 * Moves to the CMS in S8 (ADM-02). Three things from the design are
 * deliberately absent — see `docs/design-deviations.md`:
 *   - the statistics strip ("99.4% on-time", "150,000+ journeys"),
 *   - the testimonials, which must be genuine reviews (WEB-06),
 *   - every promise that a system watches your flight, which is out of scope.
 */
export const AIRPORT_CARDS = [
  {
    name: "Heathrow",
    code: "LHR",
    href: "/airports/heathrow",
    image: "/images/airports/heathrow.webp",
    terminals: "Terminals 2, 3, 4 and 5",
  },
  {
    name: "Gatwick",
    code: "LGW",
    href: "/airports/gatwick",
    image: "/images/airports/gatwick.webp",
    terminals: "North and South terminals",
  },
  {
    name: "Luton",
    code: "LTN",
    href: "/airports/luton",
    image: "/images/airports/luton.webp",
    terminals: "Main terminal",
  },
  {
    name: "Stansted",
    code: "STN",
    href: "/airports/stansted",
    image: "/images/airports/stansted.webp",
    terminals: "Main terminal",
  },
  {
    name: "London City",
    code: "LCY",
    href: "/airports/london-city",
    image: "/images/airports/london-city.webp",
    terminals: "Main terminal",
  },
  {
    name: "London Southend",
    code: "SEN",
    href: "/airports/southend",
    image: "/images/airports/southend.webp",
    terminals: "Main terminal",
  },
] as const;

export const SERVICES = [
  {
    icon: "car",
    title: "Airport transfers",
    body: "Terminal meet and greet, help with luggage, and a fare agreed before you travel.",
    href: "/services/airport-transfers",
  },
  {
    icon: "briefcase",
    title: "Corporate accounts",
    body: "Itemised monthly invoicing, priority dispatch and a named account contact.",
    href: "/business/corporate-accounts",
  },
  {
    icon: "award",
    title: "Executive travel",
    body: "Unbranded premium saloons with experienced, vetted chauffeurs.",
    href: "/services/executive-chauffeur",
  },
  {
    icon: "bus",
    title: "Group and family travel",
    body: "Five to sixteen seat vehicles with generous luggage capacity.",
    href: "/services/minibus-hire",
  },
  {
    icon: "ship",
    title: "Cruise and seaport transfers",
    body: "Direct transfers between London airports and Southampton, Dover and Harwich.",
    href: "/services/airport-transfers",
  },
  {
    icon: "camera",
    title: "Private sightseeing tours",
    body: "Day itineraries across London, Windsor, Stonehenge and Oxford.",
    // Sightseeing is hourly hire in practice — the car and driver stay with
    // you for the day. Pointing at a service that exists beats inventing one.
    href: "/services/hourly-hire",
  },
] as const;

/** PLACEHOLDER fares — replaced by the launch price tables in S2. */
export const POPULAR_ROUTES = [
  {
    from: "Central London (W1)",
    to: "Heathrow T2 and T3",
    duration: "45–60 min",
    pricePence: 6200,
    href: "/transfers/central-london-to-heathrow",
  },
  {
    from: "Canary Wharf (E14)",
    to: "London City",
    duration: "15–20 min",
    pricePence: 3800,
    href: "/transfers/canary-wharf-to-london-city",
  },
  {
    from: "Westminster (SW1)",
    to: "Gatwick South",
    duration: "65–80 min",
    pricePence: 7800,
    href: "/transfers/westminster-to-gatwick",
  },
  {
    from: "City of London (EC2)",
    to: "Stansted",
    duration: "60–75 min",
    pricePence: 8400,
    href: "/transfers/city-of-london-to-stansted",
  },
  {
    from: "Kensington (W8)",
    to: "Heathrow T5",
    duration: "35–45 min",
    pricePence: 5800,
    href: "/transfers/kensington-to-heathrow",
  },
  {
    from: "King's Cross (N1)",
    to: "Luton",
    duration: "55–70 min",
    pricePence: 7200,
    href: "/transfers/kings-cross-to-luton",
  },
] as const;

export const WHY_CITYLINE = [
  {
    icon: "scale",
    title: "A licensed private hire operator",
    body: "Regulated by Transport for London, with vehicle safety checks, emissions standards and driver background checks.",
  },
  {
    icon: "hand",
    title: "Meet and greet included",
    body: "Your driver waits in the arrivals hall with a name board and helps with your luggage to the car.",
  },
  {
    icon: "lock",
    title: "Fixed pricing, agreed up front",
    body: "The price you are quoted is the price you pay. No peak surge, and congestion charges are included.",
  },
  {
    icon: "clock",
    title: "Free waiting time",
    body: "An hour of free waiting after your flight lands, so an hour in the baggage hall costs you nothing.",
  },
] as const;
