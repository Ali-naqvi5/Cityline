import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  Plane,
  Printer,
} from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { addDays, dayHeading, londonDay } from "@/admin/format";
import { requireStaff } from "@/admin/guard";
import { durationText, type RunSheetJob } from "@/admin/reports/run-sheet";
import { loadRunSheet, parseRunSheetParams } from "@/admin/reports/run-sheet-data";
import { DownloadCsv } from "@/admin/reports/ui";
import { FilterForm, PrintButton } from "@/components/ops/filter-form";
import { Label, TextInput } from "@/components/ops/form-controls";
import { JobStatusBadge } from "@/components/ops/jobs";
import { buttonClass, cx, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { CLASH_MINUTES } from "@/domain/dispatch/eligibility";
import { vehicleClassName } from "@/domain/jobs/labels";
import { whatsappLink } from "@/domain/messaging/driver-message";
import { formatTime } from "@/lib/time";

/**
 * The Daily Run Sheet (approved by Cityline, 6 Oct 2026): one London day's
 * bookings in pickup order — today unless another day is chosen — for the
 * office and the drivers. Whole day for the controller; by driver with the
 * time between pickups, each driver's day ready to send on WhatsApp with
 * their price. Prints one driver to a page. Test bookings never appear.
 * Owner and Controller.
 */

const PATH = "/admin/reports/run-sheet";

function JobRow({
  job,
  driverName,
  showDriver,
}: {
  job: RunSheetJob;
  driverName: string | null;
  showDriver: boolean;
}) {
  const at = new Date(job.pickupAt);
  const bags = [
    `${job.largeBags} large`,
    ...(job.smallBags ? [`${job.smallBags} small`] : []),
  ].join(", ");
  return (
    <li
      className={cx(
        "border-line grid break-inside-avoid gap-x-4 gap-y-2 border-t px-4 py-3 sm:grid-cols-[64px_minmax(0,1fr)]",
        showDriver
          ? "lg:grid-cols-[64px_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)]"
          : "lg:grid-cols-[64px_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.6fr)]",
      )}
    >
      <div>
        <p className="text-ink text-lg leading-6 font-semibold tabular-nums">
          {formatTime(at)}
        </p>
        {job.flightNumber ? (
          <p className="text-ink-2 inline-flex items-center gap-1 text-xs font-medium">
            <Plane aria-hidden className="h-3 w-3" />
            {job.flightNumber}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 text-sm">
        <p className="text-ink font-medium">{job.passenger}</p>
        {job.passenger !== job.leadName ? (
          <p className="text-ink-3 text-xs">Lead passenger: {job.leadName}</p>
        ) : null}
        <a
          href={`tel:${job.leadPhone}`}
          className="text-accent inline-flex items-center gap-1 text-sm tabular-nums hover:underline"
        >
          <Phone aria-hidden className="h-3.5 w-3.5" />
          {job.leadPhone}
        </a>
        <p className="text-ink-3 text-xs">
          {job.passengers} {job.passengers === 1 ? "passenger" : "passengers"} · {bags}
        </p>
        <p className="text-ink-3 text-xs">
          <Link href={`/admin/jobs/${job.id}`} className="text-ink-2 hover:underline">
            {job.reference}
          </Link>{" "}
          · {job.client}
          {job.supplierReference ? ` ${job.supplierReference}` : ""}
        </p>
      </div>

      <div className="text-ink-2 min-w-0 text-sm sm:col-start-2 lg:col-start-auto">
        <p>
          <span className="text-ink-3 text-xs">From </span>
          {job.pickupAddress}
        </p>
        {job.viaStops.map((stop, index) => (
          <p key={`${index}-${stop}`}>
            <span className="text-ink-3 text-xs">Stop {index + 1} </span>
            {stop}
          </p>
        ))}
        <p>
          <span className="text-ink-3 text-xs">To </span>
          {job.dropoffAddress ??
            (job.hours ? `Hourly hire, ${job.hours} hours` : "As directed")}
        </p>
      </div>

      <div className="text-ink-2 min-w-0 text-sm sm:col-start-2 lg:col-start-auto">
        <p>{vehicleClassName(job.vehicleClassSlug)}</p>
        {job.extras.length ? (
          <p className="text-xs">
            {job.extras.map((extra) => `${extra.quantity} × ${extra.name}`).join(", ")}
          </p>
        ) : null}
        {job.meetAndGreet ? (
          <p className="text-xs">Meet and greet — board: “{job.passenger}”</p>
        ) : null}
        {job.driverNotes ? (
          <p className="text-ink mt-1 text-xs whitespace-pre-line">
            <span className="font-medium">Notes:</span> {job.driverNotes}
          </p>
        ) : null}
      </div>

      {showDriver ? (
        <div className="min-w-0 text-sm sm:col-start-2 lg:col-start-auto">
          {driverName ? (
            <>
              <p className="text-ink font-medium">{driverName}</p>
              {job.vehicleReg ? (
                <p className="text-ink-3 text-xs tabular-nums">{job.vehicleReg}</p>
              ) : null}
            </>
          ) : (
            <p className="text-warn font-medium">No driver yet</p>
          )}
          <div className="mt-1">
            <JobStatusBadge status={job.status} short />
          </div>
          {job.problems.length ? (
            <p className="text-danger mt-1 text-xs">{job.problems.join("; ")}</p>
          ) : null}
        </div>
      ) : (
        <div className="sm:col-start-2 lg:col-start-auto">
          <JobStatusBadge status={job.status} short />
          {job.problems.length ? (
            <p className="text-danger mt-1 text-xs">{job.problems.join("; ")}</p>
          ) : null}
        </div>
      )}
    </li>
  );
}

export async function RunSheetView(props: AdminViewServerProps) {
  const context = requireStaff(props, "runSheet", PATH);
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const params = props.searchParams as Record<string, string | string[] | undefined>;
  const { date, view } = parseRunSheetParams(params, now);
  const { sheet, cancelled, messages } = await loadRunSheet(payload, user, date, now);

  const today = londonDay(now);
  const href = (change: { date?: string; view?: string }) => {
    const query = new URLSearchParams();
    const day = change.date ?? date;
    const shown = change.view ?? view;
    if (day !== today) query.set("date", day);
    if (shown === "driver") query.set("view", "driver");
    return `${PATH}${query.size ? `?${query}` : ""}`;
  };
  const csvHref = `/api/reports/run-sheet?date=${date}`;
  const nameOf = new Map(sheet.days.map((day) => [day.driver.id, day.driver.name]));
  const year = date.slice(0, 4);
  const heading = `${dayHeading(date)} ${year}`;
  const counted = (count: number, word: string) =>
    `${count} ${count === 1 ? word : `${word}s`}`;

  return (
    <OpsShell user={user} active="run-sheet">
      <PageHeader
        title="Daily Run Sheet"
        description={`${heading}${date === today ? " (today)" : ""} · every booking in pickup order, London time`}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <PrintButton className={buttonClass("secondary", "md")}>
              <Printer aria-hidden className="h-4 w-4" />
              Print
            </PrintButton>
            <DownloadCsv href={csvHref} />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-end gap-2">
          <Link
            href={href({ date: addDays(date, -1) })}
            className={buttonClass("secondary", "md")}
            aria-label="The day before"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </Link>
          <FilterForm action={PATH} className="flex items-end gap-2">
            {view === "driver" ? (
              <input type="hidden" name="view" value="driver" />
            ) : null}
            <div>
              <Label htmlFor="run-sheet-date">Day</Label>
              <TextInput
                id="run-sheet-date"
                name="date"
                type="date"
                defaultValue={date}
              />
            </div>
          </FilterForm>
          <Link
            href={href({ date: addDays(date, 1) })}
            className={buttonClass("secondary", "md")}
            aria-label="The day after"
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Link>
          {date !== today ? (
            <Link href={href({ date: today })} className={buttonClass("ghost", "md")}>
              Today
            </Link>
          ) : null}
        </div>
        <nav aria-label="View" className="border-line flex rounded-md border p-0.5">
          {(
            [
              ["day", "Whole day"],
              ["driver", "By driver"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={href({ view: value })}
              aria-current={view === value ? "page" : undefined}
              className={cx(
                "rounded px-3 py-1.5 text-sm font-medium",
                view === value
                  ? "bg-accent text-on-solid"
                  : "text-ink-2 hover:bg-sunken hover:text-ink",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <p className="text-ink-3 mb-4 text-sm">
        <span className="text-ink font-medium">{heading}</span> ·{" "}
        {counted(sheet.jobs.length, "booking")} · {counted(sheet.days.length, "driver")}
        {sheet.unassigned.length ? ` · ${sheet.unassigned.length} with no driver` : ""}
        {cancelled ? ` · ${cancelled} cancelled, not shown` : ""}
      </p>

      {sheet.warnings.length ? (
        <Panel
          className="mb-5 print:hidden"
          title={
            <span className="inline-flex items-center gap-2">
              <AlertTriangle aria-hidden className="text-warn h-4 w-4" />
              Needs attention
            </span>
          }
          description="Most urgent first"
          bodyClassName="p-0"
        >
          <ul>
            {sheet.warnings.map((warning, index) => (
              <li
                key={`${warning.jobId}-${index}`}
                className="border-line flex flex-wrap items-baseline gap-x-3 border-t px-4 py-2 text-sm first:border-t-0"
              >
                <span className="text-ink-3 w-12 shrink-0 tabular-nums">
                  {formatTime(new Date(warning.pickupAt))}
                </span>
                <Link
                  href={`/admin/jobs/${warning.jobId}`}
                  className="text-ink font-medium hover:underline"
                >
                  {warning.reference}
                </Link>
                <span className={warning.tone === "danger" ? "text-danger" : "text-warn"}>
                  {warning.text}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {sheet.jobs.length === 0 ? (
        <Panel>
          <EmptyState
            title={`No bookings on ${heading}`}
            description={
              cancelled ? `${counted(cancelled, "booking")} cancelled.` : undefined
            }
          />
        </Panel>
      ) : view === "day" ? (
        <Panel bodyClassName="p-0">
          <ul className="[&>li:first-child]:border-t-0">
            {sheet.jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                showDriver
                driverName={
                  job.driverId
                    ? (nameOf.get(job.driverId) ?? null)
                    : job.operatorName
                      ? `${job.operatorName} (operator)`
                      : null
                }
              />
            ))}
          </ul>
        </Panel>
      ) : (
        <div className="flex flex-col gap-5">
          {sheet.days.map((day, index) => {
            const message = messages.get(day.driver.id);
            const first = day.jobs[0]!;
            const last = day.jobs[day.jobs.length - 1]!;
            return (
              <Panel
                key={day.driver.id}
                className={index > 0 ? "print:break-before-page" : undefined}
                title={day.driver.name}
                description={
                  <>
                    <a
                      href={`tel:${day.driver.phone}`}
                      className="text-accent tabular-nums hover:underline"
                    >
                      {day.driver.phone}
                    </a>
                    {day.vehicles.length ? ` · ${day.vehicles.join(", ")}` : ""} ·{" "}
                    {counted(day.jobs.length, "booking")},{" "}
                    {day.jobs.length > 1
                      ? `${formatTime(new Date(first.pickupAt))}–${formatTime(new Date(last.pickupAt))}`
                      : formatTime(new Date(first.pickupAt))}
                  </>
                }
                actions={
                  message ? (
                    day.driver.whatsappConsent ? (
                      <a
                        href={whatsappLink(day.driver.phone, message)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cx(buttonClass("secondary", "md"), "print:hidden")}
                      >
                        <MessageCircle aria-hidden className="h-4 w-4" />
                        Send day on WhatsApp
                      </a>
                    ) : (
                      <span className="text-ink-3 text-xs print:hidden">
                        Has not agreed to WhatsApp messages
                      </span>
                    )
                  ) : null
                }
                bodyClassName="p-0"
              >
                <ul className="[&>li:first-child]:border-t-0">
                  {day.jobs.flatMap((job, position) => {
                    const gap = day.gaps[position];
                    const rows = [
                      <JobRow
                        key={job.id}
                        job={job}
                        showDriver={false}
                        driverName={null}
                      />,
                    ];
                    if (gap !== null && gap !== undefined) {
                      rows.push(
                        <li
                          key={`gap-${job.id}`}
                          className={cx(
                            "border-line bg-sunken border-t px-4 py-1 text-xs",
                            gap < CLASH_MINUTES ? "text-warn font-medium" : "text-ink-3",
                          )}
                        >
                          {durationText(gap)} to the next pickup
                          {gap < CLASH_MINUTES ? " — tight" : ""}
                        </li>,
                      );
                    }
                    return rows;
                  })}
                </ul>
              </Panel>
            );
          })}
          {sheet.unassigned.length ? (
            <Panel
              className={sheet.days.length ? "print:break-before-page" : undefined}
              title="No driver yet"
              description={counted(sheet.unassigned.length, "booking")}
              bodyClassName="p-0"
            >
              <ul className="[&>li:first-child]:border-t-0">
                {sheet.unassigned.map((job) => (
                  <JobRow key={job.id} job={job} showDriver={false} driverName={null} />
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      )}
    </OpsShell>
  );
}
