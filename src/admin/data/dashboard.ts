import "server-only";

import type { Payload } from "payload";

import { addDays, londonDay, londonDayBounds, mondayOf } from "@/admin/format";
import { loadComplianceItems, type ComplianceItem } from "@/admin/data/fleet";
import { loadRefunds, loadTakings, periodTakings } from "@/admin/data/payments";
import { OPEN_STATUSES } from "@/domain/jobs/labels";
import { can, type Role } from "@/domain/staff/permissions";
import type { Booking, Job, User } from "@/payload-types";

/**
 * What the dashboard shows, loaded for one member of staff (spec §8).
 *
 * Every query runs as that person with access control on, so a role that
 * cannot read payments gets no revenue figures even if a screen asked. Test
 * bookings never count.
 */

const HOUR = 3_600_000;

export interface DashboardData {
  now: Date;
  jobs: null | {
    today: number;
    thisWeek: number;
    unassigned: number;
    urgent: Job[];
    upcoming: Job[];
  };
  bookings: null | {
    recent: Booking[];
    cancelledThisWeek: Booking[];
  };
  /** Blocked or urgent documents, and how many more expire within 30 days. */
  compliance: null | { urgent: ComplianceItem[]; laterCount: number };
  money: null | {
    monthLabel: string;
    revenuePence: number;
    refundsPence: number;
    feesPence: number;
    /** Payments whose card fee Stripe has not given yet. */
    feesUnknown: number;
    paymentsCount: number;
  };
}

const NOT_TEST = { isTest: { not_equals: true } } as const;

export async function loadDashboard(
  payload: Payload,
  user: User & { role: Role },
  now: Date = new Date(),
): Promise<DashboardData> {
  const as = { user, overrideAccess: false } as const;
  const today = londonDay(now);
  const todayBounds = londonDayBounds(today);
  const monday = mondayOf(today);
  const weekStart = londonDayBounds(monday).start;
  const weekEnd = londonDayBounds(addDays(monday, 6)).end;

  const jobs = can(user.role, "jobs.view")
    ? await (async () => {
        const [todayCount, weekCount, unassignedCount, urgent, upcoming] =
          await Promise.all([
            payload.count({
              collection: "jobs",
              where: {
                and: [
                  NOT_TEST,
                  { status: { not_equals: "cancelled" } },
                  { pickupAt: { greater_than_equal: todayBounds.start.toISOString() } },
                  { pickupAt: { less_than: todayBounds.end.toISOString() } },
                ],
              },
              ...as,
            }),
            payload.count({
              collection: "jobs",
              where: {
                and: [
                  NOT_TEST,
                  { status: { not_equals: "cancelled" } },
                  { pickupAt: { greater_than_equal: weekStart.toISOString() } },
                  { pickupAt: { less_than: weekEnd.toISOString() } },
                ],
              },
              ...as,
            }),
            payload.count({
              collection: "jobs",
              where: {
                and: [
                  NOT_TEST,
                  { status: { equals: "unassigned" } },
                  {
                    pickupAt: {
                      greater_than_equal: new Date(
                        now.getTime() - 6 * HOUR,
                      ).toISOString(),
                    },
                  },
                ],
              },
              ...as,
            }),
            // Unassigned and within 24 hours — or overdue by up to 6 hours, which
            // is exactly the job most in need of someone's attention.
            payload.find({
              collection: "jobs",
              where: {
                and: [
                  NOT_TEST,
                  { status: { equals: "unassigned" } },
                  {
                    pickupAt: {
                      greater_than_equal: new Date(
                        now.getTime() - 6 * HOUR,
                      ).toISOString(),
                    },
                  },
                  {
                    pickupAt: {
                      less_than: new Date(now.getTime() + 24 * HOUR).toISOString(),
                    },
                  },
                ],
              },
              sort: "pickupAt",
              limit: 20,
              depth: 0,
              ...as,
            }),
            payload.find({
              collection: "jobs",
              where: {
                and: [
                  NOT_TEST,
                  { status: { in: [...OPEN_STATUSES] } },
                  { pickupAt: { greater_than_equal: now.toISOString() } },
                ],
              },
              sort: "pickupAt",
              limit: 8,
              depth: 0,
              ...as,
            }),
          ]);
        return {
          today: todayCount.totalDocs,
          thisWeek: weekCount.totalDocs,
          unassigned: unassignedCount.totalDocs,
          urgent: urgent.docs,
          upcoming: upcoming.docs,
        };
      })()
    : null;

  const bookings = can(user.role, "bookings.view")
    ? await (async () => {
        const [recent, cancelled] = await Promise.all([
          payload.find({
            collection: "bookings",
            where: {
              and: [
                NOT_TEST,
                {
                  createdAt: {
                    greater_than_equal: new Date(now.getTime() - 48 * HOUR).toISOString(),
                  },
                },
              ],
            },
            sort: "-createdAt",
            limit: 6,
            depth: 0,
            ...as,
          }),
          payload.find({
            collection: "bookings",
            where: {
              and: [
                NOT_TEST,
                { status: { equals: "cancelled" } },
                {
                  cancelledAt: {
                    greater_than_equal: new Date(
                      now.getTime() - 7 * 24 * HOUR,
                    ).toISOString(),
                  },
                },
              ],
            },
            sort: "-cancelledAt",
            limit: 6,
            depth: 0,
            ...as,
          }),
        ]);
        return { recent: recent.docs, cancelledThisWeek: cancelled.docs };
      })()
    : null;

  // This month's money in, as Payments counts it: website card payments and
  // office ones marked paid, less refunds recorded and card fees.
  const money = can(user.role, "payments.view")
    ? await (async () => {
        const month = {
          start: londonDayBounds(`${today.slice(0, 7)}-01`).start,
          end: londonDayBounds(today).end,
        };
        const [rows, refunds] = await Promise.all([
          loadTakings(payload, user, month),
          can(user.role, "refunds.view")
            ? loadRefunds(payload, user, month)
            : Promise.resolve([]),
        ]);
        const totals = periodTakings(rows, refunds);
        return {
          monthLabel: new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/London",
            month: "long",
            year: "numeric",
          }).format(now),
          revenuePence: totals.takenPence,
          feesPence: totals.feesPence,
          feesUnknown: totals.feesUnknown,
          refundsPence: totals.refundedPence,
          paymentsCount: rows.filter((row) => !row.voided).length,
        };
      })()
    : null;

  const compliance = can(user.role, "compliance.view")
    ? await (async () => {
        const { drivers, vehicles } = await loadComplianceItems(payload, user, now);
        const all = [...drivers, ...vehicles];
        return {
          urgent: all.filter((item) =>
            ["missing", "expired", "expiring_7"].includes(item.status),
          ),
          laterCount: all.filter(
            (item) => item.status === "expiring_14" || item.status === "expiring_30",
          ).length,
        };
      })()
    : null;

  return { now, jobs, bookings, compliance, money };
}
