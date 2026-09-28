import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Buttons per DESIGN.md "Components → Buttons".
 *
 * Primary  — solid #0e6b39 (primary-container), white text, 10px radius,
 *            0.75rem/1.5rem padding, weight 600, hover to `secondary`.
 * Secondary— transparent, 1px outline, hover tints the surface.
 *
 * The design's prose names #1E9E5A as the hover colour, but all 26 rendered
 * pages use `hover:bg-secondary` (#006d3a); the rendered value wins.
 */
type Variant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center gap-space-sm rounded-button " +
  "text-label-md font-semibold transition-colors duration-150 " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-primary-container text-on-primary hover:bg-secondary shadow-card",
  secondary:
    "border border-outline-variant text-on-surface " +
    "hover:border-primary-container hover:bg-surface-container-low",
};

const sizes = {
  md: "px-space-lg py-space-sm",
  lg: "px-space-xl py-3",
} as const;

interface ButtonStyleProps {
  variant?: Variant;
  size?: keyof typeof sizes;
  className?: string;
}

function classesFor({
  variant = "primary",
  size = "md",
  className = "",
}: ButtonStyleProps) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}

export function Button({
  variant,
  size,
  className,
  children,
  ...props
}: ButtonStyleProps & ComponentProps<"button">) {
  return (
    <button className={classesFor({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...props
}: ButtonStyleProps & ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link className={classesFor({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
