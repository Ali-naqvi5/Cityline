import { statementFor } from "@/admin/data/driver-pay";
import { statementPdf } from "@/domain/finance/statement-pdf";
import { staffCan, type StaffIdentity } from "@/domain/staff/permissions";
import { payloadClient } from "@/lib/payload";
import { statementAssets } from "@/lib/statement-assets";
import type { User } from "@/payload-types";

/**
 * A driver payment's statement as a PDF, for staff (Driver Pay). The
 * signed-in person is checked on every request, as the screens do.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = await payloadClient();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user || !staffCan(user as StaffIdentity, "driverPay.view")) {
    return new Response("You do not have access to this statement.", { status: 403 });
  }
  const paymentId = Number(id);
  const data = Number.isInteger(paymentId)
    ? await statementFor(
        payload,
        paymentId,
        { user: user as User, overrideAccess: false },
        new Date(),
      )
    : null;
  if (!data) return new Response("No such payment.", { status: 404 });

  const pdf = await statementPdf(data, await statementAssets());
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cityline-statement-${data.reference}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
