"use client";

import { Undo2 } from "lucide-react";
import { useActionState } from "react";

import { setStatusAction } from "@/admin/actions/dispatch";
import { EMPTY_FORM } from "@/admin/form-state";
import { inputClass, SubmitButton, submitWith } from "@/components/ops/form";

/**
 * Stepping a booking back — POB to DAP, or further — to correct a stage
 * pressed too soon. Any number of stages back is allowed; forward is one at
 * a time, from the buttons above.
 */
export function StepBackForm({
  jobId,
  options,
}: {
  jobId: number;
  options: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(setStatusAction, EMPTY_FORM);
  if (options.length === 0) return null;

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-1">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`step-back-${jobId}`} className="text-ink-3 text-xs font-medium">
          Step back to
        </label>
        <select
          id={`step-back-${jobId}`}
          name="status"
          defaultValue={options[0]?.value}
          className={inputClass("w-auto min-w-48")}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <SubmitButton
          pending={pending}
          variant="ghost"
          size="sm"
          pendingLabel="Stepping back…"
        >
          <Undo2 aria-hidden className="h-4 w-4" />
          Step back
        </SubmitButton>
      </div>
      {state.message ? (
        <p role="alert" className="text-danger text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
