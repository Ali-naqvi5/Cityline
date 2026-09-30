import type { Metadata } from "next";

import { NotFoundContent } from "@/components/site/not-found-content";
import { SiteHtml } from "@/components/site/site-html";
import { SiteShell } from "@/components/site/site-shell";

/**
 * The 404 for a URL that matches no route at all.
 *
 * With two root layouts — the public site's and Payload's — there is no single
 * layout for Next to wrap an unmatched URL in, so Next serves this file on its
 * own (`experimental.globalNotFound` in next.config.ts). It brings its own
 * `<html>` through `SiteHtml` and looks exactly like the public site's 404.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Page not found · Cityline Airport Transfers",
  robots: { index: false, follow: true },
};

export default function GlobalNotFound() {
  return (
    <SiteHtml>
      <SiteShell>
        <NotFoundContent />
      </SiteShell>
    </SiteHtml>
  );
}
