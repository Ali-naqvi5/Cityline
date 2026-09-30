import {
  AlertTriangle,
  BadgePoundSterling,
  Banknote,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarClock,
  Car,
  ClipboardList,
  FileBarChart,
  FileClock,
  FileText,
  Image,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  MoreHorizontal,
  Receipt,
  RotateCcw,
  Route,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Truck,
  UserCog,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

import { can, type Capability, type Role } from "@/domain/staff/permissions";

/**
 * The admin's navigation, as data (Cityline's admin specification §4).
 *
 * The sidebar, the mobile "More" sheet and the tab bar all render from this,
 * filtered by the permission matrix — so a Controller never sees Finance, an
 * Editor sees only content. Hiding is for clarity; every screen checks the
 * same capability again on the server.
 *
 * `ready: false` items are screens still to be built. They are listed so the
 * shape of the system is visible, but render as "Soon", not as links —
 * nothing here pretends to work before it does.
 */

export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  jobs: ListChecks,
  dispatch: Route,
  customers: Users,
  quotes: FileText,
  bookings: BookOpenCheck,
  drivers: UserRound,
  vehicles: Car,
  compliance: ShieldCheck,
  suppliers: Building2,
  payments: Banknote,
  refunds: RotateCcw,
  driverPay: Wallet,
  supplierMoney: BadgePoundSterling,
  expenses: Receipt,
  financialReports: FileBarChart,
  jobsReport: ClipboardList,
  driverReports: UserRound,
  supplierReports: Building2,
  vehicleReports: Truck,
  tfl: ScrollText,
  runSheet: CalendarClock,
  staff: UserCog,
  audit: FileClock,
  prices: Tags,
  bookingRules: SlidersHorizontal,
  company: Building2,
  media: Image,
  settings: Settings,
  alerts: Bell,
  more: MoreHorizontal,
  warning: AlertTriangle,
} satisfies Record<string, LucideIcon>;

export type NavIconKey = keyof typeof NAV_ICONS;

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: NavIconKey;
  capability: Capability;
  ready: boolean;
}

