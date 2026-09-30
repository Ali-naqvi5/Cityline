import { Bell, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { mobileTabsFor, NAV_ICONS, navFor, type NavSection } from "@/admin/nav";
import { can, ROLE_LABELS, type Role } from "@/domain/staff/permissions";

import { MobileNav } from "./mobile-nav";
import { cx } from "./primitives";

/**
 * The frame around every operations screen (spec §4): a sidebar on desktop,
 * a top bar with job search, and a tab bar plus "More" sheet on a phone.
 * Everything in it is filtered by the signed-in person's role.
 */

export interface ShellUser {
  name?: string | null;
  email: string;
  role: Role;
}

function initials(user: ShellUser): string {
  const source = (user.name || user.email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0]?.[0]}${parts.at(-1)?.[0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/cityline-logo.svg"
      alt="Cityline Airport Transfers"
      width={708}
      height={531}
      priority
      className={className}
    />
  );
}

function SidebarSections({
  sections,
  active,
}: {
  sections: NavSection[];
  active: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.id}>
          {section.label ? (
            <p className="text-2xs text-ink-4 mb-1 px-2 font-semibold tracking-wider uppercase">
              {section.label}
            </p>
          ) : null}
          <ul className="flex flex-col gap-px">
            {section.items.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const isActive = item.id === active;
              const content = (
                <>
                  <Icon aria-hidden className="h-4 w-4" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {!item.ready ? (
                    <span className="bg-sunken text-2xs text-ink-4 rounded-xs px-1 font-medium">
                      Soon
                    </span>
                  ) : null}
                </>
              );
              const className = cx(
                "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm",
                isActive
                  ? "bg-accent-soft font-medium text-accent"
                  : item.ready
                    ? "text-ink-2 hover:bg-sunken hover:text-ink"
                    : "cursor-default text-ink-4",
              );
              return (
                <li key={item.id}>
                  {item.ready ? (
                    <Link
                      href={item.href}
                      className={className}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {content}
                    </Link>
                  ) : (
                    <span
                      className={className}
                      aria-disabled="true"
                      title="Not built yet"
                    >
                      {content}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function OpsShell({
  user,
  active,
  children,
}: {
  user: ShellUser;
  active: string;
  children: ReactNode;
}) {
  const sections = navFor(user.role);
  const tabs = mobileTabsFor(user.role);
  const canSearchJobs = can(user.role, "jobs.view");

  return (
    <div className="ops-root min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)] print:block">
      <a
        href="#ops-main"
        className="bg-surface sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside className="border-line bg-surface sticky top-0 hidden h-dvh flex-col border-r lg:flex print:hidden">
        <Link
          href="/admin/dashboard"
          className="border-line flex h-14 shrink-0 items-center gap-2.5 border-b px-4"
        >
          <Logo className="h-8 w-auto" />
          <span className="text-ink-3 text-xs font-medium">Operations</span>
        </Link>

        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarSections sections={sections} active={active} />
        </nav>

        <div className="border-line flex shrink-0 items-center gap-2.5 border-t p-3">
          <span
            aria-hidden
            className="bg-sunken text-ink-2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
          >
            {initials(user)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-ink truncate text-sm font-medium">
              {user.name || user.email}
            </p>
            <p className="text-ink-3 text-xs">{ROLE_LABELS[user.role]}</p>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-xs">
            <Link href="/admin/account" className="text-ink-3 hover:text-ink">
              Account
            </Link>
            <Link href="/admin/logout" className="text-ink-3 hover:text-ink">
              Log out
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="border-line bg-surface/95 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur sm:px-6 lg:px-8 print:hidden">
          <Link
            href="/admin/dashboard"
            className="shrink-0 lg:hidden"
            aria-label="Dashboard"
          >
            <Logo className="h-7 w-auto" />
          </Link>

          {canSearchJobs ? (
            <form role="search" action="/admin/jobs" className="relative max-w-xl flex-1">
              <label htmlFor="ops-search" className="sr-only">
                Search jobs
              </label>
              <Search
                aria-hidden
                className="text-ink-4 pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
              />
              <input
                id="ops-search"
                name="q"
                type="search"
                autoComplete="off"
                placeholder="Search jobs: reference, passenger, phone, flight"
                className="border-line-strong bg-surface placeholder:text-ink-4 h-9 w-full rounded-md border pr-3 pl-8 text-sm"
              />
            </form>
          ) : (
            <div className="flex-1" />
          )}

          <Link
            href="/admin/dashboard#alerts"
            className="text-ink-3 hover:bg-sunken hover:text-ink flex h-9 w-9 items-center justify-center rounded-md"
            aria-label="Alerts"
          >
            <Bell aria-hidden className="h-4.5 w-4.5" />
          </Link>
        </header>

        <main
          id="ops-main"
          className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-6 lg:pb-10"
        >
          {children}
        </main>
      </div>

      <MobileNav
        tabs={tabs}
        sections={sections}
        active={active}
        userName={user.name || user.email}
        roleLabel={ROLE_LABELS[user.role]}
      />
    </div>
  );
}
