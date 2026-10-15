import { MessageCircle, Phone } from "lucide-react";

import { buttonClass } from "@/components/ops/primitives";
import { whatsappChat } from "@/domain/messaging/driver-message";

/** Call or WhatsApp someone from a page — the office runs jobs live. */
export function ContactButtons({ phone, who }: { phone: string; who: string }) {
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5 print:hidden">
      <a
        href={`tel:${phone}`}
        className={buttonClass("secondary", "sm")}
        aria-label={`Call ${who}`}
      >
        <Phone aria-hidden className="h-4 w-4" />
        Call
      </a>
      <a
        href={whatsappChat(phone)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("secondary", "sm")}
        aria-label={`WhatsApp ${who}`}
      >
        <MessageCircle aria-hidden className="h-4 w-4" />
        WhatsApp
      </a>
    </span>
  );
}
