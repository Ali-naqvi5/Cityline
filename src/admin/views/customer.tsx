import { ArrowLeft, MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { withdrawConsentAction } from "@/admin/actions/customers";
import { money, pickupLabel, stamp } from "@/admin/format";
import { param, requireStaff, segment } from "@/admin/guard";
import { ConfirmDialog } from "@/components/ops/dialog";
import { JobStatusBadge, Route, SourceBadge } from "@/components/ops/jobs";
import {
  Badge,
  buttonClass,
  ButtonLink,
  Field,
  Fields,
  MetricCard,
  NotRecorded,
  Notice,
  PageHeader,
  Panel,
  type Tone,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { summarise } from "@/domain/customers/summary";
import { whatsappChat } from "@/domain/messaging/driver-message";
import { can } from "@/domain/staff/permissions";
import type { Customer, Driver, Job } from "@/payload-types";

/**
 * One customer (Customers section): how to reach them, what the office
 * knows about them, and every booking they have made — online or through the
 * office — in one history.
 */

const NOTICES: Record<string, string> = {
  created: "Customer added.",
  saved: "Changes saved.",
  "consent-withdrawn": "Marketing consent withdrawn. They will not be sent offers.",
};

const HISTORY_LIMIT = 100;

const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending_payment: { label: "Not paid", tone: "warn" },
  confirmed: { label: "Paid", tone: "ok" },
  completed: { label: "Paid · completed", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Payment expired", tone: "neutral" },
};

export async function CustomerView(props: AdminViewServerProps) {
  const idSegment = segment(props, 1);
  const context = requireStaff(props, "customers.view", `/admin/customers/${idSegment}`);
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const customer = (await payload.findByID({
    collection: "customers",
    id: Number(idSegment),
    depth: 0,
    user,
    overrideAccess: false,
    disableErrors: true,
  })) as Customer | null;

  if (!customer) {
    return (
      <OpsShell user={user} active="customers">
        <Panel>
          <EmptyState
            title="No customer with that number"
            action={<ButtonLink href="/admin/customers">Back to customers</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }

  const [jobs, orders] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: {
        and: [{ customer: { equals: customer.id } }, { archivedAt: { exists: false } }],
      },
      sort: "-pickupAt",
      pagination: false,
      depth: 1,
      user,
      overrideAccess: false,
    }),
    can(user.role, "bookings.view")
      ? payload.find({
          collection: "bookings",
          where: {
            and: [
              { customer: { equals: customer.id } },
              { archivedAt: { exists: false } },
            ],
          },
          sort: "-createdAt",
          limit: 50,
          depth: 0,
          user,
          overrideAccess: false,
        })
      : Promise.resolve(null),
  ]);

  const summary = summarise(jobs.docs, now);
  const channels = new Set(jobs.docs.map((job) => job.source));
  const edits = can(user.role, "customers.edit");
  const notice = NOTICES[param(props.searchParams, "notice")];
  const shown = jobs.docs.slice(0, HISTORY_LIMIT);

  return (
    <OpsShell user={user} active="customers">
      <div className="mb-3">
        <Link
          href="/admin/customers"
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Customers
        </Link>
      </div>
      {notice ? <Notice tone="ok">{notice}</Notice> : null}

      <PageHeader
        eyebrow={
          <>
            {[...channels].map((source) => (
              <SourceBadge key={source} source={source} />
            ))}
            {customer.isTest ? <Badge tone="special">Test</Badge> : null}
          </>
        }
        title={customer.name}
        meta={
          <span className="text-ink-3 text-sm">
            Customer since {stamp(new Date(customer.createdAt)).split(",")[0]}
          </span>
        }
        actions={
          <>
            {can(user.role, "jobs.edit") ? (
              <ButtonLink
                href={`/admin/jobs/new?customer=${customer.id}`}
                variant="primary"
              >
                <Plus aria-hidden className="h-4 w-4" />
                New booking
              </ButtonLink>
            ) : null}
            {edits ? (
              <ButtonLink href={`/admin/customers/${customer.id}/edit`}>
                <Pencil aria-hidden className="h-4 w-4" />
                Edit
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Bookings" value={summary.bookings} />
        <MetricCard label="Completed" value={summary.completed} />
        <MetricCard label="Upcoming" value={summary.upcoming} />
        <MetricCard
          label="No-shows (PNS)"
          value={summary.noShows}
          tone={summary.noShows ? "warn" : undefined}
        />
        <MetricCard label="Cancelled" value={summary.cancelled} />
        <MetricCard
          label="Booked value"
          value={money(summary.valuePence)}
          hint="Every booking not cancelled"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title="Bookings"
            description={
              jobs.docs.length > HISTORY_LIMIT
                ? `The latest ${HISTORY_LIMIT} of ${jobs.docs.length}`
                : `${jobs.docs.length} ${jobs.docs.length === 1 ? "booking" : "bookings"}, newest first`
            }
            bodyClassName="p-0"
          >
            {shown.length === 0 ? (
              <EmptyState
                title="No bookings yet"
                description="Bookings made online with their email, or by the office with their phone and name, appear here."
              />
            ) : (
              <ul className="divide-line divide-y">
                {shown.map((job: Job) => {
                  const driver =
                    typeof job.driver === "object" ? (job.driver as Driver | null) : null;
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/admin/jobs/${job.id}`}
                        className="hover:bg-sunken/60 grid gap-2 px-4 py-3 md:grid-cols-[150px_minmax(0,1fr)_auto]"
                      >
                        <span>
                          <span className="text-ink block text-sm font-medium tabular-nums">
                            {pickupLabel(new Date(job.pickupAt))}
                          </span>
                          <span className="text-ink-3 block text-xs">
                            {job.reference}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <Route from={job.pickupAddress} to={job.dropoffAddress} />
                          <span className="text-ink-3 block text-xs">
                            {driver
                              ? `${driver.fullName} · ${job.vehicleReg}`
                              : job.operator
                                ? `${job.subcontractorName} · operator`
                                : "No driver"}
                          </span>
                        </span>
                        <span className="flex items-start gap-3 md:flex-col md:items-end md:gap-1">
                          <JobStatusBadge status={job.status} short />
                          <span className="text-ink text-sm font-medium tabular-nums">
                            {money(job.customerPricePence)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {orders && orders.docs.length ? (
            <Panel
              title="Website orders"
              description="What they booked and paid online"
              bodyClassName="p-0"
            >
              <ul className="divide-line divide-y">
                {orders.docs.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                  >
                    <span>
                      <span className="text-ink font-medium">{order.reference}</span>
                      <span className="text-ink-3 ml-2 text-xs">
                        {stamp(new Date(order.createdAt))}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <Badge tone={ORDER_STATUS[order.status]?.tone ?? "neutral"}>
                        {ORDER_STATUS[order.status]?.label ?? order.status}
                      </Badge>
                      <span className="tabular-nums">{money(order.totalPence)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Contact">
            <Fields className="sm:grid-cols-1">
              <Field label="Phone">
                <span className="tabular-nums">{customer.phone}</span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  <a
                    href={`tel:${customer.phone}`}
                    className={buttonClass("secondary", "sm")}
                    aria-label={`Call ${customer.name}`}
                  >
                    <Phone aria-hidden className="h-4 w-4" />
                    Call
                  </a>
                  <a
                    href={whatsappChat(customer.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass("secondary", "sm")}
                    aria-label={`WhatsApp ${customer.name}`}
                  >
                    <MessageCircle aria-hidden className="h-4 w-4" />
                    WhatsApp
                  </a>
                </span>
              </Field>
              <Field label="Email">
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    className="text-accent hover:underline"
                  >
                    {customer.email}
                  </a>
                ) : (
                  <NotRecorded>No email — books by phone</NotRecorded>
                )}
              </Field>
              <Field label="Marketing">
                {customer.marketingConsent ? (
                  <>
                    Agreed
                    {customer.marketingConsentAt ? (
                      <span className="text-ink-3 block text-sm">
                        {stamp(new Date(customer.marketingConsentAt))}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <NotRecorded>Not agreed — send no offers</NotRecorded>
                )}
              </Field>
            </Fields>
            {customer.marketingConsent && edits ? (
              <div className="border-line mt-4 border-t pt-3">
                <ConfirmDialog
                  label="Withdraw marketing consent"
                  variant="ghost"
                  size="sm"
                  title={`Stop marketing to ${customer.name}?`}
                  confirmLabel="Withdraw consent"
                  confirmVariant="danger"
                  action={withdrawConsentAction}
                  fields={{ id: customer.id }}
                >
                  <p>
                    Use this when they ask not to be sent offers. Booking emails —
                    confirmations, changes, driver details — still go to them.
                  </p>
                </ConfirmDialog>
              </div>
            ) : null}
          </Panel>

          <Panel
            title="Office notes"
            actions={
              edits ? (
                <ButtonLink href={`/admin/customers/${customer.id}/edit`} size="sm">
                  Edit
                </ButtonLink>
              ) : null
            }
          >
            {customer.notes ? (
              <p className="text-ink-2 text-sm whitespace-pre-line">{customer.notes}</p>
            ) : (
              <NotRecorded>No notes</NotRecorded>
            )}
          </Panel>
        </div>
      </div>
    </OpsShell>
  );
}
