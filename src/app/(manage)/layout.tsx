import { SiteShell } from "@/components/site/site-shell";

/**
 * Shell for Manage booking (BK-07). The full site chrome: someone checking
 * their booking may well want the meeting points or the waiting-time page next.
 */
export default function ManageLayout({ children }: LayoutProps<"/">) {
  return <SiteShell>{children}</SiteShell>;
}
