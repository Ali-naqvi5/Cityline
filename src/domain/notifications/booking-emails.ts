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

/** One field that changed on a booking, in words a customer understands. */
export interface BookingChange {
  label: string;
  from: string;
  to: string;
}

function changesHtml(changes: readonly BookingChange[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:8px;">
<tr><td style="padding:8px 12px;color:${MUTED};font-size:13px;">What</td><td style="padding:8px 12px;color:${MUTED};font-size:13px;">Was</td><td style="padding:8px 12px;color:${MUTED};font-size:13px;">Now</td></tr>
${changes
  .map(
    (change) =>
      `<tr><td style="padding:8px 12px;vertical-align:top;">${escapeHtml(change.label)}</td><td style="padding:8px 12px;vertical-align:top;color:${MUTED};text-decoration:line-through;">${escapeHtml(change.from || "—")}</td><td style="padding:8px 12px;vertical-align:top;font-weight:700;">${escapeHtml(change.to || "—")}</td></tr>`,
  )
  .join("\n")}
</table>`;
}

function changesText(changes: readonly BookingChange[]): string {
  return changes
    .map((change) => `${change.label}: ${change.from || "—"} → ${change.to || "—"}`)
    .join("\n");
}

/** The customer's confirmation that their change went through (NOT-01, amendment). */
export function bookingChangedEmail(
  data: BookingEmailData,
  changes: readonly BookingChange[],
): BuiltEmail {
  const subject = `Booking changed: ${data.reference}`;

  const html = frame(
    `Your booking ${data.reference} has been updated.`,
    `<p style="margin:0 0 12px;font-size:20px;font-weight:700;">Your booking is updated</p>
<p style="margin:0 0 16px;">We have made these changes to booking <strong>${escapeHtml(data.reference)}</strong>. Your fare is unchanged.</p>
${changesHtml(changes)}
${data.legs.map((leg) => legHtml(leg, data.legs)).join("\n")}
<p style="margin:20px 0 8px;"><a href="${escapeHtml(data.manageUrl)}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;">View your booking</a></p>
<p style="margin:16px 0 0;color:${MUTED};font-size:13px;">If you did not make this change, call us straight away on ${escapeHtml(company.phone)}.</p>`,
  );

  const text = [
    `Your booking is updated`,
    ``,
    `We have made these changes to booking ${data.reference}. Your fare is unchanged.`,
    ``,
    changesText(changes),
    ``,
    ...data.legs.map((leg) => `${legText(leg, data.legs)}\n`),
    `View your booking: ${data.manageUrl}`,
    ``,
    `If you did not make this change, call us straight away on ${company.phone}.`,
  ].join("\n");

  return { subject, html, text };
}

/** The office's alert that a customer changed a booking online (NOT-03). */
export function officeBookingChangedEmail(
  data: BookingEmailData,
  changes: readonly BookingChange[],
): BuiltEmail {
  const subject = `${data.isTest ? "[TEST] " : ""}Booking changed ${data.reference}`;

  const html = frame(
    `${data.customerName} changed ${data.reference}.`,
    `<p style="margin:0 0 12px;font-size:20px;font-weight:700;">Booking changed by the customer</p>
<p style="margin:0 0 16px;">${escapeHtml(data.customerName)} (${escapeHtml(data.customerPhone)}) changed <strong>${escapeHtml(data.reference)}</strong> online. If a driver is already assigned, let them know.</p>
${changesHtml(changes)}
<p style="margin:20px 0 0;"><a href="${escapeHtml(data.adminUrl)}" style="color:${GREEN};font-weight:700;">Open the booking in the admin</a></p>`,
  );

  const text = [
    `Booking changed by the customer`,
    ``,
    `${data.customerName} (${data.customerPhone}) changed ${data.reference} online. If a driver is already assigned, let them know.`,
    ``,
    changesText(changes),
    ``,
    `Admin: ${data.adminUrl}`,
  ].join("\n");

  return { subject, html, text };
}

/** What the customer is owed on cancelling, in words. */
export type RefundStatement =
  { kind: "full"; refundPence: number } | { kind: "partial"; refundPence: number | null };

function refundWords(refund: RefundStatement): string {
  if (refund.kind === "full") {
    return `a full refund of ${formatPence(refund.refundPence)}`;
  }
  return refund.refundPence === null
    ? "a partial refund, and our team will confirm the amount"
    : `a partial refund of ${formatPence(refund.refundPence)}`;
}

/** The customer's confirmation of a cancellation (NOT-01). */
export function bookingCancelledEmail(
  data: BookingEmailData,
  refund: RefundStatement,
): BuiltEmail {
  const subject = `Booking cancelled: ${data.reference}`;
  const owed = refundWords(refund);

  const html = frame(
    `Booking ${data.reference} is cancelled.`,
    `<p style="margin:0 0 12px;font-size:20px;font-weight:700;">Your booking is cancelled</p>
<p style="margin:0 0 16px;">We have cancelled booking <strong>${escapeHtml(data.reference)}</strong>, and no car will come.</p>
<p style="margin:0 0 16px;">You are due ${escapeHtml(owed)}. Refunds are made by our team, back to the card you paid with — we will be in touch to arrange it. Once it is on its way, it usually reaches your account within a few working days.</p>
<p style="margin:16px 0 0;color:${MUTED};font-size:13px;">If you did not cancel this booking, call us straight away on ${escapeHtml(company.phone)}.</p>`,
  );

  const text = [
    `Your booking is cancelled`,
    ``,
    `We have cancelled booking ${data.reference}, and no car will come.`,
    ``,
    `You are due ${owed}. Refunds are made by our team, back to the card you paid with — we will be in touch to arrange it. Once it is on its way, it usually reaches your account within a few working days.`,
    ``,
    `If you did not cancel this booking, call us straight away on ${company.phone}.`,
  ].join("\n");

  return { subject, html, text };
}

/** The office's alert for a cancellation, with the refund to make (NOT-03). */
export function officeBookingCancelledEmail(
  data: BookingEmailData,
  refund: RefundStatement,
): BuiltEmail {
  const subject = `${data.isTest ? "[TEST] " : ""}Booking cancelled ${data.reference} — refund due`;
  const owed = refundWords(refund);
  const first = data.legs[0];
  const due = first
    ? `, which was due ${formatDate(first.pickupAt)} at ${formatTime(first.pickupAt)}`
    : "";

  const html = frame(
    `${data.reference} cancelled online. Refund due.`,
    `<p style="margin:0 0 12px;font-size:20px;font-weight:700;">Booking cancelled by the customer</p>
<p style="margin:0 0 16px;">${escapeHtml(data.customerName)} (${escapeHtml(data.customerPhone)}, ${escapeHtml(data.customerEmail)}) cancelled <strong>${escapeHtml(data.reference)}</strong> online${escapeHtml(due)}. Its jobs are cancelled; tell the driver if one was assigned.</p>
<p style="margin:0 0 16px;padding:10px 12px;background:#fff4e5;border:1px solid #e0b36b;border-radius:8px;"><strong>Refund to make:</strong> ${escapeHtml(owed)} of ${formatPence(data.totalPence)} paid. Refund it from the Stripe Dashboard and contact the customer.</p>
<p style="margin:20px 0 0;"><a href="${escapeHtml(data.adminUrl)}" style="color:${GREEN};font-weight:700;">Open the booking in the admin</a></p>`,
  );

  const text = [
    `Booking cancelled by the customer`,
    ``,
    `${data.customerName} (${data.customerPhone}, ${data.customerEmail}) cancelled ${data.reference} online${due}. Its jobs are cancelled; tell the driver if one was assigned.`,
    ``,
    `Refund to make: ${owed} of ${formatPence(data.totalPence)} paid. Refund it from the Stripe Dashboard and contact the customer.`,
    ``,
    `Admin: ${data.adminUrl}`,
  ].join("\n");

  return { subject, html, text };
}

/** The link to Manage booking, sent when a customer asks for it again (BK-07). */
export function manageLinkEmail(reference: string, manageUrl: string): BuiltEmail {
  const subject = `Your link to manage booking ${reference}`;

  const html = frame(
    `Your link to view or change booking ${reference}.`,
    `<p style="margin:0 0 12px;font-size:20px;font-weight:700;">Manage your booking</p>
<p style="margin:0 0 16px;">Here is the link to view, change or cancel booking <strong>${escapeHtml(reference)}</strong>.</p>
<p style="margin:0 0 16px;"><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;">Manage booking</a></p>
<p style="margin:16px 0 0;color:${MUTED};font-size:13px;">Keep this link private: anyone who has it can see and change the booking. If you did not ask for it, you can ignore this email.</p>`,
  );

  const text = [
    `Manage your booking`,
    ``,
    `Here is the link to view, change or cancel booking ${reference}:`,
    manageUrl,
    ``,
    `Keep this link private: anyone who has it can see and change the booking. If you did not ask for it, you can ignore this email.`,
  ].join("\n");

  return { subject, html, text };
}

export interface DriverDetailsEmailData {
  /** The reference the customer knows: the booking's, or the job's. */
  reference: string;
  pickupAt: Date;
  pickup: string;
  driverFirstName: string;
  phvLicence: string;
  vehicle: string;
  colour: string;
  registration: string;
}

/**
 * Who is coming (NOT-02, CMP-04): the driver's first name and PHV licence
 * number, the car and its registration — enough to recognise the car and
 * check it is a licensed one — and the office number, never the driver's own.
 */
export function driverDetailsEmail(data: DriverDetailsEmailData): BuiltEmail {
  const pickupWhen = `${formatDate(data.pickupAt)} at ${formatTime(data.pickupAt)}`;
  const car = `${data.colour} ${data.vehicle}`;
  const subject = `Your driver for ${pickupWhen}: ${data.driverFirstName}, ${data.registration}`;

  const rows: [string, string][] = [
    ["Pickup", `${escapeHtml(pickupWhen)}<br>${escapeHtml(data.pickup)}`],
    ["Driver", escapeHtml(data.driverFirstName)],
    ["PHV licence", escapeHtml(data.phvLicence)],
    ["Car", escapeHtml(car)],
    ["Registration", `<strong>${escapeHtml(data.registration)}</strong>`],
  ];

  const html = frame(
    `${data.driverFirstName} will drive you, in a ${car}, ${data.registration}.`,
    `<p style="margin:0 0 12px;font-size:20px;font-weight:700;">Your driver</p>
<p style="margin:0 0 16px;">Here are the details of the driver for booking <strong>${escapeHtml(data.reference)}</strong>. Please check the registration before you get in.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:8px;">
${rows
  .map(
    ([label, value]) =>
      `<tr><td style="padding:8px 12px;width:34%;vertical-align:top;color:${MUTED};font-size:13px;">${label}</td><td style="padding:8px 12px;vertical-align:top;">${value}</td></tr>`,
  )
  .join("\n")}
</table>
<p style="margin:16px 0 0;color:${MUTED};font-size:13px;">Your driver is licensed by ${escapeHtml(company.licensingAuthority)}. If you cannot find them, call us on ${escapeHtml(company.phone)}.</p>`,
  );

  const text = [
    `Your driver`,
    ``,
    `The driver for booking ${data.reference}. Please check the registration before you get in.`,
    ``,
    `Pickup: ${pickupWhen}, ${data.pickup}`,
    `Driver: ${data.driverFirstName}`,
    `PHV licence: ${data.phvLicence}`,
    `Car: ${car}`,
    `Registration: ${data.registration}`,
    ``,
    `Your driver is licensed by ${company.licensingAuthority}. If you cannot find them, call us on ${company.phone}.`,
  ].join("\n");

  return { subject, html, text };
}
