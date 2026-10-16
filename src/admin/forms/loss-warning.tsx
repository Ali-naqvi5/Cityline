"use client";

import { AlertTriangle } from "lucide-react";

import { driverPriceLoss } from "@/domain/finance/booking-money";
import { formatPence, parsePounds, type Pence } from "@/domain/money";

const money = (pence: number) => formatPence(pence as Pence);

/**
 * The loss warning beside a driver or operator price (Cityline, 16 Oct
 * 2026): when the price typed is more than the booking's agreed price, say
 * what the booking loses. It only warns — a loss can be the right call — and
 * uses only the agreed price, which whoever dispatches already sees.
 */
export function LossWarning({
  customerPricePence,
  typed,
  operator = false,
}: {
  customerPricePence: number | null;
  /** The price as typed, in pounds. */
  typed: string;
  operator?: boolean;
}) {
  const loss = driverPriceLoss(customerPricePence, typed ? parsePounds(typed) : null);
  if (loss === null) return null;
  return (
    <p role="status" className="text-warn flex items-start gap-1.5 text-sm">
      <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        This booking loses <strong>{money(loss)}</strong>: the{" "}
        {operator ? "operator" : "driver"} price is more than its agreed price of{" "}
        {money(customerPricePence!)}. It can still be saved.
      </span>
    </p>
  );
}
