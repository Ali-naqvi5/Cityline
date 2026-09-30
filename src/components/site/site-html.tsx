import { Inter } from "next/font/google";

import { MotionProvider } from "@/components/motion/motion-provider";

import "@/app/globals.css";

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

/**
 * The public site's `<html>` and `<body>`.
 *
 * The public site and the admin each have their own root layout —
 * `app/(public)/layout.tsx` and `app/(payload)/layout.tsx` — because Payload
 * renders its own `<html>`; one root layout around both nested two documents
 * and broke the admin. `app/global-not-found.tsx` has no layout at all, so it
 * uses this too, which keeps the 404 identical to every other public page.
 */
export function SiteHtml({ children }: { children: React.ReactNode }) {
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
      {/* A root document for the App Router, where `<head>` is correct; the
          rule is for the Pages Router's `next/head`. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
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
