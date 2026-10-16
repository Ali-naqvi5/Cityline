import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";

import { formatPence, type Pence } from "@/domain/money";
import { formatDate, formatTime } from "@/lib/time";

import { paymentPeriod } from "./driver-pay";
import { drawable, fit } from "./pdf-text";

/**
 * A driver's payment statement as a PDF (Driver Pay). It is drawn to
 * Cityline's mock-up and design brief of 13 Oct 2026: the logo, who was paid,
 * when and how, every booking it covers with its pickup, drop-off, price and
 * any cash the driver collected, the totals, and the driver's bank details for
 * a bank transfer (sort code in full, account number masked). It is a
 * statement of payment for bookings, not an invoice or a payslip: drivers are
 * independent, and an invoice would be theirs.
 *
 * Every position and size below is in the mock-up's pixels, 1491 × 1055 for an
 * A4 landscape page; `K` turns them into points. Text is Montserrat, embedded
 * and subset; the corners and icons are vector shapes; the logo is the
 * site's own file, split into its picture and its name
 * (`lib/statement-assets.ts`). A long statement continues on pages with a
 * smaller header (the logo only); every page has the footer with its page
 * number (Cityline, 13 Oct 2026). A bank transfer's receipt, if one was
 * added, is printed by itself on the last page. The driver's share of any
 * partner penalties is listed under the bookings and taken off in the totals
 * as "Less: penalties" (Cityline, 16 Oct 2026). Text the font cannot draw is
 * replaced, so an unusual character in an address never stops a statement
 * being produced.
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

/** A partner penalty the driver bears a share of, taken off this payment. */
export interface StatementPenalty {
  penalisedAt: Date;
  /** The booking it was for. */
  reference: string;
  reason: string;
  /** The driver's share, taken off. */
  amountPence: number;
}

export interface StatementData {
  reference: string;
  paidAt: Date;
  /** The period it covers: from the day after the driver's last payment. */
  periodFrom: Date;
  upTo: Date;
  method: string;
  bankReference: string | null;
  voided: boolean;
  driverName: string;
  /**
   * Under the name: "PHV licence 123456" for a driver; for a subcontracting
   * operator, their licence and who licensed them.
   */
  licence: string | null;
  /**
   * The account paid into, for a bank transfer only: the sort code in full
   * (null when it cannot be read) and the account number's last four digits.
   */
  bank: { holder: string; sortCode: string | null; last4: string } | null;
  lines: StatementLine[];
  earnedPence: number;
  cashPence: number;
  /** Penalties taken off; none on payments before 16 Oct 2026. */
  penalties?: StatementPenalty[];
  penaltiesPence?: number;
  amountPence: number;
  company: { name: string; address: string; phone: string; email: string };
  generatedAt: Date;
  /**
   * The bank transfer receipt as a JPEG, if one was added: printed on its own
   * as the last page, as proof of the payment (Cityline, 13 Oct 2026).
   */
  receipt?: Uint8Array | null;
}

/** The fonts and logo a statement is drawn with (`lib/statement-assets.ts`). */
export interface StatementAssets {
  fonts: { regular: Uint8Array; semibold: Uint8Array; bold: Uint8Array };
  /**
   * The logo's picture and its name as PNGs; `name` is null when the logo
   * could not be split, and the whole logo is the picture.
   */
  logo: { mark: Uint8Array; name: Uint8Array | null } | null;
}

const PAGE = { width: 841.89, height: 595.28 };
/** Points per mock-up pixel. */
const K = PAGE.width / 1491;
const LEFT = 57;
const RIGHT = 1435;
const WIDTH = RIGHT - LEFT;
/** Montserrat's capital letters, as a share of its size. */
const CAP = 0.7;
/** Rows stop here on a page that continues, clear of the bottom corner. */
const ROWS_BOTTOM = 950;
/** The totals and bank details after the last row, and where they must end. */
const CLOSING = 24 + 200 + 25 + 126;
/** The totals' extra row when penalties are taken off. */
const PENALTY_ROW = 46;
const CLOSING_BOTTOM = 960;

