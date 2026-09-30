import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { clsx as cx } from "cn";

/**
 * The operations UI's building blocks. Plain `clsx`, not the site's merging
 * `cn`: its conflict tables know Tailwind's default names, and this theme's
 * custom ones (`text-md`, `text-ink-3`) would be merged away as "conflicts".
 */
export { cx };

// --- Buttons -----------------------------------------------------------------

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors select-none disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-xs hover:bg-accent-hover",
  secondary:
    "border border-line-strong bg-surface text-ink-2 shadow-xs hover:bg-sunken hover:text-ink",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  danger: "bg-danger text-white shadow-xs hover:bg-danger-hover",
};

// Touch targets are larger below the desktop breakpoint (spec §45).
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm lg:h-8",
  md: "h-10 px-4 text-base lg:h-9 lg:px-3.5",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...props} />
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props} />
  );
}

// --- Badges ------------------------------------------------------------------

export type Tone = "neutral" | "info" | "ok" | "warn" | "danger" | "special";

const TONES: Record<Tone, string> = {
  neutral: "border-line bg-sunken text-ink-2",
  info: "border-accent-line bg-accent-soft text-accent",
  ok: "border-ok-line bg-ok-soft text-ok",
  warn: "border-warn-line bg-warn-soft text-warn",
  danger: "border-danger-line bg-danger-soft text-danger",
  special: "border-special-line bg-special-soft text-special",
};

export function toneClass(tone: Tone): string {
  return TONES[tone];
}

/** A status label. Always text — colour never carries meaning alone (§53). */
export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-xs leading-4 font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

// --- Layout ------------------------------------------------------------------

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  meta,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-ink-3 mb-1 flex flex-wrap items-center gap-2 text-sm">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-ink text-2xl font-semibold tracking-tight lg:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-ink-3 mt-1 max-w-3xl text-base">{description}</p>
        ) : null}
        {meta ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cx("border-line bg-surface rounded-lg border shadow-xs", className)}
    >
      {title ? (
        <header className="border-line flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-md text-ink font-semibold">{title}</h2>
            {description ? (
              <p className="text-ink-3 mt-0.5 text-sm">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </header>
      ) : null}
      <div className={cx(bodyClassName ?? "p-4")}>{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone,
  href,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  href?: string;
  icon?: ReactNode;
}) {
  const body = (
    <>
      <div className="text-ink-3 flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        {icon}
      </div>
      <div
        className={cx(
          "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
          tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ink",
        )}
      >
        {value}
      </div>
      {hint ? <p className="text-ink-3 mt-1 text-xs">{hint}</p> : null}
    </>
  );
  const className =
    "block rounded-lg border border-line bg-surface p-4 shadow-xs transition-colors";
  return href ? (
    <Link
      href={href}
      className={cx(className, "hover:border-line-strong hover:bg-sunken/40")}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Label / value rows, two columns on wider screens. */
export function Fields({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl className={cx("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {children}
    </dl>
  );
}

export function Field({
  label,
  children,
  wide,
}: {
  label: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cx("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-ink-3 text-xs font-medium">{label}</dt>
      <dd className="text-ink mt-0.5 text-base break-words">{children ?? "—"}</dd>
    </div>
  );
}

/** A value that has not been recorded, said plainly rather than shown as 0. */
export function NotRecorded({ children = "Not recorded yet" }: { children?: ReactNode }) {
  return <span className="text-ink-4">{children}</span>;
}

/** A one-line result after an action: "Driver added", "Could not send". */
export function Notice({
  tone,
  children,
}: {
  tone: "ok" | "danger";
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cx(
        "mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm print:hidden",
        tone === "ok"
          ? "border-ok-line bg-ok-soft text-ok"
          : "border-danger-line bg-danger-soft text-danger",
      )}
    >
      {tone === "ok" ? (
        <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {children}
    </div>
  );
}
