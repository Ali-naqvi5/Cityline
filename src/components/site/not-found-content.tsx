import { Phone, Plane, Ship, Tag, Wrench } from "lucide-react";
import Link from "next/link";

import { QuoteWidget } from "@/components/site/quote-widget";
import { Container } from "@/components/ui/container";
import { company, telHref } from "@/lib/company";

/**
 * The 404 page's content, shared by `app/(public)/not-found.tsx` (a page
 * that calls `notFound()`) and `app/global-not-found.tsx` (a URL that matches
 * nothing).
 *
 * Next renders its own bare-bones 404 without this file, which for a site whose
 * traffic is mostly search is a wasted page: someone arrives from a stale result
 * or a mistyped URL, finds a black-and-white error, and leaves.
 *
 * So this is a signpost rather than an apology. The links are the routes people
 * actually arrive looking for — an airport, a price, a way to reach a human —
 * and the phone number is here because a mistyped URL at 4am is exactly when
 * someone gives up on the website and calls.
 */
const DESTINATIONS = [
  {
    href: "/airports",
    icon: Plane,
    title: "Airport transfers",
    detail: "Heathrow, Gatwick, Stansted, Luton, City and Southend.",
  },
  {
    href: "/fares",
    icon: Tag,
    title: "Fares",
    detail: "What a journey costs, by vehicle, before you book.",
  },
  {
    href: "/services",
    icon: Wrench,
    title: "Services",
    detail: "Airport, seaport, station, hourly hire and more.",
  },
  {
    href: "/seaports",
    icon: Ship,
    title: "Cruise transfers",
    detail: "Southampton, Dover, Tilbury, Harwich and Portsmouth.",
  },
] as const;

export function NotFoundContent() {
  return (
    <Container className="py-16 sm:py-24">
      <div className="gap-gutter grid items-start lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="text-label-sm text-on-surface-variant mb-space-sm tabular-nums">
            404
          </p>

          <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-md">
            We cannot find that page
          </h1>

          <div className="gap-space-md text-body-lg text-on-surface-variant flex max-w-2xl flex-col">
            <p>
              The link may be out of date, or the address may have a typo in it.
              Everything else on the site is where it was.
            </p>
            <p>
              If you were about to book, you can get a price right here. If you already
              have a booking, the link in your confirmation email opens it.
            </p>
          </div>

          <p className="text-body-md text-on-surface-variant mt-space-xl flex items-center gap-1.5">
            <Phone aria-hidden className="h-4 w-4" />
            Or call{" "}
            <a href={telHref()} className="text-primary tabular-nums hover:underline">
              {company.phone}
            </a>{" "}
            — {company.serviceHours}.
          </p>
        </div>

        {/*
         * SEO-08: the quote widget on the 404 too. Someone who followed a stale
         * search result usually still wants the thing they were searching for —
         * a price — and this is the shortest way back to it.
         */}
        <div className="lg:col-span-5">
          <h2 className="sr-only">Get a price</h2>
          <QuoteWidget />
        </div>
      </div>

      <h2 className="text-headline-sm mb-space-lg mt-16">You might be looking for</h2>

      <ul className="gap-gutter grid sm:grid-cols-2">
        {DESTINATIONS.map(({ href, icon: Icon, title, detail }) => (
          <li key={href}>
            <Link
              href={href}
              className="border-outline-variant hover:border-outline hover:bg-surface-container-low rounded-card p-space-lg group flex h-full gap-4 border transition-colors"
            >
              <Icon aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <span className="text-title-md group-hover:text-primary block transition-colors">
                  {title}
                </span>
                <span className="text-body-md text-on-surface-variant">{detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
