import {
  clip,
  endPath,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";

import { formatPence, type Pence } from "@/domain/money";
import { formatDate, formatTime } from "@/lib/time";

import {
  LOGO_LETTERING_PNG,
  LOGO_MARK,
  LOGO_SHAPES,
  LOGO_WORDMARK,
  type LogoRegion,
} from "./cityline-logo";
import { drawable, fit } from "./pdf-text";

/**
 * A driver's payment statement as a PDF (Driver Pay; layout from Cityline's
 * design of 13 Oct 2026): the Cityline logo, who was paid, when and how,
 * every booking it covers with its pickup, drop-off, price and any cash the
 * driver collected, the totals, and — for a bank transfer — the driver's
 * account, masked. It is a statement of payment for bookings, not an invoice
 * or a payslip: drivers are independent, and an invoice would be theirs.
 *
 * A4 landscape, the standard Helvetica fonts (nothing to embed), and the
 * office's own logo picture when one is given, else the built-in one drawn
 * as vector shapes. Text the font cannot draw is replaced, so an
 * unusual character in an address never stops a statement being produced.
 */

export interface StatementLine {
  pickupAt: Date;
  reference: string;
  pickup: string;
  dropoff: string;
  /** "Completed" or "PNS". */
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
  /** The account paid into, masked; only for a bank transfer. */
  bank: { holder: string; last4: string } | null;
  lines: StatementLine[];
  earnedPence: number;
  cashPence: number;
  amountPence: number;
  company: { name: string; address: string; phone: string; email: string };
  generatedAt: Date;
  /**
   * The office's own logo as a PNG, when one is provided
   * (`admin/data/statement-logo.ts`); without it, the built-in drawing.
   */
  logo?: Uint8Array | null;
}

const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = 36;
const CONTENT = PAGE.width - 2 * MARGIN;

const hex = (value: string): RGB =>
  rgb(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
  );
const INK = hex("#1f2d35");
const MUTED = hex("#5d6a72");
const GREEN = hex("#1f9a43");
const GREEN_DARK = hex("#17803a");
const TINT = hex("#f1f8f3");
const TINT_STRONG = hex("#e2f3e7");
const RULE = hex("#a9dcb5");
const GRID = hex("#d5ebdc");
const PILL = hex("#d2f0da");
const PNS_PILL = hex("#fcebc8");
const PNS_INK = hex("#8a5a06");
const VOID_RED = hex("#c0261b");

const money = (pence: number) => formatPence(pence as Pence);

/** The table's columns, left to right; they fill the content width. */
const COLUMNS = [
  { key: "date", label: "DATE", width: 112 },
  { key: "pickup", label: "PICKUP", width: 168 },
  { key: "dropoff", label: "DROPOFF", width: 160 },
  { key: "booking", label: "BOOKING REF", width: 96 },
  { key: "status", label: "STATUS", width: 90 },
  { key: "fare", label: "FARE", width: 60, right: true },
  { key: "cash", label: "CASH RECEIVED", width: CONTENT - 686, right: true },
] as const;
const CELL = 10;
const LINE_HEIGHT = 12;

export async function statementPdf(data: StatementData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Payment statement ${data.reference}`);
  pdf.setAuthor(data.company.name);
  pdf.setCreationDate(data.generatedAt);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  // The wordmark's lettering, cleaned, as a picture (see cityline-logo.ts).
  const lettering = await pdf.embedPng(Buffer.from(LOGO_LETTERING_PNG, "base64"));
  const picture = data.logo ? await pdf.embedPng(data.logo) : null;
  const clean = drawable(regular);

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  // --- Drawing helpers ------------------------------------------------------------

  type TextOptions = {
    size?: number;
    font?: PDFFont;
    color?: RGB;
    align?: "left" | "right" | "center";
    spacing?: number;
  };
  const widthOf = (value: string, options: TextOptions = {}) => {
    const safe = clean(value);
    const font = options.font ?? regular;
    const size = options.size ?? 9;
    return (
      font.widthOfTextAtSize(safe, size) +
      (options.spacing ?? 0) * Math.max(0, safe.length - 1)
    );
  };
  const text = (value: string, x: number, at: number, options: TextOptions = {}) => {
    const safe = clean(value);
    const font = options.font ?? regular;
    const size = options.size ?? 9;
    const color = options.color ?? INK;
    const width = widthOf(safe, options);
    let left =
      options.align === "right"
        ? x - width
        : options.align === "center"
          ? x - width / 2
          : x;
    if (!options.spacing) {
      page.drawText(safe, { x: left, y: at, size, font, color });
      return;
    }
    // Letter-spaced labels, a character at a time.
    for (const char of safe) {
      page.drawText(char, { x: left, y: at, size, font, color });
      left += font.widthOfTextAtSize(char, size) + options.spacing;
    }
  };
  /** Words wrapped to a width, at most `lines` of them, the last cut short. */
  const wrap = (
    value: string,
    font: PDFFont,
    size: number,
    width: number,
    lines: number,
  ) => {
    const words = clean(value).split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !current) {
        current = next;
      } else {
        out.push(current);
        current = word;
      }
    }
    if (current) out.push(current);
    if (out.length <= lines) return out.map((line) => fit(line, font, size, width));
    const kept = out.slice(0, lines);
    kept[lines - 1] = fit(`${kept[lines - 1]} ${out[lines]}…`, font, size, width);
    return kept;
  };
  const hline = (from: number, to: number, at: number, color = RULE, thickness = 0.8) =>
    page.drawLine({ start: { x: from, y: at }, end: { x: to, y: at }, thickness, color });
  const vline = (x: number, top: number, bottom: number, color = GRID) =>
    page.drawLine({ start: { x, y: top }, end: { x, y: bottom }, thickness: 0.6, color });
  /** A rounded rectangle by its top-left corner (PDF coordinates). */
  const roundRect = (
    x: number,
    top: number,
    width: number,
    height: number,
    radius: number,
    options: { fill?: RGB; border?: RGB },
  ) => {
    const r = Math.min(radius, width / 2, height / 2);
    const w = width;
    const h = height;
    page.drawSvgPath(
      `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} ` +
        `L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`,
      {
        x,
        y: top,
        color: options.fill,
        borderColor: options.border,
        borderWidth: options.border ? 0.8 : undefined,
      },
    );
  };
  /** Part of the logo, by its top-left corner and height, clipped to that part. */
  const logo = (
    region: LogoRegion,
    left: number,
    top: number,
    height: number,
    options: { opacity?: number } = {},
  ) => {
    const scale = height / region.height;
    page.pushOperators(
      pushGraphicsState(),
      rectangle(left, top - height, region.width * scale, height),
      clip(),
      endPath(),
    );
    for (const shape of LOGO_SHAPES) {
      page.drawSvgPath(shape.d, {
        x: left - region.x * scale,
        y: top + region.y * scale,
        scale,
        color: hex(shape.fill),
        opacity: options.opacity,
      });
    }
    page.pushOperators(popGraphicsState());
    return region.width * scale;
  };
  /** The office's logo picture, fitted into a box by its top-left corner. */
  const pictureLogo = (
    left: number,
    top: number,
    maxWidth: number,
    maxHeight: number,
    options: { opacity?: number } = {},
  ) => {
    if (!picture) return 0;
    const scale = Math.min(maxWidth / picture.width, maxHeight / picture.height);
    page.drawImage(picture, {
      x: left,
      y: top - picture.height * scale,
      width: picture.width * scale,
      height: picture.height * scale,
      opacity: options.opacity,
    });
    return picture.width * scale;
  };
  const bankIcon = (left: number, top: number, size: number) => {
    const s = size / 24;
    page.drawSvgPath(
      "M12 1 L23 7 L23 9 L1 9 L1 7 Z M3 10.5 H6 V18 H3 Z M8 10.5 H11 V18 H8 Z " +
        "M13 10.5 H16 V18 H13 Z M18 10.5 H21 V18 H18 Z M1.5 19.5 H22.5 V22 H1.5 Z",
      { x: left, y: top, scale: s, color: GREEN },
    );
  };

  // --- Pages ----------------------------------------------------------------------

  let tableTop = 0;
  const tableHeader = () => {
    tableTop = y;
    const height = 26;
    roundRect(MARGIN, y, CONTENT, height, 6, { fill: TINT_STRONG });
    page.drawRectangle({
      x: MARGIN,
      y: y - height,
      width: CONTENT,
      height: 8,
      color: TINT_STRONG,
    });
    let x = MARGIN;
    for (const column of COLUMNS) {
      const right = "right" in column && column.right;
      text(column.label, right ? x + column.width - CELL : x + CELL, y - 16.5, {
        font: bold,
        size: 7.5,
        color: GREEN_DARK,
        spacing: 0.5,
        align: right ? "right" : "left",
      });
      x += column.width;
    }
    y -= height;
  };
  /** The table's border and column lines, once its rows on this page are drawn. */
  const closeTable = () => {
    roundRect(MARGIN, tableTop, CONTENT, tableTop - y, 6, { border: GRID });
    let x = MARGIN;
    for (const column of COLUMNS.slice(0, -1)) {
      x += column.width;
      vline(x, tableTop, y);
    }
  };

  const newPage = (first: boolean, withTable = true) => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    // The skyline (or the office's logo), faint, in the corner.
    if (picture) pictureLogo(PAGE.width - 236, 160, 200, 140, { opacity: 0.07 });
    else logo(LOGO_MARK, PAGE.width - 215, 170, 160, { opacity: 0.07 });
    if (data.voided) {
      page.drawText("VOID", {
        x: PAGE.width / 2 - 130,
        y: PAGE.height / 2 - 50,
        size: 130,
        font: bold,
        color: VOID_RED,
        opacity: 0.12,
      });
    }
    const top = PAGE.height - MARGIN;

    if (!first) {
      const markWidth = picture
        ? pictureLogo(MARGIN, top, 160, 34)
        : logo(LOGO_MARK, MARGIN, top, 34);
      text(
        `DRIVER PAYMENT STATEMENT  ·  ${data.reference}  (continued)`,
        MARGIN + markWidth + 12,
        top - 21,
        { font: bold, size: 10, color: GREEN, spacing: 0.4 },
      );
      y = top - 50;
      if (withTable) tableHeader();
      return;
    }

    // The logo: the office's picture, or the mark with the name beside it.
    if (picture) {
      pictureLogo(MARGIN, top + 4, 380, 72);
    } else {
      const markWidth = logo(LOGO_MARK, MARGIN, top, 66);
      const letteringHeight = 42;
      page.drawImage(lettering, {
        x: MARGIN + markWidth + 12,
        y: top - 12 - letteringHeight,
        width: (LOGO_WORDMARK.width / LOGO_WORDMARK.height) * letteringHeight,
        height: letteringHeight,
      });
    }

    // What this is, and its number.
    const title = "DRIVER PAYMENT STATEMENT";
    const titleOptions = { font: bold, size: 17, color: GREEN, spacing: 0.5 } as const;
    text(title, PAGE.width - MARGIN, top - 17, { ...titleOptions, align: "right" });
    hline(
      PAGE.width - MARGIN - widthOf(title, titleOptions),
      PAGE.width - MARGIN,
      top - 26,
      GREEN,
      1,
    );
    text(data.reference, PAGE.width - MARGIN, top - 50, {
      font: bold,
      size: 18,
      align: "right",
    });

    // How to reach Cityline.
    let x = MARGIN;
    const contact: [string, PDFFont][] = [
      [data.company.address, italic],
      [data.company.phone, regular],
      [data.company.email, regular],
    ];
    contact.forEach(([value, font], index) => {
      if (index) {
        text("|", x + 9, top - 84, { size: 9.5, color: GREEN });
        x += 24;
      }
      text(value, x, top - 84, { size: 9.5, font, color: index ? INK : MUTED });
      x += widthOf(value, { size: 9.5, font });
    });
    hline(MARGIN, PAGE.width - MARGIN, top - 95);

    // Paid to, when, how, and what it covers.
    const band = { top: top - 107, height: 56 };
    roundRect(MARGIN, band.top, CONTENT, band.height, 6, { fill: TINT });
    const facts: [string, string[], string | null][] = [
      [
        "PAID TO",
        [data.driverName],
        data.phvNumber ? `PHV licence ${data.phvNumber}` : null,
      ],
      ["DATE PAID", [formatDate(data.paidAt)], null],
      [
        "PAYMENT METHOD",
        [
          data.method +
            (data.bankReference ? `  ·  Reference ${data.bankReference}` : ""),
        ],
        null,
      ],
      ["COVERS", ["Completed and PNS bookings", `up to ${formatDate(data.upTo)}`], null],
    ];
    const columnWidth = CONTENT / facts.length;
    facts.forEach(([label, lines, note], index) => {
      const left = MARGIN + index * columnWidth + 16;
      if (index)
        vline(
          MARGIN + index * columnWidth,
          band.top - 12,
          band.top - band.height + 12,
          RULE,
        );
      text(label, left, band.top - 18, {
        font: bold,
        size: 8.5,
        color: GREEN_DARK,
        spacing: 0.8,
      });
      const size = lines.length > 1 ? 10 : 11.5;
      lines.forEach((line, lineIndex) => {
        text(
          fit(clean(line), regular, size, columnWidth - 28),
          left,
          band.top - 34 - lineIndex * 12.5,
          {
            size,
            font: lines.length > 1 ? regular : index === 0 ? bold : regular,
          },
        );
      });
      if (note) text(note, left, band.top - 48, { size: 8, color: MUTED });
    });

    y = band.top - band.height - 14;
    tableHeader();
  };

  // --- The bookings -----------------------------------------------------------------

  newPage(true);
  const textWidth = (key: string) =>
    (COLUMNS.find((column) => column.key === key)?.width ?? 0) - 2 * CELL;
  const columnLeft = (key: string) => {
    let x = MARGIN;
    for (const column of COLUMNS) {
      if (column.key === key) return x;
      x += column.width;
    }
    return x;
  };

  // Room the totals and bank details need below the last row.
  const closingSpace = 120 + (data.bank ? 80 : 0) + (data.voided ? 18 : 0);
  data.lines.forEach((line, index) => {
    const pickup = wrap(line.pickup, regular, 9, textWidth("pickup"), 2);
    const dropoff = wrap(line.dropoff, regular, 9, textWidth("dropoff"), 2);
    const lines = Math.max(pickup.length, dropoff.length, 1);
    const height = Math.max(30, 16 + lines * LINE_HEIGHT);
    const last = index === data.lines.length - 1;
    if (y - height < MARGIN + 40 || (last && y - height < MARGIN + closingSpace)) {
      if (y < tableTop) closeTable();
      newPage(false);
    }

    const rowTop = y;
    const middle = rowTop - height / 2;
    const firstBaseline = middle + ((lines - 1) * LINE_HEIGHT) / 2 - 3;
    const single = middle - 3;
    if (index) hline(MARGIN, MARGIN + CONTENT, rowTop, GRID, 0.6);

    text(
      `${formatDate(line.pickupAt)}, ${formatTime(line.pickupAt)}`,
      columnLeft("date") + CELL,
      single,
      { size: 9 },
    );
    pickup.forEach((part, i) =>
      text(part, columnLeft("pickup") + CELL, firstBaseline - i * LINE_HEIGHT, {
        size: 9,
      }),
    );
    dropoff.forEach((part, i) =>
      text(part, columnLeft("dropoff") + CELL, firstBaseline - i * LINE_HEIGHT, {
        size: 9,
      }),
    );
    text(line.reference, columnLeft("booking") + CELL, single, { size: 9.5 });

    // The status as a pill: green for completed, amber for a no-show.
    const pns = line.status === "PNS";
    const label = clean(line.status);
    const pillWidth = widthOf(label, { font: bold, size: 8.5 }) + 22;
    roundRect(columnLeft("status") + CELL, middle + 8.5, pillWidth, 17, 8.5, {
      fill: pns ? PNS_PILL : PILL,
    });
    text(label, columnLeft("status") + CELL + pillWidth / 2, middle - 3, {
      font: bold,
      size: 8.5,
      color: pns ? PNS_INK : GREEN_DARK,
      align: "center",
    });

    const fareRight = columnLeft("fare") + textWidth("fare") + CELL;
    text(money(line.pricePence), fareRight, single, { size: 9.5, align: "right" });
    const cashRight = columnLeft("cash") + textWidth("cash") + CELL;
    text(money(line.cashPence), cashRight, single, {
      size: 9.5,
      align: "right",
      color: line.cashPence ? INK : MUTED,
    });
    y -= height;
  });
  if (data.lines.length === 0) {
    text("No bookings on this payment.", MARGIN + CELL, y - 20, { color: MUTED });
    y -= 34;
  }
  closeTable();

  // --- Totals ------------------------------------------------------------------------

  // Not enough room left: the totals go on a page of their own.
  if (y < MARGIN + closingSpace) newPage(false, false);
  const anyPns = data.lines.some((line) => line.status === "PNS");
  const boxWidth = 300;
  const boxLeft = PAGE.width - MARGIN - boxWidth;
  y -= 14;
  const rows: [string, string][] = [
    [
      anyPns ? "Completed and PNS bookings" : "Completed bookings",
      String(data.lines.length),
    ],
    ["Total booking fares", money(data.earnedPence)],
    ["Less: cash received by driver", money(data.cashPence)],
  ];
  rows.forEach(([label, value], index) => {
    text(label, boxLeft + 8, y - 16, { size: 10.5 });
    text(value, boxLeft + boxWidth - 8, y - 16, {
      size: 11,
      font: index ? bold : regular,
      align: "right",
    });
    y -= 23;
    hline(boxLeft, boxLeft + boxWidth, y, GRID, 0.6);
  });
  y -= 4;
  const owed = data.amountPence < 0;
  roundRect(boxLeft, y, boxWidth, 30, 6, { fill: TINT_STRONG });
  text(
    owed ? "NET PAID BY DRIVER TO CITYLINE" : "NET PAYMENT TO DRIVER",
    boxLeft + 10,
    y - 19,
    {
      font: bold,
      size: 10.5,
      color: GREEN_DARK,
      spacing: 0.6,
    },
  );
  text(money(Math.abs(data.amountPence)), boxLeft + boxWidth - 10, y - 20.5, {
    font: bold,
    size: 15,
    color: GREEN_DARK,
    align: "right",
  });
  y -= 30;
  if (data.voided) {
    y -= 18;
    text("This payment was voided and does not stand.", boxLeft + 8, y, {
      font: bold,
      color: VOID_RED,
    });
  }

  // --- The driver's bank account, masked --------------------------------------------

  if (data.bank) {
    y -= 14;
    hline(MARGIN, PAGE.width - MARGIN, y);
    y -= 12;
    bankIcon(MARGIN, y, 26);
    const left = MARGIN + 46;
    text("DRIVER BANK DETAILS", left, y - 12, {
      font: bold,
      size: 12,
      color: GREEN,
      spacing: 0.6,
    });
    const details: [string, string, number][] = [
      ["Account holder:", data.bank.holder, 0],
      ["Sort code:", "XX-XX-XX", 200],
      ["Account number:", `•••• •••• ${data.bank.last4}`, 340],
    ];
    details.forEach(([label, value, offset], index) => {
      if (index) vline(left + offset - 18, y - 20, y - 50, RULE);
      text(label, left + offset, y - 29, { size: 9.5, color: MUTED });
      text(value, left + offset, y - 45, { size: 11.5, font: bold });
    });
  }

  // --- Footer on every page ------------------------------------------------------------

  pages.forEach((each, index) => {
    page = each;
    hline(MARGIN, PAGE.width - 250, MARGIN + 2, RULE);
    text(
      [
        data.company.name,
        `Statement ${data.reference}`,
        `Produced ${formatDate(data.generatedAt)}`,
        ...(pages.length > 1 ? [`Page ${index + 1} of ${pages.length}`] : []),
      ].join("   ·   "),
      MARGIN,
      MARGIN - 12,
      { size: 8.5, color: MUTED },
    );
  });

  return pdf.save();
}
