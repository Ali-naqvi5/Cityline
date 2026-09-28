"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { NavItem } from "@/lib/navigation";

/**
 * The Stitch exports hide the navigation below `md` and show no replacement.
 * A site that must work at 390px (§6) needs a way to navigate there, so this
 * panel is an addition to the design rather than a port of it.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  // Escape closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="text-on-surface flex h-11 w-11 items-center justify-center"
      >
        <Menu aria-hidden className="h-6 w-6" />
      </button>

      {open ? (
        <div
          id="mobile-menu"
          className="bg-surface-container-lowest fixed inset-0 z-50 flex flex-col"
        >
          <div className="border-outline-variant px-gutter flex h-24 items-center justify-between border-b">
            <span className="text-title-md">Menu</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="text-on-surface flex h-11 w-11 items-center justify-center"
            >
              <X aria-hidden className="h-6 w-6" />
            </button>
          </div>

          <nav aria-label="Main" className="px-gutter py-space-lg overflow-y-auto">
            {/*
              Sub-items are listed inline rather than behind another tap. This
              panel now covers tablets as well as phones, and burying the
              service pages one level deeper is how they stop being found.
            */}
            <ul className="gap-space-xs flex flex-col">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="text-headline-sm text-on-surface block py-3"
                  >
                    {item.label}
                  </Link>

                  {item.children && item.children.length > 0 ? (
                    <ul className="border-outline-variant mb-space-sm ml-1 flex flex-col border-l pl-4">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className="text-body-md text-on-surface-variant block py-2"
                          >
                            {child.label}
                          </Link>

                          {/*
                            The third level (the airports under Airport
                            transfers) is listed inline too. A flyout has
                            nowhere to fly to on a 390px screen, and an
                            accordion here would put the six airports two taps
                            from the menu button.
                          */}
                          {child.children && child.children.length > 0 ? (
                            <ul className="border-outline-variant mb-space-xs ml-1 flex flex-col border-l pl-4">
                              {child.children.map((grandchild) => (
                                <li key={grandchild.href}>
                                  <Link
                                    href={grandchild.href}
                                    onClick={() => setOpen(false)}
                                    className="text-body-sm text-on-surface-variant block py-1.5"
                                  >
                                    {grandchild.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
