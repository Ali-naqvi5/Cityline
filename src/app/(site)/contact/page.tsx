import {
  AlertTriangle,
  Building2,
  Clock,
  Mail,
  MessageSquare,
  Phone,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FaqList } from "@/components/site/faq-list";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field, fieldControlClasses } from "@/components/ui/field";
import { company, formattedAddress, telHref } from "@/lib/company";
import { policies } from "@/lib/policies";

/**
 * Contact (§5, WEB-05, CMP-07, CMP-08).
 *
 * Two constraints shape this page:
 *
 *   CMP-07 — a person must be reachable during operating hours, so the phone
 *   number is the first thing on the page rather than a form buried at the
 *   bottom.
 *
 *   CMP-08 — the operator licence carries a **no public access** condition.
 *   The address is shown as a registered and operating address only: no map
 *   pin, no opening hours for callers, no "visit us". That is a licence
 *   condition, not a design choice.
 *
 * SEO-07 wants exactly one canonical contact page, which is why "Help" was
 * removed from the navigation — it pointed at a second place to ask the same
 * question.
 *
 * The form does not submit yet: it needs the enquiries table and Turnstile
 * spam protection (WEB-05, S6). It is disabled and says so, rather than
 * silently discarding what somebody types.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Call, email or message Cityline Airport Transfers. Our office is staffed around the clock for bookings, changes and anything that needs a person.",
  alternates: { canonical: "/contact" },
};

const FAQS = [
  {
    question: "What is the quickest way to change a booking?",
    answer:
      "Use the link in your confirmation email, which opens your booking directly. If the pickup is close or the change is complicated, call us instead — a person can see the booking and the driver at the same time.",
  },
  {
    question: "Can I visit your office?",
    answer:
      "No, and it is not a preference. Our private hire operator licence carries a no public access condition, which means the address is a registered and operating address rather than somewhere to call in. Everything is handled by phone, email or through your booking link.",
  },
  {
    question: "I have left something in a vehicle. What should I do?",
    answer:
      "Contact us as soon as you can with your booking reference and a description of the item. We will check with the driver and hold anything found securely. Where a return is arranged, we may charge the cost of getting it back to you.",
  },
  {
    question: "How do I make a complaint?",
    answer: `Email ${company.email} with your booking reference and what went wrong. We aim to acknowledge within two working days and resolve within ten. Telling us promptly helps, because details are easier to establish while the journey is recent.`,
  },
];

export default function ContactPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: company.legalName,
    telephone: company.phone,
    email: company.email,
    url: siteUrl,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${company.address.line1}, ${company.address.line2}`,
      addressLocality: company.address.town,
      postalCode: company.address.postcode,
      addressCountry: "GB",
    },
    areaServed: { "@type": "City", name: "London" },
  };

  return (
    <>
      <section className="bg-surface-container-lowest pt-8 pb-12">
        <Container>
          <Breadcrumbs crumbs={[{ label: "Contact us" }]} siteUrl={siteUrl} />

          <div className="mt-space-lg max-w-2xl">
            <h1 className="text-on-surface mb-4 text-[30px] leading-[1.14] font-semibold tracking-tight text-balance sm:text-[40px]">
              Talk to a person
            </h1>
            <p className="text-body-lg text-on-surface-variant">
              Our office is staffed around the clock. If a flight has moved, a plan has
              changed, or you would simply rather book over the phone, call us.
            </p>
          </div>
        </Container>
      </section>

      <Container className="gap-space-xl flex flex-col py-12">
        {/* --- The three ways to reach us ---------------------------------- */}
        <section aria-labelledby="ways">
          <h2 id="ways" className="sr-only">
            How to reach us
          </h2>

          <ul className="gap-space-md grid sm:grid-cols-3">
            <li className="border-outline-variant rounded-card p-space-lg border">
              <Phone aria-hidden className="text-primary mb-space-sm h-6 w-6" />
              <h3 className="text-title-md mb-1">Call the office</h3>
              <a
                href={telHref()}
                className="text-headline-sm text-primary block tabular-nums hover:underline"
              >
                {company.phone}
              </a>
              <p className="text-body-sm text-on-surface-variant mt-space-sm">
                {company.serviceHours}. Fastest for anything happening today.
              </p>
            </li>

            <li className="border-outline-variant rounded-card p-space-lg border">
              <Mail aria-hidden className="text-primary mb-space-sm h-6 w-6" />
              <h3 className="text-title-md mb-1">Email us</h3>
              <a
                href={`mailto:${company.email}`}
                className="text-body-md text-primary break-words hover:underline"
              >
                {company.email}
              </a>
              <p className="text-body-sm text-on-surface-variant mt-space-sm">
                Best for quotes, accounts and anything with detail. Include your booking
                reference if you have one.
              </p>
            </li>

            <li className="border-outline-variant rounded-card p-space-lg border">
              <MessageSquare aria-hidden className="text-primary mb-space-sm h-6 w-6" />
              <h3 className="text-title-md mb-1">Manage your booking</h3>
              <p className="text-body-md text-on-surface-variant">
                The link in your confirmation email opens your booking directly — no
                account needed.
              </p>
              <p className="text-body-sm text-on-surface-variant mt-space-sm">
                View it, change it or cancel it, and see your driver&rsquo;s details once
                they are assigned.
              </p>
            </li>
          </ul>
        </section>

        <div className="gap-gutter grid lg:grid-cols-12">
          {/* --- Enquiry form ---------------------------------------------- */}
          <section aria-labelledby="enquiry" className="lg:col-span-7">
            <h2 id="enquiry" className="text-headline-md mb-2">
              Send us a message
            </h2>
            <p className="text-body-md text-on-surface-variant mb-space-lg">
              For group quotes, corporate accounts, lost property or anything that is not
              urgent. For a journey you want to book now, the{" "}
              <Link href="/book" className="text-primary hover:underline">
                booking form
              </Link>{" "}
              is quicker.
            </p>

            <p className="border-outline-variant bg-surface-container-low rounded-card p-space-md text-body-sm mb-space-lg flex gap-2.5 border">
              <AlertTriangle
                aria-hidden
                className="text-primary mt-0.5 h-5 w-5 shrink-0"
              />
              <span>
                <strong className="text-on-surface">Not connected yet.</strong> This form
                is disabled until the enquiries inbox and spam protection are in place.
                Please call or email in the meantime — we would rather say so than quietly
                throw your message away.
              </span>
            </p>

            <form className="gap-space-md flex flex-col">
              <fieldset disabled className="gap-space-md m-0 flex flex-col border-0 p-0">
                <div className="gap-space-md grid sm:grid-cols-2">
                  <Field id="contact-name" name="name" label="Your name" required />
                  <Field
                    id="contact-email"
                    name="email"
                    type="email"
                    label="Email address"
                    required
                  />
                </div>

                <div className="gap-space-md grid sm:grid-cols-2">
                  <Field
                    id="contact-phone"
                    name="phone"
                    type="tel"
                    label="Phone number"
                  />
                  <Field
                    id="contact-reference"
                    name="reference"
                    label="Booking reference"
                    placeholder="CL-000000"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="text-label-md text-on-surface mb-1.5 block"
                  >
                    Message
                    <span className="text-error ml-0.5" aria-hidden>
                      *
                    </span>
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={5}
                    maxLength={2000}
                    required
                    className={`${fieldControlClasses} h-auto py-3`}
                  />
                </div>

                <button
                  type="submit"
                  className="bg-primary-container text-on-primary rounded-button text-label-md flex h-12 items-center justify-center px-6 font-semibold disabled:opacity-50"
                >
                  Send message
                </button>
              </fieldset>
            </form>
          </section>

          {/* --- Company details -------------------------------------------- */}
          <aside className="lg:col-span-5">
            <div className="border-outline-variant rounded-card p-space-lg border">
              <h2 className="text-headline-sm mb-space-md">Company details</h2>

              <dl className="gap-space-md text-body-md flex flex-col">
                <div>
                  <dt className="text-body-sm text-on-surface-variant flex items-center gap-1.5">
                    <Building2 aria-hidden className="text-primary h-4 w-4" />
                    Registered name
                  </dt>
                  <dd className="mt-0.5">{company.legalName}</dd>
                </div>

                <div>
                  <dt className="text-body-sm text-on-surface-variant">
                    Registered and operating address
                  </dt>
                  <dd className="mt-0.5">
                    <address className="not-italic">{formattedAddress()}</address>
                    {/*
                      CMP-08: the licence carries a no public access condition.
                      No map, no directions, no opening hours for visitors.
                    */}
                    <p className="text-body-sm text-on-surface-variant mt-1">
                      This is a registered and operating address. Our licence does not
                      permit public access, so please contact us by phone or email rather
                      than calling in.
                    </p>
                  </dd>
                </div>

                <div>
                  <dt className="text-body-sm text-on-surface-variant">Licensing</dt>
                  <dd className="mt-0.5">
                    Licensed by {company.licensingAuthority} as a private hire operator
                    {company.showOperatorLicence ? (
                      <>
                        , licence number{" "}
                        <span className="tabular-nums">
                          {company.operatorLicenceNumber}
                        </span>
                      </>
                    ) : null}
                    .
                  </dd>
                </div>

                <div>
                  <dt className="text-body-sm text-on-surface-variant flex items-center gap-1.5">
                    <Clock aria-hidden className="text-primary h-4 w-4" />
                    Office hours
                  </dt>
                  <dd className="mt-0.5">
                    {company.serviceHours} — including the early-morning and overnight
                    airport runs.
                  </dd>
                </div>
              </dl>

              <div className="border-outline-variant mt-space-lg pt-space-lg border-t">
                <p className="text-body-sm text-on-surface-variant mb-space-md">
                  Free cancellation up to {policies.freeCancellationHours} hours before
                  pickup, and {policies.airportFreeWaitingMinutes} minutes of free waiting
                  at the airport.
                </p>
                <ButtonLink href="/book" className="w-full">
                  Book a transfer
                </ButtonLink>
              </div>
            </div>
          </aside>
        </div>

        <FaqList faqs={FAQS} heading="Before you get in touch" headingId="faqs" />
      </Container>

      <script
        type="application/ld+json"
        // Built from our own data, never from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
