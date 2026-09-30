import type { Metadata } from "next";

import { HELP_LINKS, InfoPage, InfoSection } from "@/components/site/info-page";
import { HELP_FAQS } from "@/content/help-faqs";
import { formatPence } from "@/domain/money";
import { EXTRAS } from "@/domain/pricing/extras";
import { company, telHref } from "@/lib/company";
import { policies } from "@/lib/policies";

/**
 * Waiting time (WEB-03).
 *
 * A plain-English version of the terms' waiting clause. Every figure is
 * `policies` or the extras catalogue, so this page, the terms, the booking
 * summary and the meeting-points page can never disagree about how long the
 * driver waits or what extra time costs.
 *
 * Careful wording about flights: the office checks arrival times before
 * dispatch, by hand. There is no automatic flight tracking and the page does
 * not imply there is (`domain/compliance/unsupported-claims.ts` enforces it).
 */
const extraWaiting = EXTRAS.find((extra) => extra.slug === "extra-waiting");

export const metadata: Metadata = {
  title: "Waiting time",
  description: `Airport pickups include ${policies.airportFreeWaitingMinutes} minutes of free waiting from when your flight lands; every other pickup includes ${policies.standardFreeWaitingMinutes} minutes. How waiting works and what extra time costs.`,
  alternates: { canonical: "/info/waiting-time" },
};

export default function WaitingTimePage() {
  return (
    <InfoPage
      title="Waiting time"
      lede={`Airport pickups include ${policies.airportFreeWaitingMinutes} minutes of free waiting, counted from when your flight lands. Every other pickup includes ${policies.standardFreeWaitingMinutes} minutes from the booked time.`}
      faqs={HELP_FAQS.waiting}
      related={[
        HELP_LINKS.meetingPoints,
        HELP_LINKS.cancellation,
        HELP_LINKS.payment,
        HELP_LINKS.terms,
        HELP_LINKS.faq,
        HELP_LINKS.contact,
      ]}
    >
      <InfoSection heading="At the airport">
        <p>
          Your{" "}
          <strong className="text-on-surface">
            {policies.airportFreeWaitingMinutes} minutes of free waiting
          </strong>{" "}
          start when your flight actually lands, not at the time you booked. That is
          usually enough to get through passport control, collect your bags and walk out
          to the arrivals hall, where your driver is waiting with your name.
        </p>
        <p>
          Give us your flight number when you book. Our team checks your flight&rsquo;s
          arrival time before sending your driver, so a delayed flight does not eat into
          your waiting time.
        </p>
      </InfoSection>

      <InfoSection heading="Everywhere else">
        <p>
          For a pickup from a station, a hotel, a cruise terminal or your home, your
          driver waits{" "}
          <strong className="text-on-surface">
            {policies.standardFreeWaitingMinutes} minutes
          </strong>{" "}
          from the booked time. Please be ready at the door when the car arrives.
        </p>
      </InfoSection>

      <InfoSection heading="If you need longer">
        {extraWaiting ? (
          <p>
            If you expect to be held up — a busy immigration hall, a tight connection —
            add extra waiting time when you book, in 30-minute blocks at{" "}
            {formatPence(extraWaiting.pricePence)} each. It is added to your fare before
            you pay, so there is nothing to settle on the day.
          </p>
        ) : null}
        <p>
          If you find out on the day that you will be late, call us on{" "}
          <a href={telHref()} className="text-primary tabular-nums hover:underline">
            {company.phone}
          </a>
          . We would much rather hold the car than have you come out to find it gone.
        </p>
      </InfoSection>

      <InfoSection heading="If we cannot find you">
        <p>
          Your driver waits for the free waiting time and we try to reach you on the
          number you gave us. If we still cannot find you, the booking may be treated as a
          no-show and charged in full — which is why the mobile number on your booking
          matters. Please give us one you will have with you and switched on.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
