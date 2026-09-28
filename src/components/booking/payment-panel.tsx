import { CreditCard, Info, Lock, TriangleAlert } from "lucide-react";

import { StripePaymentForm } from "@/components/booking/stripe-payment-form";
import { formatPence, type Pence } from "@/domain/money";

/**
 * The payment box on step 4 (PAY-01).
 *
 * The design draws card number, expiry, security code and cardholder name as
 * ordinary fields on the page. They are not built that way, and will not be:
 * raw card data touching our own form would put Cityline into a much heavier
 * PCI regime. Stripe's Payment Element renders those fields inside an iframe
 * Stripe controls, which keeps us at SAQ-A — and brings Apple Pay and Google
 * Pay with it, so the design's separate "Digital Wallet" option is not needed.
 *
 * Without Stripe keys in the environment this renders an honest "not
 * connected" panel rather than a form that cannot take money.
 */
export function PaymentPanel({
  totalPence,
  clientSecret,
  notice,
}: {
  totalPence: Pence;
  /** The quote's Checkout Session secret; null when Stripe is not configured. */
  clientSecret: string | null;
  /** Set when the customer is sent back here after a payment did not complete. */
  notice?: "incomplete";
}) {
  return (
    <section className="border-outline-variant bg-surface-container-lowest rounded-card shadow-card border">
      <div className="border-outline-variant p-space-lg flex items-center justify-between gap-4 border-b">
        <h2 className="text-headline-sm flex items-center gap-2">
          <CreditCard aria-hidden className="text-primary h-5 w-5" />
          Payment
        </h2>
        <span className="text-body-sm text-on-surface-variant flex items-center gap-1.5">
          <Lock aria-hidden className="h-4 w-4" />
          Secure checkout
        </span>
      </div>

      <div className="p-space-lg">
        {notice === "incomplete" ? (
          <p
            role="alert"
            className="border-error/40 text-body-md rounded-card p-space-md mb-space-lg flex gap-2 border"
          >
            <TriangleAlert aria-hidden className="text-error mt-0.5 h-5 w-5 shrink-0" />
            <span>
              Your payment did not go through, and you have not been charged. Please try
              again, or use a different card.
            </span>
          </p>
        ) : null}

        {clientSecret ? (
          <StripePaymentForm
            clientSecret={clientSecret}
            totalLabel={formatPence(totalPence)}
          />
        ) : (
          <>
            <div className="border-outline-variant bg-surface-container-low rounded-card p-space-lg border border-dashed">
              <p className="text-title-md mb-1 flex items-center gap-2">
                <Info aria-hidden className="text-primary h-5 w-5" />
                Card payment is not connected yet
              </p>
              <p className="text-body-md text-on-surface-variant">
                Stripe keys are not set in this environment, so there is nothing to type a
                card into. Every other part of this step is finished: the fare, the
                breakdown, the passenger details and the cancellation terms.
              </p>
              <p className="text-body-sm text-on-surface-variant mt-space-sm">
                Set <code className="text-on-surface">STRIPE_SECRET_KEY</code> and{" "}
                <code className="text-on-surface">
                  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                </code>{" "}
                and the payment form takes this space. Test keys first (PRD-04).
              </p>
            </div>

            <button
              type="button"
              disabled
              className="bg-primary-container text-on-primary rounded-button text-label-md mt-space-lg flex h-12 w-full items-center justify-center font-semibold opacity-50"
            >
              Pay — awaiting Stripe setup
            </button>
          </>
        )}

        <p className="text-body-sm text-on-surface-variant mt-space-sm text-center">
          You are charged once, now. Your fare will not change afterwards.
        </p>
      </div>
    </section>
  );
}
