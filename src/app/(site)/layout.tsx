import { SiteShell } from "@/components/site/site-shell";

/**
 * Shell for every public page (§5). The booking funnel and manage-booking have
 * their own layouts — the funnel deliberately drops most navigation so nothing
 * competes with finishing the booking.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <SiteShell>{children}</SiteShell>;
}
