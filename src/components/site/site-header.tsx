import Image from "next/image";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { company, telHref } from "@/lib/company";
import { primaryNav } from "@/lib/navigation";

import { MobileNav } from "./mobile-nav";
import { NavDropdown } from "./nav-dropdown";

/**
 * Header, ported from the Stitch exports: fixed, 80px tall, white at 95% with a
 * blur behind it, over a 1200px content box.
 *
 * The operator licence number is deliberately not shown — see
 * `company.showOperatorLicence`.
 */
export function SiteHeader() {
  const nav = [...primaryNav];

  return (
    <header className="bg-surface-container-lowest/95 shadow-header fixed top-0 z-40 w-full backdrop-blur-md">
      <div className="max-w-content gap-space-lg px-gutter mx-auto flex h-24 items-center justify-between">
        <Link
          href="/"
          className="group gap-space-sm flex items-center"
          aria-label="Cityline Airport Transfers, home"
        >
          <Image
            src="/brand/cityline-logo.svg"
            alt=""
            width={708}
            height={531}
            priority
            className="h-21 w-auto transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
          <span className="sr-only">Cityline Airport Transfers</span>
        </Link>

        {/*
          Shown from `lg`, not `md`. With seven items plus the logo, phone and
          "Book now", the row overflowed at 768px — tablets get the same menu
          panel as phones instead.
        */}
        <nav aria-label="Main" className="gap-space-lg hidden items-center lg:flex">
          {nav.map((item) =>
            item.children && item.children.length > 0 ? (
              <NavDropdown key={item.href} item={item} />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="text-label-md text-on-surface-variant hover:text-primary py-space-xs transition-colors"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="gap-space-md flex items-center">
          <div className="hidden flex-col text-right xl:flex">
            <span className="text-label-sm text-on-surface-variant text-[10px] uppercase">
              {company.serviceHours}
            </span>
            <a
              href={telHref()}
              className="text-label-md text-on-surface hover:text-primary font-semibold tabular-nums transition-colors"
            >
              {company.phone}
            </a>
          </div>

          <ButtonLink href="/book" className="hidden sm:inline-flex">
            Book now
          </ButtonLink>

          <MobileNav items={nav} />
        </div>
      </div>
    </header>
  );
}
