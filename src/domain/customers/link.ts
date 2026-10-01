import type { Payload, PayloadRequest } from "payload";

import type { Customer, User } from "@/payload-types";

import { matchCustomer } from "./match";

/**
 * Finding — or recording — the customer behind an office booking, by the
 * rules in `match.ts`. Read and written as the member of staff, so the
 * customers collection's access applies.
 */

type As = { user: User; overrideAccess: false; req?: PayloadRequest };

export interface CustomerContact {
  name: string;
  /** E.164, as the job form stores it. */
  phone: string;
  email?: string | null;
}

export async function findCustomer(
  payload: Payload,
  contact: CustomerContact,
  as: As,
): Promise<Customer | null> {
  const email = contact.email?.trim().toLowerCase() || null;
  const byEmail = email
    ? await payload.find({
        collection: "customers",
        where: { email: { equals: email } },
        limit: 1,
        depth: 0,
        ...as,
      })
    : { docs: [] as Customer[] };
  const byPhone = await payload.find({
    collection: "customers",
    where: { phone: { equals: contact.phone } },
    limit: 20,
    depth: 0,
    ...as,
  });
  return matchCustomer(
    contact,
    byEmail.docs.map((doc) => ({ ...doc, email: doc.email ?? null })),
    byPhone.docs.map((doc) => ({ ...doc, email: doc.email ?? null })),
  ) as Customer | null;
}

export async function findOrCreateCustomer(
  payload: Payload,
  contact: CustomerContact,
  as: As,
  isTest = false,
): Promise<Customer> {
  const found = await findCustomer(payload, contact, as);
  if (found) return found;
  return payload.create({
    collection: "customers",
    data: {
      name: contact.name,
      phone: contact.phone,
      // Not matched by email above, so nobody else has it.
      email: contact.email?.trim().toLowerCase() || null,
      isTest,
    },
    ...as,
  });
}
