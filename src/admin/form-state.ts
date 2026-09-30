/**
 * What an admin form's server action returns when it does not redirect:
 * errors by field, and a message for the form as a whole.
 *
 * Kept free of server imports: the client forms import `EMPTY_FORM` from
 * here. The server-side helpers are in `form-errors.ts`.
 */
export interface FormState {
  errors: Record<string, string>;
  message?: string;
}

export const EMPTY_FORM: FormState = { errors: {} };
