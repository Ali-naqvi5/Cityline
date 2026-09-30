import { redirect } from "next/navigation";

/**
 * `/admin` itself. Payload always draws its own frame around this route, so
 * it sends staff straight to the operations dashboard, which has Cityline's.
 * Payload lands here after login, and its logo links here.
 */
export function DashboardRedirect(): never {
  redirect("/admin/dashboard");
}
