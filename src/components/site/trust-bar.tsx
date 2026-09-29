import {
  CalendarCheck,
  CreditCard,
  MessageCircle,
  Phone,
  ShieldCheck,
  Tag,
} from "lucide-react";
import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";
import { company, telHref } from "@/lib/company";
import { policies } from "@/lib/policies";

/**
 * The global trust bar (WEB-04): licensing, the phone, WhatsApp, and how you
 * can pay. A slim, quiet strip rather than a banner — reassurance a visitor
 * notices without it competing with the page.
 *
 * What it deliberately leaves out:
 *   - A review score. There are no reviews yet, and Cityline dropped them from
 *     this build (29 Sep 2026). A score with nothing behind it is exactly what
 *     consumer law now treats as fake.
 *   - The design's "99.4% on-time" and "150,000+ journeys". Unverifiable
 *     claims don't go on the site.
 *   - The operator licence number, hidden at Cityline's request unless
 *     `company.showOperatorLicence` is flipped (see that flag's note on
 *     CMP-09).
 *
 * It sits under the fixed header in the normal page flow and scrolls away,
 * rather than inside the header, so the header's height — and every offset
 * tuned to it — stays as it is.
 *
 * Every figure comes from `policies` and `company`, like everything else that
 * makes a promise.
 */
export function TrustBar() {
  const licence = company.showOperatorLicence
    ? `Licensed by ${company.licensingAuthority} · ${company.operatorLicenceNumber}`
    : `Licensed by ${company.licensingAuthority}`;

  return (
    <div className="bg-surface-container-low border-outline-variant border-b">
      <Container>
        <ul
          aria-label="Why book with Cityline"
          className="text-label-sm text-on-surface-variant flex min-h-9 flex-wrap items-center justify-center gap-x-6 gap-y-1 py-1.5 lg:justify-between"
        >
          <Item icon={<ShieldCheck aria-hidden className="h-4 w-4" />}>{licence}</Item>

          <Item icon={<Tag aria-hidden className="h-4 w-4" />} className="hidden md:flex">
            Fixed fares{policies.cardFeesCharged ? "" : ", no card fees"}
          </Item>

          <Item
            icon={<CalendarCheck aria-hidden className="h-4 w-4" />}
            className="hidden lg:flex"
          >
            Free cancellation up to {policies.freeCancellationHours} hours before pickup
          </Item>

          <Item
            icon={<CreditCard aria-hidden className="h-4 w-4" />}
            className="hidden md:flex"
          >
            {company.paymentMethods}
          </Item>

          {/*
            The header only shows the phone from `xl` up, so below that it lives
            here: tap to call on a phone, which is where it is needed most
            (CMP-07 wants it on every page).
          */}
          <Item
            icon={<Phone aria-hidden className="h-4 w-4" />}
            className="flex xl:hidden"
          >
            <a href={telHref()} className="text-primary font-semibold tabular-nums">
              {company.phone}
            </a>
          </Item>

          {company.whatsapp ? (
            <Item icon={<MessageCircle aria-hidden className="h-4 w-4" />}>
              <a
                href={`https://wa.me/${company.whatsapp.replace(/[^\d]/g, "")}`}
                className="text-primary font-semibold"
                rel="noopener"
              >
                WhatsApp us
              </a>
            </Item>
          ) : null}
        </ul>
      </Container>
    </div>
  );
}

function Item({
  icon,
  children,
  className = "flex",
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <li className={`${className} items-center gap-1.5`}>
      <span className="text-primary">{icon}</span>
      {children}
    </li>
  );
}
