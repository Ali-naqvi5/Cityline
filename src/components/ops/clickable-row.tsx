"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { cx } from "./primitives";

/**
 * A table row that opens its record when clicked anywhere (spec §55: the
 * fastest way into a booking). Links and buttons inside it keep their own
 * behaviour; Ctrl- or Cmd-click opens a new tab. Keyboard users reach the
 * record through the link in the first cell, so nothing depends on this.
 */
export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      className={cx("cursor-pointer", className)}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("a, button, input, select, label, form")) return;
        if (window.getSelection()?.toString()) return; // copying a phone number
        if (event.metaKey || event.ctrlKey) window.open(href, "_blank");
        else router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
