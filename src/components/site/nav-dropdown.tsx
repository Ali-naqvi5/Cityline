"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { NavItem } from "@/lib/navigation";

/**
 * A navigation item that opens a menu, with a second level that flies out to
 * the right — Services → Airport transfers → the six airports.
 *
 * The two levels behave differently on purpose:
 *
 *   Level 1 (Services) opens on **click**. It is a button, not a link, and a
 *   hover menu at the top of a page is easy to trigger by accident just
 *   crossing the header.
 *
 *   Level 2 (Airport transfers) is a single link. **Hover reveals** its
 *   submenu; **clicking goes to the service page.** One row, one target — no
 *   separate chevron button to hit.
 *
 * What that costs, and how it is covered: hover does not exist on a
 * touchscreen, so on a touch device a tap would navigate and the submenu would
 * never open. It never comes up, because this menu only renders at `lg` and
 * above — phones and tablets get `MobileNav`, which lists all three levels
 * inline with nothing to hover.
 *
 * Keyboard users are covered by opening the submenu on focus as well as hover,
 * so tabbing onto "Airport transfers" reveals the airports and the next Tab
 * walks into them. Escape closes everything and returns focus to the trigger.
 */

/**
 * Grace period before a flown-out submenu closes.
 *
 * Pointers travel in diagonals, not straight lines: moving from the parent row
 * toward the submenu clips the row below on the way. Closing the instant the
 * pointer leaves makes the menu feel like it is dodging you.
 */
const CLOSE_DELAY_MS = 120;

export function NavDropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  /** Which child's submenu is showing, by href. */
  const [openChild, setOpenChild] = useState<string | null>(null);

  const menuId = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  function openSubmenu(href: string) {
    cancelClose();
    setOpenChild(href);
  }

  function scheduleCloseSubmenu() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenChild(null), CLOSE_DELAY_MS);
  }

  // Stable, because the document-level listeners below depend on it and would
  // otherwise be torn down and rebuilt on every render.
  const closeAll = useCallback(() => {
    cancelClose();
    setOpen(false);
    setOpenChild(null);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) closeAll();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      closeAll();
      // Focus goes back to the trigger, or a keyboard user is stranded.
      trigger.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeAll]);

  const children = item.children ?? [];

  const rowClasses =
    "text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary block rounded-lg px-3 py-2 transition-colors";

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="text-label-md text-on-surface-variant hover:text-primary aria-expanded:text-primary py-space-xs flex items-center gap-1 transition-colors"
      >
        {item.label}
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul
          id={menuId}
          className="border-outline-variant bg-surface-container-lowest rounded-card shadow-card-hover absolute top-full left-0 z-50 mt-2 min-w-60 border p-1.5"
        >
          {children.map((child) => {
            const grandchildren = child.children ?? [];
            const hasSubmenu = grandchildren.length > 0;
            const submenuOpen = openChild === child.href;

            if (!hasSubmenu) {
              return (
                <li key={child.href}>
                  <Link href={child.href} onClick={closeAll} className={rowClasses}>
                    {child.label}
                  </Link>
                </li>
              );
            }

            return (
              <li
                key={child.href}
                className="relative"
                onMouseEnter={() => openSubmenu(child.href)}
                onMouseLeave={scheduleCloseSubmenu}
                // Focus bubbles from the link and from the submenu's own links,
                // so keyboard users get the same behaviour as a pointer.
                onFocus={() => openSubmenu(child.href)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    scheduleCloseSubmenu();
                  }
                }}
              >
                {/*
                  One row, one target. The whole thing is the link to the
                  service page; hovering or focusing it reveals the places
                  underneath. There is no separate chevron to aim at — the
                  chevron is decoration.
                */}
                <Link
                  href={child.href}
                  onClick={closeAll}
                  aria-haspopup="true"
                  aria-expanded={submenuOpen}
                  className={`${rowClasses} flex items-center justify-between gap-2`}
                >
                  {child.label}
                  <ChevronRight
                    aria-hidden
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      submenuOpen ? "translate-x-0.5" : ""
                    }`}
                  />
                </Link>

                {submenuOpen ? (
                  <ul className="border-outline-variant bg-surface-container-lowest rounded-card shadow-card-hover absolute top-0 left-full z-50 min-w-56 border p-1.5">
                    {grandchildren.map((grandchild) => (
                      <li key={grandchild.href}>
                        <Link
                          href={grandchild.href}
                          onClick={closeAll}
                          className={rowClasses}
                        >
                          {grandchild.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