const hex = (value: string): RGB =>
  rgb(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
  );
const INK = hex("#1f313b");
const MUTED = hex("#5d6a72");
const BRAND = hex("#2aa434");
const GREEN = hex("#1f9a43");
const GREEN_TEXT = hex("#00852f");
const GREEN_DARK = hex("#006b32");
const BAND = hex("#f2f9f4");
const PANEL = hex("#f6faf7");
const NET_ROW = hex("#e6f4ea");
const NET_RULE = hex("#9dc5a8");
const TABLE_HEAD = hex("#edf7f0");
const BORDER = hex("#cbe8d4");
const BANK_BORDER = hex("#d7ecde");
const BANK_FILL = hex("#fbfdfb");
const GRID = hex("#d6eadf");
const SOFT_GRID = hex("#e3efe7");
const DIVIDER = hex("#8dc39d");
const TITLE_RULE = hex("#9cc8ab");
const PILL = hex("#d3f2db");
const PNS_PILL = hex("#e4eee7");
const CORNER_DARK = hex("#1f7d45");
const CORNER_LIGHT = hex("#7cc44a");
const CORNER_GREEN = hex("#45b04f");
const VOID_RED = hex("#c0261b");

const money = (pence: number) => formatPence(pence as Pence);

/**
 * Icons on a 24-unit grid with the box their ink fills ([x, y, width,
 * height]). Material Icons (Apache 2.0) but the coins, drawn here as lines.
 */
const ICONS = {
  pin: {
    d: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
    box: [5, 2, 14, 20],
  },
  phone: {
    d: "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z",
    box: [3, 3, 18, 18],
  },
  mail: {
    d: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
    box: [2, 4, 20, 16],
  },
  person: {
    d: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    box: [4, 4, 16, 16],
  },
  calendar: {
    d: "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z",
    box: [3, 2, 18, 20],
  },
  card: {
    d: "M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z",
    box: [2, 4, 20, 16],
  },
  document: {
    d: "M8 16h8v2H8zm0-4h8v2H8zm6-10H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z",
    box: [4, 2, 16, 20],
  },
  bank: {
    d: "M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z",
    box: [2, 1, 19, 21],
  },
  coins: {
    d:
      "M4 5.5 A8 2.6 0 1 0 20 5.5 A8 2.6 0 1 0 4 5.5 Z M4 5.5 V18.5 M20 5.5 V18.5 " +
      "M4 9.8 A8 2.6 0 0 0 20 9.8 M4 14.1 A8 2.6 0 0 0 20 14.1 M4 18.5 A8 2.6 0 0 0 20 18.5",
    box: [3.2, 2.1, 17.6, 19.8],
    stroke: true,
  },
} as const;
type Icon = keyof typeof ICONS;

/** The table's columns, left to right; they fill the content width. */
const COLUMNS = [
  { key: "date", label: "DATE", width: 180 },
  { key: "pickup", label: "PICKUP", width: 284 },
  { key: "dropoff", label: "DROPOFF", width: 269 },
  { key: "booking", label: "BOOKING REF", width: 160 },
  { key: "status", label: "STATUS", width: 180 },
  { key: "fare", label: "FARE", width: 159 },
  { key: "cash", label: "CASH RECEIVED", width: 146 },
] as const;
type Column = (typeof COLUMNS)[number]["key"];
/** The penalties' table, under the bookings: the same width. */
const PENALTY_COLUMNS = [
  { key: "date", label: "DATE", width: 180 },
  { key: "booking", label: "BOOKING REF", width: 200 },
  { key: "reason", label: "REASON", width: 798 },
  { key: "amount", label: "TAKEN OFF", width: 200 },
] as const;
type PenaltyColumn = (typeof PENALTY_COLUMNS)[number]["key"];
type TableColumn = { key: string; label: string; width: number };
const PAD = 20;
const ROW_TEXT = 14.5;
const ROW_LINE = 22;

