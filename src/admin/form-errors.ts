import "server-only";

import { ValidationError } from "payload";

import type { z } from "@/lib/zod";

import type { FormState } from "./form-state";

/** The first message per field, which is the one to fix first. */
export function zodErrors(error: z.ZodError): FormState {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field]) errors[field] = issue.message;
  }
  return { errors, message: "Please check the highlighted fields." };
}

const UNIQUE_MESSAGES: Record<string, string> = {
  phone: "Another driver already has this number.",
  registration: "A vehicle with this registration is already on record.",
  name: "A supplier with this name already exists.",
  supplierReference: "This supplier reference is already entered.",
};

/**
 * Payload's validation errors — required fields, unique values, the rules in
 * collection hooks — as field messages staff can act on. Anything else is
 * logged and reported plainly, never as a stack trace.
 */
/**
 * Payload's ValidationError, recognised by its shape — a list of field errors
 * under `data.errors`. Neither `instanceof` (the server bundle can hold two
 * copies of the class) nor the class name (minified in production) is
 * reliable.
 */
function asValidationError(
  error: unknown,
): { data: { errors: { path?: unknown; message?: unknown }[] } } | null {
  if (error instanceof ValidationError) return error as never;
  const candidate = error as { data?: { errors?: unknown } } | null;
  const errors = candidate?.data?.errors;
  if (
    Array.isArray(errors) &&
    errors.length > 0 &&
    errors.every((item) => item && typeof item === "object" && "message" in item)
  ) {
    return candidate as never;
  }
  return null;
}

export function payloadErrors(error: unknown, context: string): FormState {
  const validation = asValidationError(error);
  if (validation) {
    const errors: Record<string, string> = {};
    for (const item of validation.data.errors) {
      const path = String(item.path ?? "");
      const message = String(item.message ?? "");
      errors[path] =
        /unique/i.test(message) && UNIQUE_MESSAGES[path]
          ? UNIQUE_MESSAGES[path]
          : path === "file"
            ? "That file could not be accepted. Upload a PDF, JPG, PNG or WebP that opens normally."
            : message;
    }
    return { errors, message: "Please check the highlighted fields." };
  }
  console.error(`[admin] ${context}`, error);
  return {
    errors: {},
    message:
      "That could not be saved. Try again, and tell the owner if it keeps happening.",
  };
}

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}
