import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/**
 * Shell for every public page (§5). The booking funnel and manage-booking have
 * their own layouts — the funnel deliberately drops most navigation so nothing
 * competes with finishing the booking.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {/* Clears the fixed 96px header — keep in step with `h-24` in SiteHeader. */}
      <div className="flex-1 pt-24">{children}</div>
      <SiteFooter />
    </>
  );
}
