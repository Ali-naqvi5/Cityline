import type { MetadataRoute } from "next";

// Evaluated per request: the launch gate flips with a container restart, never a rebuild.
export const dynamic = "force-dynamic";

/**
 * SEO-03. While the launch gate is on, nothing is indexable at all (PRD-02).
 * Once it is off: the booking steps, manage-booking and the admin stay out,
 * everything else is allowed.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

  if (process.env.LAUNCH_GATE === "on") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/manage/", "/book/", "/api/", "/account/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
