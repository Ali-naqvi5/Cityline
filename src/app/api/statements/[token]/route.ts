import { statementFor } from "@/admin/data/driver-pay";
import { verifyStatementToken } from "@/domain/finance/statement-link";
import { statementPdf } from "@/domain/finance/statement-pdf";
import { payloadClient } from "@/lib/payload";

/**
 * A driver opening their payment statement from the link in their WhatsApp
 * message (Driver Pay). The signed, expiring link is the permission — see
 * `domain/finance/statement-link.ts`. A voided payment's statement is
 * withdrawn; anything else that does not check out is simply not found.
 */
export const dynamic = "force-dynamic";

const gone = () =>
  new Response(
    "This statement is not available. Ask the Cityline office for a new link.",
    {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    },
  );

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const now = new Date();
  const paymentId = verifyStatementToken(token, now);
  if (paymentId === null) return gone();

  const payload = await payloadClient();
  const data = await statementFor(payload, paymentId, { overrideAccess: true }, now);
  if (!data || data.voided) return gone();

  const pdf = await statementPdf(data);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cityline-statement-${data.reference}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}
