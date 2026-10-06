import {
  DRIVER_BOOKINGS_CSV_COLUMNS,
  DRIVER_RECORDS_CSV_COLUMNS,
  DRIVER_SUMMARY_CSV_COLUMNS,
  loadDriversReport,
  parseDriversReportFilters,
  TAKEN_OFF_CSV_COLUMNS,
} from "@/admin/reports/drivers-data";
import {
  loadJobsReport,
  JOBS_CSV_COLUMNS,
  parseJobsReportFilters,
} from "@/admin/reports/jobs-data";
import { DRIVER_PAYMENTS_CSV_COLUMNS, loadPayments } from "@/admin/data/driver-pay";
import { loadReceipts, PARTNER_RECEIPTS_CSV_COLUMNS } from "@/admin/data/supplier-money";
import { londonDay } from "@/admin/format";
import { resolvePeriod } from "@/admin/reports/period";
import {
  loadRunSheet,
  parseRunSheetParams,
  runSheetCsvColumns,
} from "@/admin/reports/run-sheet-data";
import {
  staffCan,
  type Capability,
  type StaffIdentity,
} from "@/domain/staff/permissions";
import { toCsv } from "@/lib/csv";
import { payloadClient } from "@/lib/payload";
import type { User } from "@/payload-types";

/**
 * Reports' raw data as CSV (every report: an analytical dashboard on screen,
 * the concrete rows here). Same query string as the report's page, so the
 * file holds exactly what the page shows.
 *
 * Staff only: the signed-in person is checked against the report's
 * capability on every request, as the page itself does. Test bookings are
 * never in it, and no money is — that belongs to the Finance reports.
 */
export const dynamic = "force-dynamic";

type Query = Record<string, string>;

const REPORTS: Record<
  string,
  {
    capability: Capability;
    build: (args: {
      user: User;
      query: Query;
      now: Date;
    }) => Promise<{ filename: string; csv: string }>;
  }
> = {
  jobs: {
    capability: "reports.operational",
    build: async ({ user, query, now }) => {
      const payload = await payloadClient();
      const period = resolvePeriod(query, now);
      const { rows } = await loadJobsReport(
        payload,
        user,
        period,
        parseJobsReportFilters(query),
        now,
      );
      return {
        filename: `cityline-jobs-${period.from}-to-${period.to}.csv`,
        csv: toCsv(rows, JOBS_CSV_COLUMNS),
      };
    },
  },
  // Four downloads, chosen by `data`: every booking (the default), one row
  // per driver, the drivers taken off bookings, and TfL's driver records —
  // the last as of today, whatever the period.
  drivers: {
    capability: "reports.operational",
    build: async ({ user, query, now }) => {
      const payload = await payloadClient();
      const period = resolvePeriod(query, now);
      const { report, rows, records } = await loadDriversReport(
        payload,
        user,
        period,
        parseDriversReportFilters(query),
        now,
      );
      const span = `${period.from}-to-${period.to}`;
      switch (query.data) {
        case "drivers":
          return {
            filename: `cityline-drivers-${span}.csv`,
            csv: toCsv(report.drivers, DRIVER_SUMMARY_CSV_COLUMNS),
          };
        case "taken-off":
          return {
            filename: `cityline-drivers-taken-off-${span}.csv`,
            csv: toCsv(report.takenOff, TAKEN_OFF_CSV_COLUMNS),
          };
        case "records":
          return {
            filename: `cityline-tfl-driver-records-${londonDay(now)}.csv`,
            csv: toCsv(records, DRIVER_RECORDS_CSV_COLUMNS),
          };
        default:
          return {
            filename: `cityline-driver-bookings-${span}.csv`,
            csv: toCsv(rows, DRIVER_BOOKINGS_CSV_COLUMNS),
          };
      }
    },
  },
  // Payments to drivers made in the period (by the date paid), voids marked.
  "driver-payments": {
    capability: "driverPay.view",
    build: async ({ user, query, now }) => {
      const payload = await payloadClient();
      const period = resolvePeriod(query, now);
      const payments = await loadPayments(payload, user, {
        start: period.start,
        end: period.end,
      });
      return {
        filename: `cityline-driver-payments-${period.from}-to-${period.to}.csv`,
        csv: toCsv(payments, DRIVER_PAYMENTS_CSV_COLUMNS),
      };
    },
  },
  // Money received from partners in the period (by the date received).
  "partner-receipts": {
    capability: "supplierMoney.view",
    build: async ({ user, query, now }) => {
      const payload = await payloadClient();
      const period = resolvePeriod(query, now);
      const receipts = await loadReceipts(payload, user, {
        start: period.start,
        end: period.end,
      });
      return {
        filename: `cityline-partner-receipts-${period.from}-to-${period.to}.csv`,
        csv: toCsv(receipts, PARTNER_RECEIPTS_CSV_COLUMNS),
      };
    },
  },
  // One London day's bookings in pickup order — no prices; a driver's price
  // goes to them only in their WhatsApp message.
  "run-sheet": {
    capability: "runSheet",
    build: async ({ user, query, now }) => {
      const payload = await payloadClient();
      const { date } = parseRunSheetParams(query, now);
      const { sheet } = await loadRunSheet(payload, user, date, now);
      const names = new Map(sheet.days.map((day) => [day.driver.id, day.driver.name]));
      return {
        filename: `cityline-run-sheet-${date}.csv`,
        csv: toCsv(
          sheet.jobs,
          runSheetCsvColumns((id) => (id ? (names.get(id) ?? "") : "")),
        ),
      };
    },
  },
};

export async function GET(
  request: Request,
  context: { params: Promise<{ report: string }> },
) {
  const { report } = await context.params;
  const definition = REPORTS[report];
  if (!definition) return new Response("No such report.", { status: 404 });

  const payload = await payloadClient();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user || !staffCan(user as StaffIdentity, definition.capability)) {
    return new Response("You do not have access to this report.", { status: 403 });
  }

  const query = Object.fromEntries(new URL(request.url).searchParams);
  const { filename, csv } = await definition.build({
    user: user as User,
    query,
    now: new Date(),
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
