import type { PlaceFaq } from "@/domain/places/types";

/**
 * The service pages (§5, `/services/...`).
 *
 * Seven services, one template. Each needs enough of its own substance to
 * justify existing — SEO-01's bar is 120 words written for the page, three
 * specific questions and five internal links — otherwise it is a thin page
 * competing with our own airport pages for the same search.
 *
 * Station transfers is deliberately **one page listing every station** rather
 * than nine near-identical pages. §5 makes the same call for areas: "one page,
 * not nine near-identical ones". Nine pages that differ only in a station name
 * is exactly the pattern the spec warns is the main SEO risk in this plan.
 *
 * Moves to the CMS in S8 (ADM-02).
 */
export interface ServiceLink {
  label: string;
  href: string;
  note?: string;
}

export interface ServiceHighlight {
  title: string;
  body: string;
}

export interface Service {
  slug: string;
  /** Short form for navigation and cards. */
  name: string;
  /** The h1. */
  title: string;
  summary: string;
  /** The page's own copy — at least 120 words (SEO-01). */
  intro: string[];
  highlights: ServiceHighlight[];
  /** Places this service covers, linked. Doubles as the internal-link count. */
  places?: { heading: string; blurb: string; items: ServiceLink[] };
  faqs: PlaceFaq[];
  /** Vehicle class slugs worth calling out on this page. */
  vehicles?: string[];
}

