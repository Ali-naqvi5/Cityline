import Link from "next/link";

import { cx } from "@/components/ops/primitives";

/**
 * Drivers and their cars are one part of the fleet (Cityline, 9 Oct 2026):
 * one menu entry, two lists, a tab each. The Cars tab is shown only to those
 * who may see the cars.
 */
export function FleetTabs({
  active,
  showCars,
}: {
  active: "drivers" | "cars";
  showCars: boolean;
}) {
  const tabs = [
    { id: "drivers", label: "Drivers", href: "/admin/drivers" },
    ...(showCars ? [{ id: "cars", label: "Cars", href: "/admin/vehicles" }] : []),
  ];
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Drivers and cars" className="border-line mb-4 flex gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === active ? "page" : undefined}
          className={cx(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
            tab.id === active
              ? "border-accent text-ink"
              : "text-ink-3 hover:text-ink border-transparent",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
