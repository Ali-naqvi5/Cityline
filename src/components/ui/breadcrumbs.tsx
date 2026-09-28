import { ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * Breadcrumb trail plus its `BreadcrumbList` structured data (SEO-04).
 *
 * Both come from the same array, so the markup a reader sees and the data
 * Google reads can never disagree.
 */
export interface Crumb {
  label: string;
  /** Omitted on the current page, which is not a link. */
  href?: string;
}

export function Breadcrumbs({
  crumbs,
  siteUrl,
}: {
  crumbs: Crumb[];
  /** Absolute base, needed because structured data requires absolute URLs. */
  siteUrl: string;
}) {
  const trail: Crumb[] = [{ label: "Home", href: "/" }, ...crumbs];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      ...(crumb.href ? { item: new URL(crumb.href, siteUrl).toString() } : {}),
    })),
  };

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="text-body-sm text-on-surface-variant flex flex-wrap items-center gap-1">
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1;
            return (
              <li key={crumb.label} className="flex items-center gap-1">
                {crumb.href && !last ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-primary transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
                {last ? null : <ChevronRight aria-hidden className="h-3.5 w-3.5" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <script
        type="application/ld+json"
        // Generated from `trail` above, never from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
