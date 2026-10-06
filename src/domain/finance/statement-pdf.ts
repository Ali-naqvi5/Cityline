import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import { formatPence, type Pence } from "@/domain/money";
import { formatDate, formatTime } from "@/lib/time";

import { drawable, fit } from "./pdf-text";

/**
 * A driver's payment statement as a PDF (Driver Pay, approved by Cityline,
 * 6 Oct 2026): who was paid, when and how, every booking it covers with its
 * price and any cash the driver collected, and the total. It is a statement
 * of payment for bookings — not an invoice and not a payslip: drivers are
 * independent, and an invoice would be theirs to issue.
 *
 * A4, the standard Helvetica fonts (nothing to embed or bundle). Text the
 * font cannot draw is replaced, so an unusual character in an address can
 * never stop a statement being produced.
 */

export interface StatementLine {
  pickupAt: Date;
  reference: string;
  route: string;
  status: string;
  pricePence: number;
  cashPence: number;
}

export interface StatementData {
  reference: string;
  paidAt: Date;
  upTo: Date;
  method: string;
  bankReference: string | null;
  voided: boolean;
  driverName: string;
  phvNumber: string | null;
  lines: StatementLine[];
  earnedPence: number;
  cashPence: number;
  amountPence: number;
  company: { name: string; address: string; phone: string; email: string };
  generatedAt: Date;
}

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.4, 0.44, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);
const ACCENT = rgb(0.11, 0.3, 0.85);

const money = (pence: number) => formatPence(pence as Pence);

export async function statementPdf(data: StatementData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Payment statement ${data.reference}`);
  pdf.setAuthor(data.company.name);
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
    const width = font.widthOfTextAtSize(safe, size);
    page.drawText(safe, {
      x: options.right ? x - width : x,
      y: at,
      size,
      font,
      color: options.color ?? INK,
    });
  };
  const rule = (at: number, color = LINE) =>
    page.drawLine({
      start: { x: MARGIN, y: at },
      end: { x: A4.width - MARGIN, y: at },
      thickness: 0.7,
      color,
    });

  // Columns of the bookings table.
  const COLUMNS = {
    date: MARGIN,
    booking: MARGIN + 78,
    route: MARGIN + 140,
    status: MARGIN + 338,
    price: A4.width - MARGIN - 62,
    cash: A4.width - MARGIN,
  };
  const ROUTE_WIDTH = COLUMNS.status - COLUMNS.route - 10;
  const STATUS_WIDTH = COLUMNS.price - 42 - COLUMNS.status;

  const tableHeader = () => {
    text("Date", COLUMNS.date, y, { font: bold, size: 8, color: MUTED });
    text("Booking", COLUMNS.booking, y, { font: bold, size: 8, color: MUTED });
    text("Route", COLUMNS.route, y, { font: bold, size: 8, color: MUTED });
    text("Status", COLUMNS.status, y, { font: bold, size: 8, color: MUTED });
    text("Price", COLUMNS.price, y, { font: bold, size: 8, color: MUTED, right: true });
    text("Cash collected", COLUMNS.cash, y, {
      font: bold,
      size: 8,
      color: MUTED,
      right: true,
    });
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
    if (first) {
      text(data.company.name, MARGIN, y - 4, { font: bold, size: 15 });
      text(data.company.address, MARGIN, y - 20, { size: 8.5, color: MUTED });
      text(`${data.company.phone} · ${data.company.email}`, MARGIN, y - 32, {
        size: 8.5,
        color: MUTED,
      });
      text("PAYMENT STATEMENT", A4.width - MARGIN, y - 4, {
        font: bold,
        size: 12,
        color: ACCENT,
        right: true,
      });
      text(data.reference, A4.width - MARGIN, y - 20, { size: 10, right: true });
      y -= 64;
      rule(y);
      y -= 22;

      const facts: [string, string][] = [
        [
          "Paid to",
          data.driverName + (data.phvNumber ? ` (PHV licence ${data.phvNumber})` : ""),
        ],
        ["Date paid", formatDate(data.paidAt)],
        [
          "Method",
          data.method + (data.bankReference ? ` · reference ${data.bankReference}` : ""),
        ],
        ["Covers", `Completed and PNS bookings up to ${formatDate(data.upTo)}`],
      ];
      for (const [label, value] of facts) {
        text(label, MARGIN, y, { size: 9, color: MUTED });
        text(value, MARGIN + 78, y, { size: 9.5 });
        y -= 15;
      }
      y -= 14;
    } else {
      text(`${data.company.name} · ${data.reference} (continued)`, MARGIN, y - 4, {
        size: 9,
        color: MUTED,
      });
      y -= 26;
    }
    tableHeader();
  };

  newPage(true);
  for (const line of data.lines) {
    if (y < MARGIN + 40) newPage(false);
    text(formatDate(line.pickupAt), COLUMNS.date, y);
    text(formatTime(line.pickupAt), COLUMNS.date + 50, y, { color: MUTED });
    text(line.reference, COLUMNS.booking, y);
    text(fit(clean(line.route), regular, 9, ROUTE_WIDTH), COLUMNS.route, y);
    text(fit(clean(line.status), regular, 9, STATUS_WIDTH), COLUMNS.status, y);
    text(money(line.pricePence), COLUMNS.price, y, { right: true });
    text(line.cashPence ? money(line.cashPence) : "—", COLUMNS.cash, y, {
      right: true,
      color: line.cashPence ? INK : MUTED,
    });
    y -= 16;
  }

  // Totals.
  if (y < MARGIN + 110) newPage(false);
  y -= 2;
  rule(y);
  y -= 20;
  const totals: [string, string, boolean][] = [
    [
      `${data.lines.length} ${data.lines.length === 1 ? "booking" : "bookings"}`,
      money(data.earnedPence),
      false,
    ],
    [
      "Less cash you collected",
      data.cashPence ? `-${money(data.cashPence)}` : money(0),
      false,
    ],
    data.amountPence >= 0
      ? ["Paid to you", money(data.amountPence), true]
      : ["You paid Cityline", money(-data.amountPence), true],
  ];
  for (const [label, value, strong] of totals) {
    text(label, COLUMNS.price - 120, y, {
      font: strong ? bold : regular,
      size: strong ? 11 : 9.5,
      color: strong ? INK : MUTED,
    });
    text(value, COLUMNS.cash, y, {
      font: strong ? bold : regular,
      size: strong ? 11 : 9.5,
      right: true,
    });
    y -= strong ? 20 : 16;
  }
  if (data.voided) {
    y -= 6;
    text("This payment was voided and does not stand.", MARGIN, y, {
      font: bold,
      color: rgb(0.7, 0.14, 0.1),
    });
  }

  // Footer on every page.
  pages.forEach((each, index) => {
    page = each;
    text(
      `${data.company.name} · Statement ${data.reference} · Produced ${formatDate(data.generatedAt)} · Page ${index + 1} of ${pages.length}`,
      MARGIN,
      MARGIN - 20,
      { size: 7.5, color: MUTED },
    );
  });

  return pdf.save();
}