export interface NavSection {
  id: string;
  label: string | null;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    id: "home",
    label: null,
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/admin/dashboard",
        icon: "dashboard",
        capability: "dashboard",
        ready: true,
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        id: "jobs",
        label: "Jobs",
        href: "/admin/jobs",
        icon: "jobs",
        capability: "jobs.view",
        ready: true,
      },
      {
        id: "dispatch",
        label: "Dispatch",
        href: "/admin/dispatch",
        icon: "dispatch",
        capability: "jobs.dispatch",
        ready: false,
      },
      {
        id: "customers",
        label: "Customers",
        href: "/admin/customers",
        icon: "customers",
        capability: "customers.view",
        ready: false,
      },
      {
        id: "quotes",
        label: "Quotes",
        href: "/admin/quotes",
        icon: "quotes",
        capability: "quotes.view",
        ready: false,
      },
      {
        id: "bookings",
        label: "Bookings",
        href: "/admin/bookings",
        icon: "bookings",
        capability: "bookings.view",
        ready: false,
      },
    ],
  },
  {
    id: "fleet",
    label: "Fleet",
    items: [
      {
        id: "drivers",
        label: "Drivers",
        href: "/admin/drivers",
        icon: "drivers",
        capability: "drivers.view",
        ready: false,
      },
      {
        id: "vehicles",
        label: "Vehicles",
        href: "/admin/vehicles",
        icon: "vehicles",
        capability: "vehicles.view",
        ready: false,
      },
      {
        id: "compliance",
        label: "Compliance",
        href: "/admin/compliance",
        icon: "compliance",
        capability: "compliance.view",
        ready: false,
      },
      {
        id: "suppliers",
        label: "Suppliers",
        href: "/admin/suppliers",
        icon: "suppliers",
        capability: "suppliers.view",
        ready: false,
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      {
        id: "payments",
        label: "Payments",
        href: "/admin/payments",
        icon: "payments",
        capability: "payments.view",
        ready: false,
      },
      {
        id: "refunds",
        label: "Refunds",
        href: "/admin/refunds",
        icon: "refunds",
        capability: "refunds.view",
        ready: false,
      },
      {
        id: "driver-pay",
        label: "Driver Pay",
        href: "/admin/driver-pay",
        icon: "driverPay",
        capability: "driverPay.view",
        ready: false,
      },
      {
        id: "supplier-money",
        label: "Supplier Money",
        href: "/admin/supplier-money",
        icon: "supplierMoney",
        capability: "supplierMoney.view",
        ready: false,
      },
      {
        id: "expenses",
        label: "Expenses",
        href: "/admin/expenses",
        icon: "expenses",
        capability: "expenses.view",
        ready: false,
      },
      {
        id: "financial-reports",
        label: "Financial Reports",
        href: "/admin/reports/finance",
        icon: "financialReports",
        capability: "reports.financial",
        ready: false,
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [
      {
        id: "jobs-report",
        label: "Jobs Report",
        href: "/admin/reports/jobs",
        icon: "jobsReport",
        capability: "reports.operational",
        ready: false,
      },
      {
        id: "driver-reports",
        label: "Driver Reports",
        href: "/admin/reports/drivers",
        icon: "driverReports",
        capability: "reports.operational",
        ready: false,
      },
      {
        id: "supplier-reports",
        label: "Supplier Reports",
        href: "/admin/reports/suppliers",
        icon: "supplierReports",
        capability: "reports.operational",
        ready: false,
      },
      {
        id: "vehicle-reports",
        label: "Vehicle Reports",
        href: "/admin/reports/vehicles",
        icon: "vehicleReports",
        capability: "reports.operational",
        ready: false,
      },
      {
        id: "tfl-register",
        label: "TfL Booking Register",
        href: "/admin/reports/tfl-register",
        icon: "tfl",
        capability: "tfl.register",
        ready: false,
      },
      {
        id: "run-sheet",
        label: "Daily Run Sheet",
        href: "/admin/reports/run-sheet",
        icon: "runSheet",
        capability: "runSheet",
        ready: false,
      },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      {
        id: "staff",
        label: "Staff",
        href: "/admin/staff",
        icon: "staff",
        capability: "staff.manage",
        ready: false,
      },
      {
        id: "audit",
        label: "Audit Log",
        href: "/admin/audit",
        icon: "audit",
        capability: "audit.view",
        ready: false,
      },
      {
        id: "prices",
        label: "Prices & Catalogue",
        href: "/admin/prices",
        icon: "prices",
        capability: "settings.prices",
        ready: false,
      },
      {
        id: "booking-rules",
        label: "Booking Rules",
        href: "/admin/booking-rules",
        icon: "bookingRules",
        capability: "settings.bookingRules",
        ready: false,
      },
      {
        id: "company",
        label: "Company Details",
        href: "/admin/company",
        icon: "company",
        capability: "settings.company",
        ready: false,
      },
      {
        id: "media",
        label: "Media / Content",
        href: "/admin/media",
        icon: "media",
        capability: "content.manage",
        ready: false,
      },
      {
        id: "settings",
        label: "Settings",
        href: "/admin/settings",
        icon: "settings",
        capability: "system.view",
        ready: true,
      },
    ],
  },
];

/** The navigation this role may see; empty sections are dropped. */
export function navFor(role: Role | undefined): NavSection[] {
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(role, item.capability)),
  })).filter((section) => section.items.length > 0);
}

/**
 * The mobile tab bar (spec §4): Dashboard, Jobs, Dispatch, Alerts, then More.
 * Limited to what the role may open and what exists yet.
 */
export interface MobileTab {
  id: string;
  label: string;
  href: string;
  icon: NavIconKey;
  capability: Capability;
  ready: boolean;
}

export const MOBILE_TABS: MobileTab[] = [
  {
    id: "dashboard",
    label: "Home",
    href: "/admin/dashboard",
    icon: "dashboard",
    capability: "dashboard",
    ready: true,
  },
  {
    id: "jobs",
    label: "Jobs",
    href: "/admin/jobs",
    icon: "jobs",
    capability: "jobs.view",
    ready: true,
  },
  {
    id: "dispatch",
    label: "Dispatch",
    href: "/admin/dispatch",
    icon: "dispatch",
    capability: "jobs.dispatch",
    ready: false,
  },
  {
    id: "alerts",
    label: "Alerts",
    href: "/admin/dashboard#alerts",
    icon: "alerts",
    capability: "dashboard",
    ready: true,
  },
];

export function mobileTabsFor(role: Role | undefined): MobileTab[] {
  return MOBILE_TABS.filter((tab) => tab.ready && can(role, tab.capability));
}
