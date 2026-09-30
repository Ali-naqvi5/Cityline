import { connection } from "next/server";

import { SiteShell } from "@/components/site/site-shell";

/**
 * Shell for Manage booking (BK-07). The full site chrome: someone checking
 * their booking may well want the meeting points or the waiting-time page next.
 *
 * Renders per request, as the nonce in its Content Security Policy requires —
 * see the booking layout and src/lib/csp.ts.
 */
export default async function ManageLayout({ children }: LayoutProps<"/">) {
  await connection();

  return <SiteShell>{children}</SiteShell>;
}
