import { AlertTriangle, Inbox, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { ButtonLink } from "./primitives";

/**
 * Empty, error and no-access states (spec §47). Every list says what an empty
 * result means, and what to do next, instead of showing a blank space.
 */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="bg-sunken text-ink-3 mb-3 flex h-10 w-10 items-center justify-center rounded-full">
        {icon ?? <Inbox aria-hidden className="h-5 w-5" />}
      </div>
      <p className="text-md text-ink font-semibold">{title}</p>
      {description ? (
        <p className="text-ink-3 mt-1 max-w-md text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  retryHref,
}: {
  title?: string;
  description?: ReactNode;
  retryHref?: string;
}) {
  return (
    <div
      role="alert"
      className="border-danger-line bg-danger-soft flex flex-col items-center justify-center rounded-lg border px-6 py-10 text-center"
    >
      <AlertTriangle aria-hidden className="text-danger mb-2 h-6 w-6" />
      <p className="text-md text-danger font-semibold">{title}</p>
      {description ? (
        <p className="text-ink-2 mt-1 max-w-md text-sm">{description}</p>
      ) : null}
      {retryHref ? (
        <ButtonLink href={retryHref} size="sm" className="mt-4">
          Try again
        </ButtonLink>
      ) : null}
    </div>
  );
}

export function NoAccess({ reason }: { reason: "deactivated" | "role" }) {
  return (
    <div className="border-line bg-surface mx-auto mt-10 max-w-md rounded-lg border p-8 text-center shadow-xs">
      <Lock aria-hidden className="text-ink-3 mx-auto mb-3 h-6 w-6" />
      <h1 className="text-ink text-xl font-semibold">
        {reason === "deactivated"
          ? "Your account is deactivated"
          : "You do not have access to this"}
      </h1>
      <p className="text-ink-3 mt-2 text-base">
        {reason === "deactivated"
          ? "Ask the owner to reactivate your account."
          : "Your role does not include this part of the system. Ask the owner if you need it."}
      </p>
      <ButtonLink href="/admin/dashboard" className="mt-5">
        Go to the dashboard
      </ButtonLink>
    </div>
  );
}

/** A whole page for someone who may not open it. */
export function DeniedPage({ reason }: { reason: "deactivated" | "role" }) {
  return (
    <div className="ops-root min-h-dvh p-4">
      <NoAccess reason={reason} />
    </div>
  );
}
