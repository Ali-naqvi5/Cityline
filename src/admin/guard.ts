import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminViewServerProps, Payload, PayloadRequest } from "payload";

import { isRole, staffCan, type Capability, type Role } from "@/domain/staff/permissions";
import { payloadClient } from "@/lib/payload";
import type { User } from "@/payload-types";

/**
 * The gate in front of every custom admin screen and server action.
 *
 * Payload's router does not send signed-out visitors to the login page when
 * the URL is a *custom* view (`isCustomAdminView` in its RootPage) — that is
 * left to the view. So every view calls `requireStaff` first, and every server
 * action calls `staffForAction`. Both check the same permission matrix as the
 * collections' `access` functions.
 */

export interface StaffContext {
  denied: false;
  user: User & { role: Role };
  payload: Payload;
  req: PayloadRequest;
}

export interface DeniedContext {
  denied: true;
  user: User;
  reason: "deactivated" | "role";
}

export function requireStaff(
  props: AdminViewServerProps,
  capability: Capability,
  returnTo: string,
): StaffContext | DeniedContext {
  const req = props.initPageResult.req;
  const user = req.user as User | null;

  if (!user) {
    redirect(`/admin/login?redirect=${encodeURIComponent(returnTo)}`);
  }

  if (user.active === false) return { denied: true, user, reason: "deactivated" };
  if (!staffCan(user, capability) || !isRole(user.role)) {
    return { denied: true, user, reason: "role" };
  }

  return {
    denied: false,
    user: user as User & { role: Role },
    payload: req.payload,
    req,
  };
}

export class NotAllowedError extends Error {
  constructor() {
    super("You do not have permission to do that.");
    this.name = "NotAllowedError";
  }
}

/**
 * For server actions: who is asking, checked again on the server. Throws when
 * they may not — an action must never trust that its button was only shown to
 * the right people.
 */
export async function staffForAction(
  capability: Capability,
): Promise<{ payload: Payload; user: User & { role: Role } }> {
  const payload = await payloadClient();
  const { user } = await payload.auth({ headers: await headers() });

  if (!user || !staffCan(user as User, capability) || !isRole((user as User).role)) {
    throw new NotAllowedError();
  }
  return { payload, user: user as User & { role: Role } };
}

/** Search params as Payload passes them to views: string or string[] per key. */
export function param(
  searchParams: AdminViewServerProps["searchParams"],
  key: string,
): string {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}
