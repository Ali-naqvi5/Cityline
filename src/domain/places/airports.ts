import type { PlaceGuide } from "./types";

/**
 * The six London airports Cityline serves (§5).
 *
 * This is the data behind `/airports` and `/airports/[airport]`. It is a
 * typed constant today and becomes the `places` / `terminals` tables in S2
 * (§14), editable in the admin — which is why nothing here is written inline
 * into a component.
 *
 * What is real and what is not:
 *   - Terminal names, IATA codes, postcodes and road corridors are factual.
 *   - Distances are road miles to the named district, rounded — close enough
 *     to plan by, not surveyed.
 *   - Journey times are ranges, because they genuinely are.
 *   - **Fares are placeholders.** They come from `indicativeFarePence`, one
 *     formula for the whole site, replaced by Cityline's price tables in S2.
 *
 * SEO-01 sets the bar a generated page must clear before it may be indexed:
 * a live fare for at least three vehicle classes, distance and journey time,
 * at least 120 words written for that page, three specific FAQs, and five
 * internal links. `meetsQualityBar` below checks it rather than trusting us.
 */

export const AIRPORTS: readonly PlaceGuide[] = [
  {
    slug: "heathrow",
    name: "Heathrow",
    fullName: "London Heathrow Airport",
    code: "LHR",
    postcode: "TW6",
    direction: "west",
    milesFromCentralLondon: 15,
    image: "/images/airports/heathrow.webp",
    summary:
      "Private hire transfers to and from Terminals 2, 3, 4 and 5, with meet and greet inside arrivals and a fare agreed before you travel.",
    intro: [
      "Heathrow is the busiest airport in the United Kingdom and the one most of our passengers travel through. It sits about 15 miles west of central London, just inside the M25, and its four working terminals are spread across a site large enough that arriving at the wrong one costs a genuine half hour. Terminal 2 and Terminal 3 sit together in the central area; Terminal 4 is to the south-east and Terminal 5 to the west, and each has its own road access.",
      "That layout is the reason we ask which terminal you are landing at rather than simply saying Heathrow. Your driver is sent to the arrivals hall of that terminal, waits inside it with a name board, and helps with the luggage from there. Going to the wrong hall is the single most common way an airport pickup goes wrong, and it is entirely avoidable.",
      "Traffic between Heathrow and London is dominated by the M4 and the A4 Great West Road. Both are reliable outside the peaks and both can be slow inside them, which is why every journey time below is given as a range with a separate peak figure rather than one optimistic number.",
    ],
    terminals: [
      {
        slug: "terminal-2",
        name: "Terminal 2",
        operators: "Star Alliance carriers, including Lufthansa, United and Air Canada",
        meetingPoint:
          "Arrivals concourse on the ground floor, past the customs exit doors.",
      },
      {
        slug: "terminal-3",
        name: "Terminal 3",
        operators: "Virgin Atlantic, Emirates, Delta, American Airlines and others",
        meetingPoint: "Arrivals hall, beside the information desk past customs.",
      },
      {
        slug: "terminal-4",
        name: "Terminal 4",
        operators: "SkyTeam carriers, Qatar Airways, Etihad and Malaysia Airlines",
        meetingPoint: "Arrivals hall opposite the exit from baggage reclaim.",
      },
      {
        slug: "terminal-5",
        name: "Terminal 5",
        operators: "British Airways and Iberia",
        meetingPoint: "Arrivals concourse on the ground floor, by the exit doors.",
      },
    ],
    destinations: [
      {
        label: "Mayfair and the West End",
        postcodes: "W1J, W1K",
        miles: 16,
        offPeak: "40–50 mins",
        peak: "55–70 mins",
        corridor: "M4 then the A4 Great West Road",
      },
      {
        label: "The City and Bank",
        postcodes: "EC1, EC2, EC3, EC4",
        miles: 19,
        offPeak: "55–70 mins",
        peak: "75–90 mins",
        corridor: "M4 then the Victoria Embankment",
      },
      {
        label: "Kensington and Chelsea",
        postcodes: "SW3, SW7, SW10",
        miles: 14,
        offPeak: "35–45 mins",
        peak: "45–60 mins",
        corridor: "M4 inbound then Cromwell Road",
      },
      {
        label: "Westminster and Victoria",
        postcodes: "SW1A, SW1V, SW1P",
        miles: 15,
        offPeak: "40–50 mins",
        peak: "55–70 mins",
        corridor: "A4 then Cromwell Road",
      },
      {
        label: "King's Cross and St Pancras",
        postcodes: "N1C, WC1X",
        miles: 18,
        offPeak: "50–65 mins",
        peak: "65–85 mins",
        corridor: "A40 Westway then Euston Road",
      },
      {
        label: "Canary Wharf and the Docklands",
        postcodes: "E14",
        miles: 22,
        offPeak: "65–85 mins",
        peak: "80–100 mins",
        corridor: "A4 then the Limehouse Link",
      },
    ],
    faqs: [
      {
        question: "Which Heathrow terminal should I give when I book?",
        answer:
          "The terminal your flight actually lands at, which is printed on your boarding pass and shown on your airline's confirmation. Terminals 2 and 3 are in the central area and are walkable from each other; Terminal 4 and Terminal 5 are separate sites with their own roads. Your driver waits in the arrivals hall of the terminal you give us, so this is the detail most worth getting right.",
      },
      {
        question: "Where will my driver meet me at Heathrow?",
        answer:
          "Inside the arrivals hall of your terminal, past the customs exit, holding a name board. You do not need to find a car park or a pickup bay. If you cannot see your driver, call the office on the number in your confirmation and we will put you in touch directly.",
      },
      {
        question: "What happens if my flight into Heathrow is delayed?",
        answer:
          "Give us your flight number when you book and our team checks the arrival time before sending your driver, so a delayed flight does not mean a driver waiting for hours or a passenger waiting alone. Your 60 minutes of free waiting time runs from when you land, not from the time you originally booked.",
      },
      {
        question: "Are the Heathrow drop-off and parking charges included?",
        answer:
          "Yes. Heathrow charges vehicles to use the terminal forecourts, and short-stay parking applies when your driver waits inside for an arrival. Both are included in the fare you are quoted, along with the Congestion Charge and ULEZ where your journey passes through them. The price you agree is the price you pay.",
      },
    ],
  },
  {
    slug: "gatwick",
    name: "Gatwick",
    fullName: "London Gatwick Airport",
    code: "LGW",
    postcode: "RH6",
    direction: "south",
    milesFromCentralLondon: 28,
    image: "/images/airports/gatwick.webp",
    summary:
      "Transfers to and from the North and South terminals, with a fixed fare and meet and greet included.",
    intro: [
      "Gatwick is London's second airport, about 28 miles south of the city in West Sussex, just off the M23. It has two terminals, North and South, connected by a free shuttle that takes a few minutes. They are separate buildings with separate arrivals halls and separate road access, so the terminal on your booking decides where your driver waits.",
      "Most journeys between Gatwick and London run up the M23 and then the A23 or the M25, depending on where in the city you are going. It is a longer run than Heathrow in miles but often a more predictable one, because most of it is motorway rather than urban road. The exception is the approach into central London itself, which is subject to the same congestion as everything else.",
      "Gatwick handles a high proportion of leisure and charter traffic, which means early departures and late arrivals are common. Our office is staffed around the clock, so a 4am pickup for a 6am flight is an ordinary booking rather than a special request.",
    ],
    terminals: [
      {
        slug: "north-terminal",
        name: "North Terminal",
        operators: "British Airways, TUI, Norwegian and others",
        meetingPoint: "Arrivals hall on the ground floor, past the customs exit.",
      },
      {
        slug: "south-terminal",
        name: "South Terminal",
        operators: "easyJet, Emirates, Vueling and others",
        meetingPoint: "Arrivals hall on the ground floor, by the information desk.",
      },
    ],
    destinations: [
      {
        label: "Mayfair and the West End",
        postcodes: "W1J, W1K",
        miles: 29,
        offPeak: "60–80 mins",
        peak: "80–105 mins",
        corridor: "M23 then the A23 through Brixton",
      },
      {
        label: "The City and Bank",
        postcodes: "EC1, EC2, EC3, EC4",
        miles: 30,
        offPeak: "65–85 mins",
        peak: "85–110 mins",
        corridor: "M23 then the A23 and Blackfriars",
      },
      {
        label: "Kensington and Chelsea",
        postcodes: "SW3, SW7, SW10",
        miles: 28,
        offPeak: "60–80 mins",
        peak: "80–100 mins",
        corridor: "M23 then the A24 and Chelsea Bridge",
      },
      {
        label: "Westminster and Victoria",
        postcodes: "SW1A, SW1V, SW1P",
        miles: 28,
        offPeak: "60–75 mins",
        peak: "80–100 mins",
        corridor: "M23 then Vauxhall Bridge",
      },
      {
        label: "Croydon and South London",
        postcodes: "CR0, CR2",
        miles: 19,
        offPeak: "35–50 mins",
        peak: "45–65 mins",
        corridor: "M23 then the A23 Purley Way",
      },
      {
        label: "Canary Wharf and the Docklands",
        postcodes: "E14",
        miles: 33,
        offPeak: "70–90 mins",
        peak: "90–115 mins",
        corridor: "M23, M25 and the Blackwall Tunnel",
      },
    ],
    faqs: [
      {
        question: "North Terminal or South Terminal — which do I need?",
        answer:
          "Whichever your airline uses, which is shown on your booking confirmation. The two are separate buildings joined by a free shuttle, so arriving at the wrong one is recoverable but costs you ten minutes or so with your luggage. Your driver waits in the arrivals hall of the terminal you give us.",
      },
      {
        question: "How long does a transfer from Gatwick to central London take?",
        answer:
          "Usually between an hour and an hour and a half, depending on where you are going and when you travel. The M23 is reliable; the last few miles into central London are not, particularly during the morning and evening peaks. The table above gives a separate peak figure for each destination rather than one average that would mislead half the time.",
      },
      {
        question: "Can you collect very early in the morning for a Gatwick departure?",
        answer:
          "Yes. Early-morning departures are routine at Gatwick and our office is staffed around the clock. Book the pickup time you need and we will be there; if you are unsure how much time to allow for a 6am flight, call us and we will work back from your check-in time.",
      },
      {
        question: "Is the Gatwick drop-off charge included in my fare?",
        answer:
          "Yes. Gatwick charges vehicles to enter the terminal forecourts, and that charge is already in the fare you are quoted, along with parking while your driver waits for an arrival and any Congestion Charge or ULEZ on the London end of the journey.",
      },
    ],
  },
  {
    slug: "stansted",
    name: "Stansted",
    fullName: "London Stansted Airport",
    code: "STN",
    postcode: "CM24",
    direction: "north-east",
    milesFromCentralLondon: 38,
    image: "/images/airports/stansted.webp",
    summary:
      "Transfers to and from Stansted's single terminal, priced before you travel and with waiting time included.",
    intro: [
      "Stansted sits about 38 miles north-east of central London in Essex, at the end of the M11. It has one passenger terminal, which makes arrivals simpler than at Heathrow or Gatwick: there is one arrivals hall and one place your driver will be waiting.",
      "The drive is almost entirely motorway — the M11 down to the North Circular or the A12, depending on which part of London you are heading for. That makes journey times more predictable than the distance suggests, though the last stretch into the city centre is subject to the usual congestion.",
      "Stansted is dominated by low-cost and charter airlines, which means a lot of very early departures and a lot of late-night arrivals. Both are normal bookings for us. If you are landing after midnight, your driver waits inside the terminal as usual — there is no surcharge for an unsociable hour, because our fares do not change with demand.",
    ],
    terminals: [
      {
        slug: "main-terminal",
        name: "Main terminal",
        operators: "Ryanair, Jet2, easyJet and others",
        meetingPoint:
          "Arrivals hall, past the customs exit doors and opposite the shops.",
      },
    ],
    destinations: [
      {
        label: "Mayfair and the West End",
        postcodes: "W1J, W1K",
        miles: 39,
        offPeak: "65–85 mins",
        peak: "85–110 mins",
        corridor: "M11 then the A406 and A503",
      },
      {
        label: "The City and Bank",
        postcodes: "EC1, EC2, EC3, EC4",
        miles: 37,
        offPeak: "60–80 mins",
        peak: "80–105 mins",
        corridor: "M11 then the A12 and Bow",
      },
      {
        label: "Canary Wharf and the Docklands",
        postcodes: "E14",
        miles: 38,
        offPeak: "60–80 mins",
        peak: "80–100 mins",
        corridor: "M11 then the A12 and Blackwall",
      },
      {
        label: "King's Cross and St Pancras",
        postcodes: "N1C, WC1X",
        miles: 36,
        offPeak: "60–80 mins",
        peak: "80–105 mins",
        corridor: "M11 then the A503 Seven Sisters Road",
      },
      {
        label: "Westminster and Victoria",
        postcodes: "SW1A, SW1V, SW1P",
        miles: 40,
        offPeak: "70–90 mins",
        peak: "90–115 mins",
        corridor: "M11, A406 then the Embankment",
      },
      {
        label: "Cambridge",
        postcodes: "CB1, CB2",
        miles: 30,
        offPeak: "40–55 mins",
        peak: "50–70 mins",
        corridor: "M11 northbound",
      },
    ],
    faqs: [
      {
        question: "Where does my driver wait at Stansted?",
        answer:
          "In the arrivals hall past the customs exit, holding a name board with your name on it. Stansted has a single terminal, so there is no question of which building to head for. Your driver parks and comes inside rather than waiting at the kerb.",
      },
      {
        question: "Do you cover very late arrivals into Stansted?",
        answer:
          "Yes. Stansted takes a lot of flights that land close to midnight or after it, and those are ordinary bookings for us. The office is staffed around the clock and there is no night surcharge — the fare you agree when you book is the fare you pay, whatever time you land.",
      },
      {
        question: "How long is the transfer from Stansted to central London?",
        answer:
          "Usually between an hour and an hour and three quarters. Most of the route is the M11, which moves well, so the variation comes almost entirely from where in London you are going and whether you hit a peak period. Each destination in the table above has its own off-peak and peak range.",
      },
      {
        question: "Can you take us from Stansted to Cambridge or further north?",
        answer:
          "Yes. Stansted sits on the M11 between London and Cambridge, and journeys north are straightforward. Cambridge is around 30 miles and takes under an hour in normal traffic. Enter your destination in the booking form and you will see the fare before you give us any personal details.",
      },
    ],
  },
  {
    slug: "luton",
    name: "Luton",
    fullName: "London Luton Airport",
    code: "LTN",
    postcode: "LU2",
    direction: "north",
    milesFromCentralLondon: 34,
    image: "/images/airports/luton.webp",
    summary:
      "Transfers to and from Luton's single terminal, with a fare agreed up front and help with your luggage.",
    intro: [
      "Luton is about 34 miles north of central London in Bedfordshire, just off junction 10 of the M1. It has one passenger terminal, so there is one arrivals hall and one meeting point to find.",
      "The route into London runs down the M1 and then either the A5 or the A41 towards the north-west of the city, or around the M25 for destinations further east. It is a straightforward drive outside the peaks. The M1 southbound in the morning and northbound in the evening is the part worth allowing extra time for, which is reflected in the peak figures below.",
      "Luton's terminal has been substantially rebuilt in recent years and its road layout has changed with it, including where vehicles are allowed to stop. Your driver deals with that: they park, come into the arrivals hall and meet you there, rather than asking you to find a particular pickup bay with your luggage.",
    ],
    terminals: [
      {
        slug: "main-terminal",
        name: "Main terminal",
        operators: "easyJet, Wizz Air, Ryanair and others",
        meetingPoint: "Arrivals hall, past the customs exit and by the main concourse.",
      },
    ],
    destinations: [
      {
        label: "Mayfair and the West End",
        postcodes: "W1J, W1K",
        miles: 35,
        offPeak: "55–75 mins",
        peak: "75–100 mins",
        corridor: "M1 then the A41 and Finchley Road",
      },
      {
        label: "King's Cross and St Pancras",
        postcodes: "N1C, WC1X",
        miles: 33,
        offPeak: "50–70 mins",
        peak: "70–95 mins",
        corridor: "M1 then the A5 Edgware Road",
      },
      {
        label: "The City and Bank",
        postcodes: "EC1, EC2, EC3, EC4",
        miles: 36,
        offPeak: "60–80 mins",
        peak: "80–105 mins",
        corridor: "M1 then the A501 Euston Road",
      },
      {
        label: "Westminster and Victoria",
        postcodes: "SW1A, SW1V, SW1P",
        miles: 37,
        offPeak: "60–80 mins",
        peak: "80–105 mins",
        corridor: "M1 then Regent's Park and Park Lane",
      },
      {
        label: "Kensington and Chelsea",
        postcodes: "SW3, SW7, SW10",
        miles: 36,
        offPeak: "60–80 mins",
        peak: "80–100 mins",
        corridor: "M1 then the A40 and Holland Park",
      },
      {
        label: "Watford and Hertfordshire",
        postcodes: "WD17, WD18",
        miles: 18,
        offPeak: "25–35 mins",
        peak: "35–50 mins",
        corridor: "M1 southbound",
      },
    ],
    faqs: [
      {
        question: "Where will my driver meet me at Luton?",
        answer:
          "Inside the arrivals hall, past the customs exit, with a name board. Luton's forecourt and drop-off arrangements have changed as the terminal has been rebuilt, so rather than asking you to find a particular bay, your driver parks and comes in to meet you.",
      },
      {
        question: "How long does it take to get from Luton into central London?",
        answer:
          "Around an hour off-peak, and up to an hour and forty minutes at the worst times. Almost all the variation is the M1 and the approach through north-west London. Each destination in the table above carries its own peak and off-peak range rather than a single average.",
      },
      {
        question: "Is Luton drop-off charged, and is it in my fare?",
        answer:
          "Luton charges vehicles that use the terminal drop-off area, and that charge is included in what we quote you, as is parking while your driver waits for an arriving flight. You are not asked for anything extra at the airport.",
      },
      {
        question: "Can you collect from Luton for an early-morning flight?",
        answer:
          "Yes. Luton has a heavy early-departure schedule and pickups before dawn are routine. Book the time you need; if you would rather work back from your check-in, call the office and we will help you pick a sensible pickup time for the day you are travelling.",
      },
    ],
  },
  {
    slug: "london-city",
    name: "London City",
    fullName: "London City Airport",
    code: "LCY",
    postcode: "E16",
    direction: "east",
    milesFromCentralLondon: 8,
    image: "/images/airports/london-city.webp",
    summary:
      "The closest airport to the City and Canary Wharf, with short transfers and a fare fixed before you travel.",
    intro: [
      "London City is the closest airport to central London, roughly 8 miles east of the West End and only a few minutes from Canary Wharf. It sits in the Royal Docks in Newham, with a single terminal and a short walk from the aircraft to the arrivals hall.",
      "That proximity is the whole point of the airport. Transfers to the City or Canary Wharf are typically fifteen to thirty minutes, and even the West End is usually under three quarters of an hour outside the peaks. It is popular with business travellers for exactly this reason, and a large share of our bookings here are corporate.",
      "The trade-off is that the roads around the Royal Docks are genuinely local — the A13, the Lower Lea Crossing and the Blackwall Tunnel approach — and they can be slow at peak times in a way the short distance disguises. The ranges below account for that rather than quoting the distance as though it were a clear run.",
    ],
    terminals: [
      {
        slug: "main-terminal",
        name: "Main terminal",
        operators: "British Airways, KLM, Lufthansa and others",
        meetingPoint: "Arrivals hall, immediately past the exit from baggage reclaim.",
      },
    ],
    destinations: [
      {
        label: "Canary Wharf and the Docklands",
        postcodes: "E14",
        miles: 3,
        offPeak: "10–20 mins",
        peak: "20–30 mins",
        corridor: "Lower Lea Crossing",
      },
      {
        label: "The City and Bank",
        postcodes: "EC1, EC2, EC3, EC4",
        miles: 7,
        offPeak: "20–30 mins",
        peak: "30–45 mins",
        corridor: "A13 then Commercial Road",
      },
      {
        label: "Mayfair and the West End",
        postcodes: "W1J, W1K",
        miles: 11,
        offPeak: "30–45 mins",
        peak: "45–65 mins",
        corridor: "A13 then the Embankment",
      },
      {
        label: "Westminster and Victoria",
        postcodes: "SW1A, SW1V, SW1P",
        miles: 11,
        offPeak: "30–45 mins",
        peak: "45–65 mins",
        corridor: "A13 then the Embankment",
      },
      {
        label: "Shoreditch and Hoxton",
        postcodes: "E1, E2, N1",
        miles: 6,
        offPeak: "20–30 mins",
        peak: "30–45 mins",
        corridor: "A13 then Commercial Street",
      },
      {
        label: "Stratford and the Olympic Park",
        postcodes: "E15, E20",
        miles: 5,
        offPeak: "15–25 mins",
        peak: "25–40 mins",
        corridor: "A13 then the A12",
      },
    ],
    faqs: [
      {
        question: "How quickly can I get from London City to Canary Wharf?",
        answer:
          "Usually ten to twenty minutes outside the peaks, and up to half an hour during them. It is about three miles by road over the Lower Lea Crossing. London City is the closest airport to both Canary Wharf and the City, which is why so much of its traffic is business travel.",
      },
      {
        question: "Where does my driver wait at London City?",
        answer:
          "In the arrivals hall, just past the exit from baggage reclaim, with a name board. The terminal is small and the walk from the aircraft is short, so arrivals here tend to be quick — your driver is inside and waiting before you come through.",
      },
      {
        question: "Is a transfer worth it when the DLR is so close?",
        answer:
          "That depends on your luggage, the hour and who you are travelling with. The DLR is quick and cheap if you are travelling light. A car makes more sense with suitcases, with children, late at night, or when you are going somewhere the DLR does not reach directly. We will not pretend otherwise — the fare is shown before you give us any details, so you can compare.",
      },
      {
        question: "Do you cover the Congestion Charge and ULEZ from London City?",
        answer:
          "Yes. London City sits inside the ULEZ and most journeys from it head into or across the Congestion Charge zone. Both are included in the fare you are quoted, along with any tolls on the route, such as the Blackwall or Silvertown crossings.",
      },
    ],
  },
  {
    slug: "southend",
    name: "London Southend",
    fullName: "London Southend Airport",
    code: "SEN",
    postcode: "SS2",
    direction: "east",
    milesFromCentralLondon: 40,
    image: "/images/airports/southend.webp",
    summary:
      "Transfers to and from Southend's single terminal, with a fixed fare and meet and greet included.",
    intro: [
      "London Southend is about 40 miles east of central London, on the Essex coast near Rochford. It is the smallest of the six London airports and has a single terminal, which sits directly beside its railway station.",
      "Its size is its advantage. The walk from the aircraft to the arrivals hall is short, security and baggage are quick, and there is rarely a queue to get out of the building. For passengers coming from Essex, east London or the Thames estuary towns it is often the easiest of the London airports to use.",
      "The road route into London runs along the A127 and then the A13 or the A12. It is a long drive in miles but a straightforward one, and outside the peaks it moves well. Southend is also the natural airport for the cruise terminals at Tilbury, which is a journey we are asked for regularly.",
    ],
    terminals: [
      {
        slug: "main-terminal",
        name: "Main terminal",
        operators: "easyJet, Ryanair and seasonal charter carriers",
        meetingPoint: "Arrivals hall, past the exit from baggage reclaim.",
      },
    ],
    destinations: [
      {
        label: "The City and Bank",
        postcodes: "EC1, EC2, EC3, EC4",
        miles: 41,
        offPeak: "65–85 mins",
        peak: "85–110 mins",
        corridor: "A127 then the A13",
      },
      {
        label: "Canary Wharf and the Docklands",
        postcodes: "E14",
        miles: 38,
        offPeak: "60–80 mins",
        peak: "80–105 mins",
        corridor: "A127 then the A13 to Limehouse",
      },
      {
        label: "Mayfair and the West End",
        postcodes: "W1J, W1K",
        miles: 44,
        offPeak: "75–95 mins",
        peak: "95–120 mins",
        corridor: "A127, A13 then the Embankment",
      },
      {
        label: "Stratford and the Olympic Park",
        postcodes: "E15, E20",
        miles: 35,
        offPeak: "55–75 mins",
        peak: "75–95 mins",
        corridor: "A127 then the A13 and A12",
      },
      {
        label: "Tilbury cruise terminal",
        postcodes: "RM18",
        miles: 22,
        offPeak: "35–50 mins",
        peak: "45–65 mins",
        corridor: "A127 then the A13 westbound",
      },
      {
        label: "Chelmsford and mid-Essex",
        postcodes: "CM1, CM2",
        miles: 19,
        offPeak: "30–40 mins",
        peak: "40–55 mins",
        corridor: "A127 then the A130",
      },
    ],
    faqs: [
      {
        question: "How long does it take to drive from Southend into London?",
        answer:
          "Usually between an hour and two hours depending on where you are going and when. The A127 and A13 carry most of the route and move reasonably well outside the peaks. Each destination in the table above has its own off-peak and peak range.",
      },
      {
        question: "Can you take us from Southend to the Tilbury cruise terminal?",
        answer:
          "Yes, and it is a journey we are asked for often. Tilbury is about 22 miles from the airport, typically 35 to 50 minutes. If you are joining a cruise, tell us the ship and sailing time in the notes when you book and we will time the pickup to suit it.",
      },
      {
        question: "Where will my driver be waiting at Southend?",
        answer:
          "In the arrivals hall, past the exit from baggage reclaim, with a name board. Southend's terminal is small, so this is a short walk and an easy meeting point — there is only one way out of the building.",
      },
      {
        question: "Is Southend a sensible airport to fly into for east London?",
        answer:
          "Often, yes. For Essex, the estuary towns and much of east London it is closer and quicker to get out of than Stansted or Gatwick, and the terminal is far quicker to clear. For central or west London the distance starts to count against it, which the journey times above show honestly.",
      },
    ],
  },
] as const;

export function airportBySlug(slug: string): PlaceGuide | undefined {
  return AIRPORTS.find((airport) => airport.slug === slug);
}
