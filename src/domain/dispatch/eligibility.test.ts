import { describe, expect, it } from "vitest";

import {
  currentDocument,
  daysUntil,
  documentStatus,
  worstStatus,
  type DocumentRecord,
} from "@/domain/compliance/documents";

import { checkEligibility, classFit, type EligibilityInput } from "./eligibility";

const PICKUP = new Date("2026-12-14T10:00:00Z");
const inDays = (days: number) =>
  new Date(PICKUP.getTime() + days * 86_400_000).toISOString();

const goodDriverDocs: DocumentRecord[] = [
  { type: "phv_licence", expiresAt: inDays(300) },
  { type: "dvla_licence", expiresAt: inDays(900) },
  { type: "dbs", expiresAt: inDays(500) },
  { type: "right_to_work", expiresAt: null },
];
const goodVehicleDocs: DocumentRecord[] = [
  { type: "phv_vehicle_licence", expiresAt: inDays(200) },
  { type: "mot", expiresAt: inDays(150) },
  { type: "insurance", expiresAt: inDays(100) },
];

function input(change: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    pickupAt: PICKUP,
    jobClass: "saloon",
    driver: { status: "active", documents: goodDriverDocs },
    vehicle: { status: "active", vehicleClassSlug: "saloon", documents: goodVehicleDocs },
    otherPickups: [],
    ...change,
  };
}

describe("documentStatus", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const at = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

  it("grades a document by how soon it expires", () => {
    expect(documentStatus(null, now)).toBe("missing");
    expect(documentStatus({ expiresAt: at(-1) }, now)).toBe("expired");
    expect(documentStatus({ expiresAt: at(5) }, now)).toBe("expiring_7");
    expect(documentStatus({ expiresAt: at(12) }, now)).toBe("expiring_14");
    expect(documentStatus({ expiresAt: at(25) }, now)).toBe("expiring_30");
    expect(documentStatus({ expiresAt: at(90) }, now)).toBe("valid");
    expect(documentStatus({ expiresAt: null }, now)).toBe("valid");
  });

  it("counts the renewal, not the old document, as current", () => {
    const docs = [
      { type: "mot", expiresAt: at(-30), createdAt: at(-400) },
      { type: "mot", expiresAt: at(330), createdAt: at(-30) },
    ];
    expect(currentDocument(docs, "mot")?.expiresAt).toBe(at(330));
  });

  it("reports the worst status in a set", () => {
    expect(worstStatus(["valid", "expiring_14", "expired"])).toBe("expired");
    expect(worstStatus(["valid", "missing"])).toBe("missing");
    expect(worstStatus([])).toBe("valid");
  });
});

describe("daysUntil", () => {
  it("counts London calendar days, not hours", () => {
    // Expires at the end of Saturday 10 Oct; on Monday 5 Oct at 4am that is 5 days.
    expect(daysUntil("2026-10-10T22:59:00.000Z", new Date("2026-10-05T03:00:00Z"))).toBe(
      5,
    );
    expect(daysUntil("2026-10-10T22:59:00.000Z", new Date("2026-10-10T20:00:00Z"))).toBe(
      0,
    );
  });
});

describe("classFit", () => {
  it("lets a bigger vehicle do a smaller job, but keeps executive exact", () => {
    expect(classFit("saloon", "saloon")).toBe("exact");
    expect(classFit("saloon", "mpv-8")).toBe("upgrade");
    expect(classFit("executive", "saloon")).toBe("incompatible");
    expect(classFit("mpv-8", "saloon")).toBe("incompatible");
  });
});

describe("checkEligibility", () => {
  it("accepts an active, fully documented driver and vehicle of the right class", () => {
    expect(checkEligibility(input())).toEqual({
      eligible: true,
      blocks: [],
      warnings: [],
    });
  });

  it("refuses an expired driver", () => {
    const documents = goodDriverDocs.map((doc) =>
      doc.type === "phv_licence" ? { ...doc, expiresAt: inDays(-1) } : doc,
    );
    const result = checkEligibility(input({ driver: { status: "active", documents } }));
    expect(result.eligible).toBe(false);
    expect(result.blocks.join(" ")).toMatch(/PHV driver licence has expired/);
  });

  it("refuses a document that is valid today but expires before the pickup", () => {
    const documents = goodDriverDocs.map((doc) =>
      doc.type === "dbs" ? { ...doc, expiresAt: inDays(-0.5) } : doc,
    );
    expect(
      checkEligibility(input({ driver: { status: "active", documents } })).eligible,
    ).toBe(false);
  });

  it("refuses a missing document", () => {
    const documents = goodDriverDocs.filter((doc) => doc.type !== "right_to_work");
    const result = checkEligibility(input({ driver: { status: "active", documents } }));
    expect(result.blocks.join(" ")).toMatch(/no Right to work on record/);
  });

  it("refuses an expired vehicle", () => {
    const documents = goodVehicleDocs.map((doc) =>
      doc.type === "insurance" ? { ...doc, expiresAt: inDays(-3) } : doc,
    );
    const result = checkEligibility(
      input({ vehicle: { status: "active", vehicleClassSlug: "saloon", documents } }),
    );
    expect(result.eligible).toBe(false);
    expect(result.blocks.join(" ")).toMatch(/insurance has expired/);
  });

  it("refuses the wrong vehicle class, and warns on an upgrade", () => {
    const wrong = checkEligibility(
      input({
        jobClass: "executive",
        vehicle: {
          status: "active",
          vehicleClassSlug: "saloon",
          documents: goodVehicleDocs,
        },
      }),
    );
    expect(wrong.eligible).toBe(false);

    const upgrade = checkEligibility(
      input({
        vehicle: {
          status: "active",
          vehicleClassSlug: "mpv-5",
          documents: goodVehicleDocs,
        },
      }),
    );
    expect(upgrade.eligible).toBe(true);
    expect(upgrade.warnings.join(" ")).toMatch(/upgrade/);
  });

  it("warns, without refusing, when the vehicle is not one the driver uses", () => {
    const result = checkEligibility(input({ linked: false }));
    expect(result.eligible).toBe(true);
    expect(result.warnings).toContain(
      "This vehicle is not one the driver normally uses.",
    );
    expect(checkEligibility(input({ linked: true })).warnings).toEqual([]);
  });

  it("refuses a suspended driver or an off-road vehicle", () => {
    expect(
      checkEligibility(
        input({ driver: { status: "suspended", documents: goodDriverDocs } }),
      ).eligible,
    ).toBe(false);
    expect(
      checkEligibility(
        input({
          vehicle: {
            status: "off_road",
            vehicleClassSlug: "saloon",
            documents: goodVehicleDocs,
          },
        }),
      ).blocks.join(" "),
    ).toMatch(/off road/);
  });

  it("warns, without refusing, about another job within 90 minutes", () => {
    const result = checkEligibility(
      input({ otherPickups: [new Date(PICKUP.getTime() + 60 * 60_000)] }),
    );
    expect(result.eligible).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/60 minutes after/);
  });

  it("warns when a document runs out within 30 days of the pickup", () => {
    const documents = goodVehicleDocs.map((doc) =>
      doc.type === "mot" ? { ...doc, expiresAt: inDays(10) } : doc,
    );
    const result = checkEligibility(
      input({ vehicle: { status: "active", vehicleClassSlug: "saloon", documents } }),
    );
    expect(result.eligible).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/MOT certificate expires within 30 days/);
  });
});
