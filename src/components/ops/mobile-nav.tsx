"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { NAV_ICONS, type MobileTab, type NavSection } from "@/admin/nav";

import { cx } from "./primitives";

/**
 * The phone navigation (spec §4, §45): a tab bar for the screens a controller
 * lives in, and "More" for everything else the role can open. Large targets,
 * clear of the home indicator.
 */
export function MobileNav({
  tabs,
  sections,
  active,
  userName,
  roleLabel,
}: {
  tabs: MobileTab[];
  sections: NavSection[];
  active: string;
  userName: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const MoreIcon = NAV_ICONS.more;
  const tabIds = new Set(tabs.map((tab) => tab.id));
  const moreActive = !tabIds.has(active);

  return (
    <>
      <nav
        aria-label="Main"
        className="border-line bg-surface fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
      >
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
        >
          {tabs.map((tab) => {
            const Icon = NAV_ICONS[tab.icon];
            const isActive = tab.id === active;
            return (
              <li key={tab.id}>
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cx(
                    "text-2xs flex h-16 flex-col items-center justify-center gap-1 font-medium",
                    isActive ? "text-accent" : "text-ink-3",
                  )}
                >
                  <Icon aria-hidden className="h-5 w-5" />
                  {tab.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className={cx(
                "text-2xs flex h-16 w-full flex-col items-center justify-center gap-1 font-medium",
                moreActive ? "text-accent" : "text-ink-3",
              )}
            >
              <MoreIcon aria-hidden className="h-5 w-5" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {open ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="All sections"
        >
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="bg-ink/40 absolute inset-0"
            onClick={() => setOpen(false)}
          />
          <div className="bg-surface absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl pb-[env(safe-area-inset-bottom)] shadow-lg">
            <div className="border-line bg-surface sticky top-0 flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-md text-ink font-semibold">{userName}</p>
                <p className="text-ink-3 text-xs">{roleLabel}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-3 hover:bg-sunken flex h-10 w-10 items-center justify-center rounded-md"
                aria-label="Close"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-5 px-4 py-4">
              {sections.map((section) => (
                <div key={section.id}>
                  {section.label ? (
                    <p className="text-2xs text-ink-4 mb-1 font-semibold tracking-wider uppercase">
                      {section.label}
                    </p>
                  ) : null}
                  <ul className="flex flex-col">
                    {section.items.map((item) => {
                      const Icon = NAV_ICONS[item.icon];
                      const className = cx(
                        "flex h-12 items-center gap-3 rounded-md px-2 text-base",
                        item.id === active
                          ? "bg-accent-soft font-medium text-accent"
                          : item.ready
                            ? "text-ink-2 active:bg-sunken"
                            : "text-ink-4",
                      );
                      return (
                        <li key={item.id}>
                          {item.ready ? (
                            <Link
                              href={item.href}
                              className={className}
                              onClick={() => setOpen(false)}
                            >
                              <Icon aria-hidden className="h-5 w-5" />
                              {item.label}
                            </Link>
                          ) : (
                            <span className={className} aria-disabled="true">
                              <Icon aria-hidden className="h-5 w-5" />
                              <span className="flex-1">{item.label}</span>
                              <span className="bg-sunken text-2xs rounded-xs px-1 font-medium">
                                Soon
                              </span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              <div className="border-line flex gap-2 border-t pt-4">
                <Link
                  href="/admin/account"
                  className="border-line-strong text-ink-2 flex h-11 flex-1 items-center justify-center rounded-md border text-base font-medium"
                >
                  Account
                </Link>
                <Link
                  href="/admin/logout"
                  className="border-line-strong text-ink-2 flex h-11 flex-1 items-center justify-center rounded-md border text-base font-medium"
                >
                  Log out
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
