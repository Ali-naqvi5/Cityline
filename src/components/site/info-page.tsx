import { ArrowRight, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { FaqList } from "@/components/site/faq-list";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import type { PlaceFaq } from "@/domain/places/types";
import { company, siteUrl, telHref } from "@/lib/company";

/**
 * Shared frame for the help pages (WEB-03): meeting points, luggage, child
 * seats, cancellation, payment, lost property and the FAQ.
 *
 * These are the pages people open *before* booking to check one thing — will
 * my cases fit, what if my flight is late, can I cancel — and the ones they open
 * *after* booking when something has gone sideways. So each one answers its
 * question in the first screen, then gets out of the way: a short lede, the
 * substance, the FAQs, and a way to book or to reach a person.
 *
 * Every number in the copy comes from `policies`, `VEHICLE_CLASSES` or `EXTRAS`
 * rather than being typed in, for the same reason as the terms: a help page
 * that promises 60 minutes of waiting while the checkout says 45 is a
 * chargeback waiting to happen.
 *
 * The related links are not decoration. They are how a crawler finds these
 * pages from each other, and how a reader who landed on the wrong one finds the
 * right one.
 */
export interface RelatedLink {
  href: string;
  label: string;
}

export function InfoPage({
  title,
  lede,
  crumbs,
  children,
  faqs,
  related,
}: {
  title: string;
  lede: string;
  /** Trail below Home; the current page is added automatically. */
  crumbs?: Crumb[];
  children: ReactNode;
  faqs?: readonly PlaceFaq[];
  related: readonly RelatedLink[];
}) {
  return (
    <Container className="py-10">
      <Breadcrumbs crumbs={[...(crumbs ?? []), { label: title }]} siteUrl={siteUrl()} />

      <header className="mt-space-lg max-w-2xl">
        <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-md">
          {title}
        </h1>
        <p className="text-body-lg text-on-surface-variant">{lede}</p>
      </header>

      <div className="gap-space-xl mt-space-xl flex max-w-3xl flex-col">{children}</div>

      {faqs && faqs.length > 0 ? (
        <div className="mt-16 max-w-3xl">
          <FaqList faqs={faqs} heading="Questions people ask" />
        </div>
      ) : null}

      <div className="gap-gutter mt-16 grid lg:grid-cols-12">
        <nav aria-labelledby="related-heading" className="lg:col-span-7">
          <h2 id="related-heading" className="text-headline-sm mb-space-md">
            Related information
          </h2>
          <ul className="gap-space-sm grid sm:grid-cols-2">
            {related.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="border-outline-variant hover:border-outline hover:bg-surface-container-low rounded-card p-space-md text-body-md group flex items-center justify-between gap-2 border transition-colors"
                >
                  {link.label}
                  <ArrowRight
                    aria-hidden
                    className="text-primary h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <aside className="border-outline-variant bg-surface-container-low rounded-card p-space-lg h-fit border lg:col-span-5">
          <h2 className="text-headline-sm mb-space-sm">Ready to book?</h2>
          <p className="text-body-md text-on-surface-variant mb-space-md">
            See your fixed fare in under a minute. No account needed.
          </p>
          <ButtonLink href="/book">
            Get a price
            <ArrowRight aria-hidden className="h-4 w-4" />
          </ButtonLink>
          <p className="text-body-sm text-on-surface-variant mt-space-md flex items-center gap-1.5">
            <Phone aria-hidden className="h-4 w-4" />
            Or call{" "}
            <a href={telHref()} className="text-primary tabular-nums hover:underline">
              {company.phone}
            </a>
            , {company.serviceHours}.
          </p>
        </aside>
      </div>
    </Container>
  );
}

/** One titled block of prose inside an info page. */
export function InfoSection({
  heading,
  id,
  children,
}: {
  heading: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-heading` : undefined}
      className="scroll-mt-28"
    >
      <h2 id={id ? `${id}-heading` : undefined} className="text-headline-sm mb-space-sm">
        {heading}
      </h2>
      <div className="gap-space-sm text-body-md text-on-surface-variant flex flex-col">
        {children}
      </div>
    </section>
  );
}

/**
 * The help pages link to each other constantly; one list keeps the labels and
 * paths identical everywhere, and makes a renamed page a one-line change.
 */
export const HELP_LINKS = {
  meetingPoints: { href: "/info/meeting-points", label: "Airport meeting points" },
  luggage: { href: "/luggage-guide", label: "Luggage guide" },
  childSeats: { href: "/child-seats", label: "Child seats" },
  cancellation: { href: "/info/cancellation", label: "Cancellations and refunds" },
  payment: { href: "/info/payment", label: "Paying for your journey" },
  lostProperty: { href: "/info/lost-property", label: "Lost property" },
  waiting: { href: "/info/waiting-time", label: "Waiting time" },
  accessibility: { href: "/info/accessibility", label: "Accessibility and assistance" },
  faq: { href: "/faq", label: "Frequently asked questions" },
  fleet: { href: "/fleet", label: "Our fleet" },
  fares: { href: "/fares", label: "Fares" },
  terms: { href: "/terms", label: "Terms and conditions" },
  complaints: { href: "/legal/complaints", label: "Complaints procedure" },
  contact: { href: "/contact", label: "Contact us" },
  airports: { href: "/airports", label: "Airport transfers" },
} as const satisfies Record<string, RelatedLink>;
