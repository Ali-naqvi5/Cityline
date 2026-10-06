import { invoiceFor } from "@/admin/data/supplier-money";
import { invoicePdf } from "@/domain/finance/invoice-pdf";
import { staffCan, type StaffIdentity } from "@/domain/staff/permissions";
import { payloadClient } from "@/lib/payload";
import type { User } from "@/payload-types";

/**
 * A partner invoice as a PDF, for staff (Supplier Money) to download and send
 * themselves. The signed-in person is checked on every request.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const payload = await payloadClient();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user || !staffCan(user as StaffIdentity, "supplierMoney.view")) {
    return new Response("You do not have access to this invoice.", { status: 403 });
  }
  const invoiceId = Number(id);
  const data = Number.isInteger(invoiceId)
    ? await invoiceFor(
        payload,
        invoiceId,
        { user: user as User, overrideAccess: false },
        new Date(),
      )
    : null;
  if (!data) return new Response("No such invoice.", { status: 404 });

  const pdf = await invoicePdf(data);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cityline-invoice-${data.number}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
