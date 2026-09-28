import type { Metadata } from "next";
import Link from "next/link";

import { FaqList } from "@/components/site/faq-list";
import { HELP_LINKS, InfoPage } from "@/components/site/info-page";
import { HELP_FAQS } from "@/content/help-faqs";

/**
 * Every help question on one page (WEB-03, §5 `/faq`).
 *
 * The answers are `HELP_FAQS` — the same objects each help page shows — so this
 * page cannot drift from them. Each group links to the page that explains its
 * topic in full, which is also most of this page's internal linking.
 *
 * One `FAQPage` block for the whole page rather than one per group: Google
 * expects a single one, and several on one URL is at best ignored.
 */
export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Answers to common questions about booking a Cityline airport transfer: meeting your driver, luggage, child seats, payment, cancellations and lost property.",
  alternates: { canonical: "/faq" },
};

const GROUPS = [
  { id: "booking", heading: "Booking", faqs: HELP_FAQS.booking, more: null },
  {
    id: "meeting-your-driver",
    heading: "Meeting your driver",
    faqs: HELP_FAQS.meetingPoints,
    more: HELP_LINKS.meetingPoints,
  },
  {
    id: "luggage",
    heading: "Luggage",
    faqs: HELP_FAQS.luggage,
    more: HELP_LINKS.luggage,
  },
  {
    id: "child-seats",
    heading: "Child seats",
    faqs: HELP_FAQS.childSeats,
    more: HELP_LINKS.childSeats,
  },
  {
    id: "payment",
    heading: "Payment",
    faqs: HELP_FAQS.payment,
    more: HELP_LINKS.payment,
  },
  {
    id: "cancellations",
    heading: "Changes and cancellations",
    faqs: HELP_FAQS.cancellation,
    more: HELP_LINKS.cancellation,
  },
  {
    id: "lost-property",
    heading: "Lost property",
    faqs: HELP_FAQS.lostProperty,
    more: HELP_LINKS.lostProperty,
  },
] as const;

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap((group) =>
      group.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    ),
  };

  return (
    <InfoPage
      title="Frequently asked questions"
      lede="Quick answers to what people ask most before and after booking. If yours is not here, call us — a person answers."
      related={[
        HELP_LINKS.meetingPoints,
        HELP_LINKS.luggage,
        HELP_LINKS.childSeats,
        HELP_LINKS.cancellation,
        HELP_LINKS.payment,
        HELP_LINKS.contact,
      ]}
    >
      <nav aria-labelledby="topics-heading">
        <h2 id="topics-heading" className="text-title-md mb-space-sm">
          Topics
        </h2>
        <ul className="text-body-md flex flex-wrap gap-x-5 gap-y-1.5">
          {GROUPS.map((group) => (
            <li key={group.id}>
              <a href={`#${group.id}`} className="text-primary hover:underline">
                {group.heading}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {GROUPS.map((group) => (
        <div key={group.id} id={group.id} className="scroll-mt-28">
          <FaqList
            faqs={group.faqs}
            heading={group.heading}
            headingId={`${group.id}-heading`}
            structuredData={false}
          />
          {group.more ? (
            <p className="text-body-sm mt-space-sm">
              <Link href={group.more.href} className="text-primary hover:underline">
                More about {group.more.label.toLowerCase()}
              </Link>
            </p>
          ) : null}
        </div>
      ))}

      <script
        type="application/ld+json"
        // Built from `HELP_FAQS`, never from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </InfoPage>
  );
}
