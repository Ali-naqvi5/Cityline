"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useRef } from "react";

import { setThemeAction } from "@/admin/actions/account";
import { buttonClass, cx } from "@/components/ops/primitives";

const CHOICES = [
  { value: "light", label: "Light", hint: "Dark text on white.", icon: Sun },
  {
    value: "dark",
    label: "Dark",
    hint: "Light text on dark grey. Easier at night.",
    icon: Moon,
  },
  {
    value: "system",
    label: "Match the device",
    hint: "Follows this computer or phone's own setting.",
    icon: Monitor,
  },
] as const;

/**
 * Light, dark or the device's choice. Saves as soon as one is picked; the
 * button is there for keyboards and for browsers without JavaScript.
 */
export function ThemeForm({ current }: { current: string }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={setThemeAction} className="flex flex-col gap-3">
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">Appearance</legend>
        {CHOICES.map(({ value, label, hint, icon: Icon }) => (
          <label
            key={value}
            className={cx(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3",
              current === value
                ? "border-accent bg-accent-soft"
                : "border-line hover:border-line-strong hover:bg-sunken",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              defaultChecked={current === value}
              onChange={() => form.current?.requestSubmit()}
              className="accent-accent mt-1 h-4 w-4"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-ink flex items-center gap-1.5 font-medium">
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </span>
              <span className="text-ink-3 text-xs">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <noscript>
        <button type="submit" className={buttonClass("secondary", "sm")}>
          Save
        </button>
      </noscript>
    </form>
  );
}
