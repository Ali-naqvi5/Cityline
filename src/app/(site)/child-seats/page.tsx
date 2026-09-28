import type { Metadata } from "next";

import { HELP_LINKS, InfoPage, InfoSection } from "@/components/site/info-page";
import { HELP_FAQS } from "@/content/help-faqs";
import { formatPence } from "@/domain/money";
import { EXTRAS } from "@/domain/pricing/extras";

/**
 * Child seats (WEB-03, §5 `/child-seats`).
 *
 * The seats and prices are `EXTRAS` — what step 3 of the funnel actually adds
 * to a booking. This page must never say "free" or "complimentary" while the
 * checkout charges for a seat; the designs did exactly that, and the conflict is
 * still open in `extras.ts` for Cityline's price sheet to settle.
 */
const SEATS = EXTRAS.filter((extra) => extra.group === "child-seats");

const cheapest = Math.min(...SEATS.map((seat) => seat.pricePence));

export const metadata: Metadata = {
  title: "Child seats",
  description: `Infant, child and booster seats fitted before your journey, from ${formatPence(cheapest)} per seat. Book them with your transfer so the right seat is waiting.`,
  alternates: { canonical: "/child-seats" },
};

export default function ChildSeatsPage() {
  return (
    <InfoPage
      title="Child seats"
      lede="Add the right seat for each child when you book, and it is fitted in the car before your driver sets off to collect you."
      faqs={HELP_FAQS.childSeats}
      related={[
        HELP_LINKS.luggage,
        HELP_LINKS.fleet,
        HELP_LINKS.meetingPoints,
        HELP_LINKS.fares,
        HELP_LINKS.terms,
        HELP_LINKS.faq,
      ]}
    >
      <section aria-labelledby="seats-heading">
        <h2 id="seats-heading" className="text-headline-sm mb-space-md">
          Which seat, and what it costs
        </h2>

        <ul className="gap-space-md grid sm:grid-cols-3">
          {SEATS.map((seat) => (
            <li
              key={seat.slug}
              className="border-outline-variant rounded-card p-space-lg flex flex-col border"
            >
              <h3 className="text-title-md mb-space-xs">{seat.name}</h3>
              <p className="text-body-md text-on-surface-variant mb-space-md flex-1">
                {seat.description}
              </p>
              <p className="text-title-md text-primary tabular-nums">
                {formatPence(seat.pricePence)}{" "}
                <span className="text-body-sm text-on-surface-variant font-normal">
                  per seat, per journey
                </span>
              </p>
            </li>
          ))}
        </ul>

        <p className="text-body-sm text-on-surface-variant mt-space-sm">
          Up to {Math.max(...SEATS.map((seat) => seat.maxQuantity))} of each type per
          booking. The price is added to your fare before you pay, so there is nothing to
          settle on the day.
        </p>
      </section>

      <InfoSection heading="Choosing the right seat">
        <p>
          Go by your child&rsquo;s weight and height as much as their age — the age ranges
          above are a guide, and a small four-year-old may still be safer in a child seat
          than a booster. If you are unsure, tell us your child&rsquo;s age, height and
          weight in the notes when you book and we will send the right one.
        </p>
      </InfoSection>

      <InfoSection heading="What the law says">
        <p>
          In the UK, children normally have to use a child car seat until they are 12
          years old or 135cm tall, whichever comes first. The rules have some exceptions
          for licensed private hire vehicles, but they exist for when no seat is available
          — not as a reason to travel without one.
        </p>
        <p>
          We recommend booking the right seat for every child who needs one. The full
          rules are on{" "}
          <a
            href="https://www.gov.uk/child-car-seats-the-rules"
            className="text-primary hover:underline"
            rel="noopener"
          >
            GOV.UK
          </a>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
