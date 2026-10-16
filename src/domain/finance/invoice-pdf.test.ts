import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { invoicePdf, type InvoiceData } from "./invoice-pdf";

const data: InvoiceData = {
  number: "INV-000007",
  issuedAt: new Date("2026-10-06T11:00:00Z"),
  dueAt: new Date("2026-11-05T11:00:00Z"),
  termsDays: 30,
  voided: false,
  partner: {
    name: "Trip.com",
    billingAddress: "1 Example Street\nLondon\nEC1A 1AA",
    contactName: "Accounts team",
  },
  lines: [
    {
      pickupAt: new Date("2026-10-01T09:00:00Z"),
      reference: "J-000001",
      supplierReference: "TRIP-100",
      route: "Heathrow Terminal 5 to 10 Wren Avenue, Uxbridge",
      status: "Completed",
      amountPence: 6000,
    },
  ],
  totalPence: 6000,
  company: {
    legalName: "Cityline Airport Transfers Limited",
    address: "Hillingdon House, Wren Avenue, Uxbridge, UB10 0FD",
    phone: "+44 7926 608888",
    email: "bookings@citylineairporttransfers.com",
    companyNumber: null,
  },
  generatedAt: new Date("2026-10-06T11:05:00Z"),
};

describe("the partner invoice PDF", () => {
  it("is a one-page PDF for a short invoice", async () => {
    const pdf = await PDFDocument.load(await invoicePdf(data));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Invoice INV-000007");
  });

  it("shows a partner's penalties as minus lines, still on one page", async () => {
    const pdf = await PDFDocument.load(
      await invoicePdf({
        ...data,
        penalties: [
          {
            penalisedAt: new Date("2026-10-03T12:00:00Z"),
            reference: "J-000001",
            supplierReference: "TRIP-100",
            reason: "Driver 20 minutes late — passenger complained",
            amountPence: 1000,
          },
        ],
        totalPence: 5000,
      }),
    );
    expect(pdf.getPageCount()).toBe(1);
  });

  it("runs on to more pages, and survives odd characters and a void", async () => {
    const lines = Array.from({ length: 70 }, (_, index) => ({
      ...data.lines[0]!,
      reference: `J-${String(index + 1).padStart(6, "0")}`,
      route: index === 0 ? "Zürich → 東京 😀" : data.lines[0]!.route,
    }));
    const pdf = await PDFDocument.load(
      await invoicePdf({
        ...data,
        lines,
        voided: true,
        partner: { ...data.partner, billingAddress: null },
      }),
    );
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
