import {
  loadJobsReport,
  JOBS_CSV_COLUMNS,
  parseJobsReportFilters,
} from "@/admin/reports/jobs-data";
import { resolvePeriod } from "@/admin/reports/period";
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
