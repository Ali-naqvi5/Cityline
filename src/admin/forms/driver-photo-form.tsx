"use client";

import { ImageUp } from "lucide-react";
import { useActionState } from "react";

import { saveDriverPhotoAction } from "@/admin/actions/fleet";
import { EMPTY_FORM } from "@/admin/form-state";
import { FormMessage, invalid, SubmitButton, submitWith } from "@/components/ops/form";

/** Uploads the driver's photograph, which TfL's driver record must hold. */
export function DriverPhotoForm({
  driverId,
  hasPhoto,
}: {
  driverId: number;
  hasPhoto: boolean;
}) {
  const [state, action, pending] = useActionState(saveDriverPhotoAction, EMPTY_FORM);
  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={driverId} />
      <label htmlFor="driver-photo" className="text-ink-2 text-sm font-medium">
        {hasPhoto ? "Replace the photo" : "Upload a photo"}
      </label>
      <input
        id="driver-photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="text-ink-2 file:border-line file:bg-surface file:text-ink hover:file:bg-sunken text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
        {...invalid(state.errors.photo, "driver-photo")}
      />
      {state.errors.photo ? (
        <p id="driver-photo-error" className="text-danger text-sm">
          {state.errors.photo}
        </p>
      ) : (
        <p className="text-ink-3 text-xs">A clear, recent photo. JPG, PNG or WebP.</p>
      )}
      <FormMessage state={state} />
      <div>
        <SubmitButton pending={pending} variant="secondary" pendingLabel="Uploading…">
          <ImageUp aria-hidden className="h-4 w-4" />
          Save photo
        </SubmitButton>
      </div>
    </form>
  );
}
