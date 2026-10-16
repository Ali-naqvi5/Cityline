import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import { formatPence, type Pence } from "@/domain/money";
import { formatDate, formatTime } from "@/lib/time";

import { drawable, fit } from "./pdf-text";

/**
 * An invoice to a partner (Supplier Money, approved by Cityline, 6 Oct 2026):
 * Cityline's full company name and address, the partner billed, a unique
 * number, the invoice and due dates, each booking with the partner's own
 * reference, and the total. The partner's penalties not yet taken off a
 * payment show as minus lines, so the total is what they will pay (Cityline,
 * 16 Oct 2026). Cityline is not registered for VAT, so none is charged and
 * the invoice says so.
 *
 * The office decides whether and when to send it; this only draws it. A4, the
 * standard Helvetica fonts.
 */

export interface InvoiceLine {
  pickupAt: Date;
  reference: string;
  supplierReference: string | null;
  route: string;
  status: string;
  amountPence: number;
}

/** A partner penalty shown as a minus line. */
export interface InvoicePenalty {
  penalisedAt: Date;
  /** The booking it was for. */
  reference: string;
  supplierReference: string | null;
  reason: string;
  amountPence: number;
}

export interface InvoiceData {
  number: string;
  issuedAt: Date;
  dueAt: Date;
  termsDays: number | null;
  voided: boolean;
  partner: { name: string; billingAddress: string | null; contactName: string | null };
  lines: InvoiceLine[];
  /** None on invoices before 16 Oct 2026. */
  penalties?: InvoicePenalty[];
  /** The bookings, less the penalties. */
  totalPence: number;
  company: {
    legalName: string;
    address: string;
    phone: string;
    email: string;
    companyNumber: string | null;
  };
  generatedAt: Date;
}

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.4, 0.44, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);
const ACCENT = rgb(0.11, 0.3, 0.85);

const money = (pence: number) => formatPence(pence as Pence);

