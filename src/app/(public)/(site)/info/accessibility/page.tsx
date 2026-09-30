import type { Metadata } from "next";

import { HELP_LINKS, InfoPage, InfoSection } from "@/components/site/info-page";
import { HELP_FAQS } from "@/content/help-faqs";
import { company, telHref } from "@/lib/company";

/**
 * Accessibility and assistance for passengers (WEB-03).
 *
 * About travelling, not about the website: Cityline dropped the website
 * accessibility audit from this build (29 Sep 2026), and an accessibility
 * statement published without one would be a claim with nothing behind it.
 *
 * Two lines it must not cross:
 *
 *   It promises only what the law already requires of every licensed driver
 *   and what Cityline's terms say — carrying disabled passengers, their
 *   mobility aids and assistance dogs, giving reasonable help, and charging
 *   nothing extra for any of it.
 *
 *   It does not imply a wheelchair accessible vehicle is available. The fleet
 *   (`VEHICLE_CLASSES`) has none, and the terms tell customers to call first.
 *
 * The Act behind the duties is not named: its title contains a word CMP-01
 * keeps off every page, and "UK law" says what the reader needs.
 */
export const metadata: Metadata = {
  title: "Accessibility and assistance",
  description:
    "Travelling with a wheelchair, a mobility aid or an assistance dog with Cityline Airport Transfers: what we carry, how your driver can help, and how to arrange it.",
  alternates: { canonical: "/info/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <InfoPage
      title="Accessibility and assistance"
      lede="Tell us what you need when you book and we will arrange it. Mobility aids and assistance dogs travel free, and so does any help from your driver."
      faqs={HELP_FAQS.accessibility}
      related={[
        HELP_LINKS.meetingPoints,
        HELP_LINKS.luggage,
        HELP_LINKS.waiting,
        HELP_LINKS.fleet,
        HELP_LINKS.faq,
        HELP_LINKS.contact,
      ]}
    >
      <InfoSection heading="Assistance dogs">
        <p>
          Assistance dogs travel with their owner in every vehicle we send, always, and at
          no extra charge. You do not need to tell us in advance, though it helps your
          driver to know.
        </p>
      </InfoSection>

      <InfoSection heading="Wheelchairs and mobility aids">
        <p>
          A folding wheelchair, walking frame, rollator or other mobility aid travels
          free. Please mention it in the notes when you book, so we send a vehicle it fits
          in comfortably alongside your luggage — an estate or a people carrier is often
          the right choice.
        </p>
      </InfoSection>

      <InfoSection heading="Travelling in your wheelchair">
        <p>
          Our standard fleet does not include vehicles with a ramp or lift. If you need to
          travel seated in your wheelchair, please call us on{" "}
          <a href={telHref()} className="text-primary tabular-nums hover:underline">
            {company.phone}
          </a>{" "}
          before booking, and we will tell you what we can arrange for your date and time.
        </p>
      </InfoSection>

      <InfoSection heading="Help from your driver">
        <p>
          Your driver will help you to and from the car and with your luggage, and give
          you the time you need. Tell us in the booking notes what would help, so they
          know before they arrive. At the airport, meet and greet means they come into the
          arrivals hall to find you.
        </p>
        <p>
          UK law requires every licensed private hire driver to carry disabled passengers,
          their mobility aids and assistance dogs, and to give reasonable help — without
          charging any more for it. We would do it anyway.
        </p>
      </InfoSection>

      <InfoSection heading="Talk to us">
        <p>
          If you are not sure whether we can help with something, ask before you book.
          Call{" "}
          <a href={telHref()} className="text-primary tabular-nums hover:underline">
            {company.phone}
          </a>{" "}
          ({company.serviceHours}) or email{" "}
          <a href={`mailto:${company.email}`} className="text-primary hover:underline">
            {company.email}
          </a>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
