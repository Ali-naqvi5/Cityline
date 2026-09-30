/** How fleet records are described to staff; values match the collections. */

export const DRIVER_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  suspended: "Suspended",
  left: "Left",
};

export const EMPLOYMENT_LABELS: Record<string, string> = {
  self_employed: "Self-employed",
  employee: "Employee",
};

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  off_road: "Off the road",
  sold: "Sold or returned",
};

export const OWNERSHIP_LABELS: Record<string, string> = {
  company: "Company-owned",
  driver: "Driver-owned",
  hired: "Hired",
};

export const PAY_MESSAGE_LABELS: Record<string, string> = {
  default: "Company default",
  show: "Shown in job messages",
  hide: "Hidden from job messages",
};
