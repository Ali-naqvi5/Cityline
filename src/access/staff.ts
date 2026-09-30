import type { Access } from "payload";

import {
  staffCan,
  type Capability,
  type StaffIdentity,
} from "@/domain/staff/permissions";

/**
 * Collection access from the permission matrix (`domain/staff/permissions.ts`).
 *
 * These guard Payload's REST and GraphQL APIs and every Local API call made
 * with `overrideAccess: false` — which is how the admin screens read and write.
 * The website's own server code (checkout, Manage booking) calls the Local API
 * with access overridden, so the public site is unaffected.
 */
export function allow(capability: Capability): Access {
  return ({ req }) => staffCan(req.user as StaffIdentity | null, capability);
}

/** Allowed when the user has any one of the capabilities. */
export function allowAny(...capabilities: Capability[]): Access {
  return ({ req }) =>
    capabilities.some((capability) =>
      staffCan(req.user as StaffIdentity | null, capability),
    );
}
