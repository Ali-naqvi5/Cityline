import { Car, CheckCircle2, MapPin, UserCheck, UsersRound, UserX } from "lucide-react";
import type { ReactNode } from "react";

import { setStatusAction } from "@/admin/actions/dispatch";
import { clock, money, stamp } from "@/admin/format";
import { ActionButton, ConfirmDialog } from "@/components/ops/dialog";
import { inputClass } from "@/components/ops/form-classes";
import { cx } from "@/components/ops/primitives";
import { JOB_STATUS_SHORT, type JobStatus } from "@/domain/jobs/labels";
import { nextStages, stageName } from "@/domain/jobs/status";
import type { Job } from "@/payload-types";

/**
 * Moving a booking through its cycle (Cityline, 2 Oct 2026): the operator,
 * on the phone to the driver, presses the next stage as it happens. Only the
 * next stage is offered — the server refuses a jump anyway — and a
 * passenger no-show asks for confirmation, with the driver's price beside it
 * so it can be cut in the same step.
 *
 * Used on the booking page and, compact, on the bookings dashboard, where
 * `returnTo` keeps the operator on that screen.
 */

const ICON = "h-4 w-4";
const STAGE_ICON: Partial<Record<JobStatus, ReactNode>> = {
  driver_confirmed: <UserCheck aria-hidden className={ICON} />,
  on_the_way: <Car aria-hidden className={ICON} />,
  at_pickup: <MapPin aria-hidden className={ICON} />,
  on_board: <UsersRound aria-hidden className={ICON} />,
  completed: <CheckCircle2 aria-hidden className={ICON} />,
  no_show: <UserX aria-hidden className={ICON} />,
};

/** Compact labels: what an operator says, and what fits a table cell. */
const COMPACT_LABEL: Partial<Record<JobStatus, string>> = {
  driver_confirmed: "Confirmed",
  completed: "Complete",
};

type StageJob = Pick<
  Job,
  | "id"
  | "reference"
  | "status"
  | "pickupAt"
  | "leadName"
  | "pickupAddress"
  | "driverPricePence"
>;

export function NextStageButtons({
  job,
  now,
  compact,
  returnTo,
  className,
}: {
  job: StageJob;
  now: Date;
  compact?: boolean;
  returnTo?: string;
  className?: string;
}) {
  const status = job.status as JobStatus;
  const pickupAt = new Date(job.pickupAt);
  const stages = nextStages(status).filter((stage) => stage !== "assigned");
  if (stages.length === 0) return null;
  const size = compact ? "sm" : "md";
  const hidden = { jobId: job.id, ...(returnTo ? { returnTo } : {}) };

  return (
    <div className={cx("flex flex-wrap items-start gap-2", className)}>
      {stages.map((stage, index) => {
        const label = compact
          ? (COMPACT_LABEL[stage] ?? JOB_STATUS_SHORT[stage])
          : stageName(stage);

        if (stage === "no_show") {
          if (pickupAt > now) {
            return compact ? null : (
              <p key={stage} className="text-ink-3 self-center text-xs">
                PNS can be marked from {clock(pickupAt)}.
              </p>
            );
          }
          return (
            <ConfirmDialog
              key={stage}
              label={label}
              icon={STAGE_ICON[stage]}
              size={size}
              buttonTitle={stageName(stage)}
              title={`Passenger no-show on ${job.reference}?`}
              confirmLabel="Mark PNS"
              confirmVariant="danger"
              action={setStatusAction}
              fields={{ ...hidden, status: stage }}
            >
              <p>
                {job.leadName} did not turn up for the pickup at {job.pickupAddress}.
              </p>
              <p>
                The driver&apos;s price is{" "}
                {job.driverPricePence == null
                  ? "not written yet"
                  : money(job.driverPricePence)}
                . If you are paying them less for the wait, write the new price.
              </p>
              <label htmlFor={`pns-price-${job.id}`} className="text-ink-2 font-medium">
                Driver price (£)
              </label>
              <input
                id={`pns-price-${job.id}`}
                name="driverPrice"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={
                  job.driverPricePence == null
                    ? ""
                    : (job.driverPricePence / 100).toFixed(2)
                }
                className={inputClass("w-36 tabular-nums")}
              />
            </ConfirmDialog>
          );
        }

        return (
          <ActionButton
            key={stage}
            label={label}
            title={stageName(stage)}
            icon={STAGE_ICON[stage]}
            size={size}
            variant={index === 0 ? "primary" : "secondary"}
            pendingLabel={compact ? "…" : "Saving…"}
            action={setStatusAction}
            fields={{ ...hidden, status: stage }}
          />
        );
      })}
    </div>
  );
}

const LINE: { stage: JobStatus; field: keyof Job }[] = [
  { stage: "assigned", field: "dispatchedAt" },
  { stage: "driver_confirmed", field: "driverConfirmedAt" },
  { stage: "on_the_way", field: "onTheWayAt" },
  { stage: "at_pickup", field: "atPickupAt" },
  { stage: "on_board", field: "onBoardAt" },
  { stage: "completed", field: "completedAt" },
];

/**
 * Where the booking is in its cycle, with the time each stage was reached.
 * A stage counts as reached when its time is recorded: stepping back clears
 * the times of the stages undone, so the line always matches the status.
 */
export function StageProgress({ job }: { job: Job }) {
  const status = job.status as JobStatus;
  const noShow = status === "no_show";

  return (
    // Two rows of three in the booking page's narrow side column; one row of
    // six where the column is the full width.
    <ol
      aria-label="Progress"
      className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 xl:grid-cols-3"
    >
      {LINE.map(({ stage, field }) => {
        const shown: JobStatus = stage === "on_board" && noShow ? "no_show" : stage;
        const value = job[shown === "no_show" ? "noShowAt" : field];
        const at =
          typeof value === "string" && (job.driver || job.operator)
            ? new Date(value)
            : null;
        const current = shown === status;
        return (
          <li
            key={stage}
            aria-current={current ? "step" : undefined}
            className={cx(
              "flex flex-col rounded-md border px-2 py-1.5 text-xs",
              current
                ? noShow
                  ? "border-cat-4 bg-cat-4-soft text-cat-4"
                  : "border-accent bg-accent-soft text-accent"
                : at
                  ? "border-line bg-surface text-ink-2"
                  : "border-line bg-sunken text-ink-4",
            )}
          >
            <span className="font-semibold">
              {stage === "driver_confirmed" ? "Confirmed" : JOB_STATUS_SHORT[shown]}
            </span>
            <span className="tabular-nums" title={at ? stamp(at) : undefined}>
              {at ? clock(at) : "—"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
