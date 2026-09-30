import type { Metadata } from "next";

import { NotFoundContent } from "@/components/site/not-found-content";
import { SiteShell } from "@/components/site/site-shell";

/** A public page that called `notFound()`. See `NotFoundContent`. */
export const metadata: Metadata = {
  title: "Page not found",
  // A 404 must never be indexed; a soft-404 in the index outranks the real page.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <SiteShell>
      <NotFoundContent />
    </SiteShell>
  );
}
