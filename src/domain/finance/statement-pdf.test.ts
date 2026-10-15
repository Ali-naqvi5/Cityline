import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { statementAssets } from "@/lib/statement-assets";

import { statementPdf, type StatementAssets, type StatementData } from "./statement-pdf";

let assets: StatementAssets;
beforeAll(async () => {
  assets = await statementAssets();
});

const data: StatementData = {
  reference: "DP-000012",
  paidAt: new Date("2026-10-06T11:00:00Z"),
  periodFrom: new Date("2026-09-29T11:00:00Z"),
  upTo: new Date("2026-10-05T11:00:00Z"),
  method: "Bank transfer",
  bankReference: "CITYLINE 12",
  voided: false,
  driverName: "Sam Taylor",
  licence: "PHV licence 123456",
  bank: { holder: "Sam Taylor", sortCode: "12-34-56", last4: "4821" },
  lines: [
    {
      pickupAt: new Date("2026-10-01T09:00:00Z"),
      reference: "J-000001",
      pickup: "Atlantis House, Rectory Road, Woodham Walter, Maldon",
      dropoff: "Heathrow Airport, Terminal 5",
      status: "Completed",
      pricePence: 3500,
      cashPence: 0,
    },
  ],
  earnedPence: 3500,
  cashPence: 0,
  amountPence: 3500,
  company: {
    name: "Cityline Airport Transfers",
    address: "Hillingdon House, Wren Avenue, Uxbridge, UB10 0FD",
    phone: "+44 7926 608888",
    email: "bookings@citylineairporttransfers.com",
  },
  generatedAt: new Date("2026-10-06T11:05:00Z"),
};

describe("the payment statement PDF", () => {
  it("is a one-page PDF for a short statement", async () => {
    const bytes = await statementPdf(data, assets);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Payment statement DP-000012");
  });

  it("runs on to more pages for a long statement", async () => {
    const lines = Array.from({ length: 70 }, (_, index) => ({
      ...data.lines[0]!,
      reference: `J-${String(index + 1).padStart(6, "0")}`,
    }));
    const pdf = await PDFDocument.load(
      await statementPdf(
        { ...data, lines, earnedPence: 3500 * 70, amountPence: 3500 * 70 },
        assets,
      ),
    );
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("draws the logo from the site's own file, its picture and name apart", () => {
    expect(assets.logo?.mark.length).toBeGreaterThan(1000);
    expect(assets.logo?.name?.length).toBeGreaterThan(1000);
  });

  it("keeps two bookings, the totals and the bank details on one page", async () => {
    const pdf = await PDFDocument.load(
      await statementPdf({ ...data, lines: [data.lines[0]!, data.lines[0]!] }, assets),
    );
    expect(pdf.getPageCount()).toBe(1);
  });

  it("puts a bank transfer receipt by itself on an extra last page", async () => {
    const receipt = new Uint8Array(
      await sharp({
        create: { width: 600, height: 900, channels: 3, background: "#dddddd" },
      })
        .jpeg()
        .toBuffer(),
    );
    const pages = async (with_: boolean) =>
      (
        await PDFDocument.load(
          await statementPdf({ ...data, receipt: with_ ? receipt : null }, assets),
        )
      ).getPageCount();
    expect(await pages(true)).toBe((await pages(false)) + 1);
  });

  it("is not stopped by characters the font cannot draw, or a driver owing money", async () => {
    const bytes = await statementPdf(
      {
        ...data,
        voided: true,
        lines: [
          {
            ...data.lines[0]!,
            pickup: "Heathrow → Zürich Straße 東京 😀",
            status: "PNS",
            cashPence: 9000,
          },
        ],
        cashPence: 9000,
        amountPence: -5500,
        bank: null,
      },
      assets,
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
