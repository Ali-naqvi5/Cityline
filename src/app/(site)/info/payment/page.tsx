import type { Metadata } from "next";

import { HELP_LINKS, InfoPage, InfoSection } from "@/components/site/info-page";
import { HELP_FAQS } from "@/content/help-faqs";
import { policies } from "@/lib/policies";

/**
 * Paying for a journey (WEB-03, §5 `/info/payment`).
 *
 * Says only what is true of the checkout as built: paid in full by card at
 * booking, through Stripe, fixed, no card fee. It deliberately does not list
 * card brands or wallets — those depend on how the Stripe account is set up
 * (PAY-01), and a page promising Apple Pay that the checkout does not offer is
 * worse than a page that does not mention it.
 */
export const metadata: Metadata = {
  title: "Paying for your journey",
  description:
    "How payment works when you book with Cityline: a fixed fare paid by card when you book, with no card fees, no surge pricing and nothing to pay the driver.",
  alternates: { canonical: "/info/payment" },
};

export default function PaymentInfoPage() {
  return (
    <InfoPage
      title="Paying for your journey"
      lede="Your fare is fixed before you give us any personal details, and paid in full by card when you book. There is nothing to pay the driver."
      faqs={HELP_FAQS.payment}
      related={[
        HELP_LINKS.fares,
        HELP_LINKS.cancellation,
        HELP_LINKS.fleet,
        HELP_LINKS.terms,
        HELP_LINKS.faq,
        HELP_LINKS.contact,
      ]}
    >
      <InfoSection heading="A fixed fare, agreed before you travel">
        <p>
          You see the full price for your journey before you enter a name or an email
          address, and that is the price you pay. It does not rise at night, at weekends,
          on public holidays or when it is busy — we do not use surge pricing.
        </p>
      </InfoSection>

      <InfoSection heading="What the fare includes">
        <p>Everything needed to get you there:</p>
        <ul className="gap-space-xs flex list-disc flex-col pl-5">
          <li>the vehicle, the driver and the fuel</li>
          <li>airport drop-off and parking charges</li>
          <li>the Congestion Charge and ULEZ, where your route passes through them</li>
          <li>any tolls on the route</li>
          {policies.meetAndGreetIncluded ? (
            <li>meet and greet in the arrivals hall on airport pickups</li>
          ) : null}
        </ul>
        <p>
          Anything you add yourself, such as a child seat or extra waiting time, is shown
          separately and added to the total before you pay.
        </p>
      </InfoSection>

      <InfoSection heading="How you pay">
        <p>
          Payment is taken in full by card when you book. Card details are entered
          directly with Stripe, our payment provider, so your full card number never
          reaches us.
        </p>
        {!policies.cardFeesCharged ? (
          <p>
            There is no card fee. Paying by card costs exactly the same as the price you
            were shown.
          </p>
        ) : null}
        <p>
          Your receipt arrives with your confirmation email, together with your booking
          reference.
        </p>
      </InfoSection>

      <InfoSection heading="Refunds">
        <p>
          If you cancel in time, or change a booking to something cheaper, the money goes
          back to the card you paid with. Our cancellations page explains the timings.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
