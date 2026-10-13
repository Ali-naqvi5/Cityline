import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { statementPdf, type StatementData } from "./statement-pdf";

const data: StatementData = {
  reference: "DP-000012",
  paidAt: new Date("2026-10-06T11:00:00Z"),
  upTo: new Date("2026-10-05T11:00:00Z"),
  method: "Bank transfer",
  bankReference: "CITYLINE 12",
  voided: false,
  driverName: "Sam Taylor",
  phvNumber: "123456",
  bank: { holder: "Sam Taylor", last4: "4821" },
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
    const bytes = await statementPdf(data);
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
      await statementPdf({
        ...data,
        lines,
        earnedPence: 3500 * 70,
        amountPence: 3500 * 70,
      }),
    );
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("uses the office's own logo picture when one is given", async () => {
    // A one-pixel PNG.
    const logo = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    );
    const plain = await statementPdf(data);
    const withLogo = await statementPdf({ ...data, logo });
    expect((await PDFDocument.load(withLogo)).getPageCount()).toBe(1);
    expect(withLogo.length).not.toBe(plain.length);
  });

  it("is not stopped by characters the font cannot draw, or a driver owing money", async () => {
    const bytes = await statementPdf({
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
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
