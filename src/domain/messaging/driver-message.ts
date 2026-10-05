import { vehicleClassName } from "@/domain/jobs/labels";
import { formatPence, type Pence } from "@/domain/money";
import { EXTRAS } from "@/domain/pricing/extras";
import { DISPLAY_TIMEZONE, formatTime } from "@/lib/time";
import type { Job } from "@/payload-types";

/**
 * The job message a driver gets on WhatsApp (WA-01, WA-02, spec §27).
 *
 * For now the controller sends it: "Send on WhatsApp" opens WhatsApp on their
 * phone or computer with this text filled in, addressed to the driver's
 * number, and they press send. The WhatsApp Business API, with approved
 * templates and delivery reports, can replace that step later without
 * changing what the message says.
 *
 * Plain text with WhatsApp's own *bold*. Everything the driver needs to do
 * the job without calling the office — and the office number for when they
 * must.
 */

export type DriverMessageKind = "new" | "update" | "removed" | "cancelled";

export interface DriverMessageJob {
  reference: string;
  pickupAt: Date;
  pickupAddress: string;
  viaStops: string[];
  dropoffAddress: string | null;
  hours: number | null;
  flightNumber: string | null;
  leadName: string;
  leadPhone: string;
  nameBoard: string;
  meetAndGreet: boolean;
  passengers: number;
  largeBags: number;
  smallBags: number;
  vehicleClass: string;
  extras: { name: string; quantity: number }[];
  driverNotes: string | null;
  /** Set only when the passenger pays the driver in cash. */
  cashToCollectPence: number | null;
  /** What the driver is paid for this booking, once it is written. */
  payPence: number | null;
}

const day = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "Mon 5 Oct 2026, 11:00" */
export function messageWhen(at: Date): string {
  return `${day.format(at).replace(",", "")}, ${formatTime(at)}`;
}

const HEADINGS: Record<DriverMessageKind, string> = {
  new: "NEW JOB",
  update: "UPDATED JOB",
  removed: "JOB REMOVED",
  cancelled: "JOB CANCELLED",
};

export function driverMessage(
  kind: DriverMessageKind,
  job: DriverMessageJob,
  officePhone: string,
): string {
  const heading = `*${HEADINGS[kind]} ${job.reference}*`;
  const when = messageWhen(job.pickupAt);

  if (kind === "removed" || kind === "cancelled") {
    return [
      heading,
      `${when} · ${job.pickupAddress}`,
      "",
      kind === "removed"
        ? "This job has been given to another driver. Please do not attend."
        : "This job is cancelled. Please do not attend.",
      "",
      `Office: ${officePhone}`,
    ].join("\n");
  }

  const lines = [
    heading,
    `*${when}*`,
    "",
    ...jobDetailLines(job),
    "",
    `Office: ${officePhone}`,
    kind === "new"
      ? "Please reply OK to confirm."
      : "Please reply OK to confirm the changes.",
  ];
  return lines.join("\n");
}

/**
 * What the driver needs to do one job, line by line: route, passenger, car,
 * notes, cash to collect and their price. Shared by the single-job message
 * and the driver's day from the Daily Run Sheet.
 */
export function jobDetailLines(job: DriverMessageJob): string[] {
  const bags = [
    `${job.largeBags} large`,
    ...(job.smallBags ? [`${job.smallBags} small`] : []),
  ].join(", ");

  return [
    `Pickup: ${job.pickupAddress}`,
    ...(job.flightNumber ? [`Flight: ${job.flightNumber}`] : []),
    ...job.viaStops.map((stop, index) => `Stop ${index + 1}: ${stop}`),
    job.dropoffAddress
      ? `Drop-off: ${job.dropoffAddress}`
      : `Hourly hire: ${job.hours ?? 0} hours`,
    "",
    `Passenger: ${job.leadName}, ${job.leadPhone}`,
    `Passengers: ${job.passengers} · Bags: ${bags}`,
    `Vehicle: ${job.vehicleClass}`,
    ...(job.extras.length
      ? [
          `Extras: ${job.extras.map((extra) => `${extra.quantity} × ${extra.name}`).join(", ")}`,
        ]
      : []),
    job.meetAndGreet
      ? `Meet and greet: wait in arrivals with a name board reading "${job.nameBoard}"`
      : "Meet and greet: no",
    ...(job.driverNotes ? ["", `Notes: ${job.driverNotes}`] : []),
    ...(job.cashToCollectPence
      ? ["", `*Collect in cash: ${formatPence(job.cashToCollectPence as Pence)}*`]
      : []),
    ...(job.payPence !== null
      ? [`Your price: ${formatPence(job.payPence as Pence)}`]
      : []),
  ];
}

