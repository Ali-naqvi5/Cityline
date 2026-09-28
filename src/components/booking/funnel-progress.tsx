import { Check } from "lucide-react";

import { Container } from "@/components/ui/container";

/**
 * The four-step progress indicator shown across the funnel (BK-01).
 *
 * Steps already completed are links, so someone can go back and change their
 * journey without losing the booking. Steps ahead are not — you cannot skip to
 * payment before there is anything to pay for.
 */
export const FUNNEL_STEPS = [
  { id: 1, label: "Journey", href: "/book" },
  { id: 2, label: "Vehicle", href: "/book/vehicle" },
  { id: 3, label: "Details", href: "/book/details" },
  { id: 4, label: "Payment", href: "/book/payment" },
] as const;

export function FunnelProgress({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div className="border-outline-variant bg-surface-container-lowest border-b">
      <Container>
        <nav aria-label="Booking progress" className="py-space-md">
          <ol className="flex items-center gap-2 sm:gap-4">
            {FUNNEL_STEPS.map((step, index) => {
              const done = step.id < current;
              const active = step.id === current;

              return (
                <li key={step.id} className="flex flex-1 items-center gap-2 sm:gap-4">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={[
                        "text-label-sm flex h-7 w-7 shrink-0 items-center justify-center rounded-full tabular-nums",
                        done
                          ? "bg-primary-container text-on-primary"
                          : active
                            ? "bg-primary-container text-on-primary"
                            : "bg-surface-container-high text-on-surface-variant",
                      ].join(" ")}
                    >
                      {done ? <Check className="h-4 w-4" /> : step.id}
                    </span>

                    <span
                      className={[
                        "text-label-md truncate",
                        active
                          ? "text-on-surface font-semibold"
                          : "text-on-surface-variant hidden sm:inline",
                      ].join(" ")}
                    >
                      {active ? (
                        <>
                          <span className="sr-only">Step {step.id} of 4: </span>
                          {step.label}
                        </>
                      ) : (
                        step.label
                      )}
                    </span>
                  </span>

                  {index < FUNNEL_STEPS.length - 1 ? (
                    <span
                      aria-hidden
                      className={[
                        "h-px flex-1",
                        done ? "bg-primary-container" : "bg-outline-variant",
                      ].join(" ")}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>
      </Container>
    </div>
  );
}
