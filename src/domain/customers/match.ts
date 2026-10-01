/**
 * Which customer a booking belongs to (Cityline, 2 Oct 2026: one history per
 * person, however they book).
 *
 *   1. The customer with this email, when one is given — an email is personal.
 *   2. Otherwise the customer with this phone *and this name*. A household or
 *      an office often shares one phone; a different name on it is a
 *      different person, and gets their own record.
 *   3. Otherwise nobody yet: the caller records a new customer.
 */

export interface CustomerCandidate {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
}

/** Names compare without case, extra spaces or full stops: "J. Smith" = "j smith". */
export function sameName(a: string, b: string): boolean {
  const clean = (value: string) =>
    value.toLowerCase().replace(/[.,']/g, "").replace(/\s+/g, " ").trim();
  return clean(a) !== "" && clean(a) === clean(b);
}

export function matchCustomer<T extends CustomerCandidate>(
  contact: { name: string; phone: string; email?: string | null },
  byEmail: readonly T[],
  byPhone: readonly T[],
): T | null {
  const email = contact.email?.trim().toLowerCase();
  if (email) {
    const found = byEmail.find((customer) => customer.email?.toLowerCase() === email);
    if (found) return found;
  }
  return (
    byPhone.find(
      (customer) =>
        customer.phone === contact.phone && sameName(customer.name, contact.name),
    ) ?? null
  );
}
