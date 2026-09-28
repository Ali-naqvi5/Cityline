import { Clock, Phone } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container } from "@/components/ui/container";
import { manageTokenFor } from "@/domain/booking/manage-token";
import { fulfilCheckoutSession } from "@/domain/payments/fulfil-checkout";
import { company, telHref } from "@/lib/company";

/**
 * Where Stripe sends the customer after they pay (`return_url`).
 *
 * Not a page anyone is meant to look at. It runs the same fulfilment as the
 * webhook — Stripe recommends both, because webhooks can lag — then sends the
 * customer on:
 *
 *   paid        → their confirmation, with the magic link
 *   unpaid      → back to step 4 to try again (a declined card, or a bank
 *                 redirect they backed out of)
 *   expired     → step 4, which shows the quote-expired screen
 *
 * Only a delayed payment method, which has not settled yet, renders here.
 *
 * The session id in the URL grants nothing on its own. Fulfilment reads the
 * session back from Stripe with the secret key and books only what Stripe says
 * was paid, so a guessed or replayed id can at most repeat a booking that
 * already exists — which is a no-op.
 */
export const metadata: Metadata = {
  title: "Confirming your booking",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function PaymentReturnPage({
  searchParams,
}: PageProps<"/book/return">) {
  const params = await searchParams;
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";

  if (!sessionId.startsWith("cs_")) redirect("/book");

  const result = await fulfilCheckoutSession(sessionId).catch((error: unknown) => {
    console.error(`[payment-return] fulfilment failed for ${sessionId}`, error);
    return { state: "error" as const };
  });

  switch (result.state) {
    case "confirmed":
      redirect(
        `/book/confirmed/${result.reference}?t=${encodeURIComponent(manageTokenFor(result.reference))}`,
      );

    case "unpaid":
      redirect(
        `/book/payment?q=${encodeURIComponent(result.quoteToken)}&payment=incomplete`,
      );

    case "expired":
      redirect(`/book/payment?q=${encodeURIComponent(result.quoteToken)}`);

    case "not_ours":
      redirect("/book");

    case "processing":
      return (
        <PaymentNotice
          title="Your payment is being processed"
          body={[
            "Your bank is still confirming the payment. That usually takes a few minutes, and occasionally longer for bank payments.",
            "You do not need to stay on this page. As soon as the payment clears, your booking is confirmed and we email you the details.",
          ]}
        />
      );

    case "amount_mismatch":
    case "error":
      /*
       * The customer may well have paid, so this must not look like a failure
       * or invite them to pay again. The webhook will retry the error case on
       * its own; the mismatch case needs a person.
       */
      return (
        <PaymentNotice
          title="We are confirming your booking"
          body={[
            "Your payment has reached us, but we could not finish setting up the booking just yet. Please do not pay again.",
            "We will email your confirmation shortly. If it has not arrived within the hour, call us and we will sort it out straight away.",
          ]}
        />
      );
  }
}

function PaymentNotice({ title, body }: { title: string; body: string[] }) {
  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <p className="bg-surface-container-low text-on-surface-variant text-label-sm mb-space-md inline-flex items-center gap-1.5 rounded-full px-3 py-1">
          <Clock aria-hidden className="h-3.5 w-3.5" />
          Nearly there
        </p>

        <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-space-md">
          {title}
        </h1>

        <div className="gap-space-md text-body-lg text-on-surface-variant flex flex-col">
          {body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <p className="text-body-md text-on-surface-variant mt-space-xl flex items-center gap-2">
          <Phone aria-hidden className="h-4 w-4" />
          <a href={telHref()} className="text-primary tabular-nums hover:underline">
            {company.phone}
          </a>
          — {company.serviceHours}
        </p>
      </div>
    </Container>
  );
}
