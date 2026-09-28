import type { PlaceGuide } from "./types";

/**
 * The cruise and ferry ports Londoners sail from (§5, `/seaports/[port]`).
 *
 * Tilbury is the only one inside Greater London; the rest are the south and
 * east coast ports that London passengers actually use, which is why they
 * belong on a London operator's site. Distances and journey times are from
 * central London by road.
 *
 * A cruise transfer is a different job from an airport run and the copy says
 * so: the terminal is often far from anywhere, check-in windows are strict and
 * unmissable, and the return is a ship docking at dawn with two thousand other
 * people wanting a car at the same moment. Pricing is the same placeholder
 * formula as everywhere else until S2.
 */
export const SEAPORTS: readonly PlaceGuide[] = [
  {
    slug: "tilbury",
    name: "Tilbury",
    fullName: "London International Cruise Terminal, Tilbury",
    code: "Tilbury",
    postcode: "RM18",
    direction: "east",
    milesFromCentralLondon: 25,
    summary:
      "The closest cruise terminal to central London, about 25 miles east on the Thames in Essex.",
    intro: [
      "Tilbury is London's own cruise terminal, on the north bank of the Thames in Essex, roughly 25 miles east of the city centre. It is the nearest departure port to central London by a wide margin, and the one most Londoners join a ship from.",
      "The terminal building is the listed London Cruise Terminal, and the approach is along the A13 and then local roads through Tilbury town. That last stretch is slow and easy to misjudge, which is why we quote a range rather than a single figure.",
      "Cruise departures have hard check-in windows, usually a few hours wide and closing well before the ship sails. We time pickups to land you inside that window with room to spare rather than at the last minute. Tell us your ship and sailing time in the notes when you book and we will work the pickup back from it.",
    ],
    terminals: [
      {
        slug: "cruise-terminal",
        name: "London Cruise Terminal",
        operators: "Ambassador Cruise Line and seasonal calls",
        meetingPoint:
          "Terminal entrance on the quayside, where your driver meets you with a name board.",
      },
    ],
    destinations: [
      {
        label: "The City and Bank",
        postcodes: "EC1, EC2, EC3, EC4",
        miles: 25,
        offPeak: "45–60 mins",
        peak: "60–85 mins",
        corridor: "A13 westbound",
      },
      {
        label: "Canary Wharf and the Docklands",
        postcodes: "E14",
        miles: 22,
        offPeak: "40–55 mins",
        peak: "55–75 mins",
        corridor: "A13 then the Limehouse Link",
      },
      {
        label: "Mayfair and the West End",
        postcodes: "W1J, W1K",
        miles: 28,
        offPeak: "55–70 mins",
        peak: "70–95 mins",
        corridor: "A13 then the Embankment",
      },
      {
        label: "Heathrow Airport",
        postcodes: "TW6",
        miles: 42,
        offPeak: "70–90 mins",
        peak: "90–120 mins",
        corridor: "A13, North Circular then the M4",
      },
      {
        label: "London Southend Airport",
        postcodes: "SS2",
        miles: 22,
        offPeak: "35–50 mins",
        peak: "45–65 mins",
        corridor: "A13 then the A127",
      },
      {
        label: "Stratford and the Olympic Park",
        postcodes: "E15, E20",
        miles: 20,
        offPeak: "35–50 mins",
        peak: "50–70 mins",
        corridor: "A13 then the A12",
      },
    ],
    faqs: [
      {
        question: "How early should I be collected for a cruise from Tilbury?",
        answer:
          "Work back from your check-in window rather than the sailing time — the window usually closes a couple of hours before the ship leaves. From central London we would normally suggest leaving around three hours before your check-in closes, which allows for the A13 and the slow final stretch through Tilbury. Tell us your ship and sailing time and we will pick a time with you.",
      },
      {
        question: "Can you collect us when the ship docks back at Tilbury?",
        answer:
          "Yes, and it is worth booking it in advance. Two thousand passengers disembark at once and cars at the quayside are scarce. Give us the ship and the docking time when you book, and your driver will be waiting at the terminal entrance with a name board.",
      },
      {
        question: "Will our luggage fit? Cruise cases are big.",
        answer:
          "Cruise luggage is the reason to book a size up. A saloon takes two large cases; for a couple with two big cases each, an estate or an MPV is the right choice. Tell us what you are carrying when you book and we will make sure the vehicle fits it.",
      },
      {
        question: "Do you cover the Dartford Crossing charge?",
        answer:
          "Yes. Any toll on your route, including the Dartford Crossing where it applies, is included in the fare you are quoted. You are not asked for anything extra on the day.",
      },
    ],
  },
  {
    slug: "dover",
    name: "Dover",
    fullName: "Port of Dover",
    code: "Dover",
    postcode: "CT17",
    direction: "south-east",
    milesFromCentralLondon: 78,
    summary:
      "The UK's busiest ferry port and a major cruise terminal, about 78 miles south-east of London.",
    intro: [
      "Dover sits at the narrowest point of the Channel, roughly 78 miles south-east of central London, and handles both the ferry crossings to France and two cruise terminals in the Western Docks.",
      "The drive is almost entirely motorway — the A2 and M2, or the M20 through Kent, depending on traffic and where in London you start. It is a long run but a predictable one outside the peaks, and both routes are dual carriageway nearly the whole way.",
      "Dover has two distinct destinations that are easy to confuse: the Eastern Docks for ferries, and the Cruise Terminals in the Western Docks. They are a couple of miles apart with separate approaches, so please tell us which you need. If you are catching a ferry, the check-in deadline rather than the sailing time is what we plan to.",
    ],
    terminals: [
      {
        slug: "cruise-terminal",
        name: "Cruise Terminals 1 and 2",
        operators: "Western Docks, in the former Dover Marine station",
        meetingPoint: "Terminal entrance, with a name board.",
      },
      {
        slug: "ferry-terminal",
        name: "Eastern Docks ferry terminal",
        operators: "P&O Ferries, DFDS and Irish Ferries",
        meetingPoint: "Passenger drop-off area at the terminal building.",
      },
    ],
    destinations: [
      {
        label: "Mayfair and the West End",
        postcodes: "W1J, W1K",
        miles: 79,
        offPeak: "110–140 mins",
        peak: "140–175 mins",
        corridor: "A2 / M2 then the Blackwall Tunnel",
      },
      {
        label: "The City and Bank",
        postcodes: "EC1, EC2, EC3, EC4",
        miles: 77,
        offPeak: "105–135 mins",
        peak: "135–170 mins",
        corridor: "A2 / M2 then the A2 into town",
      },
      {
        label: "Canary Wharf and the Docklands",
        postcodes: "E14",
        miles: 76,
        offPeak: "105–130 mins",
        peak: "130–165 mins",
        corridor: "M2 then the Blackwall Tunnel",
      },
      {
        label: "Heathrow Airport",
        postcodes: "TW6",
        miles: 95,
        offPeak: "130–160 mins",
        peak: "160–200 mins",
        corridor: "M20, M25 then the M4",
      },
      {
        label: "Gatwick Airport",
        postcodes: "RH6",
        miles: 75,
        offPeak: "100–125 mins",
        peak: "125–155 mins",
        corridor: "M20, M25 then the M23",
      },
      {
        label: "Canterbury",
        postcodes: "CT1",
        miles: 17,
        offPeak: "25–35 mins",
        peak: "30–45 mins",
        corridor: "A2 northbound",
      },
    ],
    faqs: [
      {
        question: "Do you go to the cruise terminal or the ferry terminal at Dover?",
        answer:
          "Both, but they are different places and we need to know which. The Cruise Terminals are in the Western Docks; the ferry terminal is in the Eastern Docks, a couple of miles away with its own approach road. Choose the right one when you book, or tell us in the notes.",
      },
      {
        question: "How long does it take to get from London to Dover?",
        answer:
          "Usually between an hour and three quarters and two and a half hours, depending on where in London you start and when you travel. The M2 and M20 both carry the route and both move well outside the peaks; getting out of London is the variable part.",
      },
      {
        question: "Can you collect a group with cruise luggage from Dover?",
        answer:
          "Yes. Cruise cases are large and there are usually several of them, so an MPV or a minibus is often the right call rather than two saloons. Tell us the number of passengers and cases when you book and the vehicle list will only offer classes that genuinely fit.",
      },
      {
        question: "Is the journey to Dover priced as a fixed fare?",
        answer:
          "Yes. Long journeys are quoted the same way as short ones — a fixed price agreed before you travel, including fuel, tolls and the driver's time. It does not rise if the traffic is bad.",
      },
    ],
  },
  {
    slug: "southampton",
    name: "Southampton",
    fullName: "Port of Southampton",
    code: "Southampton",
    postcode: "SO14",
    direction: "south-west",
    milesFromCentralLondon: 80,
    summary:
      "Britain's principal cruise port, with five terminals, about 80 miles south-west of London.",
    intro: [
      "Southampton is the country's main cruise port and the home port for most of the large ships sailing from the UK. It is around 80 miles south-west of central London, straight down the M3.",
      "The port has five cruise terminals spread along the waterfront — Ocean, Mayflower, Queen Elizabeth II, City and Horizon — and they are genuinely separate places with their own gates and approaches. Your cruise line tells you which one you are using, and it is the single most useful thing to have on your booking.",
      "The M3 is a fast road and the run is usually straightforward, but cruise days concentrate thousands of arrivals into a few hours and the port roads back up. We build that into the journey time rather than quoting a clear run and hoping.",
    ],
    terminals: [
      {
        slug: "ocean-terminal",
        name: "Ocean Terminal",
        operators: "Cunard and Princess Cruises",
        meetingPoint: "Terminal entrance, with a name board.",
      },
      {
        slug: "mayflower-terminal",
        name: "Mayflower Terminal",
        operators: "P&O Cruises and others",
        meetingPoint: "Terminal entrance, with a name board.",
      },
      {
        slug: "qeii-terminal",
        name: "Queen Elizabeth II Terminal",
        operators: "P&O Cruises",
        meetingPoint: "Terminal entrance, with a name board.",
      },
      {
        slug: "city-terminal",
        name: "City Cruise Terminal",
        operators: "MSC, Royal Caribbean and others",
        meetingPoint: "Terminal entrance, with a name board.",
      },
      {
        slug: "horizon-terminal",
        name: "Horizon Cruise Terminal",
        operators: "MSC Cruises and others",
        meetingPoint: "Terminal entrance, with a name board.",
      },
    ],
    destinations: [
      {
        label: "Mayfair and the West End",
        postcodes: "W1J, W1K",
        miles: 81,
        offPeak: "105–130 mins",
        peak: "130–165 mins",
        corridor: "M3 then the A316 and Chiswick",
      },
      {
        label: "The City and Bank",
        postcodes: "EC1, EC2, EC3, EC4",
        miles: 84,
        offPeak: "110–140 mins",
        peak: "140–175 mins",
        corridor: "M3 then the A4 and Embankment",
      },
      {
        label: "Kensington and Chelsea",
        postcodes: "SW3, SW7, SW10",
        miles: 78,
        offPeak: "100–125 mins",
        peak: "125–155 mins",
        corridor: "M3 then the A316",
      },
      {
        label: "Heathrow Airport",
        postcodes: "TW6",
        miles: 62,
        offPeak: "75–95 mins",
        peak: "95–125 mins",
        corridor: "M3 then the M25",
      },
      {
        label: "Gatwick Airport",
        postcodes: "RH6",
        miles: 72,
        offPeak: "85–110 mins",
        peak: "110–140 mins",
        corridor: "M27, A27 then the M23",
      },
      {
        label: "Winchester",
        postcodes: "SO23",
        miles: 14,
        offPeak: "20–30 mins",
        peak: "25–40 mins",
        corridor: "M3 northbound",
      },
    ],
    faqs: [
      {
        question: "Which Southampton cruise terminal do I need?",
        answer:
          "Your cruise line's documents name it — Ocean, Mayflower, Queen Elizabeth II, City or Horizon. They are separate buildings along the waterfront with their own entrances, so arriving at the wrong one means a drive across the port on the busiest morning of your year. Put the terminal on your booking and your driver goes straight there.",
      },
      {
        question: "What time should we leave London for a Southampton cruise?",
        answer:
          "Most lines set a check-in window a few hours wide that closes well before sailing. Allow around two hours for the drive itself, then add time for port traffic on a busy embarkation day. Tell us your ship, terminal and check-in time and we will suggest a pickup.",
      },
      {
        question: "Can you meet us when we disembark at Southampton?",
        answer:
          "Yes. Give us the ship and the docking date when you book. Disembarkation is staged over a few hours, so tell us your allocated time if you have one, and your driver will be at the terminal with a name board.",
      },
      {
        question: "Do you carry large parties to Southampton?",
        answer:
          "Yes — group cruise transfers are a regular job. An eight-seat MPV or a sixteen-seat minibus carries a family group with cruise luggage far more comfortably than two cars, and usually costs less. The vehicle list shows what fits once you have entered passengers and cases.",
      },
    ],
  },
  {
    slug: "portsmouth",
    name: "Portsmouth",
    fullName: "Portsmouth International Port",
    code: "Portsmouth",
    postcode: "PO2",
    direction: "south",
    milesFromCentralLondon: 75,
    summary:
      "Ferries to France, Spain and the Channel Islands, plus cruise calls, about 75 miles south of London.",
    intro: [
      "Portsmouth International Port sits on the western side of Portsea Island, about 75 miles south of central London and reached by the A3 or the M3 and M27. It handles ferries to Normandy, Brittany, Bilbao, Santander and the Channel Islands, along with a growing number of cruise calls.",
      "It is a compact port with one main terminal, which makes arrivals simpler than at Southampton. The approach runs through the city itself, so the final couple of miles are urban rather than motorway and worth allowing for.",
      "Ferry check-in closes strictly, and for the longer Spanish sailings it closes a long way before departure. We plan to the check-in deadline on your booking rather than the sailing time, and we would rather have you there early than watch a ship leave.",
    ],
    terminals: [
      {
        slug: "international-port",
        name: "Portsmouth International Port",
        operators: "Brittany Ferries, Condor Ferries and cruise calls",
        meetingPoint: "Terminal building entrance, with a name board.",
      },
    ],
    destinations: [
      {
        label: "Mayfair and the West End",
        postcodes: "W1J, W1K",
        miles: 76,
        offPeak: "100–125 mins",
        peak: "125–160 mins",
        corridor: "A3 then the A3 through Wandsworth",
      },
      {
        label: "The City and Bank",
        postcodes: "EC1, EC2, EC3, EC4",
        miles: 78,
        offPeak: "105–130 mins",
        peak: "130–165 mins",
        corridor: "A3 then London Bridge",
      },
      {
        label: "Kensington and Chelsea",
        postcodes: "SW3, SW7, SW10",
        miles: 74,
        offPeak: "95–120 mins",
        peak: "120–150 mins",
        corridor: "A3 then Wandsworth Bridge",
      },
      {
        label: "Heathrow Airport",
        postcodes: "TW6",
        miles: 66,
        offPeak: "80–100 mins",
        peak: "100–130 mins",
        corridor: "A3 then the M25 and M4",
      },
      {
        label: "Gatwick Airport",
        postcodes: "RH6",
        miles: 62,
        offPeak: "75–95 mins",
        peak: "95–125 mins",
        corridor: "A27 then the M23",
      },
      {
        label: "Southampton",
        postcodes: "SO14",
        miles: 21,
        offPeak: "30–40 mins",
        peak: "40–55 mins",
        corridor: "M27 westbound",
      },
    ],
    faqs: [
      {
        question: "How long before my ferry should I arrive at Portsmouth?",
        answer:
          "It depends on the crossing. Short routes to the Channel Islands close check-in around an hour before; the longer sailings to Spain close several hours before. Your ferry operator states it on your booking, and we plan the pickup to that deadline rather than the departure time.",
      },
      {
        question: "Can you take us to Portsmouth for a cruise as well as a ferry?",
        answer:
          "Yes. Portsmouth takes cruise calls alongside its ferry traffic, and both use the same International Port terminal. Tell us which you are catching so we can time the pickup to the right check-in window.",
      },
      {
        question: "Is Portsmouth quicker to reach than Southampton from London?",
        answer:
          "They are much of a muchness — Portsmouth is slightly nearer in miles but the last stretch is city driving rather than motorway, so journey times come out similar. The table above gives both, with peak and off-peak ranges.",
      },
      {
        question: "Do you collect from Portsmouth Harbour station or the port?",
        answer:
          "Either. They are close together but not the same place: the station serves the Isle of Wight fast ferry and the Gunwharf area, while the International Port is a mile or so north. Say which you need when you book.",
      },
    ],
  },
  {
    slug: "harwich",
    name: "Harwich",
    fullName: "Port of Harwich International",
    code: "Harwich",
    postcode: "CO12",
    direction: "north-east",
    milesFromCentralLondon: 80,
    summary:
      "North Sea ferries to the Netherlands and cruise departures, about 80 miles north-east of London.",
    intro: [
      "Harwich International sits on the Essex coast at the mouth of the Stour, around 80 miles north-east of central London. It is the departure point for the overnight ferry to Hook of Holland and a regular cruise terminal, particularly for northern Europe and Baltic itineraries.",
      "The route from London runs up the A12 through Essex and then the A120 across to the coast. It is dual carriageway most of the way and usually comfortable, though the A12 around Chelmsford and Colchester is the section that slows at peak times.",
      "Harwich sailings are often overnight, which means late pickups from London and early-morning arrivals coming back. Both are ordinary bookings for us — our office is staffed around the clock and there is no surcharge for an unsociable hour.",
    ],
    terminals: [
      {
        slug: "international-port",
        name: "Harwich International Port",
        operators: "Stena Line and cruise operators",
        meetingPoint: "Terminal building entrance, with a name board.",
      },
    ],
    destinations: [
      {
        label: "The City and Bank",
        postcodes: "EC1, EC2, EC3, EC4",
        miles: 79,
        offPeak: "105–130 mins",
        peak: "130–165 mins",
        corridor: "A120 then the A12",
      },
      {
        label: "Mayfair and the West End",
        postcodes: "W1J, W1K",
        miles: 82,
        offPeak: "110–140 mins",
        peak: "140–175 mins",
        corridor: "A120, A12 then the A406",
      },
      {
        label: "Canary Wharf and the Docklands",
        postcodes: "E14",
        miles: 77,
        offPeak: "100–130 mins",
        peak: "130–160 mins",
        corridor: "A120, A12 then Bow",
      },
      {
        label: "Stansted Airport",
        postcodes: "CM24",
        miles: 45,
        offPeak: "55–70 mins",
        peak: "70–90 mins",
        corridor: "A120 westbound",
      },
      {
        label: "Heathrow Airport",
        postcodes: "TW6",
        miles: 100,
        offPeak: "130–165 mins",
        peak: "165–205 mins",
        corridor: "A12, M25 then the M4",
      },
      {
        label: "Colchester",
        postcodes: "CO1",
        miles: 21,
        offPeak: "30–40 mins",
        peak: "35–50 mins",
        corridor: "A120 then the A12",
      },
    ],
    faqs: [
      {
        question: "Can you collect late at night for the overnight Harwich ferry?",
        answer:
          "Yes. The Hook of Holland sailing leaves late in the evening, so a pickup from London in the evening is the normal pattern and we run them regularly. There is no night surcharge — the fare you agree when you book is the fare you pay.",
      },
      {
        question: "What about the early-morning arrival coming back?",
        answer:
          "The same applies. The overnight ferry docks early and there is very little waiting at Harwich at that hour, so booking a car in advance is worth doing. Give us the sailing and we will have a driver at the terminal.",
      },
      {
        question: "How long does the drive from London to Harwich take?",
        answer:
          "Usually around an hour and three quarters to two and a quarter hours. The A12 and A120 carry the route; the A12 around Chelmsford and Colchester is the part that slows at peak times, which the peak figures above account for.",
      },
      {
        question: "Do you serve Harwich Town as well as the International Port?",
        answer:
          "Yes, though they are different places. Harwich International Port is where the ferries and cruise ships dock; Harwich Town is a mile or two away. Say which you need when you book so the driver goes to the right one.",
      },
    ],
  },
] as const;

export function seaportBySlug(slug: string): PlaceGuide | undefined {
  return SEAPORTS.find((port) => port.slug === slug);
}
