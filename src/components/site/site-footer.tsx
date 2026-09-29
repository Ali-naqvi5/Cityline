import Link from "next/link";

import { company, formattedAddress, telHref } from "@/lib/company";
import {
  airportsNav,
  companyNav,
  helpNav,
  legalNav,
  primaryNav,
  seaportsNav,
} from "@/lib/navigation";

/**
 * Footer, ported from the Stitch exports (four link columns over a legal bar).
 *
 * The legal bar is rebuilt rather than copied. The design showed
 * "TfL PH Operator Lic. #008942/01" for "Cityline Transfers Ltd" — both
 * invented. The legal name is Cityline Airport Transfers Limited (§1), and the
 * licence number is not displayed at Cityline's instruction
 * (`company.showOperatorLicence`).
 *
 * CMP-08 means the address is labelled as a registered address with no
 * invitation to visit.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  // The header no longer carries a top-level Airports menu, so the footer
  // reads the lists directly rather than digging them out of it.
  const services = primaryNav.find((item) => item.href === "/services")?.children ?? [];

  const columns = [
    { heading: "Airports", items: [...airportsNav] },
    { heading: "Seaports", items: [...seaportsNav] },
    { heading: "Services", items: services },
    { heading: "Help and support", items: [...helpNav] },
    { heading: "Company and legal", items: [...companyNav, ...legalNav] },
  ];

  return (
    <footer className="bg-surface-container-low border-outline-variant mt-space-xl border-t">
      <div className="max-w-content px-gutter mx-auto py-12">
        <div className="gap-space-xl grid sm:grid-cols-2 lg:grid-cols-5">
          {columns.map((column) => (
            <nav key={column.heading} aria-labelledby={`footer-${column.heading}`}>
              <h2
                id={`footer-${column.heading}`}
                className="text-label-sm text-on-surface-variant mb-space-md uppercase"
              >
                {column.heading}
              </h2>
              <ul className="flex flex-col gap-2.5">
                {column.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-body-sm text-on-surface-variant hover:text-primary transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      {/* Legal bar — CMP-09 */}
      <div className="border-outline-variant border-t">
        <div className="max-w-content px-gutter py-space-lg mx-auto">
          <address className="text-body-sm text-on-surface-variant sm:gap-x-space-lg flex flex-col gap-1 not-italic sm:flex-row sm:flex-wrap">
            <a href={telHref()} className="tabular-nums">
              {company.phone}
            </a>
            <a href={`mailto:${company.email}`}>{company.email}</a>
            <span>{formattedAddress()} — registered address, no public access</span>
          </address>

          <div className="text-body-sm text-on-surface-variant mt-space-md space-y-1">
            <p>
              {company.legalName} is licensed by {company.licensingAuthority} as a private
              hire operator
              {company.showOperatorLicence ? (
                <>
                  , licence number{" "}
                  <span className="tabular-nums">{company.operatorLicenceNumber}</span>
                </>
              ) : null}
              . Every booking is made with {company.legalName} as the licensed operator.
            </p>
            {company.companyNumber || company.vatNumber ? (
              <p>
                {company.companyNumber
                  ? `Registered in England and Wales, company number ${company.companyNumber}.`
                  : null}
                {company.vatNumber
                  ? ` VAT registration number ${company.vatNumber}.`
                  : null}
              </p>
            ) : null}
            <p>
              © {year} {company.legalName}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
