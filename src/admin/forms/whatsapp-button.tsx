"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition } from "react";

import { recordWhatsAppAction } from "@/admin/actions/dispatch";
import { buttonClass, type ButtonVariant } from "@/components/ops/primitives";
import type { DriverMessageKind } from "@/domain/messaging/driver-message";

/**
 * "Send on WhatsApp" (spec §27): opens WhatsApp — the app on a phone,
 * WhatsApp Web on a computer — addressed to the driver with the message
 * written, and records on the job that it was opened. The controller presses
 * send in WhatsApp.
 */
export function WhatsAppButton({
  href,
  jobId,
  driverId,
  kind,
  label,
  variant = "primary",
}: {
  href: string;
  jobId: number;
  driverId: number;
  kind: DriverMessageKind;
  label: string;
  variant?: ButtonVariant;
}) {
  const router = useRouter();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass(variant, "md")}
      onClick={() =>
        startTransition(async () => {
          await recordWhatsAppAction(jobId, driverId, kind);
          router.refresh();
        })
      }
    >
      <MessageCircle aria-hidden className="h-4 w-4" />
      {label}
    </a>
  );
}
