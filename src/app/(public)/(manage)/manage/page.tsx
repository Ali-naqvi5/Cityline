import type { Metadata } from "next";

import { LookupForm } from "@/components/manage/lookup-form";
import { Container } from "@/components/ui/container";
import { company, telHref } from "@/lib/company";

/**
 * Manage booking's front door (§5 `/manage/`): for someone without their
 * confirmation email to hand. It never shows a booking — it emails the magic
 * link to the address on the booking, so knowing a reference and guessing an
 * email gets a stranger nowhere.
 */
export const metadata: Metadata = {
  title: "Manage your booking",
  description:
    "View, change or cancel your Cityline booking. No account or password needed.",
  robots: { index: false, follow: true },
};

export default function ManageLookupPage() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="max-w-2xl">
        <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-sm">
          Manage your booking
        </h1>
        <p className="text-body-lg text-on-surface-variant mb-space-md">
          The quickest way in is the link in your confirmation email. If you cannot find
          it, enter your booking reference and the email you booked with, and we will send
          it again.
        </p>
        <p className="text-body-md text-on-surface-variant mb-space-xl">
          No account or password needed. Or call us on{" "}
          <a href={telHref()} className="text-primary tabular-nums hover:underline">
            {company.phone}
          </a>{" "}
          ({company.serviceHours}).
        </p>

        <LookupForm />
      </div>
    </Container>
  );
}
