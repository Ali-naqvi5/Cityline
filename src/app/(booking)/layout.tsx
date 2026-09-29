import Link from "next/link";

import { SiteHeader } from "@/components/site/site-header";
import { TrustBar } from "@/components/site/trust-bar";
import { Container } from "@/components/ui/container";
import { company, telHref } from "@/lib/company";
import { legalNav } from "@/lib/navigation";

/**
 * Shell for the booking funnel.
 *
 * It keeps the site header, as the designs do, but replaces the full footer
 * with a short one. Once someone has started booking, a four-column link farm
 * is mostly a set of exits — the only things they should need are a phone
 * number and the terms they are agreeing to.
 */
export default function BookingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />

      <div className="flex-1 pt-24">
        {/* WEB-04: under the fixed header, in the page flow, on every page. */}
        <TrustBar />
        {children}
      </div>

      <footer className="border-outline-variant bg-surface-container-low border-t">
        <Container>
          <div className="text-body-sm text-on-surface-variant py-space-lg flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Need help? Call{" "}
              <a href={telHref()} className="text-primary tabular-nums">
                {company.phone}
              </a>{" "}
              — {company.serviceHours}.
            </p>

            <ul className="sm:gap-x-space-lg flex flex-wrap gap-x-4 gap-y-1">
              {legalNav.slice(0, 3).map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-primary transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </footer>
    </>
  );
}
