"use client";

import { AlertTriangle, Ban, Building, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { assignOperatorAction } from "@/admin/actions/dispatch";
import type { BoardOperator } from "@/admin/data/dispatch";
import { EMPTY_FORM } from "@/admin/form-state";
import {
  FormMessage,
  inputClass,
  invalid,
  SubmitButton,
  submitWith,
  TEXTAREA_CLASS,
} from "@/components/ops/form";
import { Badge, buttonClass, cx } from "@/components/ops/primitives";

/**
 * Giving a booking to a subcontracting operator (Cityline, 15 Oct 2026): a
 * licensed operator who does it with their own driver and car, none of which
 * Cityline records. One who has left, or whose recorded licence has run out,
 * cannot take it; missing licence details are only a warning. The price is
 * what Cityline pays the operator, in Driver Pay. Taking the booking from
 * whoever has it now asks why.
 */
export function AssignOperatorForm({
  jobId,
  operators,
  current,
  pricePence,
  cancelHref,
}: {
  jobId: number;
  operators: BoardOperator[];
  /** Whoever has the booking now: a driver, or an operator (with their id). */
  current: { operatorId: number | null; name: string } | null;
  pricePence: number | null;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(assignOperatorAction, EMPTY_FORM);
  const [chosenId, setChosenId] = useState(
    current?.operatorId ? String(current.operatorId) : "",
  );
  const chosen = operators.find((row) => String(row.id) === chosenId) ?? null;
  const replacing =
    current !== null && chosen !== null && chosen.id !== current.operatorId;

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="operatorId" value={chosen?.id ?? ""} />

      <ul
        className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1"
        aria-label="Operators"
      >
        {operators.map((row) => {
          const active = String(row.id) === chosenId;
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setChosenId(String(row.id))}
                aria-pressed={active}
                className={cx(
                  "flex w-full gap-3 rounded-md border p-3 text-left transition-colors",
                  active
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:border-line-strong hover:bg-sunken",
                  row.blocks.length ? "opacity-75" : "",
                )}
              >
                <Building aria-hidden className="text-ink-3 mt-0.5 h-5 w-5 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-ink text-base font-semibold">{row.name}</span>
                    {current?.operatorId === row.id ? (
                      <Badge tone="info">Assigned now</Badge>
                    ) : null}
                    {row.blocks.length ? (
                      <Badge tone="danger" icon={<Ban aria-hidden className="h-3 w-3" />}>
                        Cannot take it
                      </Badge>
                    ) : row.warnings.length ? (
                      <Badge
                        tone="warn"
                        icon={<AlertTriangle aria-hidden className="h-3 w-3" />}
                      >
                        {row.warnings.length === 1
                          ? "1 thing to check"
                          : `${row.warnings.length} things to check`}
                      </Badge>
                    ) : (
                      <Badge
                        tone="ok"
                        icon={<CheckCircle2 aria-hidden className="h-3 w-3" />}
                      >
                        Licensed
                      </Badge>
                    )}
                  </span>
                  <span className="text-ink-2 text-sm">
                    Licensed by {row.licensedFrom}
                    {row.licenceNumber ? (
                      <>
                        {" "}
                        · licence{" "}
                        <span className="tabular-nums">{row.licenceNumber}</span>
                      </>
                    ) : null}{" "}
                    · <span className="tabular-nums">{row.phone}</span>
                  </span>
                  {row.blocks.length ? (
                    <span className="text-danger text-sm">{row.blocks.join(" ")}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-line bg-surface sticky bottom-0 -mx-4 flex flex-col gap-3 border-t px-4 pt-4 pb-4">
        {chosen ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-ink">
              Give this booking to <strong>{chosen.name}</strong>. They do it with their
              own driver and car.
            </p>
            {chosen.blocks.length ? (
              <ul className="text-danger flex flex-col gap-0.5">
                {chosen.blocks.map((block) => (
                  <li key={block}>{block}</li>
                ))}
              </ul>
            ) : null}
            {chosen.warnings.length ? (
              <ul className="text-warn flex flex-col gap-0.5">
                {chosen.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-ink-3 text-sm">Choose an operator from the list.</p>
        )}

        {replacing ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="taken-off-reason" className="text-ink-2 text-sm font-medium">
              Why is {current.name} coming off this booking?
            </label>
            <textarea
              id="taken-off-reason"
              name="reason"
              rows={2}
              maxLength={1000}
              required
              className={TEXTAREA_CLASS}
              {...invalid(state.errors.reason, "taken-off-reason")}
            />
            {state.errors.reason ? (
              <p id="taken-off-reason-error" className="text-danger text-sm">
                {state.errors.reason}
              </p>
            ) : (
              <p className="text-ink-3 text-xs">Kept on the booking&apos;s history.</p>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label htmlFor="driverPrice" className="text-ink-2 text-sm font-medium">
            Operator price
          </label>
          <div className="relative w-36">
            <span
              aria-hidden
              className="text-ink-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base lg:text-sm"
            >
              £
            </span>
            <input
              id="driverPrice"
              name="driverPrice"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={pricePence === null ? "" : (pricePence / 100).toFixed(2)}
              placeholder="0.00"
              className={inputClass("pl-7 tabular-nums")}
              {...invalid(state.errors.driverPrice, "driverPrice")}
            />
          </div>
          {state.errors.driverPrice ? (
            <p id="driverPrice-error" className="text-danger text-sm">
              {state.errors.driverPrice}
            </p>
          ) : (
            <p className="text-ink-3 text-xs">
              What Cityline pays the operator for this booking, in Driver Pay. It can also
              be written later on the booking.
            </p>
          )}
        </div>

        <FormMessage state={state} />
        {state.errors.operatorId ? (
          <p role="alert" className="text-danger text-sm">
            {state.errors.operatorId}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton pending={pending} pendingLabel="Assigning…">
            <Building aria-hidden className="h-4 w-4" />
            Assign to operator
          </SubmitButton>
          <Link href={cancelHref} className={buttonClass("ghost", "md")}>
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
