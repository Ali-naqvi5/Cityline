import "server-only";

import { env } from "@/env";

/**
 * Sending email through Nuntly (NOT-01, NOT-03).
 *
 * The REST endpoint directly, not the SDK: one POST is all this needs, and a
 * dependency for it would be one more thing to keep patched.
 *
 * Two rules live here so no caller can forget them:
 *
 *   Every send carries an **idempotency key**. The webhook and the customer's
 *   browser both finish a booking, sometimes at the same moment, and both ask
 *   for the confirmation email; Nuntly replays the first response for the same
 *   key (kept 24 hours) instead of sending twice.
 *
 *   **Customer emails are redirected to the office until launch** (PRD-04),
 *   unless `CUSTOMER_EMAILS=live`. The redirected copy says who it was for, so
 *   staff can check exactly what a customer would have received. It also keeps
 *   test bookings made with made-up addresses from bouncing, which would count
 *   against the sending domain's reputation before a single real email goes out.
 */

const ENDPOINT = "https://api.nuntly.com/emails";
const DEFAULT_FROM = "Cityline Airport Transfers <bookings@citylineairporttransfers.com>";

export interface EmailAttachment {
  filename: string;
  contentType: string;
  /** Raw content; encoded to base64 here. */
  content: string | Buffer;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Unique per logical message, e.g. `booking-confirmation:CL-7K4Q2P`. */
  idempotencyKey: string;
  /** `customer` mail is held to staff until launch; `staff` mail always goes. */
  audience: "customer" | "staff";
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export type SendResult =
  { sent: true; id: string; redirectedFrom?: string } | { sent: false; reason: string };

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const config = env();

  if (!config.NUNTLY_API_KEY) return { sent: false, reason: "NUNTLY_API_KEY is not set" };

  let to = email.to;
  let subject = email.subject;
  let redirectedFrom: string | undefined;

  if (email.audience === "customer" && config.CUSTOMER_EMAILS !== "live") {
    if (!config.OFFICE_ALERT_EMAIL) {
      return {
        sent: false,
        reason: "customer email held (staff-only) and no office address set",
      };
    }
    redirectedFrom = email.to;
    to = config.OFFICE_ALERT_EMAIL;
    subject = `[For ${email.to}] ${email.subject}`;
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.NUNTLY_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": email.idempotencyKey,
    },
    body: JSON.stringify({
      from: config.MAIL_FROM || DEFAULT_FROM,
      to,
      subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      ...(email.attachments?.length
        ? {
            attachments: email.attachments.map((file) => ({
              filename: file.filename,
              contentType: file.contentType,
              content: Buffer.from(file.content).toString("base64"),
            })),
          }
        : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await response.json().catch(() => null)) as {
    data?: { id?: string };
    error?: { title?: string; code?: string };
  } | null;

  if (!response.ok || !body?.data?.id) {
    const reason = body?.error?.title ?? `HTTP ${response.status}`;
    return { sent: false, reason };
  }

  return { sent: true, id: body.data.id, ...(redirectedFrom ? { redirectedFrom } : {}) };
}
