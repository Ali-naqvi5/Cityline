import type { Metadata } from "next";

import { HELP_LINKS, InfoPage, InfoSection } from "@/components/site/info-page";
import { HELP_FAQS } from "@/content/help-faqs";
import { company, telHref } from "@/lib/company";
import { policies } from "@/lib/policies";

/**
 * Lost property (WEB-03, CMP-05, §5 `/info/lost-property`).
 *
 * WEB-05 wants a lost-property form, which needs the `enquiries` table (§14).
 * Until that exists, reports come by phone or email and this page asks for
 * exactly what the office needs to find an item, so the first message is
 * usually the only one.
 */
export const metadata: Metadata = {
  title: "Lost property",
  description:
    "Left something in a Cityline vehicle? How to report it, what we need from you, and how we get it back to you.",
  alternates: { canonical: "/info/lost-property" },
};

export default function LostPropertyPage() {
  return (
    <InfoPage
      title="Lost property"
      lede="Left something in one of our vehicles? Tell us as soon as you can and we will check with your driver straight away."
      faqs={HELP_FAQS.lostProperty}
      related={[
        HELP_LINKS.contact,
        HELP_LINKS.complaints,
        HELP_LINKS.meetingPoints,
        HELP_LINKS.terms,
        HELP_LINKS.faq,
        HELP_LINKS.cancellation,
      ]}
    >
      <InfoSection heading="How to report it">
        <p>
          Call us on{" "}
          <a href={telHref()} className="text-primary tabular-nums hover:underline">
            {company.phone}
          </a>{" "}
          or email{" "}
          <a href={`mailto:${company.email}`} className="text-primary hover:underline">
            {company.email}
          </a>{" "}
          ({company.serviceHours}). The sooner we know, the more likely we are to find it.
        </p>
        <p>To find it quickly, we need:</p>
        <ul className="gap-space-xs flex list-disc flex-col pl-5">
          <li>your booking reference, which starts CL-</li>
          <li>the date and time of the journey</li>
          <li>
            a description of the item, and where in the vehicle you think you left it
          </li>
          <li>the best number to reach you on</li>
        </ul>
      </InfoSection>

      <InfoSection heading="What happens next">
        <p>
          We check with your driver and the vehicle, and let you know what we find.
          Anything found is held securely while we arrange to get it back to you.
        </p>
        <p>
          Our office is not open to the public, so items are returned to you rather than
          collected. If returning it carries a cost, we tell you before arranging
          anything.
        </p>
      </InfoSection>

      <InfoSection heading="Our records">
        <p>
          As a licensed operator we keep a record of every lost-property report for{" "}
          {policies.recordRetentionMonths} months, so an item can still be traced after
          the journey.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
