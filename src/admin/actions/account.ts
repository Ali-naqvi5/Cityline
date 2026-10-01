"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { text } from "@/admin/form-errors";
import { staffForAction } from "@/admin/guard";

const THEMES = ["light", "dark", "system"] as const;
type Theme = (typeof THEMES)[number];

/**
 * Each member of staff's own light or dark choice (Settings → Appearance).
 *
 * Stored on their account, so it follows them to any computer, and copied to
 * Payload's theme cookie so its own screens — login, account — match on this
 * one. "Match the device" clears the cookie and lets the browser decide.
 *
 * Written with access overridden because staff other than the owner cannot
 * edit their account record; the write is to the signed-in person's own
 * record, and to this one field only.
 */
export async function setThemeAction(formData: FormData): Promise<void> {
  const { payload, user } = await staffForAction("dashboard");
  const theme = text(formData, "theme") as Theme;
  if (!THEMES.includes(theme)) redirect("/admin/settings");

  await payload.update({
    collection: "users",
    id: user.id,
    data: { opsTheme: theme },
    overrideAccess: true,
  });

  const jar = await cookies();
  const name = `${payload.config.cookiePrefix || "payload"}-theme`;
  if (theme === "system") {
    jar.delete(name);
  } else {
    jar.set(name, theme, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect("/admin/settings?notice=theme");
}
