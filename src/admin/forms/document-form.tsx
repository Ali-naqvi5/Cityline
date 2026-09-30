"use client";

import { useActionState } from "react";

import { addDocumentAction } from "@/admin/actions/fleet";
import { EMPTY_FORM } from "@/admin/form-state";
import {
  FormField,
  FormMessage,
  inputClass,
  invalid,
  SubmitButton,
  submitWith,
  TEXTAREA_CLASS,
} from "@/components/ops/form";

/**
 * Adding a document to a driver or vehicle, with its scan. A renewal is a new
 * document; the latest one counts.
 */
export function DocumentForm({
  kind,
  ownerId,
  types,
}: {
  kind: "driver" | "vehicle";
  ownerId: number;
  types: { value: string; label: string; expires: boolean }[];
}) {
  const [state, action, pending] = useActionState(addDocumentAction, EMPTY_FORM);
  const e = state.errors;

  return (
    <form onSubmit={submitWith(action)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="ownerId" value={ownerId} />

      <FormField id="doc-type" label="Document" required error={e.type}>
        <select
          id="doc-type"
          name="type"
          defaultValue=""
          className={inputClass()}
          {...invalid(e.type, "doc-type")}
        >
          <option value="" disabled>
            Choose…
          </option>
          {types.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        id="doc-number"
        label="Number"
        error={e.number}
        hint={kind === "driver" ? "The PHV licence number is required." : undefined}
      >
        <input
          id="doc-number"
          name="number"
          autoComplete="off"
          className={inputClass("tabular-nums")}
          {...invalid(e.number, "doc-number")}
        />
      </FormField>
      <FormField id="doc-issued" label="Issued" error={e.issuedAt}>
        <input id="doc-issued" name="issuedAt" type="date" className={inputClass()} />
      </FormField>
      <FormField
        id="doc-expires"
        label="Expires"
        error={e.expiresAt}
        hint="Valid until the end of this day. Required for licences, MOT, insurance and DBS."
      >
        <input
          id="doc-expires"
          name="expiresAt"
          type="date"
          className={inputClass()}
          {...invalid(e.expiresAt, "doc-expires")}
        />
      </FormField>
      <FormField
        id="doc-file"
        label="Scan or photo"
        wide
        error={e.file}
        hint="PDF, JPG, PNG or WebP, up to 10 MB. Stored privately."
      >
        <input
          id="doc-file"
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="text-ink-2 file:border-line-strong file:bg-surface file:text-ink-2 hover:file:bg-sunken block w-full text-sm file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border file:px-3 file:text-sm file:font-medium"
        />
      </FormField>
      <FormField id="doc-notes" label="Notes" wide error={e.notes}>
        <textarea id="doc-notes" name="notes" rows={2} className={TEXTAREA_CLASS} />
      </FormField>
      <label
        htmlFor="doc-checked"
        className="text-ink-2 flex cursor-pointer items-center gap-2 text-sm sm:col-span-2"
      >
        <input
          id="doc-checked"
          name="checked"
          type="checkbox"
          defaultChecked
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        I have checked the original document
      </label>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pending={pending} pendingLabel="Uploading…">
          Add document
        </SubmitButton>
      </div>
    </form>
  );
}
