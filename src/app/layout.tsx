import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { MotionProvider } from "@/components/motion/motion-provider";

import "./globals.css";

/**
 * Inter, per the design system (DESIGN.md "Typography"). Self-hosted by
 * next/font at build time — no runtime request to Google, which keeps the page
 * fast and keeps visitors' IP addresses out of Google's logs (CMP-11).
 *
 * Weights are restricted to the three the design uses: 400 body, 500 labels,
 * 600 headings and prices. 700+ is deliberately absent.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `data-scroll-behavior` tells Next the smooth scrolling in globals.css is
    // deliberate, so it suppresses its console warning — and, more usefully, it
    // turns smooth scrolling off during route transitions, where it otherwise
    // makes a new page appear to slide rather than simply arrive.
    <html
      lang="en-GB"
      data-scroll-behavior="smooth"
      className={`${inter.variable} h-full`}
    >
      <head>
        {/*
          Motion renders its `initial` state into the server HTML, so a reveal
          element ships as opacity:0. If the bundle fails or is blocked, that
          would leave the page blank. This forces anything waiting to animate
          back into view when scripts cannot run.
        */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="flex min-h-full flex-col">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