export const SERVICES: readonly Service[] = [
  {
    slug: "airport-transfers",
    name: "Airport transfers",
    title: "London airport transfers",
    summary:
      "Fixed-price private hire to and from all six London airports, with meet and greet inside arrivals.",
    intro: [
      "Airport transfers are the bulk of what we do. We cover all six London airports — Heathrow, Gatwick, Stansted, Luton, London City and Southend — at terminal level, which means your driver is sent to the arrivals hall you are actually landing in rather than to the airport in general.",
      "The price is agreed before you book and does not move afterwards. It includes the airport's own drop-off and parking charges, the Congestion Charge and ULEZ where your route passes through them, and any tolls. There are no card fees and no surge pricing, so a 6am Monday costs the same as a Tuesday lunchtime.",
      "On arrivals, give us your flight number. Our team checks the landing time before your driver is dispatched, so a delayed flight does not mean a car that has come and gone. Free waiting starts when you land, not when you booked.",
    ],
    highlights: [
      {
        title: "Terminal-level pickup",
        body: "Your driver waits inside the arrivals hall of your terminal with a name board.",
      },
      {
        title: "Free waiting after landing",
        body: "Counted from touchdown, so passport control and the bag carousel are not your problem.",
      },
      {
        title: "Everything included",
        body: "Airport charges, Congestion Charge, ULEZ, tolls and luggage help are all in the fare.",
      },
    ],
    places: {
      heading: "The six London airports",
      blurb:
        "Each has its own page with fares, journey times and where to meet your driver.",
      items: [
        { label: "Heathrow (LHR)", href: "/airports/heathrow", note: "15 miles west" },
        { label: "Gatwick (LGW)", href: "/airports/gatwick", note: "28 miles south" },
        {
          label: "Stansted (STN)",
          href: "/airports/stansted",
          note: "38 miles north-east",
        },
        { label: "Luton (LTN)", href: "/airports/luton", note: "34 miles north" },
        {
          label: "London City (LCY)",
          href: "/airports/london-city",
          note: "8 miles east",
        },
        {
          label: "London Southend (SEN)",
          href: "/airports/southend",
          note: "40 miles east",
        },
      ],
    },
    faqs: [
      {
        question: "Do you meet me inside the terminal?",
        answer:
          "Yes. Your driver parks and waits in the arrivals hall of your terminal, past customs, with a name board, then helps with your luggage to the vehicle. You are not asked to find a pickup bay or walk to a car park.",
      },
      {
        question: "What happens if my flight is early or late?",
        answer:
          "Give us your flight number when you book. Our team checks the arrival time before sending your driver, so an early landing or a two-hour delay both get handled. Your free waiting time runs from when you actually land.",
      },
      {
        question: "Is the airport drop-off charge extra?",
        answer:
          "No. Every London airport charges vehicles to use its terminal forecourt, and that is already in the fare we quote — along with short-stay parking when your driver waits for an arrival.",
      },
    ],
  },
  {
    slug: "seaport-transfers",
    name: "Seaport transfers",
    title: "Cruise and ferry port transfers",
    summary:
      "Transfers between London and Tilbury, Dover, Southampton, Portsmouth and Harwich, timed to your check-in.",
    intro: [
      "Cruise and ferry transfers are a different job from an airport run, and treating them the same is how people miss ships. Check-in windows close hours before a vessel sails, the terminals sit well outside town, and the luggage is bigger than anything an airline would let you carry.",
      "We plan the pickup back from your check-in deadline rather than from the departure time. Tell us the ship or sailing and the terminal when you book, and we will suggest a pickup that gets you there inside the window with room to spare.",
      "Coming home matters just as much. A ship disembarks two thousand people over a couple of hours and the quayside is not a place to be looking for a car. Book the return leg and your driver will be at the terminal entrance with a name board when you come off.",
    ],
    highlights: [
      {
        title: "Timed to check-in",
        body: "Not to the sailing time — the two can be three hours apart.",
      },
      {
        title: "Room for cruise luggage",
        body: "Bigger cases than an airline allows. The vehicle list only offers classes that fit.",
      },
      {
        title: "Tolls included",
        body: "The Dartford Crossing and any other toll on the route are in the quoted fare.",
      },
    ],
    places: {
      heading: "Ports we cover",
      blurb: "Each has its own page with fares, journey times and terminal detail.",
      items: [
        { label: "Tilbury", href: "/seaports/tilbury", note: "25 miles east" },
        { label: "Dover", href: "/seaports/dover", note: "78 miles south-east" },
        {
          label: "Southampton",
          href: "/seaports/southampton",
          note: "80 miles south-west",
        },
        { label: "Portsmouth", href: "/seaports/portsmouth", note: "75 miles south" },
        { label: "Harwich", href: "/seaports/harwich", note: "80 miles north-east" },
      ],
    },
    vehicles: ["estate", "mpv-5", "mpv-8", "minibus-16"],
    faqs: [
      {
        question: "How early should you collect me for a cruise?",
        answer:
          "Work back from the check-in window, which usually closes a couple of hours before the ship sails. From central London to Southampton or Dover we would normally leave around three hours before check-in closes. Tell us the ship and the terminal and we will pick a time with you.",
      },
      {
        question: "Which vehicle do I need for cruise luggage?",
        answer:
          "Larger than you would book for a flight. Cruise cases are bigger and there are usually more of them — for two people with two large cases each, an estate or an MPV rather than a saloon. Enter your cases when you book and unsuitable classes are shown greyed out with the reason.",
      },
      {
        question: "Can you collect us when the ship docks?",
        answer:
          "Yes, and it is worth arranging in advance. Give us the ship and the docking date, plus your disembarkation time if you have been allocated one, and your driver will meet you at the terminal entrance.",
      },
    ],
  },
  {
    slug: "station-transfers",
    name: "Station transfers",
    title: "London rail station transfers",
    summary:
      "Transfers to and from every major London terminus, including the Eurostar at St Pancras.",
    intro: [
      "Rail transfers are short journeys where the timing is everything. A train does not wait, and the difference between catching the 07:04 and watching it leave is usually a decision made forty minutes earlier about when to set off.",
      "We cover every major London terminus. Give us your train time when you book and we will suggest a pickup that allows for the traffic on that route at that hour, rather than a flat assumption that works on a Sunday and fails on a Tuesday.",
      "Station forecourts are restricted, timed and heavily enforced, and several have no waiting at all. Your driver will tell you where to meet — usually a named entrance rather than the main rank — and will help with the bags from there. For Eurostar departures from St Pancras, allow for the check-in and border controls, which close well before the train leaves.",
    ],
    highlights: [
      {
        title: "Planned to your train",
        body: "Tell us the departure time and we work the pickup back from it.",
      },
      {
        title: "A named meeting point",
        body: "Station forecourts are restricted, so your driver agrees an entrance with you.",
      },
      {
        title: "Eurostar allowed for",
        body: "St Pancras international check-in and border control close well before departure.",
      },
    ],
    places: {
      heading: "Stations we cover",
      blurb:
        "One service, every terminus. Tell us which and we will price it before you book.",
      items: [
        {
          label: "St Pancras International",
          href: "/book",
          note: "Eurostar and East Midlands",
        },
        { label: "King's Cross", href: "/book", note: "East Coast main line" },
        { label: "Euston", href: "/book", note: "West Coast main line" },
        {
          label: "Paddington",
          href: "/book",
          note: "Great Western and Heathrow Express",
        },
        { label: "Victoria", href: "/book", note: "Gatwick Express and the south" },
        { label: "Waterloo", href: "/book", note: "South Western" },
        {
          label: "Liverpool Street",
          href: "/book",
          note: "Stansted Express and the east",
        },
        { label: "London Bridge", href: "/book", note: "Thameslink and Southeastern" },
        {
          label: "Stratford",
          href: "/book",
          note: "Elizabeth line and the Olympic Park",
        },
      ],
    },
    faqs: [
      {
        question: "Where will the driver meet me at the station?",
        answer:
          "At a named entrance agreed with you, not the rank. Most London termini restrict where private hire vehicles may stop and for how long, so a specific door works far better than a general instruction to look for a car.",
      },
      {
        question: "How long before my train should I be collected?",
        answer:
          "For a domestic service, being on the concourse fifteen or twenty minutes ahead is comfortable. For Eurostar at St Pancras, allow considerably more — check-in and border controls close well before departure, and the queue is unpredictable. Tell us the train and we will advise.",
      },
      {
        question: "Do you have separate pages for each station?",
        answer:
          "No, deliberately. Nine pages that differ only by a station name would be thin and unhelpful. This one page covers every terminus, and the price for your specific journey comes from the booking form in a few seconds.",
      },
    ],
  },
  {
    slug: "executive-chauffeur",
    name: "Executive chauffeur",
    title: "Executive chauffeur service",
    summary:
      "An executive saloon and a professional driver, for meetings, events and travel where the arrival matters.",
    intro: [
      "The executive service is the same licensed operation with a higher specification of vehicle and driver. Mercedes-Benz E-Class, BMW 5 Series or Audi A6, kept clean and current, with a driver used to business passengers and to waiting quietly when a meeting overruns.",
      "It suits airport runs where you would rather arrive composed, roadshows with several stops in a day, and evenings where the car is part of the occasion. It is booked exactly like any other journey — a fixed price, agreed before you travel, with nothing added afterwards.",
      "For a full day or half day with the car staying with you, hourly hire is usually the better structure. For a single journey from A to B, book it as a route and choose the executive class at the vehicle step.",
    ],
    highlights: [
      {
        title: "Executive saloons",
        body: "Mercedes-Benz E-Class, BMW 5 Series, Audi A6 or similar — three passengers, two large cases.",
      },
      {
        title: "Experienced drivers",
        body: "Used to business travel, discreet, and content to wait when a meeting runs over.",
      },
      {
        title: "Fixed, not metered",
        body: "The price is agreed before you travel and does not change with traffic.",
      },
    ],
    vehicles: ["executive", "mpv-8"],
    faqs: [
      {
        question: "What is the difference between executive and a standard saloon?",
        answer:
          "The vehicle and the driver. Executive means a Mercedes-Benz E-Class, BMW 5 Series, Audi A6 or similar, and a driver who does this work regularly. It carries three passengers rather than four, because the rear is set up for comfort rather than capacity.",
      },
      {
        question: "Can the car wait between meetings?",
        answer:
          "Yes — that is what hourly hire is for. Book the car by the hour and it stays with you, including the waiting, rather than being priced as a series of separate journeys.",
      },
      {
        question: "Do you invoice businesses rather than taking a card?",
        answer:
          "Account billing is something we set up per client. Contact the office and we will talk through how you want it arranged — see our corporate travel page for what that covers.",
      },
    ],
  },
  {
    slug: "corporate",
    name: "Corporate travel",
    title: "Corporate and business travel",
    summary:
      "Airport runs, client collections and regular business journeys, with one operator accountable for all of it.",
    intro: [
      "Business travel is mostly the same problem repeated: someone has to be somewhere, on time, without thinking about it. We handle airport runs for staff and visitors, client collections, roadshows with several stops, and the standing weekly journeys that never quite fit an expenses policy.",
      "The advantage of a direct operator over an app is accountability. There is a phone number that reaches a person who can see the booking, and the same licensed company is responsible for the journey from quote to drop-off. If a flight moves or a meeting overruns, that is a conversation rather than a cancellation.",
      "We can arrange account billing rather than individual card payments, so travel is invoiced periodically with a reference you can reconcile. Talk to the office about how you want it set up — it is arranged per client rather than sold as a package.",
    ],
    highlights: [
      {
        title: "One accountable operator",
        body: "The same licensed company from quote to drop-off, with a phone number that reaches a person.",
      },
      {
        title: "Visitor collections",
        body: "Meet and greet inside arrivals with a name board, so a client is never left looking.",
      },
      {
        title: "Account billing",
        body: "Invoiced periodically rather than card by card. Arranged with you rather than off a shelf.",
      },
    ],
    vehicles: ["executive", "saloon", "mpv-8"],
    faqs: [
      {
        question: "Can we open an account rather than paying by card each time?",
        answer:
          "Yes — contact the office and we will set it up with you. Account terms are agreed per client rather than sold as a fixed package, because a company booking two airport runs a month and one booking forty need different things.",
      },
      {
        question: "Can you collect clients we are hosting?",
        answer:
          "Yes, and it is one of the most common things we are asked for. Your visitor is met inside arrivals with a name board showing their name, and we can text them the driver's details in advance so they know who to expect.",
      },
      {
        question: "Do you handle multi-stop days?",
        answer:
          "Yes. For a day with several stops and waiting in between, hourly hire is usually the right structure — the car stays with you and the price covers the whole booking rather than each leg separately.",
      },
    ],
  },
  {
    slug: "minibus-hire",
    name: "Minibus and group travel",
    title: "Minibus hire and group travel",
    summary:
      "Eight- and sixteen-seat vehicles for groups, with luggage space that actually fits a group's luggage.",
    intro: [
      "Moving eight or sixteen people is not the same as moving four twice. One vehicle keeps a group together, arrives at once, and usually costs less than the cars it replaces — and for an airport run it means one meeting point rather than a scattered party trying to reconcile two drivers.",
      "We run eight-seat MPVs and sixteen-seat minibuses. The thing worth checking before booking is luggage rather than seats: a sixteen-seat minibus does not automatically hold sixteen large suitcases, and a full group with cruise cases needs more room than the same group with hand luggage.",
      "Enter your passengers and cases when you book and the vehicle list will only offer classes that genuinely fit both. Anything larger than sixteen passengers is a booking we will happily arrange, but it needs a phone call rather than the website.",
    ],
    highlights: [
      {
        title: "Eight and sixteen seats",
        body: "Mercedes-Benz Vito, Ford Tourneo, Mercedes-Benz Sprinter or similar.",
      },
      {
        title: "Luggage counted properly",
        body: "Seats and cases are checked separately, so a full group with full cases still fits.",
      },
      {
        title: "One vehicle, one meeting point",
        body: "The group arrives together, which matters most at an airport or a cruise terminal.",
      },
    ],
    vehicles: ["mpv-5", "mpv-8", "minibus-16"],
    faqs: [
      {
        question: "Will sixteen people's luggage fit in a sixteen-seat minibus?",
        answer:
          "Not always, and it is the mistake worth avoiding. Sixteen seats does not mean sixteen large cases. Enter both numbers when you book: the vehicle list checks seats and luggage separately and shows the reason when a class will not do.",
      },
      {
        question: "Can you carry more than sixteen passengers?",
        answer:
          "Yes, with more than one vehicle. The website prices a single vehicle, so for a larger party you will see a panel asking you to call us — it is a real booking, it just cannot be priced automatically.",
      },
      {
        question: "Is a minibus cheaper than two cars?",
        answer:
          "Usually, yes, and the group stays together. Put the same journey through the booking form as one minibus and as two saloons and you will see both prices before giving us any details.",
      },
    ],
  },
  {
    slug: "hourly-hire",
    name: "Hourly hire",
    title: "Hourly hire — a car and driver by the hour",
    summary:
      "The car stays with you for the booking, for days with several stops or waiting in between.",
    intro: [
      "Hourly hire is for days that are not a single journey. A morning of meetings across the city, a day out with stops, an evening event where the car waits — anything where paying per leg would be both more expensive and more stressful than paying for the time.",
      "You book a pickup point, a start time and a number of hours. The driver and vehicle stay with you for the whole of it, including the waiting, and you decide where to go as the day unfolds rather than committing to a route in advance.",
      "There is a minimum hire, which varies by vehicle class and is shown when you book. The price is fixed at the point of booking in the same way as any other journey, so running a little over is a conversation rather than a surprise on a meter.",
    ],
    highlights: [
      {
        title: "The car waits with you",
        body: "Waiting is part of the hire, not an extra charged on top.",
      },
      {
        title: "No route to commit to",
        body: "Decide where to go as the day goes. The price is for the time, not the miles.",
      },
      {
        title: "Fixed before you book",
        body: "A minimum hire applies per vehicle class and is shown before you pay.",
      },
    ],
    vehicles: ["executive", "saloon", "mpv-8"],
    faqs: [
      {
        question: "How does hourly hire differ from booking several journeys?",
        answer:
          "The car stays with you between stops rather than leaving and coming back. For a day with two or three stops and waiting in between, that is usually cheaper as well as far less stressful — and you are not committed to a route when you book.",
      },
      {
        question: "What is the minimum hire?",
        answer:
          "It depends on the vehicle class and is shown in the booking form when you choose hourly hire. Larger vehicles carry a longer minimum than a saloon, because they are harder to redeploy around a booking.",
      },
      {
        question: "What if we run over the hours we booked?",
        answer:
          "Tell your driver and call the office and we will extend it at the same hourly rate, subject to the vehicle being free afterwards. Booking an extra hour up front is usually cheaper than sorting it out on the day.",
      },
    ],
  },
] as const;

export function serviceBySlug(slug: string): Service | undefined {
  return SERVICES.find((service) => service.slug === slug);
}
