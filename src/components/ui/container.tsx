import type { ReactNode } from "react";

/**
 * The 1200px content box every page sits in (DESIGN.md "Layout & Spacing"):
 * 1.5rem gutters, centred, full width below that.
 */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-content px-gutter mx-auto w-full ${className}`.trim()}>
      {children}
    </div>
  );
}
