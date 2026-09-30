import type { Metadata } from "next";

import { SiteHtml } from "@/components/site/site-html";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cityline Airport Transfers — licensed London airport transfers",
    template: "%s · Cityline Airport Transfers",
  },
  description:
    "Fixed-price London airport transfers from a TfL licensed private hire operator. Book direct, with the price agreed before you travel.",
  applicationName: "Cityline Airport Transfers",
  formatDetection: { telephone: true },
};

/**
 * Root layout for the public site: marketing pages, the booking funnel, Manage
 * booking and the coming-soon page. The admin has its own (`app/(payload)`).
 */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <SiteHtml>{children}</SiteHtml>;
}
