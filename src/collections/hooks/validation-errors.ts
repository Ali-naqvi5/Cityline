import type { AfterErrorHook } from "payload";

/**
 * Keeps the field messages on the API's validation errors — "Website jobs are
 * created by the website checkout only.", "Already entered as J-000123" —
 * rather than only "The following field is invalid: source".
 *
 * Payload adds them to the response only when the error passes its own
 * `instanceof ValidationError`, and the server bundle can hold two copies of
 * that class (see `src/admin/form-errors.ts`), so whether they appear would
 * otherwise depend on how a build happens to split its chunks. Only 400s
 * carrying a list of field errors are touched; anything else is left as
 * Payload made it, so nothing internal is ever exposed.
 */
export const keepValidationMessages: AfterErrorHook = ({ error, result }) => {
  const { status, data } = error as Error & {
    status?: number;
    data?: { errors?: unknown };
  };
  const errors = data?.errors;
  if (
    status !== 400 ||
    !Array.isArray(errors) ||
    errors.length === 0 ||
    !errors.every((item) => item && typeof item === "object" && "message" in item)
  ) {
    return;
  }
  if (result?.errors?.some((item) => item.data)) return;
  return {
    response: {
      errors: [{ name: "ValidationError", message: error.message, data }],
    },
  };
};