/**
 * A driver's whole day in one WhatsApp message, from the Daily Run Sheet:
 * each job in pickup order with everything the single-job message carries,
 * their price included.
 */
export function driverDayMessage(
  firstName: string,
  jobs: readonly DriverMessageJob[],
  officePhone: string,
): string {
  const ordered = [...jobs].sort((a, b) => a.pickupAt.getTime() - b.pickupAt.getTime());
  const date = ordered[0] ? day.format(ordered[0].pickupAt).replace(",", "") : "";
  const lines = [
    `*YOUR JOBS · ${date}*`,
    ordered.length === 1
      ? `${firstName}, here is your job.`
      : `${firstName}, here are your ${ordered.length} jobs in pickup order.`,
  ];
  ordered.forEach((job, index) => {
    lines.push(
      "",
      `*${index + 1}. ${formatTime(job.pickupAt)} · ${job.reference}*`,
      ...jobDetailLines(job),
    );
  });
  lines.push("", `Office: ${officePhone}`, "Please reply OK to confirm.");
  return lines.join("\n");
}

/**
 * A link that opens WhatsApp addressed to this number with the text filled
 * in. `phone` is E.164 (+447700900123); wa.me takes the digits only.
 */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/**
 * A stored job as the message needs it. Cash to collect is the fare when the
 * passenger pays the driver; the driver's price is the one written on the
 * booking, so the driver sees what they will be paid.
 */
export function messageJobFrom(job: Job): DriverMessageJob {
  return {
    reference: job.reference,
    pickupAt: new Date(job.pickupAt),
    pickupAddress: job.pickupAddress,
    viaStops: (job.viaStops ?? []).map((stop) => stop.address),
    dropoffAddress: job.dropoffAddress ?? null,
    hours: job.hours ?? null,
    flightNumber: job.flightNumber ?? null,
    leadName: job.leadName,
    leadPhone: job.leadPhone,
    nameBoard: job.nameBoardText || job.leadName,
    meetAndGreet: job.meetAndGreet ?? false,
    passengers: job.passengers,
    largeBags: job.largeBags,
    smallBags: job.smallBags,
    vehicleClass: vehicleClassName(job.vehicleClassSlug),
    extras: (job.extras ?? []).map((extra) => ({
      name: EXTRAS.find((item) => item.slug === extra.slug)?.name ?? extra.slug,
      quantity: extra.quantity,
    })),
    driverNotes: job.driverNotes ?? null,
    cashToCollectPence: job.paymentMethod === "cash" ? job.customerPricePence : null,
    payPence: job.driverPricePence ?? null,
  };
}

/** A WhatsApp chat with this number, for a call or a message typed by hand. */
export function whatsappChat(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export interface PaymentMessage {
  reference: string;
  paidAt: Date;
  upTo: Date;
  method: string;
  bankReference: string | null;
  bookings: number;
  earnedPence: number;
  cashPence: number;
  amountPence: number;
  /** The private link to the statement PDF. */
  statementUrl: string;
}

const payDay = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * The note that goes with a payment to a driver (Driver Pay): what was paid,
 * how, for which bookings, and a link to the statement PDF — WhatsApp's
 * click-to-send carries text, so the PDF travels as a link.
 */
export function paymentMessage(
  firstName: string,
  payment: PaymentMessage,
  officePhone: string,
): string {
  const owedCityline = payment.amountPence < 0;
  const amount = formatPence(Math.abs(payment.amountPence) as Pence);
  const how = `${payment.method.toLowerCase()}${payment.bankReference ? ` (reference ${payment.bankReference})` : ""}`;
  return [
    `*PAYMENT STATEMENT ${payment.reference}*`,
    owedCityline
      ? `${firstName}, this settles ${amount} you paid Cityline on ${payDay.format(payment.paidAt)} by ${how}.`
      : `${firstName}, we paid you ${amount} on ${payDay.format(payment.paidAt)} by ${how}.`,
    "",
    `${payment.bookings} ${payment.bookings === 1 ? "booking" : "bookings"} up to ${payDay.format(payment.upTo)}: ${formatPence(payment.earnedPence as Pence)}`,
    ...(payment.cashPence
      ? [`Less cash you collected: ${formatPence(payment.cashPence as Pence)}`]
      : []),
    owedCityline ? `You paid Cityline: ${amount}` : `Paid to you: ${amount}`,
    "",
    `Your statement (PDF): ${payment.statementUrl}`,
    "",
    `Office: ${officePhone}`,
  ].join("\n");
}
