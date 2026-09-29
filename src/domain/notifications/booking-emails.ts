import { formatPence } from "@/domain/money";
import { company } from "@/lib/company";
import { policies } from "@/lib/policies";
import { formatDate, formatTime } from "@/lib/time";

/**
 * The booking emails, as pure functions of the booking (NOT-01, NOT-03).
 *
 * Pure so they are tested, and so the confirmation can be re-sent later with
 * identical content. Every value that came from a customer — names, addresses,
 * notes — is HTML-escaped: an address containing `<a href=…>` must arrive as
 * text, not as a link in someone's inbox.
 *
 * Built for email clients, not browsers: a single 600px column, inline styles,
 * a system font stack, and a plain-text part that says everything the HTML
 * does. Outlook ignores most modern CSS, and some people read mail as text.
 */

export interface EmailLeg {
  leg: "outbound" | "return";
  pickupAt: Date;
  pickup: string;
  dropoff: string | null;
  via: string[];
  hours: number | null;
  flightNumber: string | null;
  vehicleName: string;
  passengers: number;
  largeBags: number;
  nameBoard: string;
}

export interface BookingEmailData {
  reference: string;
  totalPence: number;
  isTest: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** Absolute magic link into Manage booking (BK-07). */
  manageUrl: string;
  /** Absolute link to the booking in the admin, for the office alert. */
  adminUrl: string;
  legs: EmailLeg[];
  extras: { name: string; quantity: number }[];
  notes: string | null;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const GREEN = "#0e6b39";
const TEXT = "#121e18";
const MUTED = "#3f4940";
const LINE = "#bfc9bd";

function when(leg: EmailLeg): string {
  return `${formatDate(leg.pickupAt)} at ${formatTime(leg.pickupAt)}`;
}

function legTitle(leg: EmailLeg, legs: EmailLeg[]): string {
  if (legs.length < 2) return "Your journey";
  return leg.leg === "return" ? "Return journey" : "Outbound journey";
}

function destination(leg: EmailLeg): string {
  return leg.dropoff ?? `Hourly hire, ${leg.hours ?? 0} hours`;
}

/** Shared frame: header, body, footer. `body` is trusted, already-escaped HTML. */
function frame(preheader: string, body: string): string {
  return `<!doctype html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(company.tradingName)}</title></head>
<body style="margin:0;padding:0;background:#effdf2;">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#effdf2;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;">
<tr><td style="padding:24px 28px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:18px;font-weight:700;color:${GREEN};">${escapeHtml(company.tradingName)}</td></tr>
<tr><td style="padding:24px 28px;font-family:${FONT};font-size:15px;line-height:1.55;color:${TEXT};">${body}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid ${LINE};font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};">
${escapeHtml(company.legalName)}, licensed by ${escapeHtml(company.licensingAuthority)} as a private hire operator.<br>
Questions? Call ${escapeHtml(company.phone)} (${escapeHtml(company.serviceHours)}) or reply to this email.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function legHtml(leg: EmailLeg, legs: EmailLeg[]): string {
  const rows: [string, string][] = [
    ["Pickup", `${when(leg)}<br>${escapeHtml(leg.pickup)}`],
    ...leg.via.map((stop, index): [string, string] => [
      `Stop ${index + 1}`,
      escapeHtml(stop),
    ]),
    [leg.dropoff ? "Drop-off" : "Booked for", escapeHtml(destination(leg))],
    ["Vehicle", escapeHtml(leg.vehicleName)],
    [
      "Passengers",
      `${leg.passengers}, with ${leg.largeBags} large ${leg.largeBags === 1 ? "case" : "cases"}`,
    ],
    ["Name board", escapeHtml(leg.nameBoard)],
    ...(leg.flightNumber
      ? [["Flight", escapeHtml(leg.flightNumber)] as [string, string]]
      : []),
  ];

  return `<h2 style="margin:24px 0 8px;font-size:16px;color:${TEXT};">${legTitle(leg, legs)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:8px;">
${rows
  .map(
    ([label, value]) =>
      `<tr><td style="padding:8px 12px;width:34%;vertical-align:top;color:${MUTED};font-size:13px;">${label}</td><td style="padding:8px 12px;vertical-align:top;">${value}</td></tr>`,
  )
  .join("\n")}
</table>`;
}

function legText(leg: EmailLeg, legs: EmailLeg[]): string {
  return [
    legTitle(leg, legs).toUpperCase(),
    `Pickup: ${when(leg)}, ${leg.pickup}`,
    ...leg.via.map((stop, index) => `Stop ${index + 1}: ${stop}`),
    `${leg.dropoff ? "Drop-off" : "Booked for"}: ${destination(leg)}`,
    `Vehicle: ${leg.vehicleName}`,
    `Passengers: ${leg.passengers}, with ${leg.largeBags} large ${leg.largeBags === 1 ? "case" : "cases"}`,
    `Name board: ${leg.nameBoard}`,
    ...(leg.flightNumber ? [`Flight: ${leg.flightNumber}`] : []),
  ].join("\n");
}

/** The customer's confirmation, with the calendar file attached by the caller. */
export function confirmationEmail(data: BookingEmailData): BuiltEmail {
  const first = data.legs[0];
  const subject = `Booking confirmed: ${data.reference}${first ? ` · ${formatDate(first.pickupAt)}` : ""}`;

  const extrasLine = data.extras.length
    ? data.extras.map((extra) => `${extra.quantity} × ${extra.name}`).join(", ")
    : null;

  const html = frame(
    `Your car is booked. Reference ${data.reference}.`,
    `<p style="margin:0 0 12px;font-size:20px;font-weight:700;">Your car is booked</p>
<p style="margin:0 0 16px;">Thank you, ${escapeHtml(data.customerName)}. Your fare is fixed and paid, so there is nothing to settle with the driver.</p>
<p style="margin:0 0 4px;color:${MUTED};font-size:13px;">Your booking reference</p>
<p style="margin:0 0 20px;font-size:24px;font-weight:700;letter-spacing:1px;color:${GREEN};">${escapeHtml(data.reference)}</p>
${data.legs.map((leg) => legHtml(leg, data.legs)).join("\n")}
${extrasLine ? `<p style="margin:16px 0 0;"><strong>Extras:</strong> ${escapeHtml(extrasLine)}</p>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid ${LINE};">
<tr><td style="padding:12px 0;font-weight:700;">Total paid</td><td align="right" style="padding:12px 0;font-weight:700;font-size:18px;color:${GREEN};">${formatPence(data.totalPence)}</td></tr>
</table>
<p style="margin:20px 0 8px;"><a href="${escapeHtml(data.manageUrl)}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;">View or change your booking</a></p>
<p style="margin:16px 0 0;color:${MUTED};font-size:13px;">Before your pickup we send you your driver's name, licence number and the car's registration. Cancel free of charge up to ${policies.freeCancellationHours} hours before pickup. The attached calendar file adds the journey to your calendar.</p>`,
  );

  const text = [
    `Your car is booked`,
    ``,
    `Thank you, ${data.customerName}. Your fare is fixed and paid, so there is nothing to settle with the driver.`,
    ``,
    `Booking reference: ${data.reference}`,
    ``,
    ...data.legs.map((leg) => `${legText(leg, data.legs)}\n`),
    ...(extrasLine ? [`Extras: ${extrasLine}`, ``] : []),
    `Total paid: ${formatPence(data.totalPence)}`,
    ``,
    `View or change your booking: ${data.manageUrl}`,
    ``,
    `Before your pickup we send you your driver's name, licence number and the car's registration. Cancel free of charge up to ${policies.freeCancellationHours} hours before pickup.`,
    ``,
    `${company.legalName}, licensed by ${company.licensingAuthority}.`,
    `Questions? Call ${company.phone} (${company.serviceHours}).`,
  ].join("\n");

  return { subject, html, text };
}

/** The office's alert for a new website booking (NOT-03). */
export function officeNewBookingEmail(data: BookingEmailData): BuiltEmail {
  const first = data.legs[0];
  const route = first ? `${first.pickup} → ${destination(first)}` : "";
  const subject = `${data.isTest ? "[TEST] " : ""}New booking ${data.reference}${first ? ` · ${formatDate(first.pickupAt)} ${formatTime(first.pickupAt)}` : ""}`;

  const details: [string, string][] = [
    ["Reference", data.reference],
    ["Customer", data.customerName],
    ["Phone", data.customerPhone],
    ["Email", data.customerEmail],
    ["Paid", formatPence(data.totalPence)],
    ...(data.extras.length
      ? [
          ["Extras", data.extras.map((e) => `${e.quantity} × ${e.name}`).join(", ")] as [
            string,
            string,
          ],
        ]
      : []),
    ...(data.notes ? [["Notes", data.notes] as [string, string]] : []),
  ];

  const html = frame(
    `${data.isTest ? "TEST booking. " : ""}${route}`,
    `${data.isTest ? `<p style="margin:0 0 12px;padding:8px 12px;background:#fff4e5;border:1px solid #e0b36b;border-radius:8px;font-weight:700;">Test booking — paid with Stripe test keys. No car needed.</p>` : ""}
<p style="margin:0 0 12px;font-size:20px;font-weight:700;">New website booking</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:8px;">
${details
  .map(
    ([label, value]) =>
      `<tr><td style="padding:8px 12px;width:34%;vertical-align:top;color:${MUTED};font-size:13px;">${label}</td><td style="padding:8px 12px;vertical-align:top;">${escapeHtml(value)}</td></tr>`,
  )
  .join("\n")}
</table>
${data.legs.map((leg) => legHtml(leg, data.legs)).join("\n")}
<p style="margin:20px 0 0;"><a href="${escapeHtml(data.adminUrl)}" style="color:${GREEN};font-weight:700;">Open the booking in the admin</a> · jobs are unassigned until a driver is allocated.</p>`,
  );

  const text = [
    ...(data.isTest
      ? ["TEST BOOKING — paid with Stripe test keys. No car needed.", ""]
      : []),
    `New website booking`,
    ``,
    ...details.map(([label, value]) => `${label}: ${value}`),
    ``,
    ...data.legs.map((leg) => `${legText(leg, data.legs)}\n`),
    `Admin: ${data.adminUrl}`,
  ].join("\n");

  return { subject, html, text };
}
