import { CreditCard, Info, Lock } from "lucide-react";

import { formatPence, type Pence } from "@/domain/money";

/**
 * Where Stripe's Payment Element mounts (PAY-01).
 *
 * The design draws card number, expiry, security code and cardholder name as
 * ordinary fields on the page. They are not built that way, and will not be:
 * raw card data touching our own form would put Cityline into a much heavier
 * PCI regime. The Payment Element renders those fields inside an iframe Stripe
 * controls, which keeps us at SAQ-A — and gives Apple Pay and Google Pay for
 * free, so the design's separate "Digital Wallet" option is not needed.
 *
 * Until the Stripe account clears and keys are set, this renders an honest
 * placeholder rather than a dead "Pay now" button.
 */
export function PaymentPanel({ totalPence }: { totalPence: Pence }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

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
        {configured ? (
          // TODO(S4): mount <Elements> with the Payment Element here, create the
          // PaymentIntent server-side, and let the Stripe webhook decide the
          // booking status (PAY-01). The price is recalculated on the server at
          // this point and never taken from the client (BK-08).
          <div
            id="stripe-payment-element"
            className="min-h-45"
            aria-label="Card details"
          />
        ) : (
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
              <code className="text-on-surface">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>{" "}
              and the Payment Element takes this space. Test keys first (PRD-04).
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={!configured}
          className="bg-primary-container text-on-primary hover:bg-secondary rounded-button text-label-md mt-space-lg flex h-12 w-full items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50"
        >
          {configured ? `Pay ${formatPence(totalPence)}` : "Pay — awaiting Stripe setup"}
        </button>

        <p className="text-body-sm text-on-surface-variant mt-space-sm text-center">
          You are charged once, now. Your fare will not change afterwards.
        </p>
      </div>
    </section>
  );
}
