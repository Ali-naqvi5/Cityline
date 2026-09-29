/**
 * What a Manage booking form shows after a failed submit. Kept out of
 * `actions.ts`, which as a `"use server"` module may only export functions.
 */
export interface ManageFormState {
  /** Field name → message, shown beside the field. */
  errors: Record<string, string>;
  /** A message about the whole form, shown above the buttons. */
  message?: string;
  /** The lookup form's reply, shown whether or not anything matched. */
  sent?: boolean;
}

export const EMPTY_FORM_STATE: ManageFormState = { errors: {} };
