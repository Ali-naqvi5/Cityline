"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition, type ReactNode } from "react";

import { cx } from "./primitives";

/**
 * A filter bar that applies itself (spec §52): selects and checkboxes on
 * change, the search box after a short pause. It only builds the URL — the
 * filtering happens on the server, so the browser never holds more than one
 * page of records. Without JavaScript it is still a plain GET form.
 */
export function FilterForm({
  action,
  children,
  className,
}: {
  action: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(form: HTMLFormElement) {
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value.trim() !== "") query.set(key, value.trim());
    }
    const search = query.toString();
    startTransition(() => router.push(`${action}${search ? `?${search}` : ""}`));
  }

  return (
    <form
      action={action}
      method="get"
      aria-busy={pending}
      className={cx(className, pending && "opacity-70 transition-opacity")}
      onSubmit={(event) => {
        event.preventDefault();
        navigate(event.currentTarget);
      }}
      onChange={(event) => {
        // A change event on a form reports the control that changed as its target.
        const target = event.target as unknown as HTMLInputElement;
        // Controls without a name (the phone "Filters" toggle) are not filters.
        if (!target.name) return;
        const form = event.currentTarget;
        // Filters that exclude each other: `data-clear="from,to"` empties
        // those fields, `data-set="when=all"` sets one — so a date range and
        // a preset such as "Today" never pull in different directions.
        for (const name of (target.dataset.clear ?? "").split(",").filter(Boolean)) {
          const field = form.elements.namedItem(name);
          if (field instanceof HTMLInputElement) field.value = "";
        }
        const [setName, setValue] = (target.dataset.set ?? "").split("=");
        if (setName && setValue !== undefined) {
          const field = form.elements.namedItem(setName);
          if (field instanceof HTMLSelectElement || field instanceof HTMLInputElement) {
            field.value = setValue;
          }
        }
        if (timer.current) clearTimeout(timer.current);
        if (target.type === "search" || target.type === "text") {
          timer.current = setTimeout(() => navigate(form), 400);
        } else {
          navigate(form);
        }
      }}
    >
      {children}
    </form>
  );
}

export function PrintButton({
  className,
  children = "Print",
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {children}
    </button>
  );
}
