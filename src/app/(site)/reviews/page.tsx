import { ExternalLink, Mail } from "lucide-react";
import type { Metadata } from "next";

import { HELP_LINKS, InfoPage, InfoSection } from "@/components/site/info-page";
import { company, reviewProfileLinks } from "@/lib/company";

/**
 * Reviews (WEB-06, §5 `/reviews`).
 *
 * WEB-06 says *genuine* Google and Trustpilot reviews, and it means it: since
 * April 2025 the Digital Markets, Competition and Consumers Act lists fake
 * reviews among the practices banned outright. So this page shows nothing it
 * did not get from those platforms. Until Cityline's
 * profiles exist it says so plainly — and it stays out of the index and the
 * sitemap, because an empty reviews page is exactly the thin page SEO-01 is
 * there to keep out of search results.
 */
const profiles = reviewProfileLinks();

export const metadata: Metadata = {
  title: "Reviews",
  description:
    "Reviews of Cityline Airport Transfers from Google and Trustpilot, as passengers wrote them.",
  alternates: { canonical: "/reviews" },
  robots: profiles.length > 0 ? undefined : { index: false, follow: true },
};

export default function ReviewsPage() {
  return (
    <InfoPage
      title="Reviews"
      lede="Reviews on this page come directly from Google and Trustpilot, as passengers wrote them. We never write or pay for reviews."
      related={[
        HELP_LINKS.airports,
        HELP_LINKS.fleet,
        HELP_LINKS.fares,
        HELP_LINKS.complaints,
        HELP_LINKS.faq,
        HELP_LINKS.contact,
      ]}
    >
      {profiles.length > 0 ? (
        <InfoSection heading="Read or leave a review">
          <p>
            Our reviews are published on these independent sites. If you have travelled
            with us, we would value yours — good or bad.
          </p>
          <ul className="gap-space-sm mt-space-xs flex flex-wrap">
            {profiles.map((profile) => (
              <li key={profile.name}>
                <a
                  href={profile.href}
                  rel="noopener"
                  className="border-outline-variant hover:border-outline hover:bg-surface-container-low rounded-button text-label-md text-on-surface inline-flex h-11 items-center gap-2 border px-5 font-semibold transition-colors"
                >
                  Cityline on {profile.name}
                  <ExternalLink aria-hidden className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        </InfoSection>
      ) : (
        <InfoSection heading="Reviews are on their way">
          <p>
            Booking directly through this website is new, and our Google and Trustpilot
            reviews are not connected to it yet. Once they are, the reviews passengers
            leave there will appear here, unedited.
          </p>
          <p>
            If you have travelled with us in the meantime, we would genuinely like to hear
            how it went.
          </p>
          <p>
            <a
              href={`mailto:${company.email}?subject=${encodeURIComponent("Feedback on my journey")}`}
              className="text-primary inline-flex items-center gap-1.5 hover:underline"
            >
              <Mail aria-hidden className="h-4 w-4" />
              Email {company.email}
            </a>
          </p>
        </InfoSection>
      )}

      <InfoSection heading="If something went wrong">
        <p>
          Please tell us directly as well. A review helps the next passenger decide; a
          complaint lets us put things right for you. Our complaints procedure explains
          what happens and how long it takes.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