export async function invoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${data.number}`);
  pdf.setAuthor(data.company.legalName);
  pdf.setCreationDate(data.generatedAt);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = drawable(regular);

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const text = (
    value: string,
    x: number,
    at: number,
    options: {
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      right?: boolean;
    } = {},
  ) => {
    const size = options.size ?? 9;
    const font = options.font ?? regular;
    const safe = clean(value);
    page.drawText(safe, {
      x: options.right ? x - font.widthOfTextAtSize(safe, size) : x,
      y: at,
      size,
      font,
      color: options.color ?? INK,
    });
  };
  const rule = (at: number) =>
    page.drawLine({
      start: { x: MARGIN, y: at },
      end: { x: A4.width - MARGIN, y: at },
      thickness: 0.7,
      color: LINE,
    });

  const COLUMNS = {
    date: MARGIN,
    booking: MARGIN + 78,
    partnerRef: MARGIN + 136,
    route: MARGIN + 214,
    charge: MARGIN + 392,
    amount: A4.width - MARGIN,
  };
  const ROUTE_WIDTH = COLUMNS.charge - COLUMNS.route - 10;
  const REF_WIDTH = COLUMNS.route - COLUMNS.partnerRef - 8;
  const CHARGE_WIDTH = COLUMNS.amount - 46 - COLUMNS.charge;

  const tableHeader = () => {
    const head = { font: bold, size: 8, color: MUTED };
    text("Date", COLUMNS.date, y, head);
    text("Booking", COLUMNS.booking, y, head);
    text("Your ref", COLUMNS.partnerRef, y, head);
    text("Journey", COLUMNS.route, y, head);
    text("Charge", COLUMNS.charge, y, head);
    text("Amount", COLUMNS.amount, y, { ...head, right: true });
    y -= 6;
    rule(y);
    y -= 14;
  };

  const newPage = (first: boolean) => {
    page = pdf.addPage([A4.width, A4.height]);
    pages.push(page);
    y = A4.height - MARGIN;
    if (data.voided) {
      page.drawText("VOID", {
        x: A4.width / 2 - 110,
        y: A4.height / 2 - 40,
        size: 110,
        font: bold,
        color: rgb(0.85, 0.2, 0.15),
        opacity: 0.15,
      });
    }
    if (!first) {
      text(
        `${data.company.legalName} · Invoice ${data.number} (continued)`,
        MARGIN,
        y - 4,
        {
          size: 9,
          color: MUTED,
        },
      );
      y -= 26;
      tableHeader();
      return;
    }

    // From, and the invoice's own details.
    text(data.company.legalName, MARGIN, y - 4, { font: bold, size: 13 });
    text(data.company.address, MARGIN, y - 19, { size: 8.5, color: MUTED });
    text(`${data.company.phone} · ${data.company.email}`, MARGIN, y - 31, {
      size: 8.5,
      color: MUTED,
    });
    if (data.company.companyNumber) {
      text(`Company number ${data.company.companyNumber}`, MARGIN, y - 43, {
        size: 8.5,
        color: MUTED,
      });
    }
    text("INVOICE", A4.width - MARGIN, y - 4, {
      font: bold,
      size: 14,
      color: ACCENT,
      right: true,
    });
    text(data.number, A4.width - MARGIN, y - 21, { size: 10, right: true });
    y -= 66;
    rule(y);
    y -= 22;

    // To.
    const top = y;
    text("Bill to", MARGIN, y, { size: 9, color: MUTED });
    y -= 14;
    text(data.partner.name, MARGIN, y, { font: bold, size: 10 });
    y -= 13;
    if (data.partner.contactName) {
      text(`For the attention of ${data.partner.contactName}`, MARGIN, y, { size: 9 });
      y -= 12;
    }
    for (const line of (data.partner.billingAddress ?? "")
      .split(/\r?\n/)
      .filter(Boolean)) {
      text(line, MARGIN, y, { size: 9 });
      y -= 12;
    }

    // Dates, on the right.
    const facts: [string, string][] = [
      ["Invoice date", formatDate(data.issuedAt)],
      ["Due", formatDate(data.dueAt)],
      ...(data.termsDays
        ? ([["Terms", `${data.termsDays} days`]] as [string, string][])
        : []),
    ];
    let right = top;
    for (const [label, value] of facts) {
      text(label, A4.width - MARGIN - 150, right, { size: 9, color: MUTED });
      text(value, A4.width - MARGIN, right, { size: 9.5, right: true });
      right -= 14;
    }
    y = Math.min(y, right) - 18;
    tableHeader();
  };

  newPage(true);
  for (const line of data.lines) {
    if (y < MARGIN + 40) newPage(false);
    text(formatDate(line.pickupAt), COLUMNS.date, y);
    text(formatTime(line.pickupAt), COLUMNS.date + 50, y, { color: MUTED });
    text(line.reference, COLUMNS.booking, y);
    text(
      fit(clean(line.supplierReference ?? "—"), regular, 9, REF_WIDTH),
      COLUMNS.partnerRef,
      y,
    );
    text(fit(clean(line.route), regular, 9, ROUTE_WIDTH), COLUMNS.route, y);
    text(fit(clean(line.status), regular, 9, CHARGE_WIDTH), COLUMNS.charge, y);
    text(money(line.amountPence), COLUMNS.amount, y, { right: true });
    y -= 16;
  }
  const penalties = data.penalties ?? [];
  for (const penalty of penalties) {
    if (y < MARGIN + 40) newPage(false);
    text(formatDate(penalty.penalisedAt), COLUMNS.date, y);
    text(penalty.reference, COLUMNS.booking, y);
    text(
      fit(clean(penalty.supplierReference ?? "—"), regular, 9, REF_WIDTH),
      COLUMNS.partnerRef,
      y,
    );
    text(fit(clean(penalty.reason), regular, 9, ROUTE_WIDTH), COLUMNS.route, y);
    text("Penalty", COLUMNS.charge, y);
    text(money(-penalty.amountPence), COLUMNS.amount, y, { right: true });
    y -= 16;
  }
  const penaltiesPence = penalties.reduce((sum, penalty) => sum + penalty.amountPence, 0);

  if (y < MARGIN + 116) newPage(false);
  y -= 2;
  rule(y);
  y -= 22;
  text(
    `${data.lines.length} ${data.lines.length === 1 ? "booking" : "bookings"}`,
    COLUMNS.charge - 60,
    y,
    { size: 9.5, color: MUTED },
  );
  if (penalties.length) {
    const muted = { size: 9.5, color: MUTED, right: true };
    text(money(data.totalPence + penaltiesPence), COLUMNS.amount, y, muted);
    y -= 16;
    text(
      `Less ${penalties.length} ${penalties.length === 1 ? "penalty" : "penalties"}`,
      COLUMNS.charge - 60,
      y,
      { size: 9.5, color: MUTED },
    );
    text(money(-penaltiesPence), COLUMNS.amount, y, muted);
  }
  y -= 20;
  text("Total due", COLUMNS.charge - 60, y, { font: bold, size: 11.5 });
  text(money(data.totalPence), COLUMNS.amount, y, {
    font: bold,
    size: 11.5,
    right: true,
  });
  y -= 22;
  text("No VAT is charged: Cityline is not registered for VAT.", COLUMNS.charge - 60, y, {
    size: 8.5,
    color: MUTED,
  });
  y -= 13;
  text(
    `Please pay by ${formatDate(data.dueAt)}, quoting ${data.number}.`,
    COLUMNS.charge - 60,
    y,
    {
      size: 8.5,
      color: MUTED,
    },
  );
  if (data.voided) {
    y -= 20;
    text("This invoice was voided and is not payable.", MARGIN, y, {
      font: bold,
      color: rgb(0.7, 0.14, 0.1),
    });
  }

  pages.forEach((each, index) => {
    page = each;
    text(
      `${data.company.legalName} · Invoice ${data.number} · Page ${index + 1} of ${pages.length}`,
      MARGIN,
      MARGIN - 20,
      { size: 7.5, color: MUTED },
    );
  });

  return pdf.save();
}
