import "server-only";

import { env } from "@/env";

/**
 * Whether the driver's details are emailed to passengers (NOT-02). The email
 * and its sending are kept; Cityline switched them off on 9 Oct 2026, so no
 * passenger receives one until `DRIVER_DETAILS_EMAILS=on`.
 */
export function driverDetailsEmailsOn(): boolean {
  return env().DRIVER_DETAILS_EMAILS === "on";
}
