/**
 * Who may do what in the admin (ADM-03), as one table.
 *
 * Everything reads this: the sidebar decides what to show, every admin screen
 * and server action decides whether to run, and every collection's `access`
 * functions decide what Payload will read or write. The interface hides; the
 * server refuses — and both ask the same question here, so they cannot drift.
 *
 * Roles, from Cityline's admin specification:
 *
 *   Owner       everything, including company finance and drivers' bank
 *               details.
 *   Controller  operations: jobs, dispatch, bookings, drivers, vehicles,
 *               compliance, suppliers, operational reports. No company
 *               finance, no bank details.
 *   Accounts    finance: payments, refunds, driver pay, supplier money,
 *               expenses, financial reports, and the money on each job. Jobs
 *               and bookings read-only, for context; no dispatch.
 *   Editor      website content and media only.
 */

export const ROLES = ["owner", "controller", "accounts", "editor"] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  "dashboard",
  // Operations
  "jobs.view",
  "jobs.edit",
  "jobs.dispatch",
  "customers.view",
  "customers.edit",
  "quotes.view",
  "bookings.view",
  "bookings.amend",
  // Fleet
  "drivers.view",
  "drivers.edit",
  "drivers.bankDetails",
  "vehicles.view",
  "vehicles.edit",
  "compliance.view",
  "compliance.verify",
  "suppliers.view",
  "suppliers.edit",
  // Finance
  "finance.jobs",
  "payments.view",
  "refunds.view",
  "refunds.issue",
  "driverPay.view",
  "driverPay.manage",
  "supplierMoney.view",
  "supplierMoney.manage",
  "expenses.view",
  "expenses.manage",
  "reports.financial",
  // Records and reports
  "reports.operational",
  "tfl.register",
  "runSheet",
  // Administration
  "staff.manage",
  "audit.view",
  "settings.prices",
  "settings.bookingRules",
  "settings.company",
  "content.manage",
  "system.view",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const CONTROLLER: readonly Capability[] = [
  "dashboard",
  "jobs.view",
  "jobs.edit",
  "jobs.dispatch",
  "customers.view",
  "customers.edit",
  "quotes.view",
  "bookings.view",
  "bookings.amend",
  "drivers.view",
  "drivers.edit",
  "vehicles.view",
  "vehicles.edit",
  "compliance.view",
  "compliance.verify",
  "suppliers.view",
  "suppliers.edit",
  "reports.operational",
  "tfl.register",
  "runSheet",
];

const ACCOUNTS: readonly Capability[] = [
  "dashboard",
  // Read-only operations context for the money.
  "jobs.view",
  "bookings.view",
  "customers.view",
  "drivers.view",
  "suppliers.view",
  // Finance.
  "finance.jobs",
  "payments.view",
  "refunds.view",
  "refunds.issue",
  "driverPay.view",
  "driverPay.manage",
  "supplierMoney.view",
  "supplierMoney.manage",
  "expenses.view",
  "expenses.manage",
  "reports.financial",
];

const EDITOR: readonly Capability[] = ["dashboard", "content.manage"];

const MATRIX: Record<Role, ReadonlySet<Capability>> = {
  owner: new Set(CAPABILITIES),
  controller: new Set(CONTROLLER),
  accounts: new Set(ACCOUNTS),
  editor: new Set(EDITOR),
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Whether a role may use a capability. Unknown roles may do nothing. */
export function can(role: unknown, capability: Capability): boolean {
  return isRole(role) && MATRIX[role].has(capability);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  controller: "Controller",
  accounts: "Accounts",
  editor: "Editor",
};

/** The subset of a staff user every permission check needs. */
export interface StaffIdentity {
  id: number | string;
  role?: unknown;
  active?: boolean | null;
}

/**
 * Whether this signed-in person may use a capability right now. A deactivated
 * account keeps no access even if its session has not expired yet.
 */
export function staffCan(
  user: StaffIdentity | null | undefined,
  capability: Capability,
): boolean {
  if (!user) return false;
  if (user.active === false) return false;
  return can(user.role, capability);
}
