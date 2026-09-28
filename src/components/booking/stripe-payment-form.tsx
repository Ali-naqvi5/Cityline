"use client";

import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";

/**
 * The card form on step 4 (PAY-01): Stripe's Payment Element, backed by the
 * quote's Checkout Session (`ui_mode: "elements"`).
 *
 * The fields live in Stripe's iframe, not in our page, which is what keeps
 * Cityline at PCI SAQ-A: a card number never touches this site's code. Stripe.js
 * is loaded from js.stripe.com by `loadStripe`, never bundled or self-hosted,
 * for the same reason.
 *
 * Which payment methods appear — cards, Apple Pay, Google Pay, Link — is decided
 * by Stripe from the Dashboard settings and the customer's device, not listed
 * here.
 */

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

// Once per page load, outside any component. A promise created during render
// would reload Stripe.js on every re-render.
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

/**
 * The site's tokens, as literal values: the form renders inside Stripe's
 * iframe, where our CSS variables do not reach. Kept in step with
 * `globals.css` by hand — they are the primary, surface, text, outline and
 * error colours, and the button radius.
 *
 * No `fonts` option on purpose. Loading Inter into Stripe's iframe means a
 * request to Google Fonts, and the site makes none (CMP-11). The form falls
 * back to the visitor's system sans-serif, which sits comfortably next to it.
 */
const appearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#0e6b39",
    colorBackground: "#ffffff",
    colorText: "#121e18",
    colorTextSecondary: "#3f4940",
    colorDanger: "#ba1a1a",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "10px",
  },
  rules: {
    ".Input": { borderColor: "#bfc9bd", boxShadow: "none" },
    ".Input:focus": {
      borderColor: "#0e6b39",
      boxShadow: "0 0 0 1px #0e6b39",
    },
  },
};

const GENERIC_FAILURE =
  "Your payment could not be completed, and you have not been charged. Please check your card details and try again.";

export function StripePaymentForm({
  clientSecret,
  totalLabel,
}: {
  clientSecret: string;
  /** The formatted total for the button, e.g. "£96.00". */
  totalLabel: string;
}) {
  if (!stripePromise) return null;

  return (
    <CheckoutElementsProvider
      stripe={stripePromise}
      options={{ clientSecret, elementsOptions: { appearance } }}
    >
      <PaymentForm totalLabel={totalLabel} />
    </CheckoutElementsProvider>
  );
}

function PaymentForm({ totalLabel }: { totalLabel: string }) {
  const state = useCheckoutElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.type === "loading") {
    return (
      <div
        aria-busy="true"
        aria-label="Loading the secure payment form"
        className="gap-space-md flex flex-col"
      >
        <div className="bg-surface-container-low rounded-button h-12 animate-pulse" />
        <div className="bg-surface-container-low rounded-button h-12 animate-pulse" />
        <div className="bg-surface-container-low rounded-button h-12 animate-pulse" />
      </div>
    );
  }

  if (state.type === "error") {
    return (
      <p
        role="alert"
        className="border-error/40 text-body-md rounded-card p-space-md flex gap-2 border"
      >
        <TriangleAlert aria-hidden className="text-error mt-0.5 h-5 w-5 shrink-0" />
        <span>
          The secure payment form did not load. Please refresh the page. If it still does
          not appear, call us and we will take your booking by phone.
        </span>
      </p>
    );
  }

  const { checkout } = state;

  async function pay() {
    setSubmitting(true);
    setError(null);

    /*
     * On success Stripe sends the browser to the session's return URL, where
     * the booking is confirmed. So the code after this only ever runs when the
     * payment did not go through — a decline, a failed bank check, or an
     * incomplete form.
     *
     * Whatever happens, the customer is told. Stripe marks invalid fields in
     * its own frame, but an error can come back with no message, and a Pay
     * button that silently does nothing is the fastest way to lose a booking
     * — or to have someone press it five times.
     */
    try {
      const result = await checkout.confirm({ redirect: "always" });
      if (result.type === "success") return;

      console.warn("[payment] confirm returned an error", result.error);
      setError(result.error.message || GENERIC_FAILURE);
    } catch (thrown) {
      console.error("[payment] confirm threw", thrown);
      setError(GENERIC_FAILURE);
    }

    setSubmitting(false);
  }

  return (
    <div className="gap-space-lg flex flex-col">
      <PaymentElement options={{ layout: "accordion" }} />

      {error ? (
        <p
          role="alert"
          className="border-error/40 text-body-md rounded-card p-space-md flex gap-2 border"
        >
          <TriangleAlert aria-hidden className="text-error mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      <button
        type="button"
        onClick={pay}
        disabled={!checkout.canConfirm || submitting}
        className="bg-primary-container text-on-primary hover:bg-secondary rounded-button text-label-md flex h-12 w-full items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            Processing payment…
          </>
        ) : (
          `Pay ${totalLabel}`
        )}
      </button>
    </div>
  );
}
