import { redirect } from "next/navigation";
import type { AdminViewServerProps } from "payload";

import { requireStaff } from "@/admin/guard";
import { DeniedPage } from "@/components/ops/states";

/**
 * `/admin/jobs` was the register before the bookings dashboard replaced it
 * (2 Oct 2026), and `/admin/dispatch` the board Bookings took over (9 Oct
 * 2026). Old links and bookmarks land on Bookings with their filters carried
 * over. Single jobs keep their `/admin/jobs/:id` addresses.
 */
export function JobsRedirect(props: AdminViewServerProps) {
  const context = requireStaff(props, "jobs.view", "/admin/bookings");
  if (context.denied) return <DeniedPage reason={context.reason} />;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(props.searchParams ?? {})) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first !== "string" || !first) continue;
    if (key === "unassigned") query.set("status", "unassigned");
    else if (key === "date") {
      query.set("when", "range");
      query.set("from", first);
      query.set("to", first);
    } else if (key === "when" && first === "date") continue;
    else if (key !== "view") query.set(key, first);
  }
  if (props.searchParams?.view === "week") query.set("when", "week");
  const search = query.toString();
  redirect(`/admin/bookings${search ? `?${search}` : ""}`);
}
