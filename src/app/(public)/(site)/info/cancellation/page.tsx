import type { Metadata } from "next";

import { HELP_LINKS, InfoPage, InfoSection } from "@/components/site/info-page";
import { HELP_FAQS } from "@/content/help-faqs";
import { company, telHref } from "@/lib/company";
import { policies } from "@/lib/policies";

/**
 * Cancellations and refunds (WEB-03, §5 `/info/cancellation`).
 *
 * A plain-English version of the terms' cancellation clause, not a second
 * policy. Every figure is `policies`, so if Cityline changes the window to 48
 * hours this page, the terms, step 4 and the confirmation screen all move
 * together.
 */
export const metadata: Metadata = {
  title: "Cancellations and refunds",
  description: `Cancel free of charge up to ${policies.freeCancellationHours} hours before pickup for a ${policies.freeCancellationRefundPercent}% refund. How to cancel or change a Cityline booking, and when the money comes back.`,
  alternates: { canonical: "/info/cancellation" },
};

/**
 * The latest free cancellation for a Friday 09:00 pickup, e.g. "09:00 on
 * Thursday". Computed, so the example stays right if the window changes.
 *
 * Worked in UTC on a fixed winter Friday: this is arithmetic on an example, not
 * a real booking, and a clock change inside the window would only confuse it.
 */
function latestFreeCancellation(hours: number): string {
  const pickup = Date.UTC(2027, 0, 15, 9, 0); // Friday 15 January 2027, 09:00
  const deadline = new Date(pickup - hours * 3_600_000);

  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(deadline);

  return `${format({ hour: "2-digit", minute: "2-digit" })} on ${format({ weekday: "long" })}`;
}

export default function CancellationPage() {
  const hours = policies.freeCancellationHours;

  return (
    <InfoPage
      title="Cancellations and refunds"
      lede={`Cancel free of charge up to ${hours} hours before your pickup time, and you get a ${policies.freeCancellationRefundPercent}% refund back to the card you paid with.`}
      faqs={HELP_FAQS.cancellation}
      related={[
        HELP_LINKS.payment,
        HELP_LINKS.terms,
        HELP_LINKS.meetingPoints,
        HELP_LINKS.complaints,
        HELP_LINKS.faq,
        HELP_LINKS.contact,
      ]}
    >
      <InfoSection heading="Free cancellation">
        <p>
          You can cancel any booking free of charge up to{" "}
          <strong className="text-on-surface">{hours} hours</strong> before the pickup
          time. For a pickup at 09:00 on a Friday, that means cancelling by{" "}
          {latestFreeCancellation(hours)}.
        </p>
        <p>
          The refund is {policies.freeCancellationRefundPercent}% of what you paid, and it
          goes back to the card you paid with. There is no cancellation fee.
        </p>
      </InfoSection>

      <InfoSection heading={`Cancelling within ${hours} hours`}>
        <p>
          Inside that window, a cancellation may not be refunded, because by then the
          vehicle and driver are committed to your journey.
        </p>
        <p>
          If your plans have changed because the airline cancelled your flight, contact us
          whatever the timing and we will either move the booking or refund it.
        </p>
      </InfoSection>

      <InfoSection heading="How to cancel or change a booking">
        <p>
          Use the link in your confirmation email to view, change or cancel your booking —
          no account or password needed. You can also call us on{" "}
          <a href={telHref()} className="text-primary tabular-nums hover:underline">
            {company.phone}
          </a>{" "}
          or email{" "}
          <a href={`mailto:${company.email}`} className="text-primary hover:underline">
            {company.email}
          </a>{" "}
          with your booking reference.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