export async function statementPdf(
  data: StatementData,
  assets: StatementAssets,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Payment statement ${data.reference}`);
  pdf.setAuthor(data.company.name);
  pdf.setCreationDate(data.generatedAt);
  const [regular, semibold, bold] = await Promise.all([
    pdf.embedFont(assets.fonts.regular, { subset: true }),
    pdf.embedFont(assets.fonts.semibold, { subset: true }),
    pdf.embedFont(assets.fonts.bold, { subset: true }),
  ]);
  const mark = assets.logo ? await pdf.embedPng(assets.logo.mark) : null;
  const name = assets.logo?.name ? await pdf.embedPng(assets.logo.name) : null;
  const clean = drawable(regular);

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  /** Down the page, in mock-up pixels. */
  let y = 0;

  // --- Drawing helpers, in mock-up pixels from the page's top-left corner ----------

  type TextOptions = {
    size: number;
    font?: PDFFont;
    color?: RGB;
    align?: "left" | "right" | "center";
    opacity?: number;
  };
  const widthOf = (value: string, size: number, font: PDFFont = regular) =>
    font.widthOfTextAtSize(clean(value), size);
  /** Text by its baseline; returns its width. */
  const text = (value: string, x: number, baseline: number, options: TextOptions) => {
    const safe = clean(value);
    const font = options.font ?? regular;
    const width = font.widthOfTextAtSize(safe, options.size);
    const left =
      options.align === "right"
        ? x - width
        : options.align === "center"
          ? x - width / 2
          : x;
    page.drawText(safe, {
      x: left * K,
      y: PAGE.height - baseline * K,
      size: options.size * K,
      font,
      color: options.color ?? INK,
      opacity: options.opacity,
    });
    return width;
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
  type ShapeOptions = {
    x?: number;
    y?: number;
    scale?: number;
    fill?: RGB;
    border?: RGB;
    borderWidth?: number;
    opacity?: number;
  };
  /** An SVG path, placed by its origin; line widths are in its own units. */
  const shape = (path: string, options: ShapeOptions) =>
    page.drawSvgPath(path, {
      x: (options.x ?? 0) * K,
      y: PAGE.height - (options.y ?? 0) * K,
      scale: K * (options.scale ?? 1),
      color: options.fill,
      borderColor: options.border,
      borderWidth: options.border ? (options.borderWidth ?? 1) : undefined,
      opacity: options.opacity,
      borderOpacity: options.opacity,
    });
  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: RGB,
    thickness = 1,
  ) =>
    page.drawLine({
      start: { x: x1 * K, y: PAGE.height - y1 * K },
      end: { x: x2 * K, y: PAGE.height - y2 * K },
      thickness: thickness * K,
      color,
    });
  /** A rounded rectangle by its top-left corner; `square` squares two corners. */
  const box = (
    x: number,
    top: number,
    width: number,
    height: number,
    radius: number,
    options: ShapeOptions & { square?: "top" | "bottom" },
  ) => {
    const r = Math.min(radius, width / 2, height / 2);
    const t = options.square === "top" ? 0 : r;
    const b = options.square === "bottom" ? 0 : r;
    const w = width;
    const h = height;
    shape(
      `M ${t} 0 L ${w - t} 0 Q ${w} 0 ${w} ${t} L ${w} ${h - b} Q ${w} ${h} ${w - b} ${h} ` +
        `L ${b} ${h} Q 0 ${h} 0 ${h - b} L 0 ${t} Q 0 0 ${t} 0 Z`,
      { ...options, x, y: top },
    );
  };
  /** An icon by its top-left corner and height; returns its width. */
  const icon = (kind: Icon, x: number, top: number, height: number, color = GREEN) => {
    const glyph = ICONS[kind];
    const [bx, by, bw, bh] = glyph.box;
    const scale = height / bh;
    shape(glyph.d, {
      x: x - bx * scale,
      y: top - by * scale,
      scale,
      ...("stroke" in glyph ? { border: color, borderWidth: 1.7 } : { fill: color }),
    });
    return bw * scale;
  };
  /** A picture by its top-left corner and height; returns its width. */
  const picture = (
    image: PDFImage,
    x: number,
    top: number,
    height: number,
    opacity?: number,
  ) => {
    const width = (image.width / image.height) * height;
    page.drawImage(image, {
      x: x * K,
      y: PAGE.height - (top + height) * K,
      width: width * K,
      height: height * K,
      opacity,
    });
    return width;
  };

  // --- What every page has ----------------------------------------------------------

  /** The logo, its picture with its name beside it, at a share of full size. */
  const logo = (x: number, top: number, scale: number) => {
    if (mark && name) {
      picture(mark, x, top, 142 * scale);
      picture(name, x + 230 * scale, top + 45 * scale, 75 * scale);
    } else if (mark) {
      picture(mark, x, top, 142 * scale);
    } else {
      text("CITYLINE", x, top + 92 * scale, { size: 74 * scale, font: bold });
      text("AIRPORT TRANSFERS", x, top + 122 * scale, { size: 26 * scale, font: bold });
    }
  };

  /** The faint logo and the corners. */
  const decorate = (watermark: boolean) => {
    if (mark && watermark) {
      picture(mark, 244, 500, 430, 0.05);
    }
    shape("M0 0 L95 0 L95 24 C60 46 30 66 0 96 Z", { fill: CORNER_LIGHT });
    shape("M0 0 H186 C140 8 60 32 0 75 Z", { fill: CORNER_DARK });
    shape("M1335 0 C1380 8 1440 22 1491 47 V0 Z", { fill: BRAND });
    shape("M1316 21 C1380 17 1450 32 1491 57 V71 C1450 42 1385 24 1316 21 Z", {
      fill: INK,
    });
    shape(
      "M1141 1055 C1250 1022 1380 985 1491 953 V976 C1420 990 1300 1030 1186 1055 Z",
      { fill: CORNER_GREEN },
    );
    shape("M1186 1055 C1300 1035 1420 995 1491 984 V1055 Z", { fill: INK });
  };

  // --- The first page's header ---------------------------------------------------------

  const fullHeader = () => {
    logo(49, 33, 1);
    line(899.5, 70, 899.5, 161, GREEN, 1.5);

    // DRIVER PAYMENT STATEMENT, in two greens, fitted beside the divider.
    const first = "DRIVER ";
    const rest = "PAYMENT STATEMENT";
    const size = Math.min(31, (31 * (RIGHT - 932)) / widthOf(first + rest, 31, bold));
    const restWidth = widthOf(rest, size, bold);
    text(rest, RIGHT, 104.5, { size, font: bold, color: GREEN_DARK, align: "right" });
    text(first, RIGHT - restWidth, 104.5, {
      size,
      font: bold,
      color: GREEN,
      align: "right",
    });
    line(930, 121.5, RIGHT, 121.5, TITLE_RULE, 1.2);
    text(data.reference, RIGHT - 1, 160.5, { size: 27, font: semibold, align: "right" });

    // How to reach Cityline.
    let x = 61;
    const contact: [Icon, string, number][] = [
      ["pin", data.company.address, 23],
      ["phone", data.company.phone, 20],
      ["mail", data.company.email, 17],
    ];
    contact.forEach(([kind, value, height], index) => {
      if (index) {
        x += 24;
        line(x, 196, x, 218, DIVIDER, 1);
        x += 23;
      }
      x += icon(kind, x, 207.5 - height / 2, height) + 19;
      x += text(value, x, 212.5, { size: 16 });
    });
    line(LEFT, 241, RIGHT, 241, BRAND, 2);

    // Paid to, when, how, and what it covers.
    box(LEFT, 269, WIDTH, 110, 9, { fill: BAND });
    for (const divider of [403, 704, 1096])
      line(divider, 286, divider, 362, DIVIDER, 1.2);
    const label = (value: string, x: number) =>
      text(value, x, 303.5, { size: 15.5, font: bold, color: GREEN_TEXT });

    icon("person", 79, 290, 24);
    label("PAID TO", 126);
    text(fit(clean(data.driverName), semibold, 17, 403 - 126 - 16), 126, 332.5, {
      size: 17,
      font: semibold,
    });
    if (data.licence) {
      // One line for a driver's PHV licence; an operator's licence and its
      // council may need two, a little smaller.
      const room = 403 - 126 - 16;
      const parts = data.licence.split(" · ");
      const lines =
        widthOf(data.licence, 13.5) <= room
          ? [clean(data.licence)]
          : parts.length === 2 && parts.every((part) => widthOf(part, 12) <= room)
            ? parts.map((part) => clean(part))
            : wrap(data.licence, regular, 12, room, 2);
      const size = lines.length > 1 || widthOf(data.licence, 13.5) > room ? 12 : 13.5;
      lines.forEach((line, index) =>
        text(line, 126, (lines.length > 1 ? 352 : 356) + index * 15, {
          size,
          color: MUTED,
        }),
      );
    }

    icon("calendar", 436, 289, 26);
    label("DATE PAID", 478);
    text(formatDate(data.paidAt), 478, 332.5, { size: 17, font: semibold });

    icon("card", 736, 291, 22);
    label("PAYMENT METHOD", 787);
    const method =
      data.method + (data.bankReference ? `  ·  Reference ${data.bankReference}` : "");
    const methodWidth = 1096 - 787 - 16;
    (widthOf(method, 15) <= methodWidth
      ? [method]
      : wrap(method, regular, 15, methodWidth, 2)
    ).forEach((part, index) => text(part, 787, 333.5 + index * 25, { size: 15 }));

    icon("document", 1128, 289, 26);
    label("COVERS", 1173);
    ["Completed and PNS bookings", paymentPeriod(data.periodFrom, data.upTo)].forEach(
      (part, index) => text(part, 1173, 333.5 + index * 25, { size: 15 }),
    );

    y = 401;
  };

  // --- The table --------------------------------------------------------------------

  const columnLeft = (key: Column) => {
    let x = LEFT;
    for (const column of COLUMNS) {
      if (column.key === key) return x;
      x += column.width;
    }
    return x;
  };
  const textWidth = (key: Column) =>
    (COLUMNS.find((column) => column.key === key)?.width ?? 0) - 2 * PAD;
  const penaltyLeft = (key: PenaltyColumn) => {
    let x = LEFT;
    for (const column of PENALTY_COLUMNS) {
      if (column.key === key) return x;
      x += column.width;
    }
    return x;
  };

  /** The table being drawn: the bookings, then any penalties. */
  let columns: readonly TableColumn[] = COLUMNS;
  let tableTop = 0;
  let rowsOnPage = 0;
  const tableHeader = () => {
    tableTop = y;
    rowsOnPage = 0;
    box(LEFT, y, WIDTH, 43.5, 8, { fill: TABLE_HEAD, square: "bottom" });
    let x = LEFT;
    for (const column of columns) {
      text(column.label, x + PAD, y + 28.5, {
        size: 14,
        font: semibold,
        color: GREEN_TEXT,
      });
      x += column.width;
    }
    y += 43.5;
    line(LEFT, y, RIGHT, y, GRID);
  };
  /** The column lines and border, once this page's rows are drawn. */
  const closeTable = () => {
    let x = LEFT;
    for (const column of columns.slice(0, -1)) {
      x += column.width;
      line(x, tableTop, x, y, GRID);
    }
    box(LEFT, tableTop, WIDTH, y - tableTop, 8, { border: GRID, borderWidth: 1.2 });
  };

  const newPage = (first: boolean, withTable = true, watermark = true) => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    decorate(watermark);
    if (first) {
      fullHeader();
    } else {
      logo(49, 33, 0.6);
      y = 145;
    }
    if (withTable) tableHeader();
  };

  // --- The bookings -----------------------------------------------------------------

  const penalties = data.penalties ?? [];
  const penaltiesPence = data.penaltiesPence ?? 0;
  const closing = CLOSING + (penaltiesPence ? PENALTY_ROW : 0);
  newPage(true);
  const rowCap = ROW_TEXT * CAP;
  data.lines.forEach((entry, index) => {
    const pickup = wrap(entry.pickup, regular, ROW_TEXT, textWidth("pickup"), 3);
    const dropoff = wrap(entry.dropoff, regular, ROW_TEXT, textWidth("dropoff"), 3);
    const lines = Math.max(pickup.length, dropoff.length, 1);
    const block = rowCap + (lines - 1) * ROW_LINE;
    const height = Math.max(46, block + 35);
    // A row is never split; the last one stays with the totals, unless
    // the penalties come between.
    const last = index === data.lines.length - 1 && penalties.length === 0;
    if (
      y + height > ROWS_BOTTOM ||
      (last && y + height + closing > CLOSING_BOTTOM && rowsOnPage > 0)
    ) {
      closeTable();
      newPage(false);
    }

    if (rowsOnPage) line(LEFT, y, RIGHT, y, GRID);
    const middle = y + height / 2;
    // Each cell's lines centred in the row on their own.
    const firstLine = (count: number) =>
      middle - (rowCap + (count - 1) * ROW_LINE) / 2 + rowCap;
    const single = middle + rowCap / 2 - 0.5;
    text(
      `${formatDate(entry.pickupAt)}, ${formatTime(entry.pickupAt)}`,
      columnLeft("date") + PAD,
      single,
      { size: ROW_TEXT },
    );
    for (const [key, parts] of [
      ["pickup", pickup],
      ["dropoff", dropoff],
    ] as const) {
      parts.forEach((part, i) =>
        text(part, columnLeft(key) + PAD, firstLine(parts.length) + i * ROW_LINE, {
          size: ROW_TEXT,
        }),
      );
    }
    text(entry.reference, columnLeft("booking") + PAD, single, { size: ROW_TEXT });

    // The status as a pill.
    const pns = entry.status === "PNS";
    const status = clean(entry.status);
    const pillLeft = columnLeft("status") + 25;
    const pillWidth = widthOf(status, 13.5, semibold) + 42;
    box(pillLeft, middle - 14.5, pillWidth, 29, 14.5, { fill: pns ? PNS_PILL : PILL });
    text(status, pillLeft + pillWidth / 2, middle + (13.5 * CAP) / 2, {
      size: 13.5,
      font: semibold,
      color: pns ? GREEN_DARK : GREEN_TEXT,
      align: "center",
    });

    text(money(entry.pricePence), columnLeft("fare") + PAD, single, { size: ROW_TEXT });
    text(money(entry.cashPence), columnLeft("cash") + PAD, single, { size: ROW_TEXT });
    y += height;
    rowsOnPage++;
  });
  if (data.lines.length === 0) {
    text("No bookings on this payment.", LEFT + PAD, y + 28, {
      size: ROW_TEXT,
      color: MUTED,
    });
    y += 46;
  }
  closeTable();

  // --- The penalties taken off, under the bookings --------------------------------------

  if (penalties.length) {
    // Each reason on up to two lines, measured once.
    const reasonWidth = PENALTY_COLUMNS[2].width - 2 * PAD;
    const rowsOf = penalties.map((entry) => {
      const reasons = wrap(entry.reason, regular, ROW_TEXT, reasonWidth, 2);
      const block = rowCap + (Math.max(reasons.length, 1) - 1) * ROW_LINE;
      return { reasons, height: Math.max(46, block + 35) };
    });
    // The heading stays with the table's header and its first row; a lone
    // penalty that cannot stay with the totals takes its heading over too,
    // so the totals never stand on a page by themselves.
    const opening = y + 50 + 43.5 + rowsOf[0]!.height;
    if (
      opening > ROWS_BOTTOM ||
      (penalties.length === 1 && opening + closing > CLOSING_BOTTOM)
    ) {
      newPage(false, false);
      y -= 24;
    }
    text("PENALTIES TAKEN OFF", LEFT, y + 38, {
      size: 15.5,
      font: bold,
      color: GREEN_TEXT,
    });
    y += 50;
    columns = PENALTY_COLUMNS;
    tableHeader();
    penalties.forEach((entry, index) => {
      const { reasons, height } = rowsOf[index]!;
      const last = index === penalties.length - 1;
      if (
        y + height > ROWS_BOTTOM ||
        (last && y + height + closing > CLOSING_BOTTOM && rowsOnPage > 0)
      ) {
        closeTable();
        newPage(false);
      }
      if (rowsOnPage) line(LEFT, y, RIGHT, y, GRID);
      const middle = y + height / 2;
      const single = middle + rowCap / 2 - 0.5;
      text(formatDate(entry.penalisedAt), penaltyLeft("date") + PAD, single, {
        size: ROW_TEXT,
      });
      text(entry.reference, penaltyLeft("booking") + PAD, single, { size: ROW_TEXT });
      const first = middle - (rowCap + (reasons.length - 1) * ROW_LINE) / 2 + rowCap;
      reasons.forEach((part, i) =>
        text(part, penaltyLeft("reason") + PAD, first + i * ROW_LINE, {
          size: ROW_TEXT,
        }),
      );
      text(money(entry.amountPence), penaltyLeft("amount") + PAD, single, {
        size: ROW_TEXT,
      });
      y += height;
      rowsOnPage++;
    });
    closeTable();
  }

  // --- Totals -----------------------------------------------------------------------

  if (y + closing > CLOSING_BOTTOM) {
    newPage(false, false);
    y -= 24;
  }
  const top = y + 24;
  const panelLeft = 852;
  const panelWidth = RIGHT - panelLeft;

  const anyPns = data.lines.some((entry) => entry.status === "PNS");
  const rows: [string, string, number][] = [
    [
      anyPns ? "Completed and PNS bookings" : "Completed bookings",
      String(data.lines.length),
      48,
    ],
    ["Total booking fares", money(data.earnedPence), 46],
    ["Less: cash received by driver", money(data.cashPence), 46.5],
  ];
  if (penaltiesPence) rows.push(["Less: penalties", money(penaltiesPence), PENALTY_ROW]);
  // The net row sits under the others; the panel grows with a penalties row.
  const netTop = top + rows.reduce((sum, [, , height]) => sum + height, 0);
  const panelHeight = netTop - top + 59.5;
  box(panelLeft, top, panelWidth, panelHeight, 9, { fill: PANEL, opacity: 0.92 });
  box(panelLeft, netTop, panelWidth, 59.5, 9, { fill: NET_ROW, square: "top" });
  box(panelLeft, top, panelWidth, panelHeight, 9, { border: BORDER, borderWidth: 1.2 });

  let rowTop = top;
  rows.forEach(([label, value, height], index) => {
    const middle = rowTop + height / 2;
    text(label, 875, middle + (15 * CAP) / 2, { size: 15 });
    text(value, 1419, middle + (18 * CAP) / 2, {
      size: 18,
      font: semibold,
      align: "right",
    });
    if (index < rows.length - 1) {
      line(872, rowTop + height, 1416, rowTop + height, SOFT_GRID);
    }
    rowTop += height;
  });
  line(872, netTop, 1416, netTop, NET_RULE, 1.5);

  // What Cityline pays the driver, or what the driver owes when their cash
  // and penalties came to more than their bookings.
  const owed = data.amountPence < 0;
  icon("coins", 876, netTop + 13.5, 31);
  text(
    owed ? "NET PAID BY DRIVER TO CITYLINE" : "NET PAYMENT TO DRIVER",
    923,
    netTop + 35,
    {
      size: 15.5,
      font: bold,
      color: GREEN_DARK,
    },
  );
  text(money(Math.abs(data.amountPence)), 1419, netTop + 39, {
    size: 26,
    font: bold,
    color: GREEN_DARK,
    align: "right",
  });
  if (data.voided) {
    text("This payment was voided and does not stand.", LEFT, netTop + 35, {
      size: 15,
      font: bold,
      color: VOID_RED,
    });
  }

  // --- The driver's bank account; for cash, the space stays empty ---------------------

  if (data.bank) {
    const bankTop = top + panelHeight + 25;
    box(LEFT, bankTop, WIDTH, 126, 9, { fill: BANK_FILL, opacity: 0.85 });
    box(LEFT, bankTop, WIDTH, 126, 9, { border: BANK_BORDER, borderWidth: 1.2 });
    icon("bank", 77, bankTop + 24, 44);
    text("DRIVER BANK DETAILS", 148, bankTop + 35.5, {
      size: 17,
      font: bold,
      color: GREEN_TEXT,
    });
    const fields: [string, string, number, number][] = [
      ["Account holder:", data.bank.holder, 148, 370],
      ["Sort code:", data.bank.sortCode ?? "Not on record", 419, 599],
    ];
    fields.forEach(([label, value, x, end], index) => {
      if (index) line(x - 49, bankTop + 50, x - 49, bankTop + 105, DIVIDER, 1.2);
      text(label, x, bankTop + 67.5, { size: 14 });
      text(fit(clean(value), semibold, 16.5, end - x - 16), x, bankTop + 95.5, {
        size: 16.5,
        font: semibold,
      });
    });
    // The account number masked: two groups of four dots, then its last four digits.
    line(599, bankTop + 50, 599, bankTop + 105, DIVIDER, 1.2);
    text("Account number:", 648, bankTop + 67.5, { size: 14 });
    let dot = 651.4;
    for (let i = 0; i < 8; i++) {
      page.drawCircle({
        x: dot * K,
        y: PAGE.height - (bankTop + 90) * K,
        size: 3.4 * K,
        color: INK,
      });
      dot += i === 3 ? 19 : 11.5;
    }
    text(data.bank.last4, dot + 4, bankTop + 95.5, { size: 16.5, font: semibold });
  }

  // --- The bank transfer receipt, by itself on the last page ----------------------------

  if (data.receipt) {
    const receipt = await pdf.embedJpg(data.receipt);
    // A plain page for the proof: no faint logo behind it.
    newPage(false, false, false);
    text("BANK TRANSFER RECEIPT", 745.5, 160, {
      size: 15.5,
      font: bold,
      color: GREEN_TEXT,
      align: "center",
    });
    // Fitted into the page below the heading, centred both ways, framed.
    const area = { top: 185, bottom: 955, width: 1150 };
    const scale = Math.min(
      area.width / receipt.width,
      (area.bottom - area.top) / receipt.height,
    );
    const width = receipt.width * scale;
    const height = receipt.height * scale;
    const left = 745.5 - width / 2;
    const top = area.top + (area.bottom - area.top - height) / 2;
    picture(receipt, left, top, height);
    box(left, top, width, height, 0, { border: GRID, borderWidth: 1.2 });
  }

  // --- The footer, on every page with its number -----------------------------------------

  pages.forEach((each, index) => {
    page = each;
    text(
      [
        data.company.name,
        `Statement ${data.reference}`,
        `Produced ${formatDate(data.generatedAt)}`,
        `Page ${index + 1} of ${pages.length}`,
      ].join("   ·   "),
      60,
      998.5,
      { size: 12.5 },
    );
  });

  // VOID across every page of a voided payment's statement, over everything.
  if (data.voided) {
    for (const each of pages) {
      page = each;
      text("VOID", 745, 690, {
        size: 230,
        font: bold,
        color: VOID_RED,
        align: "center",
        opacity: 0.12,
      });
    }
  }

  return pdf.save();
}
