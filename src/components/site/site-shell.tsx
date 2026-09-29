import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { TrustBar } from "@/components/site/trust-bar";

/**
 * The chrome around every public page: header, trust bar (WEB-04), footer.
 *
 * One component rather than markup in the layout, because the 404 page needs
 * it too and does not get the `(site)` layout — `app/not-found.tsx` sits at the
 * root, and route-group layouts do not wrap it. Without this it rendered as a
 * bare page with no way back into the site.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* Clears the fixed 96px header — keep in step with `h-24` in SiteHeader. */}
      <div className="flex-1 pt-24">
        <TrustBar />
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
