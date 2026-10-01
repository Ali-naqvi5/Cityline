import { normalisePhone } from "@/domain/booking/passenger";
import { z } from "@/lib/zod";

/** A customer as the office records or corrects them (Customers section). */
export const customerSchema = z.object({
  name: z.string().min(2, "Enter the customer's name.").max(100),
  phone: z
    .string()
    .min(1, "Enter the customer's phone number.")
    .refine(
      (value) => normalisePhone(value) !== null,
      "Enter a valid phone number, such as 07700 900123 or +33 6 12 34 56 78.",
    ),
  email: z
    .string()
    .max(200)
    .refine(
      (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Enter a valid email address.",
    ),
  notes: z.string().max(2000),
});

export type CustomerInput = z.infer<typeof customerSchema>;

/** What the customers collection stores: phone in E.164, email lower-cased. */
export function customerData(input: CustomerInput) {
  return {
    name: input.name.trim(),
    phone: normalisePhone(input.phone) ?? input.phone,
    email: input.email.trim().toLowerCase() || null,
    notes: input.notes.trim() || null,
  };
}
