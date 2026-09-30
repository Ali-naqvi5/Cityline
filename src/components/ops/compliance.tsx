import { CheckCircle2, CircleSlash, Clock, ShieldAlert, ShieldCheck } from "lucide-react";

import { daysUntil, type DocumentStatus } from "@/domain/compliance/documents";

import { Badge, type Tone } from "./primitives";

/**
 * Compliance in words as well as colour (spec §24, §25, §53): Expired and
 * Missing block assignment; Urgent is 7 days or fewer; Warning is 30 or fewer.
 */

const ICON = "h-3.5 w-3.5";

export function DocumentStatusBadge({
  status,
  expiresAt,
  now,
}: {
  status: DocumentStatus;
  expiresAt?: string | null;
  now: Date;
}) {
  const days = expiresAt ? daysUntil(expiresAt, now) : null;
  const inDays = days === null ? "" : ` · ${days} day${days === 1 ? "" : "s"}`;
  const map: Record<
    DocumentStatus,
    { tone: Tone; label: string; icon: React.ReactNode }
  > = {
    missing: {
      tone: "danger",
      label: "Missing",
      icon: <CircleSlash aria-hidden className={ICON} />,
    },
    expired: {
      tone: "danger",
      label: "Expired",
      icon: <ShieldAlert aria-hidden className={ICON} />,
    },
    expiring_7: {
      tone: "danger",
      label: `Urgent${inDays}`,
      icon: <Clock aria-hidden className={ICON} />,
    },
    expiring_14: {
      tone: "warn",
      label: `Warning${inDays}`,
      icon: <Clock aria-hidden className={ICON} />,
    },
    expiring_30: {
      tone: "warn",
      label: `Warning${inDays}`,
      icon: <Clock aria-hidden className={ICON} />,
    },
    valid: {
      tone: "ok",
      label: "Valid",
      icon: <CheckCircle2 aria-hidden className={ICON} />,
    },
  };
  const { tone, label, icon } = map[status];
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}

/** One badge for a driver or vehicle as a whole. */
export function ComplianceBadge({ worst }: { worst: DocumentStatus }) {
  if (worst === "missing" || worst === "expired") {
    return (
      <Badge tone="danger" icon={<ShieldAlert aria-hidden className={ICON} />}>
        Assignment blocked
      </Badge>
    );
  }
  if (worst === "expiring_7" || worst === "expiring_14" || worst === "expiring_30") {
    return (
      <Badge
        tone={worst === "expiring_7" ? "danger" : "warn"}
        icon={<Clock aria-hidden className={ICON} />}
      >
        Expiring soon
      </Badge>
    );
  }
  return (
    <Badge tone="ok" icon={<ShieldCheck aria-hidden className={ICON} />}>
      Compliant
    </Badge>
  );
}

export const DRIVER_STATUS_TONE: Record<string, Tone> = {
  active: "ok",
  suspended: "danger",
  left: "neutral",
};

export const VEHICLE_STATUS_TONE: Record<string, Tone> = {
  active: "ok",
  off_road: "warn",
  sold: "neutral",
};
