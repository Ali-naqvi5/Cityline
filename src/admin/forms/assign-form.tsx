"use client";

import { AlertTriangle, CheckCircle2, UserCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { assignDriverAction } from "@/admin/actions/dispatch";
import { EMPTY_FORM } from "@/admin/form-state";
import { FormMessage, SubmitButton, submitWith } from "@/components/ops/form";
import { Badge, buttonClass, cx } from "@/components/ops/primitives";

export interface AssignChoice {
  /** "driverId:vehicleId" */
  pair: string;
  driverName: string;
  vehicle: string;
  registration: string;
  vehicleClass: string;
  upgrade: boolean;
  warnings: string[];
  current: boolean;
}

/**
 * Choosing who does a job (spec §19). Only eligible pairs are offered; each
 * shows its warnings before it is chosen, and again beside the confirm
 * button. The server checks the choice again when it saves.
 */
export function AssignForm({
  jobId,
  choices,
  notifyPassenger,
  canEmailPassenger,
  cancelHref,
}: {
  jobId: number;
  choices: AssignChoice[];
  notifyPassenger: boolean;
  canEmailPassenger: boolean;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(assignDriverAction, EMPTY_FORM);
  const [selected, setSelected] = useState(
    choices.find((choice) => choice.current)?.pair ?? "",
  );
  const chosen = choices.find((choice) => choice.pair === selected);

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
      <input type="hidden" name="jobId" value={jobId} />
      <fieldset>
        <legend className="sr-only">Driver and vehicle</legend>
        <ul className="flex flex-col gap-2">
          {choices.map((choice) => {
            const id = `pair-${choice.pair.replace(":", "-")}`;
            const active = choice.pair === selected;
            return (
              <li key={choice.pair}>
                <label
                  htmlFor={id}
                  className={cx(
                    "flex cursor-pointer gap-3 rounded-md border p-3 transition-colors",
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-line hover:border-line-strong hover:bg-sunken",
                  )}
                >
                  <input
                    id={id}
                    type="radio"
                    name="pair"
                    value={choice.pair}
                    checked={active}
                    onChange={() => setSelected(choice.pair)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-ink text-base font-semibold">
                        {choice.driverName}
                      </span>
                      {choice.current ? <Badge tone="info">Assigned now</Badge> : null}
                      {choice.warnings.length === 0 ? (
                        <Badge
                          tone="ok"
                          icon={<CheckCircle2 aria-hidden className="h-3 w-3" />}
                        >
                          All clear
                        </Badge>
                      ) : (
                        <Badge
                          tone="warn"
                          icon={<AlertTriangle aria-hidden className="h-3 w-3" />}
                        >
                          {choice.warnings.length === 1
                            ? "1 warning"
                            : `${choice.warnings.length} warnings`}
                        </Badge>
                      )}
                    </span>
                    <span className="text-ink-2 text-sm">
                      {choice.vehicle} ·{" "}
                      <span className="font-medium tabular-nums">
                        {choice.registration}
                      </span>{" "}
                      · {choice.vehicleClass}
                      {choice.upgrade ? " (upgrade)" : ""}
                    </span>
                    {choice.warnings.length ? (
                      <ul className="text-warn flex flex-col gap-0.5 text-sm">
                        {choice.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="border-line bg-surface sticky bottom-0 -mx-4 flex flex-col gap-3 border-t px-4 pt-4 pb-4">
        {chosen ? (
          <p className="text-ink text-sm">
            Assign <strong>{chosen.driverName}</strong> with{" "}
            <strong className="tabular-nums">{chosen.registration}</strong>.
            {chosen.warnings.length
              ? " The warnings above do not stop the assignment — check them first."
              : ""}
          </p>
        ) : (
          <p className="text-ink-3 text-sm">Choose a driver above.</p>
        )}
        {canEmailPassenger ? (
          <label
            htmlFor="notifyPassenger"
            className="text-ink-2 flex cursor-pointer items-center gap-2 text-sm"
          >
            <input
              id="notifyPassenger"
              name="notifyPassenger"
              type="checkbox"
              defaultChecked={notifyPassenger}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Email the passenger their driver&apos;s details
          </label>
        ) : (
          <p className="text-ink-3 text-xs">
            There is no passenger email on this job, so no driver details will be emailed.
          </p>
        )}
        <FormMessage state={state} />
        {state.errors.pair ? (
          <p className="text-danger text-sm">{state.errors.pair}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton pending={pending} pendingLabel="Assigning…">
            <UserCheck aria-hidden className="h-4 w-4" />
            Confirm assignment
          </SubmitButton>
          <Link href={cancelHref} className={buttonClass("ghost", "md")}>
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
