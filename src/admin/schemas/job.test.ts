import { describe, expect, it } from "vitest";

import { jobData, jobForm, jobSchema } from "./job";

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  const base: Record<string, string | string[]> = {
    source: "phone",
    pickupDate: "2026-10-05",
    pickupTime: "11:00",
    pickupAddress: "Heathrow Terminal 5",
    dropoffAddress: "10 Wren Avenue, Uxbridge",
    vehicleClassSlug: "saloon",
    passengers: "2",
    largeBags: "2",
    smallBags: "0",
    leadName: "Jane Smith",
    leadPhone: "07700 900123",
    price: "55",
    paymentMethod: "cash",
    meetAndGreet: "on",
    ...values,
  };
  for (const [key, value] of Object.entries(base)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const parse = (values: Record<string, string | string[]> = {}) =>
  jobSchema.safeParse(jobForm(form(values)));

function errors(values: Record<string, string | string[]>): Record<string, string> {
  const result = parse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path[0], issue.message]),
  );
}

describe("the staff job form", () => {
  it("stores London time as UTC, the phone in E.164 and money in pence", () => {
    const result = parse({
      stop: ["Ealing", ""],
      flightNumber: "ba 117",
      "extra-child-seat": "1",
    });
    expect(result.success).toBe(true);
    const data = jobData(result.data!);
    expect(data.pickupAt).toBe("2026-10-05T10:00:00.000Z"); // BST
    expect(data.leadPhone).toBe("+447700900123");
    expect(data.customerPricePence).toBe(5500);
    expect(data.flightNumber).toBe("BA117");
    expect(data.viaStops).toEqual([{ address: "Ealing" }]);
    expect(data.nameBoardText).toBe("Jane Smith");
    expect(data.extras).toEqual([{ slug: "child-seat", quantity: 1, unitPricePence: 0 }]);
    expect(data.supplier).toBeNull();
    expect(data.commissionPence).toBeNull();
  });

  it("does not offer website as a source", () => {
    expect(errors({ source: "website" }).source).toMatch(/Choose where/);
  });

  it("needs a supplier's name, reference and commission, and works out the commission", () => {
    expect(errors({ source: "supplier", paymentMethod: "supplier" })).toMatchObject({
      supplier: expect.stringMatching(/supplier/),
      supplierReference: expect.stringMatching(/reference/),
      commissionPercent: expect.stringMatching(/commission/),
    });
    const result = parse({
      source: "supplier",
      supplier: "3",
      supplierReference: " tc-991 ",
      commissionPercent: "18",
      paymentMethod: "supplier",
    });
    const data = jobData(result.data!);
    expect(data.supplier).toBe(3);
    expect(data.supplierReference).toBe("TC-991");
    expect(data.commissionBp).toBe(1800);
    expect(data.commissionPence).toBe(990);
  });

  it("refuses cash on a supplier job", () => {
    expect(
      errors({
        source: "supplier",
        supplier: "3",
        supplierReference: "X",
        commissionPercent: "10",
        paymentMethod: "cash",
      }).paymentMethod,
    ).toMatch(/paid by the supplier/);
  });

  it("refuses more passengers than the vehicle seats", () => {
    expect(errors({ passengers: "6" }).passengers).toMatch(/Saloon takes up to 4/);
  });

  it("takes an hourly hire instead of a drop-off", () => {
    expect(errors({ dropoffAddress: "" }).dropoffAddress).toMatch(/hourly hire/);
    const data = jobData(parse({ dropoffAddress: "", hours: "4" }).data!);
    expect(data.dropoffAddress).toBeNull();
    expect(data.hours).toBe(4);
  });

  it("refuses a missing or nonsense price", () => {
    expect(errors({ price: "" }).price).toMatch(/agreed price/);
    expect(errors({ price: "fifty" }).price).toMatch(/agreed price/);
    expect(errors({ price: "0" }).price).toMatch(/agreed price/);
  });
});
