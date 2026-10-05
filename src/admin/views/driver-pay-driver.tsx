import { ArrowLeft, FileText, MessageCircle, Undo2 } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { voidDriverPaymentAction } from "@/admin/actions/driver-pay";
import { loadDriverPay } from "@/admin/data/driver-pay";
import { isValidDay, londonDay, londonDayBounds, shortDay, clock } from "@/admin/format";
import { PayDriverForm } from "@/admin/forms/pay-driver-form";
import { param, requireStaff, segment } from "@/admin/guard";
import { counted } from "@/components/ops/charts/scale";
import { ConfirmDialog } from "@/components/ops/dialog";
import { FilterForm } from "@/components/ops/filter-form";
import { TEXTAREA_CLASS } from "@/components/ops/form-classes";
import { Label, TextInput } from "@/components/ops/form-controls";
import {
  Badge,
  buttonClass,
  ButtonLink,
  Field,
  Fields,
  Notice,
  NotRecorded,
  PageHeader,
  Panel,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import {
  cashHeldPence,
  PAYMENT_METHODS,
  paymentReference,
  routeText,
  type PaymentMethod,
} from "@/domain/finance/driver-pay";
import { STATEMENT_LINK_DAYS, statementToken } from "@/domain/finance/statement-link";
import { stageName } from "@/domain/jobs/status";
import { paymentMessage, whatsappLink } from "@/domain/messaging/driver-message";
import { formatPence, type Pence } from "@/domain/money";
import { can } from "@/domain/staff/permissions";
import { company, siteUrl } from "@/lib/company";
import { formatDate } from "@/lib/time";
import type { User } from "@/payload-types";

/**
 * Paying one driver (Driver Pay): where to send the money, their done and
 * priced bookings up to the chosen day — tick what this payment covers — and
 * every payment made to them, each with its statement as a PDF and ready to
 * send on WhatsApp. Owner and Accounts.
 */

const money = (pence: number) => formatPence(pence as Pence);
const sortCode = (value: string) =>
  value.replace(/\D/g, "").replace(/(\d{2})(?=\d)/g, "$1-");

export async function DriverPayDriverView(props: AdminViewServerProps) {
  const idSegment = segment(props, 1);
  const context = requireStaff(props, "driverPay.view", `/admin/driver-pay/${idSegment}`);
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();
  const today = londonDay(now);
  const upToParam = param(props.searchParams, "upTo");
  const upTo = isValidDay(upToParam) ? upToParam : today;

  const data = Number.isInteger(Number(idSegment))
    ? await loadDriverPay(payload, user, Number(idSegment), londonDayBounds(upTo).end)
    : null;
  if (!data) {
    return (
      <OpsShell user={user} active="driver-pay">
        <Panel>
          <EmptyState
            title="No driver with that number"
            action={<ButtonLink href="/admin/driver-pay">Back to Driver Pay</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }
  const { driver, bank, canSeeBank, owed, payments } = data;
  const canManage = can(user.role, "driverPay.manage");
  const notice = param(props.searchParams, "notice");
  const justPaid = Number(param(props.searchParams, "payment")) || null;
  const expires = new Date(now.getTime() + STATEMENT_LINK_DAYS * 86_400_000);

  const sendLink = (payment: (typeof payments)[number]) =>
    whatsappLink(
      driver.phone,
      paymentMessage(
        driver.firstName,
        {
          reference: paymentReference(payment.id),
          paidAt: new Date(payment.paidAt),
          upTo: new Date(payment.upTo),
          method: PAYMENT_METHODS[payment.method as PaymentMethod] ?? payment.method,
          bankReference: payment.reference ?? null,
          bookings: payment.lines?.length ?? 0,
          earnedPence: payment.earnedPence ?? 0,
          cashPence: payment.cashPence ?? 0,
          amountPence: payment.amountPence ?? 0,
          statementUrl: `${siteUrl()}/api/statements/${statementToken(payment.id, expires)}`,
        },
        company.phone,
      ),
    );
  const consent = Boolean(driver.whatsappConsentAt);
  const paidNow = justPaid
    ? payments.find((payment) => payment.id === justPaid)
    : undefined;

  return (
    <OpsShell user={user} active="driver-pay">
      <div className="mb-3">
        <Link
          href="/admin/driver-pay"
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Driver Pay
        </Link>
      </div>
      {notice === "paid" && paidNow ? (
        <div className="border-ok-line bg-ok-soft mb-4 flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ok text-sm">
            Payment {paymentReference(paidNow.id)} recorded:{" "}
            <strong>{money(Math.abs(paidNow.amountPence ?? 0))}</strong>
            {(paidNow.amountPence ?? 0) < 0 ? ` paid by ${driver.firstName}` : ""}.
          </p>
          <div className="flex flex-wrap gap-2">
            {consent ? (
              <a
                href={sendLink(paidNow)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("primary", "sm")}
              >
                <MessageCircle aria-hidden className="h-4 w-4" />
                Send statement on WhatsApp
              </a>
            ) : null}
            <a
              href={`/api/driver-pay/${paidNow.id}/statement`}
              target="_blank"
              rel="noreferrer"
              className={buttonClass("secondary", "sm")}
            >
              <FileText aria-hidden className="h-4 w-4" />
              Statement PDF
            </a>
          </div>
        </div>
      ) : null}
      {notice === "voided" ? (
        <Notice tone="ok">Payment voided. Its bookings can be paid again.</Notice>
      ) : null}

      <PageHeader
        eyebrow="Driver Pay"
        title={driver.fullName ?? "Driver"}
        meta={
          <Link
            href={`/admin/drivers/${driver.id}`}
            className="text-accent text-sm hover:underline"
          >
            Driver&apos;s page
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title={`Owed up to ${formatDate(new Date(`${upTo}T12:00:00Z`))}`}
            description="Completed and PNS bookings with a driver price, not yet paid"
            actions={
              <FilterForm
                action={`/admin/driver-pay/${driver.id}`}
                className="flex items-end gap-2"
              >
                <div>
                  <Label htmlFor="driver-pay-up-to">Up to</Label>
                  <TextInput
                    id="driver-pay-up-to"
                    name="upTo"
                    type="date"
                    defaultValue={upTo}
                  />
                </div>
              </FilterForm>
            }
          >
            {owed.payable.length === 0 ? (
              <EmptyState
                title="Nothing to pay"
                description={
                  owed.missingPrice.length
                    ? "Some bookings need a driver price first — see below."
                    : "Every done booking up to this day is paid."
                }
              />
            ) : canManage ? (
              <PayDriverForm
                // A new list of bookings starts fresh, every one ticked.
                key={owed.payable.map((job) => job.id).join(",")}
                driverId={driver.id}
                driverName={driver.firstName}
                upTo={upTo}
                today={today}
                lines={owed.payable.map((job) => ({
                  id: job.id,
                  reference: job.reference,
                  when: `${shortDay(new Date(job.pickupAt))} ${clock(new Date(job.pickupAt))}`,
                  route: routeText(job),
                  status: stageName(job.status),
                  pricePence: job.driverPricePence ?? 0,
                  cashPence: cashHeldPence(job),
                }))}
              />
            ) : (
              <p className="text-ink-2 text-sm">
                {owed.payable.length} bookings, {money(owed.netPence)} to pay.
              </p>
            )}
          </Panel>

          {owed.missingPrice.length ? (
            <Panel
              title="Done, no driver price yet"
              description="These cannot be paid until the price is written on the booking."
              bodyClassName="p-0"
            >
              <ul className="divide-line divide-y">
                {owed.missingPrice.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="text-ink font-medium tabular-nums">
                        {shortDay(new Date(job.pickupAt))} {clock(new Date(job.pickupAt))}
                      </span>
                      <span className="text-ink-3">
                        {" "}
                        · {job.reference} · {stageName(job.status)}
                      </span>
                      <span className="text-ink-2 block truncate">{routeText(job)}</span>
                    </span>
                    <Link
                      href={`/admin/jobs/${job.id}`}
                      className={buttonClass("secondary", "sm")}
                    >
                      Open booking
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel
            title="Payments"
            description={`${payments.length} made to ${driver.firstName}, newest first`}
            bodyClassName="p-0"
          >
            {payments.length === 0 ? (
              <EmptyState title="No payments yet" />
            ) : (
              <ul className="divide-line divide-y">
                {payments.map((payment) => {
                  const recordedBy =
                    payment.recordedBy && typeof payment.recordedBy === "object"
                      ? ((payment.recordedBy as User).name ??
                        (payment.recordedBy as User).email)
                      : "Staff";
                  const amount = payment.amountPence ?? 0;
                  return (
                    <li
                      key={payment.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 text-sm">
                        <p className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              payment.voidedAt
                                ? "text-ink-3 line-through"
                                : "text-ink font-semibold"
                            }
                          >
                            {paymentReference(payment.id)}
                          </span>
                          <span className="tabular-nums">
                            {amount >= 0
                              ? money(amount)
                              : `${money(-amount)} paid by ${driver.firstName}`}
                          </span>
                          {payment.voidedAt ? <Badge tone="danger">Void</Badge> : null}
                        </p>
                        <p className="text-ink-3 text-xs">
                          {formatDate(new Date(payment.paidAt))} ·{" "}
                          {PAYMENT_METHODS[payment.method as PaymentMethod] ??
                            payment.method}
                          {payment.reference ? ` · ${payment.reference}` : ""} ·{" "}
                          {counted(payment.lines?.length ?? 0, "booking")} up to{" "}
                          {formatDate(new Date(payment.upTo))} · recorded by {recordedBy}
                        </p>
                        {payment.voidedAt ? (
                          <p className="text-danger text-xs">
                            Void: {payment.voidReason}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                        <a
                          href={`/api/driver-pay/${payment.id}/statement`}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonClass("secondary", "sm")}
                        >
                          <FileText aria-hidden className="h-4 w-4" />
                          PDF
                        </a>
                        {!payment.voidedAt && consent ? (
                          <a
                            href={sendLink(payment)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonClass("secondary", "sm")}
                          >
                            <MessageCircle aria-hidden className="h-4 w-4" />
                            WhatsApp
                          </a>
                        ) : null}
                        {!payment.voidedAt && canManage ? (
                          <ConfirmDialog
                            label="Void"
                            icon={<Undo2 aria-hidden className="h-4 w-4" />}
                            variant="ghost"
                            size="sm"
                            title={`Void ${paymentReference(payment.id)}?`}
                            confirmLabel="Void payment"
                            confirmVariant="danger"
                            action={voidDriverPaymentAction}
                            fields={{ paymentId: payment.id, driverId: driver.id }}
                          >
                            <p>
                              The payment stays on record, marked void, and its{" "}
                              {payment.lines?.length ?? 0} bookings can be paid again. Its
                              statement link stops working.
                            </p>
                            <label
                              htmlFor={`void-${payment.id}`}
                              className="text-ink-2 font-medium"
                            >
                              Why is it void?
                            </label>
                            <textarea
                              id={`void-${payment.id}`}
                              name="reason"
                              rows={2}
                              required
                              className={TEXTAREA_CLASS}
                            />
                          </ConfirmDialog>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Pay to" description="Owner and Accounts only. Stored encrypted.">
            {!canSeeBank ? (
              <p className="text-ink-3 text-sm">
                Bank details are for the Owner and Accounts.
              </p>
            ) : bank ? (
              <Fields className="sm:grid-cols-1">
                <Field label="Account name">{bank.accountName}</Field>
                <Field label="Sort code">
                  <span className="tabular-nums">{sortCode(bank.sortCode)}</span>
                </Field>
                <Field label="Account number">
                  <span className="tabular-nums">{bank.accountNumber}</span>
                </Field>
              </Fields>
            ) : (
              <p className="text-sm">
                <NotRecorded>No bank details on record.</NotRecorded>{" "}
                <Link
                  href={`/admin/drivers/${driver.id}`}
                  className="text-accent hover:underline"
                >
                  Add them on the driver&apos;s page
                </Link>
                .
              </p>
            )}
          </Panel>
          <Panel title="Statements on WhatsApp">
            <p className="text-ink-2 text-sm">
              {consent
                ? `Each payment can be sent to ${driver.firstName} with a private link to its PDF statement, valid for ${STATEMENT_LINK_DAYS} days.`
                : `${driver.firstName} has not agreed to WhatsApp messages. Download the PDF and send it another way.`}
            </p>
          </Panel>
        </div>
      </div>
    </OpsShell>
  );
}
