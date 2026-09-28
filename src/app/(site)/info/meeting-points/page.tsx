import type { Metadata } from "next";
import Link from "next/link";

import { HELP_LINKS, InfoPage, InfoSection } from "@/components/site/info-page";
import { HELP_FAQS } from "@/content/help-faqs";
import { AIRPORTS } from "@/domain/places/airports";
import { SEAPORTS } from "@/domain/places/seaports";
import type { PlaceGuide } from "@/domain/places/types";
import { company, telHref } from "@/lib/company";
import { policies } from "@/lib/policies";

/**
 * Where the driver waits, terminal by terminal (WEB-03).
 *
 * Built from the `meetingPoint` on each terminal in the place guides, so this
 * page and each airport's own page always name the same spot. A passenger who
 * reads "by the information desk" here and "opposite baggage reclaim" on the
 * Heathrow page will stand in the wrong place and ring the office.
 */
export const metadata: Metadata = {
  title: "Airport and cruise terminal meeting points",
  description: `Where your Cityline driver meets you at every London airport and cruise terminal, with ${policies.airportFreeWaitingMinutes} minutes of free waiting at airports.`,
  alternates: { canonical: "/info/meeting-points" },
};

function Terminals({ place, hub }: { place: PlaceGuide; hub: string }) {
  return (
    <div className="border-outline-variant rounded-card overflow-hidden border">
      <div className="bg-surface-container-low border-outline-variant px-space-lg py-space-md flex items-baseline justify-between gap-4 border-b">
        <h3 className="text-title-md">{place.fullName}</h3>
        <Link
          href={`${hub}/${place.slug}`}
          className="text-label-md text-primary shrink-0 hover:underline"
        >
          {place.name} guide
        </Link>
      </div>
      <dl className="divide-outline-variant divide-y">
        {place.terminals.map((terminal) => (
          <div
            key={terminal.slug}
            className="px-space-lg py-space-md gap-space-xs grid sm:grid-cols-[12rem_1fr] sm:gap-4"
          >
            <dt className="text-body-md text-on-surface font-medium">{terminal.name}</dt>
            <dd className="text-body-md text-on-surface-variant">
              {terminal.meetingPoint}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function MeetingPointsPage() {
  return (
    <InfoPage
      title="Meeting points"
      lede="Your driver meets you inside the arrivals hall, holding a board with your name on it. Here is exactly where they will be standing at every airport and cruise terminal we serve."
      faqs={HELP_FAQS.meetingPoints}
      related={[
        HELP_LINKS.airports,
        HELP_LINKS.luggage,
        HELP_LINKS.childSeats,
        HELP_LINKS.cancellation,
        HELP_LINKS.faq,
        HELP_LINKS.contact,
      ]}
    >
      <InfoSection heading="How meet and greet works">
        <p>
          Meet and greet is included on every airport pickup — there is nothing extra to
          add. Your driver waits in the arrivals hall with a name board showing the name
          of the passenger travelling, and walks you to the car.
        </p>
        <p>
          Give us your flight number when you book. Our team checks your flight&rsquo;s
          arrival time before sending your driver, and your{" "}
          <strong className="text-on-surface">
            {policies.airportFreeWaitingMinutes} minutes of free waiting
          </strong>{" "}
          are counted from when you actually land. That is usually plenty of time to get
          through passport control and collect your bags.
        </p>
        <p>
          Before your pickup we send you your driver&rsquo;s name, their licence number
          and the car&rsquo;s make, colour and registration, so you know exactly who is
          meeting you.
        </p>
      </InfoSection>

      <section aria-labelledby="airports-heading" className="scroll-mt-28" id="airports">
        <h2 id="airports-heading" className="text-headline-sm mb-space-md">
          Airports
        </h2>
        <div className="gap-space-md flex flex-col">
          {AIRPORTS.map((airport) => (
            <Terminals key={airport.slug} place={airport} hub="/airports" />
          ))}
        </div>
      </section>

      <section aria-labelledby="seaports-heading" className="scroll-mt-28" id="seaports">
        <h2 id="seaports-heading" className="text-headline-sm mb-space-sm">
          Cruise terminals
        </h2>
        <p className="text-body-md text-on-surface-variant mb-space-md">
          At a cruise port your driver meets you at the terminal as you come out after
          disembarkation. Cruise lines let passengers off in groups, so if yours gives you
          a disembarkation time, tell us when you book and we will time the pickup to it.
        </p>
        <div className="gap-space-md flex flex-col">
          {SEAPORTS.map((port) => (
            <Terminals key={port.slug} place={port} hub="/seaports" />
          ))}
        </div>
      </section>

      <InfoSection heading="If you cannot find your driver">
        <p>
          Stay where you are and call us on{" "}
          <a href={telHref()} className="text-primary tabular-nums hover:underline">
            {company.phone}
          </a>
          . We will put you through to your driver and tell them exactly where you are.
          Wandering off to look for them is the most common reason two people miss each
          other in a busy arrivals hall.
        </p>
        <p>
          For any other pickup — a hotel, a station or your home — your driver comes to
          the address you gave us, and you have {policies.standardFreeWaitingMinutes}{" "}
          minutes of free waiting from the booked time.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
